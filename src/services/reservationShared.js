// Shared between ReservationsManager.jsx and ClientsManager.jsx (which
// renders DetailDrawer, imported from ReservationsManager.jsx, to show a
// reservation's full detail from a client's history). Split out of
// ReservationsManager.jsx because mixing component exports (the default
// export, DetailDrawer) with plain-value exports (useInjectStyles,
// STATUS_TRIGGER) in one file breaks React Fast Refresh for that file.

import { useEffect } from 'react';

const RES_CSS = `
* { box-sizing: border-box; }

@keyframes resFadeIn    { from { opacity: 0; }                              to { opacity: 1; } }
@keyframes resSlideUp   { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes resSlideDown { from { opacity: 0; transform: translateY(-10px);}  to { opacity: 1; transform: translateY(0); } }
@keyframes resScaleIn   { from { opacity: 0; transform: scale(0.95); }      to { opacity: 1; transform: scale(1); } }
@keyframes resShimmer   { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes resSpin      { to { transform: rotate(360deg); } }
@keyframes resToastIn   { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
@keyframes resRowFadeIn { from { opacity: 0; transform: translateX(-8px); }  to { opacity: 1; transform: translateX(0); } }
@keyframes resPulse     { 0%,100% { opacity: 1; } 50% { opacity: .6; } }

.res-root      { min-height: 100vh; background: var(--adm-bg); font-family: 'Inter', system-ui, sans-serif; color: var(--adm-text); }
.res-container { max-width: 1440px; margin: 0 auto; padding: 28px 32px; }

/* ── KPIs ── */
.res-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 28px; animation: resSlideUp .5s cubic-bezier(.22,1,.36,1); }
.res-kpi-card { background: #fff; border: 1px solid var(--adm-line); border-radius: 14px; padding: 18px 20px; display: flex; align-items: center; gap: 14px; transition: all .3s cubic-bezier(.22,1,.36,1); position: relative; overflow: hidden; }
.res-kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--kpi-color,var(--adm-brand)); transform: scaleX(0); transform-origin: left; transition: transform .3s ease; }
.res-kpi-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0,0,0,.08); border-color: var(--kpi-color,var(--adm-brand)); }
.res-kpi-card:hover::before { transform: scaleX(1); }
.res-kpi-icon  { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--kpi-bg,rgba(255,117,14,.1)); color: var(--kpi-color,var(--adm-brand)); }
.res-kpi-label { font-size: 11px; font-weight: 600; color: var(--adm-subtle); letter-spacing: .05em; text-transform: uppercase; margin-bottom: 4px; }
.res-kpi-value { font-size: 22px; font-weight: 800; color: var(--kpi-color,var(--adm-brand)); line-height: 1; }

/* ── Toolbar ── */
.res-toolbar    { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; animation: resSlideUp .5s cubic-bezier(.22,1,.36,1); animation-delay: .1s; animation-fill-mode: backwards; }
.res-search-wrap { position: relative; flex: 1 1 280px; max-width: 420px; }
.res-search     { width: 100%; display: flex; align-items: center; background: #fff; border: 1.5px solid var(--adm-line); border-radius: 10px; padding: 0 14px; transition: all .2s; }
.res-search:focus-within { border-color: var(--adm-brand); box-shadow: 0 0 0 3px rgba(255,117,14,.1); }
.res-search-icon { color: var(--adm-subtle); margin-right: 10px; flex-shrink: 0; }
.res-search input { border: none; background: transparent; font-size: 13px; color: var(--adm-text); outline: none; flex: 1; padding: 10px 0; font-family: inherit; }
.res-search-clear { background: none; border: none; color: var(--adm-subtle); cursor: pointer; padding: 4px; display: flex; align-items: center; border-radius: 4px; transition: all .2s; }
.res-search-clear:hover { color: var(--adm-danger); background: rgba(239,68,68,.08); }
.res-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.res-pill { padding: 7px 14px; border-radius: 99px; cursor: pointer; transition: all .25s cubic-bezier(.22,1,.36,1); font-family: inherit; font-size: 12px; font-weight: 600; letter-spacing: .02em; border: 1.5px solid var(--adm-line); background: #fff; color: var(--adm-muted); display: inline-flex; align-items: center; gap: 6px; }
.res-pill:hover { background: var(--adm-surface-2); border-color: var(--adm-line-strong); transform: translateY(-1px); }
.res-pill.active { background: var(--pill-bg,rgba(255,117,14,.1)); color: var(--pill-color,var(--adm-brand)); border-color: var(--pill-border,rgba(255,117,14,.3)); box-shadow: 0 2px 8px var(--pill-shadow,rgba(255,117,14,.15)); }
.res-pill-count { font-size: 10px; background: rgba(0,0,0,.08); padding: 1px 6px; border-radius: 10px; font-weight: 700; }
.res-pill.active .res-pill-count { background: rgba(0,0,0,.1); }

/* ── Table Container ── */
.res-table-wrap   { background: #fff; border: 1px solid var(--adm-line); border-radius: 14px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.04); animation: resSlideUp .5s cubic-bezier(.22,1,.36,1); animation-delay: .2s; animation-fill-mode: backwards; }
.res-table-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--adm-line); background: var(--adm-bg); flex-wrap: wrap; gap: 10px; }
.res-table-info   { font-size: 12px; color: var(--adm-muted); font-weight: 500; display: flex; align-items: center; gap: 8px; }
.res-table-info strong { color: var(--adm-text); font-weight: 700; }
.res-clear-sort   { font-size: 11px; color: var(--adm-brand); background: rgba(255,117,14,.08); border: 1px solid rgba(255,117,14,.2); border-radius: 6px; padding: 4px 10px; cursor: pointer; font-weight: 600; font-family: inherit; transition: all .2s; display: inline-flex; align-items: center; gap: 4px; }
.res-clear-sort:hover { background: rgba(255,117,14,.15); }

/* ── Table ── */
.res-table-scroll { overflow-x: auto; }
.res-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.res-table th { padding: 13px 16px; text-align: left; font-weight: 700; color: var(--adm-muted); font-size: 11px; letter-spacing: .05em; text-transform: uppercase; border-bottom: 1.5px solid var(--adm-line); background: var(--adm-bg); white-space: nowrap; user-select: none; }
.res-table th.sortable { cursor: pointer; transition: all .2s; }
.res-table th.sortable:hover { background: rgba(255,117,14,.05); color: var(--adm-brand); }
.res-table th.sorted  { color: var(--adm-brand); background: rgba(255,117,14,.06); }
.res-th-content { display: flex; align-items: center; gap: 6px; }
.res-sort-icon  { opacity: .5; transition: all .2s; }
.res-table th.sortable:hover .res-sort-icon,
.res-table th.sorted .res-sort-icon { opacity: 1; color: var(--adm-brand); }
.res-table td { padding: 14px 16px; border-bottom: 1px solid var(--adm-surface-2); vertical-align: middle; }
.res-row { transition: all .2s ease; animation: resRowFadeIn .3s ease backwards; }
.res-row:hover { background: rgba(255,117,14,.03); }
.res-row:hover td { border-bottom-color: rgba(255,117,14,.15); }

/* ── Cells ── */
.res-pkg-title  { font-weight: 700; color: var(--adm-text); font-size: 13px; margin-bottom: 3px; display: flex; align-items: center; gap: 6px; }
.res-pkg-ref    { color: var(--adm-subtle); font-size: 10px; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }
.res-pkg-dates  { color: var(--adm-muted); font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 3px; }

.res-client-name  { font-weight: 600; color: var(--adm-text); font-size: 13px; display: flex; align-items: center; gap: 6px; }
.res-client-phone { color: var(--adm-subtle); font-size: 11px; margin-top: 2px; display: flex; align-items: center; gap: 4px; }
.res-client-email { color: var(--adm-subtle); font-size: 11px; margin-top: 2px; display: flex; align-items: center; gap: 4px; }

.res-pax-count { font-size: 15px; font-weight: 800; color: var(--adm-text); text-align: center; }
.res-pax-label { font-size: 10px; color: var(--adm-subtle); text-align: center; }

.res-total      { font-weight: 800; color: var(--adm-brand); font-size: 13px; white-space: nowrap; }
.res-total-sub  { font-size: 10px; color: var(--adm-subtle); font-weight: 500; margin-top: 2px; }

.res-hotels-mini { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.res-hotel-chip  { font-size: 10px; color: var(--adm-text-2); background: var(--adm-surface-2); border: 1px solid var(--adm-line); border-radius: 4px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 3px; }

/* ── Status ── */
.res-status { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; white-space: nowrap; border: 1.5px solid; transition: all .2s; }
.res-status.pending   { color: var(--adm-warning); background: rgba(217,119,6,.08);  border-color: rgba(217,119,6,.25); }
.res-status.confirmed { color: var(--adm-success); background: rgba(22,163,74,.08);  border-color: rgba(22,163,74,.25); }
.res-status.paid      { color: var(--adm-info); background: rgba(37,99,235,.08);  border-color: rgba(37,99,235,.25); }
.res-status.cancelled { color: var(--adm-danger); background: rgba(220,38,38,.08);  border-color: rgba(220,38,38,.25); }
.res-status.completed { color: var(--adm-chart-4); background: rgba(124,58,237,.08); border-color: rgba(124,58,237,.25); }

/* ── Actions ── */
.res-actions  { display: flex; gap: 4px; justify-content: flex-end; }
.res-icon-btn { width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--adm-muted); transition: all .2s; }
.res-icon-btn:hover         { background: var(--adm-surface-2); color: var(--adm-text); transform: translateY(-1px); }
.res-icon-btn.danger:hover  { background: var(--adm-danger-bg); color: var(--adm-danger); }
.res-icon-btn.primary:hover { background: rgba(255,117,14,.1); color: var(--adm-brand); }

/* ── Empty ── */
.res-empty       { padding: 60px 20px; text-align: center; animation: resFadeIn .5s ease; }
.res-empty-icon  { width: 72px; height: 72px; background: var(--adm-surface-2); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; color: var(--adm-subtle); }
.res-empty-title { font-size: 16px; font-weight: 600; color: var(--adm-text-2); margin: 0 0 8px; }
.res-empty-btn   { background: none; border: none; color: var(--adm-brand); cursor: pointer; font-size: 13px; font-weight: 700; text-decoration: underline; font-family: inherit; }

/* ── Skeleton ── */
.res-skeleton { height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--adm-line) 25%, var(--adm-surface-2) 50%, var(--adm-line) 75%); background-size: 200% 100%; animation: resShimmer 1.4s infinite; }

/* ── Pagination ── */
.res-pagination { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 14px 20px; border-top: 1px solid var(--adm-line); background: var(--adm-bg); }
.res-page-size  { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--adm-muted); }
.res-page-size select { appearance: none; border: 1.5px solid var(--adm-line); border-radius: 7px; padding: 5px 28px 5px 10px; font-size: 12px; font-family: inherit; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 8px center; color: var(--adm-text); cursor: pointer; outline: none; }
.res-page-size select:focus { border-color: var(--adm-brand); }
.res-page-nav  { display: flex; align-items: center; gap: 4px; }
.res-page-btn  { min-width: 32px; height: 32px; border-radius: 7px; border: 1.5px solid var(--adm-line); background: transparent; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; color: var(--adm-muted); transition: all .2s; display: flex; align-items: center; justify-content: center; padding: 0 8px; }
.res-page-btn:hover:not(:disabled) { border-color: var(--adm-brand); color: var(--adm-brand); background: rgba(255,117,14,.05); }
.res-page-btn.active { background: var(--adm-brand); border-color: var(--adm-brand); color: #fff; box-shadow: 0 2px 8px rgba(255,117,14,.3); }
.res-page-btn:disabled { opacity: .4; cursor: not-allowed; }
.res-page-ellipsis { padding: 0 6px; color: var(--adm-subtle); font-size: 13px; }

/* ── Modal ── */
.res-modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.55); backdrop-filter: blur(6px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; animation: resFadeIn .2s ease; }
.res-modal          { background: #fff; border: 1px solid var(--adm-line); border-radius: 16px; width: 100%; max-width: 440px; box-shadow: 0 24px 80px rgba(0,0,0,.2); animation: resScaleIn .25s cubic-bezier(.22,1,.36,1); overflow: hidden; }
.res-modal-header   { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid var(--adm-line); background: var(--adm-bg); }
.res-modal-title    { font-size: 16px; font-weight: 800; color: var(--adm-text); display: flex; align-items: center; gap: 10px; }
.res-modal-close    { background: none; border: none; cursor: pointer; color: var(--adm-subtle); padding: 6px; border-radius: 6px; display: flex; align-items: center; transition: all .2s; }
.res-modal-close:hover { background: var(--adm-surface-2); color: var(--adm-text); }
.res-modal-body     { padding: 24px; }
.res-modal-message  { color: var(--adm-text-2); font-size: 14px; line-height: 1.7; margin: 0 0 24px; }
.res-modal-actions  { display: flex; gap: 10px; justify-content: flex-end; }

/* ── Buttons ── */
.res-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: 9px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; transition: all .25s cubic-bezier(.22,1,.36,1); border: 1.5px solid transparent; white-space: nowrap; }
.res-btn:disabled { opacity: .5; cursor: not-allowed; }
.res-btn.primary { background: linear-gradient(135deg,var(--adm-brand),var(--adm-brand)); color: #fff; border-color: var(--adm-brand); box-shadow: 0 2px 8px rgba(255,117,14,.25); }
.res-btn.primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255,117,14,.35); }
.res-btn.ghost   { background: transparent; color: var(--adm-text-2); border-color: var(--adm-line); }
.res-btn.ghost:hover:not(:disabled) { background: var(--adm-surface-2); border-color: var(--adm-line-strong); }
.res-btn.danger  { background: var(--adm-danger-bg); color: var(--adm-danger); border-color: rgba(220,38,38,.25); }
.res-btn.danger:hover:not(:disabled) { background: var(--adm-danger-bg); border-color: var(--adm-danger); }
.res-btn.success { background: var(--adm-success-bg); color: var(--adm-success); border-color: rgba(22,163,74,.25); }
.res-btn.success:hover:not(:disabled){ background: var(--adm-success-bg); border-color: var(--adm-success); }
.res-btn.small { padding: 6px 12px; font-size: 12px; }
.res-btn.full  { width: 100%; justify-content: center; }

/* ── Spinner ── */
.res-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: resSpin .7s linear infinite; flex-shrink: 0; }

/* ── Drawer ── */
.res-drawer-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.4); backdrop-filter: blur(4px); z-index: 40; transition: opacity .3s; }
.res-drawer          { position: fixed; top: 50%; left: 50%; width: min(var(--sheet-w, 900px), 96vw); max-height: 90vh; background: var(--adm-surface, #fff); border: 1px solid var(--adm-line); border-radius: var(--adm-radius-lg, 14px); z-index: 50; overflow-y: auto; display: flex; flex-direction: column; transition: opacity .2s ease, transform .25s cubic-bezier(.22,1,.36,1); box-shadow: var(--adm-shadow-lg, 0 20px 50px rgba(15,23,42,.18)); }
.res-drawer-header   { display: flex; align-items: center; justify-content: space-between; padding: 20px 28px; border-bottom: 1px solid var(--adm-line); background: var(--adm-bg); position: sticky; top: 0; z-index: 10; }
.res-drawer-title    { font-size: 17px; font-weight: 800; color: var(--adm-text); display: flex; align-items: center; gap: 10px; }
.res-drawer-body     { flex: 1; padding: 28px; }

/* ── Form ── */
.res-field       { margin-bottom: 16px; }
.res-label       { display: block; color: var(--adm-text-2); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 6px; }
.res-input, .res-select, .res-textarea { width: 100%; background: #fff; border: 1.5px solid var(--adm-line); border-radius: 9px; color: var(--adm-text); font-family: inherit; font-size: 13px; padding: 10px 13px; outline: none; transition: all .2s; }
.res-input:focus, .res-select:focus, .res-textarea:focus { border-color: var(--adm-brand); box-shadow: 0 0 0 3px rgba(255,117,14,.1); }
.res-input::placeholder, .res-textarea::placeholder { color: var(--adm-subtle); }
.res-textarea    { resize: vertical; min-height: 80px; }
.res-select      { appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; background-color: #fff; padding-right: 36px; }
.res-field-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.res-field-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
.res-section-title { font-size: 14px; font-weight: 800; color: var(--adm-text); margin: 24px 0 14px; padding-bottom: 10px; border-bottom: 1.5px solid var(--adm-line); display: flex; align-items: center; gap: 8px; }
.res-section-title:first-child { margin-top: 0; }

/* ── Tab header with edit action ── */
.res-tab-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1.5px solid var(--adm-line); flex-wrap: wrap; gap: 10px; }
.res-tab-header-title { font-size: 15px; font-weight: 800; color: var(--adm-text); display: flex; align-items: center; gap: 8px; }
.res-tab-header-actions { display: flex; gap: 8px; align-items: center; }

/* ── Tabs ── */
.res-tabs { display: flex; gap: 6px; margin-bottom: 24px; border-bottom: 1.5px solid var(--adm-line); padding-bottom: 14px; flex-wrap: wrap; }
.res-tab  { background: transparent; color: var(--adm-muted); border: 1.5px solid transparent; border-radius: 8px; padding: 7px 14px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; transition: all .2s; display: flex; align-items: center; gap: 6px; }
.res-tab:hover  { background: var(--adm-surface-2); color: var(--adm-text); }
.res-tab.active { background: rgba(255,117,14,.08); color: var(--adm-brand); border-color: rgba(255,117,14,.2); }

/* ── Detail rows ── */
.res-detail-row       { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid var(--adm-surface-2); font-size: 13px; animation: resFadeIn .3s ease backwards; }
.res-detail-row:last-child { border-bottom: none; }
.res-detail-label { color: var(--adm-muted); display: flex; align-items: center; gap: 6px; }
.res-detail-value { color: var(--adm-text); font-weight: 600; text-align: right; max-width: 60%; }

/* ── Status changer ── */
.res-status-changer  { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--adm-bg); border-radius: 12px; border: 1.5px solid var(--adm-line); margin-bottom: 18px; }
.res-status-change-btn { background: none; border: none; color: var(--adm-brand); font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: underline; font-family: inherit; }
.res-status-pills    { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; animation: resSlideDown .3s ease; }
.res-status-pill     { padding: 6px 14px; border-radius: 99px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; border: 1.5px solid; background: transparent; transition: all .2s; display: inline-flex; align-items: center; gap: 6px; }
.res-status-pill:hover { transform: translateY(-1px); }
.res-status-pill.selected { box-shadow: 0 2px 8px rgba(0,0,0,.1); }

/* ── Hotel block ── */
.res-hotel-block { background: var(--adm-bg); border: 1.5px solid var(--adm-line); border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; animation: resSlideUp .3s ease; }
.res-hotel-block-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.res-hotel-block-name   { font-weight: 800; font-size: 14px; color: var(--adm-text); display: flex; align-items: center; gap: 6px; }
.res-hotel-block-subtotal { background: rgba(255,117,14,.1); color: var(--adm-brand); font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; border: 1px solid rgba(255,117,14,.2); }
.res-hotel-rooms { display: flex; gap: 6px; flex-wrap: wrap; }
.res-room-tag    { padding: 3px 9px; border-radius: 6px; font-size: 10px; font-weight: 700; background: var(--adm-info-bg); color: var(--adm-info); border: 1px solid rgba(37,99,235,.2); display: inline-flex; align-items: center; gap: 4px; }

/* ── Participant card ── */
.res-participant-card { background: var(--adm-bg); border: 1px solid var(--adm-line); border-radius: 9px; padding: 12px 14px; margin-bottom: 8px; animation: resFadeIn .3s ease backwards; display: flex; align-items: flex-start; gap: 10px; }
.res-participant-num  { width: 24px; height: 24px; border-radius: 6px; background: rgba(255,117,14,.1); color: var(--adm-brand); font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
.res-participant-info { flex: 1; min-width: 0; }
.res-participant-name { font-weight: 700; color: var(--adm-text); font-size: 13px; }
.res-participant-meta { color: var(--adm-subtle); font-size: 11px; margin-top: 3px; display: flex; flex-wrap: wrap; gap: 10px; }
.res-participant-empty{ color: var(--adm-subtle); font-size: 12px; font-style: italic; }

/* ── Paiement summary ── */
.res-paiement-summary { background: linear-gradient(135deg,var(--adm-brand-soft),#fff); border: 1.5px solid rgba(255,117,14,.25); border-radius: 12px; padding: 18px 20px; margin-top: 8px; }
.res-paiement-title   { font-size: 13px; font-weight: 800; color: var(--adm-brand); margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
.res-paiement-row     { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px dashed rgba(255,117,14,.15); }
.res-paiement-row:last-child { border-bottom: none; }
.res-paiement-row.total { font-weight: 800; font-size: 15px; color: var(--adm-brand); padding-top: 10px; margin-top: 6px; border-top: 2px solid rgba(255,117,14,.3); border-bottom: none; }
.res-paiement-row .label { color: var(--adm-muted); }
.res-paiement-row .value { color: var(--adm-text); font-weight: 600; }
.res-paiement-row.total .value { color: var(--adm-brand); }

/* ── Supplement item ── */
.res-supplement-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--adm-bg); border: 1px solid var(--adm-line); border-radius: 9px; font-size: 13px; margin-bottom: 6px; animation: resFadeIn .3s ease backwards; }
.res-supplement-icon { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,117,14,.08); color: var(--adm-brand); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

/* ── Payments ── */
.res-pay-dashboard { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; animation: resSlideUp .4s ease; }
.res-pay-stat { background: #fff; border: 1.5px solid var(--adm-line); border-radius: 12px; padding: 16px; position: relative; overflow: hidden; }
.res-pay-stat::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--stat-color,var(--adm-brand)); }
.res-pay-stat-label { font-size: 10px; font-weight: 700; color: var(--adm-subtle); letter-spacing: .05em; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
.res-pay-stat-value { font-size: 20px; font-weight: 800; color: var(--stat-color,var(--adm-text)); line-height: 1; }
.res-pay-stat-sub { font-size: 11px; color: var(--adm-muted); margin-top: 6px; font-weight: 500; }
.res-pay-stat.total   { --stat-color: var(--adm-brand); }
.res-pay-stat.paid    { --stat-color: var(--adm-success); }
.res-pay-stat.remaining { --stat-color: var(--adm-danger); }
.res-pay-stat.remaining.paid-off { --stat-color: var(--adm-success); }

.res-pay-progress { height: 8px; background: var(--adm-danger-bg); border-radius: 99px; overflow: hidden; margin-top: 10px; position: relative; }
.res-pay-progress-bar { height: 100%; background: linear-gradient(90deg,var(--adm-success),var(--adm-success)); border-radius: 99px; transition: width .6s cubic-bezier(.22,1,.36,1); }

.res-pay-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
.res-pay-list-title { font-size: 14px; font-weight: 800; color: var(--adm-text); display: flex; align-items: center; gap: 8px; }

.res-pay-item { background: #fff; border: 1.5px solid var(--adm-line); border-radius: 11px; padding: 14px 16px; margin-bottom: 10px; display: flex; align-items: center; gap: 14px; transition: all .2s; animation: resRowFadeIn .3s ease backwards; }
.res-pay-item:hover { border-color: var(--adm-line-strong); box-shadow: 0 4px 12px rgba(0,0,0,.04); }
.res-pay-icon-wrap { width: 42px; height: 42px; border-radius: 10px; background: var(--pay-bg,rgba(255,117,14,.1)); color: var(--pay-color,var(--adm-brand)); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.res-pay-info { flex: 1; min-width: 0; }
.res-pay-method { font-weight: 700; color: var(--adm-text); font-size: 13px; display: flex; align-items: center; gap: 6px; }
.res-pay-meta { color: var(--adm-subtle); font-size: 11px; margin-top: 3px; display: flex; flex-wrap: wrap; gap: 10px; }
.res-pay-meta span { display: inline-flex; align-items: center; gap: 3px; }
.res-pay-note { color: var(--adm-muted); font-size: 11px; font-style: italic; margin-top: 4px; }
.res-pay-amount { font-size: 18px; font-weight: 800; color: var(--adm-success); white-space: nowrap; }
.res-pay-actions { display: flex; gap: 4px; }

.res-pay-empty { padding: 40px 20px; text-align: center; background: var(--adm-bg); border: 1.5px dashed var(--adm-line); border-radius: 12px; }
.res-pay-empty-icon { width: 56px; height: 56px; background: #fff; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; color: var(--adm-subtle); border: 1px solid var(--adm-line); }
.res-pay-empty-title { font-size: 14px; font-weight: 700; color: var(--adm-text-2); margin: 0 0 6px; }
.res-pay-empty-sub { font-size: 12px; color: var(--adm-subtle); margin: 0 0 14px; }

/* ── Payment form ── */
.res-pay-form { background: var(--adm-brand-soft); border: 1.5px solid rgba(255,117,14,.25); border-radius: 12px; padding: 18px; margin-bottom: 18px; animation: resSlideDown .3s ease; }
.res-pay-form-title { font-size: 13px; font-weight: 800; color: var(--adm-brand); margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
.res-pay-method-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.res-pay-method-pill { padding: 7px 12px; border-radius: 99px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: 700; border: 1.5px solid; background: #fff; transition: all .2s; display: inline-flex; align-items: center; gap: 5px; color: var(--adm-muted); border-color: var(--adm-line); }
.res-pay-method-pill:hover { transform: translateY(-1px); }
.res-pay-method-pill.selected { color: var(--m-color,var(--adm-brand)); background: var(--m-bg,rgba(255,117,14,.1)); border-color: var(--m-border,rgba(255,117,14,.3)); box-shadow: 0 2px 8px var(--m-bg,rgba(255,117,14,.15)); }

/* ── Toast ── */
.res-toast { position: fixed; bottom: 28px; right: 28px; z-index: 200; padding: 14px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; box-shadow: 0 8px 30px rgba(0,0,0,.12); animation: resToastIn .35s cubic-bezier(.22,1,.36,1); display: flex; align-items: center; gap: 10px; max-width: 400px; }
.res-toast.success { background: var(--adm-success-bg); border: 1.5px solid rgba(22,163,74,.25); color: var(--adm-success); }
.res-toast.error   { background: var(--adm-danger-bg); border: 1.5px solid rgba(220,38,38,.25); color: var(--adm-danger); }

/* ── Responsive ── */
@media (max-width: 1200px) { .res-kpis { grid-template-columns: repeat(3,1fr); } }
@media (max-width: 900px)  {
  .res-container { padding: 20px 16px; }
  .res-kpis { grid-template-columns: repeat(2,1fr); }
  .res-table th, .res-table td { padding: 10px 12px; }
  .res-drawer { width: 100vw; max-height: 100vh; height: 100vh; border-radius: 0; }
  .res-field-row-3 { grid-template-columns: 1fr; }
  .res-pay-dashboard { grid-template-columns: 1fr; }
}
@media (max-width: 640px)  {
  .res-kpis { grid-template-columns: 1fr; }
  .res-toolbar { flex-direction: column; align-items: stretch; }
  .res-search-wrap { max-width: 100%; }
  .res-filters { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 4px; }
  .res-pill { white-space: nowrap; flex-shrink: 0; }
  .res-field-row { grid-template-columns: 1fr; }
  .res-drawer-body { padding: 20px 16px; }
  .res-modal-body  { padding: 20px; }
  .res-modal-actions { flex-direction: column-reverse; }
  .res-modal-actions .res-btn { width: 100%; justify-content: center; }
  .res-pagination { flex-direction: column; align-items: stretch; gap: 14px; }
  .res-page-nav { justify-content: center; }
  .res-pay-item { flex-wrap: wrap; }
  .res-pay-amount { width: 100%; text-align: right; }
}
@media (prefers-reduced-motion: reduce) {
  .res-kpi-card,.res-pill,.res-btn,.res-icon-btn,.res-page-btn,.res-row,.res-hotel-block,.res-modal,.res-toast { animation: none !important; transition: none !important; }
  .res-kpi-card::before,.res-skeleton { animation: none !important; }
}
`;

export function useInjectStyles() {
  useEffect(() => {
    if (document.getElementById('res-global-styles')) return;
    const el = document.createElement('style');
    el.id = 'res-global-styles';
    el.textContent = RES_CSS;
    document.head.appendChild(el);
  }, []);
}

// Which Notifications-tab trigger (Paramètres) fires on each status
// transition — 'pending' has none, it's the initial status set at
// creation, handled by reservation_created_* in ReservationContext instead.
export const STATUS_TRIGGER = {
  confirmed: 'reservation_confirmed',
  paid: 'reservation_paid',
  cancelled: 'reservation_cancelled',
  completed: 'reservation_completed',
};
