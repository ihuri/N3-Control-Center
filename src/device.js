import { setTimeout as delay } from 'node:timers/promises';
import {
  DEVICE_TARGETS,
  REPORT_ID,
  REPORT_LENGTH,
  VENDOR_ID,
  decodeActiveStateResponse,
  decodeBatteryResponse,
  decodeFirmwareResponse,
  decodeInputReport,
  encodeActiveStateQueryPacket,
  encodeBatteryQueryPacket,
  encodeDebouncePacket,
  encodeDpiPacket,
  encodeFactoryResetPacket,
  encodeFirmwareQueryPacket,
  encodePollingRatePacket,
  encodeRgbSequence,
  encodeSensorPacket,
  encodeWirelessPingPacket,
  formatHexPacket,
} from './protocol.js';

let cachedHidModule = null;

async function getHidModule() {
  if (!cachedHidModule) {
    const mod = await import('node-hid');
    cachedHidModule = mod.default ?? mod;
  }
  return cachedHidModule;
}

/**
 * Classifica entradas retornadas por HID.devices() que pertencem ao Darmoshark N3.
 * Reproduz a lógica exata de FUN_004418f0 (0x4418f0):
 * - Com fio (prioritário): VID 0x248A, PID 0xFF10, UsagePage 0xFFC1, Usage 0x0001
 * - Sem fio 2.4GHz:        VID 0x248A, PID 0xFF11, UsagePage 0xFFC0, Usage 0x0001
 */
export function matchN3HidEntries(allDevices = []) {
  const candidates = [];

  for (const dev of allDevices) {
    if (dev.vendorId !== VENDOR_ID) continue;

    if (dev.productId === DEVICE_TARGETS.wired.productId) {
      const exactUsage =
        dev.usagePage === DEVICE_TARGETS.wired.usagePage &&
        dev.usage === DEVICE_TARGETS.wired.usage;
      candidates.push({
        mode: 'wired',
        exactUsage,
        priority: exactUsage ? 1 : 3,
        target: DEVICE_TARGETS.wired,
        hidInfo: dev,
      });
    } else if (dev.productId === DEVICE_TARGETS.wireless.productId) {
      const exactUsage =
        dev.usagePage === DEVICE_TARGETS.wireless.usagePage &&
        dev.usage === DEVICE_TARGETS.wireless.usage;
      candidates.push({
        mode: 'wireless',
        exactUsage,
        priority: exactUsage ? 2 : 4,
        target: DEVICE_TARGETS.wireless,
        hidInfo: dev,
      });
    }
  }

  candidates.sort((a, b) => a.priority - b.priority);
  return candidates;
}

/**
 * Lista todas as interfaces HID compatíveis com o Darmoshark N3 presentes no macOS.
 */
export async function listN3Devices({ includeNonConfigCollections = false } = {}) {
  const HID = await getHidModule();
  const rawDevices = HID.devices();
  const matched = matchN3HidEntries(rawDevices);

  if (includeNonConfigCollections) {
    return matched;
  }

  const exact = matched.filter((item) => item.exactUsage);
  return exact.length > 0 ? exact : matched;
}

/**
 * Transporte simulado para inspeção offline (--dry-run) sem hardware conectado.
 */
export class DryRunTransport {
  constructor(mode = 'wired', logger = null) {
    this.mode = mode === 'wireless' ? 'wireless' : 'wired';
    this.target = DEVICE_TARGETS[this.mode];
    this.sentReports = [];
    this.logger = logger;
  }

  sendFeatureReport(packet, description = '') {
    const copy = Uint8Array.from(packet);
    this.sentReports.push({ description, packet: copy });
    if (this.logger) {
      this.logger({
        direction: 'SET_FEATURE',
        mode: this.mode,
        description,
        hex: formatHexPacket(copy),
        length: copy.length,
      });
    }
    return copy.length;
  }

  getFeatureReport(reportId, length) {
    const fake = new Uint8Array(length);
    fake[0] = reportId;
    return fake;
  }

  onInputReport() {
    return () => {};
  }

  close() {}
}

/**
 * Transporte real sobre node-hid (IOHIDManager no macOS).
 */
export class NodeHidTransport {
  constructor(hidHandle, candidate, logger = null) {
    this.hid = hidHandle;
    this.mode = candidate.mode;
    this.target = candidate.target;
    this.hidInfo = candidate.hidInfo;
    this.logger = logger;
  }

  sendFeatureReport(packet, description = '') {
    const bytes = Array.from(packet);
    if (this.logger) {
      this.logger({
        direction: 'SET_FEATURE',
        mode: this.mode,
        description,
        hex: formatHexPacket(packet),
        length: bytes.length,
      });
    }
    return this.hid.sendFeatureReport(bytes);
  }

  getFeatureReport(reportId, length, description = '') {
    const reply = Uint8Array.from(this.hid.getFeatureReport(reportId, length));
    if (this.logger) {
      this.logger({
        direction: 'GET_FEATURE',
        mode: this.mode,
        description,
        hex: formatHexPacket(reply),
        length: reply.length,
      });
    }
    return reply;
  }

  onInputReport(listener) {
    const handler = (data) => {
      listener(Uint8Array.from(data));
    };
    this.hid.on('data', handler);
    return () => {
      this.hid.removeListener('data', handler);
      if (typeof this.hid.pause === 'function' && this.hid.listenerCount('data') === 0) {
        this.hid.pause();
      }
    };
  }

  close() {
    try {
      this.hid.close();
    } catch {
      // Ignora erro caso já fechado
    }
  }
}

/**
 * Controlador de alto nível para o mouse Darmoshark N3 no macOS.
 */
export class N3Device {
  constructor(transport, { interPacketDelayMs = 15 } = {}) {
    this.transport = transport;
    this.interPacketDelayMs = interPacketDelayMs;
  }

  get mode() {
    return this.transport.mode;
  }

  get target() {
    return this.transport.target;
  }

  get hidInfo() {
    return this.transport.hidInfo ?? null;
  }

  static async open({
    preferredMode = 'auto',
    dryRun = false,
    logger = null,
    interPacketDelayMs = 15,
  } = {}) {
    if (dryRun) {
      const simulatedMode = preferredMode === 'wireless' ? 'wireless' : 'wired';
      return new N3Device(new DryRunTransport(simulatedMode, logger), { interPacketDelayMs });
    }

    const candidates = await listN3Devices();
    const filtered =
      preferredMode === 'auto'
        ? candidates
        : candidates.filter((c) => c.mode === preferredMode);

    if (filtered.length === 0) {
      const modeHint =
        preferredMode === 'auto'
          ? 'cabo USB (0x248A:0xFF10) ou receptor 2.4GHz (0x248A:0xFF11)'
          : DEVICE_TARGETS[preferredMode]?.label ?? preferredMode;
      const err = new Error(
        `Nenhum Darmoshark N3 detectado em ${modeHint}. Verifique a conexão USB/2.4G ou use --dry-run para inspecionar os pacotes.`,
      );
      err.code = 'DEVICE_NOT_FOUND';
      throw err;
    }

    const chosen = filtered[0];
    if (!chosen.hidInfo.path) {
      const err = new Error(
        'Dispositivo Darmoshark N3 encontrado, mas sem caminho IOHIDDevice acessível. Verifique as permissões de Monitoramento de Entrada do Terminal no macOS.',
      );
      err.code = 'HID_PATH_UNAVAILABLE';
      throw err;
    }

    const HID = await getHidModule();
    // CRÍTICO no macOS: a Interface USB 0 do Darmoshark N3 agrega a coleção de cursor (0x0001:0x0002)
    // e a coleção vendor (0xFFC1/0xFFC0:0x0001) no mesmo IOHIDDevice. Abrir com { nonExclusive: true }
    // força hid_darwin_set_open_exclusive(0) (kIOHIDOptionsTypeNone), evitando erro 0xE00002E2 sem sudo
    // e sem sequestrar o ponteiro do mouse no macOS!
    const handle = new HID.HID(chosen.hidInfo.path, { nonExclusive: true });
    return new N3Device(new NodeHidTransport(handle, chosen, logger), { interPacketDelayMs });
  }

  close() {
    this.transport.close();
  }

  /**
   * Envia ping 0x51 0x0C 0x02 para receptor 2.4GHz e aguarda resposta 0x54 0xE3 (se disponível).
   */
  async pingWireless(timeoutMs = 250) {
    if (this.mode !== 'wireless') {
      return { online: true, mode: 'wired' };
    }

    let unsubscribe = () => {};
    const handshakePromise = new Promise((resolve) => {
      const timer = setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, timeoutMs);

      unsubscribe = this.transport.onInputReport((bytes) => {
        const event = decodeInputReport(bytes, 'wireless');
        if (event?.type === 'wireless_handshake') {
          clearTimeout(timer);
          unsubscribe();
          resolve(event);
        }
      });
    });

    const pkt = encodeWirelessPingPacket();
    this.transport.sendFeatureReport(pkt, 'Ping Wireless 2.4GHz (0x0C)');
    const handshake = await handshakePromise;

    if (!handshake) {
      return {
        online: null,
        mode: 'wireless',
        note: 'Sem resposta assíncrona 0x54/0xE3 dentro do tempo limite (mouse pode estar em repouso ou em modo somente Feature Report).',
      };
    }

    return {
      online: handshake.online,
      mode: 'wireless',
      batteryPercent: handshake.batteryPercent,
      batteryIconLevel: handshake.batteryIconLevel,
      firmwareVersion: handshake.firmwareVersion,
    };
  }

  async getFirmwareVersion() {
    const req = encodeFirmwareQueryPacket();
    this.transport.sendFeatureReport(req, 'Solicitar versão de firmware (0x04)');
    await delay(this.interPacketDelayMs);
    const raw = this.transport.getFeatureReport(
      REPORT_ID.FEATURE_CONFIG,
      REPORT_LENGTH.FEATURE_CONFIG,
      'Ler versão de firmware (0x04)',
    );
    return decodeFirmwareResponse(raw);
  }

  async getBatteryStatus() {
    const req = encodeBatteryQueryPacket();
    this.transport.sendFeatureReport(req, 'Solicitar nível de bateria (0x06)');
    await delay(this.interPacketDelayMs);
    const raw = this.transport.getFeatureReport(
      REPORT_ID.FEATURE_CONFIG,
      REPORT_LENGTH.FEATURE_CONFIG,
      'Ler nível de bateria (0x06)',
    );
    return decodeBatteryResponse(raw, this.mode);
  }

  async getActiveState() {
    const req = encodeActiveStateQueryPacket();
    this.transport.sendFeatureReport(req, 'Solicitar estado ativo DPI/Polling (0x07)');
    await delay(this.interPacketDelayMs);
    const raw = this.transport.getFeatureReport(
      REPORT_ID.FEATURE_CONFIG,
      REPORT_LENGTH.FEATURE_CONFIG,
      'Ler estado ativo DPI/Polling (0x07)',
    );
    return decodeActiveStateResponse(raw, this.mode);
  }

  async getFullStatus() {
    const wirelessStatus =
      this.mode === 'wireless' ? await this.pingWireless() : { online: true, mode: 'wired' };

    if (this.mode === 'wireless' && wirelessStatus.online === false) {
      return {
        mode: this.mode,
        deviceLabel: this.target.label,
        vendorId: this.target.vendorId,
        productId: this.target.productId,
        usagePage: this.target.usagePage,
        usage: this.target.usage,
        wirelessOnline: false,
        offlineReason:
          'Receptor 2.4GHz detectado, porém o mouse está em repouso, desligado ou operando via cabo USB.',
        firmwareVersion: null,
        battery: { percent: null, iconLevel: null, usbPowered: false },
        activeDpiStage: null,
        pollingRateHz: null,
        hardwareDpiStages: null,
        hardwareStageCount: null,
        hardwareDebounceMs: null,
      };
    }

    try {
      const firmware = await this.getFirmwareVersion();
      const battery = await this.getBatteryStatus();
      const activeState = await this.getActiveState();

      return {
        mode: this.mode,
        deviceLabel: this.target.label,
        vendorId: this.target.vendorId,
        productId: this.target.productId,
        usagePage: this.target.usagePage,
        usage: this.target.usage,
        wirelessOnline: this.mode === 'wireless' ? true : true,
        firmwareVersion: firmware.version ?? wirelessStatus.firmwareVersion ?? null,
        battery: {
          percent: battery.percent ?? wirelessStatus.batteryPercent ?? null,
          iconLevel: battery.iconLevel ?? wirelessStatus.batteryIconLevel ?? null,
          usbPowered: battery.chargingOrUsbPowered,
        },
        activeDpiStage: activeState.activeStage,
        pollingRateHz: activeState.pollingRateHz,
        hardwareDpiStages: activeState.hardwareDpiStages,
        hardwareStageCount: activeState.hardwareStageCount,
        hardwareDebounceMs: activeState.hardwareDebounceMs,
      };
    } catch (error) {
      // No receptor 2.4GHz (DAT_004d4918 == 2), IOHIDDeviceGetReport retorna Pipe Stall (0xE0005000)
      // quando o mouse está com o rádio RF inativo (em repouso, desligado ou plugado no cabo USB).
      if (this.mode === 'wireless' && /0xE0005000|feature report/i.test(String(error.message))) {
        return {
          mode: this.mode,
          deviceLabel: this.target.label,
          vendorId: this.target.vendorId,
          productId: this.target.productId,
          usagePage: this.target.usagePage,
          usage: this.target.usage,
          wirelessOnline: false,
          offlineReason:
            'Receptor 2.4GHz conectado, mas sem link RF ativo com o mouse (em repouso, desligado ou conectado via cabo USB).',
          firmwareVersion: wirelessStatus.firmwareVersion ?? null,
          battery: {
            percent: wirelessStatus.batteryPercent ?? null,
            iconLevel: wirelessStatus.batteryIconLevel ?? null,
            usbPowered: false,
          },
          activeDpiStage: null,
          pollingRateHz: null,
          hardwareDpiStages: null,
          hardwareStageCount: null,
          hardwareDebounceMs: null,
        };
      }
      throw error;
    }
  }

  async setDpi({ stages, stageCount, activeStage, fallbackStages }) {
    const packet = encodeDpiPacket({ stages, stageCount, activeStage, fallbackStages });
    this.transport.sendFeatureReport(
      packet,
      `Configurar DPI (estágios=${stages.join(',')}, qtd=${stageCount ?? stages.length}, ativo=${activeStage})`,
    );
    await delay(this.interPacketDelayMs);
    return packet;
  }

  async setPollingRate(hz) {
    const packet = encodePollingRatePacket(hz, this.mode);
    this.transport.sendFeatureReport(
      packet,
      `Configurar Polling Rate (${hz} Hz em modo ${this.mode})`,
    );
    await delay(this.interPacketDelayMs);
    return packet;
  }

  async setDebounceTime(ms) {
    const packet = encodeDebouncePacket(ms);
    this.transport.sendFeatureReport(packet, `Configurar Debounce Time (${ms} ms)`);
    await delay(this.interPacketDelayMs);
    return packet;
  }

  async setSensorConfig({ lod, rippleControl, angleSnap, motionSync }) {
    const packet = encodeSensorPacket({ lod, rippleControl, angleSnap, motionSync });
    this.transport.sendFeatureReport(
      packet,
      `Configurar Sensor PAW3395 (LOD=${lod}, Ripple=${rippleControl}, AngleSnap=${angleSnap}, MotionSync=${motionSync})`,
    );
    await delay(this.interPacketDelayMs);
    return packet;
  }

  async setRgbLighting({ mode, color, brightness, speed }) {
    const sequence = encodeRgbSequence({ mode, color, brightness, speed });
    const sent = [];
    for (const step of sequence) {
      this.transport.sendFeatureReport(step.packet, step.description);
      sent.push(step.packet);
      await delay(this.interPacketDelayMs);
    }
    return sent;
  }

  async applyProfile(profile, { includeRgb = false } = {}) {
    const packets = [];
    packets.push(
      await this.setDpi({
        stages: profile.dpiStages,
        stageCount: profile.dpiStageCount,
        activeStage: profile.activeDpiStage,
      }),
    );
    packets.push(await this.setPollingRate(profile.pollingRateHz));
    packets.push(await this.setDebounceTime(profile.debounceMs));
    packets.push(
      await this.setSensorConfig({
        lod: profile.lod,
        rippleControl: profile.sensor.rippleControl,
        angleSnap: profile.sensor.angleSnap,
        motionSync: profile.sensor.motionSync,
      }),
    );
    if (includeRgb && profile.rgb) {
      const rgbPackets = await this.setRgbLighting(profile.rgb);
      packets.push(...rgbPackets);
    }
    return packets;
  }

  async factoryReset() {
    const packet = encodeFactoryResetPacket();
    this.transport.sendFeatureReport(packet, 'Restauração de fábrica global (0x0B 0xAA)');
    await delay(this.interPacketDelayMs);
    return packet;
  }

  subscribeEvents(onEvent) {
    return this.transport.onInputReport((rawBytes) => {
      const decoded = decodeInputReport(rawBytes, this.mode);
      if (decoded) {
        onEvent(decoded);
      }
    });
  }
}
