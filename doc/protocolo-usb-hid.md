# Protocolo USB HID — Darmoshark N3 (PixArt PAW3395 / Telink MCU)

Este documento descreve detalhadamente o protocolo binário de comunicação USB HID utilizado pelo mouse **Darmoshark N3** (Modos Com Fio e Sem Fio 2.4GHz), documentado através de engenharia reversa do driver oficial Windows v1.0.7.2 (`Darmoshark N3 Mouse1.0.7.2.exe`) utilizando **REA** e **NSA Ghidra**.

---

## 1. Identificação de Hardware USB

| Parâmetro | Modo Com Fio (USB Cable) | Modo Sem Fio (2.4G Dongle) |
| :--- | :--- | :--- |
| **Vendor ID (VID)** | `0x248A` (Telink Semiconductor) | `0x248A` (Telink Semiconductor) |
| **Product ID (PID)** | `0xFF10` | `0xFF11` |
| **Usage Page** | `0xFFC1` (Vendor-defined) | `0xFFC0` (Vendor-defined) |
| **Usage** | `0x0001` | `0x0001` |
| **Interface** | `0` ou `1` | `0` ou `1` |

> **Nota macOS**: Por utilizar *Vendor-Defined Usage Pages* (`0xFFC1` e `0xFFC0`), o subsistema `IOHIDFamily` do macOS permite abrir a interface de comando sem conflito exclusivo com o driver nativo de cursor (`Generic Desktop / Mouse`).

---

## 2. Feature Reports de Configuração Geral (Report ID `0x51` — 21 Bytes)

Todos os pacotes de configuração de ponteiro, sensor, debounce e iluminação possuem exatamente **21 bytes** (`0x15`), preenchidos com `0x00` até o fim do buffer e **sem checksum/CRC**:

| Comando | Opcode (`buf[1]`) | Estrutura de Payload (`buf[2..20]`) | Função no Driver Oficial (Ghidra) |
| :--- | :---: | :--- | :--- |
| **Versão de Firmware** | `0x04` | `SetFeature` seguido de `GetFeature` → `buf[3..11]` contém 9 bytes ASCII | `FUN_00441df0` |
| **Nível de Bateria** | `0x06` | `SetFeature` seguido de `GetFeature` → Sem fio: `buf[11]` (`0..100%`); Cabo: `buf[12]` (`0..7` estágios) | `FUN_004427c0` |
| **Estado Ativo & DPI** | `0x07` | `GetFeature` → Cabo: `buf[3]`, Sem fio: `buf[4]` (`hiNibble`=taxa, `loNibble`=estágio ativo); `buf[6..15]` = 5 × `uint16_le` DPI | `FUN_00442870` |
| **Factory Reset** | `0x0B` | `buf[2] = 0xAA` | `FUN_004423b0` |
| **Ping Sem Fio 2.4G** | `0x0C` | `buf[2] = 0x02` (solicita confirmação de presença do mouse via Input Report `0x54, 0xE3`) | `FUN_004455f0` |
| **Modo RGB** | `0x22` | `buf[2] = 0x01`, `buf[3] = mode (0..6)` | `FUN_00443c50` |
| **Brilho RGB** | `0x23` | `buf[2] = 0x01`, `buf[3] = mode`, `buf[4] = brightness (1..255)` | `FUN_00443cf0` |
| **Cores RGB (R / G / B)** | `0x24..0x26` | `buf[2] = 0x01`, `buf[3] = mode`, `buf[4] = canal R/G/B (0..255)` | `FUN_00443d90` |
| **Velocidade RGB** | `0x27` | `buf[2] = 0x01`, `buf[3] = mode`, `buf[4] = speed (1..255)` | `FUN_00443e40` |
| **Estágios de DPI** | `0x40` | `buf[2..4] = activeIdx (0..4)`, `buf[5..14] = 5 × uint16_le DPI`, `buf[15] = count (1..5)` | `FUN_00442a40` |
| **Polling Rate** | `0x41` | Cabo: `buf[2] = code`; Sem fio: `buf[3] = code` (`0`=125Hz, `1`=500Hz, `2`=1000Hz) | `FUN_00443f40` |
| **LOD & Sensor PAW3395** | `0x42` | `buf[2] = lod (1=Low ~1mm, 2=High ~2mm)`, `buf[3] = ripple`, `buf[4] = angleSnap`, `buf[5] = motionSync` (`1`=ON, `2`=OFF) | `FUN_00443eb0` |
| **Debounce Time** | `0x43` | `buf[2] = tempo em ms (0..20)` | `FUN_00445320` |

---

## 3. Feature Reports de Botões e Macros (Report ID `0x52` — 65 Bytes)

Os comandos de remapeamento físico e motor de macros utilizam buffers de **65 bytes** (`0x41`).

### Tabela de Mapeamento de IDs Físicos
No firmware Telink do Darmoshark N3, os 7 botões são indexados da seguinte forma:
```js
// Atenção à inversão de hardware dos botões 2 e 3 descoberta no Ghidra (0x4b7de4):
// Botão 1 (Esquerdo): 0x00
// Botão 2 (Direito):  0x02  <-- INVERTIDO NO FIRMWARE
// Botão 3 (Meio):     0x01  <-- INVERTIDO NO FIRMWARE
// Botão 4 (Avançar):  0x03
// Botão 5 (Voltar):   0x04
// Botão 6 (DPI +):    0x05
// Botão 7 (DPI -):    0x06
```

### Categorias de Remapeamento (`0x52, 0x52`)

| Categoria | Cabeçalho (`buf[0..3]`) | Payload (`buf[4..64]`) | Exemplo / Comportamento |
| :--- | :--- | :--- | :--- |
| **Desativar Botão** | `52 52 hwId 00` | `buf[4] = 0x00` | Botão físico não emite eventos |
| **Ação de Mouse** | `52 52 hwId 00` | `buf[4] = 0x01`, `buf[5..7] = mask` | `01` esq, `02` dir, `04` meio, `08` btn4, `10` btn5, `80` clique duplo |
| **Tecla / Atalho** | `52 52 hwId 00` | `buf[4] = 0x02`, `buf[5] = mod`, `buf[6..7] = hidKey` | `mod`: Ctrl=1, Shift=2, Alt=4, Win/Cmd=8 |
| **Multimídia** | `52 52 hwId 00` | `buf[4] = 0x03`, `buf[5..6] = usage_le` | `CD 00` Play/Pause, `E9 00` Vol+, `EA 00` Vol- |
| **Sensibilidade / DPI**| `52 52 hwId 00` | `buf[4] = 0x05`, `buf[5] = mode` | `01` Loop DPI, `02` DPI+, `03` DPI- |
| **Iluminação** | `52 52 hwId 00` | `buf[4] = 0x06`, `buf[5] = mode` | `01` modo, `02` velocidade, `03` cor, `04` brilho |
| **Turbo / Fire Key** | `52 52 hwId 00` | `buf[4] = 0x07`, `buf[5]=01, buf[6]=btn, buf[7..8]=ms, buf[9..10]=count` | Rajada repetitiva de cliques |
| **Atalho de Sistema** | `52 52 hwId 00` | `buf[4] = 0x08`, `buf[5..7] = usage` | `0x0C` (Consumer) ou `0x07` (Keyboard) |
| **Reset dos Botões** | `51 0B 01 01` | Quadro de 65 bytes preenchido com zeros | Restaura o layout padrão de fábrica |

### Gravação de Macros Onboard Paginadas (`0x52, 0x55`)
- Suporta até **255 eventos** no total.
- Cada pacote HID carrega até **13 eventos** (4 bytes por evento: tipo, código, parâmetro `uint16_le`).
- Modos de execução:
  - `0x0001`: Executar N vezes (`loopCount`).
  - `0x2001`: Executar continuamente enquanto o botão estiver pressionado (*Hold*).
  - `0x4001`: Alternar execução (*Toggle* — repete até ser pressionado novamente).

---

## 4. Input Reports Assíncronos em Tempo Real (Report ID `0x54`)

O mouse envia eventos espontâneos pela interface HID:
- **`0x54, 0xE2`**: Mudança de DPI ou taxa via botão físico. `buf[2]` contém o índice do novo estágio ativo (`1..5`).
- **`0x54, 0xE3`**: Presença e reconexão sem fio 2.4GHz.
