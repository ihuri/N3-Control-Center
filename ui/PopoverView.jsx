import React from 'react';
import { I18N, POLLING_RATES, STAGE_COLORS } from './i18n.js';

export function PopoverView({ fullState, api }) {
  const store = fullState.store;
  const device = fullState.device;
  const automation = fullState.automation;
  const lang = store.language || 'pt';
  const t = I18N[lang] || I18N.pt;

  const activeProfile =
    store.profiles.find((p) => p.id === store.activeProfileId) || store.profiles[0];

  const stages = device.hardwareDpiStages ?? activeProfile.dpiStages;
  const stageCount = activeProfile.dpiStageCount;
  const activeStage = Math.min(
    stageCount,
    Math.max(1, device.activeDpiStage ?? activeProfile.activeDpiStage ?? 1),
  );
  const activeRate = device.pollingRateHz ?? activeProfile.pollingRateHz;
  const pct = device.battery?.percent;

  const statusLabel = !device.connected
    ? t.disconnected
    : device.mode === 'wired'
      ? t.connectedWired
      : device.wirelessOnline
        ? t.connectedWireless
        : t.wirelessSleep;

  const statusDot = !device.connected
    ? 'bg-zinc-500'
    : device.mode === 'wired' || device.wirelessOnline
      ? 'bg-emerald-400'
      : 'bg-amber-400';

  return (
    <div className="w-screen h-screen bg-zinc-950/85 text-white p-3.5 flex flex-col justify-between text-xs border border-white/10 rounded-xl">
      {/* Cabeçalho Status + Bateria */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
        <div>
          <div className="font-bold text-sm tracking-tight text-white">Darmoshark N3</div>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-300 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${statusDot}`} />
            <span>{statusLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {device.connected && (
            <div className="px-2 py-1 rounded-md bg-white/10 font-mono font-semibold text-xs">
              {device.mode === 'wired'
                ? '⚡ USB'
                : typeof pct === 'number'
                  ? `🔋 ${pct}%`
                  : '—'}
            </div>
          )}
          <button
            type="button"
            onClick={() => api.refreshTelemetry()}
            title={t.popoverRefresh}
            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-200 transition cursor-pointer"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Estágios Rápidos de DPI */}
      <div className="space-y-1.5 py-2">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
          <span>DPI ({stages[activeStage - 1] ?? 800})</span>
          {automation?.pendingWakeSync && (
            <span className="text-amber-300 text-[10px]">{t.pendingWake}</span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {stages.slice(0, stageCount).map((val, idx) => {
            const isSel = activeStage === idx + 1;
            return (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  api.setDpi({
                    stages,
                    stageCount,
                    activeStage: idx + 1,
                  })
                }
                className={`rounded-md py-1.5 px-1 flex flex-col items-center gap-1 border transition cursor-pointer ${
                  isSel
                    ? 'bg-white text-black border-white font-bold shadow'
                    : 'bg-white/5 text-zinc-200 border-white/10 hover:bg-white/15'
                }`}
              >
                <span
                  style={{ backgroundColor: STAGE_COLORS[idx] }}
                  className="w-4 h-1 rounded-full"
                />
                <span className="font-mono text-[11px]">{val}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Polling Rate */}
      <div className="space-y-1.5 py-1.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
          <span>{t.reportRate}</span>
          {automation?.ecoActive && (
            <span className="text-emerald-400 text-[10px]">🌱 Eco</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {POLLING_RATES.map((r) => {
            const isSel = activeRate === r.hz;
            return (
              <button
                key={r.hz}
                type="button"
                onClick={() => api.setPollingRate(r.hz)}
                className={`py-1.5 px-2 rounded-md border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  isSel
                    ? 'bg-white text-black border-white font-bold'
                    : 'bg-white/5 text-zinc-200 border-white/10 hover:bg-white/15'
                }`}
              >
                <span
                  style={{ backgroundColor: r.color }}
                  className="w-2 h-2 rounded-full"
                />
                <span>{r.hz} Hz</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggles Rápidos: Motion Sync + Auto-Eco */}
      <div className="grid grid-cols-2 gap-1.5 py-1.5">
        <button
          type="button"
          onClick={() =>
            api.setSensor({ motionSync: !activeProfile.sensor.motionSync })
          }
          className={`px-2.5 py-2 rounded-md border text-left transition cursor-pointer ${
            activeProfile.sensor.motionSync
              ? 'bg-sky-500/25 border-sky-400/50 text-white'
              : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
          }`}
        >
          <div className="font-semibold text-[11px]">Motion Sync</div>
          <div className="text-[10px] text-zinc-400">
            {activeProfile.sensor.motionSync ? 'ON • PAW3395' : 'OFF'}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            api.updatePreferences({
              automations: {
                autoEco: { enabled: !store.automations.autoEco.enabled },
              },
            })
          }
          className={`px-2.5 py-2 rounded-md border text-left transition cursor-pointer ${
            store.automations.autoEco.enabled
              ? 'bg-emerald-500/20 border-emerald-400/50 text-white'
              : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
          }`}
        >
          <div className="font-semibold text-[11px]">Auto-Eco</div>
          <div className="text-[10px] text-zinc-400">
            {store.automations.autoEco.enabled
              ? `ON (≤${store.automations.autoEco.batteryThreshold}%)`
              : 'OFF'}
          </div>
        </button>
      </div>

      {/* Seletor de Perfil */}
      <div className="py-1.5 flex items-center justify-between gap-2 border-t border-white/10">
        <span className="text-[11px] text-zinc-400 shrink-0">{t.popoverProfile}</span>
        <select
          value={store.activeProfileId}
          onChange={(e) => api.switchProfile(e.target.value)}
          className="bg-zinc-900 border border-white/15 rounded px-2 py-1 text-xs text-white flex-1 truncate"
        >
          {store.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Rodapé: Abrir Painel Completo + Sair */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => api.openMainWindow()}
          className="flex-1 bg-white text-black hover:bg-zinc-200 font-semibold py-1.5 px-3 rounded-md transition flex items-center justify-center gap-1 cursor-pointer"
        >
          <span>{t.popoverOpenMain}</span>
          <span>↗</span>
        </button>
        <button
          type="button"
          onClick={() => api.quitApp()}
          className="px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-red-500/25 text-zinc-300 hover:text-red-200 border border-white/10 transition cursor-pointer"
        >
          {t.popoverQuit}
        </button>
      </div>
    </div>
  );
}
