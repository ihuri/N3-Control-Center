import React, { useEffect, useState } from 'react';
import { STAGE_COLORS } from './i18n.js';

export function HudView({ api }) {
  const [payload, setPayload] = useState({
    stage: 2,
    dpi: 800,
    pollingRateHz: 500,
  });

  useEffect(() => {
    if (!api?.onHudPayload) return undefined;
    return api.onHudPayload((next) => {
      if (next) setPayload(next);
    });
  }, [api]);

  const stageIdx = Math.max(0, Math.min(4, (payload.stage || 1) - 1));
  const dotColor = STAGE_COLORS[stageIdx];

  return (
    <div className="w-screen h-screen flex items-center justify-center p-1.5 bg-transparent">
      <div className="w-full h-full rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-white/15 px-4 py-2.5 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <span
            style={{ backgroundColor: dotColor, boxShadow: `0 0 12px ${dotColor}` }}
            className="w-3.5 h-3.5 rounded-full shrink-0"
          />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
              Darmoshark N3 • Estágio #{payload.stage}
            </div>
            <div className="text-xl font-bold tracking-tight text-white leading-tight">
              {payload.dpi} <span className="text-xs font-medium text-zinc-400">DPI</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-block px-2 py-0.5 rounded bg-white/10 text-[11px] font-mono text-zinc-200">
            {payload.pollingRateHz ?? 500} Hz
          </span>
        </div>
      </div>
    </div>
  );
}
