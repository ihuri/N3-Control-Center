# N3 Control Center (App Desktop macOS + CLI `n3ctl`)

Aplicativo Desktop nativo para **macOS** (**Electron + React 19 + Tailwind CSS 4**) com integração **Menu Bar Híbrida / Hidden Bar** e utilitário de linha de comando (`n3ctl` via `node-hid`) para configurar e monitorar o mouse **Darmoshark N3** (sensor PixArt PAW3395 / MCU Telink `0x248A`), construído a partir da engenharia reversa 100% completa (`31/31` call sites HID) do instalador oficial Windows `Darmoshark N3 Mouse1.0.7.2.exe`.

## Destaques do Aplicativo macOS

- **Réplica 1:1 da Interface Original em Alta Definição (Retina)**:
  - Utiliza os recursos gráficos reais extraídos do instalador oficial (`public/oem/*`: emblema Darmoshark, ícones laterais `menu_key`, `menu_pointer`, `menu_macro`, `menu_sysset`, bateria `power0..7` e foto 3D do N3) combinados com tipografia vetorial nítida em **PT-BR** e **EN** (sem aba RGB na interface gráfica).
  - **5 Abas Completas**:
    1. **Botões & Debounce (`0x52, 0x52` e `0x51, 0x43`)**: remapeamento dos 7 botões físicos com callouts interativos sobre o mouse 3D, gravador ao vivo de atalhos do macOS (`⌘ Cmd`, `⌥ Opt`, `⇧ Shift`, `⌃ Ctrl`, `F13..F24`), presets macOS, multimídia, ciclo de DPI, *Turbo / Fire Key*, brilho de tela, vínculo de macros e ajuste de *Keypress Response* (`0..20 ms`).
    2. **Ponteiro, DPI & Report Rate (`0x51, 0x40` e `0x51, 0x41`)**: até 5 estágios (`50..26000` DPI) com as cores oficiais de LED (`#F10900`, `#056BE2`, `#09F148`, `#B606FA`, `#ECF11D`), régua graduada com cursor `▲` laranja, entrada numérica exata e seletor `125HZ / 500HZ / 1000HZ`.
    3. **Editor de Macros (`0x52, 0x55`)**: gravação ao vivo de teclado e cliques, modos de delay (*tempo real*, *fixo* ou *sem delay*), repetição (*enquanto segurar*, *toggle* ou *N vezes*) e upload paginado para a memória onboard do mouse.
    4. **Sistema & Sensor PAW3395 (`0x51, 0x42`)**: *LOD Height* (`Low ~1mm` / `High ~2mm`), *Ripple Control*, *Angle Snap*, *Motion Sync* e atalho direto para os Ajustes de Mouse do macOS.
    5. **Menu Bar Híbrida & Automações macOS (`⌘`)**:
       - **Modo Híbrido na Menu Bar / Hidden Bar**: **Clique Esquerdo** abre o *Mini Control Center Popover* translúcido; **Clique Direito** (ou `Ctrl+Clique`) abre o menu nativo `NSMenu`; texto configurável com **`%` da Bateria** e **`DPI` atual** (`monospacedDigit`).
       - **5 Automações Inteligentes**: *Auto-Eco* (reduz Polling Rate na bateria baixa ou no Modo Pouca Energia do macOS), **HUD translúcido na tela** ao trocar DPI pelos botões físicos `CPI+/CPI-` (`0x54 / 0xE2`), notificações nativas de bateria (`20%` e `10%`), **Perfis Automáticos por Aplicativo em Foco** e **Modo Dockless + Iniciar no Login**.

---

## Executando o Aplicativo Desktop no macOS

```bash
# Modo Desenvolvimento (Vite HMR + Electron)
npm run dev

# Build de produção da UI + abrir aplicativo Electron
npm start

# Gerar pacote nativo macOS (.app em release/mac-arm64/N3 Control Center.app)
npm run pack:mac

# Gerar instalador .dmg para macOS
npm run dist:mac
```

Para instalar no macOS, basta mover `release/mac-arm64/N3 Control Center.app` para a pasta `/Applications`.

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
- **Remapeamento Completo dos 7 Botões (`0x52, 0x52` — 65B)**: suporte às 8 categorias originais (cliques/scroll de mouse, atalhos de teclado/macOS `Cmd/Ctrl/Opt/Shift`, multimídia, ciclo de DPI, iluminação, *Turbo / Fire Key*, atalhos de sistema e desativação de botão), além de reset dedicado de botões (`0x51, 0x0B, 0x01, 0x01`) e trava de segurança contra perda do último clique esquerdo.
- **Macros Onboard Paginadas (`0x52, 0x55` — 65B)**: gravação na memória do mouse de sequências de até `255` eventos (`key-down/up`, `mouse-down/up`, `delay` em `uint16_le` e movimento relativo `int8`) em blocos de 13 eventos por pacote, nos modos *N repetições*, *enquanto pressionado* (`0x2001`) ou *alternar até próxima tecla* (`0x4001`).
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

# 10. Remapear Botão 4 (Avançar) para Cmd+C e Botão 5 (Voltar) para Play/Pause
node ./bin/n3ctl.js button 4 --combo cmd+c
node ./bin/n3ctl.js button 5 --media play-pause

# 11. Gravar macro onboard (Cmd+C -> 40ms -> Cmd+V) no Botão 4
node ./bin/n3ctl.js macro --button 4 --seq "cmd+c,delay:40,cmd+v" --loop count --repeat 1
```

> Consulte o manual completo da CLI em [`doc/cli-n3ctl.md`](./doc/cli-n3ctl.md) e o plano do app desktop macOS em [`doc/plano-implementacao-macos-electron.md`](./doc/plano-implementacao-macos-electron.md).

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

## Resumo do Protocolo USB HID — Botões e Macros (Report ID `0x52` — 65 Bytes)

Os comandos de remapeamento de botões e gravação de macros utilizam **HID Feature Reports** de **65 bytes** (`0x41`). Os 7 botões físicos mapeiam para `hwId = [0x00, 0x02, 0x01, 0x03, 0x04, 0x05, 0x06]` (os botões `2: Direito` e `3: Meio` possuem IDs invertidos no firmware):

| Comando | Cabeçalho (`buf[0..3]`) | Payload (`buf[4..64]`) |
| :--- | :---: | :--- |
| **Desativar Botão** | `52 52 hwId 00` | `buf[4] = 0x00` |
| **Botão → Mouse** | `52 52 hwId 00` | `buf[4] = 0x01`, `buf[5..7]` = máscara de clique/scroll (`01/02/04/08/10/80` ou `02/FE`) |
| **Botão → Tecla / Atalho** | `52 52 hwId 00` | `buf[4] = 0x02`, `buf[5] = modMask` (`Ctrl=1, Shift=2, Opt=4, Cmd=8`), `buf[6..7] = hidKey1, hidKey2` |
| **Botão → Multimídia** | `52 52 hwId 00` | `buf[4] = 0x03`, `buf[5..6] = consumerUsage_le` (ex.: `CD 00` Play/Pause, `E9 00` Vol+) |
| **Botão → Sensibilidade** | `52 52 hwId 00` | `buf[4] = 0x05`, `buf[5] = 0x01` (Loop), `0x02` (DPI+), `0x03` (DPI-) |
| **Botão → Iluminação** | `52 52 hwId 00` | `buf[4] = 0x06`, `buf[5] = 0x01..0x04` (efeito, velocidade, cor, brilho) |
| **Botão → Turbo / Fire** | `52 52 hwId 00` | `buf[4] = 0x07`, `buf[5] = 0x01`, `buf[6] = btnMask`, `buf[7..8] = ms_le`, `buf[9..10] = count_le` |
| **Botão → Sistema** | `52 52 hwId 00` | `buf[4] = 0x08`, `buf[5..7]` = atalho Consumer (`0x0C`) ou Keyboard (`0x07`) |
| **Reset Só dos Botões** | `51 0B 01 01` | Quadro de 65 bytes preenchido com zeros a partir de `buf[4]` |
| **Upload de Macro** | `52 55 hwId more` | Paginado em até 13 eventos de 4B/pacote (`0x81/0x01` tecla, `0x88/0x08` mouse, `0x0F` delay, `0x09` move) |

---

## Testes Automatizados

```bash
npm test
```
