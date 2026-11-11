// Tokens du design system admin, côté JavaScript — pour les graphiques
// (recharts n'accepte pas var(--…) dans ses attributs SVG) et les couleurs
// calculées (transparence ajoutée à un hex). Miroir de admin-theme.css :
// toute modification se fait dans les deux fichiers.

export const ADM = {
  brand: "#ff750e",
  brandHover: "#ea6a08",
  brandSoft: "#fff4eb",
  ink: "#0f172a",
  text: "#1e293b",
  text2: "#475569",
  muted: "#64748b",
  subtle: "#94a3b8",
  line: "#e2e8f0",
  lineStrong: "#cbd5e1",
  bg: "#f8fafc",
  surface: "#ffffff",
  surface2: "#f1f5f9",
  success: "#16a34a",
  successBg: "#f0fdf4",
  warning: "#d97706",
  warningBg: "#fffbeb",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  info: "#2563eb",
  infoBg: "#eff6ff",
  violet: "#7c3aed",
  violetBg: "#f5f3ff",
  cyan: "#0891b2",
  cyanBg: "#ecfeff",
};

/** Palette des graphiques, dans l'ordre d'usage. */
export const CHART = [ADM.brand, ADM.info, ADM.success, ADM.violet, ADM.cyan, ADM.warning];

export const GRID = "#eef2f6";
