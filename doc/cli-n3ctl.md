# Documentação Oficial da CLI — `n3ctl` (N3 Control Center)

Guia completo de referência da ferramenta de linha de comando **`n3ctl`** para configuração e automação via terminal do mouse **Darmoshark N3** (sensor PixArt PAW3395 / MCU Telink `0x248A`) no **macOS**.

---

## 1. Visão Geral e Convivência com o App Desktop

A CLI `n3ctl` compartilha exatamente o mesmo motor de protocolo USB HID ([`src/protocol.js`](../src/protocol.js), [`src/keymap.js`](../src/keymap.js) e [`src/device.js`](../src/device.js)) do aplicativo desktop Electron:

- **Abertura não exclusiva (`nonExclusive: true`)**: utiliza `kIOHIDOptionsTypeNone` no `IOHIDManager` do macOS, permitindo enviar comandos de configuração sem `sudo`, sem travar o ponteiro do mouse e podendo conviver com o aplicativo da Menu Bar.
- **Transporte Dual Automático**:
  - **Cabo USB** (`0x248A:0xFF10`, `UsagePage 0xFFC1`) — priorizado automaticamente caso o cabo e o receptor estejam conectados ao mesmo tempo.
  - **Receptor 2.4GHz** (`0x248A:0xFF11`, `UsagePage 0xFFC0`) — inclui detecção automática de repouso/link RF inativo (`0xE0005000`).
- **Saída JSON e Simulação Offline**: todos os comandos aceitam `--json` (ideal para *Raycast Script Commands*, *Shortcuts* do macOS e *shell scripts*) e `--dry-run` (exibe os quadros HID de 21 ou 65 bytes sem tocar no hardware).

---

## 2. Instalação e Permissões no macOS

```bash
# Instalar dependências na raiz do projeto
npm install

# (Opcional) Disponibilizar o binário global `n3ctl` no PATH
npm link
```

Sem `npm link`, substitua `n3ctl` por `node ./bin/n3ctl.js` nos exemplos abaixo.

### Permissão de Monitoramento de Entrada
Se o macOS bloquear o acesso ao `IOHIDDevice`, abra **Ajustes do Sistema → Privacidade e Segurança → Monitoramento de Entrada** (*Input Monitoring*) e autorize seu emulador de terminal (Terminal, iTerm2, Warp, Ghostty, VS Code / Antigravity).

---

## 3. Flags Globais

| Flag | Descrição |
| :--- | :--- |
| `--connection <auto\|wired\|wireless>` | Força o transporte específico (`wired` = cabo `0xFF10`, `wireless` = dongle `0xFF11`) |
| `--dry-run` | Simula a execução offline e imprime os pacotes Feature Report (`0x51` / `0x52`) em hexadecimal |
| `-v`, `--verbose` | Exibe todos os quadros USB HID enviados (`SET_FEATURE`) e lidos (`GET_FEATURE`) |
| `--json` | Formata toda a resposta como JSON estruturado na `stdout` |
| `--state-file <caminho>` | Usa um arquivo JSON alternativo em vez de `~/.config/n3-control-center/state.json` |
| `-h`, `--help` | Exibe o resumo de comandos e opções |

---

## 4. Referência de Comandos

### 4.1. `n3ctl devices` — Descoberta de Hardware
Lista todas as interfaces USB HID compatíveis com o Darmoshark N3 conectadas ao Mac:

```bash
n3ctl devices
n3ctl devices --all-collections --json
```

---

### 4.2. `n3ctl status` — Telemetria Completa (Leitura Real)
Consulta versão de firmware (`0x04`), porcentagem de bateria e estado de carga (`0x06`), estágio de DPI ativo, tabela dos 5 estágios gravados na memória do mouse, quantidade de estágios e debounce atual (`0x07`):

```bash
n3ctl status
n3ctl status --connection wireless --json
```

---

### 4.3. `n3ctl dpi` — Estágios de DPI (`50..26000`)
Configura de `1` a `5` estágios de DPI em `uint16` little-endian (`0x51, 0x40`), quantos estágios participam do ciclo físico e qual estágio fica ativo imediatamente:

```bash
# Definir 5 estágios e ativar o estágio #2 (800 DPI)
n3ctl dpi --stages 400,800,1600,3200,4800 --active 2

# Alterar apenas o estágio #1 para 600 DPI mantendo os demais intactos
n3ctl dpi --stage 1 --value 600 --active 1

# Limitar o ciclo físico a apenas 2 estágios (400 e 1600 DPI)
n3ctl dpi --stages 400,1600 --count 2 --active 1
```

---

### 4.4. `n3ctl rate` — Polling Rate (`125 | 500 | 1000 Hz`)
Ajusta a taxa de atualização USB/RF (`0x51, 0x41`), adaptando automaticamente o byte de destino entre cabo (`buf[2]`) e receptor 2.4GHz (`buf[3]`):

```bash
n3ctl rate 1000   # LED inferior: Verde
n3ctl rate 500    # LED inferior: Azul
n3ctl rate 125    # LED inferior: Vermelho
```

---

### 4.5. `n3ctl debounce` — Tempo de Resposta de Clique (`0..20 ms`)
Ajusta o filtro de debounce mecânico dos switches principais (`0x51, 0x43`, padrão de fábrica: `8 ms`):

```bash
n3ctl debounce 4
n3ctl debounce 8
```

---

### 4.6. `n3ctl sensor` — LOD e Recursos PixArt PAW3395
Configura a altura de *Lift-Off Distance* (`low` ~1mm ou `high` ~2mm) e os algoritmos internos do PAW3395 (`0x51, 0x42`):

```bash
n3ctl sensor --lod low --motion-sync on --angle-snap off --ripple off
n3ctl sensor --lod high --ripple on
```

---

### 4.7. `n3ctl button` — Remapeamento dos 7 Botões Físicos (`0x52, 0x52`)

#### Identificação dos Botões (`1..7` ou apelidos)
| Nº | Apelidos Aceitos | Posição Física | `hwId` no Protocolo | Padrão de Fábrica |
| :---: | :--- | :--- | :---: | :--- |
| `1` | `left`, `lmb` | Clique Esquerdo | `0x00` | `mouse: left-click` |
| `2` | `right`, `rmb` | Clique Direito | `0x02` *(invertido c/ #3)* | `mouse: right-click` |
| `3` | `middle`, `mmb`, `wheel` | Clique do Meio (Scroll) | `0x01` *(invertido c/ #2)* | `mouse: middle-click` |
| `4` | `forward`, `btn4`, `mouse4` | Lateral Frontal (Avançar) | `0x03` | `mouse: button-4` |
| `5` | `back`, `btn5`, `mouse5` | Lateral Traseiro (Voltar) | `0x04` | `mouse: button-5` |
| `6` | `dpi+`, `cpi+`, `dpi-up` | Inferior `CPI+` | `0x05` | `dpi: dpi-up` |
| `7` | `dpi-`, `cpi-`, `dpi-down` | Inferior `CPI-` | `0x06` | `dpi: dpi-down` |

#### Exemplos de Mapeamento
```bash
# Listar o mapeamento salvo dos 7 botões
n3ctl button list

# Atalhos nativos do macOS (suporta cmd, opt/alt, ctrl, shift + 98 teclas OEM e F13..F24)
n3ctl button 4 --combo cmd+c
n3ctl button 5 --combo cmd+shift+4

# Controles de Multimídia (volume-up, volume-down, mute, play-pause, next-track, prev-track, stop, player)
n3ctl button 5 --media play-pause

# Funções de Mouse (left-click, right-click, middle-click, button-4, button-5, double-click, scroll-up/down/left/right)
n3ctl button 4 --mouse double-click

# Funções de DPI (loop, dpi-up, dpi-down)
n3ctl button 6 --dpi loop

# Atalhos de Sistema (brightness-up e brightness-down ajustam o brilho da tela nativamente no macOS!)
n3ctl button 6 --system brightness-up
n3ctl button 7 --system brightness-down

# Modo Turbo / Fire Key (intervalo em ms + repetições; 0 = contínuo enquanto segurar)
n3ctl button 4 --turbo left --interval 25 --repeat 0

# Desativar um botão físico
n3ctl button 7 --disable

# Restaurar apenas os 7 botões para o padrão de fábrica (sem alterar DPI/sensor)
n3ctl button reset --confirm
```

> **Proteção Anti-Bloqueio do Clique Esquerdo:** o `n3ctl` impede sobrescrever o Botão 1 caso nenhum outro botão esteja configurado como `left-click`. Para configurar **modo canhoto**, mapeie primeiro o Botão 2 para `left-click` (`n3ctl button 2 --mouse left-click`) e em seguida o Botão 1 para `right-click` (`n3ctl button 1 --mouse right-click`).

---

### 4.8. `n3ctl macro` — Upload Paginado de Macros Onboard (`0x52, 0x55`)
Grava sequências de até **255 eventos** de 4 bytes diretamente na memória onboard do mouse (paginadas em blocos de 13 eventos por pacote de 65 bytes):

```bash
# Sequência rápida via expressão (--seq): Cmd+C -> espera 40ms -> Cmd+V no Botão 4
n3ctl macro --button 4 --name colar-rapido --seq "cmd+c,delay:40,cmd+v" --loop count --repeat 1

# Repetir continuamente enquanto o botão estiver pressionado (--loop hold -> 0x2001)
n3ctl macro --button 5 --seq "click:left,delay:30" --loop hold

# Alternar repetição até qualquer tecla ser pressionada (--loop toggle -> 0x4001)
n3ctl macro --button 5 --seq "space,delay:50" --loop toggle

# Carregar macro detalhada a partir de um arquivo JSON
n3ctl macro --button 4 --file ./minha-macro.json

# Listar macros salvas no perfil local
n3ctl macro list
```

#### Formato JSON de Macro (`--file`)
```json
{
  "name": "recoil-assist",
  "loopMode": "hold",
  "loopCount": 1,
  "events": [
    { "type": "mouse-down", "button": "left" },
    { "type": "delay", "ms": 25 },
    { "type": "move", "dx": 0, "dy": 4 },
    { "type": "mouse-up", "button": "left" }
  ]
}
```
Tipos de eventos suportados: `key-down`, `key-up`, `mouse-down`, `mouse-up`, `delay` (`1..65535 ms`), `move` (`dx, dy` inteiros `-128..127`), além dos atalhos compostos `tap` e `click`.

---

### 4.9. `n3ctl apply`, `n3ctl monitor`, `n3ctl reset` e `n3ctl rgb`

```bash
# Reaplicar todo o perfil salvo (incluindo botões se desejar)
n3ctl apply --include-buttons

# Aplicar um arquivo de perfil exportado
n3ctl apply --file ./perfil-fps.json --include-buttons

# Monitorar em tempo real eventos do hardware (troca física de DPI, bateria, sleep/wake — Report 0x54)
n3ctl monitor

# Restauração global de fábrica do MCU (0x51 0x0B 0xAA)
n3ctl reset --confirm

# Diagnóstico de pacotes RGB OEM (mantido apenas na CLI; oculto na UI pois o N3 padrão não possui fita RGB)
n3ctl rgb --rgb-mode off --dry-run
```
