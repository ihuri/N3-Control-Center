import React, { useEffect, useState } from 'react';
import { POLLING_RATES, STAGE_COLORS } from '../i18n.js';

export function PointerTab({ profile, device, automation, t, api, onNotifyError }) {
  const effectiveStages = profile.dpiStages;
  const stageCount = profile.dpiStageCount;
  const activeStageIdx = Math.min(
    stageCount - 1,
    Math.max(0, (profile.activeDpiStage ?? 1) - 1),
  );

  const [draftDpi, setDraftDpi] = useState(effectiveStages[activeStageIdx] ?? 800);

  useEffect(() => {
    setDraftDpi(effectiveStages[activeStageIdx] ?? 800);
  }, [effectiveStages, activeStageIdx]);

  const currentDpi = draftDpi;
  const sliderMin = 50;
  const sliderMax = 26000;
  const pct = Math.max(
    0,
    Math.min(100, ((currentDpi - sliderMin) / (sliderMax - sliderMin)) * 100),
  );

  const commitStageValue = async (rawVal) => {
    const snapped = Math.max(50, Math.min(26000, Math.round(Number(rawVal) / 50) * 50 || 800));
    setDraftDpi(snapped);
    const nextStages = [...effectiveStages];
    nextStages[activeStageIdx] = snapped;
    try {
      await api.setDpi({
        stages: nextStages,
        stageCount,
        activeStage: activeStageIdx + 1,
      });
    } catch (err) {
      onNotifyError?.(err.message);
    }
  };

  const selectStage = async (idx) => {
    try {
      await api.setDpi({
        stages: effectiveStages,
        stageCount,
        activeStage: idx + 1,
      });
    } catch (err) {
      onNotifyError?.(err.message);
    }
  };

  const changeStageCount = async (nextCount) => {
    const nextActive = Math.min(nextCount, activeStageIdx + 1);
    try {
      await api.setDpi({
        stages: effectiveStages,
        stageCount: nextCount,
        activeStage: nextActive,
      });
    } catch (err) {
      onNotifyError?.(err.message);
    }
  };

  const resetDpi = async () => {
    try {
      await api.setDpi({
        stages: [400, 800, 1600, 3200, 4800],
        stageCount: 5,
        activeStage: 2,
      });
    } catch (err) {
      onNotifyError?.(err.message);
    }
  };

  const activeRate = device?.pollingRateHz ?? profile.pollingRateHz;

  return (
    <div className="space-y-4">
      <div className="bg-[#05070a]/95 border border-[#4a4e54] px-4 py-2.5 text-base font-medium">
        {t.ptrTitle}
      </div>

      {/* Caixa DPI idêntica a pointdlgbg.bmp1 */}
      <div className="bg-[#05070a]/95 border border-[#4a4e54] p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-medium">DPI</span>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-zinc-200">{t.numStages}</span>
            <select
              value={stageCount}
              onChange={(e) => changeStageCount(Number(e.target.value))}
              className="bg-[#181b20] border border-[#5a5e66] px-2.5 py-0.5 text-xs text-white cursor-pointer"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={resetDpi}
              title="Reset DPI"
              className="text-sm hover:text-zinc-300 cursor-pointer px-1"
            >
              ↺
            </button>
          </div>
        </div>

        {/* Botões dos 5 Estágios com barras LED oficiais */}
        <div className="flex flex-wrap gap-2">
          {effectiveStages.slice(0, stageCount).map((val, idx) => {
            const active = idx === activeStageIdx;
            const shownVal = active ? currentDpi : val;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => selectStage(idx)}
                className={`${
                  active
                    ? 'bg-white text-black font-bold'
                    : 'bg-[#6d6e71] text-white hover:bg-zinc-500'
                } h-7 pr-3 flex items-center gap-2 text-xs transition cursor-pointer`}
              >
                <span
                  style={{ backgroundColor: STAGE_COLORS[idx] }}
                  className="w-2 h-full inline-block"
                />
                <span className="font-mono">{shownVal}</span>
              </button>
            );
          })}
        </div>

        {/* Régua cinza graduada original com triângulo laranja (#f58220) */}
        <div className="bg-[#6d6e71] px-3 pt-3 pb-5 relative">
          <div className="flex items-center gap-2 text-xs text-white">
            <span className="font-mono font-medium shrink-0">50</span>
            <div className="relative flex-1 flex items-center justify-between px-1">
              {Array.from({ length: 17 }).map((_, i) => (
                <span key={i} className="w-px h-2 bg-zinc-200 inline-block" />
              ))}
              <input
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={50}
                value={currentDpi}
                onChange={(e) => setDraftDpi(Number(e.target.value))}
                onMouseUp={(e) => commitStageValue(e.currentTarget.value)}
                onTouchEnd={(e) => commitStageValue(e.currentTarget.value)}
                onKeyUp={(e) => commitStageValue(e.currentTarget.value)}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-20"
              />
              <span
                style={{ left: `calc(${pct}% - 6px)` }}
                className="absolute top-3 text-[#f58220] text-sm leading-none pointer-events-none drop-shadow"
              >
                ▲
              </span>
            </div>
            <span className="font-mono font-medium shrink-0">26000</span>
          </div>
        </div>

        {/* Ajuste fino numérico (múltiplos de 50 DPI) */}
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="text-zinc-300">
            {t.stageWord} #{activeStageIdx + 1} — {t.dpiFineInput}
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={50}
              max={26000}
              step={50}
              value={draftDpi}
              onChange={(e) => setDraftDpi(Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitStageValue(draftDpi);
              }}
              className="w-24 bg-[#181b20] border border-[#5a5e66] px-2 py-1 font-mono text-xs text-white text-right"
            />
            <button
              type="button"
              onClick={() => commitStageValue(draftDpi)}
              className="bg-[#6d6e71] hover:bg-white hover:text-black px-2.5 py-1 text-xs font-medium transition cursor-pointer"
            >
              {t.applyDpi}
            </button>
          </div>
        </div>
      </div>

      {/* Caixa Report Rate idêntica a pointdlgbg.bmp1 */}
      <div className="bg-[#05070a]/95 border border-[#4a4e54] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">{t.reportRate}</span>
            {automation?.ecoActive && (
              <span className="text-[11px] px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                🌱 {t.ecoOverrideNote}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => api.setPollingRate(500)}
            title="Reset Report Rate"
            className="text-sm hover:text-zinc-300 cursor-pointer px-1"
          >
            ↺
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          {POLLING_RATES.map((r) => {
            const active = activeRate === r.hz;
            return (
              <button
                key={r.hz}
                type="button"
                onClick={() => api.setPollingRate(r.hz)}
                className={`${
                  active
                    ? 'bg-white text-black font-bold'
                    : 'bg-[#6d6e71] text-white hover:bg-zinc-500'
                } h-8 w-24 pr-2 flex items-center gap-2 text-xs transition cursor-pointer`}
              >
                <span
                  style={{ backgroundColor: r.color }}
                  className="w-2.5 h-full inline-block"
                />
                <span>{r.hz}HZ</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
