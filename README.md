# N3 Control Center (`n3ctl`)

Utilitário nativo de linha de comando e biblioteca Node.js (`node-hid`) para configurar o mouse **Darmoshark N3** (sensor PixArt PAW3395 / MCU Telink `0x248A`) diretamente no **macOS**, construído a partir da engenharia reversa completa do instalador oficial Windows `Darmoshark N3 Mouse1.0.7.2.exe`.

## Recursos Suportados

- **Conexão Dual (Cabo USB e Receptor 2.4GHz)**:
  - **Modo Com Fio**: `VID 0x248A`, `PID 0xFF10`, `UsagePage 0xFFC1`, `Usage 0x0001`
  - **Modo Sem Fio 2.4GHz**: `VID 0x248A`, `PID 0xFF11`, `UsagePage 0xFFC0`, `Usage 0x0001`
  - Por operar sobre *Vendor-Defined Usage Pages* (`0xFFC1` / `0xFFC0`), o `IOHIDFamily` do macOS permite abrir a interface de controle sem conflito exclusivo com o driver nativo de cursor do sistema.
- **Ajuste de DPI (`0x51, 0x40`)**: até 5 estágios (`50..26000` DPI em `uint16` little-endian), quantidade de estágios no ciclo (`1..5`) e seleção imediata do estágio ativo.
- **Polling Rate (`0x51, 0x41`)**: `125 Hz`, `500 Hz` e `1000 Hz`, respeitando automaticamente a diferença de offset entre cabo (`buf[2]`) e receptor 2.4GHz (`buf[3]`).
- **Debounce Time / Keypress Response (`0x51, 0x43`)**: ajuste fino de `0` a `20 ms` (padrão de fábrica: `8 ms`).
- **LOD e Recursos PAW3395 (`0x51, 0x42`)**: *Lift-Off Distance* (`low` ~1mm / `high` ~2mm), *Ripple Control*, *Angle Snapping* e *Motion Sync*.
- **Iluminação RGB (`0x51, 0x22..0x27`)**: modos (`off`, `static`, `breathing`, `spectrum`, `wave`, `marquee`, `neon`), cor `#RRGGBB` / presets, brilho e velocidade.
  - *Nota de hardware*: o executável oficial `darmoshark.exe` compartilha a base `Keychron_driver.pdb` e implementa todos os pacotes RGB, porém oculta a aba RGB na interface do Darmoshark N3 porque a carcaça padrão do N3 possui apenas o LED indicador de DPI/status.
- **Leitura de Status e Monitoramento em Tempo Real**: leitura de firmware (`0x04`), porcentagem de bateria (`0x06`), tabela de DPI e polling ativos (`0x07`), ping 2.4GHz (`0x0C`) e escuta de *Input Reports* assíncronos (`0x54` / `0xE2` / `0xE3`).

---

## Instalação

```bash
npm install
```

Para executar globalmente no terminal como `n3ctl`:

```bash
npm link
```

### Permissões no macOS

Caso o macOS bloqueie o acesso ao `IOHIDDevice`, abra **Ajustes do Sistema → Privacidade e Segurança → Monitoramento de Entrada** (*Input Monitoring*) e habilite o seu aplicativo de Terminal (Terminal, iTerm2, Warp, VS Code / Antigravity).

---

## Uso Rápido

```bash
# 1. Detectar o mouse ou dongle 2.4GHz conectado
node ./bin/n3ctl.js devices

# 2. Ler versão de firmware, bateria, estágio de DPI ativo e polling rate
node ./bin/n3ctl.js status

# 3. Configurar 4 estágios de DPI e ativar o estágio 2 (800 DPI)
node ./bin/n3ctl.js dpi --stages 400,800,1600,3200 --active 2

# 4. Alterar apenas o estágio 1 para 600 DPI preservando os demais
node ./bin/n3ctl.js dpi --stage 1 --value 600 --active 1

# 5. Ajustar Polling Rate para 1000 Hz
node ./bin/n3ctl.js rate 1000

# 6. Ajustar Debounce Time para 4 ms
node ./bin/n3ctl.js debounce 4

# 7. Configurar LOD baixo (~1mm) e Motion Sync ligado (sem Angle Snap/Ripple)
node ./bin/n3ctl.js sensor --lod low --motion-sync on --angle-snap off --ripple off

# 8. Inspecionar pacotes em modo simulação (--dry-run) sem precisar do mouse plugado
node ./bin/n3ctl.js dpi --stages 400,800,1600,3200,4800 --active 2 --dry-run

# 9. Monitorar botões de DPI, bateria e repouso em tempo real
node ./bin/n3ctl.js monitor
```

---

## Resumo do Protocolo USB HID (Report ID `0x51` — 21 Bytes)

Todos os comandos de configuração utilizam **HID Feature Reports** de **21 bytes** (`0x15`), preenchidos com `0x00` e **sem checksum/CRC**:

| Comando | Opcode (`buf[1]`) | Payload Principal (`buf[2..20]`) |
| :--- | :---: | :--- |
| **Versão de Firmware** | `0x04` | `SetFeature` + `GetFeature` → `buf[3..11]` contém 9 bytes ASCII |
| **Status de Bateria** | `0x06` | `SetFeature` + `GetFeature` → Sem fio: `buf[11]` (`0..100%`); Cabo: `buf[12]` (`0..7`) |
| **Estado Ativo & DPI** | `0x07` | `GetFeature` → Cabo `buf[3]` / Sem fio `buf[4]` (`hiNibble`=rate, `loNibble`=stage); `buf[6..15]` = 5×`uint16_le` DPI |
| **Factory Reset** | `0x0B` | `buf[2] = 0xAA` |
| **Ping Sem Fio 2.4G** | `0x0C` | `buf[2] = 0x02` (responde via Input Report `0x54, 0xE3`) |
| **Modo RGB** | `0x22` | `buf[2] = 0x01`, `buf[3] = mode (0..6)` |
| **Brilho RGB** | `0x23` | `buf[2] = 0x01`, `buf[3] = mode`, `buf[4] = brightness (1..255)` |
| **Cor RGB (R / G / B)** | `0x24` / `0x25` / `0x26` | `buf[2] = 0x01`, `buf[3] = mode`, `buf[4] = canal (0..255)` |
| **Velocidade RGB** | `0x27` | `buf[2] = 0x01`, `buf[3] = mode`, `buf[4] = speed (1..255)` |
| **Estágios de DPI** | `0x40` | `buf[2..4] = activeIdx (0..4)`, `buf[5..14] = 5 × uint16_le DPI`, `buf[15] = count (1..5)` |
| **Polling Rate** | `0x41` | Cabo: `buf[2] = code`; Sem fio: `buf[3] = code` (`0`=125Hz, `1`=500Hz, `2`=1000Hz) |
| **LOD & Sensor PAW3395** | `0x42` | `buf[2] = lod (1..2)`, `buf[3] = ripple`, `buf[4] = angleSnap`, `buf[5] = motionSync` (`1`=ON, `2`=OFF) |
| **Debounce Time** | `0x43` | `buf[2] = ms (0..20)` |

---

## Testes Automatizados

```bash
npm test
```
