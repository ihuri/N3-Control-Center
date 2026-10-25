import React, { useEffect, useState } from 'react';

function OemToggleRow({ checked, label, onClick }) {
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

export function MacAutomationsTab({ store, t, api, onNotifyError }) {
  const { menubar, automations, profiles } = store;
  const [installedApps, setInstalledApps] = useState([]);
  const [newAppMatch, setNewAppMatch] = useState('');
  const [newRuleProfileId, setNewRuleProfileId] = useState(profiles[0]?.id || 'standard');

  useEffect(() => {
    let mounted = true;
    api
      .listMacApps?.()
      .then((apps) => {
        if (mounted && Array.isArray(apps)) setInstalledApps(apps);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [api]);

  const patchMenubar = (patch) => {
    api.updatePreferences({ menubar: patch }).catch((e) => onNotifyError?.(e.message));
  };

  const patchAutomations = (patch) => {
    api.updatePreferences({ automations: patch }).catch((e) => onNotifyError?.(e.message));
  };

  const addRule = () => {
    const trimmed = newAppMatch.trim();
    if (!trimmed) return;
    const nextRules = [
      ...(automations.appProfiles?.rules || []),
      {
        id: `rule-${Date.now()}`,
        appMatch: trimmed,
        label: trimmed,
        profileId: newRuleProfileId,
      },
    ];
    setNewAppMatch('');
    patchAutomations({
      appProfiles: {
        ...automations.appProfiles,
        enabled: true,
        rules: nextRules,
      },
    });
  };

  const removeRule = (ruleId) => {
    const nextRules = (automations.appProfiles?.rules || []).filter((r) => r.id !== ruleId);
    patchAutomations({
      appProfiles: {
        ...automations.appProfiles,
        rules: nextRules,
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="bg-[#05070a]/95 border border-[#4a4e54] px-4 py-2 text-base font-medium">
        {t.osxTitle}
      </div>

      {/* Caixa Menu Bar Híbrida & Hidden Bar */}
      <div className="bg-[#05070a]/95 border border-[#4a4e54] p-3.5 space-y-2.5">
        <div className="text-sm font-medium">{t.menubarBoxTitle}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <OemToggleRow
            checked={menubar.showBatteryPercent}
            label={t.showBatPct}
            onClick={() => patchMenubar({ showBatteryPercent: !menubar.showBatteryPercent })}
          />
          <OemToggleRow
            checked={menubar.showDpi}
            label={t.showDpiVal}
            onClick={() => patchMenubar({ showDpi: !menubar.showDpi })}
          />
          <OemToggleRow
            checked={menubar.hideBatteryWhenFullOrWired}
            label={t.hideBatFull}
            onClick={() =>
              patchMenubar({
                hideBatteryWhenFullOrWired: !menubar.hideBatteryWhenFullOrWired,
              })
            }
          />
          <OemToggleRow
            checked={menubar.docklessMode}
            label={t.docklessMode}
            onClick={() => patchMenubar({ docklessMode: !menubar.docklessMode })}
          />
          <OemToggleRow
            checked={menubar.launchAtLogin}
            label={t.launchLogin}
            onClick={() => patchMenubar({ launchAtLogin: !menubar.launchAtLogin })}
          />
        </div>
        <p className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/90">
          {t.menubarHint}
        </p>
      </div>

      {/* Caixa Automações Inteligentes */}
      <div className="bg-[#05070a]/95 border border-[#4a4e54] p-3.5 space-y-2">
        <div className="text-sm font-medium">{t.autoBoxTitle}</div>
        <div className="flex flex-col gap-2">
          <OemToggleRow
            checked={automations.autoEco?.enabled}
            label={t.autoEcoToggle}
            onClick={() =>
              patchAutomations({
                autoEco: { enabled: !automations.autoEco?.enabled },
              })
            }
          />

          {automations.autoEco?.enabled && (
            <div className="pl-5 flex flex-wrap items-center gap-3 text-xs text-zinc-300">
              <label className="inline-flex items-center gap-1.5">
                <span>{t.autoEcoThreshold}</span>
                <select
                  value={automations.autoEco.batteryThreshold}
                  onChange={(e) =>
                    patchAutomations({
                      autoEco: { batteryThreshold: Number(e.target.value) },
                    })
                  }
                  className="bg-[#181b20] border border-[#5a5e66] px-1.5 py-0.5 text-white"
                >
                  {[10, 15, 20, 25, 30].map((v) => (
                    <option key={v} value={v}>
                      {v}%
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-flex items-center gap-1.5">
                <span>{t.autoEcoRate}</span>
                <select
                  value={automations.autoEco.ecoPollingRateHz}
                  onChange={(e) =>
                    patchAutomations({
                      autoEco: { ecoPollingRateHz: Number(e.target.value) },
                    })
                  }
                  className="bg-[#181b20] border border-[#5a5e66] px-1.5 py-0.5 text-white"
                >
                  <option value={125}>125 Hz</option>
                  <option value={500}>500 Hz</option>
                </select>
              </label>

              <OemToggleRow
                checked={automations.autoEco.useMacLowPowerMode}
                label={t.autoEcoMacPower}
                onClick={() =>
                  patchAutomations({
                    autoEco: {
                      useMacLowPowerMode: !automations.autoEco.useMacLowPowerMode,
                    },
                  })
                }
              />
            </div>
          )}

          <OemToggleRow
            checked={automations.dpiChangeHud}
            label={t.dpiHudToggle}
            onClick={() => patchAutomations({ dpiChangeHud: !automations.dpiChangeHud })}
          />

          <OemToggleRow
            checked={automations.lowBatteryAlert}
            label={t.lowBatToggle}
            onClick={() =>
              patchAutomations({ lowBatteryAlert: !automations.lowBatteryAlert })
            }
          />
        </div>
      </div>

      {/* Caixa Perfis Automáticos por Aplicativo em Foco */}
      <div className="bg-[#05070a]/95 border border-[#4a4e54] p-3.5 space-y-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{t.appProfilesTitle}</span>
          <OemToggleRow
            checked={automations.appProfiles?.enabled}
            label={automations.appProfiles?.enabled ? 'ON' : 'OFF'}
            onClick={() =>
              patchAutomations({
                appProfiles: { enabled: !automations.appProfiles?.enabled },
              })
            }
          />
        </div>

        <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5">
          {(automations.appProfiles?.rules || []).map((rule) => {
            const targetProf = profiles.find((p) => p.id === rule.profileId);
            return (
              <div
                key={rule.id}
                className="flex items-center justify-between bg-[#16191e] px-2.5 py-1 border border-zinc-800"
              >
                <span className="truncate font-medium text-zinc-200">{rule.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-emerald-400 font-semibold">
                    → {targetProf?.name || rule.profileId}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRule(rule.id)}
                    className="text-zinc-400 hover:text-red-400 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-12 gap-1.5 pt-1">
          <div className="col-span-5 space-y-1">
            <input
              type="text"
              value={newAppMatch}
              onChange={(e) => setNewAppMatch(e.target.value)}
              placeholder={t.appMatchPlaceholder}
              className="w-full bg-[#181b20] border border-[#5a5e66] px-2 py-1 text-white"
            />
            {installedApps.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) setNewAppMatch(e.target.value);
                }}
                className="w-full bg-[#181b20] border border-[#5a5e66] px-1.5 py-0.5 text-[11px] text-zinc-300"
              >
                <option value="">{t.pickInstalledApp}</option>
                {installedApps.map((appName) => (
                  <option key={appName} value={appName}>
                    {appName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="col-span-4">
            <select
              value={newRuleProfileId}
              onChange={(e) => setNewRuleProfileId(e.target.value)}
              className="w-full bg-[#181b20] border border-[#5a5e66] px-2 py-1 text-white"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-3">
            <button
              type="button"
              onClick={addRule}
              className="w-full bg-[#6d6e71] hover:bg-white hover:text-black py-1 px-2 font-medium transition cursor-pointer"
            >
              {t.addAppRule}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
