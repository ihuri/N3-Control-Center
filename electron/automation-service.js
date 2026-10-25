import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { Notification } from 'electron';

const execFileAsync = promisify(execFile);

export class AutomationService {
  constructor({ app, store, deviceManager, onShowHud, onStateChanged }) {
    this.app = app;
    this.store = store;
    this.deviceManager = deviceManager;
    this.onShowHud = onShowHud;
    this.onStateChanged = onStateChanged;

    this._notified20 = false;
    this._notified10 = false;
    this.ecoActive = false;
    this.macLowPowerActive = false;
    this.frontApp = null;
    this._manualProfileIdBeforeAuto = null;
    this._autoSwitchedProfileId = null;

    this._powerTimer = null;
    this._appWatcherTimer = null;
  }

  start() {
    this.syncSystemSettings();

    // Escuta troca física de DPI (botões CPI+ / CPI- via Input Report 0x54 / 0xE2)
    this.deviceManager.on('physical-dpi-changed', ({ activeStage, pollingRateHz }) => {
      const snap = this.store.getSnapshot();
      const activeProfile = this.store.getActiveProfile();
      const nextStage = Math.min(activeProfile.dpiStageCount, Math.max(1, activeStage));
      const dpiValue = activeProfile.dpiStages[nextStage - 1] ?? 800;

      this.store.updateActiveProfile({ activeDpiStage: nextStage });
      this.onStateChanged?.();

      if (snap.automations.dpiChangeHud) {
        this.onShowHud?.({
          stage: nextStage,
          dpi: dpiValue,
          pollingRateHz: pollingRateHz ?? activeProfile.pollingRateHz,
        });
      }
    });

    // Escuta telemetria de bateria para Alerta de Bateria Baixa e Auto-Eco
    this.deviceManager.on('state-changed', (devStatus) => {
      this._evaluateBatteryAndEco(devStatus).catch(() => {});
    });

    // Verifica Modo Pouca Energia do macOS a cada 20s
    this._checkMacLowPowerMode().catch(() => {});
    this._powerTimer = setInterval(() => {
      this._checkMacLowPowerMode().catch(() => {});
    }, 20000);

    // Monitora app em foco para Troca Automática de Perfil a cada 2.5s
    this._appWatcherTimer = setInterval(() => {
      this._checkFrontmostApp().catch(() => {});
    }, 2500);
  }

  stop() {
    if (this._powerTimer) clearInterval(this._powerTimer);
    if (this._appWatcherTimer) clearInterval(this._appWatcherTimer);
  }

  syncSystemSettings() {
    const { menubar } = this.store.getSnapshot();
    try {
      if (this.app.isPackaged) {
        this.app.setLoginItemSettings({ openAtLogin: Boolean(menubar.launchAtLogin) });
      }
    } catch {
      // Ignora em ambiente de desenvolvimento sem bundle assinado
    }
  }

  async _checkMacLowPowerMode() {
    if (process.platform !== 'darwin') return;
    try {
      const { stdout } = await execFileAsync('/usr/bin/pmset', ['-g'], { timeout: 2000 });
      const isLowPower = /\b(?:low)?powermode\s+1\b/i.test(stdout);
      if (isLowPower !== this.macLowPowerActive) {
        this.macLowPowerActive = isLowPower;
        await this._evaluateBatteryAndEco(this.deviceManager.getSnapshot());
        this.onStateChanged?.();
      }
    } catch {
      // Ignora erro caso pmset não esteja disponível
    }
  }

  async _evaluateBatteryAndEco(devStatus) {
    const { automations } = this.store.getSnapshot();
    const activeProfile = this.store.getActiveProfile();
    const isWirelessOnline =
      devStatus.connected && devStatus.mode === 'wireless' && devStatus.wirelessOnline;
    const pct = devStatus.battery?.percent;

    // 1. Notificações nativas de bateria baixa (20% e 10%)
    if (isWirelessOnline && typeof pct === 'number') {
      if (pct > 25) {
        this._notified20 = false;
        this._notified10 = false;
      } else if (automations.lowBatteryAlert && Notification.isSupported()) {
        if (pct <= 10 && !this._notified10) {
          this._notified10 = true;
          this._notified20 = true;
          new Notification({
            title: 'Darmoshark N3 — Bateria Crítica',
            body: `Nível em ${pct}%. Conecte o cabo USB-C para recarregar.`,
          }).show();
        } else if (pct <= 20 && !this._notified20) {
          this._notified20 = true;
          new Notification({
            title: 'Darmoshark N3 — Bateria Baixa',
            body: `Nível em ${pct}%.`,
          }).show();
        }
      }
    }

    // 2. Modo Auto-Eco
    const ecoCfg = automations.autoEco;
    if (!devStatus.connected || !devStatus.wirelessOnline) {
      return;
    }

    const lowBatTrigger =
      ecoCfg.enabled &&
      devStatus.mode === 'wireless' &&
      typeof pct === 'number' &&
      pct > 0 &&
      pct <= ecoCfg.batteryThreshold;

    const macPowerTrigger = ecoCfg.enabled && ecoCfg.useMacLowPowerMode && this.macLowPowerActive;
    const shouldEco = lowBatTrigger || macPowerTrigger;

    if (shouldEco && !this.ecoActive) {
      this.ecoActive = true;
      if (devStatus.pollingRateHz !== ecoCfg.ecoPollingRateHz) {
        await this.deviceManager.setPollingRate(ecoCfg.ecoPollingRateHz).catch(() => {});
      }
      this.onStateChanged?.();
    } else if (!shouldEco && this.ecoActive) {
      this.ecoActive = false;
      if (devStatus.pollingRateHz !== activeProfile.pollingRateHz) {
        await this.deviceManager.setPollingRate(activeProfile.pollingRateHz).catch(() => {});
      }
      this.onStateChanged?.();
    }
  }

  async getFrontmostAppInfo() {
    if (process.platform !== 'darwin') return null;
    try {
      const { stdout: asnRaw } = await execFileAsync('/usr/bin/lsappinfo', ['front'], {
        timeout: 1500,
      });
      const asn = asnRaw.trim();
      if (!asn) return null;
      const { stdout: infoRaw } = await execFileAsync(
        '/usr/bin/lsappinfo',
        ['info', '-only', 'name,bundleid', asn],
        { timeout: 1500 },
      );
      const nameMatch = /"([^"]+)"\s+ASN:/i.exec(infoRaw);
      const bundleMatch = /bundleID="([^"]+)"/i.exec(infoRaw);
      return {
        name: nameMatch ? nameMatch[1] : null,
        bundleId: bundleMatch ? bundleMatch[1] : null,
      };
    } catch {
      return null;
    }
  }

  async _checkFrontmostApp() {
    const snap = this.store.getSnapshot();
    const { appProfiles } = snap.automations;
    if (!appProfiles.enabled || appProfiles.rules.length === 0) {
      this._autoSwitchedProfileId = null;
      this._manualProfileIdBeforeAuto = null;
      return;
    }

    const front = await this.getFrontmostAppInfo();
    if (!front || (!front.name && !front.bundleId)) return;

    // Ignora o próprio N3 Control Center / Electron para não desfazer o perfil ao abrir o painel
    const haystack = `${front.name ?? ''} ${front.bundleId ?? ''}`.toLowerCase();
    if (haystack.includes('n3 control center') || haystack.includes('com.github.electron')) {
      return;
    }

    this.frontApp = front;

    const matchedRule = appProfiles.rules.find((rule) => {
      const needle = rule.appMatch.toLowerCase();
      return needle && haystack.includes(needle);
    });

    if (matchedRule && snap.profiles.some((p) => p.id === matchedRule.profileId)) {
      if (snap.activeProfileId !== matchedRule.profileId) {
        if (!this._autoSwitchedProfileId) {
          this._manualProfileIdBeforeAuto = snap.activeProfileId;
        }
        this._autoSwitchedProfileId = matchedRule.profileId;
        this.store.setActiveProfile(matchedRule.profileId);
        const targetProfile = this.store.getActiveProfile();
        await this.deviceManager.applyProfile(targetProfile, { includeButtons: true }).catch(() => {});
        this.onStateChanged?.();
      }
    } else if (this._autoSwitchedProfileId && this._manualProfileIdBeforeAuto) {
      const restoreId = this._manualProfileIdBeforeAuto;
      this._autoSwitchedProfileId = null;
      this._manualProfileIdBeforeAuto = null;
      if (snap.profiles.some((p) => p.id === restoreId) && snap.activeProfileId !== restoreId) {
        this.store.setActiveProfile(restoreId);
        const restoredProfile = this.store.getActiveProfile();
        await this.deviceManager.applyProfile(restoredProfile, { includeButtons: true }).catch(() => {});
        this.onStateChanged?.();
      }
    }
  }

  listInstalledMacApps() {
    try {
      const entries = fs.readdirSync('/Applications');
      return entries
        .filter((name) => name.endsWith('.app'))
        .map((name) => name.replace(/\.app$/i, ''))
        .sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  }

  getRuntimeState() {
    return {
      ecoActive: this.ecoActive,
      macLowPowerActive: this.macLowPowerActive,
      frontApp: this.frontApp,
      autoSwitchedProfileId: this._autoSwitchedProfileId,
    };
  }
}
