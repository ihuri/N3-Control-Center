/**
 * Protocolo USB HID do mouse Darmoshark N3 (PAW3395 / Telink 0x248A)
 * Recuperado via engenharia reversa estática (REA / Ghidra 12.1.4) de:
 * - Instalador: Darmoshark N3 Mouse1.0.7.2.exe (InstallShield 2018 v24.0.0.464)
 * - Executável interno: darmoshark.exe (PE32 x86 C++ Win32, Keychron_driver.pdb)
 */

import {
  BUTTON_ACTION_CATEGORY,
  DEFAULT_BUTTON_MAPPINGS,
  MACRO_LIMITS,
  MACRO_LOOP_MODES,
  normalizeMacroEvents,
  parseKeyCombo,
  resolveButtonHardwareId,
  resolveDpiButtonAction,
  resolveLightButtonAction,
  resolveMediaAction,
  resolveMouseAction,
  resolveSystemShortcut,
  resolveTurboMouseButton,
} from './keymap.js';

export * from './keymap.js';

export const VENDOR_ID = 0x248a; // Telink Semiconductor (9354)

export const DEVICE_TARGETS = Object.freeze({
  wired: Object.freeze({
    mode: 'wired',
    driverStateCode: 1, // DAT_004d4918 = 1 em FUN_004418f0 (0x4418f0)
    vendorId: VENDOR_ID,
    productId: 0xff10,
    usagePage: 0xffc1,
    usage: 0x0001,
    label: 'Darmoshark N3 (USB Com Fio)',
  }),
  wireless: Object.freeze({
    mode: 'wireless',
    driverStateCode: 3, // DAT_004d4918 = 2 (dongle) -> 3 (mouse online)
    vendorId: VENDOR_ID,
    productId: 0xff11,
    usagePage: 0xffc0,
    usage: 0x0001,
    label: 'Darmoshark N3 (Receptor Sem Fio 2.4GHz)',
  }),
});

export const REPORT_ID = Object.freeze({
  FEATURE_CONFIG: 0x51, // Pacotes de 21 bytes (0x15) via HidD_SetFeature / HidD_GetFeature
  FEATURE_KEYMAP: 0x52, // Pacotes de 65 bytes (0x41) para botões/macros
  INPUT_EVENT: 0x54, // Pacotes de 21 bytes (0x15) via ReadFile (eventos assíncronos)
});

export const REPORT_LENGTH = Object.freeze({
  FEATURE_CONFIG: 21, // 0x15 bytes (incluindo Report ID em buf[0])
  FEATURE_KEYMAP: 65, // 0x41 bytes (incluindo Report ID em buf[0])
  INPUT_EVENT: 21,
});

export const OPCODE = Object.freeze({
  GET_FIRMWARE: 0x04, // FUN_00441d50 (0x441d50)
  GET_BATTERY: 0x06, // FUN_00441d50 (0x441d50)
  GET_ACTIVE_STATE: 0x07, // FUN_00442090 (0x442090)
  FACTORY_RESET: 0x0b, // FUN_0043f140 (0x43f140)
  WIRELESS_PING: 0x0c, // FUN_00457a30 (0x457a30) / LAB_00445380
  SET_LIGHT_MODE: 0x22, // Dialog proc 0x43ccb0 (0x43d1cc)
  SET_LIGHT_BRIGHTNESS: 0x23, // FUN_0044a950 (0x44a950)
  SET_LIGHT_COLOR_R: 0x24, // FUN_00442920 (0x442920)
  SET_LIGHT_COLOR_G: 0x25, // FUN_00442980 (0x442980)
  SET_LIGHT_COLOR_B: 0x26, // FUN_004429e0 (0x4429e0)
  SET_LIGHT_SPEED: 0x27, // FUN_0044ae40 (0x44ae40)
  SET_DPI: 0x40, // FUN_00442a40 (0x442a40)
  SET_POLLING_RATE: 0x41, // FUN_00443f40 (0x443f40) / FUN_00456c80 (0x456c80)
  SET_LOD_SENSOR: 0x42, // FUN_00443eb0 (0x443eb0)
  SET_DEBOUNCE: 0x43, // FUN_00445320 (0x445320)
});

export const INPUT_OPCODE = Object.freeze({
  STATUS_NOTIFICATION: 0xe2, // Bateria, estágio DPI, polling rate e sleep/wake
  WIRELESS_HANDSHAKE: 0xe3, // Resposta ao ping 0x51 0x0C 0x02
});

export const KEYMAP_OPCODE = Object.freeze({
  SET_BUTTON: 0x52, // FUN_00442e40 (0x442e40) e Disable em 0x446b1c
  UPLOAD_MACRO: 0x55, // FUN_00443fc0 (0x443fc0)
});

export const POLLING_RATE_TO_CODE = Object.freeze({
  125: 0x00,
  500: 0x01,
  1000: 0x02,
});

export const CODE_TO_POLLING_RATE = Object.freeze({
  0x00: 125,
  0x01: 500,
  0x02: 1000,
});

export const POLLING_LED_INDICATOR = Object.freeze({
  125: 'Vermelho',
  500: 'Azul',
  1000: 'Verde',
});

export const LOD_TO_CODE = Object.freeze({
  low: 0x01, // ~1mm (liftvalue = 0 -> +1 = 1)
  high: 0x02, // ~2mm (liftvalue = 1 -> +1 = 2)
  '1mm': 0x01,
  '2mm': 0x02,
});

export const LIGHT_MODES = Object.freeze({
  off: 0x00, // 关闭 (Desligado)
  static: 0x01, // 单色常亮 (Estático)
  breathing: 0x02, // 单色呼吸 (Respiração)
  spectrum: 0x03, // 全彩 (Espectro / Ciclo RGB)
  wave: 0x04, // 流光 (Onda / Streamer)
  marquee: 0x05, // 单色跑马 (Marquee monocromático)
  neon: 0x06, // 霓虹 (Neon)
});

export const CODE_TO_LIGHT_MODE = Object.freeze(
  Object.fromEntries(Object.entries(LIGHT_MODES).map(([name, code]) => [code, name])),
);

/**
 * Tabela de cores predefinidas extraída de 0x4b8480 em darmoshark.exe
 */
export const RGB_PRESET_COLORS = Object.freeze({
  red: Object.freeze([255, 0, 0]),
  magenta: Object.freeze([255, 0, 255]),
  blue: Object.freeze([0, 0, 255]),
  cyan: Object.freeze([0, 255, 255]),
  green: Object.freeze([0, 255, 0]),
  yellow: Object.freeze([255, 255, 0]),
  tomato: Object.freeze([255, 99, 71]),
});

export const DPI_LIMITS = Object.freeze({
  MIN_PAW3395: 50,
  MIN_OEM_SLIDER: 100,
  MAX: 26000,
  MAX_STAGES: 5,
});

export const DEBOUNCE_LIMITS = Object.freeze({
  MIN_MS: 0,
  MAX_MS: 20,
  DEFAULT_MS: 8,
});

/**
 * Perfil padrão extraído de profile1.ini do instalador oficial v1.0.7.2
 */
export const DEFAULT_PROFILE = Object.freeze({
  dpiStages: Object.freeze([400, 800, 1600, 3200, 4800]),
  dpiStageCount: 5,
  activeDpiStage: 2, // 1-based (estágio 2 = 800 DPI; 0-based = 1 no protocolo)
  pollingRateHz: 500, // reportRateChoice = 1 (reportRate2 = 500Hz)
  debounceMs: 8, // keyreply = 8
  lod: 'low', // liftvalue = 0
  sensor: Object.freeze({
    rippleControl: true, // sensor1 = 1
    angleSnap: true, // sensor2 = 1
    motionSync: true, // sensor3 = 1
  }),
  rgb: Object.freeze({
    mode: 'spectrum', // LightMode = 3
    color: Object.freeze([255, 0, 255]), // ColorIndex = 1
    brightness: 10, // LightLevel = 10
    speed: 1, // SpeedLevel = 1
  }),
  buttons: DEFAULT_BUTTON_MAPPINGS,
});

/**
 * Cria um buffer de 65 bytes (0x41) preenchido com zeros para o Report ID 0x52 (botões/macros).
 */
export function createKeymapPacket(opcode) {
  if (!Number.isInteger(opcode) || opcode < 0 || opcode > 0xff) {
    throw new RangeError(`Opcode 0x52 inválido: ${opcode}`);
  }
  const packet = new Uint8Array(REPORT_LENGTH.FEATURE_KEYMAP);
  packet[0] = REPORT_ID.FEATURE_KEYMAP;
  packet[1] = opcode;
  return packet;
}

/**
 * Cria um buffer de 21 bytes preenchido com zeros para o Report ID 0x51.
 * Nota: O protocolo Telink/Darmoshark N3 não utiliza byte de checksum/CRC.
 */
export function createFeaturePacket(opcode) {
  if (!Number.isInteger(opcode) || opcode < 0 || opcode > 0xff) {
    throw new RangeError(`Opcode inválido: ${opcode}`);
  }
  const packet = new Uint8Array(REPORT_LENGTH.FEATURE_CONFIG);
  packet[0] = REPORT_ID.FEATURE_CONFIG;
  packet[1] = opcode;
  return packet;
}

/**
 * Formata um buffer como string hexadecimal legível (ex.: "51 40 01 ...").
 */
export function formatHexPacket(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

/**
 * Normaliza respostas de HidD_GetFeature / IOHIDDeviceGetReport no macOS.
 * Caso o backend omita o Report ID no byte 0, realinha o pacote para 21 bytes.
 */
export function normalizeFeatureReply(
  rawBytes,
  expectedOpcode,
  expectedReportId = REPORT_ID.FEATURE_CONFIG,
  expectedLength = REPORT_LENGTH.FEATURE_CONFIG,
) {
  const src = Uint8Array.from(rawBytes ?? []);
  const out = new Uint8Array(expectedLength);

  if (src.length === 0) {
    return out;
  }

  if (src[0] === expectedReportId) {
    out.set(src.subarray(0, expectedLength), 0);
    return out;
  }

  if (expectedOpcode !== undefined && src[0] === expectedOpcode) {
    out[0] = expectedReportId;
    out.set(src.subarray(0, expectedLength - 1), 1);
    return out;
  }

  out.set(src.subarray(0, expectedLength), 0);
  return out;
}

/**
 * [0x51, 0x0C, 0x02, 0x00...] — Ping de status online para o receptor 2.4GHz (FUN_00457a30).
 */
export function encodeWirelessPingPacket() {
  const packet = createFeaturePacket(OPCODE.WIRELESS_PING);
  packet[2] = 0x02;
  return packet;
}

/**
 * [0x51, 0x04, 0x00...] — Solicita leitura da versão de firmware (FUN_00441d50).
 */
export function encodeFirmwareQueryPacket() {
  return createFeaturePacket(OPCODE.GET_FIRMWARE);
}

/**
 * [0x51, 0x06, 0x00...] — Solicita leitura do nível de bateria (FUN_00441d50).
 */
export function encodeBatteryQueryPacket() {
  return createFeaturePacket(OPCODE.GET_BATTERY);
}

/**
 * [0x51, 0x07, 0x00...] — Solicita estágio de DPI ativo, polling rate e tabela de DPI (FUN_00442090).
 */
export function encodeActiveStateQueryPacket() {
  return createFeaturePacket(OPCODE.GET_ACTIVE_STATE);
}

/**
 * [0x51, 0x0B, 0xAA, 0x00...] — Restauração global de fábrica (FUN_0043f140).
 */
export function encodeFactoryResetPacket() {
  const packet = createFeaturePacket(OPCODE.FACTORY_RESET);
  packet[2] = 0xaa;
  return packet;
}

/**
 * [0x51, 0x40, stageIdx, stageIdx, stageIdx, dpi1_lo, dpi1_hi, ..., dpi5_lo, dpi5_hi, count, 0...]
 * Codifica os 5 estágios de DPI (uint16 little-endian), estágio ativo (0..4) e quantidade de estágios (1..5).
 * Referência: FUN_00442a40 (0x442a40).
 *
 * @param {object} options
 * @param {number[]} options.stages Array com 1 a 5 valores de DPI (50..26000). Se < 5, completa os demais com estágios padrão.
 * @param {number} [options.stageCount] Quantidade de estágios habilitados no botão físico de ciclo (1..5).
 * @param {number} [options.activeStage=1] Estágio ativo (1..5, base 1 para interface humana).
 * @param {number[]} [options.fallbackStages] Valores atuais para preencher slots não informados (até 5).
 */
export function encodeDpiPacket({
  stages,
  stageCount,
  activeStage = 1,
  fallbackStages = DEFAULT_PROFILE.dpiStages,
}) {
  if (!Array.isArray(stages) || stages.length < 1 || stages.length > DPI_LIMITS.MAX_STAGES) {
    throw new RangeError('Informe entre 1 e 5 valores de DPI.');
  }

  const effectiveCount = stageCount ?? stages.length;
  if (
    !Number.isInteger(effectiveCount) ||
    effectiveCount < 1 ||
    effectiveCount > DPI_LIMITS.MAX_STAGES
  ) {
    throw new RangeError(`Quantidade de estágios de DPI inválida (${effectiveCount}). Use de 1 a 5.`);
  }

  if (
    !Number.isInteger(activeStage) ||
    activeStage < 1 ||
    activeStage > effectiveCount
  ) {
    throw new RangeError(
      `Estágio ativo inválido (${activeStage}). Deve estar entre 1 e ${effectiveCount}.`,
    );
  }

  const fullStages = [];
  for (let i = 0; i < DPI_LIMITS.MAX_STAGES; i += 1) {
    const rawValue = i < stages.length ? stages[i] : (fallbackStages[i] ?? DEFAULT_PROFILE.dpiStages[i]);
    if (!Number.isInteger(rawValue) || rawValue < DPI_LIMITS.MIN_PAW3395 || rawValue > DPI_LIMITS.MAX) {
      throw new RangeError(
        `Valor de DPI inválido no estágio ${i + 1} (${rawValue}). Faixa suportada: ${DPI_LIMITS.MIN_PAW3395}..${DPI_LIMITS.MAX}.`,
      );
    }
    fullStages.push(rawValue);
  }

  const activeIndexZeroBased = activeStage - 1;
  const packet = createFeaturePacket(OPCODE.SET_DPI);

  // 0x442a95..0x442a9b: buf[2], buf[3] e buf[4] recebem todos o índice 0-based (DAT_004d4928)
  packet[2] = activeIndexZeroBased;
  packet[3] = activeIndexZeroBased;
  packet[4] = activeIndexZeroBased;

  // 0x442d7b..0x442d7e: 5 inteiros uint16 little-endian em buf[5..14]
  for (let i = 0; i < DPI_LIMITS.MAX_STAGES; i += 1) {
    const dpi = fullStages[i];
    const offset = 5 + i * 2;
    packet[offset] = dpi & 0xff;
    packet[offset + 1] = (dpi >> 8) & 0xff;
  }

  // 0x442dee: buf[15] recebe DPINum (1..5)
  packet[15] = effectiveCount;

  return packet;
}

/**
 * [0x51, 0x41, wiredRate, wirelessRate, 0...]
 * Codifica o Polling Rate (125Hz=0, 500Hz=1, 1000Hz=2).
 * DIFERENÇA CRÍTICA DESCOBERTA EM FUN_00443f40 (0x443f40):
 * - Modo USB Com Fio (DAT_004d4918 == 1): escreve código em buf[2]
 * - Modo 2.4GHz Sem Fio (DAT_004d4918 == 3): escreve código em buf[3]
 */
export function encodePollingRatePacket(hz, mode = 'wired') {
  const rateHz = Number(hz);
  if (!Object.hasOwn(POLLING_RATE_TO_CODE, rateHz)) {
    throw new RangeError(
      `Polling rate inválido (${hz} Hz). Valores suportados pelo firmware: 125, 500, 1000.`,
    );
  }
  if (mode !== 'wired' && mode !== 'wireless') {
    throw new TypeError(`Modo de conexão inválido (${mode}). Use "wired" ou "wireless".`);
  }

  const code = POLLING_RATE_TO_CODE[rateHz];
  const packet = createFeaturePacket(OPCODE.SET_POLLING_RATE);
  if (mode === 'wired') {
    packet[2] = code;
  } else {
    packet[3] = code;
  }
  return packet;
}

/**
 * [0x51, 0x43, debounceMs, 0...]
 * Codifica o Debounce Time / Keypress Response em milissegundos (0..20 ms).
 * Referência: FUN_00445320 (0x445320) e FUN_00447d60 (0x447d60).
 */
export function encodeDebouncePacket(ms) {
  if (!Number.isInteger(ms) || ms < DEBOUNCE_LIMITS.MIN_MS || ms > DEBOUNCE_LIMITS.MAX_MS) {
    throw new RangeError(
      `Debounce time inválido (${ms} ms). A faixa aceita pelo firmware é de ${DEBOUNCE_LIMITS.MIN_MS} a ${DEBOUNCE_LIMITS.MAX_MS} ms.`,
    );
  }
  const packet = createFeaturePacket(OPCODE.SET_DEBOUNCE);
  packet[2] = ms;
  return packet;
}

/**
 * [0x51, 0x42, lod, ripple, angleSnap, motionSync, 0...]
 * Codifica altura de LOD (1=Low, 2=High) e flags do sensor PAW3395 (1=ON, 2=OFF).
 * Referência: FUN_00443eb0 (0x443eb0) e FUN_0045b880 (0x45b880).
 */
export function encodeSensorPacket({
  lod = 'low',
  rippleControl = true,
  angleSnap = true,
  motionSync = true,
} = {}) {
  const normalizedLod = String(lod).toLowerCase();
  if (!Object.hasOwn(LOD_TO_CODE, normalizedLod)) {
    throw new RangeError(`Valor de LOD inválido (${lod}). Use "low" (1mm) ou "high" (2mm).`);
  }

  const packet = createFeaturePacket(OPCODE.SET_LOD_SENSOR);
  packet[2] = LOD_TO_CODE[normalizedLod];
  packet[3] = rippleControl ? 0x01 : 0x02;
  packet[4] = angleSnap ? 0x01 : 0x02;
  packet[5] = motionSync ? 0x01 : 0x02;
  return packet;
}

/**
 * Analisa uma string de cor (#RRGGBB, RRGGBB, "r,g,b" ou nome de preset OEM) em [r, g, b].
 */
export function parseRgbColor(input) {
  if (Array.isArray(input) && input.length === 3) {
    const rgb = input.map(Number);
    if (rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) {
      return rgb;
    }
    throw new RangeError(`Componentes RGB fora da faixa 0..255: ${input.join(',')}`);
  }

  const text = String(input ?? '').trim().toLowerCase();
  if (Object.hasOwn(RGB_PRESET_COLORS, text)) {
    return [...RGB_PRESET_COLORS[text]];
  }

  const hexMatch = /^#?([0-9a-f]{6})$/i.exec(text);
  if (hexMatch) {
    const hex = hexMatch[1];
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ];
  }

  const csvMatch = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/.exec(text);
  if (csvMatch) {
    const rgb = [Number(csvMatch[1]), Number(csvMatch[2]), Number(csvMatch[3])];
    if (rgb.every((v) => v >= 0 && v <= 255)) {
      return rgb;
    }
  }

  throw new RangeError(
    `Cor RGB inválida ("${input}"). Use #RRGGBB, R,G,B ou um preset (${Object.keys(RGB_PRESET_COLORS).join(', ')}).`,
  );
}

export function resolveLightModeCode(mode) {
  if (Number.isInteger(mode) && mode >= 0 && mode <= 6) {
    return mode;
  }
  const key = String(mode ?? '').trim().toLowerCase();
  if (Object.hasOwn(LIGHT_MODES, key)) {
    return LIGHT_MODES[key];
  }
  throw new RangeError(
    `Modo de iluminação inválido ("${mode}"). Modos suportados: ${Object.keys(LIGHT_MODES).join(', ')}.`,
  );
}

/**
 * Codifica comandos individuais e sequência completa de iluminação RGB (opcodes 0x22..0x27).
 * Referências: 0x43ccb0 (modo), 0x44a950 (brilho), 0x442920..0x4429e0 (R/G/B), 0x44ae40 (velocidade).
 */
export function encodeLightModePacket(mode) {
  const modeCode = resolveLightModeCode(mode);
  const packet = createFeaturePacket(OPCODE.SET_LIGHT_MODE);
  packet[2] = 0x01;
  packet[3] = modeCode;
  return packet;
}

export function encodeLightBrightnessPacket(mode, brightness) {
  const modeCode = resolveLightModeCode(mode);
  if (!Number.isInteger(brightness) || brightness < 1 || brightness > 255) {
    throw new RangeError(`Brilho inválido (${brightness}). Use um inteiro entre 1 e 255.`);
  }
  const packet = createFeaturePacket(OPCODE.SET_LIGHT_BRIGHTNESS);
  packet[2] = 0x01;
  packet[3] = modeCode;
  packet[4] = brightness;
  return packet;
}

export function encodeLightSpeedPacket(mode, speed) {
  const modeCode = resolveLightModeCode(mode);
  if (!Number.isInteger(speed) || speed < 1 || speed > 255) {
    throw new RangeError(`Velocidade inválida (${speed}). Use um inteiro entre 1 e 255.`);
  }
  const packet = createFeaturePacket(OPCODE.SET_LIGHT_SPEED);
  packet[2] = 0x01;
  packet[3] = modeCode;
  packet[4] = speed;
  return packet;
}

export function encodeLightColorPackets(mode, color) {
  const modeCode = resolveLightModeCode(mode);
  const [r, g, b] = parseRgbColor(color);

  const pktR = createFeaturePacket(OPCODE.SET_LIGHT_COLOR_R);
  pktR[2] = 0x01;
  pktR[3] = modeCode;
  pktR[4] = r;

  const pktG = createFeaturePacket(OPCODE.SET_LIGHT_COLOR_G);
  pktG[2] = 0x01;
  pktG[3] = modeCode;
  pktG[4] = g;

  const pktB = createFeaturePacket(OPCODE.SET_LIGHT_COLOR_B);
  pktB[2] = 0x01;
  pktB[3] = modeCode;
  pktB[4] = b;

  return [pktR, pktG, pktB];
}

/**
 * Gera a sequência de pacotes Feature Report para aplicar uma configuração RGB completa.
 */
export function encodeRgbSequence({
  mode = 'spectrum',
  color,
  brightness,
  speed,
} = {}) {
  const modeCode = resolveLightModeCode(mode);
  const packets = [
    { description: `Modo RGB (${CODE_TO_LIGHT_MODE[modeCode]} = ${modeCode})`, packet: encodeLightModePacket(modeCode) },
  ];

  if (modeCode !== LIGHT_MODES.off) {
    if (color !== undefined) {
      const [r, g, b] = parseRgbColor(color);
      const [pktR, pktG, pktB] = encodeLightColorPackets(modeCode, [r, g, b]);
      packets.push(
        { description: `Canal Vermelho (R=${r})`, packet: pktR },
        { description: `Canal Verde (G=${g})`, packet: pktG },
        { description: `Canal Azul (B=${b})`, packet: pktB },
      );
    }
    if (brightness !== undefined) {
      packets.push({
        description: `Brilho RGB (${brightness})`,
        packet: encodeLightBrightnessPacket(modeCode, brightness),
      });
    }
    if (speed !== undefined) {
      packets.push({
        description: `Velocidade RGB (${speed})`,
        packet: encodeLightSpeedPacket(modeCode, speed),
      });
    }
  }

  return packets;
}

/**
 * Mapeia porcentagem de bateria sem fio (0..100%) para o índice de ícone OEM (0..7)
 * conforme implementado em FUN_00441d50 (0x441fa1..0x44200c).
 */
export function batteryPercentToIconLevel(percent) {
  if (percent < 3) return 0;
  if (percent === 3) return 1;
  if (percent <= 10) return 2;
  if (percent <= 25) return 3;
  if (percent <= 50) return 4;
  if (percent <= 75) return 5;
  if (percent <= 90) return 6;
  return 7;
}

/**
 * Decodifica a resposta de versão de firmware (GetFeature 0x51, 0x04 -> buf[3..11]).
 */
export function decodeFirmwareResponse(rawBytes) {
  const buf = normalizeFeatureReply(rawBytes, OPCODE.GET_FIRMWARE);
  const chars = [];
  for (let i = 3; i < 12; i += 1) {
    const code = buf[i];
    if (code >= 0x20 && code <= 0x7e) {
      chars.push(String.fromCharCode(code));
    }
  }
  return {
    version: chars.join('').trim() || null,
    rawAsciiBytes: Array.from(buf.subarray(3, 12)),
    rawPacket: buf,
  };
}

/**
 * Decodifica a resposta de bateria (GetFeature 0x51, 0x06).
 * - Com fio (mode === 'wired'): buf[12] contém o status/nível de carga (ex.: 2 = carregado/USB) e buf[11] também informa a porcentagem (0..100%).
 * - Sem fio (mode === 'wireless'): buf[11] contém a porcentagem (0..100%).
 */
export function decodeBatteryResponse(rawBytes, mode = 'wired') {
  const buf = normalizeFeatureReply(rawBytes, OPCODE.GET_BATTERY);
  const rawPercent = buf[11];
  const validPercent = rawPercent >= 0 && rawPercent <= 100 ? rawPercent : null;

  if (mode === 'wired') {
    const iconLevel = buf[12];
    return {
      mode: 'wired',
      percent: validPercent,
      iconLevel,
      chargingOrUsbPowered: true,
      rawPacket: buf,
    };
  }

  const percent = validPercent ?? 0;
  return {
    mode: 'wireless',
    percent,
    iconLevel: batteryPercentToIconLevel(percent),
    chargingOrUsbPowered: false,
    rawPacket: buf,
  };
}

/**
 * Decodifica a resposta de estado ativo (GetFeature 0x51, 0x07 -> FUN_00442090).
 * - Com fio: stateByte = buf[3]
 * - Sem fio: stateByte = buf[4]
 *   - nibble inferior (stateByte & 0x0F): índice 0-based do estágio ativo de DPI (0..4)
 *   - nibble superior (stateByte >> 4): código de polling rate (0=125Hz, 1=500Hz, 2=1000Hz)
 * - buf[6..15]: 5 valores uint16_le correspondentes aos estágios de DPI gravados no mouse.
 * - buf[17]: quantidade de estágios habilitados (1..5), observado no firmware 0.1.19r-c.
 * - buf[18]: debounce time atual em ms (0..20), observado no firmware 0.1.19r-c.
 */
export function decodeActiveStateResponse(rawBytes, mode = 'wired') {
  const buf = normalizeFeatureReply(rawBytes, OPCODE.GET_ACTIVE_STATE);
  const stateByte = mode === 'wired' ? buf[3] : buf[4];
  const activeStageZeroBased = Math.min(4, stateByte & 0x0f);
  const pollingRateCode = Math.min(2, (stateByte >> 4) & 0x0f);

  const hardwareDpiStages = [];
  for (let i = 0; i < DPI_LIMITS.MAX_STAGES; i += 1) {
    const offset = 6 + i * 2;
    const dpi = buf[offset] | (buf[offset + 1] << 8);
    hardwareDpiStages.push(dpi);
  }

  const hasValidHardwareDpi = hardwareDpiStages.some(
    (v) => v >= DPI_LIMITS.MIN_PAW3395 && v <= DPI_LIMITS.MAX,
  );

  const hardwareStageCount =
    hasValidHardwareDpi && buf[17] >= 1 && buf[17] <= DPI_LIMITS.MAX_STAGES ? buf[17] : null;
  const hardwareDebounceMs =
    hasValidHardwareDpi && buf[18] <= DEBOUNCE_LIMITS.MAX_MS ? buf[18] : null;

  return {
    activeStage: activeStageZeroBased + 1, // 1..5
    activeStageIndex: activeStageZeroBased, // 0..4
    pollingRateCode,
    pollingRateHz: CODE_TO_POLLING_RATE[pollingRateCode] ?? null,
    hardwareDpiStages: hasValidHardwareDpi ? hardwareDpiStages : null,
    hardwareStageCount,
    hardwareDebounceMs,
    stateByte,
    rawPacket: buf,
  };
}

/**
 * Decodifica Input Reports assíncronos de 21 bytes (Report ID 0x54) lidos em LAB_00445380 (0x445380).
 */
export function decodeInputReport(rawBytes, mode = 'wireless') {
  const buf = Uint8Array.from(rawBytes ?? []);
  if (buf.length < 8 || buf[0] !== REPORT_ID.INPUT_EVENT) {
    return null;
  }

  const subOpcode = buf[1];

  // 0x54, 0xE2: Notificação assíncrona de status, bateria, troca de DPI e sleep/wake
  if (subOpcode === INPUT_OPCODE.STATUS_NOTIFICATION) {
    let powerState = 'online';
    if (buf[2] === 0x01 && buf[3] === 0x02) {
      powerState = 'sleep';
    } else if (buf[2] === 0x01 && buf[3] === 0x01) {
      powerState = 'wakeup';
    } else if (buf[2] === 0x00) {
      powerState = 'online';
    }

    const activeStageIndex = Math.min(4, buf[6]);
    const pollingRateCode = Math.min(2, buf[7]);
    const wirelessPercent = mode === 'wireless' ? Math.min(100, buf[5]) : null;
    const wiredIconLevel = mode === 'wired' ? buf[4] : null;

    return {
      type: 'status_notification',
      opcode: subOpcode,
      powerState,
      batteryPercent: wirelessPercent,
      batteryIconLevel:
        mode === 'wireless' ? batteryPercentToIconLevel(wirelessPercent) : wiredIconLevel,
      activeStage: activeStageIndex + 1,
      activeStageIndex,
      pollingRateCode,
      pollingRateHz: CODE_TO_POLLING_RATE[pollingRateCode] ?? null,
      rawPacket: buf,
    };
  }

  // 0x54, 0xE3: Resposta ao ping sem fio [0x51, 0x0C, 0x02]
  if (subOpcode === INPUT_OPCODE.WIRELESS_HANDSHAKE && buf.length >= 17) {
    const online = buf[2] === 0x00;
    const batteryPercent = online ? Math.min(100, buf[5]) : null;
    const fwChars = [];
    if (online) {
      for (let i = 8; i < 17; i += 1) {
        if (buf[i] >= 0x20 && buf[i] <= 0x7e) {
          fwChars.push(String.fromCharCode(buf[i]));
        }
      }
    }
    return {
      type: 'wireless_handshake',
      opcode: subOpcode,
      online,
      batteryPercent,
      batteryIconLevel: online ? batteryPercentToIconLevel(batteryPercent) : null,
      firmwareVersion: online ? fwChars.join('').trim() || null : null,
      rawPacket: buf,
    };
  }

  return {
    type: 'unknown_input_report',
    opcode: subOpcode,
    rawPacket: buf,
  };
}

/**
 * [0x51, 0x0B, 0x01, 0x01, 0x00...] (65 bytes / 0x41) — Restaura exclusivamente os 7 botões físicos
 * aos valores de fábrica no MCU sem alterar estágios de DPI ou sensor.
 * Referência: 0x447f3c em FUN_00447d60.
 */
export function encodeButtonResetPacket() {
  const packet = new Uint8Array(REPORT_LENGTH.FEATURE_KEYMAP);
  packet[0] = REPORT_ID.FEATURE_CONFIG;
  packet[1] = OPCODE.FACTORY_RESET;
  packet[2] = 0x01;
  packet[3] = 0x01;
  return packet;
}

/**
 * [0x52, 0x52, hwId, 0x00, 0x00, ...] (65 bytes) — Desativa um botão físico (1..7).
 * Referência: handler do botão UI "Disable" em 0x446b1c.
 */
export function encodeButtonDisablePacket(button) {
  const hwId = resolveButtonHardwareId(button);
  const packet = createKeymapPacket(KEYMAP_OPCODE.SET_BUTTON);
  packet[2] = hwId;
  packet[3] = 0x00;
  packet[4] = BUTTON_ACTION_CATEGORY.DISABLED;
  return packet;
}

/**
 * [0x52, 0x52, hwId, 0x00, category, ...] (65 bytes / 0x41) — Codifica o remapeamento de qualquer um
 * dos 7 botões físicos do Darmoshark N3 conforme FUN_00442e40 (0x442e40).
 *
 * Categorias suportadas em `actionConfig.category`:
 * - 'disable' / 'disabled'
 * - 'mouse'   ({ action: 'left-click' | 'right-click' | 'middle-click' | 'button-4' | 'button-5' | 'double-click' | 'scroll-up' | 'scroll-down' | 'scroll-left' | 'scroll-right' })
 * - 'combo'   ({ combo: 'cmd+c' } ou { modifiers: ['cmd'], keys: ['c'] })
 * - 'media'   ({ action: 'volume-up' | 'volume-down' | 'mute' | 'player' | 'play-pause' | 'prev-track' | 'next-track' | 'stop' })
 * - 'dpi'     ({ action: 'loop' | 'dpi-up' | 'dpi-down' })
 * - 'light'   ({ action: 'effect-switch' | 'speed-switch' | 'color-switch' | 'brightness-switch' })
 * - 'turbo'   ({ button: 'left' | 'right' | 'middle' | 'button-4' | 'button-5', intervalMs: 1..65535, repeatCount: 0..65535 })
 * - 'system'  ({ action: 'brightness-up' | 'brightness-down' | 'calculator' | 'my-computer' | 'browser-home' | 'mail' | 'refresh' | 'switch-apps' | 'copy' | 'cut' | 'paste' })
 */
export function encodeButtonMappingPacket(button, actionConfig = {}) {
  if (!actionConfig || typeof actionConfig !== 'object') {
    throw new TypeError('Informe um objeto de configuração válido para o botão.');
  }

  const hwId = resolveButtonHardwareId(button);
  const category = String(actionConfig.category ?? actionConfig.type ?? '')
    .trim()
    .toLowerCase();

  if (category === 'disable' || category === 'disabled' || category === 'off') {
    return encodeButtonDisablePacket(button);
  }

  const packet = createKeymapPacket(KEYMAP_OPCODE.SET_BUTTON);
  packet[2] = hwId;
  packet[3] = 0x00;

  if (category === 'mouse') {
    const { bytes } = resolveMouseAction(actionConfig.action);
    packet[4] = BUTTON_ACTION_CATEGORY.MOUSE;
    packet[5] = bytes[0];
    packet[6] = bytes[1];
    packet[7] = bytes[2];
    return packet;
  }

  if (category === 'combo' || category === 'key' || category === 'keyboard') {
    const comboSource = actionConfig.combo ?? actionConfig;
    const { modifierMask, keyCodes } = parseKeyCombo(comboSource);
    packet[4] = BUTTON_ACTION_CATEGORY.KEYBOARD_COMBO;
    packet[5] = modifierMask;
    packet[6] = keyCodes[0];
    packet[7] = keyCodes[1];
    return packet;
  }

  if (category === 'media' || category === 'multimedia') {
    const { bytes } = resolveMediaAction(actionConfig.action);
    packet[4] = BUTTON_ACTION_CATEGORY.MEDIA;
    packet[5] = bytes[0];
    packet[6] = bytes[1];
    return packet;
  }

  if (category === 'dpi' || category === 'sensitivity' || category === 'cpi') {
    const { code } = resolveDpiButtonAction(actionConfig.action);
    packet[4] = BUTTON_ACTION_CATEGORY.DPI;
    packet[5] = code;
    return packet;
  }

  if (category === 'light' || category === 'lighting') {
    const { code } = resolveLightButtonAction(actionConfig.action);
    packet[4] = BUTTON_ACTION_CATEGORY.LIGHT;
    packet[5] = code;
    return packet;
  }

  if (category === 'turbo' || category === 'fire') {
    const { mask } = resolveTurboMouseButton(actionConfig.button ?? actionConfig.action ?? 'left');
    const intervalMs = actionConfig.intervalMs ?? 20;
    const repeatCount = actionConfig.repeatCount ?? 0;

    if (!Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs > 65535) {
      throw new RangeError(
        `Intervalo de Turbo inválido (${intervalMs} ms). Use um inteiro entre 1 e 65535 ms.`,
      );
    }
    if (!Number.isInteger(repeatCount) || repeatCount < 0 || repeatCount > 65535) {
      throw new RangeError(
        `Contagem de repetição de Turbo inválida (${repeatCount}). Use 0 (contínuo enquanto segurar) ou 1..65535.`,
      );
    }

    packet[4] = BUTTON_ACTION_CATEGORY.TURBO;
    packet[5] = 0x01;
    packet[6] = mask;
    packet[7] = intervalMs & 0xff;
    packet[8] = (intervalMs >> 8) & 0xff;
    packet[9] = repeatCount & 0xff;
    packet[10] = (repeatCount >> 8) & 0xff;
    return packet;
  }

  if (category === 'system') {
    const { bytes } = resolveSystemShortcut(actionConfig.action);
    packet[4] = BUTTON_ACTION_CATEGORY.SYSTEM;
    packet[5] = bytes[0];
    packet[6] = bytes[1];
    packet[7] = bytes[2];
    return packet;
  }

  throw new RangeError(
    `Categoria de botão inválida ("${actionConfig.category}"). Use: disable, mouse, combo, media, dpi, light, turbo ou system.`,
  );
}

/**
 * [0x52, 0x55, hwId, hasMoreChunks, ...] (sequência paginada de 65 bytes / 0x41)
 * Codifica e vincula uma macro onboard a um botão físico (1..7) conforme FUN_00443fc0 (0x443fc0).
 *
 * - Até 13 eventos de 4 bytes por pacote (máx. 255 eventos totais).
 * - Chunk 0: offset 0x0000, cabeçalho de 6 bytes (0x01, loopWord_le, 0x0000, totalEventCount) + até 13 eventos.
 * - Chunk k >= 1: offset (k * 0x34 + 6) em uint16_le, tamanho (eventsInChunk * 4) + até 13 eventos.
 */
export function encodeMacroPackets({
  button,
  loopMode = 'count',
  loopCount = 1,
  events,
}) {
  const hwId = resolveButtonHardwareId(button);

  let rawEvents;
  if (
    Array.isArray(events) &&
    events.length > 0 &&
    Array.isArray(events[0]) &&
    events[0].length === 4
  ) {
    if (events.length > MACRO_LIMITS.MAX_EVENTS_TOTAL) {
      throw new RangeError(
        `Quantidade de eventos excede o limite de hardware (${events.length} > ${MACRO_LIMITS.MAX_EVENTS_TOTAL}).`,
      );
    }
    rawEvents = events.map((tuple, idx) => {
      if (
        !Array.isArray(tuple) ||
        tuple.length !== 4 ||
        !tuple.every((b) => Number.isInteger(b) && b >= 0 && b <= 0xff)
      ) {
        throw new TypeError(`Tupla de evento de macro inválida no índice ${idx}.`);
      }
      return tuple;
    });
  } else {
    rawEvents = normalizeMacroEvents(events);
  }

  const normalizedMode = String(loopMode ?? 'count').trim().toLowerCase();
  let loopWord;
  if (normalizedMode === 'hold' || normalizedMode === 'until-release') {
    loopWord = MACRO_LOOP_MODES.hold; // 0x2001 -> [0x01, 0x20]
  } else if (normalizedMode === 'toggle' || normalizedMode === 'until-any-key') {
    loopWord = MACRO_LOOP_MODES.toggle; // 0x4001 -> [0x01, 0x40]
  } else if (normalizedMode === 'count' || normalizedMode === 'repeat') {
    if (
      !Number.isInteger(loopCount) ||
      loopCount < 1 ||
      loopCount > MACRO_LIMITS.MAX_LOOP_COUNT
    ) {
      throw new RangeError(
        `loopCount inválido (${loopCount}). Informe um inteiro entre 1 e ${MACRO_LIMITS.MAX_LOOP_COUNT}.`,
      );
    }
    loopWord = loopCount;
  } else {
    throw new RangeError(
      `Modo de repetição de macro inválido ("${loopMode}"). Use "hold", "toggle" ou "count".`,
    );
  }

  const totalEvents = rawEvents.length;
  const chunkCount = Math.ceil(totalEvents / MACRO_LIMITS.EVENTS_PER_PACKET);
  const packets = [];

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const chunkEvents = rawEvents.slice(
      chunkIndex * MACRO_LIMITS.EVENTS_PER_PACKET,
      (chunkIndex + 1) * MACRO_LIMITS.EVENTS_PER_PACKET,
    );
    const pkt = createKeymapPacket(KEYMAP_OPCODE.UPLOAD_MACRO);
    pkt[2] = hwId;
    pkt[3] = chunkIndex < chunkCount - 1 ? 0x01 : 0x00;

    if (chunkIndex === 0) {
      pkt[4] = 0x00;
      pkt[5] = 0x00;
      pkt[6] = 6 + chunkEvents.length * 4; // 0x3A (58) quando 13 eventos
      pkt[7] = 0x01;
      pkt[8] = loopWord & 0xff;
      pkt[9] = (loopWord >> 8) & 0xff;
      pkt[10] = 0x00;
      pkt[11] = 0x00;
      pkt[12] = totalEvents;

      chunkEvents.forEach((ev, idx) => {
        const base = 13 + idx * 4;
        pkt[base] = ev[0];
        pkt[base + 1] = ev[1];
        pkt[base + 2] = ev[2];
        pkt[base + 3] = ev[3];
      });
    } else {
      const memOffset = chunkIndex * 0x34 + 6;
      pkt[4] = memOffset & 0xff;
      pkt[5] = (memOffset >> 8) & 0xff;
      pkt[6] = chunkEvents.length * 4;

      chunkEvents.forEach((ev, idx) => {
        const base = 7 + idx * 4;
        pkt[base] = ev[0];
        pkt[base + 1] = ev[1];
        pkt[base + 2] = ev[2];
        pkt[base + 3] = ev[3];
      });
    }

    packets.push(pkt);
  }

  return packets;
}
