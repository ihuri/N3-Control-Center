export const STAGE_COLORS = ['#F10900', '#056BE2', '#09F148', '#B606FA', '#ECF11D'];

export const POLLING_RATES = [
  { hz: 125, color: '#ff1100' },
  { hz: 500, color: '#0055ff' },
  { hz: 1000, color: '#00ee22' },
];

export const I18N = {
  pt: {
    appTitle: 'Darmoshark N3 • macOS',
    connectedWired: 'USB Com Fio',
    connectedWireless: '2.4GHz Online',
    wirelessSleep: '2.4GHz Repouso',
    disconnected: 'Desconectado',
    pendingWake: 'Sincronizará ao acordar',
    connAuto: 'Auto',
    connWired: 'Cabo',
    connWireless: '2.4G',
    fwLabel: 'Versão do Firmware:',
    resetDefault: 'Restaurar Padrão',
    resetConfirmTitle: 'Restaurar Padrões de Fábrica?',
    resetConfirmBody:
      'Isso restaurará DPI (400..4800), Polling Rate (500Hz), Debounce (8ms), Sensor PAW3395 e os 7 botões no perfil ativo e no mouse.',
    cancel: 'Cancelar',
    confirmReset: 'Restaurar Tudo',
    profileNew: '+ Novo Perfil',
    profileRename: 'Renomear Perfil',
    profileDelete: 'Excluir Perfil',
    profileImport: 'Importar JSON...',
    profileExport: 'Exportar JSON...',
    profilePromptNew: 'Nome do novo perfil:',
    profilePromptRename: 'Novo nome para o perfil:',
    btnWord: 'Botão',
    stageWord: 'Estágio',

    // Navegação lateral
    navKey: 'Botões & Debounce',
    navPtr: 'Ponteiro, DPI & Report Rate',
    navMac: 'Editor de Macros',
    navSys: 'Sistema, LOD & Sensor PAW3395',
    navOsx: 'Menu Bar Híbrida & Automações macOS',

    // Aba 1: Botões & Debounce
    keyTitle: 'Configuração de Botões do Mouse',
    btnFunc: 'Função dos Botões',
    resetButtons: 'Resetar Botões',
    debounce: 'Resposta de Clique',
    catLabel: 'Categoria de Ação',
    cats: {
      mouse: 'Função de Mouse',
      combo: 'Atalho Teclado / macOS',
      media: 'Multimídia',
      dpi: 'Sensibilidade (DPI)',
      turbo: ' Botão Turbo (Fire)',
      system: 'Sistema / Brilho',
      macro: 'Macro Onboard',
      disable: 'Desativar Botão',
    },
    mouseActions: {
      'left-click': 'Clique Esquerdo',
      'right-click': 'Clique Direito',
      'middle-click': 'Clique do Meio (Scroll)',
      'button-4': 'Avançar (Botão 4)',
      'button-5': 'Voltar (Botão 5)',
      'double-click': 'Duplo Clique',
      'scroll-up': 'Rolar p/ Cima',
      'scroll-down': 'Rolar p/ Baixo',
      'scroll-left': 'Rolar p/ Esquerda',
      'scroll-right': 'Rolar p/ Direita',
    },
    mediaActions: {
      'play-pause': 'Play / Pause',
      'volume-up': 'Aumentar Volume',
      'volume-down': 'Diminuir Volume',
      mute: 'Mudo (Mute)',
      'next-track': 'Próxima Faixa',
      'prev-track': 'Faixa Anterior',
      stop: 'Parar (Stop)',
      player: 'Abrir Player',
    },
    dpiActions: {
      loop: 'Ciclo de DPI (Loop)',
      'dpi-up': 'CPI+ (Aumentar DPI)',
      'dpi-down': 'CPI- (Diminuir DPI)',
    },
    systemActions: {
      'brightness-up': 'Aumentar Brilho da Tela (Mac)',
      'brightness-down': 'Diminuir Brilho da Tela (Mac)',
      calculator: 'Calculadora',
      'browser-home': 'Página Inicial do Navegador',
      mail: 'Abrir E-mail',
      refresh: 'Atualizar (F5)',
    },
    comboRecordIdle: 'Gravar Atalho no Teclado',
    comboRecording: 'Pressione as teclas... (ESC cancela)',
    comboInputPlaceholder: 'Ex.: cmd+c, cmd+shift+4, f13',
    comboPresetsTitle: 'Atalhos Rápidos macOS',
    applyShortcut: 'Aplicar Atalho',
    turboTarget: 'Botão Alvo',
    turboInterval: 'Intervalo (ms)',
    turboRepeat: 'Repetições (0 = segurar)',
    applyTurbo: 'Aplicar Turbo',
    selectMacro: 'Selecionar Macro Salva',
    bindMacroBtn: 'Gravar Macro no Botão',
    noMacrosYet: 'Nenhuma macro criada ainda. Use a aba Macros.',
    disableBtnAction: 'Desativar Este Botão',
    disabledLabel: 'Desativado',
    leftClickGuardError:
      'Proteção ativa: mantenha ao menos outro botão como Clique Esquerdo antes de alterar o Botão 1.',

    // Aba 2: Ponteiro, DPI & Report Rate
    ptrTitle: 'Configuração de Ponteiro',
    numStages: 'Nº de Estágios DPI',
    dpiFineInput: 'Valor Exato (passo 50):',
    applyDpi: 'Aplicar',
    reportRate: 'Report Rate (Polling)',
    ecoOverrideNote: 'Auto-Eco ativo no momento',

    // Aba 3: Macros
    macTitle: 'Editor de Definição de Macros',
    macName: 'Nome da Macro',
    newMacro: 'Nova',
    deleteMacro: 'Excluir',
    saveMacro: 'Salvar Macro',
    evtList: 'Lista de Eventos',
    startRec: 'Iniciar Gravação',
    stopRec: 'Parar Gravação',
    clearEvents: 'Limpar',
    deleteEvent: 'Excluir Item',
    addDelayBtn: '+ Delay',
    delaySet: 'Configuração de Delay',
    delayRecord: 'Tempo Real Gravado',
    delayUniform: 'Delay Fixo (ms)',
    delayNone: 'Sem Delay (mín. 2ms)',
    loopSet: 'Modo de Repetição',
    loopHold: 'Enquanto segurar botão',
    loopToggle: 'Repetir até clicar novamente',
    loopCount: 'Repetir N vezes:',
    quickBindLabel: 'Vincular direto ao botão:',
    quickBindBtn: 'Enviar p/ Mouse',
    recHint: 'Gravando teclado e cliques na área da lista...',

    // Aba 4: Sistema & Sensor PAW3395
    sysTitle: 'Configurações de Sistema',
    lodTitle: 'Altura do LOD (Lift-Off Distance)',
    lodLow: 'Low (~1.0 mm)',
    lodHigh: 'High (~2.0 mm)',
    sensorTitle: 'Performance do Sensor (PAW3395)',
    sensorHelpText:
      'Motion Sync sincroniza os quadros do sensor PixArt PAW3395 com os pulsos USB para rastreio mais preciso. Angle Snap retifica movimentos horizontais/verticais. Ripple Control suaviza oscilações acima de 9000 DPI.',
    mouseProps: 'Propriedades do Mouse (macOS)',
    openMacMouse: 'Abrir Ajustes de Mouse do macOS',

    // Aba 5: Menu Bar Híbrida & Automações macOS
    osxTitle: 'Menu Bar Híbrida & Automações macOS',
    menubarBoxTitle: 'Menu Bar Híbrida & Hidden Bar',
    showBatPct: 'Exibir % da Bateria na barra',
    showDpiVal: 'Exibir DPI atual na barra',
    hideBatFull: 'Ocultar % quando 100% ou no cabo',
    docklessMode: 'Modo Dockless (ocultar do Dock ao fechar janela)',
    launchLogin: 'Iniciar automaticamente no Login do macOS',
    menubarHint:
      'Modo Híbrido ativo: Clique Esquerdo no ícone abre o Mini Control Center; Clique Direito (ou Ctrl+Clique) abre o menu nativo NSMenu.',
    autoBoxTitle: 'Automações Inteligentes',
    autoEcoToggle: 'Auto-Eco: reduzir Polling Rate na bateria baixa / Pouca Energia',
    autoEcoThreshold: 'Gatilho Bateria ≤',
    autoEcoRate: 'Taxa Eco:',
    autoEcoMacPower: 'Sincronizar c/ Modo Pouca Energia do macOS',
    dpiHudToggle: 'Exibir HUD na tela ao trocar DPI pelos botões físicos (0x54)',
    lowBatToggle: 'Notificação nativa do macOS em 20% e 10% de bateria',
    appProfilesTitle: 'Perfis Automáticos por Aplicativo em Foco',
    appProfilesEnable: 'Trocar perfil automaticamente conforme o app ativo',
    addAppRule: '+ Adicionar Regra',
    pickInstalledApp: 'Escolher app instalado...',
    appMatchPlaceholder: 'Nome ou Bundle ID (ex.: cs2, Blender)',
    removeRule: 'Remover',

    // Popover & HUD
    popoverOpenMain: 'Abrir Painel Completo',
    popoverQuit: 'Sair',
    popoverRefresh: 'Atualizar Telemetria',
    popoverProfile: 'Perfil Ativo',
    popoverQuickToggles: 'Ajustes Rápidos',
  },

  en: {
    appTitle: 'Darmoshark N3 • macOS',
    connectedWired: 'USB Wired',
    connectedWireless: '2.4GHz Online',
    wirelessSleep: '2.4GHz Sleeping',
    disconnected: 'Disconnected',
    pendingWake: 'Will sync on wake',
    connAuto: 'Auto',
    connWired: 'Wired',
    connWireless: '2.4G',
    fwLabel: 'FW Version:',
    resetDefault: 'Recovery Default',
    resetConfirmTitle: 'Restore Factory Defaults?',
    resetConfirmBody:
      'This will restore DPI (400..4800), Polling Rate (500Hz), Debounce (8ms), PAW3395 Sensor, and all 7 buttons on the active profile and mouse.',
    cancel: 'Cancel',
    confirmReset: 'Restore All',
    profileNew: '+ New Profile',
    profileRename: 'Rename Profile',
    profileDelete: 'Delete Profile',
    profileImport: 'Import JSON...',
    profileExport: 'Export JSON...',
    profilePromptNew: 'New profile name:',
    profilePromptRename: 'Rename profile to:',
    btnWord: 'Button',
    stageWord: 'Stage',

    navKey: 'Mouse Button & Debounce',
    navPtr: 'Pointer, DPI & Report Rate',
    navMac: 'Macro Definition Editor',
    navSys: 'System, LOD & PAW3395 Sensor',
    navOsx: 'macOS Menu Bar & Automations',

    keyTitle: 'Mouse Button Setting',
    btnFunc: 'Button Function',
    resetButtons: 'Reset Buttons',
    debounce: 'Keypress Response',
    catLabel: 'Action Category',
    cats: {
      mouse: 'Mouse Function',
      combo: 'Keyboard / macOS Shortcut',
      media: 'Multimedia',
      dpi: 'Sensitivity (DPI)',
      turbo: 'Fire / Turbo Key',
      system: 'System / Brightness',
      macro: 'Onboard Macro',
      disable: 'Disable Button',
    },
    mouseActions: {
      'left-click': 'Left Click',
      'right-click': 'Right Click',
      'middle-click': 'Middle Click (Scroll)',
      'button-4': 'Forward (Button 4)',
      'button-5': 'Back (Button 5)',
      'double-click': 'Double Click',
      'scroll-up': 'Scroll Up',
      'scroll-down': 'Scroll Down',
      'scroll-left': 'Scroll Left',
      'scroll-right': 'Scroll Right',
    },
    mediaActions: {
      'play-pause': 'Play / Pause',
      'volume-up': 'Volume Up',
      'volume-down': 'Volume Down',
      mute: 'Mute',
      'next-track': 'Next Track',
      'prev-track': 'Previous Track',
      stop: 'Stop',
      player: 'Media Player',
    },
    dpiActions: {
      loop: 'DPI Loop',
      'dpi-up': 'CPI+ (DPI Up)',
      'dpi-down': 'CPI- (DPI Down)',
    },
    systemActions: {
      'brightness-up': 'Screen Brightness Up (Mac)',
      'brightness-down': 'Screen Brightness Down (Mac)',
      calculator: 'Calculator',
      'browser-home': 'Browser Home',
      mail: 'Launch Mail',
      refresh: 'Refresh (F5)',
    },
    comboRecordIdle: 'Record Keyboard Shortcut',
    comboRecording: 'Press keys now... (ESC cancels)',
    comboInputPlaceholder: 'e.g. cmd+c, cmd+shift+4, f13',
    comboPresetsTitle: 'macOS Quick Shortcuts',
    applyShortcut: 'Apply Shortcut',
    turboTarget: 'Target Button',
    turboInterval: 'Interval (ms)',
    turboRepeat: 'Repeat Count (0 = hold)',
    applyTurbo: 'Apply Turbo',
    selectMacro: 'Select Saved Macro',
    bindMacroBtn: 'Upload Macro to Button',
    noMacrosYet: 'No macros created yet. Open the Macro tab first.',
    disableBtnAction: 'Disable This Button',
    disabledLabel: 'Disabled',
    leftClickGuardError:
      'Safety guard: assign Left Click to another button before remapping Button 1.',

    ptrTitle: 'Pointer Setting',
    numStages: 'Number of DPI Stages',
    dpiFineInput: 'Exact DPI (step 50):',
    applyDpi: 'Apply',
    reportRate: 'Report Rate',
    ecoOverrideNote: 'Auto-Eco currently active',

    macTitle: 'The Macro Definition Editor',
    macName: 'Macro Name',
    newMacro: 'New',
    deleteMacro: 'Delete',
    saveMacro: 'Save Macro',
    evtList: 'Event List',
    startRec: 'Start Recording',
    stopRec: 'Stop Recording',
    clearEvents: 'Clear',
    deleteEvent: 'Delete Item',
    addDelayBtn: '+ Delay',
    delaySet: 'Delay Setting',
    delayRecord: 'Recorded Real Delay',
    delayUniform: 'Fixed Delay (ms)',
    delayNone: 'No Delay (min 2ms)',
    loopSet: 'Loop Setup',
    loopHold: 'Loop while button held',
    loopToggle: 'Loop until any click/key',
    loopCount: 'Loop N times:',
    quickBindLabel: 'Bind directly to button:',
    quickBindBtn: 'Upload to Mouse',
    recHint: 'Recording keyboard & mouse clicks on list...',

    sysTitle: 'System Function Settings',
    lodTitle: 'LOD Height',
    lodLow: 'Low (~1.0 mm)',
    lodHigh: 'High (~2.0 mm)',
    sensorTitle: 'Sensor Performance',
    sensorHelpText:
      'Motion Sync aligns PAW3395 sensor frames with USB polling intervals. Angle Snap straightens horizontal/vertical lines. Ripple Control reduces high-DPI jitter.',
    mouseProps: 'Mouse Properties (macOS)',
    openMacMouse: 'Open macOS Mouse Settings',

    osxTitle: 'macOS Menu Bar & Automations',
    menubarBoxTitle: 'Hybrid Menu Bar & Hidden Bar',
    showBatPct: 'Show Battery % in Menu Bar',
    showDpiVal: 'Show Active DPI in Menu Bar',
    hideBatFull: 'Hide % when 100% or USB Wired',
    docklessMode: 'Dockless Mode (hide Dock icon when closed)',
    launchLogin: 'Launch automatically at macOS Login',
    menubarHint:
      'Hybrid Mode active: Left-Click opens the Mini Control Center; Right-Click (or Ctrl+Click) opens the native macOS NSMenu.',
    autoBoxTitle: 'Smart Automations',
    autoEcoToggle: 'Auto-Eco: lower Polling Rate on low battery / Low Power Mode',
    autoEcoThreshold: 'Battery Trigger ≤',
    autoEcoRate: 'Eco Rate:',
    autoEcoMacPower: 'Sync with macOS Low Power Mode',
    dpiHudToggle: 'Show on-screen HUD when physical CPI+/CPI- changes DPI (0x54)',
    lowBatToggle: 'Native macOS notification at 20% and 10% battery',
    appProfilesTitle: 'Automatic Profiles by Frontmost App',
    appProfilesEnable: 'Auto-switch profile based on focused macOS app',
    addAppRule: '+ Add Rule',
    pickInstalledApp: 'Choose installed app...',
    appMatchPlaceholder: 'App name or Bundle ID (e.g. cs2, Blender)',
    removeRule: 'Remove',

    popoverOpenMain: 'Open Full Control Center',
    popoverQuit: 'Quit',
    popoverRefresh: 'Refresh Telemetry',
    popoverProfile: 'Active Profile',
    popoverQuickToggles: 'Quick Toggles',
  },
};

export const MAC_COMBO_PRESETS = [
  { combo: 'cmd+c', labelPt: '⌘ + C (Copiar)', labelEn: '⌘ + C (Copy)' },
  { combo: 'cmd+v', labelPt: '⌘ + V (Colar)', labelEn: '⌘ + V (Paste)' },
  { combo: 'cmd+z', labelPt: '⌘ + Z (Desfazer)', labelEn: '⌘ + Z (Undo)' },
  { combo: 'cmd+w', labelPt: '⌘ + W (Fechar Aba)', labelEn: '⌘ + W (Close Tab)' },
  { combo: 'cmd+tab', labelPt: '⌘ + Tab (Trocar App)', labelEn: '⌘ + Tab (App Switcher)' },
  { combo: 'ctrl+left', labelPt: '⌃ + ← (Mesa Anterior)', labelEn: '⌃ + ← (Prev Space)' },
  { combo: 'ctrl+right', labelPt: '⌃ + → (Próxima Mesa)', labelEn: '⌃ + → (Next Space)' },
  { combo: 'ctrl+up', labelPt: '⌃ + ↑ (Mission Control)', labelEn: '⌃ + ↑ (Mission Control)' },
  { combo: 'cmd+space', labelPt: '⌘ + Espaço (Spotlight)', labelEn: '⌘ + Space (Spotlight)' },
  { combo: 'cmd+shift+4', labelPt: '⌘ + ⇧ + 4 (Captura)', labelEn: '⌘ + ⇧ + 4 (Screenshot)' },
  { combo: 'f13', labelPt: 'F13 (Atalho Livre macOS)', labelEn: 'F13 (Custom macOS Key)' },
  { combo: 'f14', labelPt: 'F14 (Atalho Livre macOS)', labelEn: 'F14 (Custom macOS Key)' },
];

export function formatHidKeyPretty(rawKey) {
  const k = String(rawKey ?? '').trim().toLowerCase();
  const map = {
    cmd: '⌘ Cmd',
    lcmd: '⌘ Cmd',
    rcmd: '⌘ RCmd',
    opt: '⌥ Opt',
    alt: '⌥ Opt',
    lopt: '⌥ Opt',
    ropt: '⌥ ROpt',
    shift: '⇧ Shift',
    lshift: '⇧ Shift',
    rshift: '⇧ RShift',
    ctrl: '⌃ Ctrl',
    lctrl: '⌃ Ctrl',
    rctrl: '⌃ RCtrl',
    space: 'Space',
    enter: '↵ Enter',
    esc: 'Esc',
    backspace: '⌫ Backspace',
    tab: '⇥ Tab',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
  };
  if (map[k]) return map[k];
  return k.length === 1 ? k.toUpperCase() : k.toUpperCase();
}

export function formatComboPretty(comboStr) {
  if (!comboStr) return '';
  return String(comboStr)
    .split('+')
    .map((part) => formatHidKeyPretty(part))
    .join(' + ');
}

export function formatButtonActionLabel(cfg, macros = [], lang = 'pt') {
  const t = I18N[lang] || I18N.pt;
  if (!cfg || typeof cfg !== 'object') return t.mouseActions['left-click'];
  const cat = String(cfg.category || '').toLowerCase();

  if (cat === 'disable' || cat === 'disabled') {
    return t.disabledLabel;
  }
  if (cat === 'mouse') {
    return t.mouseActions[cfg.action] || cfg.action;
  }
  if (cat === 'combo') {
    if (cfg.combo) return formatComboPretty(cfg.combo);
    const mods = Array.isArray(cfg.modifiers) ? cfg.modifiers : [];
    const keys = Array.isArray(cfg.keys) ? cfg.keys : cfg.key ? [cfg.key] : [];
    return [...mods, ...keys].map(formatHidKeyPretty).join(' + ') || 'Combo';
  }
  if (cat === 'media') {
    return t.mediaActions[cfg.action] || cfg.action;
  }
  if (cat === 'dpi') {
    return t.dpiActions[cfg.action] || cfg.action;
  }
  if (cat === 'turbo') {
    const btn = cfg.button || 'left';
    const ms = cfg.intervalMs ?? 20;
    return `Turbo ${btn.toUpperCase()} (${ms}ms)`;
  }
  if (cat === 'system') {
    return t.systemActions[cfg.action] || cfg.action;
  }
  if (cat === 'macro') {
    const found = macros.find((m) => m.id === cfg.macroId);
    const name = found?.name || cfg.macroName || 'Macro';
    return `Macro: ${name}`;
  }
  return cat || '—';
}

const DOM_CODE_TO_HID_NAME = {
  MetaLeft: 'cmd',
  MetaRight: 'rcmd',
  AltLeft: 'opt',
  AltRight: 'ropt',
  ShiftLeft: 'shift',
  ShiftRight: 'rshift',
  ControlLeft: 'ctrl',
  ControlRight: 'rctrl',
  Enter: 'enter',
  Escape: 'esc',
  Backspace: 'backspace',
  Tab: 'tab',
  Space: 'space',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  CapsLock: 'capslock',
  PrintScreen: 'printscreen',
  ScrollLock: 'scrolllock',
  Pause: 'pause',
  Insert: 'insert',
  Home: 'home',
  PageUp: 'pageup',
  Delete: 'delete',
  End: 'end',
  PageDown: 'pagedown',
  ArrowRight: 'right',
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowUp: 'up',
  NumLock: 'numlock',
  NumpadDivide: 'num/',
  NumpadMultiply: 'num*',
  NumpadSubtract: 'num-',
  NumpadAdd: 'num+',
  NumpadEnter: 'numenter',
  NumpadDecimal: 'num.',
};

export function mapDomKeyEventToHidName(e) {
  const code = e.code || '';
  if (DOM_CODE_TO_HID_NAME[code]) {
    return {
      key: DOM_CODE_TO_HID_NAME[code],
      isModifier: ['MetaLeft', 'MetaRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight'].includes(code),
    };
  }
  if (/^Key([A-Z])$/.test(code)) {
    return { key: code.slice(3).toLowerCase(), isModifier: false };
  }
  if (/^Digit([0-9])$/.test(code)) {
    return { key: code.slice(5), isModifier: false };
  }
  if (/^Numpad([0-9])$/.test(code)) {
    return { key: `num${code.slice(6)}`, isModifier: false };
  }
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    return { key: code.toLowerCase(), isModifier: false };
  }
  return null;
}

export function getBatteryIconAsset(device) {
  if (!device?.connected) {
    return './oem/power0.png';
  }
  if (device.mode === 'wired') {
    return './oem/charge_status1.png';
  }
  if (!device.wirelessOnline) {
    return './oem/power0.png';
  }
  const pct = device.battery?.percent;
  if (typeof pct !== 'number') {
    return './oem/power4.png';
  }
  const level = Math.max(0, Math.min(7, Math.round((pct / 100) * 7)));
  return `./oem/power${level}.png`;
}
