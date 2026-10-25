import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BrowserWindow, app, dialog, ipcMain, screen, shell } from 'electron';

import { N3AppStore } from '../src/app-store.js';
import { DeviceManager } from './device-manager.js';
import { AutomationService } from './automation-service.js';
import { TrayController } from './tray-controller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(__dirname, 'preload.cjs');
const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');
const devServerUrl = process.env.ELECTRON_RENDERER_URL || null;

let store = null;
let deviceManager = null;
let automationService = null;
let trayController = null;

let mainWindow = null;
let popoverWindow = null;
let hudWindow = null;
let hudHideTimer = null;
let isQuitting = false;
let pendingWakeSync = false;

function loadRendererView(win, viewName) {
  if (devServerUrl) {
    win.loadURL(`${devServerUrl}/?view=${viewName}`);
  } else {
    win.loadFile(distIndexPath, { query: { view: viewName } });
  }
}

function composeFullState() {
  return {
    store: store.getSnapshot(),
    device: deviceManager.getSnapshot(),
    automation: {
      ...automationService.getRuntimeState(),
      pendingWakeSync,
    },
  };
}

function broadcastFullState() {
  trayController?.refresh();
  const payload = composeFullState();
  for (const win of [mainWindow, popoverWindow, hudWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('n3:state-updated', payload);
    }
  }
}

function syncDockVisibility() {
  if (process.platform !== 'darwin' || !app.dock) return;
  const { docklessMode } = store.getSnapshot().menubar;
  const mainOpen = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible());

  if (!docklessMode || mainOpen) {
    app.dock.show().catch(() => {});
  } else {
    app.dock.hide();
  }
}

function createOrShowMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    syncDockVisibility();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1160,
    height: 736,
    minWidth: 1020,
    minHeight: 670,
    backgroundColor: '#000000',
    title: 'N3 Control Center — Darmoshark N3',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadRendererView(mainWindow, 'main');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    syncDockVisibility();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    syncDockVisibility();
  });

  return mainWindow;
}

function ensurePopoverWindow() {
  if (popoverWindow && !popoverWindow.isDestroyed()) {
    return popoverWindow;
  }

  popoverWindow = new BrowserWindow({
    width: 336,
    height: 416,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadRendererView(popoverWindow, 'popover');

  popoverWindow.on('blur', () => {
    if (popoverWindow && !popoverWindow.isDestroyed()) {
      popoverWindow.hide();
    }
  });

  return popoverWindow;
}

function togglePopoverAtTray(trayBounds) {
  const pop = ensurePopoverWindow();
  if (pop.isVisible()) {
    pop.hide();
    return;
  }

  const [popW, popH] = pop.getSize();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x || 0,
    y: trayBounds.y || 0,
  });
  const workArea = display.workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - popW / 2);
  let y = Math.round(trayBounds.y + trayBounds.height + 6);

  x = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - popW - 8));
  y = Math.max(workArea.y + 4, Math.min(y, workArea.y + workArea.height - popH - 8));

  pop.setPosition(x, y, false);
  pop.show();
  pop.focus();
  pop.webContents.send('n3:state-updated', composeFullState());
}

function showOnScreenDpiHud({ stage, dpi, pollingRateHz }) {
  if (!hudWindow || hudWindow.isDestroyed()) {
    hudWindow = new BrowserWindow({
      width: 248,
      height: 68,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      focusable: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    hudWindow.setIgnoreMouseEvents(true);
    loadRendererView(hudWindow, 'hud');
  }

  const primary = screen.getPrimaryDisplay().workArea;
  const x = Math.round(primary.x + primary.width / 2 - 124);
  const y = Math.round(primary.y + primary.height - 108);
  hudWindow.setPosition(x, y, false);

  const sendAndShow = () => {
    hudWindow.webContents.send('n3:hud-payload', { stage, dpi, pollingRateHz });
    hudWindow.showInactive();
    if (hudHideTimer) clearTimeout(hudHideTimer);
    hudHideTimer = setTimeout(() => {
      if (hudWindow && !hudWindow.isDestroyed()) {
        hudWindow.hide();
      }
    }, 1750);
  };

  if (hudWindow.webContents.isLoading()) {
    hudWindow.webContents.once('did-finish-load', sendAndShow);
  } else {
    sendAndShow();
  }
}

async function applyToHardwareOrQueue(fn) {
  const dev = deviceManager.getSnapshot();
  if (!dev.connected || dev.wirelessOnline === false) {
    pendingWakeSync = true;
    broadcastFullState();
    return { queuedForWake: true };
  }
  try {
    await fn();
    pendingWakeSync = false;
    broadcastFullState();
    return { queuedForWake: false };
  } catch (err) {
    if (/0xE0005000|DEVICE_OFFLINE/i.test(String(err.message || err.code))) {
      pendingWakeSync = true;
      broadcastFullState();
      return { queuedForWake: true };
    }
    throw err;
  }
}

async function handleTrayQuickChange(action) {
  const profile = store.getActiveProfile();

  if (action.type === 'dpi-stage') {
    store.updateActiveProfile({ activeDpiStage: action.activeStage });
    const next = store.getActiveProfile();
    await applyToHardwareOrQueue(() =>
      deviceManager.setDpi({
        stages: next.dpiStages,
        stageCount: next.dpiStageCount,
        activeStage: next.activeStage ?? next.activeDpiStage,
        fallbackStages: next.dpiStages,
      }),
    );
    return;
  }

  if (action.type === 'polling-rate') {
    store.updateActiveProfile({ pollingRateHz: action.hz });
    await applyToHardwareOrQueue(() => deviceManager.setPollingRate(action.hz));
    return;
  }

  if (action.type === 'lod') {
    store.updateActiveProfile({ lod: action.lod });
    const next = store.getActiveProfile();
    await applyToHardwareOrQueue(() =>
      deviceManager.setSensorConfig({
        lod: next.lod,
        rippleControl: next.sensor.rippleControl,
        angleSnap: next.sensor.angleSnap,
        motionSync: next.sensor.motionSync,
      }),
    );
    return;
  }

  if (action.type === 'sensor') {
    store.updateActiveProfile({ sensor: { ...profile.sensor, ...action.patch } });
    const next = store.getActiveProfile();
    await applyToHardwareOrQueue(() =>
      deviceManager.setSensorConfig({
        lod: next.lod,
        rippleControl: next.sensor.rippleControl,
        angleSnap: next.sensor.angleSnap,
        motionSync: next.sensor.motionSync,
      }),
    );
    return;
  }

  if (action.type === 'debounce') {
    store.updateActiveProfile({ debounceMs: action.ms });
    await applyToHardwareOrQueue(() => deviceManager.setDebounceTime(action.ms));
    return;
  }

  if (action.type === 'switch-profile') {
    store.setActiveProfile(action.profileId);
    const next = store.getActiveProfile();
    await applyToHardwareOrQueue(() =>
      deviceManager.applyProfile(next, { includeButtons: true }),
    );
    return;
  }

  if (action.type === 'menubar-pref') {
    store.updatePreferences({ menubar: action.patch });
    automationService.syncSystemSettings();
    syncDockVisibility();
    broadcastFullState();
  }
}

function registerIpcHandlers() {
  ipcMain.handle('n3:get-full-state', () => composeFullState());

  ipcMain.handle('n3:refresh-telemetry', async () => {
    await deviceManager.refreshTelemetry();
    return composeFullState();
  });

  ipcMain.handle('n3:set-connection-mode', async (_e, mode) => {
    await deviceManager.setPreferredConnection(mode);
    broadcastFullState();
    return composeFullState();
  });

  ipcMain.handle('n3:set-dpi', async (_e, { stages, stageCount, activeStage }) => {
    const cur = store.getActiveProfile();
    const nextStages = stages ?? cur.dpiStages;
    const nextCount = stageCount ?? cur.dpiStageCount;
    const nextActive = Math.min(nextCount, Math.max(1, activeStage ?? cur.activeDpiStage));

    store.updateActiveProfile({
      dpiStages: nextStages,
      dpiStageCount: nextCount,
      activeDpiStage: nextActive,
    });

    await applyToHardwareOrQueue(() =>
      deviceManager.setDpi({
        stages: nextStages,
        stageCount: nextCount,
        activeStage: nextActive,
        fallbackStages: nextStages,
      }),
    );
    return composeFullState();
  });

  ipcMain.handle('n3:set-polling-rate', async (_e, hz) => {
    const rate = Number(hz);
    store.updateActiveProfile({ pollingRateHz: rate });
    await applyToHardwareOrQueue(() => deviceManager.setPollingRate(rate));
    return composeFullState();
  });

  ipcMain.handle('n3:set-debounce', async (_e, ms) => {
    const val = Number(ms);
    store.updateActiveProfile({ debounceMs: val });
    await applyToHardwareOrQueue(() => deviceManager.setDebounceTime(val));
    return composeFullState();
  });

  ipcMain.handle('n3:set-sensor', async (_e, payload) => {
    const cur = store.getActiveProfile();
    const nextLod = payload.lod ?? cur.lod;
    const nextSensor = {
      rippleControl: payload.rippleControl ?? cur.sensor.rippleControl,
      angleSnap: payload.angleSnap ?? cur.sensor.angleSnap,
      motionSync: payload.motionSync ?? cur.sensor.motionSync,
    };

    store.updateActiveProfile({ lod: nextLod, sensor: nextSensor });
    await applyToHardwareOrQueue(() =>
      deviceManager.setSensorConfig({ lod: nextLod, ...nextSensor }),
    );
    return composeFullState();
  });

  ipcMain.handle('n3:set-button', async (_e, { button, actionConfig }) => {
    const cur = store.getActiveProfile();
    await applyToHardwareOrQueue(() =>
      deviceManager.setButtonMapping(button, actionConfig, {
        currentButtons: cur.buttons,
      }),
    );
    store.updateActiveProfile({
      buttons: {
        ...cur.buttons,
        [button]: actionConfig,
      },
    });
    broadcastFullState();
    return composeFullState();
  });

  ipcMain.handle('n3:reset-buttons', async () => {
    store.resetActiveProfileButtons();
    await applyToHardwareOrQueue(() => deviceManager.resetButtons());
    return composeFullState();
  });

  ipcMain.handle('n3:save-macro', async (_e, macro) => {
    const { macro: savedMacro } = store.upsertMacro(macro);
    // Se algum botão do perfil ativo já estiver vinculado a esta macro, atualiza o hardware também
    const cur = store.getActiveProfile();
    for (const [btnKey, cfg] of Object.entries(cur.buttons)) {
      if (cfg?.category === 'macro' && cfg?.macroId === savedMacro.id && savedMacro.events.length > 0) {
        const btnNum = Number(btnKey);
        await applyToHardwareOrQueue(() =>
          deviceManager.bindMacro(
            btnNum,
            {
              loopMode: savedMacro.loopMode,
              loopCount: savedMacro.loopCount,
              events: savedMacro.events,
            },
            { currentButtons: cur.buttons },
          ),
        );
      }
    }
    broadcastFullState();
    return composeFullState();
  });

  ipcMain.handle('n3:delete-macro', async (_e, macroId) => {
    store.deleteMacro(macroId);
    broadcastFullState();
    return composeFullState();
  });

  ipcMain.handle('n3:bind-macro-button', async (_e, { button, macroId }) => {
    const snap = store.getSnapshot();
    const cur = store.getActiveProfile();
    const macro = snap.macros.find((m) => m.id === macroId);
    if (!macro) {
      throw new Error('Macro selecionada não encontrada.');
    }
    if (!macro.events || macro.events.length === 0) {
      throw new Error('Adicione ao menos 1 evento à macro antes de vinculá-la a um botão.');
    }

    await applyToHardwareOrQueue(() =>
      deviceManager.bindMacro(
        button,
        {
          loopMode: macro.loopMode,
          loopCount: macro.loopCount,
          events: macro.events,
        },
        { currentButtons: cur.buttons },
      ),
    );

    store.updateActiveProfile({
      buttons: {
        ...cur.buttons,
        [button]: {
          category: 'macro',
          macroId: macro.id,
          macroName: macro.name,
          loopMode: macro.loopMode,
          loopCount: macro.loopCount,
          events: macro.events,
        },
      },
    });
    broadcastFullState();
    return composeFullState();
  });

  ipcMain.handle('n3:switch-profile', async (_e, profileId) => {
    store.setActiveProfile(profileId);
    const next = store.getActiveProfile();
    await applyToHardwareOrQueue(() =>
      deviceManager.applyProfile(next, { includeButtons: true }),
    );
    return composeFullState();
  });

  ipcMain.handle('n3:create-profile', async (_e, name) => {
    store.createProfile(name);
    broadcastFullState();
    return composeFullState();
  });

  ipcMain.handle('n3:rename-profile', async (_e, { profileId, name }) => {
    store.renameProfile(profileId, name);
    broadcastFullState();
    return composeFullState();
  });

  ipcMain.handle('n3:delete-profile', async (_e, profileId) => {
    store.deleteProfile(profileId);
    const next = store.getActiveProfile();
    await applyToHardwareOrQueue(() =>
      deviceManager.applyProfile(next, { includeButtons: true }),
    );
    return composeFullState();
  });

  ipcMain.handle('n3:export-profile-dialog', async () => {
    const active = store.getActiveProfile();
    const res = await dialog.showSaveDialog(mainWindow ?? undefined, {
      title: 'Exportar Perfil do Darmoshark N3',
      defaultPath: `${active.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!res.canceled && res.filePath) {
      fs.writeFileSync(res.filePath, `${JSON.stringify(active, null, 2)}\n`, 'utf8');
      return { exported: true, filePath: res.filePath };
    }
    return { exported: false };
  });

  ipcMain.handle('n3:import-profile-dialog', async () => {
    const res = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: 'Importar Perfil JSON',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!res.canceled && res.filePaths.length > 0) {
      const raw = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'));
      store.importProfileObject(raw);
      const imported = store.getActiveProfile();
      await applyToHardwareOrQueue(() =>
        deviceManager.applyProfile(imported, { includeButtons: true }),
      );
      return { imported: true, state: composeFullState() };
    }
    return { imported: false };
  });

  ipcMain.handle('n3:factory-reset', async (_e, { resetHardware = true } = {}) => {
    store.resetActiveProfileToFactory();
    const restored = store.getActiveProfile();
    if (resetHardware) {
      await applyToHardwareOrQueue(() => deviceManager.factoryReset());
    } else {
      await applyToHardwareOrQueue(() =>
        deviceManager.applyProfile(restored, { includeButtons: true }),
      );
    }
    broadcastFullState();
    return composeFullState();
  });

  ipcMain.handle('n3:update-preferences', async (_e, prefs) => {
    store.updatePreferences(prefs);
    automationService.syncSystemSettings();
    syncDockVisibility();
    broadcastFullState();
    return composeFullState();
  });

  ipcMain.handle('n3:list-mac-apps', () => automationService.listInstalledMacApps());

  ipcMain.handle('n3:open-mac-mouse-settings', async () => {
    await shell.openExternal('x-apple.systempreferences:com.apple.Mouse-Settings.extension');
    return { ok: true };
  });

  ipcMain.handle('n3:open-main-window', () => {
    if (popoverWindow && !popoverWindow.isDestroyed()) {
      popoverWindow.hide();
    }
    createOrShowMainWindow();
    return { ok: true };
  });

  ipcMain.handle('n3:close-popover', () => {
    if (popoverWindow && !popoverWindow.isDestroyed()) {
      popoverWindow.hide();
    }
    return { ok: true };
  });

  ipcMain.handle('n3:quit-app', () => {
    isQuitting = true;
    app.quit();
  });
}

// Single Instance Lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    createOrShowMainWindow();
  });

  // Mantém o aplicativo ativo na Menu Bar mesmo quando todas as janelas forem fechadas
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && isQuitting) {
      app.quit();
    }
  });

  app.on('activate', () => {
    createOrShowMainWindow();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    automationService?.stop();
    deviceManager?.stop();
  });

  app.whenReady().then(async () => {
    store = new N3AppStore();
    deviceManager = new DeviceManager();

    automationService = new AutomationService({
      app,
      store,
      deviceManager,
      onShowHud: (payload) => showOnScreenDpiHud(payload),
      onStateChanged: () => broadcastFullState(),
    });

    trayController = new TrayController({
      store,
      deviceManager,
      onTogglePopover: (bounds) => togglePopoverAtTray(bounds),
      onHidePopover: () => {
        if (popoverWindow && !popoverWindow.isDestroyed()) popoverWindow.hide();
      },
      onOpenMainWindow: () => createOrShowMainWindow(),
      onQuit: () => {
        isQuitting = true;
        app.quit();
      },
      onApplyQuickChange: (action) => {
        handleTrayQuickChange(action).catch(() => {});
      },
    });

    // Quando o hardware conectar ou acordar do repouso 2.4GHz:
    deviceManager.on('device-connected', (snap) => {
      if (snap.wirelessOnline && snap.hardwareDpiStages && !pendingWakeSync) {
        // Sincroniza leitura real do mouse no perfil ativo inicial
        store.updateActiveProfile({
          dpiStages: snap.hardwareDpiStages,
          dpiStageCount: snap.hardwareStageCount ?? store.getActiveProfile().dpiStageCount,
          activeDpiStage: snap.activeDpiStage ?? store.getActiveProfile().activeDpiStage,
          pollingRateHz: snap.pollingRateHz ?? store.getActiveProfile().pollingRateHz,
          debounceMs: snap.hardwareDebounceMs ?? store.getActiveProfile().debounceMs,
        });
      }
      broadcastFullState();
    });

    deviceManager.on('state-changed', (snap) => {
      if (pendingWakeSync && snap.connected && snap.wirelessOnline) {
        pendingWakeSync = false;
        const active = store.getActiveProfile();
        deviceManager
          .applyProfile(active, { includeButtons: true })
          .then(() => broadcastFullState())
          .catch(() => {});
      } else {
        broadcastFullState();
      }
    });

    registerIpcHandlers();
    trayController.init();
    automationService.start();
    await deviceManager.start();

    // Abre a janela principal na inicialização (exceto se iniciada com --hidden ou --smoke-test)
    const isSmokeTest = process.argv.includes('--smoke-test');
    const startHidden = process.argv.includes('--hidden') || isSmokeTest;
    if (!startHidden) {
      createOrShowMainWindow();
    } else {
      syncDockVisibility();
    }

    if (isSmokeTest) {
      const pop = ensurePopoverWindow();
      setTimeout(() => {
        const snap = composeFullState();
        console.log(
          'SMOKE_TEST_OK',
          JSON.stringify({
            connected: snap.device.connected,
            mode: snap.device.mode,
            firmwareVersion: snap.device.firmwareVersion,
            battery: snap.device.battery,
            activeProfile: snap.store.activeProfileId,
            popoverReady: !pop.isDestroyed(),
          }),
        );
        isQuitting = true;
        app.quit();
      }, 1200);
    }
  });
}
