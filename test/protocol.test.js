import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  BUTTON_HW_IDS,
  DEVICE_TARGETS,
  VENDOR_ID,
  batteryPercentToIconLevel,
  decodeActiveStateResponse,
  decodeBatteryResponse,
  decodeFirmwareResponse,
  decodeInputReport,
  encodeButtonDisablePacket,
  encodeButtonMappingPacket,
  encodeButtonResetPacket,
  encodeDebouncePacket,
  encodeDpiPacket,
  encodeFactoryResetPacket,
  encodeLightBrightnessPacket,
  encodeLightColorPackets,
  encodeLightModePacket,
  encodeLightSpeedPacket,
  encodeMacroPackets,
  encodePollingRatePacket,
  encodeRgbSequence,
  encodeSensorPacket,
  encodeWirelessPingPacket,
  formatHexPacket,
  normalizeFeatureReply,
  parseKeyCombo,
  resolveButtonHardwareId,
} from '../src/protocol.js';
import { DryRunTransport, N3Device, matchN3HidEntries } from '../src/device.js';
import { runCli } from '../src/cli.js';
import { N3AppStore } from '../src/app-store.js';

test('Constantes de identificação USB HID correspondem a FUN_004418f0 (0x4418f0)', () => {
  assert.equal(VENDOR_ID, 0x248a);
  assert.equal(DEVICE_TARGETS.wired.productId, 0xff10);
  assert.equal(DEVICE_TARGETS.wired.usagePage, 0xffc1);
  assert.equal(DEVICE_TARGETS.wired.usage, 0x0001);

  assert.equal(DEVICE_TARGETS.wireless.productId, 0xff11);
  assert.equal(DEVICE_TARGETS.wireless.usagePage, 0xffc0);
  assert.equal(DEVICE_TARGETS.wireless.usage, 0x0001);
});

test('Prioridade de descoberta HID prefere cabo USB (0xFF10/0xFFC1) sobre receptor 2.4G (0xFF11/0xFFC0)', () => {
  const mockDevices = [
    { vendorId: 0x248a, productId: 0xff11, usagePage: 0x0001, usage: 0x0002, path: 'mouse-generic' },
    { vendorId: 0x248a, productId: 0xff11, usagePage: 0xffc0, usage: 0x0001, path: 'dongle-vendor' },
    { vendorId: 0x248a, productId: 0xff10, usagePage: 0xffc1, usage: 0x0001, path: 'wired-vendor' },
  ];

  const matched = matchN3HidEntries(mockDevices);
  assert.equal(matched[0].mode, 'wired');
  assert.equal(matched[0].hidInfo.path, 'wired-vendor');
  assert.equal(matched[1].mode, 'wireless');
  assert.equal(matched[1].hidInfo.path, 'dongle-vendor');
});

test('encodeDpiPacket (0x51, 0x40) codifica exatamente como FUN_00442a40 (0x442a40)', () => {
  // Perfil padrão: 400 (0x0190), 800 (0x0320), 1600 (0x0640), 3200 (0x0C80), 4800 (0x12C0), ativo=2 (índice 1), count=5
  const pkt = encodeDpiPacket({
    stages: [400, 800, 1600, 3200, 4800],
    stageCount: 5,
    activeStage: 2,
  });

  assert.equal(pkt.length, 21);
  assert.equal(
    formatHexPacket(pkt),
    '51 40 01 01 01 90 01 20 03 40 06 80 0C C0 12 05 00 00 00 00 00',
  );

  // Teste com 26000 DPI (0x6590 -> LE: 90 65) e 50 DPI (0x0032 -> LE: 32 00)
  const pktMax = encodeDpiPacket({
    stages: [50, 26000],
    activeStage: 2,
  });
  assert.equal(pktMax[2], 1);
  assert.equal(pktMax[5], 0x32);
  assert.equal(pktMax[6], 0x00);
  assert.equal(pktMax[7], 0x90);
  assert.equal(pktMax[8], 0x65);
  assert.equal(pktMax[15], 2);
});

test('encodePollingRatePacket (0x51, 0x41) respeita deslocamento cabo buf[2] vs wireless buf[3] (FUN_00443f40)', () => {
  const wired1000 = encodePollingRatePacket(1000, 'wired');
  assert.equal(
    formatHexPacket(wired1000),
    '51 41 02 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00',
  );

  const wireless1000 = encodePollingRatePacket(1000, 'wireless');
  assert.equal(
    formatHexPacket(wireless1000),
    '51 41 00 02 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00',
  );

  const wired125 = encodePollingRatePacket(125, 'wired');
  assert.equal(wired125[2], 0x00);

  const wireless500 = encodePollingRatePacket(500, 'wireless');
  assert.equal(wireless500[2], 0x00);
  assert.equal(wireless500[3], 0x01);
});

test('encodeDebouncePacket (0x51, 0x43) valida faixa 0..20ms e codifica buf[2] (FUN_00445320)', () => {
  const pkt8 = encodeDebouncePacket(8);
  assert.equal(
    formatHexPacket(pkt8),
    '51 43 08 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00',
  );

  const pkt0 = encodeDebouncePacket(0);
  assert.equal(pkt0[2], 0x00);

  const pkt20 = encodeDebouncePacket(20);
  assert.equal(pkt20[2], 0x14);

  assert.throws(() => encodeDebouncePacket(21), RangeError);
  assert.throws(() => encodeDebouncePacket(-1), RangeError);
});

test('encodeSensorPacket (0x51, 0x42) mapeia LOD (1/2) e flags PAW3395 (1=ON, 2=OFF) conforme FUN_00443eb0', () => {
  const pktDefault = encodeSensorPacket({
    lod: 'low',
    rippleControl: true,
    angleSnap: false,
    motionSync: true,
  });

  assert.equal(
    formatHexPacket(pktDefault),
    '51 42 01 01 02 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00',
  );

  const pktHigh = encodeSensorPacket({
    lod: 'high',
    rippleControl: false,
    angleSnap: false,
    motionSync: false,
  });
  assert.equal(
    formatHexPacket(pktHigh),
    '51 42 02 02 02 02 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00',
  );
});

test('Comandos de iluminação RGB (0x51, 0x22..0x27) seguem estrutura OEM exata', () => {
  assert.equal(
    formatHexPacket(encodeLightModePacket('static')),
    '51 22 01 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00',
  );

  assert.equal(
    formatHexPacket(encodeLightBrightnessPacket('breathing', 128)),
    '51 23 01 02 80 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00',
  );

  const [r, g, b] = encodeLightColorPackets('static', '#FF6347'); // preset tomato
  assert.equal(formatHexPacket(r).slice(0, 14), '51 24 01 01 FF');
  assert.equal(formatHexPacket(g).slice(0, 14), '51 25 01 01 63');
  assert.equal(formatHexPacket(b).slice(0, 14), '51 26 01 01 47');

  assert.equal(
    formatHexPacket(encodeLightSpeedPacket('wave', 5)),
    '51 27 01 04 05 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00',
  );

  const seq = encodeRgbSequence({
    mode: 'static',
    color: 'cyan',
    brightness: 200,
    speed: 3,
  });
  assert.equal(seq.length, 6);
});

test('Pacotes utilitários (Wireless Ping 0x0C e Factory Reset 0x0B)', () => {
  assert.equal(
    formatHexPacket(encodeWirelessPingPacket()),
    '51 0C 02 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00',
  );
  assert.equal(
    formatHexPacket(encodeFactoryResetPacket()),
    '51 0B AA 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00',
  );
});

test('Decodificadores de GetFeature (0x04 Firmware, 0x06 Bateria, 0x07 Estado Ativo + realinhamento macOS)', () => {
  const fwBuf = new Uint8Array(21);
  fwBuf[0] = 0x51;
  fwBuf[1] = 0x04;
  Buffer.from('V1.0.7.2 ').copy(fwBuf, 3);
  assert.equal(decodeFirmwareResponse(fwBuf).version, 'V1.0.7.2');

  // Testa normalização caso IOHIDDeviceGetReport omita o Report ID inicial (0x51)
  const stripped = fwBuf.subarray(1);
  const realigned = normalizeFeatureReply(stripped, 0x04);
  assert.equal(realigned[0], 0x51);
  assert.equal(decodeFirmwareResponse(stripped).version, 'V1.0.7.2');

  // Bateria wireless em buf[11]
  const batWireless = new Uint8Array(21);
  batWireless[0] = 0x51;
  batWireless[1] = 0x06;
  batWireless[11] = 85;
  const decodedBat = decodeBatteryResponse(batWireless, 'wireless');
  assert.equal(decodedBat.percent, 85);
  assert.equal(decodedBat.iconLevel, 6);
  assert.equal(batteryPercentToIconLevel(95), 7);
  assert.equal(batteryPercentToIconLevel(2), 0);

  // Estado ativo (0x07): nibble alto = pollingRate (2=1000Hz), nibble baixo = estágio 0-based (3 -> #4)
  const stateBuf = new Uint8Array(21);
  stateBuf[0] = 0x51;
  stateBuf[1] = 0x07;
  stateBuf[4] = 0x23; // wireless lê buf[4]
  // 5 estágios LE em buf[6..15]: 400, 800, 1600, 3200, 6400
  const stages = [400, 800, 1600, 3200, 6400];
  stages.forEach((dpi, idx) => {
    stateBuf[6 + idx * 2] = dpi & 0xff;
    stateBuf[7 + idx * 2] = (dpi >> 8) & 0xff;
  });

  const decodedState = decodeActiveStateResponse(stateBuf, 'wireless');
  assert.equal(decodedState.activeStage, 4);
  assert.equal(decodedState.pollingRateHz, 1000);
  assert.deepEqual(decodedState.hardwareDpiStages, stages);
});

test('decodeInputReport (0x54, 0xE2 e 0xE3) decodifica notificações em tempo real (LAB_00445380)', () => {
  const evtE2 = new Uint8Array(21);
  evtE2[0] = 0x54;
  evtE2[1] = 0xe2;
  evtE2[2] = 0x00; // online
  evtE2[5] = 72; // 72%
  evtE2[6] = 2; // estágio #3
  evtE2[7] = 1; // 500 Hz

  const parsedE2 = decodeInputReport(evtE2, 'wireless');
  assert.equal(parsedE2.type, 'status_notification');
  assert.equal(parsedE2.powerState, 'online');
  assert.equal(parsedE2.batteryPercent, 72);
  assert.equal(parsedE2.activeStage, 3);
  assert.equal(parsedE2.pollingRateHz, 500);

  const evtE3 = new Uint8Array(21);
  evtE3[0] = 0x54;
  evtE3[1] = 0xe3;
  evtE3[2] = 0x00; // online
  evtE3[5] = 100;
  Buffer.from('N3_V1072 ').copy(evtE3, 8);

  const parsedE3 = decodeInputReport(evtE3, 'wireless');
  assert.equal(parsedE3.type, 'wireless_handshake');
  assert.equal(parsedE3.online, true);
  assert.equal(parsedE3.batteryPercent, 100);
  assert.equal(parsedE3.firmwareVersion, 'N3_V1072');
});

test('CLI executa fluxo --dry-run completo em JSON para DPI, Polling Rate, Debounce e RGB', async () => {
  const tmpState = path.join(os.tmpdir(), `n3ctl-test-${Date.now()}.json`);
  const logs = [];
  const io = {
    stdout: (msg) => logs.push(msg),
    stderr: (msg) => logs.push(msg),
  };

  try {
    const code1 = await runCli(
      ['dpi', '--stages', '400,800,1600,3200', '--active', '3', '--dry-run', '--json', '--state-file', tmpState],
      io,
    );
    assert.equal(code1, 0);
    const out1 = JSON.parse(logs.pop());
    assert.equal(out1.activeDpiStage, 3);
    assert.equal(out1.dpiStageCount, 4);
    assert.match(out1.packetHex, /^51 40 02 02 02 /);

    const code2 = await runCli(
      ['rate', '1000', '--connection', 'wireless', '--dry-run', '--json', '--state-file', tmpState],
      io,
    );
    assert.equal(code2, 0);
    const out2 = JSON.parse(logs.pop());
    assert.equal(out2.mode, 'wireless');
    assert.equal(out2.packetHex, '51 41 00 02 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00');
  } finally {
    fs.rmSync(tmpState, { force: true });
  }
});

test('Tabela de IDs de hardware dos 7 botões (0x4b7de4) respeita inversão Botão 2 (0x02) vs Botão 3 (0x01)', () => {
  assert.deepEqual(BUTTON_HW_IDS, [0x00, 0x02, 0x01, 0x03, 0x04, 0x05, 0x06]);
  assert.equal(resolveButtonHardwareId(1), 0x00);
  assert.equal(resolveButtonHardwareId('right'), 0x02);
  assert.equal(resolveButtonHardwareId(2), 0x02);
  assert.equal(resolveButtonHardwareId('middle'), 0x01);
  assert.equal(resolveButtonHardwareId(3), 0x01);
  assert.equal(resolveButtonHardwareId('forward'), 0x03);
  assert.equal(resolveButtonHardwareId('back'), 0x04);
  assert.equal(resolveButtonHardwareId('dpi+'), 0x05);
  assert.equal(resolveButtonHardwareId('dpi-'), 0x06);
});

test('encodeButtonResetPacket (0x447f3c) e encodeButtonDisablePacket (0x446b1c) geram quadros de 65 bytes', () => {
  const resetPkt = encodeButtonResetPacket();
  assert.equal(resetPkt.length, 65);
  assert.equal(formatHexPacket(resetPkt.subarray(0, 8)), '51 0B 01 01 00 00 00 00');
  assert.ok(resetPkt.subarray(4).every((b) => b === 0x00));

  const disableBtn2 = encodeButtonDisablePacket(2);
  assert.equal(disableBtn2.length, 65);
  assert.equal(formatHexPacket(disableBtn2.subarray(0, 8)), '52 52 02 00 00 00 00 00');
});

test('encodeButtonMappingPacket (0x52, 0x52) codifica todas as 8 categorias conforme FUN_00442e40 (0x442e40)', () => {
  // 1. Mouse: scroll-down (00 FE 00) no Botão 4 (hwId 0x03)
  const mousePkt = encodeButtonMappingPacket(4, { category: 'mouse', action: 'scroll-down' });
  assert.equal(mousePkt.length, 65);
  assert.equal(formatHexPacket(mousePkt.subarray(0, 10)), '52 52 03 00 01 00 FE 00 00 00');

  // 2. Combo macOS: Cmd+Shift+4 (Cmd=0x08 | Shift=0x02 = 0x0A, '4'=0x21) no Botão 5 (hwId 0x04)
  const comboPkt = encodeButtonMappingPacket(5, { category: 'combo', combo: 'cmd+shift+4' });
  assert.equal(formatHexPacket(comboPkt.subarray(0, 10)), '52 52 04 00 02 0A 21 00 00 00');

  // Combo com '+' literal (cmd++) e 2 teclas comuns (ctrl+a+b)
  assert.deepEqual(parseKeyCombo('cmd++'), { modifierMask: 0x08, keyCodes: [0x2e, 0x00] });
  assert.deepEqual(parseKeyCombo('ctrl+a+b'), { modifierMask: 0x01, keyCodes: [0x04, 0x05] });
  assert.throws(() => parseKeyCombo('ctrl+a+b+c'), RangeError);

  // 3. Multimídia: Media Player (0x0183 LE -> 83 01) no Botão 6 (hwId 0x05)
  const mediaPkt = encodeButtonMappingPacket(6, { category: 'media', action: 'player' });
  assert.equal(formatHexPacket(mediaPkt.subarray(0, 10)), '52 52 05 00 03 83 01 00 00 00');

  // 4. Sensibilidade / DPI: loop (0x01) no Botão 7 (hwId 0x06)
  const dpiPkt = encodeButtonMappingPacket(7, { category: 'dpi', action: 'loop' });
  assert.equal(formatHexPacket(dpiPkt.subarray(0, 10)), '52 52 06 00 05 01 00 00 00 00');

  // 5. Iluminação: brightness-switch (0x04) no Botão 6 (hwId 0x05)
  const lightPkt = encodeButtonMappingPacket(6, { category: 'light', action: 'brightness-switch' });
  assert.equal(formatHexPacket(lightPkt.subarray(0, 10)), '52 52 05 00 06 04 00 00 00 00');

  // 6. Turbo / Fire Key: botão esquerdo (0x01), 300ms (0x012C -> 2C 01), 500 ciclos (0x01F4 -> F4 01)
  const turboPkt = encodeButtonMappingPacket(4, {
    category: 'turbo',
    button: 'left',
    intervalMs: 300,
    repeatCount: 500,
  });
  assert.equal(formatHexPacket(turboPkt.subarray(0, 12)), '52 52 03 00 07 01 01 2C 01 F4 01 00');

  // 7. Atalho de Sistema: brightness-up (0C 6F 00) no Botão 3 (Meio -> hwId 0x01)
  const sysPkt = encodeButtonMappingPacket(3, { category: 'system', action: 'brightness-up' });
  assert.equal(formatHexPacket(sysPkt.subarray(0, 10)), '52 52 01 00 08 0C 6F 00 00 00');
});

test('encodeMacroPackets (0x52, 0x55) pagina blocos de 13 eventos e codifica modos/offsets conforme FUN_00443fc0', () => {
  // Bloco único com 4 eventos (key-down, delay 300ms, move -10/+25, key-up) em modo hold (0x2001 -> 01 20)
  const singleChunks = encodeMacroPackets({
    button: 4, // hwId 0x03
    loopMode: 'hold',
    events: [
      { type: 'key-down', key: 'a' },
      { type: 'delay', ms: 300 }, // 0x012C -> 2C 01
      { type: 'move', dx: -10, dy: 25 }, // -10=0xF6, 25=0x19
      { type: 'key-up', key: 'a' },
    ],
  });

  assert.equal(singleChunks.length, 1);
  const c0 = singleChunks[0];
  assert.equal(c0.length, 65);
  // Header chunk 0: 52 55 03(hwId) 00(last) 00 00(offset) 16(6+4*4=22=0x16) 01 01 20(0x2001) 00 00 04(total)
  assert.equal(
    formatHexPacket(c0.subarray(0, 13)),
    '52 55 03 00 00 00 16 01 01 20 00 00 04',
  );
  // 4 eventos de 4 bytes em buf[13..28]
  assert.equal(
    formatHexPacket(c0.subarray(13, 29)),
    '00 81 04 00 00 0F 2C 01 00 09 F6 19 00 01 04 00',
  );

  // Macro multi-bloco com 28 eventos -> 3 blocos (13 + 13 + 2 eventos) em modo toggle (0x4001 -> 01 40)
  const twentyEightEvents = [];
  for (let i = 0; i < 14; i += 1) {
    twentyEightEvents.push({ type: 'mouse-down', button: 'left' });
    twentyEightEvents.push({ type: 'mouse-up', button: 'left' });
  }
  const multi = encodeMacroPackets({
    button: 5, // hwId 0x04
    loopMode: 'toggle',
    events: twentyEightEvents,
  });

  assert.equal(multi.length, 3);
  // Bloco 0: hasMore=01, offset=00 00, len=0x3A (58), loop=01 40, total=0x1C (28)
  assert.equal(
    formatHexPacket(multi[0].subarray(0, 13)),
    '52 55 04 01 00 00 3A 01 01 40 00 00 1C',
  );
  // Bloco 1 (k=1): hasMore=01, offset=1*0x34+6 = 0x003A -> 3A 00, len=13*4 = 0x34
  assert.equal(formatHexPacket(multi[1].subarray(0, 7)), '52 55 04 01 3A 00 34');
  // Bloco 2 (k=2): hasMore=00, offset=2*0x34+6 = 0x006E -> 6E 00, len=2*4 = 0x08
  assert.equal(formatHexPacket(multi[2].subarray(0, 7)), '52 55 04 00 6E 00 08');
  assert.equal(formatHexPacket(multi[2].subarray(7, 15)), '00 88 01 00 00 08 01 00');
});

test('N3Device protege contra remoção acidental do último Clique Esquerdo (modo canhoto seguro)', async () => {
  const dev = new N3Device(new DryRunTransport('wired'), { interPacketDelayMs: 0 });

  await assert.rejects(
    () => dev.setButtonMapping(1, { category: 'mouse', action: 'right-click' }),
    (err) => err.code === 'LEFT_CLICK_REQUIRED',
  );

  // Ao mapear o Botão 2 para left-click (modo canhoto), passa a permitir remapear o Botão 1 para right-click
  const customButtons = {
    1: { category: 'mouse', action: 'left-click' },
    2: { category: 'mouse', action: 'left-click' },
  };
  const pkt = await dev.setButtonMapping(
    1,
    { category: 'mouse', action: 'right-click' },
    { currentButtons: customButtons },
  );
  assert.equal(formatHexPacket(pkt.subarray(0, 8)), '52 52 00 00 01 02 00 00');
});

test('CLI executa subcomandos button e macro em --dry-run --json', async () => {
  const tmpState = path.join(os.tmpdir(), `n3ctl-btn-macro-${Date.now()}.json`);
  const logs = [];
  const io = {
    stdout: (msg) => logs.push(msg),
    stderr: (msg) => logs.push(msg),
  };

  try {
    const codeBtn = await runCli(
      ['button', '4', '--combo', 'cmd+c', '--dry-run', '--json', '--state-file', tmpState],
      io,
    );
    assert.equal(codeBtn, 0);
    const outBtn = JSON.parse(logs.pop());
    assert.equal(outBtn.button, 4);
    assert.equal(outBtn.hwId, 0x03);
    assert.ok(outBtn.packetHex.startsWith('52 52 03 00 02 08 06 00'));

    const codeResetBtn = await runCli(
      ['button', 'reset', '--dry-run', '--json', '--state-file', tmpState],
      io,
    );
    assert.equal(codeResetBtn, 0);
    const outResetBtn = JSON.parse(logs.pop());
    assert.ok(outResetBtn.packetHex.startsWith('51 0B 01 01 00'));

    const codeMacro = await runCli(
      [
        'macro',
        '--button',
        '5',
        '--seq',
        'cmd+c,delay:40,cmd+v',
        '--loop',
        'count',
        '--repeat',
        '2',
        '--dry-run',
        '--json',
        '--state-file',
        tmpState,
      ],
      io,
    );
    assert.equal(codeMacro, 0);
    const outMacro = JSON.parse(logs.pop());
    assert.equal(outMacro.button, 5);
    assert.equal(outMacro.hwId, 0x04);
    assert.equal(outMacro.chunkCount, 1);
    assert.ok(outMacro.packetsHex[0].startsWith('52 55 04 00 00 00'));
  } finally {
    fs.rmSync(tmpState, { force: true });
  }
});

test('N3AppStore gerencia múltiplos perfis, biblioteca de macros, automações macOS e sincroniza state.json com a CLI', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'n3-appstore-'));
  const storePath = path.join(tmpDir, 'app-config.json');
  const cliStatePath = path.join(tmpDir, 'state.json');

  try {
    const store = new N3AppStore({ storePath, cliStatePath });
    assert.equal(store.getSnapshot().activeProfileId, 'standard');
    assert.equal(store.getSnapshot().profiles.length, 5);
    assert.equal(store.getSnapshot().menubar.showBatteryPercent, true);
    assert.equal(store.getSnapshot().menubar.showDpi, true);

    // Atualiza DPI e Polling Rate no perfil ativo e verifica sincronia com state.json
    store.updateActiveProfile({
      dpiStages: [400, 1200, 1600, 3200, 6400],
      activeDpiStage: 2,
      pollingRateHz: 1000,
    });
    const syncedCli = JSON.parse(fs.readFileSync(cliStatePath, 'utf8'));
    assert.equal(syncedCli.dpiStages[1], 1200);
    assert.equal(syncedCli.pollingRateHz, 1000);

    // Criação, renomeação e exclusão de perfis
    store.createProfile('Valorant Mac');
    const created = store.getActiveProfile();
    assert.equal(created.name, 'Valorant Mac');
    assert.equal(created.pollingRateHz, 1000);

    store.renameProfile(created.id, 'CS2 Pro');
    assert.equal(store.getActiveProfile().name, 'CS2 Pro');

    // Upsert de macro e preferências da Menu Bar Híbrida / Automações
    const { macro } = store.upsertMacro({
      name: 'BunnyHop',
      delayMode: 'uniform',
      uniformDelayMs: 15,
      loopMode: 'hold',
      events: [
        { type: 'key-down', key: 'space' },
        { type: 'delay', ms: 15 },
        { type: 'key-up', key: 'space' },
      ],
    });
    assert.equal(macro.name, 'BunnyHop');
    assert.ok(store.getSnapshot().macros.some((m) => m.id === macro.id));

    store.updatePreferences({
      language: 'en',
      menubar: { showBatteryPercent: false, showDpi: true },
      automations: { autoEco: { batteryThreshold: 20 } },
    });
    assert.equal(store.getSnapshot().language, 'en');
    assert.equal(store.getSnapshot().menubar.showBatteryPercent, false);
    assert.equal(store.getSnapshot().automations.autoEco.batteryThreshold, 20);

    store.deleteMacro(macro.id);
    assert.ok(!store.getSnapshot().macros.some((m) => m.id === macro.id));

    store.deleteProfile(created.id);
    assert.ok(!store.getSnapshot().profiles.some((p) => p.id === created.id));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
