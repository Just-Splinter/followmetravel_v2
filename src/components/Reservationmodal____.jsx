import { useState, useEffect, useCallback, useMemo } from "react";
import { useReservation } from "../context/ReservationContext";
import { GoogleAuthGate } from "./GoogleAuthGate";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

// ─── Theme (aligned with PackageViewerPage) ───────────────────────
const T = {
  primary: "#FF6B35",
  primaryLight: "#FF8C61",
  secondary: "#f44336",
  dark: "#1A1A2E",
  light: "#F7F7F7",
  textDark: "#2D2D2D",
  textMuted: "#6B7280",
  accent: "#FFD23F",
  border: "rgba(0,0,0,0.08)",
};

// ─── Helpers ──────────────────────────────────────────────────────
function fmt(n) {
  return n.toLocaleString("fr-FR") + " DH";
}

const ROOM_TYPES = [
  { key: "triple", label: "Triple", colIdx: 0, paxPerRoom: 3 },
  { key: "double", label: "Double", colIdx: 1, paxPerRoom: 2 },
  { key: "single", label: "Single", colIdx: 2, paxPerRoom: 1 },
  { key: "child", label: "2–5 ans", colIdx: 3, paxPerRoom: 1 },
];

const DEFAULT_SUPPLEMENTS = [
  { key: "excursions", label: "Pack Excursions", icon: "🏔️", pricePerPax: 800 },
  { key: "princes", label: "Îles des Princes + déjeuner", icon: "🚢", pricePerPax: 350 },
  { key: "bursa", label: "Excursion Bursa", icon: "🚌", pricePerPax: 250 },
  { key: "shopping", label: "City Tour & Shopping Day", icon: "🛍️", pricePerPax: 200 },
  { key: "bosphore", label: "Croisière Bosphore by Night", icon: "🌙", pricePerPax: 300 },
];

function parsePrice(str) {
  return parseFloat((str || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}

// ─── Hook : detect desktop (≥ 820px) ─────────────────────────────
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 820);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 820px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

// ─── Global CSS for Reservation Modal ─────────────────────────────
const RESERVATION_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

/* ─── Modal Root ─── */
.rv-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(10, 20, 35, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  backdrop-filter: blur(4px);
  animation: rvFadeIn 0.25s ease;
}

@keyframes rvFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 820px) {
  .rv-backdrop { padding: 12px; }
}

.rv-modal {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 960px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
  font-family: 'Inter', sans-serif;
  overflow: hidden;
  animation: rvSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (max-width: 820px) {
  .rv-modal { max-width: 640px; }
}

@keyframes rvSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ─── Modal Header ─── */
.rv-header {
  background: linear-gradient(135deg, var(--rv-secondary, #ee1909), #F44336);
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 3px solid var(--rv-primary, #FF6B35);
  flex-shrink: 0;
}

.rv-header-title {
  font-family: 'Poppins', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.rv-header-subtitle {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.rv-header-badge {
  background: rgba(255, 107, 53, 0.15);
  border: 1px solid var(--rv-primary, #FF6B35);
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 12px;
  color: #fff;
  font-weight: 600;
  white-space: nowrap;
}

.rv-close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  font-size: 18px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.rv-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* ─── Layout ─── */
.rv-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.rv-form-col {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
  border-right: 1px solid #E5E7EB;
}

@media (max-width: 820px) {
  .rv-body { flex-direction: column; }
  .rv-form-col {
    border-right: none;
    padding: 20px 16px;
  }
}

.rv-recap-col {
  width: 320px;
  flex-shrink: 0;
  padding: 24px;
  overflow-y: auto;
  background: linear-gradient(180deg, #0A2540, #001A33);
}

@media (max-width: 820px) {
  .rv-recap-col {
    width: 100%;
    padding: 20px 16px;
    background: #F9FAFB;
    border-top: 1px solid #E5E7EB;
  }
}

/* ─── Step Indicator ─── */
.rv-steps {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 24px;
}

.rv-step {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rv-step-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  transition: all 0.2s;
}

.rv-step-circle.done {
  background: var(--rv-primary, #FF6B35);
  color: #fff;
  border: 2px solid var(--rv-primary, #FF6B35);
}

.rv-step-circle.active {
  background: var(--rv-secondary, #004E89);
  color: #fff;
  border: 2px solid var(--rv-secondary, #004E89);
}

.rv-step-circle.pending {
  background: #F3F4F6;
  color: #9CA3AF;
  border: 2px solid #E5E7EB;
}

.rv-step-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.rv-step-label.active { color: var(--rv-secondary, #004E89); }
.rv-step-label.done { color: #6B7280; }
.rv-step-label.pending { color: #9CA3AF; }

.rv-step-line {
  flex: 1;
  height: 2px;
  margin: 0 12px;
  transition: background 0.2s;
}

.rv-step-line.done { background: var(--rv-primary, #FF6B35); }
.rv-step-line.pending { background: #E5E7EB; }

/* ─── Section Label ─── */
.rv-section-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--rv-primary, #FF6B35);
  margin-bottom: 14px;
}

.rv-section-label-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, #E5E7EB, transparent);
}

/* ─── Date Card ─── */
.rv-dates-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

@media (max-width: 640px) {
  .rv-dates-grid { grid-template-columns: repeat(2, 1fr); }
}

.rv-date-card {
  border: 2px solid #E5E7EB;
  border-radius: 10px;
  padding: 12px 10px;
  background: #fff;
  cursor: pointer;
  text-align: center;
  font-family: inherit;
  transition: all 0.2s;
}

.rv-date-card:hover {
  border-color: var(--rv-primary, #FF6B35);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.15);
}

.rv-date-card.selected {
  border-color: var(--rv-primary, #FF6B35);
  background: rgba(255, 107, 53, 0.05);
}

.rv-date-from {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
}

.rv-date-arrow {
  font-size: 12px;
  color: var(--rv-primary, #FF6B35);
  margin: 3px 0;
}

.rv-date-to {
  font-size: 11px;
  color: #6B7280;
}

/* ─── Hotel Card ─── */
.rv-hotels-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 640px) {
  .rv-hotels-grid { grid-template-columns: 1fr; }
}

.rv-hotel-card {
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  background: #fff;
  position: relative;
  transition: all 0.2s;
}

.rv-hotel-card:hover {
  border-color: var(--rv-primary, #FF6B35);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(255, 107, 53, 0.15);
}

.rv-hotel-card.selected {
  border-color: var(--rv-primary, #FF6B35);
  background: rgba(255, 107, 53, 0.03);
}

.rv-hotel-check {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 2px solid #E5E7EB;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  font-weight: 700;
  transition: all 0.2s;
}

.rv-hotel-card.selected .rv-hotel-check {
  background: var(--rv-primary, #FF6B35);
  border-color: var(--rv-primary, #FF6B35);
}

.rv-hotel-name {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  padding-right: 28px;
  margin-bottom: 4px;
}

.rv-hotel-stars {
  font-size: 11px;
  color: var(--rv-accent, #FFD23F);
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.rv-hotel-prices {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.rv-hotel-price-item {
  font-size: 11px;
  color: #6B7280;
}

.rv-hotel-price-value {
  font-weight: 700;
  color: var(--rv-secondary, #004E89);
}

/* ─── Selected Hotel Block ─── */
.rv-selected-hotel {
  border: 2px solid var(--rv-primary, #FF6B35);
  border-radius: 12px;
  background: rgba(255, 107, 53, 0.03);
  padding: 16px;
  margin-bottom: 12px;
}

.rv-selected-hotel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
  gap: 12px;
}

.rv-selected-hotel-name {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 4px;
}

.rv-selected-hotel-stars {
  font-size: 11px;
  color: var(--rv-accent, #FFD23F);
  letter-spacing: 1px;
}

.rv-remove-btn {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  color: #DC2626;
  font-size: 11px;
  padding: 5px 12px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 600;
  transition: all 0.2s;
}

.rv-remove-btn:hover {
  background: rgba(239, 68, 68, 0.15);
}

.rv-selected-hotel-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #E5E7EB;
}

.rv-selected-hotel-total-label {
  font-size: 12px;
  color: #6B7280;
}

.rv-selected-hotel-total-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--rv-secondary, #004E89);
}

/* ─── Counter ─── */
.rv-counter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 8px;
  transition: border-color 0.2s;
}

.rv-counter:hover {
  border-color: var(--rv-primary, #FF6B35);
}

.rv-counter-label {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
}

.rv-counter-sub {
  font-size: 10px;
  color: #6B7280;
  margin-top: 2px;
}

.rv-counter-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rv-counter-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid var(--rv-primary, #FF6B35);
  background: transparent;
  color: var(--rv-primary, #FF6B35);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: all 0.2s;
  font-weight: 600;
}

.rv-counter-btn:hover:not(:disabled) {
  background: var(--rv-primary, #FF6B35);
  color: #fff;
}

.rv-counter-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.rv-counter-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--rv-secondary, #004E89);
  min-width: 24px;
  text-align: center;
}

/* ─── Supplements ─── */
.rv-supplements-box {
  background: #fff;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  padding: 6px 16px;
}

.rv-supp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #F3F4F6;
}

.rv-supp-row:last-child { border-bottom: none; }

.rv-supp-label {
  font-size: 13px;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rv-supp-price {
  font-size: 13px;
  font-weight: 700;
  color: var(--rv-secondary, #004E89);
  min-width: 100px;
  text-align: right;
}

/* ─── Toggle ─── */
.rv-toggle {
  width: 38px;
  height: 20px;
  border-radius: 20px;
  border: none;
  background: #D1D5DB;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s;
}

.rv-toggle.on { background: var(--rv-primary, #FF6B35); }

.rv-toggle-knob {
  position: absolute;
  top: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.rv-toggle.on .rv-toggle-knob { left: 20px; }
.rv-toggle:not(.on) .rv-toggle-knob { left: 2px; }

/* ─── Participant Form ─── */
.rv-participant {
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  background: #fff;
  padding: 18px;
  margin-bottom: 12px;
  transition: border-color 0.2s;
}

.rv-participant.required {
  border-color: var(--rv-primary, #FF6B35);
  background: rgba(255, 107, 53, 0.02);
}

.rv-participant-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.rv-participant-badge {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--rv-primary, #FF6B35);
  border-radius: 6px;
  padding: 3px 10px;
  letter-spacing: 0.5px;
}

.rv-participant:not(.required) .rv-participant-badge {
  background: #9CA3AF;
}

.rv-participant-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--rv-primary, #FF6B35);
}

.rv-participant:not(.required) .rv-participant-tag {
  color: #9CA3AF;
}

.rv-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

@media (max-width: 640px) {
  .rv-form-grid { grid-template-columns: 1fr; }
}

.rv-field-label {
  font-size: 11px;
  font-weight: 700;
  color: #6B7280;
  margin-bottom: 5px;
  display: block;
  letter-spacing: 0.3px;
}

.rv-field-label .rv-required {
  color: var(--rv-primary, #FF6B35);
  margin-left: 2px;
}

.rv-input {
  width: 100%;
  border: 1.5px solid #E5E7EB;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  color: #111827;
  font-family: inherit;
  outline: none;
  background: #fff;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.rv-input:focus {
  border-color: var(--rv-primary, #FF6B35);
}

/* ─── Recap Panel ─── */
.rv-recap {
  background: linear-gradient(135deg, #0A2540, #001A33);
  border-radius: 12px;
  padding: 22px 20px;
  border: 1px solid rgba(255, 107, 53, 0.2);
  color: #fff;
}

@media (max-width: 820px) {
  .rv-recap {
    background: #fff;
    color: #111827;
    border: 1px solid #E5E7EB;
  }
  .rv-recap .rv-recap-label { color: #6B7280 !important; }
  .rv-recap .rv-recap-value { color: #111827 !important; }
  .rv-recap .rv-recap-hotel-name { color: var(--rv-primary, #FF6B35) !important; }
  .rv-recap .rv-recap-hotel-line { color: #6B7280 !important; }
  .rv-recap .rv-recap-total-amount { color: var(--rv-primary, #FF6B35) !important; }
  .rv-recap .rv-recap-disclaimer { color: #9CA3AF !important; }
}

.rv-recap-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--rv-primary, #FF6B35);
  margin-bottom: 16px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.rv-recap-title-line {
  width: 20px;
  height: 1px;
  background: var(--rv-primary, #FF6B35);
  opacity: 0.5;
}

.rv-recap-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  gap: 10px;
}

.rv-recap-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

.rv-recap-value {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-align: right;
}

.rv-recap-breakdown {
  margin-top: 8px;
  margin-bottom: 10px;
  padding-top: 10px;
  border-top: 1px dashed rgba(255, 255, 255, 0.15);
}

.rv-recap-hotel-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--rv-primary, #FF6B35);
  margin-bottom: 4px;
}

.rv-recap-hotel-line {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  padding-left: 10px;
  margin-bottom: 2px;
}

.rv-recap-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
  margin: 10px 0 16px;
}

.rv-recap-total {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
}

.rv-recap-total-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}

.rv-recap-total-amount {
  font-family: 'Poppins', sans-serif;
  font-size: 30px;
  font-weight: 800;
  color: var(--rv-primary, #FF6B35);
  line-height: 1;
}

.rv-recap-disclaimer {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.3px;
  text-align: center;
  margin-top: 4px;
}

/* ─── Buttons ─── */
.rv-btn-primary {
  width: 100%;
  background: linear-gradient(135deg, var(--rv-primary, #FF6B35), var(--rv-primaryLight, #FF8C61));
  border: none;
  border-radius: 10px;
  padding: 14px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.rv-btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 107, 53, 0.35);
}

.rv-btn-primary:disabled {
  background: rgba(0, 0, 0, 0.08);
  color: #9CA3AF;
  cursor: not-allowed;
}

.rv-btn-secondary {
  width: 100%;
  background: var(--rv-secondary, #004E89);
  border: none;
  border-radius: 10px;
  padding: 14px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.rv-btn-secondary:hover:not(:disabled) {
  background: #003366;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 78, 137, 0.35);
}

.rv-btn-secondary:disabled {
  background: rgba(0, 0, 0, 0.08);
  color: #9CA3AF;
  cursor: not-allowed;
}

.rv-btn-ghost {
  background: transparent;
  border: 1.5px solid #E5E7EB;
  border-radius: 8px;
  color: #6B7280;
  font-size: 12px;
  padding: 8px 16px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.rv-btn-ghost:hover {
  border-color: var(--rv-primary, #FF6B35);
  color: var(--rv-primary, #FF6B35);
}

.rv-help-text {
  font-size: 11px;
  color: #9CA3AF;
  text-align: center;
  margin-top: 12px;
  line-height: 1.5;
}

.rv-error-box {
  background: #FEE2E2;
  color: #DC2626;
  padding: 12px;
  border-radius: 8px;
  margin-top: 12px;
  font-size: 12px;
  border: 1px solid #FECACA;
}

/* ─── Info Banner ─── */
.rv-info-banner {
  background: rgba(255, 107, 53, 0.06);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 12px;
  color: #4B5563;
  line-height: 1.6;
  margin-bottom: 16px;
}

.rv-info-banner strong {
  color: #111827;
}

.rv-info-banner .rv-highlight {
  color: var(--rv-secondary, #004E89);
  font-weight: 700;
}

/* ─── Success State ─── */
.rv-success {
  padding: 48px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  overflow-y: auto;
}

.rv-success-icon {
  font-size: 56px;
  animation: rvBounce 0.6s ease;
}

@keyframes rvBounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.rv-success-title {
  font-family: 'Poppins', sans-serif;
  font-size: 24px;
  color: var(--rv-secondary, #004E89);
  font-weight: 700;
}

.rv-success-ref {
  font-size: 14px;
  font-weight: 700;
  color: var(--rv-primary, #FF6B35);
  letter-spacing: 2px;
  background: rgba(255, 107, 53, 0.08);
  padding: 8px 20px;
  border-radius: 20px;
}

.rv-success-text {
  font-size: 13px;
  color: #6B7280;
  line-height: 1.7;
  max-width: 420px;
}

.rv-success-phones {
  font-size: 13px;
  color: #111827;
  font-weight: 600;
  margin-top: 8px;
}

.rv-success-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.rv-success-btn {
  border-radius: 8px;
  padding: 11px 24px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.rv-success-btn.ghost {
  background: transparent;
  border: 1.5px solid var(--rv-primary, #FF6B35);
  color: var(--rv-primary, #FF6B35);
}

.rv-success-btn.ghost:hover {
  background: rgba(255, 107, 53, 0.08);
}

.rv-success-btn.solid {
  background: var(--rv-primary, #FF6B35);
  border: none;
  color: #fff;
}

.rv-success-btn.solid:hover {
  background: var(--rv-primaryLight, #FF8C61);
  transform: translateY(-2px);
}

/* ─── Contact Block ─── */
.rv-contact-block {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

@media (max-width: 820px) {
  .rv-contact-block {
    border-top: 1px solid #E5E7EB;
  }
}

.rv-contact-title {
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 10px;
}

@media (max-width: 820px) {
  .rv-contact-title { color: #9CA3AF; }
}

.rv-contact-item {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 6px;
}

@media (max-width: 820px) {
  .rv-contact-item { color: #6B7280; }
}

/* ─── Scrollbar ─── */
.rv-form-col::-webkit-scrollbar,
.rv-recap-col::-webkit-scrollbar {
  width: 6px;
}

.rv-form-col::-webkit-scrollbar-track,
.rv-recap-col::-webkit-scrollbar-track {
  background: transparent;
}

.rv-form-col::-webkit-scrollbar-thumb {
  background: #D1D5DB;
  border-radius: 3px;
}

.rv-recap-col::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
`;

function useGlobalStyles() {
  useEffect(() => {
    if (document.getElementById("rv-global")) return;
    const el = document.createElement("style");
    el.id = "rv-global";
    el.textContent = RESERVATION_CSS;
    document.head.appendChild(el);
  }, []);
}

// ─── Sub-components ───────────────────────────────────────────────

function Counter({ label, sub, value, min = 0, max = 10, onChange }) {
  return (
    <div className="rv-counter">
      <div>
        <div className="rv-counter-label">{label}</div>
        {sub && <div className="rv-counter-sub">{sub}</div>}
      </div>
      <div className="rv-counter-controls">
        <button
          className="rv-counter-btn"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          −
        </button>
        <span className="rv-counter-value">{value}</span>
        <button
          className="rv-counter-btn"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ icon, children }) {
  return (
    <div className="rv-section-label">
      <span>{icon}</span>
      <span>{children}</span>
      <div className="rv-section-label-line" />
    </div>
  );
}

function DateCard({ date, selected, onClick }) {
  return (
    <button
      className={`rv-date-card ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <div className="rv-date-from">{date.from}</div>
      <div className="rv-date-arrow">→</div>
      <div className="rv-date-to">{date.to}</div>
    </button>
  );
}

function HotelCard({ hotel, selected, onClick }) {
  const prices = ROOM_TYPES.slice(0, 3).map(rt => ({
    label: rt.label,
    price: parsePrice(hotel.cols[rt.colIdx]),
  }));

  return (
    <div
      className={`rv-hotel-card ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <div className="rv-hotel-check">{selected && "✓"}</div>
      <div className="rv-hotel-name">{hotel.name}</div>
      <div className="rv-hotel-stars">{"★".repeat(hotel.stars)}</div>
      <div className="rv-hotel-prices">
        {prices.map(p => (
          <div key={p.label} className="rv-hotel-price-item">
            <span className="rv-hotel-price-value">
              {p.price.toLocaleString("fr-FR")} DH
            </span>{" "}
            {p.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomLine({ hotel, roomType, qty, onChange }) {
  const price = parsePrice(hotel.cols[roomType.colIdx]);
  return (
    <Counter
      label={roomType.label}
      sub={`${price.toLocaleString("fr-FR")} DH /pers. · ${roomType.paxPerRoom} pers./chambre`}
      value={qty}
      min={0}
      max={10}
      onChange={onChange}
    />
  );
}

function SelectedHotelBlock({ hotel, hotelKey, rooms, onRoomChange, onRemove, hotelPax, hotelTotal }) {
  return (
    <div className="rv-selected-hotel">
      <div className="rv-selected-hotel-header">
        <div>
          <div className="rv-selected-hotel-name">{hotel.name}</div>
          <div className="rv-selected-hotel-stars">{"★".repeat(hotel.stars)}</div>
        </div>
        <button className="rv-remove-btn" onClick={onRemove}>
          Retirer
        </button>
      </div>

      <div>
        {ROOM_TYPES.map(rt => (
          <RoomLine
            key={rt.key}
            hotel={hotel}
            roomType={rt}
            qty={rooms?.[rt.key] || 0}
            onChange={(v) => onRoomChange(hotelKey, rt.key, v)}
          />
        ))}
      </div>

      <div className="rv-selected-hotel-total">
        <span className="rv-selected-hotel-total-label">
          {hotelPax} pers. — sous-total
        </span>
        <span className="rv-selected-hotel-total-value">{fmt(hotelTotal)}</span>
      </div>
    </div>
  );
}

function ParticipantForm({ index, data, onChange, required }) {
  const set = (field) => (e) => onChange(index, { ...data, [field]: e.target.value });

  return (
    <div className={`rv-participant ${required ? "required" : ""}`}>
      <div className="rv-participant-header">
        <span className="rv-participant-badge">Participant {index + 1}</span>
        <span className="rv-participant-tag">
          {required ? "Obligatoire" : "Facultatif"}
        </span>
      </div>

      <div className="rv-form-grid">
        <div>
          <label className="rv-field-label">
            Nom complet {required && <span className="rv-required">*</span>}
          </label>
          <input
            className="rv-input"
            type="text"
            placeholder="Nom et prénom"
            value={data.fullName || ""}
            onChange={set("fullName")}
          />
        </div>
        <div>
          <label className="rv-field-label">
            Téléphone {required && <span className="rv-required">*</span>}
          </label>
          <input
            className="rv-input"
            type="tel"
            placeholder="+212 6 00 00 00 00"
            value={data.phone || ""}
            onChange={set("phone")}
          />
        </div>
      </div>

      <div className="rv-form-grid">
        <div>
          <label className="rv-field-label">Email</label>
          <input
            className="rv-input"
            type="email"
            placeholder="email@exemple.com"
            value={data.email || ""}
            onChange={set("email")}
          />
        </div>
        <div>
          <label className="rv-field-label">Date de naissance</label>
          <input
            className="rv-input"
            type="date"
            value={data.birthDate || ""}
            onChange={set("birthDate")}
          />
        </div>
      </div>

      <div>
        <label className="rv-field-label">N° Passeport / CIN</label>
        <input
          className="rv-input"
          type="text"
          placeholder="Numéro de document"
          value={data.docNumber || ""}
          onChange={set("docNumber")}
        />
      </div>
    </div>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <button
      className={`rv-toggle ${on ? "on" : ""}`}
      onClick={onToggle}
      type="button"
    >
      <div className="rv-toggle-knob" />
    </button>
  );
}

function SupplementRow({ supp, enabled, totalPax, onToggle }) {
  const total = supp.pricePerPax * totalPax;
  return (
    <div className="rv-supp-row">
      <span className="rv-supp-label">
        <span>{supp.icon}</span>
        {supp.label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="rv-supp-price">
          {enabled ? `+${fmt(total)}` : `${fmt(supp.pricePerPax)}/pers.`}
        </span>
        <Toggle on={enabled} onToggle={onToggle} />
      </div>
    </div>
  );
}

function StepIndicator({ step }) {
  const steps = [
    { key: "config", label: "Configuration" },
    { key: "participants", label: "Participants" },
  ];
  const currentIdx = steps.findIndex(s => s.key === step);

  return (
    <div className="rv-steps">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} style={{ display: "contents" }}>
            <div className="rv-step">
              <div className={`rv-step-circle ${done ? "done" : active ? "active" : "pending"}`}>
                {done ? "✓" : i + 1}
              </div>
              <span className={`rv-step-label ${done ? "done" : active ? "active" : "pending"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`rv-step-line ${done ? "done" : "pending"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function RecapPanel({ selectedDate, hotelSelections, hotelBreakdown, totalPax, suppTotal, baseTotal, grandTotal, canSubmit, onNext, step, onSubmit, canConfirm, submitError, loading }) {
  const date = selectedDate;
  const nbHotels = Object.keys(hotelSelections).length;
  const isParticipantsStep = step === "participants";

  const rows = [
    ["Date", date ? `${date.from} → ${date.to}` : "—"],
    ["Hôtels sélectionnés", nbHotels > 0 ? `${nbHotels}` : "—"],
    ["Participants", `${totalPax} pers.`],
    ["Hébergement", nbHotels > 0 ? fmt(baseTotal) : "—"],
    ...(suppTotal > 0 ? [["Suppléments", `+${fmt(suppTotal)}`]] : []),
  ];

  return (
    <div className="rv-recap">
      <div className="rv-recap-title">
        <span className="rv-recap-title-line" />
        Récapitulatif
        <span className="rv-recap-title-line" />
      </div>

      {rows.map(([k, v]) => (
        <div key={k} className="rv-recap-row">
          <span className="rv-recap-label">{k}</span>
          <span className="rv-recap-value">{v}</span>
        </div>
      ))}

      {hotelBreakdown.length > 0 && (
        <div className="rv-recap-breakdown">
          {hotelBreakdown.map(h => (
            <div key={h.name} style={{ marginBottom: 8 }}>
              <div className="rv-recap-hotel-name">{h.name}</div>
              {h.lines.map(l => (
                <div key={l.label} className="rv-recap-hotel-line">
                  <span>{l.qty}× {l.label}</span>
                  <span>{fmt(l.subtotal)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="rv-recap-divider" />

      <div className="rv-recap-total">
        <span className="rv-recap-total-label">Total estimé</span>
        <span className="rv-recap-total-amount">
          {canSubmit ? fmt(grandTotal) : "—"}
        </span>
        {canSubmit && (
          <span className="rv-recap-disclaimer">
            Estimation non contractuelle
          </span>
        )}
      </div>

      {!isParticipantsStep ? (
        <button
          className="rv-btn-primary"
          onClick={onNext}
          disabled={!canSubmit}
        >
          → Participants
        </button>
      ) : (
        <button
          className="rv-btn-primary"
          onClick={onSubmit}
          disabled={!canConfirm || loading}
          style={{ cursor: loading ? "wait" : canConfirm ? "pointer" : "not-allowed" }}
        >
          {loading ? "⏳ Confirmation..." : "✓ Confirmer la réservation"}
        </button>
      )}

      {submitError && <div className="rv-error-box">{submitError}</div>}

      {!canSubmit && !isParticipantsStep && (
        <div className="rv-help-text">
          Sélectionnez une date, un hôtel<br />et au moins une chambre.
        </div>
      )}

      {isParticipantsStep && !canConfirm && (
        <div className="rv-help-text">
          Renseignez le nom et le téléphone<br />du participant principal.
        </div>
      )}
    </div>
  );
}

function ParticipantsSection({ participants, onParticipantChange, totalPax, onBack, isDesktop, onSubmit, canConfirm, loading }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button className="rv-btn-ghost" onClick={onBack} style={{ alignSelf: "flex-start" }}>
        ← Modifier la configuration
      </button>

      <div className="rv-info-banner">
        <strong>{totalPax} participant{totalPax > 1 ? "s" : ""} détecté{totalPax > 1 ? "s" : ""}</strong>{" "}
        selon votre sélection de chambres. Le participant principal est{" "}
        <span className="rv-highlight">obligatoire</span>, les suivants sont facultatifs.
      </div>

      {participants.map((p, i) => (
        <ParticipantForm
          key={i}
          index={i}
          data={p}
          onChange={onParticipantChange}
          required={i === 0}
        />
      ))}

      {!isDesktop && (
        <button
          className="rv-btn-primary"
          onClick={onSubmit}
          disabled={!canConfirm || loading}
        >
          {loading ? "⏳ Confirmation..." : "✓ Confirmer la réservation"}
        </button>
      )}
      {!isDesktop && !canConfirm && (
        <div className="rv-help-text">
          Renseignez le nom et le téléphone du participant principal.
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────
export function ReservationModal({ pkg, onClose }) {
  useGlobalStyles();

  const { createReservation } = useReservation();

  const [selectedDate, setSelectedDate] = useState(null);
  const [hotelSelections, setHotelSelections] = useState({});
  const [supplements, setSupplements] = useState({});
  const [participants, setParticipants] = useState([{}]);
  const [step, setStep] = useState("config");
  const [submitted, setSubmitted] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [, setReservationResult] = useState(null);
  const isDesktop = useIsDesktop();
  const suppList = DEFAULT_SUPPLEMENTS;

  useEffect(() => {
    const init = {};
    suppList.forEach(s => { init[s.key] = false; });
    setSupplements(init);
  }, [suppList]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleSupp = useCallback((key) => {
    setSupplements(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleHotel = useCallback((hotelIdx) => {
    setHotelSelections(prev => {
      const next = { ...prev };
      if (next[hotelIdx]) {
        delete next[hotelIdx];
      } else {
        next[hotelIdx] = { triple: 0, double: 1, single: 0, child: 0 };
      }
      return next;
    });
  }, []);

  const handleRoomChange = useCallback((hotelIdx, roomKey, value) => {
    setHotelSelections(prev => ({
      ...prev,
      [hotelIdx]: { ...prev[hotelIdx], [roomKey]: value },
    }));
  }, []);

  const removeHotel = useCallback((hotelIdx) => {
    setHotelSelections(prev => {
      const next = { ...prev };
      delete next[hotelIdx];
      return next;
    });
  }, []);

  const { hotelBreakdown, baseTotal, totalPax } = useMemo(() => {
    let baseTotal = 0;
    let totalPax = 0;
    const hotelBreakdown = [];

    Object.entries(hotelSelections).forEach(([hotelIdxStr, rooms]) => {
      const hotelIdx = Number(hotelIdxStr);
      const hotel = pkg.hotels[hotelIdx];
      if (!hotel) return;

      const lines = [];
      let hotelTotal = 0;
      let hotelPax = 0;

      ROOM_TYPES.forEach(rt => {
        const qty = rooms[rt.key] || 0;
        if (qty <= 0) return;
        const pricePerPax = parsePrice(hotel.cols[rt.colIdx]);
        const pax = qty * rt.paxPerRoom;
        const subtotal = pricePerPax * pax;
        hotelTotal += subtotal;
        hotelPax += pax;
        lines.push({ label: rt.label, qty, subtotal });
      });

      if (hotelPax > 0) {
        baseTotal += hotelTotal;
        totalPax += hotelPax;
        hotelBreakdown.push({ name: hotel.name, lines, total: hotelTotal, pax: hotelPax });
      }
    });

    return { hotelBreakdown, baseTotal, totalPax };
  }, [hotelSelections, pkg.hotels]);

  const suppTotal = suppList.reduce((acc, s) => supplements[s.key] ? acc + s.pricePerPax * totalPax : acc, 0);
  const grandTotal = baseTotal + suppTotal;
  const canSubmit = selectedDate !== null && hotelBreakdown.length > 0 && totalPax > 0;

  useEffect(() => {
    setParticipants(prev => {
      const target = Math.max(totalPax, 1);
      if (prev.length === target) return prev;
      if (prev.length < target) {
        return [...prev, ...Array.from({ length: target - prev.length }, () => ({}))];
      }
      return prev.slice(0, target);
    });
  }, [totalPax]);

  const handleParticipantChange = useCallback((index, data) => {
    setParticipants(prev => {
      const next = [...prev];
      next[index] = data;
      return next;
    });
  }, []);

  const participant1 = participants[0] || {};
  const canConfirm = !!(participant1.fullName?.trim() && participant1.phone?.trim());
  const { executeRecaptcha } = useGoogleReCaptcha();

  const handleNextStep = () => {
    if (canSubmit) setStep("participants");
  };

  const handleBack = () => {
    setStep("config");
  };

  const handleSubmit = async () => {
    if (loading) return;

    setLoading(true);
    setSubmitError(null);
    if (!executeRecaptcha) {
      setLoading(false);
      return;
    }
    try {
      const hotelsPayload = hotelBreakdown.map((h) => ({
        name: h.name,
        rooms: h.lines.map((l) => ({
          type: l.label,
          qty: l.qty,
        })),
        subtotal: h.total,
        pax: h.pax,
      }));

      const result = await createReservation({
        packageId: pkg.$id ?? pkg.id,
        packageTitle: `${pkg.destination}${pkg.destinationAccent}`,
        hotels: JSON.stringify(hotelsPayload),
        dateFrom: selectedDate.from,
        dateTo: selectedDate.to,
        totalPax,
        participants: JSON.stringify(participants),
        supplements: Object.keys(supplements).filter((k) => supplements[k]),
        totalEstimate: grandTotal,
        recaptchaToken: await executeRecaptcha("reservation"),
      });

      if (!result.success) {
        setSubmitError(result.message || "Une erreur est survenue.");
        return;
      }

      setReservationResult(result.reservation);
      setRefCode(result.reservation?.ref);
      setSubmitted(true);
    } catch (err) {
      if (err.message === "AUTH_REQUIRED") return;
      setSubmitError(err.message || "Erreur serveur.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedDate(null);
    setHotelSelections({});
    setParticipants([{}]);
    setStep("config");
    const init = {};
    suppList.forEach(s => { init[s.key] = false; });
    setSupplements(init);
    setSubmitted(false);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const availableDates = (pkg.departureDates || []).filter((d) => {
    const [day, month] = d.from.split("/").map(Number);
    const departure = new Date(today.getFullYear(), month - 1, day);
    return departure >= today;
  });

  const cssVars = {
    "--rv-primary": T.primary,
    "--rv-primaryLight": T.primaryLight,
    "--rv-secondary": T.secondary,
    "--rv-accent": T.accent,
  };

  const configSections = (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Dates */}
      <div>
        <SectionLabel icon="📅">Date de départ</SectionLabel>
        <div className="rv-dates-grid">
          {availableDates.map((d) => (
            <DateCard
              key={d.id}
              date={d}
              selected={selectedDate?.id === d.id}
              onClick={() => setSelectedDate(d)}
            />
          ))}
        </div>
      </div>

      {/* Hotels */}
      <div>
        <SectionLabel icon="🏨">Hôtels (sélection multiple)</SectionLabel>
        <div className="rv-hotels-grid">
          {pkg.hotels.map((h, i) => (
            <HotelCard
              key={h.id}
              hotel={h}
              selected={!!hotelSelections[i]}
              onClick={() => toggleHotel(i)}
            />
          ))}
        </div>
      </div>

      {/* Rooms per hotel */}
      {Object.keys(hotelSelections).length > 0 && (
        <div>
          <SectionLabel icon="🛏️">Chambres par hôtel</SectionLabel>
          <div>
            {Object.keys(hotelSelections).map(hotelIdxStr => {
              const hotelIdx = Number(hotelIdxStr);
              const hotel = pkg.hotels[hotelIdx];
              const breakdown = hotelBreakdown.find(b => b.name === hotel.name);
              return (
                <SelectedHotelBlock
                  key={hotelIdx}
                  hotel={hotel}
                  hotelKey={hotelIdx}
                  rooms={hotelSelections[hotelIdx]}
                  onRoomChange={handleRoomChange}
                  onRemove={() => removeHotel(hotelIdx)}
                  hotelPax={breakdown?.pax || 0}
                  hotelTotal={breakdown?.total || 0}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Supplements */}
      <div>
        <SectionLabel icon="➕">Options & Suppléments</SectionLabel>
        <div className="rv-supplements-box">
          {suppList.map((s) => (
            <div key={s.key}>
              <SupplementRow
                supp={s}
                enabled={!!supplements[s.key]}
                totalPax={totalPax}
                onToggle={() => toggleSupp(s.key)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile next button */}
      {!isDesktop && (
        <button
          className="rv-btn-secondary"
          onClick={handleNextStep}
          disabled={!canSubmit}
        >
          → Saisir les participants
        </button>
      )}
      {!isDesktop && !canSubmit && (
        <div className="rv-help-text">
          Sélectionnez une date, un hôtel et au moins une chambre.
        </div>
      )}
    </div>
  );

  const recapProps = {
    pkg,
    selectedDate,
    hotelSelections,
    hotelBreakdown,
    totalPax,
    suppTotal,
    baseTotal,
    grandTotal,
    canSubmit,
    step,
    onNext: handleNextStep,
    onSubmit: handleSubmit,
    canConfirm,
    submitError,
    loading,
  };

  return (
    <div className="rv-backdrop" onClick={onClose} style={cssVars}>
      <div className="rv-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="rv-header">
          <div>
            <div className="rv-header-title">Réserver votre séjour</div>
            <div className="rv-header-subtitle">
              {pkg.itineraryTitle} · {pkg.periodLabel}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="rv-header-badge">
              {pkg.destination}
              <span style={{ color: T.primary }}>{pkg.destinationAccent}</span>
            </div>
            <button className="rv-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Success State */}
        {submitted ? (
          <div className="rv-success">
            <div className="rv-success-icon">✅</div>
            <div className="rv-success-title">Réservation envoyée !</div>
            <div className="rv-success-ref">Référence : {refCode}</div>
            <div className="rv-success-text">
              Notre équipe vous contactera sous 24h pour confirmer votre réservation et les modalités de paiement.
              <br /><br />
              <strong className="rv-success-phones">
                📞 {pkg.phone1} · {pkg.phone2}
              </strong>
            </div>
            <div className="rv-success-actions">
              <button className="rv-success-btn ghost" onClick={handleReset}>
                Nouvelle réservation
              </button>
              <button className="rv-success-btn solid" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        ) : isDesktop ? (
          /* Desktop: two columns */
          <div className="rv-body">
            <div className="rv-form-col">
              <GoogleAuthGate>
                <StepIndicator step={step} />
                {step === "config" ? configSections : (
                  <ParticipantsSection
                    participants={participants}
                    onParticipantChange={handleParticipantChange}
                    totalPax={totalPax}
                    onBack={handleBack}
                    isDesktop={isDesktop}
                    onSubmit={handleSubmit}
                    canConfirm={canConfirm}
                    loading={loading}
                  />
                )}
              </GoogleAuthGate>
            </div>
            <div className="rv-recap-col">
              <div style={{ position: "sticky", top: 0 }}>
                <RecapPanel {...recapProps} />
                <div className="rv-contact-block">
                  <div className="rv-contact-title">Contact</div>
                  {[`📞 ${pkg.phone1}`, `📞 ${pkg.phone2}`, `🌐 ${pkg.website}`].map((c, i) => (
                    <div key={i} className="rv-contact-item">{c}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Mobile: single column */
          <div className="rv-form-col" style={{ borderRight: "none" }}>
            <StepIndicator step={step} />
            {step === "config" ? configSections : (
              <ParticipantsSection
                participants={participants}
                onParticipantChange={handleParticipantChange}
                totalPax={totalPax}
                onBack={handleBack}
                isDesktop={isDesktop}
                onSubmit={handleSubmit}
                canConfirm={canConfirm}
                loading={loading}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}