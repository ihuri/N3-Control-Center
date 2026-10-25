import React, { useEffect, useState } from 'react';
import {
  MAC_COMBO_PRESETS,
  formatButtonActionLabel,
  formatComboPretty,
  mapDomKeyEventToHidName,
} from '../i18n.js';

const CATEGORY_KEYS = ['mouse', 'combo', 'media', 'dpi', 'turbo', 'system', 'macro', 'disable'];

export function ButtonsTab({
  profile,
  macros,
  lang,
  t,
  selectedBtn,
  onSelectBtn,
  api,
  onNotifyError,
}) {
  const currentMapping = profile.buttons?.[selectedBtn] || {
    category: 'mouse',
    action: 'left-click',
  };

  const [activeCat, setActiveCat] = useState(
    CATEGORY_KEYS.includes(currentMapping.category) ? currentMapping.category : 'mouse',
  );
  const [comboText, setComboText] = useState(currentMapping.combo || 'cmd+c');
  const [recordingCombo, setRecordingCombo] = useState(false);

  const [turboBtn, setTurboBtn] = useState(currentMapping.button || 'left');
  const [turboInterval, setTurboInterval] = useState(currentMapping.intervalMs ?? 20);
  const [turboRepeat, setTurboRepeat] = useState(currentMapping.repeatCount ?? 0);

  const [selectedMacroId, setSelectedMacroId] = useState(
    currentMapping.macroId || macros[0]?.id || '',
  );

  useEffect(() => {
    const cfg = profile.buttons?.[selectedBtn] || { category: 'mouse', action: 'left-click' };
    setActiveCat(CATEGORY_KEYS.includes(cfg.category) ? cfg.category : 'mouse');
    if (cfg.combo) setComboText(cfg.combo);
    if (cfg.button) setTurboBtn(cfg.button);
    if (typeof cfg.intervalMs === 'number') setTurboInterval(cfg.intervalMs);
    if (typeof cfg.repeatCount === 'number') setTurboRepeat(cfg.repeatCount);
    if (cfg.macroId) setSelectedMacroId(cfg.macroId);
    else if (macros[0]?.id && !selectedMacroId) setSelectedMacroId(macros[0].id);
    setRecordingCombo(false);
  }, [selectedBtn, profile.buttons, macros]);

  // Gravação ao vivo de atalhos de teclado do macOS
  useEffect(() => {
    if (!recordingCombo) return undefined;

    const heldMods = new Set();
    const pressedKeys = [];

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape' && heldMods.size === 0 && pressedKeys.length === 0) {
        setRecordingCombo(false);
        return;
      }

      const mapped = mapDomKeyEventToHidName(e);
      if (!mapped) return;

      if (mapped.isModifier) {
        // Normaliza modificador p/ canônico curto
        const normMod = mapped.key.startsWith('r') ? mapped.key : mapped.key;
        heldMods.add(normMod);
      } else if (!pressedKeys.includes(mapped.key) && pressedKeys.length < 2) {
        pressedKeys.push(mapped.key);
      }

      const tokens = [...heldMods, ...pressedKeys];
      if (tokens.length > 0) {
        setComboText(tokens.join('+'));
      }
    };

    const handleKeyUp = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pressedKeys.length > 0 || heldMods.size > 0) {
        setRecordingCombo(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [recordingCombo]);

  const applyButtonConfig = async (actionConfig) => {
    try {
      await api.setButton(selectedBtn, actionConfig);
    } catch (err) {
      const msg = String(err?.message || err);
      if (/Clique Esquerdo|left-click/i.test(msg)) {
        onNotifyError?.(t.leftClickGuardError);
      } else {
        onNotifyError?.(msg);
      }
    }
  };

  const applyMacroBinding = async () => {
    if (!selectedMacroId) return;
    try {
      await api.bindMacroToButton(selectedBtn, selectedMacroId);
    } catch (err) {
      onNotifyError?.(String(err?.message || err));
    }
  };

  const changeDebounce = async (delta) => {
    const next = Math.max(0, Math.min(20, (profile.debounceMs ?? 8) + delta));
    try {
      await api.setDebounce(next);
    } catch (err) {
      onNotifyError?.(err.message);
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="bg-[#05070a]/95 border border-[#4a4e54] px-4 py-2.5 flex items-center justify-between">
        <span className="text-base font-medium">{t.keyTitle}</span>
        <button
          type="button"
          onClick={() => api.resetButtons().catch((e) => onNotifyError?.(e.message))}
          className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer"
        >
          <span>↺</span>
          <span>{t.resetButtons}</span>
        </button>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Lista OEM dos 7 Botões Físicos */}
        <div className="col-span-6 bg-[#05070a]/95 border border-[#4a4e54] p-3 space-y-2">
          <div className="text-sm font-medium mb-1">{t.btnFunc}</div>
          <div className="space-y-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((num) => {
              const active = num === selectedBtn;
              const label = formatButtonActionLabel(profile.buttons?.[num], macros, lang);
              return (
                <div key={num} className="flex items-center gap-2">
                  <span className="w-4 text-xs text-zinc-400 font-mono text-right">{num}</span>
                  <button
                    type="button"
                    onClick={() => onSelectBtn(num)}
                    className={`${
                      active
                        ? 'bg-white text-black font-bold'
                        : 'bg-[#5c5e62] text-white hover:bg-[#707378]'
                    } flex-1 px-2.5 py-1.5 text-xs flex items-center justify-between transition truncate cursor-pointer`}
                  >
                    <span className="truncate pr-1">{label}</span>
                    <span className="text-[10px] opacity-75 shrink-0">▾</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel OEM de atribuição para o botão selecionado */}
        <div className="col-span-6 bg-[#05070a]/95 border border-[#4a4e54] p-3 flex flex-col justify-between space-y-2.5 text-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
              <span className="font-bold text-white">
                {t.btnWord} #{selectedBtn}
              </span>
              <span className="text-[11px] text-zinc-400 truncate max-w-[140px]">
                {formatButtonActionLabel(currentMapping, macros, lang)}
              </span>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">{t.catLabel}</label>
              <select
                value={activeCat}
                onChange={(e) => setActiveCat(e.target.value)}
                className="w-full bg-[#181b20] border border-[#5a5e66] px-2 py-1 text-xs text-white cursor-pointer"
              >
                {CATEGORY_KEYS.map((catKey) => (
                  <option key={catKey} value={catKey}>
                    {t.cats[catKey]}
                  </option>
                ))}
              </select>
            </div>

            {/* Opções dinâmicas por categoria */}
            {activeCat === 'mouse' && (
              <div className="space-y-1 max-h-[195px] overflow-y-auto pr-0.5">
                {Object.entries(t.mouseActions).map(([actKey, label]) => {
                  const isCur =
                    currentMapping.category === 'mouse' && currentMapping.action === actKey;
                  return (
                    <button
                      key={actKey}
                      type="button"
                      onClick={() => applyButtonConfig({ category: 'mouse', action: actKey })}
                      className={`w-full px-2.5 py-1 text-left transition cursor-pointer ${
                        isCur
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#23262b] text-zinc-200 hover:bg-zinc-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {activeCat === 'combo' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setRecordingCombo((v) => !v)}
                  className={`w-full py-1.5 px-2 font-medium flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                    recordingCombo
                      ? 'bg-red-600 border-red-400 text-white animate-pulse'
                      : 'bg-[#23262b] border-[#5a5e66] text-white hover:bg-zinc-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  <span>{recordingCombo ? t.comboRecording : t.comboRecordIdle}</span>
                </button>

                <div className="flex gap-1">
                  <input
                    type="text"
                    value={comboText}
                    onChange={(e) => setComboText(e.target.value)}
                    placeholder={t.comboInputPlaceholder}
                    className="flex-1 min-w-0 bg-[#181b20] border border-[#5a5e66] px-2 py-1 font-mono text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      applyButtonConfig({ category: 'combo', combo: comboText.trim() })
                    }
                    className="bg-white text-black font-semibold px-2.5 py-1 hover:bg-zinc-200 transition shrink-0 cursor-pointer"
                  >
                    OK
                  </button>
                </div>

                {comboText && (
                  <div className="text-[11px] text-zinc-400 truncate">
                    → <span className="text-zinc-200 font-medium">{formatComboPretty(comboText)}</span>
                  </div>
                )}

                <div className="pt-1 border-t border-zinc-800">
                  <div className="text-[10px] text-zinc-400 mb-1">{t.comboPresetsTitle}</div>
                  <div className="space-y-1 max-h-[95px] overflow-y-auto pr-0.5">
                    {MAC_COMBO_PRESETS.map((p) => (
                      <button
                        key={p.combo}
                        type="button"
                        onClick={() => {
                          setComboText(p.combo);
                          applyButtonConfig({ category: 'combo', combo: p.combo });
                        }}
                        className="w-full px-2 py-1 text-left bg-[#23262b] hover:bg-zinc-700 text-[11px] text-zinc-200 transition cursor-pointer"
                      >
                        {lang === 'en' ? p.labelEn : p.labelPt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeCat === 'media' && (
              <div className="space-y-1 max-h-[195px] overflow-y-auto pr-0.5">
                {Object.entries(t.mediaActions).map(([actKey, label]) => {
                  const isCur =
                    currentMapping.category === 'media' && currentMapping.action === actKey;
                  return (
                    <button
                      key={actKey}
                      type="button"
                      onClick={() => applyButtonConfig({ category: 'media', action: actKey })}
                      className={`w-full px-2.5 py-1 text-left transition cursor-pointer ${
                        isCur
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#23262b] text-zinc-200 hover:bg-zinc-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {activeCat === 'dpi' && (
              <div className="space-y-1">
                {Object.entries(t.dpiActions).map(([actKey, label]) => {
                  const isCur =
                    currentMapping.category === 'dpi' && currentMapping.action === actKey;
                  return (
                    <button
                      key={actKey}
                      type="button"
                      onClick={() => applyButtonConfig({ category: 'dpi', action: actKey })}
                      className={`w-full px-2.5 py-1.5 text-left transition cursor-pointer ${
                        isCur
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#23262b] text-zinc-200 hover:bg-zinc-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {activeCat === 'turbo' && (
              <div className="space-y-2 pt-1">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-0.5">{t.turboTarget}</label>
                  <select
                    value={turboBtn}
                    onChange={(e) => setTurboBtn(e.target.value)}
                    className="w-full bg-[#181b20] border border-[#5a5e66] px-2 py-1 text-white"
                  >
                    <option value="left">{t.mouseActions['left-click']}</option>
                    <option value="right">{t.mouseActions['right-click']}</option>
                    <option value="middle">{t.mouseActions['middle-click']}</option>
                    <option value="button-4">{t.mouseActions['button-4']}</option>
                    <option value="button-5">{t.mouseActions['button-5']}</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-0.5">
                      {t.turboInterval}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={turboInterval}
                      onChange={(e) => setTurboInterval(Number(e.target.value))}
                      className="w-full bg-[#181b20] border border-[#5a5e66] px-2 py-1 font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-0.5">
                      {t.turboRepeat}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={turboRepeat}
                      onChange={(e) => setTurboRepeat(Number(e.target.value))}
                      className="w-full bg-[#181b20] border border-[#5a5e66] px-2 py-1 font-mono text-white"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    applyButtonConfig({
                      category: 'turbo',
                      button: turboBtn,
                      intervalMs: Math.max(1, Math.round(turboInterval)),
                      repeatCount: Math.max(0, Math.round(turboRepeat)),
                    })
                  }
                  className="w-full bg-white text-black font-semibold py-1.5 hover:bg-zinc-200 transition cursor-pointer"
                >
                  {t.applyTurbo}
                </button>
              </div>
            )}

            {activeCat === 'system' && (
              <div className="space-y-1 max-h-[195px] overflow-y-auto pr-0.5">
                {Object.entries(t.systemActions).map(([actKey, label]) => {
                  const isCur =
                    currentMapping.category === 'system' && currentMapping.action === actKey;
                  return (
                    <button
                      key={actKey}
                      type="button"
                      onClick={() => applyButtonConfig({ category: 'system', action: actKey })}
                      className={`w-full px-2.5 py-1 text-left transition cursor-pointer ${
                        isCur
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#23262b] text-zinc-200 hover:bg-zinc-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {activeCat === 'macro' && (
              <div className="space-y-2.5 pt-1">
                {macros.length === 0 ? (
                  <p className="text-zinc-400 text-xs">{t.noMacrosYet}</p>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">
                        {t.selectMacro}
                      </label>
                      <select
                        value={selectedMacroId}
                        onChange={(e) => setSelectedMacroId(e.target.value)}
                        className="w-full bg-[#181b20] border border-[#5a5e66] px-2 py-1 text-white"
                      >
                        {macros.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.events?.length || 0} evt)
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={applyMacroBinding}
                      className="w-full bg-white text-black font-semibold py-1.5 hover:bg-zinc-200 transition cursor-pointer"
                    >
                      {t.bindMacroBtn}
                    </button>
                  </>
                )}
              </div>
            )}

            {activeCat === 'disable' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => applyButtonConfig({ category: 'disable' })}
                  className="w-full bg-[#6d6e71] hover:bg-white hover:text-black text-white font-semibold py-2 transition cursor-pointer"
                >
                  {t.disableBtnAction}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Caixa Keypress Response (Debounce 0..20ms) idêntica a keydlgbg.bmp1 */}
      <div className="bg-[#05070a]/95 border border-[#4a4e54] p-2.5 inline-block">
        <div className="bg-[#6d6e71] px-3 py-1.5 flex items-center gap-3 text-xs">
          <span className="font-medium leading-tight">{t.debounce}</span>
          <button
            type="button"
            onClick={() => changeDebounce(-1)}
            className="px-2 font-bold text-sm hover:text-black cursor-pointer"
          >
            −
          </button>
          <span className="bg-[#434548] px-3 py-0.5 font-mono font-semibold min-w-[56px] text-center">
            {profile.debounceMs ?? 8} ms
          </span>
          <button
            type="button"
            onClick={() => changeDebounce(1)}
            className="px-2 font-bold text-sm hover:text-black cursor-pointer"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
