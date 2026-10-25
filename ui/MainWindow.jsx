import React, { useState } from 'react';
import { I18N, getBatteryIconAsset } from './i18n.js';
import { ButtonsTab } from './tabs/ButtonsTab.jsx';
import { PointerTab } from './tabs/PointerTab.jsx';
import { MacroTab } from './tabs/MacroTab.jsx';
import { SystemTab } from './tabs/SystemTab.jsx';
import { MacAutomationsTab } from './tabs/MacAutomationsTab.jsx';

const LEFT_CALLOUTS = [
  { num: 1, top: '16%', lineW: '110px' },
  { num: 4, top: '40%', lineW: '64px' },
  { num: 5, top: '53%', lineW: '64px' },
];

const RIGHT_CALLOUTS = [
  { num: 2, top: '16%', lineW: '110px' },
  { num: 3, top: '26%', lineW: '134px' },
  { num: 6, top: '39%', lineW: '134px' },
  { num: 7, top: '47%', lineW: '134px' },
];

export function MainWindow({ fullState, api }) {
  const { store, device, automation } = fullState;
  const lang = store.language || 'pt';
  const t = I18N[lang] || I18N.pt;

  const [tab, setTab] = useState('ptr'); // 'key' | 'ptr' | 'mac' | 'sys' | 'osx'
  const [selectedBtn, setSelectedBtn] = useState(1);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileInputMode, setProfileInputMode] = useState(null); // null | 'new' | 'rename'
  const [profileNameDraft, setProfileNameDraft] = useState('');

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [banner, setBanner] = useState(null); // { kind: 'error'|'info', text }

  const activeProfile =
    store.profiles.find((p) => p.id === store.activeProfileId) || store.profiles[0];

  const showToast = (kind, text) => {
    setBanner({ kind, text });
    setTimeout(() => {
      setBanner((prev) => (prev?.text === text ? null : prev));
    }, 4200);
  };

  const setLang = (nextLang) => {
    api.updatePreferences({ language: nextLang }).catch(() => {});
  };

  const connStatus = !device.connected
    ? { dot: 'text-zinc-500', text: t.disconnected }
    : device.mode === 'wired'
      ? { dot: 'text-sky-400', text: t.connectedWired }
      : device.wirelessOnline
        ? { dot: 'text-emerald-400', text: t.connectedWireless }
        : { dot: 'text-amber-400', text: t.wirelessSleep };

  const batteryIconSrc = getBatteryIconAsset(device);
  const pct = device.battery?.percent;

  const navItems = [
    {
      id: 'key',
      title: t.navKey,
      idleSrc: './oem/menu_key0.png',
      activeSrc: './oem/menu_key1.png',
    },
    {
      id: 'ptr',
      title: t.navPtr,
      idleSrc: './oem/menu_pointer0.png',
      activeSrc: './oem/menu_pointer1.png',
    },
    {
      id: 'mac',
      title: t.navMac,
      idleSrc: './oem/menu_macro0.png',
      activeSrc: './oem/menu_macro1.png',
    },
    {
      id: 'sys',
      title: t.navSys,
      idleSrc: './oem/menu_sysset0.png',
      activeSrc: './oem/menu_sysset1.png',
    },
  ];

  const handleSubmitProfileName = async () => {
    const trimmed = profileNameDraft.trim();
    if (!trimmed) return;
    try {
      if (profileInputMode === 'new') {
        await api.createProfile(trimmed);
      } else if (profileInputMode === 'rename') {
        await api.renameProfile(activeProfile.id, trimmed);
      }
      setProfileInputMode(null);
      setProfileNameDraft('');
      setProfileMenuOpen(false);
    } catch (err) {
      showToast('error', err.message);
    }
  };

  return (
    <div
      className="w-screen h-screen flex flex-col justify-between text-white overflow-hidden relative"
      style={{
        background:
          'radial-gradient(circle at 68% 50%, #101b29 0%, #070c13 52%, #020305 100%)',
      }}
    >
      {/* TOP BAR PRETA ORIGINAL (#000000) + LOGO CENTRAL DARMOSHARK */}
      <header className="app-drag relative h-12 bg-black pl-20 pr-4 flex items-center justify-between z-30 border-b border-zinc-900 shrink-0">
        {/* Título + Seletor de Conexão (Auto / Cabo / 2.4G) */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-300 font-medium hidden sm:inline">{t.appTitle}</span>
          <div className="app-no-drag inline-flex border border-zinc-800 bg-zinc-950 text-[11px]">
            {[
              { id: 'auto', label: t.connAuto },
              { id: 'wired', label: t.connWired },
              { id: 'wireless', label: t.connWireless },
            ].map((opt) => {
              const sel = (device.preferredConnection || 'auto') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => api.setPreferredConnection(opt.id)}
                  className={`px-2 py-0.5 transition cursor-pointer ${
                    sel
                      ? 'bg-white text-black font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Emblema Trapezoidal Oficial Darmoshark Centralizado */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 pointer-events-none">
          <img
            src="./oem/logo.png"
            alt="Darmoshark"
            className="h-[66px] w-auto object-contain drop-shadow"
          />
        </div>

        {/* Status Sem Fio + Bateria Oficial + Idioma PT-BR/EN */}
        <div className="app-no-drag flex items-center gap-3.5 text-xs">
          {automation?.pendingWakeSync && (
            <span className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5">
              ⏳ {t.pendingWake}
            </span>
          )}

          <button
            type="button"
            onClick={() => api.refreshTelemetry()}
            title={t.popoverRefresh}
            className="flex items-center gap-1.5 hover:opacity-80 transition cursor-pointer"
          >
            <span className={`${connStatus.dot} font-semibold`}>●</span>
            <span className="text-zinc-200 font-medium">{connStatus.text}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <img src={batteryIconSrc} alt="Battery" className="h-5 w-auto object-contain" />
            <span className="font-mono font-semibold text-zinc-200">
              {device.mode === 'wired'
                ? 'USB'
                : typeof pct === 'number'
                  ? `${pct}%`
                  : '—'}
            </span>
          </div>

          <div className="inline-flex border border-zinc-800 text-[11px]">
            <button
              type="button"
              onClick={() => setLang('pt')}
              className={`px-2 py-0.5 cursor-pointer ${
                lang === 'pt'
                  ? 'bg-white text-black font-bold'
                  : 'bg-zinc-950 text-zinc-400 hover:text-white'
              }`}
            >
              PT
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2 py-0.5 cursor-pointer ${
                lang === 'en'
                  ? 'bg-white text-black font-bold'
                  : 'bg-zinc-950 text-zinc-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {/* Banner flutuante de erro ou aviso */}
      {banner && (
        <div
          className={`absolute top-14 right-5 z-50 px-3.5 py-2 border text-xs shadow-xl flex items-center gap-2.5 max-w-md ${
            banner.kind === 'error'
              ? 'bg-red-950/95 border-red-500/70 text-red-100'
              : 'bg-zinc-900/95 border-zinc-500 text-zinc-100'
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ÁREA CENTRAL: 5 ÍCONES QUADRADOS À ESQ + PAINÉIS OEM + FOTO 3D DO N3 À DIR */}
      <main className="flex-1 flex min-h-0 pt-5 pb-3 px-5 gap-6 overflow-hidden">
        {/* Coluna de ícones quadrados originais (54x54, borda #4a4e54, branco quando ativo) */}
        <aside className="flex flex-col shrink-0 self-start mt-1 z-20">
          {navItems.map((item, idx) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={item.title}
                onClick={() => setTab(item.id)}
                className={`w-[54px] h-[54px] border border-[#4a4e54] ${
                  idx > 0 ? '-mt-px' : ''
                } flex items-center justify-center transition cursor-pointer ${
                  active ? 'bg-white' : 'bg-[#05070a] hover:bg-zinc-900'
                }`}
              >
                <img
                  src={active ? item.activeSrc : item.idleSrc}
                  alt={item.title}
                  className="w-11 h-11 object-contain"
                />
              </button>
            );
          })}

          {/* 5º Ícone no mesmo padrão visual para Menu Bar Híbrida & Automações macOS */}
          <button
            type="button"
            title={t.navOsx}
            onClick={() => setTab('osx')}
            className={`w-[54px] h-[54px] border border-[#4a4e54] -mt-px flex items-center justify-center transition text-lg font-semibold cursor-pointer ${
              tab === 'osx'
                ? 'bg-white text-black'
                : 'bg-[#05070a] text-white hover:bg-zinc-900'
            }`}
          >
            ⌘
          </button>
        </aside>

        {/* Painel Esquerdo/Central com as caixas retangulares originais */}
        <section className="flex-1 max-w-[530px] overflow-y-auto pr-1 z-10">
          {tab === 'key' && (
            <ButtonsTab
              profile={activeProfile}
              macros={store.macros}
              lang={lang}
              t={t}
              selectedBtn={selectedBtn}
              onSelectBtn={setSelectedBtn}
              api={api}
              onNotifyError={(msg) => showToast('error', msg)}
            />
          )}

          {tab === 'ptr' && (
            <PointerTab
              profile={activeProfile}
              device={device}
              automation={automation}
              t={t}
              api={api}
              onNotifyError={(msg) => showToast('error', msg)}
            />
          )}

          {tab === 'mac' && (
            <MacroTab
              macros={store.macros}
              t={t}
              api={api}
              onNotifyError={(msg) => showToast('error', msg)}
              onNotifyInfo={(msg) => showToast('info', msg)}
            />
          )}

          {tab === 'sys' && (
            <SystemTab
              profile={activeProfile}
              t={t}
              api={api}
              onNotifyError={(msg) => showToast('error', msg)}
            />
          )}

          {tab === 'osx' && (
            <MacAutomationsTab
              store={store}
              t={t}
              api={api}
              onNotifyError={(msg) => showToast('error', msg)}
            />
          )}
        </section>

        {/* Lado Direito: Foto 3D Oficial do Darmoshark N3 + Callouts Interativos dos 7 Botões */}
        <section className="flex-1 flex items-center justify-center relative min-h-[470px]">
          <div className="relative w-[460px] h-[475px] flex items-center justify-center">
            <img
              src="./oem/mouse-n3.png"
              alt="Darmoshark N3"
              className="h-[445px] w-auto object-contain select-none pointer-events-none rounded-2xl"
              style={{ mixBlendMode: 'lighten' }}
            />

            {/* Callouts interativos Button 1..7 na aba de Botões (igual a keydlgbg.bmp1) */}
            {tab === 'key' && (
              <div className="absolute inset-0">
                {LEFT_CALLOUTS.map((item) => {
                  const active = selectedBtn === item.num;
                  return (
                    <div
                      key={item.num}
                      style={{ top: item.top, left: '4px' }}
                      className="absolute flex items-center"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedBtn(item.num)}
                        className={`${
                          active
                            ? 'bg-white text-black font-bold'
                            : 'bg-[#6e7175] text-white hover:bg-zinc-400'
                        } px-2.5 py-1 rounded-md text-xs transition shadow cursor-pointer`}
                      >
                        {t.btnWord} {item.num}
                      </button>
                      <div
                        style={{ width: item.lineW }}
                        className="h-px bg-zinc-200 ml-1.5 relative"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white absolute -right-0.5 -top-[2.5px]" />
                      </div>
                    </div>
                  );
                })}

                {RIGHT_CALLOUTS.map((item) => {
                  const active = selectedBtn === item.num;
                  return (
                    <div
                      key={item.num}
                      style={{ top: item.top, right: '4px' }}
                      className="absolute flex items-center"
                    >
                      <div
                        style={{ width: item.lineW }}
                        className="h-px bg-zinc-200 mr-1.5 relative"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white absolute -left-0.5 -top-[2.5px]" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedBtn(item.num)}
                        className={`${
                          active
                            ? 'bg-white text-black font-bold'
                            : 'bg-[#6e7175] text-white hover:bg-zinc-400'
                        } px-2.5 py-1 rounded-md text-xs transition shadow cursor-pointer`}
                      >
                        {t.btnWord} {item.num}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* RODAPÉ PRETO ORIGINAL (#000000): PERFIL À ESQ • FIRMWARE AO CENTRO • RESTAURAR À DIR */}
      <footer className="h-11 bg-black px-5 flex items-center justify-between border-t border-zinc-900 text-xs shrink-0 z-30 relative">
        {/* Seletor / Gerenciador de Perfis estilo OEM [ Standard ▲ ] */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileMenuOpen((o) => !o);
              setProfileInputMode(null);
            }}
            className="bg-white text-black font-bold px-4 py-1 flex items-center gap-3 min-w-[140px] justify-between hover:bg-zinc-200 transition cursor-pointer"
          >
            <span className="truncate max-w-[160px]">{activeProfile.name}</span>
            <span className="text-zinc-500 text-[10px]">▲</span>
          </button>

          {profileMenuOpen && (
            <div className="absolute bottom-9 left-0 w-64 bg-[#080b10] border border-[#4a4e54] shadow-2xl p-2 space-y-1.5 z-50">
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {store.profiles.map((p) => {
                  const isAct = p.id === store.activeProfileId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        api.switchProfile(p.id).catch((e) => showToast('error', e.message));
                        setProfileMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between transition cursor-pointer ${
                        isAct
                          ? 'bg-white text-black font-bold'
                          : 'text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {isAct && <span>✓</span>}
                    </button>
                  );
                })}
              </div>

              {profileInputMode ? (
                <div className="pt-1.5 border-t border-zinc-800 space-y-1.5">
                  <div className="text-[11px] text-zinc-400">
                    {profileInputMode === 'new' ? t.profilePromptNew : t.profilePromptRename}
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={profileNameDraft}
                      onChange={(e) => setProfileNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSubmitProfileName();
                        if (e.key === 'Escape') setProfileInputMode(null);
                      }}
                      className="flex-1 min-w-0 bg-[#181b20] border border-[#5a5e66] px-2 py-1 text-white"
                    />
                    <button
                      type="button"
                      onClick={handleSubmitProfileName}
                      className="bg-white text-black font-bold px-2.5 py-1 cursor-pointer"
                    >
                      OK
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-1.5 border-t border-zinc-800 grid grid-cols-2 gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileInputMode('new');
                      setProfileNameDraft(`Perfil ${store.profiles.length + 1}`);
                    }}
                    className="bg-[#23262b] hover:bg-white hover:text-black px-2 py-1 text-left transition cursor-pointer"
                  >
                    {t.profileNew}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileInputMode('rename');
                      setProfileNameDraft(activeProfile.name);
                    }}
                    className="bg-[#23262b] hover:bg-white hover:text-black px-2 py-1 text-left transition cursor-pointer"
                  >
                    {t.profileRename}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      api.importProfileDialog().catch((e) => showToast('error', e.message));
                    }}
                    className="bg-[#23262b] hover:bg-white hover:text-black px-2 py-1 text-left transition cursor-pointer"
                  >
                    {t.profileImport}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      api.exportProfileDialog().catch((e) => showToast('error', e.message));
                    }}
                    className="bg-[#23262b] hover:bg-white hover:text-black px-2 py-1 text-left transition cursor-pointer"
                  >
                    {t.profileExport}
                  </button>
                  {store.profiles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        api
                          .deleteProfile(activeProfile.id)
                          .catch((e) => showToast('error', e.message));
                        setProfileMenuOpen(false);
                      }}
                      className="col-span-2 bg-[#23262b] hover:bg-red-600 hover:text-white px-2 py-1 text-center text-red-300 transition cursor-pointer"
                    >
                      {t.profileDelete}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Versão do Firmware */}
        <div className="text-zinc-300 font-medium">
          <span>{t.fwLabel}</span>{' '}
          <span className="text-white font-mono">
            {device.firmwareVersion || '0.1.19r-c'}
          </span>
        </div>

        {/* Restaurar Padrão */}
        <button
          type="button"
          onClick={() => setConfirmResetOpen(true)}
          className="text-zinc-200 hover:text-white font-medium flex items-center gap-1.5 transition cursor-pointer"
        >
          <span>↺</span>
          <span>{t.resetDefault}</span>
        </button>
      </footer>

      {/* Modal de Confirmação para Restaurar Padrão de Fábrica */}
      {confirmResetOpen && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#05070a] border border-[#4a4e54] max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="text-base font-bold text-white">{t.resetConfirmTitle}</div>
            <p className="text-xs text-zinc-300 leading-relaxed">{t.resetConfirmBody}</p>
            <div className="flex justify-end gap-2 text-xs pt-1">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-3.5 py-1.5 bg-[#23262b] hover:bg-zinc-700 text-zinc-200 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmResetOpen(false);
                  try {
                    await api.factoryReset(true);
                  } catch (err) {
                    showToast('error', err.message);
                  }
                }}
                className="px-3.5 py-1.5 bg-white hover:bg-zinc-200 text-black font-bold cursor-pointer"
              >
                {t.confirmReset}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
