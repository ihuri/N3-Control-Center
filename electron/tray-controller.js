import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Menu, Tray, nativeImage } from 'electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveAssetPath(filename) {
  const candidate = path.join(__dirname, 'assets', filename);
  const unpacked = candidate.replace('app.asar', 'app.asar.unpacked');
  return fs.existsSync(unpacked) ? unpacked : candidate;
}

export class TrayController {
  constructor({
    store,
    deviceManager,
    onTogglePopover,
    onHidePopover,
    onOpenMainWindow,
    onQuit,
    onApplyQuickChange,
  }) {
    this.store = store;
    this.deviceManager = deviceManager;
    this.onTogglePopover = onTogglePopover;
    this.onHidePopover = onHidePopover;
    this.onOpenMainWindow = onOpenMainWindow;
    this.onQuit = onQuit;
    this.onApplyQuickChange = onApplyQuickChange;

    this.tray = null;
    this._onlineIcon = null;
    this._offlineIcon = null;
  }

  init() {
    const onlinePath = resolveAssetPath('trayTemplate.png');
    const offlinePath = resolveAssetPath('trayOfflineTemplate.png');

    this._onlineIcon = nativeImage.createFromPath(onlinePath);
    this._onlineIcon.setTemplateImage(true);

    this._offlineIcon = nativeImage.createFromPath(offlinePath);
    this._offlineIcon.setTemplateImage(true);

    this.tray = new Tray(this._onlineIcon);
    this.tray.setToolTip('N3 Control Center — Darmoshark N3');

    // MODO HÍBRIDO:
    // - Clique Esquerdo: abre o Mini Popover estilo Control Center
    // - Clique Direito (ou Ctrl+Clique no macOS): abre o Menu Nativo NSMenu
    this.tray.on('click', (event, bounds) => {
      if (event.ctrlKey) {
        this.onHidePopover?.();
        this.tray.popUpContextMenu(this.buildNativeMenu());
        return;
      }
      this.onTogglePopover?.(bounds);
    });

    this.tray.on('right-click', () => {
      this.onHidePopover?.();
      this.tray.popUpContextMenu(this.buildNativeMenu());
    });

    this.refresh();
  }

  formatTrayTitle() {
    const snap = this.store.getSnapshot();
    const dev = this.deviceManager.getSnapshot();
    const activeProfile = this.store.getActiveProfile();
    const { showBatteryPercent, showDpi, hideBatteryWhenFullOrWired } = snap.menubar;

    const parts = [];

    if (showBatteryPercent && dev.connected && dev.wirelessOnline) {
      const pct = dev.battery?.percent;
      const isWired = dev.mode === 'wired';
      const shouldHide =
        hideBatteryWhenFullOrWired && (isWired || (typeof pct === 'number' && pct >= 100));

      if (!shouldHide && typeof pct === 'number') {
        parts.push(`${pct}%`);
      } else if (!shouldHide && isWired) {
        parts.push('USB');
      }
    }

    if (showDpi) {
      const stageIdx = (dev.activeDpiStage ?? activeProfile.activeDpiStage ?? 1) - 1;
      const stages = dev.hardwareDpiStages ?? activeProfile.dpiStages;
      const currentDpi = stages[stageIdx] ?? activeProfile.dpiStages[0];
      if (currentDpi) {
        parts.push(`${currentDpi}`);
      }
    }

    return parts.length > 0 ? ` ${parts.join(' · ')}` : '';
  }

  refresh() {
    if (!this.tray) return;
    const dev = this.deviceManager.getSnapshot();
    const isOnline = dev.connected && dev.wirelessOnline !== false;

    this.tray.setImage(isOnline ? this._onlineIcon : this._offlineIcon);
    const title = this.formatTrayTitle();
    this.tray.setTitle(title, { fontType: 'monospacedDigit' });
  }

  buildNativeMenu() {
    const snap = this.store.getSnapshot();
    const dev = this.deviceManager.getSnapshot();
    const profile = this.store.getActiveProfile();

    const connText = !dev.connected
      ? 'Desconectado'
      : dev.mode === 'wired'
        ? 'USB Com Fio Online'
        : dev.wirelessOnline
          ? '2.4GHz Sem Fio Online'
          : '2.4GHz Em Repouso';

    const batText =
      dev.battery?.percent !== null && dev.battery?.percent !== undefined
        ? `${dev.battery.percent}%${dev.mode === 'wired' ? ' (USB)' : ''}`
        : 'N/D';

    const effectiveStages = dev.hardwareDpiStages ?? profile.dpiStages;
    const stageCount = profile.dpiStageCount;
    const activeStage = dev.activeDpiStage ?? profile.activeDpiStage;
    const activeRate = dev.pollingRateHz ?? profile.pollingRateHz;

    const dpiItems = effectiveStages.slice(0, stageCount).map((dpi, idx) => ({
      label: `Estágio #${idx + 1}: ${dpi} DPI`,
      type: 'radio',
      checked: activeStage === idx + 1,
      click: () => {
        this.onApplyQuickChange?.({ type: 'dpi-stage', activeStage: idx + 1 });
      },
    }));

    const rateItems = [125, 500, 1000].map((hz) => ({
      label: `${hz} Hz`,
      type: 'radio',
      checked: activeRate === hz,
      click: () => {
        this.onApplyQuickChange?.({ type: 'polling-rate', hz });
      },
    }));

    const profileItems = snap.profiles.map((p) => ({
      label: p.name,
      type: 'radio',
      checked: p.id === snap.activeProfileId,
      click: () => {
        this.onApplyQuickChange?.({ type: 'switch-profile', profileId: p.id });
      },
    }));

    return Menu.buildFromTemplate([
      {
        label: `Darmoshark N3 • ${connText}`,
        enabled: false,
      },
      {
        label: `Bateria: ${batText}   |   FW: ${dev.firmwareVersion ?? 'N/D'}`,
        enabled: false,
      },
      { type: 'separator' },
      { label: 'Troca Rápida de DPI', enabled: false },
      ...dpiItems,
      { type: 'separator' },
      { label: 'Polling Rate', enabled: false },
      ...rateItems,
      { type: 'separator' },
      {
        label: 'Sensor PAW3395 & Debounce',
        submenu: [
          {
            label: 'Motion Sync',
            type: 'checkbox',
            checked: profile.sensor.motionSync,
            click: () =>
              this.onApplyQuickChange?.({
                type: 'sensor',
                patch: { motionSync: !profile.sensor.motionSync },
              }),
          },
          {
            label: 'Angle Snap',
            type: 'checkbox',
            checked: profile.sensor.angleSnap,
            click: () =>
              this.onApplyQuickChange?.({
                type: 'sensor',
                patch: { angleSnap: !profile.sensor.angleSnap },
              }),
          },
          {
            label: 'Ripple Control',
            type: 'checkbox',
            checked: profile.sensor.rippleControl,
            click: () =>
              this.onApplyQuickChange?.({
                type: 'sensor',
                patch: { rippleControl: !profile.sensor.rippleControl },
              }),
          },
          { type: 'separator' },
          {
            label: 'LOD Low (~1mm)',
            type: 'radio',
            checked: profile.lod === 'low',
            click: () => this.onApplyQuickChange?.({ type: 'lod', lod: 'low' }),
          },
          {
            label: 'LOD High (~2mm)',
            type: 'radio',
            checked: profile.lod === 'high',
            click: () => this.onApplyQuickChange?.({ type: 'lod', lod: 'high' }),
          },
          { type: 'separator' },
          ...[0, 2, 4, 8, 12].map((ms) => ({
            label: `Debounce: ${ms} ms`,
            type: 'radio',
            checked: profile.debounceMs === ms,
            click: () => this.onApplyQuickChange?.({ type: 'debounce', ms }),
          })),
        ],
      },
      {
        label: 'Perfil Ativo',
        submenu: profileItems,
      },
      {
        label: 'Texto na Menu Bar / Hidden Bar',
        submenu: [
          {
            label: 'Exibir % da Bateria',
            type: 'checkbox',
            checked: snap.menubar.showBatteryPercent,
            click: () =>
              this.onApplyQuickChange?.({
                type: 'menubar-pref',
                patch: { showBatteryPercent: !snap.menubar.showBatteryPercent },
              }),
          },
          {
            label: 'Exibir DPI Atual',
            type: 'checkbox',
            checked: snap.menubar.showDpi,
            click: () =>
              this.onApplyQuickChange?.({
                type: 'menubar-pref',
                patch: { showDpi: !snap.menubar.showDpi },
              }),
          },
          {
            label: 'Ocultar % quando 100% ou no Cabo',
            type: 'checkbox',
            checked: snap.menubar.hideBatteryWhenFullOrWired,
            click: () =>
              this.onApplyQuickChange?.({
                type: 'menubar-pref',
                patch: {
                  hideBatteryWhenFullOrWired: !snap.menubar.hideBatteryWhenFullOrWired,
                },
              }),
          },
        ],
      },
      { type: 'separator' },
      {
        label: 'Abrir N3 Control Center...',
        accelerator: 'Command+,',
        click: () => this.onOpenMainWindow?.(),
      },
      {
        label: 'Iniciar automaticamente no Login',
        type: 'checkbox',
        checked: snap.menubar.launchAtLogin,
        click: () =>
          this.onApplyQuickChange?.({
            type: 'menubar-pref',
            patch: { launchAtLogin: !snap.menubar.launchAtLogin },
          }),
      },
      { type: 'separator' },
      {
        label: 'Sair do N3 Control Center',
        accelerator: 'Command+Q',
        click: () => this.onQuit?.(),
      },
    ]);
  }
}
