import React, { useState } from 'react';

function OemCheckCircle({ checked, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 text-xs text-white hover:text-zinc-200 transition text-left cursor-pointer"
    >
      <span className="w-3.5 h-3.5 rounded-full border border-zinc-300 flex items-center justify-center shrink-0">
        {checked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function SystemTab({ profile, t, api, onNotifyError }) {
  const [showSensorHelp, setShowSensorHelp] = useState(false);

  const updateSensor = async (patch) => {
    try {
      await api.setSensor(patch);
    } catch (err) {
      onNotifyError?.(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#05070a]/95 border border-[#4a4e54] px-4 py-2.5 text-base font-medium">
        {t.sysTitle}
      </div>

      {/* Caixa LOD Height idêntica a sysetdlgbg.bmp1 */}
      <div className="bg-[#05070a]/95 border border-[#4a4e54] p-4 space-y-3">
        <div className="text-base font-medium">{t.lodTitle}</div>
        <div className="flex items-center gap-8">
          <OemCheckCircle
            checked={profile.lod === 'low'}
            label={t.lodLow}
            onClick={() => updateSensor({ lod: 'low' })}
          />
          <OemCheckCircle
            checked={profile.lod === 'high'}
            label={t.lodHigh}
            onClick={() => updateSensor({ lod: 'high' })}
          />
        </div>
      </div>

      {/* Caixa Sensor Performance idêntica a sysetdlgbg.bmp1 */}
      <div className="bg-[#05070a]/95 border border-[#4a4e54] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-base font-medium">{t.sensorTitle}</span>
          <button
            type="button"
            onClick={() => setShowSensorHelp((s) => !s)}
            className="w-5 h-5 rounded-full bg-[#6d6e71] hover:bg-white hover:text-black text-white text-xs font-bold flex items-center justify-center transition cursor-pointer"
          >
            ?
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <OemCheckCircle
            checked={Boolean(profile.sensor?.rippleControl)}
            label="Ripple Control"
            onClick={() =>
              updateSensor({ rippleControl: !profile.sensor?.rippleControl })
            }
          />
          <OemCheckCircle
            checked={Boolean(profile.sensor?.angleSnap)}
            label="Angle Snap"
            onClick={() => updateSensor({ angleSnap: !profile.sensor?.angleSnap })}
          />
          <OemCheckCircle
            checked={Boolean(profile.sensor?.motionSync)}
            label="Motion Sync"
            onClick={() => updateSensor({ motionSync: !profile.sensor?.motionSync })}
          />
        </div>

        {showSensorHelp && (
          <p className="text-xs text-zinc-400 pt-2 border-t border-zinc-800 leading-relaxed">
            {t.sensorHelpText}
          </p>
        )}
      </div>

      {/* Caixa Mouse Properties adaptada nativamente para macOS */}
      <div className="bg-[#05070a]/95 border border-[#4a4e54] p-4 space-y-3">
        <div className="text-base font-medium">{t.mouseProps}</div>
        <button
          type="button"
          onClick={() => api.openMacMouseSettings()}
          className="inline-flex items-center gap-2.5 bg-[#23262b] hover:bg-white hover:text-black border border-[#4a4e54] px-3.5 py-2 text-xs font-medium transition cursor-pointer"
        >
          <span className="text-base leading-none"></span>
          <span>{t.openMacMouse}</span>
        </button>
      </div>
    </div>
  );
}
