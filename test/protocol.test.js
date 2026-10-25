import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DEVICE_TARGETS,
  VENDOR_ID,
  batteryPercentToIconLevel,
  decodeActiveStateResponse,
  decodeBatteryResponse,
  decodeFirmwareResponse,
  decodeInputReport,
  encodeDebouncePacket,
  encodeDpiPacket,
  encodeFactoryResetPacket,
  encodeLightBrightnessPacket,
  encodeLightColorPackets,
  encodeLightModePacket,
  encodeLightSpeedPacket,
  encodePollingRatePacket,
  encodeRgbSequence,
  encodeSensorPacket,
  encodeWirelessPingPacket,
  formatHexPacket,
  normalizeFeatureReply,
} from '../src/protocol.js';
import { matchN3HidEntries } from '../src/device.js';
import { runCli } from '../src/cli.js';

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
