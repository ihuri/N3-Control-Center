import { EventEmitter } from 'node:events';
import { N3Device, listN3Devices } from '../src/device.js';

export class DeviceManager extends EventEmitter {
  constructor() {
    super();
    this.device = null;
    this.preferredConnection = 'auto';
    this.availableDevices = [];
    this._queue = Promise.resolve();
    this._hotplugTimer = null;
    this._telemetryTimer = null;
    this._unsubscribeEvents = null;
    this._lastSoftwareDpiAt = 0;

    this.status = {
      connected: false,
      mode: null,
      deviceLabel: null,
      wirelessOnline: false,
      offlineReason: null,
      firmwareVersion: null,
      battery: { percent: null, iconLevel: null, usbPowered: false },
      activeDpiStage: null,
      pollingRateHz: null,
      hardwareDpiStages: null,
      hardwareStageCount: null,
      hardwareDebounceMs: null,
      lastError: null,
    };
  }

  _enqueue(taskFn) {
    const run = this._queue.then(taskFn, taskFn);
    this._queue = run.catch(() => {});
    return run;
  }

  getSnapshot() {
    return {
      ...this.status,
      preferredConnection: this.preferredConnection,
      availableDevices: this.availableDevices.map((d) => ({
        mode: d.mode,
        label: d.target.label,
        vendorId: d.hidInfo.vendorId,
        productId: d.hidInfo.productId,
        product: d.hidInfo.product,
      })),
    };
  }

  async start() {
    await this.checkDevicesAndConnect();
    this._hotplugTimer = setInterval(() => {
      this.checkDevicesAndConnect().catch(() => {});
    }, 3000);
    this._telemetryTimer = setInterval(() => {
      if (this.device) {
        this.refreshTelemetry().catch(() => {});
      }
    }, 30000);
  }

  stop() {
    if (this._hotplugTimer) clearInterval(this._hotplugTimer);
    if (this._telemetryTimer) clearInterval(this._telemetryTimer);
    this._closeCurrent();
  }

  _closeCurrent() {
    if (this._unsubscribeEvents) {
      try {
        this._unsubscribeEvents();
      } catch {
        // Ignora erro ao remover listener
      }
      this._unsubscribeEvents = null;
    }
    if (this.device) {
      this.device.close();
      this.device = null;
    }
  }

  async setPreferredConnection(mode) {
    this.preferredConnection = ['auto', 'wired', 'wireless'].includes(mode) ? mode : 'auto';
    this._closeCurrent();
    await this.checkDevicesAndConnect();
    return this.getSnapshot();
  }

  async checkDevicesAndConnect() {
    return this._enqueue(async () => {
      let found = [];
      try {
        found = await listN3Devices();
      } catch (err) {
        this.status.lastError = err.message;
      }
      this.availableDevices = found;

      const filtered =
        this.preferredConnection === 'auto'
          ? found
          : found.filter((c) => c.mode === this.preferredConnection);

      const targetCandidate = filtered[0] ?? null;

      if (!targetCandidate) {
        const wasConnected = this.status.connected;
        this._closeCurrent();
        this.status = {
          connected: false,
          mode: null,
          deviceLabel: null,
          wirelessOnline: false,
          offlineReason: 'Nenhum Darmoshark N3 conectado ao USB.',
          firmwareVersion: null,
          battery: { percent: null, iconLevel: null, usbPowered: false },
          activeDpiStage: null,
          pollingRateHz: null,
          hardwareDpiStages: null,
          hardwareStageCount: null,
          hardwareDebounceMs: null,
          lastError: null,
        };
        if (wasConnected) {
          this.emit('state-changed', this.getSnapshot());
        }
        return this.getSnapshot();
      }

      const currentPath = this.device?.hidInfo?.path;
      const targetPath = targetCandidate.hidInfo?.path;

      if (!this.device || currentPath !== targetPath || this.device.mode !== targetCandidate.mode) {
        this._closeCurrent();
        try {
          this.device = await N3Device.open({
            preferredMode: targetCandidate.mode,
            interPacketDelayMs: 15,
          });
          this._bindLiveEvents();
          await this._readStatusInternal();
          this.emit('device-connected', this.getSnapshot());
          this.emit('state-changed', this.getSnapshot());
        } catch (err) {
          this.status = {
            ...this.status,
            connected: false,
            lastError: err.message,
          };
          this.emit('state-changed', this.getSnapshot());
        }
      }

      return this.getSnapshot();
    });
  }

  _bindLiveEvents() {
    if (!this.device) return;
    this._unsubscribeEvents = this.device.subscribeEvents((evt) => {
      if (evt.type === 'status_notification') {
        const prevStage = this.status.activeDpiStage;
        const wasOnline = this.status.wirelessOnline;

        if (evt.powerState === 'sleep') {
          this.status.wirelessOnline = false;
          this.status.offlineReason = 'Mouse em repouso (economia de energia 2.4GHz).';
        } else {
          this.status.wirelessOnline = true;
          this.status.offlineReason = null;
        }

        if (evt.batteryPercent !== null) {
          this.status.battery = {
            ...this.status.battery,
            percent: evt.batteryPercent,
            iconLevel: evt.batteryIconLevel,
          };
        } else if (evt.batteryIconLevel !== null) {
          this.status.battery = {
            ...this.status.battery,
            iconLevel: evt.batteryIconLevel,
          };
        }

        this.status.activeDpiStage = evt.activeStage;
        if (evt.pollingRateHz) {
          this.status.pollingRateHz = evt.pollingRateHz;
        }

        const now = Date.now();
        if (
          prevStage !== null &&
          prevStage !== evt.activeStage &&
          now - this._lastSoftwareDpiAt > 600
        ) {
          this.emit('physical-dpi-changed', {
            activeStage: evt.activeStage,
            pollingRateHz: this.status.pollingRateHz,
          });
        }

        if (!wasOnline && this.status.wirelessOnline) {
          this.refreshTelemetry().catch(() => {});
        }

        this.emit('state-changed', this.getSnapshot());
      } else if (evt.type === 'wireless_handshake') {
        this.status.wirelessOnline = evt.online;
        if (evt.batteryPercent !== null) {
          this.status.battery = {
            ...this.status.battery,
            percent: evt.batteryPercent,
            iconLevel: evt.batteryIconLevel,
          };
        }
        if (evt.firmwareVersion) {
          this.status.firmwareVersion = evt.firmwareVersion;
        }
        this.emit('state-changed', this.getSnapshot());
      }
    });
  }

  async _readStatusInternal() {
    if (!this.device) return this.getSnapshot();
    try {
      const full = await this.device.getFullStatus();
      this.status = {
        connected: true,
        mode: full.mode,
        deviceLabel: full.deviceLabel,
        wirelessOnline: full.wirelessOnline,
        offlineReason: full.offlineReason ?? null,
        firmwareVersion: full.firmwareVersion ?? this.status.firmwareVersion,
        battery: full.battery,
        activeDpiStage: full.activeDpiStage ?? this.status.activeDpiStage,
        pollingRateHz: full.pollingRateHz ?? this.status.pollingRateHz,
        hardwareDpiStages: full.hardwareDpiStages ?? this.status.hardwareDpiStages,
        hardwareStageCount: full.hardwareStageCount ?? this.status.hardwareStageCount,
        hardwareDebounceMs: full.hardwareDebounceMs ?? this.status.hardwareDebounceMs,
        lastError: null,
      };
    } catch (err) {
      this.status.lastError = err.message;
      this._closeCurrent();
      this.status.connected = false;
    }
    return this.getSnapshot();
  }

  async refreshTelemetry() {
    return this._enqueue(async () => {
      if (!this.device) {
        return this.getSnapshot();
      }
      const snap = await this._readStatusInternal();
      this.emit('state-changed', snap);
      return snap;
    });
  }

  async _withOnlineDevice(actionFn) {
    return this._enqueue(async () => {
      if (!this.device) {
        await this._readStatusInternal();
      }
      if (!this.device) {
        const err = new Error('Darmoshark N3 desconectado. Conecte o cabo USB ou receptor 2.4GHz.');
        err.code = 'DEVICE_OFFLINE';
        throw err;
      }
      const res = await actionFn(this.device);
      this.emit('state-changed', this.getSnapshot());
      return res;
    });
  }

  async setDpi({ stages, stageCount, activeStage, fallbackStages }) {
    return this._withOnlineDevice(async (dev) => {
      this._lastSoftwareDpiAt = Date.now();
      await dev.setDpi({ stages, stageCount, activeStage, fallbackStages });
      this.status.hardwareDpiStages = [...stages];
      this.status.hardwareStageCount = stageCount;
      this.status.activeDpiStage = activeStage;
    });
  }

  async setPollingRate(hz) {
    return this._withOnlineDevice(async (dev) => {
      await dev.setPollingRate(hz);
      this.status.pollingRateHz = hz;
    });
  }

  async setDebounceTime(ms) {
    return this._withOnlineDevice(async (dev) => {
      await dev.setDebounceTime(ms);
      this.status.hardwareDebounceMs = ms;
    });
  }

  async setSensorConfig(cfg) {
    return this._withOnlineDevice(async (dev) => {
      await dev.setSensorConfig(cfg);
    });
  }

  async setButtonMapping(button, actionConfig, options) {
    return this._withOnlineDevice(async (dev) => {
      await dev.setButtonMapping(button, actionConfig, options);
    });
  }

  async resetButtons() {
    return this._withOnlineDevice(async (dev) => {
      await dev.resetButtons();
    });
  }

  async bindMacro(button, macroDef, options) {
    return this._withOnlineDevice(async (dev) => {
      await dev.bindMacro(button, macroDef, options);
    });
  }

  async applyProfile(profile, options = { includeButtons: true }) {
    return this._withOnlineDevice(async (dev) => {
      this._lastSoftwareDpiAt = Date.now();
      await dev.applyProfile(profile, { includeRgb: false, includeButtons: Boolean(options.includeButtons) });
      this.status.hardwareDpiStages = [...profile.dpiStages];
      this.status.hardwareStageCount = profile.dpiStageCount;
      this.status.activeDpiStage = profile.activeDpiStage;
      this.status.pollingRateHz = profile.pollingRateHz;
      this.status.hardwareDebounceMs = profile.debounceMs;
    });
  }

  async factoryReset() {
    return this._withOnlineDevice(async (dev) => {
      this._lastSoftwareDpiAt = Date.now();
      await dev.factoryReset();
      await this._readStatusInternal();
    });
  }
}
