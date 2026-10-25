import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { MainWindow } from './MainWindow.jsx';
import { PopoverView } from './PopoverView.jsx';
import { HudView } from './HudView.jsx';

const FALLBACK_MOCK_STATE = {
  store: {
    version: 1,
    language: 'pt',
    activeProfileId: 'standard',
    profiles: [
      {
        id: 'standard',
        name: 'Standard',
        dpiStages: [400, 800, 1600, 3200, 4800],
        dpiStageCount: 5,
        activeDpiStage: 2,
        pollingRateHz: 500,
        debounceMs: 8,
        lod: 'low',
        sensor: { rippleControl: false, angleSnap: false, motionSync: true },
        buttons: {
          1: { category: 'mouse', action: 'left-click' },
          2: { category: 'mouse', action: 'right-click' },
          3: { category: 'mouse', action: 'middle-click' },
          4: { category: 'mouse', action: 'button-4' },
          5: { category: 'mouse', action: 'button-5' },
          6: { category: 'dpi', action: 'dpi-up' },
          7: { category: 'dpi', action: 'dpi-down' },
        },
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
            profileId: 'standard',
          },
        ],
      },
    },
  },
  device: {
    connected: true,
    mode: 'wireless',
    wirelessOnline: true,
    firmwareVersion: '0.1.19r-c',
    battery: { percent: 85, iconLevel: 6, usbPowered: false },
    activeDpiStage: 2,
    pollingRateHz: 500,
    preferredConnection: 'auto',
  },
  automation: {
    ecoActive: false,
    macLowPowerActive: false,
    pendingWakeSync: false,
  },
};

function createBrowserMockApi(setState) {
  return {
    getFullState: async () => FALLBACK_MOCK_STATE,
    refreshTelemetry: async () => {},
    setPreferredConnection: async (mode) =>
      setState((s) => ({ ...s, device: { ...s.device, preferredConnection: mode } })),
    setDpi: async ({ stages, stageCount, activeStage }) =>
      setState((s) => ({
        ...s,
        store: {
          ...s.store,
          profiles: s.store.profiles.map((p) =>
            p.id === s.store.activeProfileId
              ? {
                  ...p,
                  dpiStages: stages ?? p.dpiStages,
                  dpiStageCount: stageCount ?? p.dpiStageCount,
                  activeDpiStage: activeStage ?? p.activeDpiStage,
                }
              : p,
          ),
        },
        device: { ...s.device, activeDpiStage: activeStage ?? s.device.activeDpiStage },
      })),
    setPollingRate: async (hz) =>
      setState((s) => ({
        ...s,
        store: {
          ...s.store,
          profiles: s.store.profiles.map((p) =>
            p.id === s.store.activeProfileId ? { ...p, pollingRateHz: hz } : p,
          ),
        },
        device: { ...s.device, pollingRateHz: hz },
      })),
    setDebounce: async (ms) =>
      setState((s) => ({
        ...s,
        store: {
          ...s.store,
          profiles: s.store.profiles.map((p) =>
            p.id === s.store.activeProfileId ? { ...p, debounceMs: ms } : p,
          ),
        },
      })),
    setSensor: async (patch) =>
      setState((s) => ({
        ...s,
        store: {
          ...s.store,
          profiles: s.store.profiles.map((p) =>
            p.id === s.store.activeProfileId
              ? {
                  ...p,
                  lod: patch.lod ?? p.lod,
                  sensor: { ...p.sensor, ...patch },
                }
              : p,
          ),
        },
      })),
    setButton: async (button, actionConfig) =>
      setState((s) => ({
        ...s,
        store: {
          ...s.store,
          profiles: s.store.profiles.map((p) =>
            p.id === s.store.activeProfileId
              ? { ...p, buttons: { ...p.buttons, [button]: actionConfig } }
              : p,
          ),
        },
      })),
    resetButtons: async () => {},
    saveMacro: async () => {},
    deleteMacro: async () => {},
    bindMacroToButton: async () => {},
    switchProfile: async (profileId) =>
      setState((s) => ({ ...s, store: { ...s.store, activeProfileId: profileId } })),
    createProfile: async () => {},
    renameProfile: async () => {},
    deleteProfile: async () => {},
    exportProfileDialog: async () => {},
    importProfileDialog: async () => {},
    factoryReset: async () => {},
    updatePreferences: async ({ language, menubar, automations }) =>
      setState((s) => ({
        ...s,
        store: {
          ...s.store,
          language: language ?? s.store.language,
          menubar: menubar ? { ...s.store.menubar, ...menubar } : s.store.menubar,
          automations: automations
            ? {
                ...s.store.automations,
                ...automations,
                autoEco: automations.autoEco
                  ? { ...s.store.automations.autoEco, ...automations.autoEco }
                  : s.store.automations.autoEco,
                appProfiles: automations.appProfiles
                  ? { ...s.store.automations.appProfiles, ...automations.appProfiles }
                  : s.store.automations.appProfiles,
              }
            : s.store.automations,
        },
      })),
    listMacApps: async () => ['Safari', 'Counter-Strike 2', 'Blender', 'Final Cut Pro'],
    openMacMouseSettings: async () => {},
    openMainWindow: async () => {},
    closePopover: async () => {},
    quitApp: async () => {},
  };
}

function AppRoot() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') || 'main';
  const electronApi = typeof window !== 'undefined' ? window.n3Api : null;

  const [fullState, setFullState] = useState(electronApi ? null : FALLBACK_MOCK_STATE);
  const api = electronApi || createBrowserMockApi(setFullState);

  useEffect(() => {
    if (!electronApi) return undefined;
    let mounted = true;
    electronApi.getFullState().then((initial) => {
      if (mounted && initial) setFullState(initial);
    });
    const unsub = electronApi.onStateUpdated((next) => {
      if (mounted && next) setFullState(next);
    });
    return () => {
      mounted = false;
      unsub?.();
    };
  }, [electronApi]);

  if (view === 'hud') {
    return <HudView api={api} />;
  }

  if (!fullState) {
    return (
      <div className="w-screen h-screen bg-black text-zinc-400 flex items-center justify-center text-xs">
        Carregando N3 Control Center...
      </div>
    );
  }

  if (view === 'popover') {
    return <PopoverView fullState={fullState} api={api} />;
  }

  return <MainWindow fullState={fullState} api={api} />;
}

createRoot(document.getElementById('root')).render(<AppRoot />);
