import fs from 'node:fs';
import { parseArgs } from 'node:util';
import {
  DEBOUNCE_LIMITS,
  DPI_LIMITS,
  LIGHT_MODES,
  POLLING_LED_INDICATOR,
  RGB_PRESET_COLORS,
  formatHexPacket,
  parseRgbColor,
} from './protocol.js';
import {
  cloneDefaultProfile,
  getDefaultStatePath,
  loadSavedProfile,
  normalizeProfile,
  saveProfile,
} from './state.js';
import { N3Device, listN3Devices } from './device.js';

const HELP_TEXT = `N3 Control Center (n3ctl) — Utilitário macOS para Darmoshark N3 (PAW3395)

Uso:
  n3ctl <comando> [opções]

Comandos:
  devices                     Lista interfaces USB HID do Darmoshark N3 conectadas no Mac
  status                      Lê firmware, bateria, estágio de DPI ativo e polling rate
  dpi [opções]                Configura estágios de DPI (50..26000), quantidade (1..5) e estágio ativo
  rate <125|500|1000>         Ajusta o Polling Rate (adapta automaticamente cabo vs. 2.4GHz)
  debounce <0..20>            Ajusta o Debounce Time (Keypress Response) em milissegundos
  sensor [opções]             Ajusta LOD (low/high) e recursos PAW3395 (Ripple, Angle Snap, Motion Sync)
  rgb [opções]                Envia comandos OEM de iluminação RGB (opcodes 0x22..0x27)
  apply [--file perfil.json]  Aplica todas as configurações do perfil salvo (ou arquivo JSON)
  monitor                     Monitora eventos em tempo real (Input Report 0x54: DPI, bateria, repouso)
  reset --confirm             Envia Factory Reset (0x51 0x0B 0xAA) e restaura perfil padrão

Opções de 'dpi':
  --stages <lista>            Lista separada por vírgula de 1 a 5 DPIs (ex.: 400,800,1600,3200,4800)
  --stage <1..5>              Índice de um único estágio a alterar (requer --value)
  --value <50..26000>         Novo valor de DPI para o estágio informado em --stage
  --count <1..5>              Quantidade de estágios habilitados no ciclo do botão físico
  --active <1..5>             Define qual estágio fica ativo imediatamente

Opções de 'sensor':
  --lod <low|high>            Altura de Lift-Off Distance: low (~1mm) ou high (~2mm)
  --ripple <on|off>           Controle de ondulação (Ripple Control)
  --angle-snap <on|off>       Correção linear de trajetória (Angle Snapping)
  --motion-sync <on|off>      Sincronização de movimento PAW3395 (Motion Sync)

Opções de 'rgb':
  --mode <modo>               off | static | breathing | spectrum | wave | marquee | neon
  --color <#RRGGBB|preset>    Cor hex ou preset (${Object.keys(RGB_PRESET_COLORS).join(', ')})
  --brightness <1..255>       Nível de brilho
  --speed <1..255>            Velocidade do efeito

Opções Globais:
  --mode <auto|wired|wireless> Seleciona transporte (ou modo de iluminação quando usado em 'rgb')
  --dry-run                    Simula envio e exibe os pacotes HID de 21 bytes em hexadecimal
  --verbose                    Exibe todos os quadros HID enviados/recebidos
  --json                       Formata a saída em JSON
  --state-file <caminho>       Caminho alternativo para o cache de perfil local
  -h, --help                   Exibe esta ajuda

Exemplos:
  n3ctl devices
  n3ctl status
  n3ctl dpi --stages 400,800,1600,3200 --active 2
  n3ctl rate 1000
  n3ctl debounce 4
  n3ctl sensor --lod low --motion-sync on --angle-snap off --ripple off
  n3ctl rgb --rgb-mode static --color #00FFAA --brightness 128 --dry-run
`;

function parseBoolToggle(val, flagName) {
  const normalized = String(val).trim().toLowerCase();
  if (['on', 'true', '1', 'yes', 'sim'].includes(normalized)) return true;
  if (['off', 'false', '0', 'no', 'nao', 'não'].includes(normalized)) return false;
  throw new RangeError(`Valor inválido para ${flagName}: "${val}". Use "on" ou "off".`);
}

function toHexId(num) {
  return `0x${Number(num).toString(16).padStart(4, '0').toUpperCase()}`;
}

export async function runCli(argv = process.argv.slice(2), io = { stdout: console.log, stderr: console.error }) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      'dry-run': { type: 'boolean', default: false },
      verbose: { type: 'boolean', short: 'v', default: false },
      json: { type: 'boolean', default: false },
      confirm: { type: 'boolean', default: false },
      'include-rgb': { type: 'boolean', default: false },
      'all-collections': { type: 'boolean', default: false },
      connection: { type: 'string' },
      mode: { type: 'string' },
      'rgb-mode': { type: 'string' },
      stages: { type: 'string' },
      stage: { type: 'string' },
      value: { type: 'string' },
      count: { type: 'string' },
      active: { type: 'string' },
      lod: { type: 'string' },
      ripple: { type: 'string' },
      'angle-snap': { type: 'string' },
      'motion-sync': { type: 'string' },
      color: { type: 'string' },
      brightness: { type: 'string' },
      speed: { type: 'string' },
      file: { type: 'string' },
      'state-file': { type: 'string' },
    },
  });

  const command = positionals[0]?.toLowerCase();
  if (values.help || !command || command === 'help') {
    io.stdout(HELP_TEXT);
    return 0;
  }

  const dryRun = Boolean(values['dry-run']);
  const verbose = Boolean(values.verbose) || dryRun;
  const jsonOutput = Boolean(values.json);
  const statePath = values['state-file'] ? String(values['state-file']) : getDefaultStatePath();

  // Permite --connection wired|wireless em qualquer comando, e --mode wired|wireless fora de 'rgb'
  let preferredConnection = 'auto';
  if (values.connection) {
    preferredConnection = String(values.connection).toLowerCase();
  } else if (command !== 'rgb' && values.mode && ['auto', 'wired', 'wireless'].includes(String(values.mode).toLowerCase())) {
    preferredConnection = String(values.mode).toLowerCase();
  }

  const packetTrace = [];
  const logger = verbose
    ? (entry) => {
        packetTrace.push(entry);
        if (!jsonOutput) {
          const prefix = dryRun ? '[DRY-RUN]' : '[HID]';
          io.stdout(
            `${prefix} ${entry.direction} (${entry.mode}) ${entry.description ? `— ${entry.description}` : ''}\n  ${entry.hex}`,
          );
        }
      }
    : null;

  if (command === 'devices') {
    const found = await listN3Devices({
      includeNonConfigCollections: Boolean(values['all-collections']),
    });
    if (jsonOutput) {
      io.stdout(JSON.stringify(found, null, 2));
      return 0;
    }
    if (found.length === 0) {
      io.stdout('Nenhum mouse ou receptor 2.4GHz Darmoshark N3 foi detectado no barramento USB HID.');
      return 0;
    }
    io.stdout(`Dispositivos Darmoshark N3 encontrados (${found.length}):`);
    for (const item of found) {
      const d = item.hidInfo;
      io.stdout(
        `  - ${item.target.label}\n` +
          `    VID:PID=${toHexId(d.vendorId)}:${toHexId(d.productId)} | UsagePage=${toHexId(d.usagePage ?? 0)} Usage=${toHexId(d.usage ?? 0)} | Interface=${d.interface ?? 'N/A'}\n` +
          `    Produto="${d.product ?? 'N/A'}" | Fabricante="${d.manufacturer ?? 'N/A'}"\n` +
          `    Path=${d.path ?? 'indisponível'}`,
      );
    }
    return 0;
  }

  const device = await N3Device.open({
    preferredMode: preferredConnection,
    dryRun,
    logger,
  });

  try {
    const profile = loadSavedProfile(statePath);

    if (command === 'status') {
      const status = await device.getFullStatus();
      // Sincroniza o cache local com os valores reais lidos do hardware quando disponíveis
      if (!dryRun && status.wirelessOnline !== false) {
        if (Array.isArray(status.hardwareDpiStages)) {
          profile.dpiStages = status.hardwareDpiStages;
        }
        if (Number.isInteger(status.hardwareStageCount)) {
          profile.dpiStageCount = status.hardwareStageCount;
        }
        if (Number.isInteger(status.hardwareDebounceMs)) {
          profile.debounceMs = status.hardwareDebounceMs;
        }
        if (Number.isInteger(status.activeDpiStage)) {
          profile.activeDpiStage = status.activeDpiStage;
        }
        if (Number.isInteger(status.pollingRateHz)) {
          profile.pollingRateHz = status.pollingRateHz;
        }
        saveProfile(profile, statePath);
      }

      const payload = {
        ...status,
        cachedProfile: profile,
        dryRun,
        packets: packetTrace,
      };

      if (jsonOutput) {
        io.stdout(JSON.stringify(payload, null, 2));
      } else {
        io.stdout(`Dispositivo:   ${status.deviceLabel} (${toHexId(status.vendorId)}:${toHexId(status.productId)}, UsagePage ${toHexId(status.usagePage)})`);
        if (status.mode === 'wireless' && status.wirelessOnline === false) {
          io.stdout(`Link 2.4GHz:   Inativo — ${status.offlineReason}`);
          return 0;
        }
        if (status.mode === 'wireless') {
          io.stdout(`Link 2.4GHz:   Online (Ativo)`);
        }
        io.stdout(`Firmware:      ${status.firmwareVersion ?? (dryRun ? '(simulado)' : 'N/D')}`);
        if (status.mode === 'wireless') {
          io.stdout(
            `Bateria:       ${status.battery.percent !== null ? `${status.battery.percent}%` : 'N/D'} (nível de ícone ${status.battery.iconLevel ?? 'N/D'}/7)`,
          );
        } else {
          const pctText = status.battery.percent !== null ? `${status.battery.percent}% — ` : '';
          io.stdout(`Alimentação:   USB Com Fio (${pctText}indicador de carga: ${status.battery.iconLevel ?? 'N/D'})`);
        }
        const effectiveStages = status.hardwareDpiStages ?? profile.dpiStages;
        io.stdout(`Estágios DPI:  ${effectiveStages.slice(0, profile.dpiStageCount).map((v, idx) => `${idx + 1}:${v}${idx + 1 === status.activeDpiStage ? '*' : ''}`).join(' | ')} (total habilitado: ${profile.dpiStageCount})`);
        io.stdout(`Polling Rate:  ${status.pollingRateHz ?? profile.pollingRateHz} Hz (LED inferior: ${POLLING_LED_INDICATOR[status.pollingRateHz ?? profile.pollingRateHz] ?? 'N/D'})`);
        io.stdout(`Perfil Local:  Debounce=${profile.debounceMs}ms | LOD=${profile.lod} | Ripple=${profile.sensor.rippleControl ? 'ON' : 'OFF'} | AngleSnap=${profile.sensor.angleSnap ? 'ON' : 'OFF'} | MotionSync=${profile.sensor.motionSync ? 'ON' : 'OFF'}`);
      }
      return 0;
    }

    if (command === 'dpi') {
      let nextStages = [...profile.dpiStages];
      let nextCount = profile.dpiStageCount;
      let nextActive = profile.activeDpiStage;

      if (values.stages !== undefined) {
        const parsed = String(values.stages)
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => !Number.isNaN(n));
        if (parsed.length < 1 || parsed.length > DPI_LIMITS.MAX_STAGES) {
          throw new RangeError('Informe entre 1 e 5 valores em --stages (ex.: 400,800,1600,3200).');
        }
        nextCount = parsed.length;
        for (let i = 0; i < parsed.length; i += 1) {
          nextStages[i] = parsed[i];
        }
      }

      if (values.stage !== undefined || values.value !== undefined) {
        if (values.stage === undefined || values.value === undefined) {
          throw new RangeError('Ao usar --stage, informe também --value (ex.: --stage 2 --value 1200).');
        }
        const stageNum = Number(values.stage);
        const dpiVal = Number(values.value);
        if (!Number.isInteger(stageNum) || stageNum < 1 || stageNum > DPI_LIMITS.MAX_STAGES) {
          throw new RangeError(`Estágio inválido (${values.stage}). Use de 1 a 5.`);
        }
        nextStages[stageNum - 1] = dpiVal;
        if (stageNum > nextCount) {
          nextCount = stageNum;
        }
      }

      if (values.count !== undefined) {
        nextCount = Number(values.count);
      }

      if (values.active !== undefined) {
        nextActive = Number(values.active);
      } else if (nextActive > nextCount) {
        nextActive = nextCount;
      }

      const packet = await device.setDpi({
        stages: nextStages,
        stageCount: nextCount,
        activeStage: nextActive,
        fallbackStages: profile.dpiStages,
      });

      profile.dpiStages = nextStages;
      profile.dpiStageCount = nextCount;
      profile.activeDpiStage = nextActive;
      if (!dryRun) {
        saveProfile(profile, statePath);
      }

      if (jsonOutput) {
        io.stdout(
          JSON.stringify(
            {
              ok: true,
              dryRun,
              mode: device.mode,
              dpiStages: nextStages,
              dpiStageCount: nextCount,
              activeDpiStage: nextActive,
              packetHex: formatHexPacket(packet),
            },
            null,
            2,
          ),
        );
      } else {
        io.stdout(
          `DPI configurado (${dryRun ? 'simulação' : 'aplicado'}): estágios [${nextStages.slice(0, nextCount).join(', ')}] | ativo=#${nextActive} (${nextStages[nextActive - 1]} DPI).`,
        );
      }
      return 0;
    }

    if (command === 'rate' || command === 'polling') {
      const rawRate = positionals[1] ?? values.value;
      if (rawRate === undefined) {
        throw new RangeError('Informe o polling rate em Hz: n3ctl rate <125|500|1000>.');
      }
      const hz = Number(rawRate);
      const packet = await device.setPollingRate(hz);

      profile.pollingRateHz = hz;
      if (!dryRun) {
        saveProfile(profile, statePath);
      }

      if (jsonOutput) {
        io.stdout(
          JSON.stringify(
            {
              ok: true,
              dryRun,
              mode: device.mode,
              pollingRateHz: hz,
              ledIndicator: POLLING_LED_INDICATOR[hz],
              packetHex: formatHexPacket(packet),
            },
            null,
            2,
          ),
        );
      } else {
        io.stdout(
          `Polling Rate configurado para ${hz} Hz em modo ${device.mode} (${dryRun ? 'simulação' : 'aplicado'} — LED indicador: ${POLLING_LED_INDICATOR[hz]}).`,
        );
      }
      return 0;
    }

    if (command === 'debounce') {
      const rawMs = positionals[1] ?? values.value;
      if (rawMs === undefined) {
        throw new RangeError(
          `Informe o tempo de debounce em ms (${DEBOUNCE_LIMITS.MIN_MS}..${DEBOUNCE_LIMITS.MAX_MS}): n3ctl debounce 8`,
        );
      }
      const ms = Number(rawMs);
      const packet = await device.setDebounceTime(ms);

      profile.debounceMs = ms;
      if (!dryRun) {
        saveProfile(profile, statePath);
      }

      if (jsonOutput) {
        io.stdout(
          JSON.stringify(
            {
              ok: true,
              dryRun,
              mode: device.mode,
              debounceMs: ms,
              packetHex: formatHexPacket(packet),
            },
            null,
            2,
          ),
        );
      } else {
        io.stdout(`Debounce Time configurado para ${ms} ms (${dryRun ? 'simulação' : 'aplicado'}).`);
      }
      return 0;
    }

    if (command === 'sensor' || command === 'lod') {
      const nextLod = values.lod ? String(values.lod).toLowerCase() : profile.lod;
      const nextRipple =
        values.ripple !== undefined
          ? parseBoolToggle(values.ripple, '--ripple')
          : profile.sensor.rippleControl;
      const nextAngleSnap =
        values['angle-snap'] !== undefined
          ? parseBoolToggle(values['angle-snap'], '--angle-snap')
          : profile.sensor.angleSnap;
      const nextMotionSync =
        values['motion-sync'] !== undefined
          ? parseBoolToggle(values['motion-sync'], '--motion-sync')
          : profile.sensor.motionSync;

      const packet = await device.setSensorConfig({
        lod: nextLod,
        rippleControl: nextRipple,
        angleSnap: nextAngleSnap,
        motionSync: nextMotionSync,
      });

      profile.lod = nextLod === '2mm' ? 'high' : nextLod === '1mm' ? 'low' : nextLod;
      profile.sensor = {
        rippleControl: nextRipple,
        angleSnap: nextAngleSnap,
        motionSync: nextMotionSync,
      };
      if (!dryRun) {
        saveProfile(profile, statePath);
      }

      if (jsonOutput) {
        io.stdout(
          JSON.stringify(
            {
              ok: true,
              dryRun,
              lod: profile.lod,
              sensor: profile.sensor,
              packetHex: formatHexPacket(packet),
            },
            null,
            2,
          ),
        );
      } else {
        io.stdout(
          `Sensor PAW3395 configurado (${dryRun ? 'simulação' : 'aplicado'}): LOD=${profile.lod} | Ripple=${nextRipple ? 'ON' : 'OFF'} | AngleSnap=${nextAngleSnap ? 'ON' : 'OFF'} | MotionSync=${nextMotionSync ? 'ON' : 'OFF'}.`,
        );
      }
      return 0;
    }

    if (command === 'rgb' || command === 'light') {
      const rawRgbMode = values['rgb-mode'] ?? values.mode ?? profile.rgb.mode;
      const rgbMode = String(rawRgbMode).toLowerCase();
      if (!Object.hasOwn(LIGHT_MODES, rgbMode)) {
        throw new RangeError(
          `Modo RGB inválido ("${rawRgbMode}"). Use: ${Object.keys(LIGHT_MODES).join(', ')}.`,
        );
      }

      const color =
        values.color !== undefined ? parseRgbColor(values.color) : profile.rgb.color;
      const brightness =
        values.brightness !== undefined ? Number(values.brightness) : profile.rgb.brightness;
      const speed =
        values.speed !== undefined ? Number(values.speed) : profile.rgb.speed;

      const packets = await device.setRgbLighting({
        mode: rgbMode,
        color: values.color !== undefined ? color : undefined,
        brightness: values.brightness !== undefined ? brightness : undefined,
        speed: values.speed !== undefined ? speed : undefined,
      });

      profile.rgb = { mode: rgbMode, color, brightness, speed };
      if (!dryRun) {
        saveProfile(profile, statePath);
      }

      const hardwareNote =
        'Nota: O driver oficial v1.0.7.2 implementa os opcodes RGB 0x22..0x27, porém oculta a aba RGB na UI do N3 pois a carcaça padrão do N3 possui apenas LED indicador de status/DPI.';

      if (jsonOutput) {
        io.stdout(
          JSON.stringify(
            {
              ok: true,
              dryRun,
              rgb: profile.rgb,
              packetsHex: packets.map((p) => formatHexPacket(p)),
              note: hardwareNote,
            },
            null,
            2,
          ),
        );
      } else {
        io.stdout(
          `Pacotes RGB enviados (${dryRun ? 'simulação' : 'aplicado'}): modo=${rgbMode}, cor=[${color.join(', ')}], brilho=${brightness}, velocidade=${speed}.\n${hardwareNote}`,
        );
      }
      return 0;
    }

    if (command === 'apply') {
      let targetProfile = profile;
      if (values.file) {
        const rawJson = fs.readFileSync(String(values.file), 'utf8');
        targetProfile = normalizeProfile(JSON.parse(rawJson));
      }
      const packets = await device.applyProfile(targetProfile, {
        includeRgb: Boolean(values['include-rgb']),
      });
      if (!dryRun) {
        saveProfile(targetProfile, statePath);
      }

      if (jsonOutput) {
        io.stdout(
          JSON.stringify(
            {
              ok: true,
              dryRun,
              appliedProfile: targetProfile,
              packetsHex: packets.map((p) => formatHexPacket(p)),
            },
            null,
            2,
          ),
        );
      } else {
        io.stdout(
          `Perfil completo ${dryRun ? 'simulado' : 'aplicado'} com sucesso (${packets.length} pacotes Feature Report enviados).`,
        );
      }
      return 0;
    }

    if (command === 'reset') {
      if (!values.confirm && !dryRun) {
        throw new Error(
          'Confirmação necessária: execute "n3ctl reset --confirm" para restaurar o mouse aos padrões de fábrica.',
        );
      }
      const packet = await device.factoryReset();
      const defaults = cloneDefaultProfile();
      if (!dryRun) {
        saveProfile(defaults, statePath);
      }

      if (jsonOutput) {
        io.stdout(
          JSON.stringify(
            {
              ok: true,
              dryRun,
              packetHex: formatHexPacket(packet),
              restoredProfile: defaults,
            },
            null,
            2,
          ),
        );
      } else {
        io.stdout(
          `Comando de restauração de fábrica (0x51 0x0B 0xAA) ${dryRun ? 'simulado' : 'enviado'} com sucesso.`,
        );
      }
      return 0;
    }

    if (command === 'monitor') {
      if (dryRun) {
        io.stdout('Modo monitor indisponível com --dry-run (requer conexão USB/2.4G real).');
        return 0;
      }
      io.stdout(
        `Monitorando Input Reports (0x54) em ${device.target.label}... Pressione Ctrl+C para encerrar.`,
      );
      await new Promise((resolve) => {
        const unsubscribe = device.subscribeEvents((evt) => {
          if (jsonOutput) {
            io.stdout(JSON.stringify({ ...evt, rawPacket: formatHexPacket(evt.rawPacket) }));
          } else if (evt.type === 'status_notification') {
            io.stdout(
              `[Evento 0xE2] Estado=${evt.powerState} | Estágio DPI=#${evt.activeStage} | Polling=${evt.pollingRateHz}Hz | Bateria=${evt.batteryPercent !== null ? `${evt.batteryPercent}%` : `nível ${evt.batteryIconLevel}`}`,
            );
          } else if (evt.type === 'wireless_handshake') {
            io.stdout(
              `[Handshake 0xE3] Online=${evt.online} | Firmware=${evt.firmwareVersion ?? 'N/D'} | Bateria=${evt.batteryPercent ?? 'N/D'}%`,
            );
          } else {
            io.stdout(`[Input 0x54] Opcode=0x${evt.opcode.toString(16)} | ${formatHexPacket(evt.rawPacket)}`);
          }
        });

        process.once('SIGINT', () => {
          unsubscribe();
          resolve();
        });
      });
      return 0;
    }

    throw new Error(`Comando desconhecido: "${command}". Use "n3ctl --help" para listar os comandos.`);
  } finally {
    device.close();
  }
}
