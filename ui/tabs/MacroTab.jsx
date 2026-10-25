import React, { useEffect, useRef, useState } from 'react';
import { formatHidKeyPretty, mapDomKeyEventToHidName } from '../i18n.js';

function OemRadio({ checked, label, onClick, children }) {
  return (
    <div className="flex items-center gap-2 text-xs text-white">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 hover:text-zinc-200 transition text-left cursor-pointer"
      >
        <span className="w-3.5 h-3.5 rounded-full border border-zinc-300 flex items-center justify-center shrink-0">
          {checked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </span>
        <span>{label}</span>
      </button>
      {children}
    </div>
  );
}

export function MacroTab({ macros, t, api, onNotifyError, onNotifyInfo }) {
  const [selectedId, setSelectedId] = useState(macros[0]?.id || null);
  const [draft, setDraft] = useState(
    macros[0] || {
      id: '',
      name: 'Nova Macro',
      delayMode: 'record',
      uniformDelayMs: 20,
      loopMode: 'count',
      loopCount: 1,
      events: [],
    },
  );
  const [selectedEventIdx, setSelectedEventIdx] = useState(null);
  const [recording, setRecording] = useState(false);
  const [quickBindButton, setQuickBindButton] = useState(4);

  const lastEventTimeRef = useRef(0);
  const downKeysRef = useRef(new Set());

  useEffect(() => {
    const found = macros.find((m) => m.id === selectedId) || macros[0];
    if (found) {
      setSelectedId(found.id);
      setDraft({
        ...found,
        events: Array.isArray(found.events) ? [...found.events] : [],
      });
    }
  }, [macros]);

  const selectMacroItem = (m) => {
    setRecording(false);
    setSelectedId(m.id);
    setSelectedEventIdx(null);
    setDraft({
      ...m,
      events: Array.isArray(m.events) ? [...m.events] : [],
    });
  };

  // Gravação ao vivo de sequência de teclado para a macro
  useEffect(() => {
    if (!recording) return undefined;
    lastEventTimeRef.current = performance.now();
    downKeysRef.current = new Set();

    const appendRecordedEvent = (evt) => {
      const now = performance.now();
      const elapsed = Math.max(2, Math.min(65535, Math.round(now - lastEventTimeRef.current)));
      lastEventTimeRef.current = now;

      setDraft((prev) => {
        const nextEvents = [...prev.events];
        if (nextEvents.length > 0 && nextEvents.length < 253) {
          if (prev.delayMode === 'record' && elapsed >= 5) {
            nextEvents.push({ type: 'delay', ms: elapsed });
          } else if (prev.delayMode === 'uniform') {
            nextEvents.push({ type: 'delay', ms: Math.max(2, prev.uniformDelayMs || 20) });
          }
        }
        if (nextEvents.length < 255) {
          nextEvents.push(evt);
        }
        return { ...prev, events: nextEvents };
      });
    };

    const onKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mapped = mapDomKeyEventToHidName(e);
      if (!mapped) return;
      if (downKeysRef.current.has(mapped.key)) return;
      downKeysRef.current.add(mapped.key);
      appendRecordedEvent({ type: 'key-down', key: mapped.key });
    };

    const onKeyUp = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mapped = mapDomKeyEventToHidName(e);
      if (!mapped) return;
      downKeysRef.current.delete(mapped.key);
      appendRecordedEvent({ type: 'key-up', key: mapped.key });
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [recording]);

  const handleCreateNew = async () => {
    setRecording(false);
    const fresh = {
      id: `macro-${Date.now()}`,
      name: `Macro ${macros.length + 1}`,
      delayMode: 'uniform',
      uniformDelayMs: 20,
      loopMode: 'count',
      loopCount: 1,
      events: [],
    };
    setSelectedId(fresh.id);
    setDraft(fresh);
    try {
      await api.saveMacro(fresh);
    } catch (err) {
      onNotifyError?.(err.message);
    }
  };

  const handleSaveCurrent = async () => {
    setRecording(false);
    try {
      await api.saveMacro(draft);
      onNotifyInfo?.(`Macro "${draft.name}" salva.`);
    } catch (err) {
      onNotifyError?.(err.message);
    }
  };

  const handleDeleteCurrent = async () => {
    if (!draft.id) return;
    setRecording(false);
    try {
      await api.deleteMacro(draft.id);
    } catch (err) {
      onNotifyError?.(err.message);
    }
  };

  const handleQuickBind = async () => {
    setRecording(false);
    try {
      await api.saveMacro(draft);
      await api.bindMacroToButton(quickBindButton, draft.id);
      onNotifyInfo?.(`Macro "${draft.name}" gravada no Botão #${quickBindButton}.`);
    } catch (err) {
      onNotifyError?.(err.message);
    }
  };

  const addFixedDelay = () => {
    setDraft((prev) => ({
      ...prev,
      events: [
        ...prev.events.slice(0, 254),
        { type: 'delay', ms: Math.max(2, prev.uniformDelayMs || 20) },
      ],
    }));
  };

  const removeSelectedEvent = () => {
    if (selectedEventIdx === null) return;
    setDraft((prev) => ({
      ...prev,
      events: prev.events.filter((_, i) => i !== selectedEventIdx),
    }));
    setSelectedEventIdx(null);
  };

  const renderEventLine = (ev) => {
    if (ev.type === 'delay') {
      return <span className="text-amber-200">⏱ {ev.ms} ms</span>;
    }
    if (ev.type === 'key-down') {
      return <span>↓ {formatHidKeyPretty(ev.key)}</span>;
    }
    if (ev.type === 'key-up') {
      return <span className="text-zinc-200">↑ {formatHidKeyPretty(ev.key)}</span>;
    }
    if (ev.type === 'mouse-down') {
      return <span className="text-sky-200">🖱 ↓ {(ev.button || 'left').toUpperCase()}</span>;
    }
    if (ev.type === 'mouse-up') {
      return <span className="text-sky-100">🖱 ↑ {(ev.button || 'left').toUpperCase()}</span>;
    }
    return <span>{JSON.stringify(ev)}</span>;
  };

  return (
    <div className="space-y-3.5">
      <div className="bg-[#05070a]/95 border border-[#4a4e54] px-4 py-2.5 text-base font-medium">
        {t.macTitle}
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Coluna Macro Name idêntica a macrodlgbg.bmp1 */}
        <div className="col-span-4 bg-[#05070a]/95 border border-[#4a4e54] p-3 flex flex-col justify-between space-y-2.5">
          <div className="space-y-2">
            <div className="text-xs font-medium">{t.macName}</div>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              className="w-full bg-[#181b20] border border-[#5a5e66] px-2 py-1 text-xs text-white"
            />
            <div className="bg-[#6d6e71] h-44 p-1.5 space-y-1 text-xs overflow-y-auto">
              {macros.map((m) => {
                const active = m.id === draft.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMacroItem(m)}
                    className={`w-full text-left px-2 py-1 truncate transition cursor-pointer ${
                      active ? 'bg-white text-black font-bold' : 'text-white hover:bg-zinc-600'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handleCreateNew}
                className="bg-[#6d6e71] hover:bg-white hover:text-black py-1 font-medium transition cursor-pointer"
              >
                {t.newMacro}
              </button>
              <button
                type="button"
                onClick={handleDeleteCurrent}
                className="bg-[#6d6e71] hover:bg-red-500 hover:text-white py-1 font-medium transition cursor-pointer"
              >
                {t.deleteMacro}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSaveCurrent}
              className="w-full bg-white text-black hover:bg-zinc-200 py-1 font-semibold transition cursor-pointer"
            >
              {t.saveMacro}
            </button>
          </div>
        </div>

        {/* Coluna Event List + Gravação idêntica a macrodlgbg.bmp1 */}
        <div className="col-span-8 bg-[#05070a]/95 border border-[#4a4e54] p-3 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">
              {t.evtList} ({draft.events.length}/255)
            </span>
            {recording && <span className="text-red-400 animate-pulse">{t.recHint}</span>}
          </div>

          <div className="grid grid-cols-12 gap-3">
            {/* Lista de Eventos */}
            <div className="col-span-6 space-y-2">
              <div
                onMouseDown={(e) => {
                  if (!recording) return;
                  const mapBtn = { 0: 'left', 1: 'middle', 2: 'right' }[e.button];
                  if (mapBtn) {
                    setDraft((p) => ({
                      ...p,
                      events: [...p.events.slice(0, 254), { type: 'mouse-down', button: mapBtn }],
                    }));
                  }
                }}
                onMouseUp={(e) => {
                  if (!recording) return;
                  const mapBtn = { 0: 'left', 1: 'middle', 2: 'right' }[e.button];
                  if (mapBtn) {
                    setDraft((p) => ({
                      ...p,
                      events: [...p.events.slice(0, 254), { type: 'mouse-up', button: mapBtn }],
                    }));
                  }
                }}
                className={`bg-[#6d6e71] h-52 p-1.5 space-y-0.5 text-xs font-mono overflow-y-auto border ${
                  recording ? 'border-red-500' : 'border-transparent'
                }`}
              >
                {draft.events.map((ev, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedEventIdx(idx)}
                    className={`px-1.5 py-0.5 cursor-pointer flex items-center justify-between ${
                      selectedEventIdx === idx
                        ? 'bg-white text-black font-bold'
                        : 'hover:bg-zinc-600'
                    }`}
                  >
                    {renderEventLine(ev)}
                    <span className="text-[10px] opacity-50">#{idx + 1}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={addFixedDelay}
                  className="bg-[#6d6e71] hover:bg-white hover:text-black py-1 font-medium transition cursor-pointer"
                >
                  {t.addDelayBtn}
                </button>
                <button
                  type="button"
                  onClick={removeSelectedEvent}
                  className="bg-[#6d6e71] hover:bg-white hover:text-black py-1 font-medium transition cursor-pointer"
                >
                  {t.deleteEvent}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEventIdx(null);
                    setDraft((p) => ({ ...p, events: [] }));
                  }}
                  className="bg-[#6d6e71] hover:bg-white hover:text-black py-1 font-medium transition cursor-pointer"
                >
                  {t.clearEvents}
                </button>
              </div>
            </div>

            {/* Controles de Gravação, Delay e Loop */}
            <div className="col-span-6 space-y-2.5 text-xs flex flex-col justify-between">
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setRecording((r) => !r)}
                  className={`w-full py-1.5 px-2 flex items-center justify-center gap-2 font-semibold transition cursor-pointer ${
                    recording
                      ? 'bg-red-600 text-white'
                      : 'bg-[#6d6e71] hover:bg-zinc-500 text-white'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full inline-block ${
                      recording ? 'bg-white animate-ping' : 'bg-red-500'
                    }`}
                  />
                  <span>{recording ? t.stopRec : t.startRec}</span>
                </button>

                <div className="space-y-1.5">
                  <div className="font-medium text-zinc-200">{t.delaySet}</div>
                  <OemRadio
                    checked={draft.delayMode === 'record'}
                    label={t.delayRecord}
                    onClick={() => setDraft((p) => ({ ...p, delayMode: 'record' }))}
                  />
                  <OemRadio
                    checked={draft.delayMode === 'uniform'}
                    label={t.delayUniform}
                    onClick={() => setDraft((p) => ({ ...p, delayMode: 'uniform' }))}
                  >
                    <input
                      type="number"
                      min={2}
                      max={5000}
                      value={draft.uniformDelayMs}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, uniformDelayMs: Number(e.target.value) }))
                      }
                      className="w-14 bg-[#181b20] border border-[#5a5e66] px-1 py-0.5 font-mono text-[11px] text-white"
                    />
                  </OemRadio>
                  <OemRadio
                    checked={draft.delayMode === 'none'}
                    label={t.delayNone}
                    onClick={() => setDraft((p) => ({ ...p, delayMode: 'none' }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="font-medium text-zinc-200">{t.loopSet}</div>
                  <OemRadio
                    checked={draft.loopMode === 'hold'}
                    label={t.loopHold}
                    onClick={() => setDraft((p) => ({ ...p, loopMode: 'hold' }))}
                  />
                  <OemRadio
                    checked={draft.loopMode === 'toggle'}
                    label={t.loopToggle}
                    onClick={() => setDraft((p) => ({ ...p, loopMode: 'toggle' }))}
                  />
                  <OemRadio
                    checked={draft.loopMode === 'count'}
                    label={t.loopCount}
                    onClick={() => setDraft((p) => ({ ...p, loopMode: 'count' }))}
                  >
                    <input
                      type="number"
                      min={1}
                      max={255}
                      value={draft.loopCount}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          loopMode: 'count',
                          loopCount: Math.max(1, Number(e.target.value)),
                        }))
                      }
                      className="w-12 bg-[#181b20] border border-[#5a5e66] px-1 py-0.5 font-mono text-[11px] text-white"
                    />
                  </OemRadio>
                </div>
              </div>

              {/* Atalho rápido para gravar a macro direto em um botão físico (0x52, 0x55) */}
              <div className="pt-2 border-t border-zinc-800 space-y-1">
                <div className="text-[11px] text-zinc-400">{t.quickBindLabel}</div>
                <div className="flex gap-1.5">
                  <select
                    value={quickBindButton}
                    onChange={(e) => setQuickBindButton(Number(e.target.value))}
                    className="bg-[#181b20] border border-[#5a5e66] px-2 py-1 text-white"
                  >
                    {[2, 3, 4, 5, 6, 7, 1].map((b) => (
                      <option key={b} value={b}>
                        #{b}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleQuickBind}
                    className="flex-1 bg-white text-black font-semibold py-1 px-2 hover:bg-zinc-200 transition cursor-pointer"
                  >
                    {t.quickBindBtn}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
