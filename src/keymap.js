/**
 * Tabelas de mapeamento de botões físicos, códigos USB HID de teclado/mouse e macros onboard
 * do Darmoshark N3 (Report ID 0x52, 65 bytes), extraídas via engenharia reversa estática
 * (REA / Ghidra 12.1.4) de darmoshark.exe v1.0.7.2:
 * - FUN_00442e40 (0x442e40): codificador de botões (0x52, 0x52)
 * - FUN_00443fc0 (0x443fc0): codificador paginado de macros (0x52, 0x55)
 * - 0x446b1c: desativação de botão (0x52, 0x52, hwId, 0x00, 0x00...)
 * - 0x447f3c (FUN_00447d60): reset exclusivo de botões (0x51, 0x0B, 0x01, 0x01...)
 * - 0x4b7d80..0x4b8090 e FUN_00410660 (0x410660): tabelas estáticas de códigos HID
 */

/**
 * IDs de hardware enviados em buf[2] para os botões físicos 1..7 (tabela em 0x4b7de4).
 * ATENÇÃO (peculiaridade real do firmware): os botões 2 (Direito) e 3 (Meio) têm IDs invertidos!
 * Índice 0-based [0..6] -> [0x00, 0x02, 0x01, 0x03, 0x04, 0x05, 0x06].
 */
export const BUTTON_HW_IDS = Object.freeze([0x00, 0x02, 0x01, 0x03, 0x04, 0x05, 0x06]);

export const BUTTON_TARGETS = Object.freeze({
  1: Object.freeze({
    button: 1,
    index: 0,
    hwId: 0x00,
    id: 'left',
    label: 'Botão 1 (Clique Esquerdo)',
    defaultMapping: Object.freeze({ category: 'mouse', action: 'left-click' }),
  }),
  2: Object.freeze({
    button: 2,
    index: 1,
    hwId: 0x02,
    id: 'right',
    label: 'Botão 2 (Clique Direito)',
    defaultMapping: Object.freeze({ category: 'mouse', action: 'right-click' }),
  }),
  3: Object.freeze({
    button: 3,
    index: 2,
    hwId: 0x01,
    id: 'middle',
    label: 'Botão 3 (Clique do Meio / Scroll)',
    defaultMapping: Object.freeze({ category: 'mouse', action: 'middle-click' }),
  }),
  4: Object.freeze({
    button: 4,
    index: 3,
    hwId: 0x03,
    id: 'forward',
    label: 'Botão 4 (Lateral Avançar)',
    defaultMapping: Object.freeze({ category: 'mouse', action: 'button-4' }),
  }),
  5: Object.freeze({
    button: 5,
    index: 4,
    hwId: 0x04,
    id: 'back',
    label: 'Botão 5 (Lateral Voltar)',
    defaultMapping: Object.freeze({ category: 'mouse', action: 'button-5' }),
  }),
  6: Object.freeze({
    button: 6,
    index: 5,
    hwId: 0x05,
    id: 'dpi-up',
    label: 'Botão 6 (Inferior CPI+ / DPI+)',
    defaultMapping: Object.freeze({ category: 'dpi', action: 'dpi-up' }),
  }),
  7: Object.freeze({
    button: 7,
    index: 6,
    hwId: 0x06,
    id: 'dpi-down',
    label: 'Botão 7 (Inferior CPI- / DPI-)',
    defaultMapping: Object.freeze({ category: 'dpi', action: 'dpi-down' }),
  }),
});

export const DEFAULT_BUTTON_MAPPINGS = Object.freeze(
  Object.fromEntries(
    Object.values(BUTTON_TARGETS).map((item) => [item.button, item.defaultMapping]),
  ),
);

const BUTTON_NAME_ALIASES = Object.freeze({
  1: 1,
  left: 1,
  'left-button': 1,
  lmb: 1,
  2: 2,
  right: 2,
  'right-button': 2,
  rmb: 2,
  3: 3,
  middle: 3,
  'middle-button': 3,
  mmb: 3,
  wheel: 3,
  4: 4,
  forward: 4,
  'button-4': 4,
  btn4: 4,
  mouse4: 4,
  5: 5,
  back: 5,
  'button-5': 5,
  btn5: 5,
  mouse5: 5,
  6: 6,
  'dpi-up': 6,
  'dpi+': 6,
  'cpi-up': 6,
  'cpi+': 6,
  7: 7,
  'dpi-down': 7,
  'dpi-': 7,
  'cpi-down': 7,
  'cpi-': 7,
});

/**
 * Códigos de categoria gravados em buf[4] do pacote [0x52, 0x52, hwId, 0x00, category, ...].
 * Nota: O botão de UI "Disable" (0x446b1c) envia buf[4] = 0x00; em FUN_00442e40 param_2 == 8 também mapeia 0x09.
 */
export const BUTTON_ACTION_CATEGORY = Object.freeze({
  DISABLED: 0x00,
  MOUSE: 0x01,
  KEYBOARD_COMBO: 0x02,
  MEDIA: 0x03,
  DPI: 0x05,
  LIGHT: 0x06,
  TURBO: 0x07,
  SYSTEM: 0x08,
});

/**
 * Ações de mouse (buf[4] = 0x01, payload de 3 bytes em buf[5..7]) — tabela em 0x4b8058 + lang_en.ini [MouseKeyDlg].
 */
export const MOUSE_ACTIONS = Object.freeze({
  'left-click': Object.freeze([0x01, 0x00, 0x00]),
  'right-click': Object.freeze([0x02, 0x00, 0x00]),
  'middle-click': Object.freeze([0x04, 0x00, 0x00]),
  'button-4': Object.freeze([0x08, 0x00, 0x00]),
  'button-5': Object.freeze([0x10, 0x00, 0x00]),
  'double-click': Object.freeze([0x80, 0x00, 0x00]),
  'scroll-up': Object.freeze([0x00, 0x02, 0x00]),
  'scroll-down': Object.freeze([0x00, 0xfe, 0x00]),
  'scroll-left': Object.freeze([0x00, 0x00, 0xfe]),
  'scroll-right': Object.freeze([0x00, 0x00, 0x02]),
});

const MOUSE_ACTION_ALIASES = Object.freeze({
  left: 'left-click',
  lmb: 'left-click',
  right: 'right-click',
  rmb: 'right-click',
  middle: 'middle-click',
  mmb: 'middle-click',
  forward: 'button-4',
  btn4: 'button-4',
  mouse4: 'button-4',
  back: 'button-5',
  btn5: 'button-5',
  mouse5: 'button-5',
  double: 'double-click',
});

/**
 * Ações multimídia Consumer Control (buf[4] = 0x03, payload uint16_le em buf[5..6]) — tabela em 0x4b7d88.
 */
export const MEDIA_ACTIONS = Object.freeze({
  'volume-up': Object.freeze([0xe9, 0x00]),
  'volume-down': Object.freeze([0xea, 0x00]),
  mute: Object.freeze([0xe2, 0x00]),
  player: Object.freeze([0x83, 0x01]),
  'play-pause': Object.freeze([0xcd, 0x00]),
  'prev-track': Object.freeze([0xb6, 0x00]),
  'next-track': Object.freeze([0xb5, 0x00]),
  stop: Object.freeze([0xb7, 0x00]),
});

const MEDIA_ACTION_ALIASES = Object.freeze({
  'vol-up': 'volume-up',
  'vol+': 'volume-up',
  'vol-down': 'volume-down',
  'vol-': 'volume-down',
  'media-player': 'player',
  play: 'play-pause',
  pause: 'play-pause',
  prev: 'prev-track',
  previous: 'prev-track',
  next: 'next-track',
});

/**
 * Ações de sensibilidade / DPI (buf[4] = 0x05, payload em buf[5]) — tabela em 0x4b804c.
 */
export const DPI_BUTTON_ACTIONS = Object.freeze({
  loop: 0x01,
  'dpi-up': 0x02,
  'dpi-down': 0x03,
});

const DPI_ACTION_ALIASES = Object.freeze({
  'dpi-loop': 'loop',
  'cpi-loop': 'loop',
  cycle: 'loop',
  'dpi+': 'dpi-up',
  'cpi+': 'dpi-up',
  'cpi-up': 'dpi-up',
  up: 'dpi-up',
  'dpi-': 'dpi-down',
  'cpi-': 'dpi-down',
  'cpi-down': 'dpi-down',
  down: 'dpi-down',
});

/**
 * Ações de controle de iluminação (buf[4] = 0x06, payload em buf[5]) — tabela em 0x4b7e8c.
 */
export const LIGHT_BUTTON_ACTIONS = Object.freeze({
  'effect-switch': 0x01,
  'speed-switch': 0x02,
  'color-switch': 0x03,
  'brightness-switch': 0x04,
});

const LIGHT_ACTION_ALIASES = Object.freeze({
  mode: 'effect-switch',
  effect: 'effect-switch',
  speed: 'speed-switch',
  color: 'color-switch',
  brightness: 'brightness-switch',
});

/**
 * Atalhos de sistema OEM (buf[4] = 0x08, payload de 3 bytes em buf[5..7]) — tabela em 0x4b7e08.
 * Nota macOS: brightness-up e brightness-down usam Consumer Page 0x0C (0x006F/0x0070) e funcionam nativamente no Mac;
 * copy/cut/paste/switch-apps/refresh emitem atalhos Windows (Ctrl+C, Alt+Tab, F5) — no macOS prefira category='combo' (ex.: cmd+c).
 */
export const SYSTEM_SHORTCUTS = Object.freeze({
  'brightness-up': Object.freeze([0x0c, 0x6f, 0x00]),
  'brightness-down': Object.freeze([0x0c, 0x70, 0x00]),
  calculator: Object.freeze([0x0c, 0x92, 0x01]),
  'my-computer': Object.freeze([0x0c, 0x94, 0x01]),
  'browser-home': Object.freeze([0x0c, 0x23, 0x02]),
  mail: Object.freeze([0x0c, 0x8a, 0x01]),
  refresh: Object.freeze([0x07, 0x00, 0x3e]),
  'switch-apps': Object.freeze([0x07, 0x04, 0x2b]),
  copy: Object.freeze([0x07, 0x01, 0x06]),
  cut: Object.freeze([0x07, 0x01, 0x1b]),
  paste: Object.freeze([0x07, 0x01, 0x19]),
});

/**
 * Máscaras de botão de mouse para Turbo / Fire Key (buf[6] em 0x52,0x52 cat 0x07) e eventos de Macro (0x88/0x08) — tabela em 0x4b8038.
 */
export const TURBO_MOUSE_BUTTONS = Object.freeze({
  left: 0x01,
  right: 0x02,
  middle: 0x04,
  'button-4': 0x08,
  'button-5': 0x10,
});

const TURBO_BUTTON_ALIASES = Object.freeze({
  'left-click': 'left',
  lmb: 'left',
  'right-click': 'right',
  rmb: 'right',
  'middle-click': 'middle',
  mmb: 'middle',
  forward: 'button-4',
  btn4: 'button-4',
  mouse4: 'button-4',
  back: 'button-5',
  btn5: 'button-5',
  mouse5: 'button-5',
});

/**
 * Máscaras de modificadores USB HID para buf[5] na categoria KEYBOARD_COMBO (0x02).
 * Inclui aliases naturais do macOS (cmd -> Left GUI 0x08, opt -> Left Alt 0x04).
 */
export const MODIFIER_FLAGS = Object.freeze({
  ctrl: 0x01,
  control: 0x01,
  lctrl: 0x01,
  shift: 0x02,
  lshift: 0x02,
  alt: 0x04,
  opt: 0x04,
  option: 0x04,
  lalt: 0x04,
  lopt: 0x04,
  cmd: 0x08,
  command: 0x08,
  meta: 0x08,
  super: 0x08,
  win: 0x08,
  gui: 0x08,
  lcmd: 0x08,
  lwin: 0x08,
  rctrl: 0x10,
  rshift: 0x20,
  ralt: 0x40,
  ropt: 0x40,
  roption: 0x40,
  altgr: 0x40,
  rcmd: 0x80,
  rcommand: 0x80,
  rwin: 0x80,
  rmeta: 0x80,
});

/**
 * Tabela completa de códigos USB HID Usage Page 0x07 (98 entradas OEM de 0x4b7ea0 / FUN_00410660 + F13..F24 e aliases macOS).
 */
export const KEYBOARD_HID_CODES = Object.freeze({
  // Letras A..Z (0x04..0x1D)
  a: 0x04,
  b: 0x05,
  c: 0x06,
  d: 0x07,
  e: 0x08,
  f: 0x09,
  g: 0x0a,
  h: 0x0b,
  i: 0x0c,
  j: 0x0d,
  k: 0x0e,
  l: 0x0f,
  m: 0x10,
  n: 0x11,
  o: 0x12,
  p: 0x13,
  q: 0x14,
  r: 0x15,
  s: 0x16,
  t: 0x17,
  u: 0x18,
  v: 0x19,
  w: 0x1a,
  x: 0x1b,
  y: 0x1c,
  z: 0x1d,

  // Linha numérica superior 1..9, 0 (0x1E..0x27)
  1: 0x1e,
  2: 0x1f,
  3: 0x20,
  4: 0x21,
  5: 0x22,
  6: 0x23,
  7: 0x24,
  8: 0x25,
  9: 0x26,
  0: 0x27,

  // Controle de edição e pontuação
  enter: 0x28,
  return: 0x28,
  esc: 0x29,
  escape: 0x29,
  backspace: 0x2a,
  bksp: 0x2a,
  tab: 0x2b,
  space: 0x2c,
  spacebar: 0x2c,
  '-': 0x2d,
  minus: 0x2d,
  hyphen: 0x2d,
  '=': 0x2e,
  equal: 0x2e,
  equals: 0x2e,
  plus: 0x2e,
  '[': 0x2f,
  lbracket: 0x2f,
  leftbracket: 0x2f,
  ']': 0x30,
  rbracket: 0x30,
  rightbracket: 0x30,
  '\\': 0x31,
  '|': 0x31,
  backslash: 0x31,
  pipe: 0x31,
  ';': 0x33,
  semicolon: 0x33,
  "'": 0x34,
  quote: 0x34,
  apostrophe: 0x34,
  '`': 0x35,
  '~': 0x35,
  grave: 0x35,
  backtick: 0x35,
  tilde: 0x35,
  ',': 0x36,
  '<': 0x36,
  comma: 0x36,
  '.': 0x37,
  '>': 0x37,
  period: 0x37,
  dot: 0x37,
  '/': 0x38,
  '?': 0x38,
  slash: 0x38,
  capslock: 0x39,
  caps: 0x39,

  // Teclas de função F1..F12 (0x3A..0x45) + F13..F24 (0x68..0x73, úteis no macOS)
  f1: 0x3a,
  f2: 0x3b,
  f3: 0x3c,
  f4: 0x3d,
  f5: 0x3e,
  f6: 0x3f,
  f7: 0x40,
  f8: 0x41,
  f9: 0x42,
  f10: 0x43,
  f11: 0x44,
  f12: 0x45,
  f13: 0x68,
  f14: 0x69,
  f15: 0x6a,
  f16: 0x6b,
  f17: 0x6c,
  f18: 0x6d,
  f19: 0x6e,
  f20: 0x6f,
  f21: 0x70,
  f22: 0x71,
  f23: 0x72,
  f24: 0x73,

  // Navegação e sistema
  printscreen: 0x46,
  prtsc: 0x46,
  scroll: 0x47,
  scrolllock: 0x47,
  pause: 0x48,
  break: 0x48,
  insert: 0x49,
  ins: 0x49,
  home: 0x4a,
  pgup: 0x4b,
  pageup: 0x4b,
  del: 0x4c,
  delete: 0x4c,
  forwarddelete: 0x4c,
  end: 0x4d,
  pgdn: 0x4e,
  pagedown: 0x4e,
  right: 0x4f,
  arrowright: 0x4f,
  left: 0x50,
  arrowleft: 0x50,
  down: 0x51,
  arrowdown: 0x51,
  up: 0x52,
  arrowup: 0x52,

  // Teclado numérico (Numpad — 0x53..0x63)
  numl: 0x53,
  numlock: 0x53,
  'num/': 0x54,
  numdivide: 0x54,
  'num*': 0x55,
  nummultiply: 0x55,
  'num-': 0x56,
  numminus: 0x56,
  'num+': 0x57,
  numplus: 0x57,
  numenter: 0x58,
  num1: 0x59,
  num2: 0x5a,
  num3: 0x5b,
  num4: 0x5c,
  num5: 0x5d,
  num6: 0x5e,
  num7: 0x5f,
  num8: 0x60,
  num9: 0x61,
  num0: 0x62,
  numdel: 0x63,
  'num.': 0x63,
  numdot: 0x63,

  // Modificadores como teclas HID individuais (0xE0..0xE7, usados em eventos de Macro)
  lctrl: 0xe0,
  ctrl: 0xe0,
  control: 0xe0,
  lshift: 0xe1,
  shift: 0xe1,
  lalt: 0xe2,
  alt: 0xe2,
  lopt: 0xe2,
  opt: 0xe2,
  option: 0xe2,
  lwin: 0xe3,
  win: 0xe3,
  lcmd: 0xe3,
  cmd: 0xe3,
  command: 0xe3,
  meta: 0xe3,
  super: 0xe3,
  gui: 0xe3,
  rctrl: 0xe4,
  rshift: 0xe5,
  ralt: 0xe6,
  ropt: 0xe6,
  roption: 0xe6,
  altgr: 0xe6,
  rwin: 0xe7,
  rcmd: 0xe7,
  rcommand: 0xe7,
  rmeta: 0xe7,
});

/**
 * Modos de repetição de macro em buf[8..9] (uint16_le) de FUN_00443fc0 (0x443fc0).
 */
export const MACRO_LOOP_MODES = Object.freeze({
  hold: 0x2001, // Repetir enquanto o botão estiver pressionado (0x01, 0x20)
  toggle: 0x4001, // Repetir até que qualquer tecla/botão seja pressionado (0x01, 0x40)
  count: null, // Repetir N vezes (loopCount em uint16_le)
});

export const MACRO_LIMITS = Object.freeze({
  MAX_EVENTS_TOTAL: 255, // buf[12] uint8
  EVENTS_PER_PACKET: 13, // 13 * 4 bytes = 52 bytes por pacote de 65B
  MAX_LOOP_COUNT: 65535,
  MAX_DELAY_MS: 65535,
});

/**
 * Resolve o número do botão físico (1..7) a partir de número ou apelido.
 */
export function resolveButtonNumber(buttonInput) {
  if (Number.isInteger(buttonInput) && buttonInput >= 1 && buttonInput <= 7) {
    return buttonInput;
  }
  const key = String(buttonInput ?? '').trim().toLowerCase();
  if (Object.hasOwn(BUTTON_NAME_ALIASES, key)) {
    return BUTTON_NAME_ALIASES[key];
  }
  throw new RangeError(
    `Botão físico inválido ("${buttonInput}"). Informe um número de 1 a 7 (1=Left, 2=Right, 3=Middle, 4=Avançar, 5=Voltar, 6=CPI+, 7=CPI-).`,
  );
}

/**
 * Retorna o ID de hardware (buf[2]) correspondente ao botão físico (1..7),
 * respeitando a inversão de hardware entre o Botão 2 (0x02) e o Botão 3 (0x01).
 */
export function resolveButtonHardwareId(buttonInput) {
  const buttonNumber = resolveButtonNumber(buttonInput);
  return BUTTON_HW_IDS[buttonNumber - 1];
}

export function resolveMouseAction(action) {
  const raw = String(action ?? '').trim().toLowerCase();
  const canonical = MOUSE_ACTION_ALIASES[raw] ?? raw;
  if (!Object.hasOwn(MOUSE_ACTIONS, canonical)) {
    throw new RangeError(
      `Ação de mouse inválida ("${action}"). Valores suportados: ${Object.keys(MOUSE_ACTIONS).join(', ')}.`,
    );
  }
  return { canonical, bytes: MOUSE_ACTIONS[canonical] };
}

export function resolveMediaAction(action) {
  const raw = String(action ?? '').trim().toLowerCase();
  const canonical = MEDIA_ACTION_ALIASES[raw] ?? raw;
  if (!Object.hasOwn(MEDIA_ACTIONS, canonical)) {
    throw new RangeError(
      `Ação multimídia inválida ("${action}"). Valores suportados: ${Object.keys(MEDIA_ACTIONS).join(', ')}.`,
    );
  }
  return { canonical, bytes: MEDIA_ACTIONS[canonical] };
}

export function resolveDpiButtonAction(action) {
  const raw = String(action ?? '').trim().toLowerCase();
  const canonical = DPI_ACTION_ALIASES[raw] ?? raw;
  if (!Object.hasOwn(DPI_BUTTON_ACTIONS, canonical)) {
    throw new RangeError(
      `Ação de DPI inválida ("${action}"). Valores suportados: ${Object.keys(DPI_BUTTON_ACTIONS).join(', ')}.`,
    );
  }
  return { canonical, code: DPI_BUTTON_ACTIONS[canonical] };
}

export function resolveLightButtonAction(action) {
  const raw = String(action ?? '').trim().toLowerCase();
  const canonical = LIGHT_ACTION_ALIASES[raw] ?? raw;
  if (!Object.hasOwn(LIGHT_BUTTON_ACTIONS, canonical)) {
    throw new RangeError(
      `Ação de iluminação inválida ("${action}"). Valores suportados: ${Object.keys(LIGHT_BUTTON_ACTIONS).join(', ')}.`,
    );
  }
  return { canonical, code: LIGHT_BUTTON_ACTIONS[canonical] };
}

export function resolveSystemShortcut(action) {
  const canonical = String(action ?? '').trim().toLowerCase();
  if (!Object.hasOwn(SYSTEM_SHORTCUTS, canonical)) {
    throw new RangeError(
      `Atalho de sistema inválido ("${action}"). Valores suportados: ${Object.keys(SYSTEM_SHORTCUTS).join(', ')}.`,
    );
  }
  return { canonical, bytes: SYSTEM_SHORTCUTS[canonical] };
}

export function resolveTurboMouseButton(buttonName) {
  const raw = String(buttonName ?? '').trim().toLowerCase();
  const canonical = TURBO_BUTTON_ALIASES[raw] ?? raw;
  if (!Object.hasOwn(TURBO_MOUSE_BUTTONS, canonical)) {
    throw new RangeError(
      `Botão alvo de Turbo inválido ("${buttonName}"). Valores suportados: ${Object.keys(TURBO_MOUSE_BUTTONS).join(', ')}.`,
    );
  }
  return { canonical, mask: TURBO_MOUSE_BUTTONS[canonical] };
}

/**
 * Resolve o código USB HID Usage (0x04..0xE7) de uma tecla pelo nome ou inteiro direto.
 */
export function resolveKeyHidCode(keyInput) {
  if (Number.isInteger(keyInput) && keyInput >= 0x04 && keyInput <= 0xe7) {
    return keyInput;
  }
  const normalized = String(keyInput ?? '').trim().toLowerCase();
  if (normalized === '+') {
    return KEYBOARD_HID_CODES.plus;
  }
  if (Object.hasOwn(KEYBOARD_HID_CODES, normalized)) {
    return KEYBOARD_HID_CODES[normalized];
  }
  throw new RangeError(`Tecla desconhecida ("${keyInput}").`);
}

function splitComboTokens(comboText) {
  const trimmed = String(comboText ?? '').trim();
  if (!trimmed) {
    throw new RangeError('Atalho de teclado vazio.');
  }
  if (trimmed === '+') {
    return ['plus'];
  }
  // Protege "num+" e "+" final (ex.: "cmd++") antes de dividir pelo separador "+"
  const safe = trimmed
    .replace(/num\+/gi, 'numplus')
    .replace(/\+\+$/g, '+plus');
  return safe
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Analisa uma tecla ou combinação de atalho (ex.: "cmd+c", "cmd+shift+4", "f13", ou objeto estruturado)
 * produzindo { modifierMask, keyCodes: [k1, k2] } para os bytes buf[5..7] de FUN_00442e40 (cat 0x02).
 */
export function parseKeyCombo(comboInput) {
  if (comboInput && typeof comboInput === 'object' && !Array.isArray(comboInput)) {
    if (Number.isInteger(comboInput.modifierMask) || Array.isArray(comboInput.keyCodes)) {
      const modifierMask = comboInput.modifierMask ?? 0;
      if (!Number.isInteger(modifierMask) || modifierMask < 0 || modifierMask > 0xff) {
        throw new RangeError(`modifierMask inválido (${modifierMask}). Use 0..255.`);
      }
      const rawCodes = comboInput.keyCodes ?? [];
      if (rawCodes.length > 2) {
        throw new RangeError('Combinações de botão suportam no máximo 2 teclas comuns simultâneas além dos modificadores.');
      }
      const keyCodes = rawCodes.map((k) => resolveKeyHidCode(k));
      if (modifierMask === 0 && keyCodes.length === 0) {
        throw new RangeError('Informe ao menos um modificador ou uma tecla para o atalho.');
      }
      return {
        modifierMask,
        keyCodes: [keyCodes[0] ?? 0x00, keyCodes[1] ?? 0x00],
      };
    }

    const modifiers = Array.isArray(comboInput.modifiers) ? comboInput.modifiers : [];
    const keys = Array.isArray(comboInput.keys)
      ? comboInput.keys
      : comboInput.key !== undefined
        ? [comboInput.key]
        : [];
    let modifierMask = 0;
    for (const mod of modifiers) {
      const modKey = String(mod).trim().toLowerCase();
      if (!Object.hasOwn(MODIFIER_FLAGS, modKey)) {
        throw new RangeError(`Modificador inválido ("${mod}"). Use cmd, ctrl, opt/alt ou shift.`);
      }
      modifierMask |= MODIFIER_FLAGS[modKey];
    }
    if (keys.length > 2) {
      throw new RangeError('O hardware suporta até 2 teclas não modificadoras simultâneas por atalho (use macro para sequências maiores).');
    }
    const resolvedKeys = keys.map((k) => resolveKeyHidCode(k));
    if (modifierMask === 0 && resolvedKeys.length === 0) {
      throw new RangeError('Informe ao menos um modificador ou uma tecla para o atalho.');
    }
    return {
      modifierMask,
      keyCodes: [resolvedKeys[0] ?? 0x00, resolvedKeys[1] ?? 0x00],
    };
  }

  const tokens = splitComboTokens(comboInput);
  let modifierMask = 0;
  const resolvedKeys = [];

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (Object.hasOwn(MODIFIER_FLAGS, lower)) {
      modifierMask |= MODIFIER_FLAGS[lower];
    } else {
      resolvedKeys.push(resolveKeyHidCode(lower));
    }
  }

  if (resolvedKeys.length > 2) {
    throw new RangeError(
      `O atalho "${comboInput}" contém ${resolvedKeys.length} teclas comuns; o protocolo 0x52 suporta modificadores livres + até 2 teclas simultâneas (use macro para sequências maiores).`,
    );
  }

  if (modifierMask === 0 && resolvedKeys.length === 0) {
    throw new RangeError(`Atalho inválido ("${comboInput}").`);
  }

  return {
    modifierMask,
    keyCodes: [resolvedKeys[0] ?? 0x00, resolvedKeys[1] ?? 0x00],
  };
}

/**
 * Verifica se um mapa de botões ({ 1: {...}, ..., 7: {...} }) preserva ao menos um botão como Clique Esquerdo.
 */
export function hasLeftClickAssigned(buttonsMap = DEFAULT_BUTTON_MAPPINGS) {
  for (let btn = 1; btn <= 7; btn += 1) {
    const entry = buttonsMap[btn] ?? buttonsMap[String(btn)] ?? DEFAULT_BUTTON_MAPPINGS[btn];
    if (!entry) continue;
    const cat = String(entry.category ?? entry.type ?? '').toLowerCase();
    if (cat === 'mouse') {
      try {
        const { canonical } = resolveMouseAction(entry.action);
        if (canonical === 'left-click') {
          return true;
        }
      } catch {
        // Ignora entrada inválida durante varredura
      }
    }
  }
  return false;
}

/**
 * Converte uma lista de passos de macro (eventos brutos OEM ou atalhos de alto nível como 'tap'/'click')
 * em registros de 4 bytes [e0, e1, e2, e3] prontos para FUN_00443fc0 (0x52, 0x55).
 *
 * Tipos de passo aceitos:
 * - { type: 'key-down', key: 'a' }          -> [0x00, 0x81, hidKeyCode, 0x00]
 * - { type: 'key-up', key: 'a' }            -> [0x00, 0x01, hidKeyCode, 0x00]
 * - { type: 'mouse-down', button: 'left' }  -> [0x00, 0x88, mouseMask, 0x00]
 * - { type: 'mouse-up', button: 'left' }    -> [0x00, 0x08, mouseMask, 0x00]
 * - { type: 'delay', ms: 50 }               -> [0x00, 0x0F, ms_lo, ms_hi]
 * - { type: 'move', dx: -10, dy: 5 }        -> [0x00, 0x09, dx_int8, dy_int8]
 * - { type: 'tap', combo: 'cmd+c', holdMs: 15, afterDelayMs: 15 } (atalho ergonômico)
 * - { type: 'click', button: 'left', holdMs: 15, afterDelayMs: 15 } (atalho ergonômico)
 */
export function normalizeMacroEvents(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new RangeError('A macro precisa conter ao menos 1 evento.');
  }

  const rawEvents = [];

  const pushDelay = (ms) => {
    if (ms === undefined || ms === null || ms === 0) return;
    if (!Number.isInteger(ms) || ms < 1 || ms > MACRO_LIMITS.MAX_DELAY_MS) {
      throw new RangeError(
        `Delay de macro inválido (${ms} ms). Use um inteiro entre 1 e ${MACRO_LIMITS.MAX_DELAY_MS} ms.`,
      );
    }
    rawEvents.push([0x00, 0x0f, ms & 0xff, (ms >> 8) & 0xff]);
  };

  for (const step of steps) {
    if (!step || typeof step !== 'object') {
      throw new TypeError('Cada passo da macro deve ser um objeto.');
    }

    const type = String(step.type ?? '').trim().toLowerCase();

    if (type === 'key-down' || type === 'keydown') {
      const code = resolveKeyHidCode(step.key ?? step.keyCode);
      rawEvents.push([0x00, 0x81, code, 0x00]);
      continue;
    }

    if (type === 'key-up' || type === 'keyup') {
      const code = resolveKeyHidCode(step.key ?? step.keyCode);
      rawEvents.push([0x00, 0x01, code, 0x00]);
      continue;
    }

    if (type === 'mouse-down' || type === 'mousedown') {
      const { mask } = resolveTurboMouseButton(step.button);
      rawEvents.push([0x00, 0x88, mask, 0x00]);
      continue;
    }

    if (type === 'mouse-up' || type === 'mouseup') {
      const { mask } = resolveTurboMouseButton(step.button);
      rawEvents.push([0x00, 0x08, mask, 0x00]);
      continue;
    }

    if (type === 'delay' || type === 'wait' || type === 'sleep') {
      const ms = step.ms ?? step.delayMs;
      if (!Number.isInteger(ms) || ms < 1 || ms > MACRO_LIMITS.MAX_DELAY_MS) {
        throw new RangeError(
          `Delay de macro inválido (${ms} ms). Use um inteiro entre 1 e ${MACRO_LIMITS.MAX_DELAY_MS} ms.`,
        );
      }
      pushDelay(ms);
      continue;
    }

    if (type === 'move' || type === 'mouse-move') {
      const dx = Number(step.dx ?? 0);
      const dy = Number(step.dy ?? 0);
      if (!Number.isInteger(dx) || dx < -128 || dx > 127 || !Number.isInteger(dy) || dy < -128 || dy > 127) {
        throw new RangeError(
          `Deslocamento de cursor inválido em macro (dx=${step.dx}, dy=${step.dy}). Use inteiros int8 entre -128 e 127.`,
        );
      }
      rawEvents.push([0x00, 0x09, dx & 0xff, dy & 0xff]);
      continue;
    }

    if (type === 'tap' || type === 'key-tap') {
      const tokens = step.combo
        ? splitComboTokens(step.combo)
        : [
            ...(Array.isArray(step.modifiers) ? step.modifiers : []),
            ...(step.key !== undefined ? [step.key] : []),
          ];
      const codes = tokens.map((t) => resolveKeyHidCode(t));
      for (const code of codes) {
        rawEvents.push([0x00, 0x81, code, 0x00]);
      }
      pushDelay(step.holdMs);
      for (let i = codes.length - 1; i >= 0; i -= 1) {
        rawEvents.push([0x00, 0x01, codes[i], 0x00]);
      }
      pushDelay(step.afterDelayMs ?? step.delayMs);
      continue;
    }

    if (type === 'click' || type === 'mouse-click') {
      const { mask } = resolveTurboMouseButton(step.button ?? 'left');
      rawEvents.push([0x00, 0x88, mask, 0x00]);
      pushDelay(step.holdMs);
      rawEvents.push([0x00, 0x08, mask, 0x00]);
      pushDelay(step.afterDelayMs ?? step.delayMs);
      continue;
    }

    throw new RangeError(
      `Tipo de evento de macro desconhecido ("${step.type}"). Use key-down, key-up, mouse-down, mouse-up, delay, move, tap ou click.`,
    );
  }

  if (rawEvents.length < 1 || rawEvents.length > MACRO_LIMITS.MAX_EVENTS_TOTAL) {
    throw new RangeError(
      `Quantidade total de eventos da macro fora do limite suportado pelo hardware (${rawEvents.length}). Máximo: ${MACRO_LIMITS.MAX_EVENTS_TOTAL} eventos de 4 bytes.`,
    );
  }

  return rawEvents;
}

/**
 * Converte uma expressão compacta de CLI (ex.: "cmd+c,delay:40,cmd+v") em passos para normalizeMacroEvents().
 */
export function parseMacroSequenceString(sequenceText, defaultHoldMs = 15) {
  const parts = String(sequenceText ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new RangeError('Sequência de macro vazia.');
  }

  return parts.map((part) => {
    const delayMatch = /^(?:delay|wait|sleep):(\d+)$/i.exec(part);
    if (delayMatch) {
      return { type: 'delay', ms: Number(delayMatch[1]) };
    }

    const clickMatch = /^click:(left|right|middle|button-4|button-5|forward|back)$/i.exec(part);
    if (clickMatch) {
      return { type: 'click', button: clickMatch[1].toLowerCase(), holdMs: defaultHoldMs };
    }

    const moveMatch = /^move:(-?\d+):(-?\d+)$/i.exec(part);
    if (moveMatch) {
      return { type: 'move', dx: Number(moveMatch[1]), dy: Number(moveMatch[2]) };
    }

    return { type: 'tap', combo: part, holdMs: defaultHoldMs };
  });
}
