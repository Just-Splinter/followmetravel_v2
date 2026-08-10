import { useState, useEffect, useCallback } from "react";
import { useReservation } from "../context/ReservationContext";
import {
  Search, X, Eye, Edit3, Trash2,
  Calendar, Users, DollarSign, FileText, Receipt,
  CheckCircle, Clock, CreditCard, XCircle, Flag,
  Mail, Phone, User, Hash, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, AlertCircle,
  TrendingUp, Package, Hotel, Plane,
  Gift, Save, Plus,
  Wallet, Banknote, ArrowRightLeft, Pencil, History
} from "lucide-react";

// ─── Global CSS ──────────────────────────────────────────────────────────────
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

.res-root      { min-height: 100vh; background: #f8fafc; font-family: 'Inter', system-ui, sans-serif; color: #1e293b; }
.res-container { max-width: 1440px; margin: 0 auto; padding: 28px 32px; }

/* ── KPIs ── */
.res-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 28px; animation: resSlideUp .5s cubic-bezier(.22,1,.36,1); }
.res-kpi-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; display: flex; align-items: center; gap: 14px; transition: all .3s cubic-bezier(.22,1,.36,1); position: relative; overflow: hidden; }
.res-kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--kpi-color,#ff750e); transform: scaleX(0); transform-origin: left; transition: transform .3s ease; }
.res-kpi-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0,0,0,.08); border-color: var(--kpi-color,#ff750e); }
.res-kpi-card:hover::before { transform: scaleX(1); }
.res-kpi-icon  { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--kpi-bg,rgba(255,117,14,.1)); color: var(--kpi-color,#ff750e); }
.res-kpi-label { font-size: 11px; font-weight: 600; color: #94a3b8; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 4px; }
.res-kpi-value { font-size: 22px; font-weight: 800; color: var(--kpi-color,#ff750e); line-height: 1; }

/* ── Toolbar ── */
.res-toolbar    { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; animation: resSlideUp .5s cubic-bezier(.22,1,.36,1); animation-delay: .1s; animation-fill-mode: backwards; }
.res-search-wrap { position: relative; flex: 1 1 280px; max-width: 420px; }
.res-search     { width: 100%; display: flex; align-items: center; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0 14px; transition: all .2s; }
.res-search:focus-within { border-color: #ff750e; box-shadow: 0 0 0 3px rgba(255,117,14,.1); }
.res-search-icon { color: #94a3b8; margin-right: 10px; flex-shrink: 0; }
.res-search input { border: none; background: transparent; font-size: 13px; color: #1e293b; outline: none; flex: 1; padding: 10px 0; font-family: inherit; }
.res-search-clear { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; display: flex; align-items: center; border-radius: 4px; transition: all .2s; }
.res-search-clear:hover { color: #ef4444; background: rgba(239,68,68,.08); }
.res-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.res-pill { padding: 7px 14px; border-radius: 99px; cursor: pointer; transition: all .25s cubic-bezier(.22,1,.36,1); font-family: inherit; font-size: 12px; font-weight: 600; letter-spacing: .02em; border: 1.5px solid #e2e8f0; background: #fff; color: #64748b; display: inline-flex; align-items: center; gap: 6px; }
.res-pill:hover { background: #f1f5f9; border-color: #cbd5e1; transform: translateY(-1px); }
.res-pill.active { background: var(--pill-bg,rgba(255,117,14,.1)); color: var(--pill-color,#ff750e); border-color: var(--pill-border,rgba(255,117,14,.3)); box-shadow: 0 2px 8px var(--pill-shadow,rgba(255,117,14,.15)); }
.res-pill-count { font-size: 10px; background: rgba(0,0,0,.08); padding: 1px 6px; border-radius: 10px; font-weight: 700; }
.res-pill.active .res-pill-count { background: rgba(0,0,0,.1); }

/* ── Table Container ── */
.res-table-wrap   { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.04); animation: resSlideUp .5s cubic-bezier(.22,1,.36,1); animation-delay: .2s; animation-fill-mode: backwards; }
.res-table-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #e2e8f0; background: #fafafa; flex-wrap: wrap; gap: 10px; }
.res-table-info   { font-size: 12px; color: #64748b; font-weight: 500; display: flex; align-items: center; gap: 8px; }
.res-table-info strong { color: #1e293b; font-weight: 700; }
.res-clear-sort   { font-size: 11px; color: #ff750e; background: rgba(255,117,14,.08); border: 1px solid rgba(255,117,14,.2); border-radius: 6px; padding: 4px 10px; cursor: pointer; font-weight: 600; font-family: inherit; transition: all .2s; display: inline-flex; align-items: center; gap: 4px; }
.res-clear-sort:hover { background: rgba(255,117,14,.15); }

/* ── Table ── */
.res-table-scroll { overflow-x: auto; }
.res-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.res-table th { padding: 13px 16px; text-align: left; font-weight: 700; color: #64748b; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; border-bottom: 1.5px solid #e2e8f0; background: #fafafa; white-space: nowrap; user-select: none; }
.res-table th.sortable { cursor: pointer; transition: all .2s; }
.res-table th.sortable:hover { background: rgba(255,117,14,.05); color: #ff750e; }
.res-table th.sorted  { color: #ff750e; background: rgba(255,117,14,.06); }
.res-th-content { display: flex; align-items: center; gap: 6px; }
.res-sort-icon  { opacity: .5; transition: all .2s; }
.res-table th.sortable:hover .res-sort-icon,
.res-table th.sorted .res-sort-icon { opacity: 1; color: #ff750e; }
.res-table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.res-row { transition: all .2s ease; animation: resRowFadeIn .3s ease backwards; }
.res-row:hover { background: rgba(255,117,14,.03); }
.res-row:hover td { border-bottom-color: rgba(255,117,14,.15); }

/* ── Cells ── */
.res-pkg-title  { font-weight: 700; color: #1e293b; font-size: 13px; margin-bottom: 3px; display: flex; align-items: center; gap: 6px; }
.res-pkg-ref    { color: #94a3b8; font-size: 10px; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }
.res-pkg-dates  { color: #64748b; font-size: 11px; display: flex; align-items: center; gap: 4px; margin-top: 3px; }

.res-client-name  { font-weight: 600; color: #1e293b; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.res-client-phone { color: #94a3b8; font-size: 11px; margin-top: 2px; display: flex; align-items: center; gap: 4px; }
.res-client-email { color: #94a3b8; font-size: 11px; margin-top: 2px; display: flex; align-items: center; gap: 4px; }

.res-pax-count { font-size: 15px; font-weight: 800; color: #1e293b; text-align: center; }
.res-pax-label { font-size: 10px; color: #94a3b8; text-align: center; }

.res-total      { font-weight: 800; color: #ff750e; font-size: 13px; white-space: nowrap; }
.res-total-sub  { font-size: 10px; color: #94a3b8; font-weight: 500; margin-top: 2px; }

.res-hotels-mini { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.res-hotel-chip  { font-size: 10px; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 3px; }

/* ── Status ── */
.res-status { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; white-space: nowrap; border: 1.5px solid; transition: all .2s; }
.res-status.pending   { color: #d97706; background: rgba(217,119,6,.08);  border-color: rgba(217,119,6,.25); }
.res-status.confirmed { color: #16a34a; background: rgba(22,163,74,.08);  border-color: rgba(22,163,74,.25); }
.res-status.paid      { color: #2563eb; background: rgba(37,99,235,.08);  border-color: rgba(37,99,235,.25); }
.res-status.cancelled { color: #dc2626; background: rgba(220,38,38,.08);  border-color: rgba(220,38,38,.25); }
.res-status.completed { color: #7c3aed; background: rgba(124,58,237,.08); border-color: rgba(124,58,237,.25); }

/* ── Actions ── */
.res-actions  { display: flex; gap: 4px; justify-content: flex-end; }
.res-icon-btn { width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b; transition: all .2s; }
.res-icon-btn:hover         { background: #f1f5f9; color: #1e293b; transform: translateY(-1px); }
.res-icon-btn.danger:hover  { background: #fef2f2; color: #dc2626; }
.res-icon-btn.primary:hover { background: rgba(255,117,14,.1); color: #ff750e; }

/* ── Empty ── */
.res-empty       { padding: 60px 20px; text-align: center; animation: resFadeIn .5s ease; }
.res-empty-icon  { width: 72px; height: 72px; background: #f1f5f9; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; color: #94a3b8; }
.res-empty-title { font-size: 16px; font-weight: 600; color: #475569; margin: 0 0 8px; }
.res-empty-btn   { background: none; border: none; color: #ff750e; cursor: pointer; font-size: 13px; font-weight: 700; text-decoration: underline; font-family: inherit; }

/* ── Skeleton ── */
.res-skeleton { height: 12px; border-radius: 6px; background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%); background-size: 200% 100%; animation: resShimmer 1.4s infinite; }

/* ── Pagination ── */
.res-pagination { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 14px 20px; border-top: 1px solid #e2e8f0; background: #fafafa; }
.res-page-size  { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b; }
.res-page-size select { appearance: none; border: 1.5px solid #e2e8f0; border-radius: 7px; padding: 5px 28px 5px 10px; font-size: 12px; font-family: inherit; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 8px center; color: #1e293b; cursor: pointer; outline: none; }
.res-page-size select:focus { border-color: #ff750e; }
.res-page-nav  { display: flex; align-items: center; gap: 4px; }
.res-page-btn  { min-width: 32px; height: 32px; border-radius: 7px; border: 1.5px solid #e2e8f0; background: transparent; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; color: #64748b; transition: all .2s; display: flex; align-items: center; justify-content: center; padding: 0 8px; }
.res-page-btn:hover:not(:disabled) { border-color: #ff750e; color: #ff750e; background: rgba(255,117,14,.05); }
.res-page-btn.active { background: #ff750e; border-color: #ff750e; color: #fff; box-shadow: 0 2px 8px rgba(255,117,14,.3); }
.res-page-btn:disabled { opacity: .4; cursor: not-allowed; }
.res-page-ellipsis { padding: 0 6px; color: #94a3b8; font-size: 13px; }

/* ── Modal ── */
.res-modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.55); backdrop-filter: blur(6px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; animation: resFadeIn .2s ease; }
.res-modal          { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; width: 100%; max-width: 440px; box-shadow: 0 24px 80px rgba(0,0,0,.2); animation: resScaleIn .25s cubic-bezier(.22,1,.36,1); overflow: hidden; }
.res-modal-header   { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid #e2e8f0; background: #fafafa; }
.res-modal-title    { font-size: 16px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 10px; }
.res-modal-close    { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 6px; border-radius: 6px; display: flex; align-items: center; transition: all .2s; }
.res-modal-close:hover { background: #f1f5f9; color: #1e293b; }
.res-modal-body     { padding: 24px; }
.res-modal-message  { color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 24px; }
.res-modal-actions  { display: flex; gap: 10px; justify-content: flex-end; }

/* ── Buttons ── */
.res-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: 9px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; transition: all .25s cubic-bezier(.22,1,.36,1); border: 1.5px solid transparent; white-space: nowrap; }
.res-btn:disabled { opacity: .5; cursor: not-allowed; }
.res-btn.primary { background: linear-gradient(135deg,#ff750e,#ff8c3e); color: #fff; border-color: #ff750e; box-shadow: 0 2px 8px rgba(255,117,14,.25); }
.res-btn.primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255,117,14,.35); }
.res-btn.ghost   { background: transparent; color: #475569; border-color: #e2e8f0; }
.res-btn.ghost:hover:not(:disabled) { background: #f1f5f9; border-color: #cbd5e1; }
.res-btn.danger  { background: #fef2f2; color: #dc2626; border-color: rgba(220,38,38,.25); }
.res-btn.danger:hover:not(:disabled) { background: #fee2e2; border-color: #dc2626; }
.res-btn.success { background: #f0fdf4; color: #16a34a; border-color: rgba(22,163,74,.25); }
.res-btn.success:hover:not(:disabled){ background: #dcfce7; border-color: #16a34a; }
.res-btn.small { padding: 6px 12px; font-size: 12px; }
.res-btn.full  { width: 100%; justify-content: center; }

/* ── Spinner ── */
.res-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: resSpin .7s linear infinite; flex-shrink: 0; }

/* ── Drawer ── */
.res-drawer-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.4); backdrop-filter: blur(4px); z-index: 40; transition: opacity .3s; }
.res-drawer          { position: fixed; top: 0; right: 0; bottom: 0; width: 780px; max-width: 96vw; background: #fff; border-left: 1px solid #e2e8f0; z-index: 50; overflow-y: auto; display: flex; flex-direction: column; transition: transform .35s cubic-bezier(.22,1,.36,1); box-shadow: -12px 0 48px rgba(15,23,42,.12); }
.res-drawer-header   { display: flex; align-items: center; justify-content: space-between; padding: 20px 28px; border-bottom: 1px solid #e2e8f0; background: #fafafa; position: sticky; top: 0; z-index: 10; }
.res-drawer-title    { font-size: 17px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 10px; }
.res-drawer-body     { flex: 1; padding: 28px; }

/* ── Form ── */
.res-field       { margin-bottom: 16px; }
.res-label       { display: block; color: #475569; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 6px; }
.res-input, .res-select, .res-textarea { width: 100%; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 9px; color: #1e293b; font-family: inherit; font-size: 13px; padding: 10px 13px; outline: none; transition: all .2s; }
.res-input:focus, .res-select:focus, .res-textarea:focus { border-color: #ff750e; box-shadow: 0 0 0 3px rgba(255,117,14,.1); }
.res-input::placeholder, .res-textarea::placeholder { color: #94a3b8; }
.res-textarea    { resize: vertical; min-height: 80px; }
.res-select      { appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; background-color: #fff; padding-right: 36px; }
.res-field-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.res-field-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
.res-section-title { font-size: 14px; font-weight: 800; color: #1e293b; margin: 24px 0 14px; padding-bottom: 10px; border-bottom: 1.5px solid #e2e8f0; display: flex; align-items: center; gap: 8px; }
.res-section-title:first-child { margin-top: 0; }

/* ── Tab header with edit action ── */
.res-tab-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1.5px solid #e2e8f0; flex-wrap: wrap; gap: 10px; }
.res-tab-header-title { font-size: 15px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 8px; }
.res-tab-header-actions { display: flex; gap: 8px; align-items: center; }

/* ── Tabs ── */
.res-tabs { display: flex; gap: 6px; margin-bottom: 24px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 14px; flex-wrap: wrap; }
.res-tab  { background: transparent; color: #64748b; border: 1.5px solid transparent; border-radius: 8px; padding: 7px 14px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; transition: all .2s; display: flex; align-items: center; gap: 6px; }
.res-tab:hover  { background: #f1f5f9; color: #1e293b; }
.res-tab.active { background: rgba(255,117,14,.08); color: #ff750e; border-color: rgba(255,117,14,.2); }

/* ── Detail rows ── */
.res-detail-row       { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; animation: resFadeIn .3s ease backwards; }
.res-detail-row:last-child { border-bottom: none; }
.res-detail-label { color: #64748b; display: flex; align-items: center; gap: 6px; }
.res-detail-value { color: #1e293b; font-weight: 600; text-align: right; max-width: 60%; }

/* ── Status changer ── */
.res-status-changer  { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #fafafa; border-radius: 12px; border: 1.5px solid #e2e8f0; margin-bottom: 18px; }
.res-status-change-btn { background: none; border: none; color: #ff750e; font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: underline; font-family: inherit; }
.res-status-pills    { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; animation: resSlideDown .3s ease; }
.res-status-pill     { padding: 6px 14px; border-radius: 99px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; border: 1.5px solid; background: transparent; transition: all .2s; display: inline-flex; align-items: center; gap: 6px; }
.res-status-pill:hover { transform: translateY(-1px); }
.res-status-pill.selected { box-shadow: 0 2px 8px rgba(0,0,0,.1); }

/* ── Hotel block ── */
.res-hotel-block { background: #fafafa; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; animation: resSlideUp .3s ease; }
.res-hotel-block-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.res-hotel-block-name   { font-weight: 800; font-size: 14px; color: #1e293b; display: flex; align-items: center; gap: 6px; }
.res-hotel-block-subtotal { background: rgba(255,117,14,.1); color: #ff750e; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; border: 1px solid rgba(255,117,14,.2); }
.res-hotel-rooms { display: flex; gap: 6px; flex-wrap: wrap; }
.res-room-tag    { padding: 3px 9px; border-radius: 6px; font-size: 10px; font-weight: 700; background: #eff6ff; color: #2563eb; border: 1px solid rgba(37,99,235,.2); display: inline-flex; align-items: center; gap: 4px; }

/* ── Participant card ── */
.res-participant-card { background: #fafafa; border: 1px solid #e2e8f0; border-radius: 9px; padding: 12px 14px; margin-bottom: 8px; animation: resFadeIn .3s ease backwards; display: flex; align-items: flex-start; gap: 10px; }
.res-participant-num  { width: 24px; height: 24px; border-radius: 6px; background: rgba(255,117,14,.1); color: #ff750e; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
.res-participant-info { flex: 1; min-width: 0; }
.res-participant-name { font-weight: 700; color: #1e293b; font-size: 13px; }
.res-participant-meta { color: #94a3b8; font-size: 11px; margin-top: 3px; display: flex; flex-wrap: wrap; gap: 10px; }
.res-participant-empty{ color: #94a3b8; font-size: 12px; font-style: italic; }

/* ── Paiement summary ── */
.res-paiement-summary { background: linear-gradient(135deg,#fff7ed,#fff); border: 1.5px solid rgba(255,117,14,.25); border-radius: 12px; padding: 18px 20px; margin-top: 8px; }
.res-paiement-title   { font-size: 13px; font-weight: 800; color: #ff750e; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
.res-paiement-row     { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px dashed rgba(255,117,14,.15); }
.res-paiement-row:last-child { border-bottom: none; }
.res-paiement-row.total { font-weight: 800; font-size: 15px; color: #ff750e; padding-top: 10px; margin-top: 6px; border-top: 2px solid rgba(255,117,14,.3); border-bottom: none; }
.res-paiement-row .label { color: #64748b; }
.res-paiement-row .value { color: #1e293b; font-weight: 600; }
.res-paiement-row.total .value { color: #ff750e; }

/* ── Supplement item ── */
.res-supplement-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 9px; font-size: 13px; margin-bottom: 6px; animation: resFadeIn .3s ease backwards; }
.res-supplement-icon { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,117,14,.08); color: #ff750e; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

/* ── Payments ── */
.res-pay-dashboard { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; animation: resSlideUp .4s ease; }
.res-pay-stat { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px; position: relative; overflow: hidden; }
.res-pay-stat::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--stat-color,#ff750e); }
.res-pay-stat-label { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
.res-pay-stat-value { font-size: 20px; font-weight: 800; color: var(--stat-color,#1e293b); line-height: 1; }
.res-pay-stat-sub { font-size: 11px; color: #64748b; margin-top: 6px; font-weight: 500; }
.res-pay-stat.total   { --stat-color: #ff750e; }
.res-pay-stat.paid    { --stat-color: #16a34a; }
.res-pay-stat.remaining { --stat-color: #dc2626; }
.res-pay-stat.remaining.paid-off { --stat-color: #16a34a; }

.res-pay-progress { height: 8px; background: #fee2e2; border-radius: 99px; overflow: hidden; margin-top: 10px; position: relative; }
.res-pay-progress-bar { height: 100%; background: linear-gradient(90deg,#16a34a,#22c55e); border-radius: 99px; transition: width .6s cubic-bezier(.22,1,.36,1); }

.res-pay-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
.res-pay-list-title { font-size: 14px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 8px; }

.res-pay-item { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 11px; padding: 14px 16px; margin-bottom: 10px; display: flex; align-items: center; gap: 14px; transition: all .2s; animation: resRowFadeIn .3s ease backwards; }
.res-pay-item:hover { border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,.04); }
.res-pay-icon-wrap { width: 42px; height: 42px; border-radius: 10px; background: var(--pay-bg,rgba(255,117,14,.1)); color: var(--pay-color,#ff750e); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.res-pay-info { flex: 1; min-width: 0; }
.res-pay-method { font-weight: 700; color: #1e293b; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.res-pay-meta { color: #94a3b8; font-size: 11px; margin-top: 3px; display: flex; flex-wrap: wrap; gap: 10px; }
.res-pay-meta span { display: inline-flex; align-items: center; gap: 3px; }
.res-pay-note { color: #64748b; font-size: 11px; font-style: italic; margin-top: 4px; }
.res-pay-amount { font-size: 18px; font-weight: 800; color: #16a34a; white-space: nowrap; }
.res-pay-actions { display: flex; gap: 4px; }

.res-pay-empty { padding: 40px 20px; text-align: center; background: #fafafa; border: 1.5px dashed #e2e8f0; border-radius: 12px; }
.res-pay-empty-icon { width: 56px; height: 56px; background: #fff; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; color: #94a3b8; border: 1px solid #e2e8f0; }
.res-pay-empty-title { font-size: 14px; font-weight: 700; color: #475569; margin: 0 0 6px; }
.res-pay-empty-sub { font-size: 12px; color: #94a3b8; margin: 0 0 14px; }

/* ── Payment form ── */
.res-pay-form { background: #fff7ed; border: 1.5px solid rgba(255,117,14,.25); border-radius: 12px; padding: 18px; margin-bottom: 18px; animation: resSlideDown .3s ease; }
.res-pay-form-title { font-size: 13px; font-weight: 800; color: #ff750e; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
.res-pay-method-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.res-pay-method-pill { padding: 7px 12px; border-radius: 99px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: 700; border: 1.5px solid; background: #fff; transition: all .2s; display: inline-flex; align-items: center; gap: 5px; color: #64748b; border-color: #e2e8f0; }
.res-pay-method-pill:hover { transform: translateY(-1px); }
.res-pay-method-pill.selected { color: var(--m-color,#ff750e); background: var(--m-bg,rgba(255,117,14,.1)); border-color: var(--m-border,rgba(255,117,14,.3)); box-shadow: 0 2px 8px var(--m-bg,rgba(255,117,14,.15)); }

/* ── Toast ── */
.res-toast { position: fixed; bottom: 28px; right: 28px; z-index: 200; padding: 14px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; box-shadow: 0 8px 30px rgba(0,0,0,.12); animation: resToastIn .35s cubic-bezier(.22,1,.36,1); display: flex; align-items: center; gap: 10px; max-width: 400px; }
.res-toast.success { background: #f0fdf4; border: 1.5px solid rgba(22,163,74,.25); color: #16a34a; }
.res-toast.error   { background: #fef2f2; border: 1.5px solid rgba(220,38,38,.25); color: #dc2626; }

/* ── Responsive ── */
@media (max-width: 1200px) { .res-kpis { grid-template-columns: repeat(3,1fr); } }
@media (max-width: 900px)  {
  .res-container { padding: 20px 16px; }
  .res-kpis { grid-template-columns: repeat(2,1fr); }
  .res-table th, .res-table td { padding: 10px 12px; }
  .res-drawer { width: 100%; max-width: 100%; }
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

function useInjectStyles() {
  useEffect(() => {
    if (document.getElementById("res-global-styles")) return;
    const el = document.createElement("style");
    el.id = "res-global-styles";
    el.textContent = RES_CSS;
    document.head.appendChild(el);
  }, []);
}

// ─── Constants ───────────────────────────────────────────────────────────────
const STATUS_MAP = {
  pending:   { label: "En attente", color: "#d97706", bg: "rgba(217,119,6,0.08)",  border: "rgba(217,119,6,0.25)",  icon: Clock,       className: "pending" },
  confirmed: { label: "Confirmée",  color: "#16a34a", bg: "rgba(22,163,74,0.08)",  border: "rgba(22,163,74,0.25)",  icon: CheckCircle, className: "confirmed" },
  paid:      { label: "Payée",      color: "#2563eb", bg: "rgba(37,99,235,0.08)",  border: "rgba(37,99,235,0.25)",  icon: CreditCard,  className: "paid" },
  cancelled: { label: "Annulée",    color: "#dc2626", bg: "rgba(220,38,38,0.08)",  border: "rgba(220,38,38,0.25)",  icon: XCircle,     className: "cancelled" },
  completed: { label: "Terminée",   color: "#7c3aed", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.25)", icon: Flag,        className: "completed" },
};

const PAYMENT_METHODS = {
  cash:     { label: "Espèces",        color: "#16a34a", bg: "rgba(22,163,74,.1)",   border: "rgba(22,163,74,.3)",   icon: Banknote },
  transfer: { label: "Virement",       color: "#2563eb", bg: "rgba(37,99,235,.1)",   border: "rgba(37,99,235,.3)",   icon: ArrowRightLeft },
  card:     { label: "Carte bancaire", color: "#7c3aed", bg: "rgba(124,58,237,.1)",  border: "rgba(124,58,237,.3)",  icon: CreditCard },
  check:    { label: "Chèque",         color: "#d97706", bg: "rgba(217,119,6,.1)",   border: "rgba(217,119,6,.3)",   icon: Receipt },
  other:    { label: "Autre",          color: "#64748b", bg: "rgba(100,116,139,.1)", border: "rgba(100,116,139,.3)", icon: Wallet },
};

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const fmt = (n) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (iso) => {
  if (!iso) return "—";
  if (/^\d{2}\/\d{2}$/.test(iso)) return iso;
  if (typeof iso === "string" && iso.includes("/") && iso.length <= 10) return iso;
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
};


const parseJSON = (raw, fallback = []) => {
  try { return typeof raw === "string" ? JSON.parse(raw) : (Array.isArray(raw) ? raw : fallback); }
  catch { return fallback; }
};

const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const getLeadParticipant = (participants) => {
  const list = parseJSON(participants);
  return list.find(p => p?.fullName || p?.phone || p?.email) || null;
};

// ─── Atoms ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  const Icon = s.icon;
  return <span className={`res-status ${s.className}`}><Icon size={12} />{s.label}</span>;
}

function Spinner({ size = 14 }) {
  return <span className="res-spinner" style={{ width: size, height: size }} />;
}

function Button({ children, onClick, variant = "primary", small = false, disabled = false, full = false, type = "button" }) {
  const cls = ["res-btn", variant, small && "small", full && "full"].filter(Boolean).join(" ");
  return <button type={type} className={cls} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Pill({ children, active, onClick, color, bg, border, count }) {
  const style = active && color ? { "--pill-color": color, "--pill-bg": bg, "--pill-border": border, "--pill-shadow": bg } : {};
  return (
    <button className={`res-pill ${active ? "active" : ""}`} onClick={onClick} style={style}>
      {children}
      {count !== undefined && <span className="res-pill-count">{count}</span>}
    </button>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, icon: Icon, children, width = 440 }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose?.();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="res-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="res-modal" style={{ maxWidth: width }}>
        {title && (
          <div className="res-modal-header">
            <span className="res-modal-title">{Icon && <Icon size={18} />}{title}</span>
            <button className="res-modal-close" onClick={onClose}><X size={18} /></button>
          </div>
        )}
        <div className="res-modal-body">{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ open, title, message, onConfirm, onCancel, variant = "danger", confirmLabel = "Confirmer", loading = false, icon: Icon = AlertCircle }) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={!loading ? onCancel : undefined} title={title} icon={Icon} width={440}>
      <p className="res-modal-message">{message}</p>
      <div className="res-modal-actions">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>Annuler</Button>
        <Button variant={variant} onClick={onConfirm} disabled={loading}>
          {loading ? <><Spinner size={13} /> En cours…</> : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Drawer ──────────────────────────────────────────────────────────────────
function Drawer({ open, onClose, title, icon: Icon, width = 780, children }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  return (
    <>
      <div className="res-drawer-backdrop" onClick={onClose} style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }} />
      <div className="res-drawer" style={{ width, transform: open ? "translateX(0)" : "translateX(100%)", pointerEvents: open ? "auto" : "none" }}>
        <div className="res-drawer-header">
          <span className="res-drawer-title">{Icon && <Icon size={20} />}{title}</span>
          <button className="res-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="res-drawer-body">{children}</div>
      </div>
    </>
  );
}

// ─── Tab Header (with edit/save/cancel actions) ─────────────────────────────
function TabHeader({ icon: Icon, title, editing, onEdit, onSave, onCancel, saveLabel = "Sauvegarder", saving = false, extraActions }) {
  return (
    <div className="res-tab-header">
      <div className="res-tab-header-title">
        {Icon && <Icon size={16} style={{ color: "#ff750e" }} />}
        {title}
      </div>
      <div className="res-tab-header-actions">
        {extraActions}
        {editing ? (
          <>
            <Button variant="ghost" small onClick={onCancel} disabled={saving}>Annuler</Button>
            <Button small onClick={onSave} disabled={saving}>
              {saving ? <><Spinner size={12} /> Sauvegarde…</> : <><Save size={12} /> {saveLabel}</>}
            </Button>
          </>
        ) : (
          <Button variant="ghost" small onClick={onEdit}>
            <Pencil size={12} /> Modifier
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Hotels Block (view) ─────────────────────────────────────────────────────
function HotelsBlock({ hotels }) {
  const list = parseJSON(hotels);
  if (!list.length) return <div style={{ color: "#94a3b8", fontSize: 13 }}>Aucun hôtel</div>;
  return (
    <div>
      {list.map((h, i) => (
        <div key={i} className="res-hotel-block" style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="res-hotel-block-header">
            <div className="res-hotel-block-name"><Hotel size={15} /> {h.name}</div>
            <span className="res-hotel-block-subtotal">{fmt(h.subtotal)} · {h.pax} pax</span>
          </div>
          <div className="res-hotel-rooms">
            {(h.rooms || []).map((r, j) => (
              <span key={j} className="res-room-tag">
                {r.qty}× {r.type}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Participants Block (view) ───────────────────────────────────────────────
function ParticipantsBlock({ participants }) {
  const list = parseJSON(participants);
  if (!list.length) return <div style={{ color: "#94a3b8", fontSize: 13 }}>Aucun participant</div>;
  return (
    <div>
      {list.map((p, i) => (
        <div key={i} className="res-participant-card" style={{ animationDelay: `${i * 0.04}s` }}>
          <div className="res-participant-num">{i + 1}</div>
          <div className="res-participant-info">
            {p?.fullName ? (
              <>
                <div className="res-participant-name">{p.fullName}</div>
                <div className="res-participant-meta">
                  {p.phone && <span><Phone size={10} /> {p.phone}</span>}
                  {p.email && <span><Mail size={10} /> {p.email}</span>}
                </div>
              </>
            ) : (
              <div className="res-participant-empty">Informations non renseignées</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Supplements Block (view) ────────────────────────────────────────────────
function SupplementsBlock({ supplements }) {
  const list = parseJSON(supplements);
  if (!list.length) return <div style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>Aucun supplément</div>;
  return (
    <div>
      {list.map((s, i) => (
        <div key={i} className="res-supplement-item" style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="res-supplement-icon"><Gift size={15} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 12 }}>{s.label || s.name || JSON.stringify(s)}</div>
            {s.price && <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{fmt(s.price)}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Payment Form (inline) ───────────────────────────────────────────────────
function PaymentForm({ initial, onCancel, onSubmit, saving, totalEstimate, totalPaid }) {
  const [form, setForm] = useState({
    id:        initial?.$id || initial?.id || "",
    date:      initial?.date || new Date().toISOString().slice(0, 10),
    amount:    initial?.amount ?? "",
    method:    initial?.method || "cash",
    reference: initial?.reference || "",
    note:      initial?.note || "",
  });

  const remaining = Number(totalEstimate || 0) - Number(totalPaid || 0);
  const isEdit = !!(initial?.$id || initial?.id);

  const set = (key) => (e) => {
    const v = e.target.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value;
    setForm(f => ({ ...f, [key]: v }));
  };

  const handleSubmit = () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    onSubmit({
      ...form,
      $id: form.id || genId(),
      amount: Number(form.amount),
    });
  };

  return (
    <div className="res-pay-form">
      <div className="res-pay-form-title">
        {isEdit ? <Pencil size={14} /> : <Plus size={14} />}
        {isEdit ? "Modifier le paiement" : "Nouveau paiement"}
      </div>

      <div className="res-label">Méthode de paiement</div>
      <div className="res-pay-method-pills">
        {Object.entries(PAYMENT_METHODS).map(([v, m]) => {
          const Icon = m.icon;
          const sel = form.method === v;
          return (
            <button
              key={v}
              type="button"
              className={`res-pay-method-pill ${sel ? "selected" : ""}`}
              style={{ "--m-color": m.color, "--m-bg": m.bg, "--m-border": m.border }}
              onClick={() => setForm(f => ({ ...f, method: v }))}
            >
              <Icon size={12} />{m.label}
            </button>
          );
        })}
      </div>

      <div className="res-field-row">
        <div className="res-field">
          <label className="res-label">Montant (MAD) *</label>
          <input className="res-input" type="number" step="100" min="0" value={form.amount} onChange={set("amount")}
            placeholder={remaining > 0 ? `Reste: ${fmt(remaining)}` : "Montant"} autoFocus />
        </div>
        <div className="res-field">
          <label className="res-label">Date</label>
          <input className="res-input" type="date" value={form.date} onChange={set("date")} />
        </div>
      </div>

      <div className="res-field">
        <label className="res-label">Référence / N° transaction</label>
        <input className="res-input" value={form.reference} onChange={set("reference")} placeholder="Ex: VIR-2026-00123" />
      </div>

      <div className="res-field" style={{ marginBottom: 0 }}>
        <label className="res-label">Note (optionnel)</label>
        <textarea className="res-textarea" value={form.note} onChange={set("note")} placeholder="Détails, commentaire…" rows="2" />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <Button variant="ghost" small onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button small onClick={handleSubmit} disabled={saving || !form.amount || Number(form.amount) <= 0}>
          {saving ? <><Spinner size={12} /> Enregistrement…</> : <><Save size={12} /> {isEdit ? "Mettre à jour" : "Ajouter"}</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Payments Tab ────────────────────────────────────────────────────────────
function PaymentsTab({ res, onSave, notify }) {
  const [payments, setPayments] = useState(() => parseJSON(res.payments));
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState(null);

  const totalEstimate = Number(res.totalEstimate || 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const remaining = Math.max(0, totalEstimate - totalPaid);
  const paidPct = totalEstimate > 0 ? Math.min(100, (totalPaid / totalEstimate) * 100) : 0;

  useEffect(() => { setPayments(parseJSON(res.payments)); }, [res.payments, res.$id]);

  const persist = async (next) => {
    setSaving(true);
    try {
      await onSave({ ...res, payments: JSON.stringify(next) });
      setPayments(next);
      setShowForm(false);
      setEditingId(null);
    } catch {
      notify("Erreur lors de l'enregistrement", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (data) => {
    const exists = payments.some(p => (p.$id || p.id) === data.$id);
    const next = exists
      ? payments.map(p => (p.$id || p.id) === data.$id ? data : p)
      : [...payments, data];
    persist(next);
  };

  const handleDelete = async () => {
    const id = delTarget.$id || delTarget.id;
    const next = payments.filter(p => (p.$id || p.id) !== id);
    setDelTarget(null);
    await persist(next);
    notify("Paiement supprimé");
  };

  const startEdit = (p) => { setEditingId(p.$id || p.id); setShowForm(true); };
  const startAdd = () => { setEditingId(null); setShowForm(true); };
  const cancelForm = () => { setShowForm(false); setEditingId(null); };

  const editingPayment = showForm && editingId ? payments.find(p => (p.$id || p.id) === editingId) : null;

  return (
    <div style={{ animation: "resFadeIn .3s ease" }}>

      {/* Dashboard */}
      <div className="res-pay-dashboard">
        <div className="res-pay-stat total">
          <div className="res-pay-stat-label"><DollarSign size={12} /> Total réservation</div>
          <div className="res-pay-stat-value">{fmt(totalEstimate)}</div>
          <div className="res-pay-stat-sub">{res.totalPax || 0} voyageur{(res.totalPax || 0) > 1 ? "s" : ""}</div>
        </div>
        <div className="res-pay-stat paid">
          <div className="res-pay-stat-label"><CheckCircle size={12} /> Total payé</div>
          <div className="res-pay-stat-value">{fmt(totalPaid)}</div>
          <div className="res-pay-stat-sub">{payments.length} paiement{payments.length > 1 ? "s" : ""}</div>
          <div className="res-pay-progress">
            <div className="res-pay-progress-bar" style={{ width: `${paidPct}%` }} />
          </div>
        </div>
        <div className={`res-pay-stat remaining ${remaining === 0 && totalPaid > 0 ? "paid-off" : ""}`}>
          <div className="res-pay-stat-label"><AlertCircle size={12} /> Reste à payer</div>
          <div className="res-pay-stat-value">{fmt(remaining)}</div>
          <div className="res-pay-stat-sub">
            {remaining === 0 && totalPaid > 0 ? "✓ Soldé" : `${paidPct.toFixed(0)}% payé`}
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <PaymentForm
          initial={editingPayment}
          onCancel={cancelForm}
          onSubmit={handleSubmit}
          saving={saving}
          totalEstimate={totalEstimate}
          totalPaid={totalPaid}
        />
      )}

      {/* List header */}
      <div className="res-pay-list-header">
        <div className="res-pay-list-title">
          <History size={15} /> Historique des paiements ({payments.length})
        </div>
        {!showForm && (
          <Button small onClick={startAdd}>
            <Plus size={12} /> Nouveau paiement
          </Button>
        )}
      </div>

      {/* List */}
      {payments.length === 0 ? (
        <div className="res-pay-empty">
          <div className="res-pay-empty-icon"><Wallet size={24} /></div>
          <p className="res-pay-empty-title">Aucun paiement enregistré</p>
          <p className="res-pay-empty-sub">Commencez par enregistrer le premier paiement du client</p>
          {!showForm && <Button small onClick={startAdd}><Plus size={12} /> Ajouter un paiement</Button>}
        </div>
      ) : (
        <div>
          {[...payments]
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
            .map((p, i) => {
              const m = PAYMENT_METHODS[p.method] || PAYMENT_METHODS.other;
              const Icon = m.icon;
              return (
                <div key={p.$id || p.id || i} className="res-pay-item" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="res-pay-icon-wrap" style={{ "--pay-color": m.color, "--pay-bg": m.bg }}>
                    <Icon size={18} />
                  </div>
                  <div className="res-pay-info">
                    <div className="res-pay-method">{m.label}</div>
                    <div className="res-pay-meta">
                      <span><Calendar size={10} /> {fmtDate(p.date)}</span>
                      {p.reference && <span><Hash size={10} /> {p.reference}</span>}
                    </div>
                    {p.note && <div className="res-pay-note">{p.note}</div>}
                  </div>
                  <div className="res-pay-amount">{fmt(p.amount)}</div>
                  <div className="res-pay-actions">
                    <button className="res-icon-btn" title="Modifier" onClick={() => startEdit(p)}>
                      <Edit3 size={14} />
                    </button>
                    <button className="res-icon-btn danger" title="Supprimer" onClick={() => setDelTarget(p)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      <ConfirmModal
        open={!!delTarget}
        title="Supprimer le paiement"
        message={`Supprimer définitivement ce paiement de ${fmt(delTarget?.amount)} ? Le montant restant sera recalculé.`}
        confirmLabel="Supprimer"
        variant="danger"
        icon={Trash2}
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
        loading={saving}
      />
    </div>
  );
}

// ─── Detail Drawer (with inline edit per tab) ───────────────────────────────
function DetailDrawer({ open, res, onClose, onSave, onStatusChange, notify }) {
  const [tab, setTab] = useState("details");
  const [changingStatus, setCS] = useState(false);
  const [pendingStatus, setPS] = useState(null);
  const [statusLoading, setSL] = useState(false);

  // Per-tab editing states
  const [editDetails, setEditDetails] = useState(false);
  const [editHotels, setEditHotels] = useState(false);
  const [editParticipants, setEditParticipants] = useState(false);
  const [editSupplements, setEditSupplements] = useState(false);

  // Drafts
  const [draftDetails, setDraftDetails] = useState({});
  const [draftHotels, setDraftHotels] = useState([]);
  const [draftParticipants, setDraftParticipants] = useState([]);
  const [draftSupplements, setDraftSupplements] = useState([]);

  const [savingTab, setSavingTab] = useState(null);

  useEffect(() => {
    if (!open) {
      setTab("details");
      setCS(false);
      setPS(null);
      setEditDetails(false);
      setEditHotels(false);
      setEditParticipants(false);
      setEditSupplements(false);
    }
  }, [open]);

  // Sync drafts when res changes
  useEffect(() => {
    if (!res) return;
    setDraftDetails({
      packageTitle:  res.packageTitle || "",
      dateFrom:      res.dateFrom || "",
      dateTo:        res.dateTo || "",
      userName:      res.userName || "",
      userEmail:     res.userEmail || "",
      totalPax:      res.totalPax || 0,
      totalEstimate: res.totalEstimate || 0,
      ref:           res.ref || "",
    });
    setDraftHotels(parseJSON(res.hotels));
    setDraftParticipants(parseJSON(res.participants));
    setDraftSupplements(parseJSON(res.supplements));
  }, [res?.$id, editDetails, editHotels, editParticipants, editSupplements]);

  if (!res) return null;

  const hotels = parseJSON(res.hotels);
  const participants = parseJSON(res.participants);
  const supplements = parseJSON(res.supplements);
  const payments = parseJSON(res.payments);
  const lead = getLeadParticipant(res.participants);

  const TABS = [
    { id: "details",      label: "Réservation",                       icon: FileText },
    { id: "hotels",       label: `Hôtels (${hotels.length})`,         icon: Hotel },
    { id: "participants", label: `Participants (${participants.length})`, icon: Users },
    { id: "supplements",  label: `Suppléments (${supplements.length})`, icon: Gift },
    { id: "payments",     label: `Paiements (${payments.length})`,    icon: Receipt },
  ];

  const handleStatusConfirm = async () => {
    setSL(true);
    await onStatusChange(res.$id, pendingStatus);
    setSL(false);
    setPS(null);
    setCS(false);
  };

  // Generic save helper
  const saveTab = async (tabKey, patch) => {
    setSavingTab(tabKey);
    try {
      const data = { ...res, ...patch };
      await onSave(data);
      notify("Modifications enregistrées ✓");
      return true;
    } catch {
      notify("Erreur lors de la sauvegarde", "error");
      return false;
    } finally {
      setSavingTab(null);
    }
  };

  const saveDetails = async () => {
    const ok = await saveTab("details", draftDetails);
    if (ok) setEditDetails(false);
  };
  const saveHotels = async () => {
    const ok = await saveTab("hotels", { hotels: JSON.stringify(draftHotels) });
    if (ok) setEditHotels(false);
  };
  const saveParticipants = async () => {
    const ok = await saveTab("participants", { participants: JSON.stringify(draftParticipants) });
    if (ok) setEditParticipants(false);
  };
  const saveSupplements = async () => {
    const ok = await saveTab("supplements", { supplements: JSON.stringify(draftSupplements) });
    if (ok) setEditSupplements(false);
  };

  // Hotels edit helpers
  const updateHotel = (i, field, val) => setDraftHotels(hs => hs.map((h, idx) => idx === i ? { ...h, [field]: val } : h));
  const addRoom = (hi) => setDraftHotels(hs => hs.map((h, idx) => idx === hi ? { ...h, rooms: [...(h.rooms || []), { type: "Double", qty: 1 }] } : h));
  const updateRoom = (hi, ri, field, val) => setDraftHotels(hs => hs.map((h, idx) => idx === hi ? {
    ...h, rooms: h.rooms.map((r, ridx) => ridx === ri ? { ...r, [field]: field === "qty" ? Number(val) : val } : r)
  } : h));
  const removeRoom = (hi, ri) => setDraftHotels(hs => hs.map((h, idx) => idx === hi ? { ...h, rooms: h.rooms.filter((_, ridx) => ridx !== ri) } : h));
  const addHotel = () => setDraftHotels(hs => [...hs, { name: "", rooms: [{ type: "Double", qty: 1 }], subtotal: 0, pax: 0 }]);
  const removeHotel = (i) => setDraftHotels(hs => hs.filter((_, idx) => idx !== i));

  // Participants edit helpers
  const updateParticipant = (i, field, val) => setDraftParticipants(ps => ps.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  const addParticipant = () => setDraftParticipants(ps => [...ps, { fullName: "", phone: "", email: "" }]);
  const removeParticipant = (i) => setDraftParticipants(ps => ps.filter((_, idx) => idx !== i));

  // Supplements edit helpers
  const updateSupplement = (i, field, val) => setDraftSupplements(ss => ss.map((s, idx) => idx === i ? { ...s, [field]: field === "price" ? Number(val) : val } : s));
  const addSupplement = () => setDraftSupplements(ss => [...ss, { label: "", price: 0 }]);
  const removeSupplement = (i) => setDraftSupplements(ss => ss.filter((_, idx) => idx !== i));

  const ROOM_TYPES = ["Single", "Double", "Triple", "Quadruple", "Suite"];

  return (
    <Drawer open={open} onClose={onClose} title={res.packageTitle || "Réservation"} icon={Eye} width={780}>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <User size={14} /> {res.userName}
        {lead?.phone && <><span style={{ color: "#cbd5e1" }}>·</span><Phone size={12} /> {lead.phone}</>}
        {(res.userEmail || lead?.email) && <><span style={{ color: "#cbd5e1" }}>·</span><Mail size={12} /> {res.userEmail || lead.email}</>}
        <span style={{ color: "#cbd5e1" }}>·</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#94a3b8" }}>{res.ref}</span>
      </div>

      <ConfirmModal
        open={!!pendingStatus}
        title="Changer le statut"
        message={`Changer le statut de "${STATUS_MAP[res.status]?.label}" → "${STATUS_MAP[pendingStatus]?.label}" pour ${res.userName} ?`}
        confirmLabel="Confirmer"
        variant="primary"
        icon={STATUS_MAP[pendingStatus]?.icon || CheckCircle}
        onConfirm={handleStatusConfirm}
        onCancel={() => setPS(null)}
        loading={statusLoading}
      />

      <div className="res-tabs">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} className={`res-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <Icon size={14} />{t.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB: Détails ── */}
      {tab === "details" && (
        <div style={{ animation: "resFadeIn .3s ease" }}>

          <TabHeader
            icon={FileText}
            title="Informations générales"
            editing={editDetails}
            onEdit={() => setEditDetails(true)}
            onSave={saveDetails}
            onCancel={() => setEditDetails(false)}
            saving={savingTab === "details"}
            extraActions={
              <div className="res-status-changer" style={{ margin: 0, padding: "8px 12px", background: "transparent", border: "none" }}>
                <StatusBadge status={res.status} />
                <button className="res-status-change-btn" onClick={() => setCS(v => !v)}>
                  {changingStatus ? "Annuler" : "Changer"}
                </button>
              </div>
            }
          />

          {changingStatus && (
            <div className="res-status-pills">
              {Object.entries(STATUS_MAP).map(([v, s]) => {
                const Icon = s.icon;
                const isSel = pendingStatus === v;
                return (
                  <button key={v} className={`res-status-pill ${isSel ? "selected" : ""}`} onClick={() => setPS(v)}
                    style={{ color: s.color, borderColor: s.border, background: isSel ? s.bg : "transparent" }}>
                    <Icon size={13} />{s.label}
                  </button>
                );
              })}
            </div>
          )}

          {editDetails ? (
            <div style={{ animation: "resSlideDown .3s ease" }}>
              <div className="res-field">
                <label className="res-label">Package / Destination</label>
                <input className="res-input" value={draftDetails.packageTitle || ""}
                  onChange={e => setDraftDetails(d => ({ ...d, packageTitle: e.target.value }))}
                  placeholder="Ex: ISTANBUL" />
              </div>
              <div className="res-field">
                <label className="res-label">Référence</label>
                <input className="res-input" value={draftDetails.ref || ""}
                  onChange={e => setDraftDetails(d => ({ ...d, ref: e.target.value }))} />
              </div>
              <div className="res-field-row">
                <div className="res-field">
                  <label className="res-label">Date de départ</label>
                  <input className="res-input" value={draftDetails.dateFrom || ""}
                    onChange={e => setDraftDetails(d => ({ ...d, dateFrom: e.target.value }))} placeholder="JJ/MM" />
                </div>
                <div className="res-field">
                  <label className="res-label">Date de retour</label>
                  <input className="res-input" value={draftDetails.dateTo || ""}
                    onChange={e => setDraftDetails(d => ({ ...d, dateTo: e.target.value }))} placeholder="JJ/MM" />
                </div>
              </div>
              <div className="res-field-row">
                <div className="res-field">
                  <label className="res-label">Nom du client</label>
                  <input className="res-input" value={draftDetails.userName || ""}
                    onChange={e => setDraftDetails(d => ({ ...d, userName: e.target.value }))} />
                </div>
                <div className="res-field">
                  <label className="res-label">Email</label>
                  <input className="res-input" type="email" value={draftDetails.userEmail || ""}
                    onChange={e => setDraftDetails(d => ({ ...d, userEmail: e.target.value }))} />
                </div>
              </div>
              <div className="res-field-row">
                <div className="res-field">
                  <label className="res-label">Total pax</label>
                  <input className="res-input" type="number" min="0" value={draftDetails.totalPax ?? 0}
                    onChange={e => setDraftDetails(d => ({ ...d, totalPax: Number(e.target.value) }))} />
                </div>
                <div className="res-field">
                  <label className="res-label">Total estimé (MAD)</label>
                  <input className="res-input" type="number" step="500" min="0" value={draftDetails.totalEstimate ?? 0}
                    onChange={e => setDraftDetails(d => ({ ...d, totalEstimate: Number(e.target.value) }))} />
                </div>
              </div>
            </div>
          ) : (
            <div>
              {[
                { icon: Package,    label: "Package",      value: res.packageTitle },
                { icon: Hash,       label: "Référence",    value: res.ref },
                { icon: User,       label: "Client",       value: res.userName },
                { icon: Mail,       label: "Email",        value: res.userEmail || lead?.email || "—" },
                { icon: Phone,      label: "Téléphone",    value: lead?.phone || "—" },
                { icon: Calendar,   label: "Départ",       value: fmtDate(res.dateFrom) },
                { icon: Calendar,   label: "Retour",       value: fmtDate(res.dateTo) },
                { icon: Users,      label: "Total pax",    value: `${res.totalPax} voyageur${res.totalPax > 1 ? "s" : ""}` },
                { icon: DollarSign, label: "Total estimé", value: fmt(res.totalEstimate) },
                { icon: Calendar,   label: "Créée le",     value: fmtDate(res.$createdAt) },
                { icon: Hash,       label: "Réf. interne", value: `#${(res.$id || "").slice(-8).toUpperCase()}` },
              ].map((row, i) => {
                const Icon = row.icon;
                return (
                  <div key={i} className="res-detail-row" style={{ animationDelay: `${i * 0.03}s` }}>
                    <span className="res-detail-label"><Icon size={13} /> {row.label}</span>
                    <span className="res-detail-value">{row.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Hôtels ── */}
      {tab === "hotels" && (
        <div style={{ animation: "resFadeIn .3s ease" }}>
          <TabHeader
            icon={Hotel}
            title={`Hôtels (${(editHotels ? draftHotels : hotels).length})`}
            editing={editHotels}
            onEdit={() => setEditHotels(true)}
            onSave={saveHotels}
            onCancel={() => setEditHotels(false)}
            saving={savingTab === "hotels"}
          />

          {editHotels ? (
            <div style={{ animation: "resSlideDown .3s ease" }}>
              {draftHotels.map((h, hi) => (
                <div key={hi} style={{ border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", marginBottom: 12, background: "#fafafa", position: "relative" }}>
                  <div style={{ position: "absolute", top: 10, left: 14, fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>HÔTEL {hi + 1}</div>
                  <button
                    onClick={() => removeHotel(hi)}
                    style={{ position: "absolute", top: 10, right: 10, background: "#fef2f2", border: "1px solid rgba(220,38,38,.2)", borderRadius: 6, color: "#dc2626", cursor: "pointer", padding: "4px 8px", fontSize: 10, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <X size={11} /> Retirer
                  </button>

                  <div style={{ marginTop: 18 }}>
                    <div className="res-field-row">
                      <div className="res-field">
                        <label className="res-label">Nom de l'hôtel</label>
                        <input className="res-input" value={h.name || ""} onChange={e => updateHotel(hi, "name", e.target.value)} />
                      </div>
                      <div className="res-field-row" style={{ alignItems: "end", gap: 8 }}>
                        <div className="res-field">
                          <label className="res-label">Pax</label>
                          <input className="res-input" type="number" min="0" value={h.pax ?? 0} onChange={e => updateHotel(hi, "pax", Number(e.target.value))} />
                        </div>
                        <div className="res-field">
                          <label className="res-label">Sous-total (MAD)</label>
                          <input className="res-input" type="number" step="500" min="0" value={h.subtotal ?? 0} onChange={e => updateHotel(hi, "subtotal", Number(e.target.value))} />
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 4 }}>
                      <label className="res-label" style={{ marginBottom: 8, display: "block" }}>Chambres</label>
                      {(h.rooms || []).map((r, ri) => (
                        <div key={ri} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                          <select className="res-select" style={{ flex: 1 }} value={r.type || "Double"} onChange={e => updateRoom(hi, ri, "type", e.target.value)}>
                            {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <input className="res-input" style={{ width: 70 }} type="number" min="1" value={r.qty ?? 1} onChange={e => updateRoom(hi, ri, "qty", e.target.value)} />
                          <button onClick={() => removeRoom(hi, ri)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4, display: "flex" }}>
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <Button variant="ghost" small onClick={() => addRoom(hi)}>
                        <Plus size={12} /> Ajouter chambre
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              <Button variant="ghost" onClick={addHotel}>
                <Plus size={14} /> Ajouter un hôtel
              </Button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14, color: "#64748b", fontSize: 13 }}>
                {hotels.length} hôtel{hotels.length > 1 ? "s" : ""} · {res.totalPax} pax total
              </div>
              <HotelsBlock hotels={res.hotels} />
            </>
          )}
        </div>
      )}

      {/* ── TAB: Participants ── */}
      {tab === "participants" && (
        <div style={{ animation: "resFadeIn .3s ease" }}>
          <TabHeader
            icon={Users}
            title={`Participants (${(editParticipants ? draftParticipants : participants).length})`}
            editing={editParticipants}
            onEdit={() => setEditParticipants(true)}
            onSave={saveParticipants}
            onCancel={() => setEditParticipants(false)}
            saving={savingTab === "participants"}
          />

          {editParticipants ? (
            <div style={{ animation: "resSlideDown .3s ease" }}>
              {draftParticipants.map((p, i) => (
                <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 9, padding: "12px 14px", marginBottom: 8, background: "#fafafa", position: "relative" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: "rgba(255,117,14,.1)", color: "#ff750e", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{i + 1}</div>
                    PARTICIPANT {i + 1}
                    <button onClick={() => removeParticipant(i)} style={{ marginLeft: "auto", background: "#fef2f2", border: "1px solid rgba(220,38,38,.2)", borderRadius: 5, color: "#dc2626", cursor: "pointer", padding: "2px 7px", fontSize: 10, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <X size={10} /> Retirer
                    </button>
                  </div>
                  <div className="res-field-row">
                    <div className="res-field" style={{ margin: 0 }}>
                      <label className="res-label">Nom complet</label>
                      <input className="res-input" value={p?.fullName || ""} onChange={e => updateParticipant(i, "fullName", e.target.value)} />
                    </div>
                    <div className="res-field" style={{ margin: 0 }}>
                      <label className="res-label">Téléphone</label>
                      <input className="res-input" value={p?.phone || ""} onChange={e => updateParticipant(i, "phone", e.target.value)} />
                    </div>
                  </div>
                  <div className="res-field" style={{ marginTop: 8, marginBottom: 0 }}>
                    <label className="res-label">Email</label>
                    <input className="res-input" type="email" value={p?.email || ""} onChange={e => updateParticipant(i, "email", e.target.value)} />
                  </div>
                </div>
              ))}
              <Button variant="ghost" onClick={addParticipant}>
                <Plus size={14} /> Ajouter un participant
              </Button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14, color: "#64748b", fontSize: 13 }}>
                {participants.filter(p => p?.fullName).length} / {participants.length} renseignés
              </div>
              <ParticipantsBlock participants={res.participants} />
            </>
          )}
        </div>
      )}

      {/* ── TAB: Suppléments ── */}
      {tab === "supplements" && (
        <div style={{ animation: "resFadeIn .3s ease" }}>
          <TabHeader
            icon={Gift}
            title={`Suppléments (${(editSupplements ? draftSupplements : supplements).length})`}
            editing={editSupplements}
            onEdit={() => setEditSupplements(true)}
            onSave={saveSupplements}
            onCancel={() => setEditSupplements(false)}
            saving={savingTab === "supplements"}
          />

          {editSupplements ? (
            <div style={{ animation: "resSlideDown .3s ease" }}>
              {draftSupplements.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", background: "#fafafa", border: "1px solid #e2e8f0", borderRadius: 9, marginBottom: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,117,14,.08)", color: "#ff750e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Gift size={15} />
                  </div>
                  <input className="res-input" style={{ flex: 1 }} placeholder="Nom du supplément" value={s.label || ""} onChange={e => updateSupplement(i, "label", e.target.value)} />
                  <input className="res-input" style={{ width: 130 }} type="number" step="100" min="0" placeholder="Prix" value={s.price ?? 0} onChange={e => updateSupplement(i, "price", e.target.value)} />
                  <button onClick={() => removeSupplement(i)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4, display: "flex" }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              <Button variant="ghost" onClick={addSupplement}>
                <Plus size={14} /> Ajouter un supplément
              </Button>
            </div>
          ) : (
            <SupplementsBlock supplements={res.supplements} />
          )}
        </div>
      )}

      {/* ── TAB: Paiements ── */}
      {tab === "payments" && (
        <PaymentsTab res={res} onSave={onSave} notify={notify} />
      )}
    </Drawer>
  );
}

// ─── Table Skeleton ───────────────────────────────────────────────────────────
function TableSkeleton({ cols = 7, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri}>
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
              <div className="res-skeleton" style={{ width: ci === 0 ? "70%" : ci === cols - 1 ? "60px" : "50%" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, pageSize, onPage, onPageSize }) {
  const pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  return (
    <div className="res-pagination">
      <div className="res-page-size">
        <span>Lignes par page</span>
        <select value={pageSize} onChange={e => onPageSize(Number(e.target.value))}>
          {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="res-page-nav">
        <button className="res-page-btn" onClick={() => onPage(page - 1)} disabled={page <= 1}><ChevronLeft size={14} /></button>
        {pages.map((p, i) =>
          p === "…"
            ? <span key={`el${i}`} className="res-page-ellipsis">…</span>
            : <button key={p} className={`res-page-btn ${page === p ? "active" : ""}`} onClick={() => onPage(p)}>{p}</button>
        )}
        <button className="res-page-btn" onClick={() => onPage(page + 1)} disabled={page >= totalPages}><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ReservationsManager() {
  useInjectStyles();
  const { reservations, setReservations, fetchMyReservations, updateReservation, deleteReservation } = useReservation();

  const [search, setSearch]         = useState("");
  const [filterStatus, setStatus]   = useState("all");
  const [sortField, setSortField]   = useState("$createdAt");
  const [sortDir, setSortDir]       = useState("desc");
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(5);
  const [loading, setLoading]       = useState(true);

  const [viewTarget, setViewTarget] = useState(null);
  const [delTarget, setDelTarget]   = useState(null);
  const [delLoading, setDelLoading] = useState(false);
  const [toast, setToast]           = useState(null);

  const notify = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchMyReservations().finally(() => setLoading(false));
  }, [fetchMyReservations]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
    setPage(1);
  };

  const filtered = reservations.filter(r => {
    const q = search.toLowerCase();
    return (
      (!q ||
        (r.packageTitle || "").toLowerCase().includes(q) ||
        (r.userName || "").toLowerCase().includes(q) ||
        (r.ref || "").toLowerCase().includes(q) ||
        (r.userEmail || "").toLowerCase().includes(q))
      && (filterStatus === "all" || r.status === filterStatus)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let av, bv;
    if (sortField === "packageTitle")  { av = a.packageTitle;  bv = b.packageTitle; }
    else if (sortField === "userName") { av = a.userName;      bv = b.userName; }
    else if (sortField === "dateFrom") { av = a.dateFrom;      bv = b.dateFrom; }
    else if (sortField === "totalEstimate") { av = Number(a.totalEstimate || 0); bv = Number(b.totalEstimate || 0); }
    else if (sortField === "totalPax") { av = Number(a.totalPax || 0); bv = Number(b.totalPax || 0); }
    else { av = a[sortField]; bv = b[sortField]; }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated  = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSave = async (data) => {
    try {
      const result = await updateReservation(data.$id, data);
      setReservations(rs => rs.map(r => r.$id === result.$id ? { ...r, ...result } : r));
      setViewTarget(v => v?.$id === result.$id ? { ...v, ...result } : v);
      return result;
    } catch {
      throw new Error("Erreur de sauvegarde");
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = reservations.find(r => r.$id === id);
      if (!res) return;
      const result = await updateReservation(id, { ...res, status: newStatus });
      setReservations(rs => rs.map(r => r.$id === id ? { ...r, status: newStatus, ...result } : r));
      setViewTarget(v => v?.$id === id ? { ...v, status: newStatus } : v);
      notify(`Statut → ${STATUS_MAP[newStatus]?.label} ✓`);
    } catch {
      notify("Erreur lors du changement de statut", "error");
    }
  };

  const handleDelete = async () => {
    setDelLoading(true);
    try {
      await deleteReservation(delTarget.$id);
      setReservations(rs => rs.filter(r => r.$id !== delTarget.$id));
      notify("Réservation supprimée");
    } catch {
      notify("Erreur lors de la suppression", "error");
    } finally {
      setDelLoading(false);
      setDelTarget(null);
    }
  };

  // ── KPIs ──
  const active = reservations.filter(r => r.status !== "cancelled");

  const kpi = {
    total:     reservations.length,
    pending:   reservations.filter(r => r.status === "pending").length,
    paid:      reservations.filter(r => r.status === "paid").length,
    pax:       active.reduce((s, r) => s + Number(r.totalPax || 0), 0),
    ca:        active.reduce((s, r) => s + Number(r.totalEstimate || 0), 0),
  };

  const COLS = [
    { key: "packageTitle",   label: "Package",    sortable: true,  icon: Package },
    { key: "userName",       label: "Client",     sortable: true,  icon: User },
    { key: "dateFrom",       label: "Période",    sortable: true,  icon: Calendar },
    { key: "totalPax",       label: "Pax",        sortable: true,  icon: Users },
    { key: "totalEstimate",  label: "Estimé",     sortable: true,  icon: DollarSign },
    { key: "status",         label: "Statut",     sortable: true,  icon: Flag },
    { key: "$createdAt",     label: "Créée le",   sortable: true,  icon: Calendar },
    { key: "actions",        label: "",           sortable: false },
  ];

  const statusCounts = {
    all: reservations.length,
    ...Object.fromEntries(Object.keys(STATUS_MAP).map(k => [k, reservations.filter(r => r.status === k).length])),
  };

  return (
    <div className="res-root">
      <div className="res-container">

        {/* ── KPIs ── */}
        <div className="res-kpis">
          {[
            { label: "Total",         value: kpi.total,       icon: Package,    color: "#2563eb", bg: "rgba(37,99,235,.1)" },
            { label: "En attente",    value: kpi.pending,     icon: Clock,      color: "#d97706", bg: "rgba(217,119,6,.1)" },
            { label: "Payées",        value: kpi.paid,        icon: CreditCard, color: "#16a34a", bg: "rgba(22,163,74,.1)" },
            { label: "Voyageurs",     value: kpi.pax,         icon: Users,      color: "#7c3aed", bg: "rgba(124,58,237,.1)" },
            { label: "CA Estimé",     value: fmt(kpi.ca),     icon: TrendingUp, color: "#ff750e", bg: "rgba(255,117,14,.1)" },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="res-kpi-card" style={{ "--kpi-color": k.color, "--kpi-bg": k.bg, animationDelay: `${i * 0.05}s` }}>
                <div className="res-kpi-icon"><Icon size={22} /></div>
                <div>
                  <div className="res-kpi-label">{k.label}</div>
                  <div className="res-kpi-value">{k.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Toolbar ── */}
        <div className="res-toolbar">
          <div className="res-search-wrap">
            <div className="res-search">
              <Search size={16} className="res-search-icon" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Chercher package, client, référence…" />
              {search && <button className="res-search-clear" onClick={() => setSearch("")}><X size={14} /></button>}
            </div>
          </div>
          <div className="res-filters">
            <Pill active={filterStatus === "all"} onClick={() => { setStatus("all"); setPage(1); }} count={statusCounts.all}>Tous</Pill>
            {Object.entries(STATUS_MAP).map(([v, s]) => (
              <Pill key={v} active={filterStatus === v} onClick={() => { setStatus(v); setPage(1); }}
                color={s.color} bg={s.bg} border={s.border} count={statusCounts[v]}>
                {s.label}
              </Pill>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="res-table-wrap">
          <div className="res-table-header">
            <div className="res-table-info">
              {loading
                ? <><Spinner size={13} /><span>Chargement…</span></>
                : <><strong>{filtered.length}</strong> réservation{filtered.length !== 1 ? "s" : ""}<span style={{ color: "#94a3b8" }}>· page {page}/{totalPages}</span></>}
            </div>
            {sortField !== "$createdAt" && (
              <button className="res-clear-sort" onClick={() => { setSortField("$createdAt"); setSortDir("desc"); setPage(1); }}>
                <X size={11} /> Tri : {COLS.find(c => c.key === sortField)?.label}
              </button>
            )}
          </div>

          <div className="res-table-scroll">
            <table className="res-table">
              <thead>
                <tr>
                  {COLS.map(col => {
                    const Icon = col.icon;
                    const isSorted = sortField === col.key;
                    const SortIcon = sortDir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <th key={col.key}
                        className={`${col.sortable ? "sortable" : ""} ${isSorted ? "sorted" : ""}`}
                        onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                        style={{ width: col.key === "actions" ? 100 : undefined }}>
                        <div className="res-th-content">
                          {Icon && <Icon size={12} />}{col.label}
                          {col.sortable && (
                            <span className="res-sort-icon">
                              {isSorted ? <SortIcon size={11} /> : <ArrowUpDown size={11} />}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton cols={COLS.length} rows={Math.min(pageSize, 10)} />
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length}>
                      <div className="res-empty">
                        <div className="res-empty-icon"><Package size={32} /></div>
                        <p className="res-empty-title">Aucune réservation trouvée</p>
                        {(search || filterStatus !== "all") && (
                          <button className="res-empty-btn" onClick={() => { setSearch(""); setStatus("all"); }}>Effacer les filtres</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : paginated.map((res, idx) => {
                  const hotels = parseJSON(res.hotels);
                  const lead   = getLeadParticipant(res.participants);
                  return (
                    <tr key={res.$id} className="res-row" style={{ animationDelay: `${idx * 0.03}s` }}>

                      <td>
                        <div className="res-pkg-title">
                          <Plane size={13} style={{ color: "#ff750e", flexShrink: 0 }} />
                          {res.packageTitle || "—"}
                        </div>
                        <div className="res-pkg-ref">{res.ref}</div>
                        {hotels.length > 0 && (
                          <div className="res-hotels-mini">
                            {hotels.slice(0, 2).map((h, i) => (
                              <span key={i} className="res-hotel-chip"><Hotel size={9} /> {h.name}</span>
                            ))}
                            {hotels.length > 2 && <span className="res-hotel-chip">+{hotels.length - 2}</span>}
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="res-client-name">
                          <User size={12} style={{ color: "#94a3b8" }} />
                          {res.userName || "—"}
                        </div>
                        {lead?.phone && (
                          <div className="res-client-phone"><Phone size={10} /> {lead.phone}</div>
                        )}
                        {(res.userEmail || lead?.email) && (
                          <div className="res-client-email"><Mail size={10} /> {res.userEmail || lead.email}</div>
                        )}
                      </td>

                      <td>
                        <div className="res-date" style={{ color: "#475569", fontSize: 12, fontWeight: 500 }}>
                          {fmtDate(res.dateFrom)}
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>→ {fmtDate(res.dateTo)}</div>
                      </td>

                      <td>
                        <div className="res-pax-count">{res.totalPax || 0}</div>
                        <div className="res-pax-label">voyageur{Number(res.totalPax) > 1 ? "s" : ""}</div>
                      </td>

                      <td>
                        <div className="res-total">{fmt(res.totalEstimate)}</div>
                        <div className="res-total-sub">{res.totalPax > 0 ? fmt(Math.round(res.totalEstimate / res.totalPax)) + "/pax" : ""}</div>
                      </td>

                      <td><StatusBadge status={res.status} /></td>

                      <td style={{ color: "#94a3b8", fontSize: 11, whiteSpace: "nowrap" }}>
                        {fmtDate(res.$createdAt)}
                      </td>

                      <td>
                        <div className="res-actions">
                          <button className="res-icon-btn primary" title="Voir / Modifier" onClick={() => setViewTarget(res)}><Eye size={15} /></button>
                          <button className="res-icon-btn danger" title="Supprimer" onClick={() => setDelTarget(res)}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPage={p => setPage(Math.max(1, Math.min(p, totalPages)))}
              onPageSize={n => { setPageSize(n); setPage(1); }}
            />
          )}
        </div>
      </div>

      {/* ── Detail Drawer (with inline edit per tab) ── */}
      <DetailDrawer
        open={!!viewTarget}
        res={viewTarget}
        onClose={() => setViewTarget(null)}
        onSave={handleSave}
        onStatusChange={handleStatusChange}
        notify={notify}
      />

      <ConfirmModal
        open={!!delTarget}
        title="Supprimer la réservation"
        message={`Supprimer définitivement la réservation ${delTarget?.ref} de ${delTarget?.userName} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        icon={Trash2}
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
        loading={delLoading}
      />

      {toast && (
        <div className={`res-toast ${toast.type}`}>
          {toast.type === "error" ? <XCircle size={16} /> : <CheckCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}