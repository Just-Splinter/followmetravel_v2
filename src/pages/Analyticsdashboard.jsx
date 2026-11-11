import {
  useState, useEffect, useCallback, useMemo,
} from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import db, { Collections, Query } from "../services/database";
import {
  LayoutDashboard, Briefcase, TrendingUp, MousePointer, Package,
  ClipboardList, Users, Activity, Eye, Search, Heart, CreditCard,
  Calendar, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Clock, Hourglass, FileText, Route, RefreshCw, Database,
  AlertCircle, ChevronLeft, ChevronRight, Play, Pause,
  Smartphone, Tablet, Monitor, Loader2, BarChart3, Zap,
  Target, Flame, Sparkles
} from "lucide-react";
import "../styles/Analyticsdashboard.css";
import BusinessOverview from "./analytics/BusinessOverview";
import { ADM, GRID } from "../styles/adminTokens";

// ─── Design Tokens ──────────────────────────────────────────────────────────
// Couleurs du design system admin (styles/adminTokens.js). Les noms
// historiques sont gardés : « purple » est l'accent principal (orange marque).
const T = {
  purple: ADM.brand,
  purpleDim: ADM.brandSoft,
  purpleDark: ADM.brandHover,
  teal: ADM.success,
  tealDim: ADM.successBg,
  tealDark: "#15803d",
  coral: ADM.violet,
  coralDim: ADM.violetBg,
  amber: ADM.warning,
  amberDim: ADM.warningBg,
  blue: ADM.info,
  blueDim: ADM.infoBg,
  blueDark: "#1d4ed8",
  gray: ADM.muted,
  grid: GRID,
};

const PAGE_SIZE = 25;

const RANGES = [
  { key: "today", label: "Aujourd'hui", days: 0 },
  { key: "7d", label: "7 jours", days: 7 },
  { key: "30d", label: "30 jours", days: 30 },
  { key: "90d", label: "90 jours", days: 90 },
];

const NAV = [
  { key: "business", label: "Vue business", icon: Briefcase },
  { key: "overview", label: "Activité du site", icon: LayoutDashboard },
  { key: "traffic", label: "Trafic", icon: BarChart3 },
  { key: "conversion", label: "Conversion", icon: TrendingUp },
  { key: "content", label: "Contenu", icon: Package },
  { key: "events", label: "Événements", icon: ClipboardList },
  { key: "sessions", label: "Sessions", icon: Users },
];

const BADGE = {
  page_view: { bg: T.purpleDim, text: T.purpleDark },
  click: { bg: T.coralDim, text: "#b91c1c" },
  search: { bg: T.amberDim, text: "#92400e" },
  favorite: { bg: "#fef2f2", text: "#b91c1c" },
  view: { bg: T.blueDim, text: T.blueDark },
  payment: { bg: T.tealDim, text: T.tealDark },
  abandon: { bg: "#fef2f2", text: "#b91c1c" },
  reserve: { bg: "#f0fdf4", text: "#15803d" },
};

const EVENT_ICON = {
  page_view: Eye,
  click: MousePointer,
  search: Search,
  favorite: Heart,
  view: Package,
  payment: CreditCard,
  abandon: X,
  reserve: Calendar,
};

// ─── Global CSS ─────────────────────────────────────────────────────────────
const ANALYTICS_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

* { box-sizing: border-box; }

@keyframes anFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes anSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes anSlideInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes anScaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes anShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes anSpin {
  to { transform: rotate(360deg); }
}

@keyframes anPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes anRowFadeIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes anGrowBar {
  from { width: 0; }
}

/* ─── Layout ─── */
.an-root {
  display: flex;
  min-height: 100vh;
  font-family: 'Inter', system-ui, sans-serif;
  background: #f8fafc;
  color: #1e293b;
}

/* ─── Sidebar ─── */
.an-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #e2e8f0;
  padding: 24px 16px;
  display: contents;
  flex-direction: column;
  gap: 4px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  animation: anSlideInLeft 0.4s ease;
}

.an-sidebar::-webkit-scrollbar { width: 4px; }
.an-sidebar::-webkit-scrollbar-track { background: transparent; }
.an-sidebar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

.an-sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  margin-bottom: 20px;
}

.an-sidebar-brand-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ff750e, #ea6a08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 12px rgba(127, 119, 221, 0.3);
}

.an-sidebar-brand-text {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
}

.an-sidebar-brand-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 1px;
}

.an-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  background: transparent;
  color: #64748b;
  font-weight: 500;
  font-family: inherit;
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.an-nav-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.an-nav-item.active {
  background: linear-gradient(135deg, rgba(127, 119, 221, 0.1), rgba(127, 119, 221, 0.05));
  color: #ea6a08;
  font-weight: 600;
  box-shadow: inset 3px 0 0 #ff750e;
}

.an-nav-item .an-nav-icon {
  flex-shrink: 0;
  transition: transform 0.2s;
}

.an-nav-item:hover .an-nav-icon {
  transform: scale(1.1);
}

.an-sidebar-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.an-range-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 4px;
  margin-bottom: 10px;
}

.an-range-pill {
  padding: 5px 10px;
  font-size: 11px;
  border-radius: 7px;
  cursor: pointer;
  border: 1.5px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  font-weight: 500;
  font-family: inherit;
  transition: all 0.2s;
}

.an-range-pill:hover {
  border-color: #ff750e;
  color: #ff750e;
}

.an-range-pill.active {
  border-color: #ff750e;
  background: #fff4eb;
  color: #ea6a08;
  font-weight: 600;
}

.an-refresh-btn {
  width: 100px;
  padding: 8px 0;
  font-size: 12px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: inherit;
  font-weight: 500;
  transition: all 0.2s;
}

.an-refresh-btn:hover {
  border-color: #ff750e;
  color: #ff750e;
  background: #fff4eb;
}

.an-refresh-btn.loading svg {
  animation: anSpin 1s linear infinite;
}

/* ─── Main ─── */
.an-main {
  flex: 1;
  padding: 28px 32px;
  min-width: 0;
  overflow-x: hidden;
  animation: anFadeIn 0.5s ease;
}

.an-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
  animation: anSlideUp 0.4s ease;
}

.an-header-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 10px;
}

.an-header-title .an-header-icon {
  color: #ff750e;
}

.an-header-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
}

.an-header-loading {
  font-size: 13px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 8px;
}

.an-header-loading svg {
  animation: anSpin 1s linear infinite;
  color: #ff750e;
}

/* ─── Error ─── */
.an-error {
  padding: 14px 18px;
  border-radius: 10px;
  font-size: 13px;
  background: #fef2f2;
  color: #dc2626;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #fecaca;
  animation: anSlideUp 0.3s ease;
}

/* ─── KPI Cards ─── */
.an-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.an-kpi-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
  overflow: hidden;
  animation: anSlideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.an-kpi-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--kpi-color);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s ease;
}

.an-kpi-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
  border-color: var(--kpi-color);
}

.an-kpi-card:hover::before {
  transform: scaleX(1);
}

.an-kpi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.an-kpi-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--kpi-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--kpi-color);
  flex-shrink: 0;
  transition: transform 0.3s;
}

.an-kpi-card:hover .an-kpi-icon {
  transform: scale(1.1) rotate(-5deg);
}

.an-kpi-delta {
  font-size: 11px;
  font-weight: 600;
  border-radius: 20px;
  padding: 3px 9px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.an-kpi-delta.positive {
  background: #f0fdf4;
  color: #15803d;
}

.an-kpi-delta.negative {
  background: #fef2f2;
  color: #b91c1c;
}

.an-kpi-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.1;
  font-family: 'Inter', sans-serif;
}

.an-kpi-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
  font-weight: 500;
}

/* ─── Card ─── */
.an-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 20px 22px;
  animation: anSlideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  transition: all 0.3s;
}

.an-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

.an-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.an-section-head {
  margin-bottom: 16px;
}

.an-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
}

.an-section-sub {
  font-size: 12px;
  color: #64748b;
  margin-top: 3px;
}

/* ─── Rank List ─── */
.an-rank-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.an-rank-item {
  animation: anSlideUp 0.4s ease backwards;
}

.an-rank-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  align-items: center;
}

.an-rank-label {
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 75%;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.an-rank-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.an-rank-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--rank-color);
  flex-shrink: 0;
}

.an-rank-bar {
  height: 5px;
  background: #f1f5f9;
  border-radius: 3px;
  overflow: hidden;
}

.an-rank-bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--rank-color);
  animation: anGrowBar 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  transition: width 0.5s ease;
}

.an-rank-empty {
  font-size: 12px;
  color: #94a3b8;
  padding: 12px 0;
}

/* ─── Funnel ─── */
.an-funnel {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.an-funnel-step {
  animation: anSlideUp 0.4s ease backwards;
}

.an-funnel-drop {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 0 5px 14px;
  font-size: 11px;
  color: #7c3aed;
  font-weight: 500;
}

.an-funnel-bar {
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: var(--funnel-width);
  min-width: 60%;
  transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  animation: anGrowBar 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.an-funnel-bar:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.an-funnel-label {
  font-size: 13px;
  color: #fff;
  font-weight: 500;
}

.an-funnel-value {
  font-size: 16px;
  color: #fff;
  font-weight: 700;
  margin-left: 12px;
}

.an-funnel-percent {
  font-size: 11px;
  color: #64748b;
  text-align: right;
  margin-top: 3px;
  padding-right: 4px;
}

/* ─── Heatmap ─── */
.an-heatmap-wrap {
  overflow-x: auto;
}

.an-heatmap {
  border-collapse: separate;
  border-spacing: 3px;
  font-size: 11px;
  width: 100%;
}

.an-heatmap th {
  padding: 4px 8px;
  font-weight: 600;
  color: #64748b;
  text-align: center;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.an-heatmap th:first-child {
  text-align: left;
}

.an-heatmap td {
  padding: 6px 10px;
  border-radius: 6px;
  text-align: center;
  font-weight: 500;
  cursor: default;
  transition: transform 0.2s;
}

.an-heatmap td:hover {
  transform: scale(1.05);
}

.an-heatmap td:first-child {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  text-align: left;
}

.an-heatmap-empty {
  font-size: 12px;
  color: #94a3b8;
  padding: 12px 0;
}

/* ─── Filters bar ─── */
.an-filters-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 14px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  margin-bottom: 16px;
  animation: anSlideUp 0.4s ease;
}

.an-search-wrap {
  position: relative;
  flex: 1 1 220px;
  min-width: 200px;
}

.an-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
}

.an-search-input {
  width: 100%;
  padding: 9px 12px 9px 38px;
  font-size: 13px;
  border: 1.5px solid #e2e8f0;
  border-radius: 9px;
  background: #fff;
  color: #1e293b;
  outline: none;
  font-family: inherit;
  transition: all 0.2s;
}

.an-search-input:focus {
  border-color: #ff750e;
  box-shadow: 0 0 0 3px rgba(127, 119, 221, 0.1);
}

.an-select {
  font-size: 13px;
  padding: 9px 34px 9px 12px;
  border: 1.5px solid #e2e8f0;
  border-radius: 9px;
  background: #fff;
  color: #1e293b;
  outline: none;
  cursor: pointer;
  font-family: inherit;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  transition: all 0.2s;
  min-width: 130px;
}

.an-select:focus {
  border-color: #ff750e;
  box-shadow: 0 0 0 3px rgba(127, 119, 221, 0.1);
}

.an-reset-btn {
  font-size: 12px;
  padding: 0 14px;
  border-radius: 9px;
  cursor: pointer;
  border: 1.5px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  font-weight: 500;
  transition: all 0.2s;
}

.an-reset-btn:hover {
  border-color: #dc2626;
  color: #dc2626;
  background: #fef2f2;
}

/* ─── Table ─── */
.an-table-wrap {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  animation: anSlideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.an-table-scroll {
  overflow-x: auto;
}

.an-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;
}

.an-table thead tr {
  background: #f8fafc;
}

.an-table th {
  padding: 12px 14px;
  text-align: left;
  font-weight: 600;
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e2e8f0;
  user-select: none;
  white-space: nowrap;
}

.an-table th.sortable {
  cursor: pointer;
  transition: all 0.2s;
}

.an-table th.sortable:hover {
  background: #f1f5f9;
  color: #ff750e;
}

.an-table th.sorted {
  color: #ff750e;
  background: rgba(127, 119, 221, 0.05);
}

.an-th-content {
  display: flex;
  align-items: center;
  gap: 5px;
}

.an-sort-icon {
  opacity: 0.5;
  transition: all 0.2s;
}

.an-table th.sortable:hover .an-sort-icon,
.an-table th.sorted .an-sort-icon {
  opacity: 1;
  color: #ff750e;
}

.an-table td {
  padding: 11px 14px;
  border-bottom: 1px solid #f1f5f9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.an-row {
  transition: background 0.15s;
  animation: anRowFadeIn 0.3s ease backwards;
}

.an-row:hover {
  background: rgba(127, 119, 221, 0.04);
}

.an-row-even {
  background: #f8fafc;
}

.an-cell-muted {
  color: #64748b;
}

.an-cell-primary {
  color: #1e293b;
  font-weight: 500;
}

.an-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 5px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.an-device-badge {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 5px;
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.an-session-btn {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  background: #fff4eb;
  color: #ea6a08;
  border: 1px solid rgba(127, 119, 221, 0.2);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: inherit;
  transition: all 0.2s;
}

.an-session-btn:hover {
  background: #ff750e;
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(127, 119, 221, 0.3);
}

.an-table-empty {
  padding: 48px 16px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.an-table-empty-icon {
  display: block;
  margin: 0 auto 10px;
  color: #cbd5e1;
}

/* ─── Pagination ─── */
.an-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-wrap: wrap;
  gap: 10px;
}

.an-pagination-info {
  font-size: 12px;
  color: #64748b;
}

.an-pagination-nav {
  display: flex;
  gap: 4px;
}

.an-page-btn {
  min-width: 32px;
  height: 32px;
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
  border: 1.5px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  font-family: inherit;
  transition: all 0.2s;
}

.an-page-btn:hover:not(:disabled) {
  border-color: #ff750e;
  color: #ff750e;
  background: #fff4eb;
}

.an-page-btn.active {
  background: #ff750e;
  border-color: #ff750e;
  color: #fff;
  box-shadow: 0 2px 8px rgba(127, 119, 221, 0.3);
}

.an-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ─── Session Stats Bar ─── */
.an-session-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.an-session-stat {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  padding: 14px 16px;
  animation: anSlideUp 0.4s ease backwards;
}

.an-session-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
}

.an-session-stat-label {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
  font-weight: 500;
}

/* ─── Session Detail ─── */
.an-session-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  animation: anSlideUp 0.4s ease;
}

.an-back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 9px;
  font-size: 13px;
  border: 1.5px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  transition: all 0.2s;
}

.an-back-btn:hover {
  border-color: #ff750e;
  color: #ff750e;
  background: #fff4eb;
}

.an-session-id {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  font-family: 'JetBrains Mono', monospace;
  color: #ea6a08;
}

.an-session-time {
  font-size: 12px;
  color: #64748b;
  margin-top: 3px;
}

.an-session-badges {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

.an-session-badge {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.an-session-badge.payment {
  background: #f0fdf4;
  color: #15803d;
}

.an-session-badge.reserve {
  background: #f0fdf4;
  color: #15803d;
}

/* ─── Tabs ─── */
.an-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1.5px solid #e2e8f0;
  padding-bottom: 0;
  margin-bottom: 20px;
  overflow-x: auto;
  scrollbar-width: none;
}

.an-tabs::-webkit-scrollbar { display: none; }

.an-tab {
  padding: 10px 16px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #64748b;
  font-weight: 500;
  border-bottom: 2.5px solid transparent;
  margin-bottom: -1.5px;
  font-family: inherit;
  transition: all 0.2s;
  white-space: nowrap;
}

.an-tab:hover {
  color: #1e293b;
}

.an-tab.active {
  color: #ea6a08;
  font-weight: 600;
  border-bottom-color: #ff750e;
}

/* ─── Timeline ─── */
.an-timeline {
  display: flex;
  flex-direction: column;
}

.an-timeline-item {
  display: flex;
  gap: 0;
  animation: anSlideUp 0.4s ease backwards;
}

.an-timeline-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 36px;
  flex-shrink: 0;
}

.an-timeline-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
  z-index: 1;
  border: 2px solid;
  transition: transform 0.2s;
}

.an-timeline-item:hover .an-timeline-dot {
  transform: scale(1.15);
}

.an-timeline-line {
  width: 2px;
  flex: 1;
  background: #e2e8f0;
  min-height: 24px;
}

.an-timeline-content {
  padding-left: 12px;
  padding-bottom: 6px;
  flex: 1;
  min-width: 0;
}

.an-timeline-event-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 4px;
}

.an-timeline-category {
  font-size: 11px;
  color: #64748b;
}

.an-timeline-action {
  font-size: 11px;
  color: #64748b;
}

.an-timeline-time {
  font-size: 11px;
  color: #64748b;
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
}

.an-timeline-detail {
  font-size: 13px;
  color: #1e293b;
  margin: 4px 0;
  font-weight: 500;
}

.an-timeline-page {
  color: #64748b;
  margin-left: 8px;
  font-weight: 400;
}

.an-timeline-gap {
  font-size: 11px;
  color: #94a3b8;
  padding: 3px 0 6px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-style: italic;
}

/* ─── Path ─── */
.an-path-step {
  display: flex;
  align-items: stretch;
  gap: 14px;
  animation: anSlideUp 0.4s ease backwards;
}

.an-path-spine {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 32px;
  flex-shrink: 0;
}

.an-path-num {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #fff4eb;
  color: #ea6a08;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  z-index: 1;
  transition: all 0.2s;
}

.an-path-step:hover .an-path-num {
  background: #ff750e;
  color: #fff;
  transform: scale(1.1);
}

.an-path-line {
  width: 2px;
  flex: 1;
  background: #e2e8f0;
  min-height: 24px;
}

.an-path-content {
  flex: 1;
  padding-bottom: 14px;
  min-width: 0;
}

.an-path-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  padding: 12px 16px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.an-path-card:hover {
  border-color: #ff750e;
  background: #fff;
  box-shadow: 0 4px 12px rgba(127, 119, 221, 0.08);
}

.an-path-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.an-path-page {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.an-path-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: #64748b;
}

.an-path-meta-long {
  color: #16a34a;
  font-weight: 600;
}

.an-path-actions {
  padding-left: 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 4px;
}

.an-path-action {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #64748b;
}

.an-path-action-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.an-path-action-label {
  color: #1e293b;
  font-weight: 500;
}

.an-path-action-time {
  margin-left: auto;
  flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
}

.an-path-arrow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0 3px 12px;
  font-size: 11px;
  color: #94a3b8;
}

/* ─── Replay ─── */
.an-replay {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.an-replay-row {
  display: flex;
  align-items: baseline;
  gap: 0;
  padding: 7px 18px;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.15s;
  animation: anRowFadeIn 0.3s ease backwards;
}

.an-replay-row:hover {
  background: rgba(127, 119, 221, 0.04);
}

.an-replay-row:nth-child(even) {
  background: #f8fafc;
}

.an-replay-elapsed {
  width: 60px;
  flex-shrink: 0;
  color: #94a3b8;
  font-size: 11px;
  padding-top: 1px;
}

.an-replay-time {
  width: 70px;
  flex-shrink: 0;
  color: #64748b;
  font-size: 11px;
  padding-top: 1px;
}

.an-replay-badge {
  width: 90px;
  flex-shrink: 0;
}

.an-replay-detail {
  flex: 1;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.an-replay-page {
  color: #94a3b8;
}

/* ─── Loading ─── */
.an-loading {
  padding: 48px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.an-loading svg {
  animation: anSpin 1s linear infinite;
  color: #ff750e;
}

/* ─── Skeleton ─── */
.an-skeleton {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: anShimmer 1.4s infinite;
}

/* ─── Responsive ─── */
@media (max-width: 1024px) {
  .an-sidebar {
    width: 200px;
  }
  
  .an-main {
    padding: 20px 20px;
  }
  
  .an-kpi-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
}

@media (max-width: 768px) {
  .an-root {
    flex-direction: column;
  }
  
  .an-sidebar {
    width: 100%;
    height: auto;
    position: static;
    flex-direction: row;
    padding: 12px;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid #e2e8f0;
    gap: 4px;
  }
  
  .an-sidebar-brand {
    display: none;
  }
  
  .an-sidebar-footer {
    display: none;
  }
  
  .an-nav-item {
    white-space: nowrap;
    padding: 8px 12px;
    font-size: 12px;
  }
  
  .an-main {
    padding: 16px;
  }
  
  .an-header-title {
    font-size: 18px;
  }
  
  .an-kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .an-card-grid {
    grid-template-columns: 1fr;
  }
  
  .an-filters-bar {
    flex-direction: column;
  }
  
  .an-search-wrap {
    width: 100%;
  }
  
  .an-select {
    width: 100%;
  }
  
  .an-session-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .an-session-badges {
    margin-left: 0;
    margin-top: 8px;
  }
  
  .an-pagination {
    flex-direction: column;
    align-items: stretch;
  }
  
  .an-pagination-nav {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .an-kpi-grid {
    grid-template-columns: 1fr;
  }
  
  .an-kpi-value {
    font-size: 24px;
  }
  
  .an-card {
    padding: 16px;
  }
  
  .an-table th, .an-table td {
    padding: 9px 10px;
    font-size: 11px;
  }
}

/* ─── Reduced Motion ─── */
@media (prefers-reduced-motion: reduce) {
  .an-kpi-card,
  .an-card,
  .an-row,
  .an-timeline-item,
  .an-path-step,
  .an-replay-row,
  .an-rank-item,
  .an-funnel-step {
    animation: none !important;
  }
  
  .an-kpi-card::before,
  .an-rank-bar-fill,
  .an-funnel-bar {
    animation: none !important;
  }
  
  .an-nav-item,
  .an-page-btn,
  .an-session-btn,
  .an-range-pill {
    transition: none !important;
  }
}
`;

function useInjectStyles() {
  useEffect(() => {
    if (document.getElementById("an-global-styles")) return;
    const el = document.createElement("style");
    el.id = "an-global-styles";
    el.textContent = ANALYTICS_CSS;
    document.head.appendChild(el);
  }, []);
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const nf = (v) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");

function rangeStart(days) {
  const d = new Date();
  if (days === 0) d.setHours(0, 0, 0, 0);
  else { d.setDate(d.getDate() - days); d.setHours(0, 0, 0, 0); }
  return d.toISOString();
}

function groupByTime(events, days) {
  const counts = {};
  events.forEach((e) => {
    const d = new Date(e.createdAt);
    const key = days === 0
      ? `${String(d.getHours()).padStart(2, "0")}h`
      : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));
}

function topN(arr, field, count = 6) {
  const c = {};
  arr.forEach((e) => { const k = e[field]; if (k) c[k] = (c[k] || 0) + 1; });
  return Object.entries(c).sort(([, a], [, b]) => b - a).slice(0, count)
    .map(([label, value]) => ({ label, value }));
}

function uniq(arr, field) {
  return new Set(arr.map((e) => e[field]).filter(Boolean)).size;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function durationMs(events) {
  if (events.length < 2) return 0;
  const sorted = [...events].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return new Date(sorted[sorted.length - 1].createdAt) - new Date(sorted[0].createdAt);
}

function fmtDuration(ms) {
  if (ms < 1000) return "< 1s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ─── Sub-components ─────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 9, padding: "10px 14px", fontSize: 12,
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ color: "#64748b", marginBottom: 5, fontWeight: 500 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color ?? T.purple, fontWeight: 600 }}>
          {nf(p.value)} {p.name}
        </div>
      ))}
    </div>
  );
};

function SectionHead({ title, sub, icon: Icon }) {
  return (
    <div className="an-section-head">
      <div className="an-section-title">
        {Icon && <Icon size={15} style={{ color: "#ff750e" }} />}
        {title}
      </div>
      {sub && <div className="an-section-sub">{sub}</div>}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, delta, color, dimColor, delay = 0 }) {
  const positive = delta >= 0;
  return (
    <div
      className="an-kpi-card"
      style={{
        "--kpi-color": color,
        "--kpi-bg": dimColor,
        animationDelay: `${delay * 0.05}s`,
      }}
    >
      <div className="an-kpi-header">
        <div className="an-kpi-icon">
          <Icon size={18} />
        </div>
        {delta != null && (
          <span className={`an-kpi-delta ${positive ? "positive" : "negative"}`}>
            {positive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {positive ? "+" : ""}{delta}%
          </span>
        )}
      </div>
      <div>
        <div className="an-kpi-value">{value}</div>
        <div className="an-kpi-label">{label}</div>
      </div>
    </div>
  );
}

function RankList({ items, color }) {
  if (!items.length) return <div className="an-rank-empty">Aucune donnée</div>;
  const max = items[0].value;
  return (
    <div className="an-rank-list">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="an-rank-item"
          style={{
            "--rank-color": color,
            animationDelay: `${i * 0.05}s`,
          }}
        >
          <div className="an-rank-header">
            <span className="an-rank-label">
              <span className="an-rank-num">{i + 1}</span>
              {item.label}
            </span>
            <span className="an-rank-value">{nf(item.value)}</span>
          </div>
          <div className="an-rank-bar">
            <div
              className="an-rank-bar-fill"
              style={{ width: `${Math.round((item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Funnel({ steps }) {
  const total = steps[0]?.value || 1;
  const colors = [T.purple, T.blue, T.amber, T.teal];
  return (
    <div className="an-funnel">
      {steps.map((s, i) => {
        const w = Math.max(30, Math.round((s.value / total) * 100));
        const prev = steps[i - 1]?.value;
        const drop = prev ? Math.round(((prev - s.value) / prev) * 100) : null;
        return (
          <div key={s.label} className="an-funnel-step" style={{ animationDelay: `${i * 0.1}s` }}>
            {drop != null && (
              <div className="an-funnel-drop">
                <ArrowDown size={12} />
                {drop}% abandons
              </div>
            )}
            <div
              className="an-funnel-bar"
              style={{
                background: colors[i],
                "--funnel-width": `${w}%`,
              }}
            >
              <span className="an-funnel-label">{s.label}</span>
              <span className="an-funnel-value">{nf(s.value)}</span>
            </div>
            <div className="an-funnel-percent">
              {pct(s.value, total)} du total
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Heatmap({ events }) {
  const cats = useMemo(() => [...new Set(events.map((e) => e.category).filter(Boolean))].slice(0, 7), [events]);
  const types = useMemo(() => [...new Set(events.map((e) => e.event).filter(Boolean))].slice(0, 7), [events]);
  const matrix = useMemo(() => {
    const m = {};
    cats.forEach((c) => { m[c] = {}; types.forEach((t) => { m[c][t] = 0; }); });
    events.forEach((e) => { if (e.category && e.event && m[e.category]) m[e.category][e.event]++; });
    return m;
  }, [events, cats, types]);
  const maxV = useMemo(() => Math.max(1, ...cats.flatMap((c) => types.map((t) => matrix[c][t] || 0))), [matrix, cats, types]);

  if (!cats.length) return <div className="an-heatmap-empty">Aucune donnée</div>;
  return (
    <div className="an-heatmap-wrap">
      <table className="an-heatmap">
        <thead>
          <tr>
            <th>catégorie</th>
            {types.map((t) => (
              <th key={t}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cats.map((cat) => (
            <tr key={cat}>
              <td>{cat}</td>
              {types.map((evt) => {
                const v = matrix[cat][evt] || 0;
                const alpha = v === 0 ? 0 : 0.1 + (v / maxV) * 0.85;
                const bg = v === 0 ? "#f1f5f9" : `rgba(127,119,221,${alpha.toFixed(2)})`;
                const tc = alpha > 0.5 ? "#fff" : "#1e293b";
                return (
                  <td
                    key={evt}
                    title={`${cat} / ${evt}: ${v}`}
                    style={{ background: bg, color: tc }}
                  >
                    {v > 0 ? nf(v) : "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaginBtn({ label, onClick, disabled, active, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`an-page-btn ${active ? "active" : ""}`}
    >
      {Icon ? <Icon size={14} /> : label}
    </button>
  );
}

// ─── EventLog ───────────────────────────────────────────────────────────────
function EventLog({ rangeIdx, filterEvent, filterDevice, search, onSessionClick }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState({ field: "createdAt", asc: false });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (p, s) => {
    setLoading(true);
    try {
      const since = rangeStart(RANGES[rangeIdx].days);
      const queries = [
        Query.greaterThanEqual("createdAt", since),
        s.asc ? Query.orderAsc(s.field) : Query.orderDesc(s.field),
        Query.limit(PAGE_SIZE),
        Query.offset((p - 1) * PAGE_SIZE),
      ];
      if (filterEvent !== "all") queries.push(Query.equal("event", filterEvent));
      if (filterDevice !== "all") queries.push(Query.equal("device", filterDevice));
      if (search.trim()) queries.push(Query.search("label", search.trim()));
      const res = await db.list(Collections.EVENTS, queries);
      setRows(res.documents ?? res);
      setTotal(res.total ?? (res.documents?.length ?? 0));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [rangeIdx, filterEvent, filterDevice, search]);

  useEffect(() => { setPage(1); }, [rangeIdx, filterEvent, filterDevice, search, sort]);
  useEffect(() => { load(page, sort); }, [load, page, sort]);

  const toggleSort = (field) => setSort((s) => s.field === field ? { ...s, asc: !s.asc } : { field, asc: false });

  const SortIcon = ({ field }) => {
    if (sort.field !== field) return <ArrowUp size={11} className="an-sort-icon" style={{ opacity: 0.3 }} />;
    return sort.asc ? <ArrowUp size={11} className="an-sort-icon" /> : <ArrowDown size={11} className="an-sort-icon" />;
  };

  const cols = [
    { key: "createdAt", label: "Date", sortable: true, w: "13%" },
    { key: "event", label: "Type", sortable: true, w: "9%" },
    { key: "category", label: "Catégorie", sortable: false, w: "10%" },
    { key: "action", label: "Action", sortable: false, w: "10%" },
    { key: "label", label: "Label", sortable: false, w: "22%" },
    { key: "page", label: "Page", sortable: false, w: "16%" },
    { key: "device", label: "Appareil", sortable: false, w: "10%" },
    { key: "sessionId", label: "Session", sortable: false, w: "10%" },
  ];

  const DeviceIcon = ({ device }) => {
    if (device === "mobile") return <Smartphone size={11} />;
    if (device === "tablet") return <Tablet size={11} />;
    return <Monitor size={11} />;
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <SectionHead title="Journal des événements" sub={`${nf(total)} entrées`} icon={Activity} />
        {loading && (
          <span className="an-header-loading">
            <Loader2 size={13} /> chargement…
          </span>
        )}
      </div>
      <div className="an-table-wrap">
        <div className="an-table-scroll">
          <table className="an-table">
            <colgroup>{cols.map((c) => <col key={c.key} style={{ width: c.w }} />)}</colgroup>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    className={`${c.sortable ? "sortable" : ""} ${sort.field === c.key ? "sorted" : ""}`}
                    onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                  >
                    <div className="an-th-content">
                      {c.label}
                      {c.sortable && <SortIcon field={c.key} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ opacity: loading ? 0.5 : 1, transition: "opacity .15s" }}>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="an-table-empty">
                    <Database size={22} className="an-table-empty-icon" />
                    Aucun événement trouvé
                  </td>
                </tr>
              ) : rows.map((row, i) => {
                const b = BADGE[row.event] ?? { bg: "#f1f5f9", text: "#64748b" };
                return (
                  <tr
                    key={row.$id ?? i}
                    className={`an-row ${i % 2 === 1 ? "an-row-even" : ""}`}
                    style={{ animationDelay: `${Math.min(i * 0.02, 0.3)}s` }}
                  >
                    <td className="an-cell-muted">{fmtDateTime(row.createdAt)}</td>
                    <td>
                      <span className="an-badge" style={{ background: b.bg, color: b.text }}>
                        {row.event}
                      </span>
                    </td>
                    <td className="an-cell-muted">{row.category || "—"}</td>
                    <td className="an-cell-muted">{row.action || "—"}</td>
                    <td className="an-cell-primary">{row.label || "—"}</td>
                    <td className="an-cell-muted">{row.page || "—"}</td>
                    <td>
                      {row.device ? (
                        <span className="an-device-badge">
                          <DeviceIcon device={row.device} />
                          {row.device}
                        </span>
                      ) : "—"}
                    </td>
                    <td>
                      {row.sessionId ? (
                        <button className="an-session-btn" onClick={() => onSessionClick(row.sessionId)}>
                          <ArrowRight size={10} />
                          {row.sessionId.slice(0, 8)}…
                        </button>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="an-pagination">
          <span className="an-pagination-info">
            Page {page} / {totalPages} · {nf(total)} résultats
          </span>
          <div className="an-pagination-nav">
            <PaginBtn label="" onClick={() => setPage(1)} disabled={page === 1} icon={ChevronLeft} />
            <PaginBtn label="" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} icon={ChevronLeft} />
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return <PaginBtn key={p} label={p} onClick={() => setPage(p)} active={p === page} />;
            })}
            <PaginBtn label="" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} icon={ChevronRight} />
            <PaginBtn label="" onClick={() => setPage(totalPages)} disabled={page === totalPages} icon={ChevronRight} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SessionList ────────────────────────────────────────────────────────────
function SessionList({ rangeIdx, onSessionClick }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDev, setFilterDev] = useState("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  useEffect(() => {
    setLoading(true);
    const since = rangeStart(RANGES[rangeIdx].days);
    db.list(Collections.EVENTS, [
      Query.greaterThanEqual("createdAt", since),
      Query.orderDesc("createdAt"),
      Query.limit(5000),
    ]).then((res) => {
      const docs = res.documents ?? res;
      const map = {};
      docs.forEach((e) => {
        if (!e.sessionId) return;
        if (!map[e.sessionId]) {
          map[e.sessionId] = {
            sessionId: e.sessionId,
            device: e.device,
            userId: e.userId,
            events: [],
            firstAt: e.createdAt,
            lastAt: e.createdAt,
          };
        }
        map[e.sessionId].events.push(e);
        if (e.createdAt < map[e.sessionId].firstAt) map[e.sessionId].firstAt = e.createdAt;
        if (e.createdAt > map[e.sessionId].lastAt) map[e.sessionId].lastAt = e.createdAt;
      });
      const list = Object.values(map).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
      setSessions(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [rangeIdx]);

  const filtered = useMemo(() => {
    let s = sessions;
    if (filterDev !== "all") s = s.filter((x) => x.device === filterDev);
    if (search.trim()) {
      const q = search.toLowerCase();
      s = s.filter((x) =>
        x.sessionId.toLowerCase().includes(q) ||
        (x.userId || "").toLowerCase().includes(q) ||
        x.events.some((e) => (e.page || "").toLowerCase().includes(q) || (e.label || "").toLowerCase().includes(q))
      );
    }
    return s;
  }, [sessions, filterDev, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => { setPage(1); }, [filterDev, search]);

  const DeviceIcon = ({ device }) => {
    if (device === "mobile") return <Smartphone size={11} />;
    if (device === "tablet") return <Tablet size={11} />;
    return <Monitor size={11} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="an-filters-bar">
        <div className="an-search-wrap">
          <Search size={15} className="an-search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Session ID, page, label…"
            className="an-search-input"
          />
        </div>
        <select value={filterDev} onChange={(e) => setFilterDev(e.target.value)} className="an-select">
          <option value="all">Tous appareils</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
          <option value="tablet">Tablet</option>
        </select>
      </div>

      <div className="an-session-stats">
        {[
          { label: "Sessions", value: nf(filtered.length), color: "#ff750e" },
          { label: "Connectés", value: nf(new Set(sessions.filter(s => s.userId).map(s => s.userId)).size), color: "#2563eb" },
          { label: "Moy. events/session", value: filtered.length ? nf(filtered.reduce((a, s) => a + s.events.length, 0) / filtered.length) : "—", color: "#16a34a" },
          { label: "Moy. durée", value: filtered.length ? fmtDuration(filtered.reduce((a, s) => a + durationMs(s.events), 0) / filtered.length) : "—", color: "#d97706" },
        ].map((s, i) => (
          <div key={s.label} className="an-session-stat" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="an-session-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="an-session-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="an-table-wrap">
        {loading ? (
          <div className="an-loading">
            <Loader2 size={16} /> Chargement…
          </div>
        ) : (
          <>
            <div className="an-table-scroll">
              <table className="an-table">
                <thead>
                  <tr>
                    {["Session", "Début", "Durée", "Events", "Pages", "Appareil", "Utilisateur", ""].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="an-table-empty">Aucune session trouvée</td>
                    </tr>
                  ) : paginated.map((s, i) => {
                    const dur = durationMs(s.events);
                    const pages = [...new Set(s.events.map((e) => e.page).filter(Boolean))];
                    const hasPayment = s.events.some((e) => e.event === "payment");
                    const hasReserve = s.events.some((e) => e.action === "reserve");
                    return (
                      <tr
                        key={s.sessionId}
                        className={`an-row ${i % 2 === 1 ? "an-row-even" : ""}`}
                        style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
                      >
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#ea6a08", fontWeight: 600 }}>
                          {s.sessionId.slice(0, 12)}…
                        </td>
                        <td className="an-cell-muted" style={{ whiteSpace: "nowrap" }}>
                          {fmtDateTime(s.firstAt)}
                        </td>
                        <td className="an-cell-primary" style={{ whiteSpace: "nowrap" }}>
                          {fmtDuration(dur)}
                        </td>
                        <td className="an-cell-primary" style={{ fontWeight: 600 }}>
                          {s.events.length}
                        </td>
                        <td className="an-cell-muted">
                          <span title={pages.join(", ")} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {pages.length} page{pages.length !== 1 ? "s" : ""}
                            {pages.length > 0 && (
                              <span style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
                                · {pages[0]}
                              </span>
                            )}
                          </span>
                        </td>
                        <td>
                          <span className="an-device-badge">
                            <DeviceIcon device={s.device} />
                            {s.device ?? "—"}
                          </span>
                        </td>
                        <td style={{ fontSize: 11 }}>
                          {s.userId ? (
                            <span style={{ color: "#1d4ed8", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                              {s.userId.slice(0, 8)}…
                            </span>
                          ) : <span style={{ opacity: 0.5 }}>anonyme</span>}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                            {hasPayment && (
                              <span title="Paiement complété" className="an-session-badge payment" style={{ padding: "2px 7px", fontSize: 10 }}>
                                💳
                              </span>
                            )}
                            {hasReserve && (
                              <span title="Réservation" className="an-session-badge reserve" style={{ padding: "2px 7px", fontSize: 10 }}>
                                📅
                              </span>
                            )}
                            <button className="an-session-btn" onClick={() => onSessionClick(s.sessionId)}>
                              <Eye size={11} />
                              Voir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="an-pagination">
                <span className="an-pagination-info">
                  Page {page} / {totalPages} · {nf(filtered.length)} sessions
                </span>
                <div className="an-pagination-nav">
                  <PaginBtn label="" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} icon={ChevronLeft} />
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                    return <PaginBtn key={p} label={p} onClick={() => setPage(p)} active={p === page} />;
                  })}
                  <PaginBtn label="" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} icon={ChevronRight} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── SessionDetail ──────────────────────────────────────────────────────────
function SessionDetail({ sessionId, onBack }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("timeline");

  useEffect(() => {
    setLoading(true);
    db.list(Collections.EVENTS, [
      Query.equal("sessionId", sessionId),
      Query.orderAsc("createdAt"),
      Query.limit(1000),
    ]).then((res) => {
      setEvents(res.documents ?? res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [sessionId]);

  const sorted = useMemo(() => [...events].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)), [events]);

  const pagePath = useMemo(() => {
    const pageEvents = sorted.filter((e) => e.event === "page_view" && e.page);
    return pageEvents.map((e, i) => {
      const next = pageEvents[i + 1];
      const dur = next ? new Date(next.createdAt) - new Date(e.createdAt) : null;
      const actions = sorted.filter((x) =>
        x.page === e.page &&
        new Date(x.createdAt) >= new Date(e.createdAt) &&
        (next ? new Date(x.createdAt) < new Date(next.createdAt) : true) &&
        x.event !== "page_view"
      );
      return { page: e.page, at: e.createdAt, dur, actions };
    });
  }, [sorted]);

  const kpi = useMemo(() => ({
    total: events.length,
    duration: durationMs(events),
    pages: new Set(events.map((e) => e.page).filter(Boolean)).size,
    clicks: events.filter((e) => e.event === "click").length,
    searches: events.filter((e) => e.event === "search").length,
    payment: events.some((e) => e.event === "payment"),
    reserve: events.some((e) => e.action === "reserve"),
    device: events[0]?.device ?? "—",
    userId: events[0]?.userId ?? null,
    firstAt: events[0]?.createdAt,
    lastAt: events[events.length - 1]?.createdAt,
  }), [events]);

  const TABS = [
    { key: "timeline", label: "Timeline", icon: Activity },
    { key: "path", label: "Parcours", icon: Route },
    { key: "replay", label: "Replay", icon: Play },
  ];

  if (loading) {
    return (
      <div className="an-loading">
        <Loader2 size={16} /> Chargement de la session…
      </div>
    );
  }

  const DeviceIcon = () => {
    if (kpi.device === "mobile") return <Smartphone size={14} />;
    if (kpi.device === "tablet") return <Tablet size={14} />;
    return <Monitor size={14} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="an-session-header">
        <button className="an-back-btn" onClick={onBack}>
          <ArrowLeft size={14} />
          Retour
        </button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
            Session <span className="an-session-id">{sessionId.slice(0, 16)}…</span>
          </div>
          <div className="an-session-time">
            {kpi.firstAt ? fmtDateTime(kpi.firstAt) : "—"}
            {kpi.lastAt && kpi.firstAt !== kpi.lastAt ? ` → ${fmtDateTime(kpi.lastAt)}` : ""}
          </div>
        </div>
        <div className="an-session-badges">
          {kpi.payment && (
            <span className="an-session-badge payment">
              <CreditCard size={12} /> Paiement
            </span>
          )}
          {kpi.reserve && (
            <span className="an-session-badge reserve">
              <Calendar size={12} /> Réservation
            </span>
          )}
        </div>
      </div>

      <div className="an-session-stats">
        {[
          { label: "Durée", value: fmtDuration(kpi.duration), icon: Clock, color: "#ff750e", bg: "#fff4eb" },
          { label: "Événements", value: nf(kpi.total), icon: ClipboardList, color: "#2563eb", bg: "#eff6ff" },
          { label: "Pages", value: nf(kpi.pages), icon: Eye, color: "#16a34a", bg: "#f0fdf4" },
          { label: "Clics", value: nf(kpi.clicks), icon: MousePointer, color: "#7c3aed", bg: "#f5f3ff" },
          { label: "Recherches", value: nf(kpi.searches), icon: Search, color: "#d97706", bg: "#fffbeb" },
          { label: "Appareil", value: kpi.device, icon: DeviceIcon, color: "#64748b", bg: "#f1f5f9" },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="an-session-stat" style={{ animationDelay: `${i * 0.05}s` }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: k.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: k.color, marginBottom: 8,
              }}>
                <Icon size={15} />
              </div>
              <div className="an-session-stat-value" style={{ color: k.color }}>{k.value}</div>
              <div className="an-session-stat-label">{k.label}</div>
            </div>
          );
        })}
      </div>

      <div className="an-tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`an-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TIMELINE TAB */}
      {activeTab === "timeline" && (
        <div className="an-card" style={{ animation: "anFadeIn 0.3s ease" }}>
          <SectionHead title="Timeline des événements" sub={`${sorted.length} événements dans l'ordre chronologique`} icon={Activity} />
          <div className="an-timeline">
            {sorted.map((e, i) => {
              const b = BADGE[e.event] ?? { bg: "#f1f5f9", text: "#64748b" };
              const Icon = EVENT_ICON[e.event] ?? Activity;
              const isLast = i === sorted.length - 1;
              const next = sorted[i + 1];
              const gap = next ? new Date(next.createdAt) - new Date(e.createdAt) : null;

              return (
                <div
                  key={e.$id ?? i}
                  className="an-timeline-item"
                  style={{ animationDelay: `${Math.min(i * 0.03, 0.5)}s` }}
                >
                  <div className="an-timeline-rail">
                    <div
                      className="an-timeline-dot"
                      style={{ background: b.bg, color: b.text, borderColor: `${b.text}22` }}
                    >
                      <Icon size={13} />
                    </div>
                    {!isLast && <div className="an-timeline-line" />}
                  </div>

                  <div className="an-timeline-content" style={{ paddingBottom: isLast ? 0 : 6 }}>
                    <div className="an-timeline-event-header">
                      <span className="an-badge" style={{ background: b.bg, color: b.text }}>
                        {e.event}
                      </span>
                      {e.category && (
                        <span className="an-timeline-category">{e.category}</span>
                      )}
                      {e.action && (
                        <span className="an-timeline-action">→ {e.action}</span>
                      )}
                      <span className="an-timeline-time">{fmtTime(e.createdAt)}</span>
                    </div>
                    {(e.label || e.page) && (
                      <div className="an-timeline-detail">
                        {e.label && <span>{e.label}</span>}
                        {e.page && <span className="an-timeline-page">· {e.page}</span>}
                      </div>
                    )}
                    {gap && gap > 5000 && (
                      <div className="an-timeline-gap">
                        <Pause size={11} />
                        {fmtDuration(gap)} sans activité
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PATH TAB */}
      {activeTab === "path" && (
        <div className="an-card" style={{ animation: "anFadeIn 0.3s ease" }}>
          <SectionHead title="Parcours de navigation" sub="Pages visitées dans l'ordre, avec durée et actions" icon={Route} />
          {pagePath.length === 0 ? (
            <div className="an-rank-empty">Aucune page_view enregistrée dans cette session.</div>
          ) : (
            <div>
              {pagePath.map((step, i) => {
                const isLast = i === pagePath.length - 1;
                return (
                  <div
                    key={i}
                    className="an-path-step"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="an-path-spine">
                      <div className="an-path-num">{i + 1}</div>
                      {!isLast && <div className="an-path-line" />}
                    </div>

                    <div className="an-path-content">
                      <div className="an-path-card">
                        <div className="an-path-card-header">
                          <div className="an-path-page">
                            <FileText size={14} style={{ color: "#ff750e" }} />
                            {step.page}
                          </div>
                          <div className="an-path-meta">
                            <span><Clock size={11} style={{ marginRight: 3 }} />{fmtTime(step.at)}</span>
                            {step.dur !== null && (
                              <span className={step.dur > 60000 ? "an-path-meta-long" : ""}>
                                <Hourglass size={11} style={{ marginRight: 3 }} />
                                {fmtDuration(step.dur)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {step.actions.length > 0 && (
                        <div className="an-path-actions">
                          {step.actions.map((a, j) => {
                            const b = BADGE[a.event] ?? { bg: "#f1f5f9", text: "#64748b" };
                            const Icon = EVENT_ICON[a.event] ?? Activity;
                            return (
                              <div key={j} className="an-path-action">
                                <div className="an-path-action-icon" style={{ background: b.bg }}>
                                  <Icon size={10} style={{ color: b.text }} />
                                </div>
                                <span className="an-badge" style={{ background: b.bg, color: b.text, fontSize: 10, padding: "1px 7px" }}>
                                  {a.event}
                                </span>
                                {a.label && <span className="an-path-action-label">{a.label}</span>}
                                <span className="an-path-action-time">{fmtTime(a.createdAt)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!isLast && (
                        <div className="an-path-arrow">
                          <ArrowDown size={12} style={{ color: "#94a3b8" }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* REPLAY TAB */}
      {activeTab === "replay" && (
        <div className="an-card" style={{ padding: 0, overflow: "hidden", animation: "anFadeIn 0.3s ease" }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #e2e8f0" }}>
            <SectionHead title="Replay textuel" sub={`Chaque action horodatée · ${sorted.length} événements`} icon={Play} />
          </div>
          <div className="an-replay">
            {sorted.map((e, i) => {
              const b = BADGE[e.event] ?? { bg: "#f1f5f9", text: "#64748b" };
              const isFirst = i === 0;
              const dt = isFirst ? 0 : new Date(e.createdAt) - new Date(sorted[0].createdAt);
              const elapsed = `+${fmtDuration(dt)}`;
              return (
                <div
                  key={e.$id ?? i}
                  className="an-replay-row"
                  style={{ animationDelay: `${Math.min(i * 0.02, 0.4)}s` }}
                >
                  <span className="an-replay-elapsed">{isFirst ? "00:00" : elapsed}</span>
                  <span className="an-replay-time">{fmtTime(e.createdAt)}</span>
                  <span className="an-replay-badge">
                    <span className="an-badge" style={{ background: b.bg, color: b.text, fontSize: 10 }}>
                      {e.event}
                    </span>
                  </span>
                  <span className="an-replay-detail">
                    {[e.category, e.action, e.label].filter(Boolean).join(" › ")}
                    {e.page && <span className="an-replay-page"> · {e.page}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AnalyticsDashboard() {
  useInjectStyles();

  const [section, setSection] = useState("business");
  const [rangeIdx, setRangeIdx] = useState(1);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterDev, setFilterDev] = useState("all");
  const [activeSession, setActiveSession] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const since = rangeStart(RANGES[rangeIdx].days);
      const res = await db.list(Collections.EVENTS, [
        Query.greaterThanEqual("createdAt", since),
        Query.orderDesc("createdAt"),
        Query.limit(5000),
      ]);
      setEvents(res.documents ?? res);
    } catch {
      setError("Impossible de charger les données analytics.");
    } finally {
      setLoading(false);
    }
  }, [rangeIdx]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const openSession = useCallback((sessionId) => {
    setActiveSession(sessionId);
    setSection("sessions");
  }, []);

  const closeSession = useCallback(() => {
    setActiveSession(null);
  }, []);

  const kpi = useMemo(() => {
    const pv = events.filter((e) => e.event === "page_view");
    const res = events.filter((e) => e.action === "reserve");
    const pay = events.filter((e) => e.event === "payment");
    const pkgV = events.filter((e) => e.event === "view" && e.category === "package");
    return {
      visitors: uniq(events, "sessionId"),
      users: uniq(events.filter((e) => e.userId), "userId"),
      pageViews: pv.length,
      searches: events.filter((e) => e.event === "search").length,
      clicks: events.filter((e) => e.event === "click").length,
      reserves: res.length,
      payments: pay.length,
      pkgViews: pkgV.length,
      abandons: events.filter((e) => e.event === "abandon").length,
      favorites: events.filter((e) => e.event === "favorite").length,
      convRate: res.length ? Math.round((pay.length / res.length) * 100) : 0,
    };
  }, [events]);

  const timeData = useMemo(() => groupByTime(events, RANGES[rangeIdx].days), [events, rangeIdx]);
  const topPages = useMemo(() => topN(events.filter((e) => e.event === "page_view"), "page"), [events]);
  const topSearches = useMemo(() => topN(events.filter((e) => e.event === "search"), "label"), [events]);
  const topPkgs = useMemo(() => topN(events.filter((e) => e.event === "view" && e.category === "package"), "label"), [events]);
  const topClicks = useMemo(() => topN(events.filter((e) => e.event === "click"), "label"), [events]);
  const deviceData = useMemo(() => topN(events, "device", 3).map((d) => ({ ...d, label: d.label ?? "inconnu" })), [events]);

  const funnelSteps = useMemo(() => [
    { label: "Sessions", value: kpi.visitors },
    { label: "Packages consultés", value: kpi.pkgViews },
    { label: "Réservations lancées", value: kpi.reserves },
    { label: "Demandes envoyées", value: kpi.payments },
  ], [kpi]);

  const eventTypes = useMemo(() => ["all", ...new Set(events.map((e) => e.event).filter(Boolean))], [events]);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const isLoaded = !loading && !error;

  const currentNav = NAV.find((n) => n.key === section);
  const CurrentIcon = currentNav?.icon || LayoutDashboard;

  return (
    <div className="an-root">


      {/* Main */}
      <main className="an-main">
        {/* Sidebar */}
        <aside className="an-sidebar">
          <div className="an-sidebar-brand">
            <div className="an-sidebar-brand-icon">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="an-sidebar-brand-text">Analytics</div>
              <div className="an-sidebar-brand-sub">Tableau de bord</div>
            </div>
          </div>
          <div className="em-categories">
            {NAV.map((item) => {
              const Icon = item.icon;
              return <button
                key={item.key}
                className={`em-category-tab ${section === item.key ? "active" : ""}`}
                onClick={() => { setSection(item.key); if (item.key !== "sessions") setActiveSession(null); }}
              >
                <Icon size={16} className="an-nav-icon" />
                {item.label}
              </button>
            })}
          </div>
          <div className="an-sidebar-footer">
            <div className="an-range-pills">
              {RANGES.map((r, i) => (
                <button
                  key={r.key}
                  className={`an-range-pill ${rangeIdx === i ? "active" : ""}`}
                  onClick={() => setRangeIdx(i)}
                >
                  {r.label}
                </button>
              ))}
              <button
                className={`an-refresh-btn ${refreshing ? "loading" : ""}`}
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw size={13} />
                Actualiser
              </button>
            </div>
          </div>
        </aside>
        <div className="an-header">
          <div>
            <h2 className="an-header-title">
              <CurrentIcon size={22} className="an-header-icon" />
              {activeSession
                ? <><span style={{ color: "#64748b", fontWeight: 500 }}>Sessions · </span>Détail</>
                : currentNav?.label
              }
            </h2>
            {isLoaded && !activeSession && (
              <p className="an-header-subtitle">
                {nf(events.length)} événements · {nf(kpi.visitors)} sessions · {RANGES[rangeIdx].label}
              </p>
            )}
          </div>
          {loading && (
            <span className="an-header-loading">
              <Loader2 size={14} /> Chargement…
            </span>
          )}
        </div>

        {error && (
          <div className="an-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* OVERVIEW */}
        {/* BUSINESS — agrégats serveur, indépendants du chargement des événements bruts */}
        {section === "business" && !activeSession && (
          <BusinessOverview days={RANGES[rangeIdx].days} rangeLabel={RANGES[rangeIdx].label} />
        )}

        {section === "overview" && isLoaded && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="an-kpi-grid">
              <KpiCard icon={Users} label="Sessions" value={nf(kpi.visitors)} color={T.purple} dimColor={T.purpleDim} delay={0} />
              <KpiCard icon={Zap} label="Connectés" value={nf(kpi.users)} color={T.blue} dimColor={T.blueDim} delay={1} />
              <KpiCard icon={Eye} label="Pages vues" value={nf(kpi.pageViews)} color={T.teal} dimColor={T.tealDim} delay={2} />
              <KpiCard icon={Search} label="Recherches" value={nf(kpi.searches)} color={T.amber} dimColor={T.amberDim} delay={3} />
              <KpiCard icon={MousePointer} label="Clics" value={nf(kpi.clicks)} color={T.coral} dimColor={T.coralDim} delay={4} />
              <KpiCard icon={Target} label="Ouvertures → demandes" value={kpi.convRate + "%"} color={T.purple} dimColor={T.purpleDim} delay={5} />
            </div>

            <div className="an-card">
              <SectionHead title="Activité" sub="Événements dans le temps" icon={Activity} />
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={T.purple} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={T.purple} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.grid} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.gray }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: T.gray }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="value" name="événements" stroke={T.purple} strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 5, fill: T.purple }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="an-card-grid">
              <div className="an-card">
                <SectionHead title="Pages populaires" icon={Eye} />
                <RankList items={topPages} color={T.purple} />
              </div>
              <div className="an-card">
                <SectionHead title="Boutons cliqués" icon={MousePointer} />
                <RankList items={topClicks} color={T.coral} />
              </div>
            </div>
          </div>
        )}

        {/* TRAFFIC */}
        {section === "traffic" && isLoaded && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="an-kpi-grid">
              <KpiCard icon={Users} label="Sessions" value={nf(kpi.visitors)} color={T.purple} dimColor={T.purpleDim} delay={0} />
              <KpiCard icon={Eye} label="Pages vues" value={nf(kpi.pageViews)} color={T.teal} dimColor={T.tealDim} delay={1} />
              <KpiCard icon={Search} label="Recherches" value={nf(kpi.searches)} color={T.amber} dimColor={T.amberDim} delay={2} />
              <KpiCard icon={Heart} label="Favoris" value={nf(kpi.favorites)} color={T.coral} dimColor={T.coralDim} delay={3} />
            </div>

            <div className="an-card">
              <SectionHead title="Évolution du trafic" icon={TrendingUp} />
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTeal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={T.teal} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={T.teal} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.grid} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.gray }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: T.gray }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="value" name="événements" stroke={T.teal} strokeWidth={2} fill="url(#gradTeal)" dot={false} activeDot={{ r: 5, fill: T.teal }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="an-card-grid">
              <div className="an-card">
                <SectionHead title="Appareils" icon={Monitor} />
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deviceData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: T.gray }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: T.gray }} tickLine={false} axisLine={false} width={62} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="value" name="sessions" fill={T.teal} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="an-card">
                <SectionHead title="Recherches fréquentes" icon={Search} />
                <RankList items={topSearches} color={T.amber} />
              </div>
              <div className="an-card">
                <SectionHead title="Pages populaires" icon={Eye} />
                <RankList items={topPages} color={T.purple} />
              </div>
            </div>
          </div>
        )}

        {/* CONVERSION */}
        {section === "conversion" && isLoaded && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="an-kpi-grid">
              <KpiCard icon={Calendar} label="Réservations" value={nf(kpi.reserves)} color={T.purple} dimColor={T.purpleDim} delay={0} />
              <KpiCard icon={CreditCard} label="Demandes envoyées" value={nf(kpi.payments)} color={T.teal} dimColor={T.tealDim} delay={1} />
              <KpiCard icon={TrendingUp} label="Ouvertures → demandes" value={kpi.convRate + "%"} color={T.blue} dimColor={T.blueDim} delay={2} />
              <KpiCard icon={X} label="Abandons" value={nf(kpi.abandons)} color={T.coral} dimColor={T.coralDim} delay={3} />
            </div>

            <div className="an-card-grid">
              <div className="an-card">
                <SectionHead title="Tunnel de conversion" sub="De la visite au paiement" icon={Flame} />
                <Funnel steps={funnelSteps} />
              </div>
              <div className="an-card">
                <SectionHead title="Heatmap des actions" sub="Volume par catégorie × type" icon={Activity} />
                <Heatmap events={events} />
              </div>
            </div>
          </div>
        )}

        {/* CONTENT */}
        {section === "content" && isLoaded && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="an-kpi-grid">
              <KpiCard icon={Package} label="Packages vus" value={nf(kpi.pkgViews)} color={T.blue} dimColor={T.blueDim} delay={0} />
              <KpiCard icon={Heart} label="Favoris" value={nf(kpi.favorites)} color={T.coral} dimColor={T.coralDim} delay={1} />
              <KpiCard icon={Search} label="Recherches" value={nf(kpi.searches)} color={T.amber} dimColor={T.amberDim} delay={2} />
              <KpiCard icon={MousePointer} label="Clics CTA" value={nf(kpi.clicks)} color={T.purple} dimColor={T.purpleDim} delay={3} />
            </div>

            <div className="an-card-grid">
              <div className="an-card">
                <SectionHead title="Packages les plus vus" icon={Package} />
                <RankList items={topPkgs} color={T.blue} />
              </div>
              <div className="an-card">
                <SectionHead title="Recherches les plus fréquentes" icon={Search} />
                <RankList items={topSearches} color={T.amber} />
              </div>
              <div className="an-card">
                <SectionHead title="Boutons les plus cliqués" icon={MousePointer} />
                <RankList items={topClicks} color={T.coral} />
              </div>
            </div>
          </div>
        )}

        {/* EVENTS LOG */}
        {section === "events" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="an-filters-bar">
              <div className="an-search-wrap">
                <Search size={15} className="an-search-icon" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher dans le label…"
                  className="an-search-input"
                />
              </div>
              <select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)} className="an-select">
                {eventTypes.map((t) => <option key={t} value={t}>{t === "all" ? "Tous les types" : t}</option>)}
              </select>
              <select value={filterDev} onChange={(e) => setFilterDev(e.target.value)} className="an-select">
                <option value="all">Tous appareils</option>
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
                <option value="tablet">Tablet</option>
              </select>
              {(search || filterEvent !== "all" || filterDev !== "all") && (
                <button
                  className="an-reset-btn"
                  onClick={() => { setSearch(""); setFilterEvent("all"); setFilterDev("all"); }}
                >
                  <X size={13} /> Réinitialiser
                </button>
              )}
            </div>
            <EventLog
              rangeIdx={rangeIdx}
              filterEvent={filterEvent}
              filterDevice={filterDev}
              search={debouncedSearch}
              onSessionClick={openSession}
            />
          </div>
        )}

        {/* SESSIONS */}
        {section === "sessions" && (
          activeSession
            ? <SessionDetail sessionId={activeSession} onBack={closeSession} />
            : <SessionList rangeIdx={rangeIdx} onSessionClick={openSession} />
        )}
      </main>
    </div>
  );
}