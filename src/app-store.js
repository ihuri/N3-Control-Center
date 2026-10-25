import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  cloneDefaultButtons,
  cloneDefaultProfile,
  getDefaultStatePath,
  loadSavedProfile,
  normalizeProfile,
  saveProfile,
} from './state.js';

export function getDefaultAppStorePath() {
  const configRoot =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configRoot, 'n3-control-center', 'app-config.json');
}

export function createInitialAppStore(cliStatePath = getDefaultStatePath()) {
  const currentHardwareOrSaved = loadSavedProfile(cliStatePath);
  const defaults = cloneDefaultProfile();

  return {
    version: 1,
    language: 'pt',
    activeProfileId: 'standard',
    profiles: [
      {
        id: 'standard',
        name: 'Standard',
        ...normalizeProfile(currentHardwareOrSaved),
      },
      {
        id: 'profile-1',
        name: 'Perfil 1 (Trabalho)',
        ...normalizeProfile({
          ...defaults,
          dpiStages: [400, 800, 1200, 1600, 2400],
          activeDpiStage: 2,
          pollingRateHz: 500,
          debounceMs: 8,
          lod: 'low',
        }),
      },
      {
        id: 'profile-2',
        name: 'Perfil 2 (FPS 1K)',
        ...normalizeProfile({
          ...defaults,
          dpiStages: [400, 800, 1600, 3200, 4800],
          activeDpiStage: 2,
          pollingRateHz: 1000,
          debounceMs: 2,
          lod: 'low',
          sensor: {
            rippleControl: false,
            angleSnap: false,
            motionSync: true,
          },
        }),
      },
      {
        id: 'profile-3',
        name: 'Perfil 3 (Economia)',
        ...normalizeProfile({
          ...defaults,
          dpiStages: [400, 800, 1600, 3200, 4800],
          activeDpiStage: 2,
          pollingRateHz: 125,
          debounceMs: 8,
          lod: 'low',
        }),
      },
      {
        id: 'profile-4',
        name: 'Perfil 4',
        ...normalizeProfile(defaults),
      },
    ],
    macros: [
      {
        id: 'macro-copy-paste',
        name: 'Colar Rápido (⌘V)',
        delayMode: 'uniform',
        uniformDelayMs: 20,
        loopMode: 'count',
        loopCount: 1,
        events: [
          { type: 'key-down', key: 'cmd' },
          { type: 'key-down', key: 'v' },
          { type: 'delay', ms: 20 },
          { type: 'key-up', key: 'v' },
          { type: 'key-up', key: 'cmd' },
        ],
      },
    ],
    menubar: {
      showBatteryPercent: true,
      showDpi: true,
      hideBatteryWhenFullOrWired: false,
      docklessMode: true,
      launchAtLogin: false,
    },
    automations: {
      lowBatteryAlert: true,
      dpiChangeHud: true,
      autoEco: {
        enabled: true,
        batteryThreshold: 15,
        useMacLowPowerMode: true,
        ecoPollingRateHz: 125,
      },
      appProfiles: {
        enabled: false,
        rules: [
          {
            id: 'rule-cs2',
            appMatch: 'cs2',
            label: 'Counter-Strike 2',
            profileId: 'profile-2',
          },
        ],
      },
    },
  };
}

export function normalizeAppStore(raw = {}, cliStatePath = getDefaultStatePath()) {
  const fallback = createInitialAppStore(cliStatePath);

  const profiles =
    Array.isArray(raw.profiles) && raw.profiles.length > 0
      ? raw.profiles.map((p, idx) => ({
          id: String(p.id || `profile-${idx + 1}`),
          name: String(p.name || `Perfil ${idx + 1}`),
          ...normalizeProfile(p),
        }))
      : fallback.profiles;

  const activeExists = profiles.some((p) => p.id === raw.activeProfileId);
  const activeProfileId = activeExists ? raw.activeProfileId : profiles[0].id;

  const macros = Array.isArray(raw.macros)
    ? raw.macros
        .filter((m) => m && typeof m === 'object' && m.name)
        .map((m, idx) => ({
          id: String(m.id || `macro-${idx + 1}`),
          name: String(m.name),
          delayMode: ['record', 'uniform', 'none'].includes(m.delayMode)
            ? m.delayMode
            : 'record',
          uniformDelayMs: Number.isInteger(m.uniformDelayMs) ? m.uniformDelayMs : 20,
          loopMode: ['hold', 'toggle', 'count'].includes(m.loopMode)
            ? m.loopMode
            : 'count',
          loopCount:
            Number.isInteger(m.loopCount) && m.loopCount >= 1 ? m.loopCount : 1,
          events: Array.isArray(m.events) ? m.events : [],
        }))
    : fallback.macros;

  return {
    version: 1,
    language: raw.language === 'en' ? 'en' : 'pt',
    activeProfileId,
    profiles,
    macros,
    menubar: {
      showBatteryPercent:
        typeof raw.menubar?.showBatteryPercent === 'boolean'
          ? raw.menubar.showBatteryPercent
          : fallback.menubar.showBatteryPercent,
      showDpi:
        typeof raw.menubar?.showDpi === 'boolean'
          ? raw.menubar.showDpi
          : fallback.menubar.showDpi,
      hideBatteryWhenFullOrWired:
        typeof raw.menubar?.hideBatteryWhenFullOrWired === 'boolean'
          ? raw.menubar.hideBatteryWhenFullOrWired
          : fallback.menubar.hideBatteryWhenFullOrWired,
      docklessMode:
        typeof raw.menubar?.docklessMode === 'boolean'
          ? raw.menubar.docklessMode
          : fallback.menubar.docklessMode,
      launchAtLogin:
        typeof raw.menubar?.launchAtLogin === 'boolean'
          ? raw.menubar.launchAtLogin
          : fallback.menubar.launchAtLogin,
    },
    automations: {
      lowBatteryAlert:
        typeof raw.automations?.lowBatteryAlert === 'boolean'
          ? raw.automations.lowBatteryAlert
          : fallback.automations.lowBatteryAlert,
      dpiChangeHud:
        typeof raw.automations?.dpiChangeHud === 'boolean'
          ? raw.automations.dpiChangeHud
          : fallback.automations.dpiChangeHud,
      autoEco: {
        enabled:
          typeof raw.automations?.autoEco?.enabled === 'boolean'
            ? raw.automations.autoEco.enabled
            : fallback.automations.autoEco.enabled,
        batteryThreshold: Number.isInteger(raw.automations?.autoEco?.batteryThreshold)
          ? Math.max(5, Math.min(50, raw.automations.autoEco.batteryThreshold))
          : fallback.automations.autoEco.batteryThreshold,
        useMacLowPowerMode:
          typeof raw.automations?.autoEco?.useMacLowPowerMode === 'boolean'
            ? raw.automations.autoEco.useMacLowPowerMode
            : fallback.automations.autoEco.useMacLowPowerMode,
        ecoPollingRateHz: [125, 500].includes(raw.automations?.autoEco?.ecoPollingRateHz)
          ? raw.automations.autoEco.ecoPollingRateHz
          : fallback.automations.autoEco.ecoPollingRateHz,
      },
      appProfiles: {
        enabled:
          typeof raw.automations?.appProfiles?.enabled === 'boolean'
            ? raw.automations.appProfiles.enabled
            : fallback.automations.appProfiles.enabled,
        rules: Array.isArray(raw.automations?.appProfiles?.rules)
          ? raw.automations.appProfiles.rules
              .filter((r) => r && r.appMatch && r.profileId)
              .map((r, idx) => ({
                id: String(r.id || `rule-${idx + 1}`),
                appMatch: String(r.appMatch).trim(),
                label: String(r.label || r.appMatch).trim(),
                profileId: String(r.profileId),
              }))
          : fallback.automations.appProfiles.rules,
      },
    },
  };
}

export class N3AppStore {
  constructor({
    storePath = getDefaultAppStorePath(),
    cliStatePath = getDefaultStatePath(),
  } = {}) {
    this.storePath = storePath;
    this.cliStatePath = cliStatePath;
    this.data = this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.storePath)) {
        const initial = createInitialAppStore(this.cliStatePath);
        this.save(initial);
        return initial;
      }
      const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      this.data = normalizeAppStore(raw, this.cliStatePath);
      return this.data;
    } catch {
      const initial = createInitialAppStore(this.cliStatePath);
      this.data = initial;
      return initial;
    }
  }

  save(nextData = this.data) {
    const normalized = normalizeAppStore(nextData, this.cliStatePath);
    this.data = normalized;
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');

    // Sincroniza o perfil ativo com state.json para manter compatibilidade total com `n3ctl`
    const active = this.getActiveProfile();
    if (active) {
      const macrosMap = Object.fromEntries(
        normalized.macros.map((m) => [
          m.name,
          { name: m.name, loopMode: m.loopMode, loopCount: m.loopCount, events: m.events },
        ]),
      );
      saveProfile({ ...active, macros: macrosMap }, this.cliStatePath);
    }

    return normalized;
  }

  getSnapshot() {
    return this.data;
  }

  getActiveProfile() {
    return (
      this.data.profiles.find((p) => p.id === this.data.activeProfileId) ||
      this.data.profiles[0]
    );
  }

  updateActiveProfile(patch) {
    const active = this.getActiveProfile();
    const updated = {
      ...active,
      ...patch,
      id: active.id,
      name: patch.name ?? active.name,
    };
    const nextProfiles = this.data.profiles.map((p) =>
      p.id === active.id ? { id: updated.id, name: updated.name, ...normalizeProfile(updated) } : p,
    );
    return this.save({ ...this.data, profiles: nextProfiles });
  }

  resetActiveProfileButtons() {
    return this.updateActiveProfile({ buttons: cloneDefaultButtons() });
  }

  resetActiveProfileToFactory() {
    const active = this.getActiveProfile();
    const defaults = cloneDefaultProfile();
    return this.updateActiveProfile({
      ...defaults,
      name: active.name,
    });
  }

  setActiveProfile(profileId) {
    if (!this.data.profiles.some((p) => p.id === profileId)) {
      throw new Error(`Perfil não encontrado: ${profileId}`);
    }
    return this.save({ ...this.data, activeProfileId: profileId });
  }

  createProfile(name = 'Novo Perfil') {
    const base = this.getActiveProfile();
    const id = `profile-${Date.now()}`;
    const nextProfiles = [
      ...this.data.profiles,
      {
        ...base,
        id,
        name: String(name).trim() || 'Novo Perfil',
      },
    ];
    return this.save({
      ...this.data,
      activeProfileId: id,
      profiles: nextProfiles,
    });
  }

  renameProfile(profileId, newName) {
    const trimmed = String(newName ?? '').trim();
    if (!trimmed) return this.data;
    const nextProfiles = this.data.profiles.map((p) =>
      p.id === profileId ? { ...p, name: trimmed } : p,
    );
    return this.save({ ...this.data, profiles: nextProfiles });
  }

  deleteProfile(profileId) {
    if (this.data.profiles.length <= 1) {
      throw new Error('É necessário manter ao menos 1 perfil.');
    }
    const nextProfiles = this.data.profiles.filter((p) => p.id !== profileId);
    const nextActive =
      this.data.activeProfileId === profileId ? nextProfiles[0].id : this.data.activeProfileId;
    return this.save({
      ...this.data,
      activeProfileId: nextActive,
      profiles: nextProfiles,
    });
  }

  importProfileObject(rawObj) {
    const id = `profile-${Date.now()}`;
    const name = String(rawObj?.name || 'Perfil Importado').trim();
    const normalized = normalizeProfile(rawObj);
    const nextProfiles = [...this.data.profiles, { id, name, ...normalized }];
    return this.save({
      ...this.data,
      activeProfileId: id,
      profiles: nextProfiles,
    });
  }

  upsertMacro(macro) {
    const id = String(macro.id || `macro-${Date.now()}`);
    const existingIdx = this.data.macros.findIndex((m) => m.id === id);
    const nextMacros = [...this.data.macros];
    const clean = {
      id,
      name: String(macro.name || 'Nova Macro').trim(),
      delayMode: macro.delayMode || 'record',
      uniformDelayMs: Number(macro.uniformDelayMs ?? 20),
      loopMode: macro.loopMode || 'count',
      loopCount: Number(macro.loopCount ?? 1),
      events: Array.isArray(macro.events) ? macro.events : [],
    };
    if (existingIdx >= 0) {
      nextMacros[existingIdx] = clean;
    } else {
      nextMacros.push(clean);
    }
    return { store: this.save({ ...this.data, macros: nextMacros }), macro: clean };
  }

  deleteMacro(macroId) {
    const nextMacros = this.data.macros.filter((m) => m.id !== macroId);
    return this.save({ ...this.data, macros: nextMacros });
  }

  updatePreferences({ language, menubar, automations }) {
    return this.save({
      ...this.data,
      language: language ?? this.data.language,
      menubar: menubar ? { ...this.data.menubar, ...menubar } : this.data.menubar,
      automations: automations
        ? {
            ...this.data.automations,
            ...automations,
            autoEco: automations.autoEco
              ? { ...this.data.automations.autoEco, ...automations.autoEco }
              : this.data.automations.autoEco,
            appProfiles: automations.appProfiles
              ? { ...this.data.automations.appProfiles, ...automations.appProfiles }
              : this.data.automations.appProfiles,
          }
        : this.data.automations,
    });
  }
}
