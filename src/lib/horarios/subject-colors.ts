/**
 * subject-colors.ts — Sistema Unificado de Paletas y Colores Determinísticos por Materia
 * SIGPDA-EMS · Educación Media Superior
 *
 * Garantiza que la misma materia tenga exactamente los mismos colores armónicos
 * en PDF Oficial, Word Editable (.docx), Excel Estilizado (ExcelJS) y Tarjeta WhatsApp (Neón).
 */

export interface SubjectColor {
  pastelBg: string;      // Hex sin '#' para docx/ExcelJS (ARGB) e.g. "DBEAFE"
  pastelBgHex: string;   // Hex con '#' para jsPDF/CSS e.g. "#DBEAFE"
  pastelText: string;    // Hex sin '#' para docx/ExcelJS (ARGB) e.g. "1E3A8A"
  pastelTextHex: string; // Hex con '#' para jsPDF/CSS e.g. "#1E3A8A"
  neon: string;          // Hex con '#' para WhatsApp e.g. "#22D3EE"
  neonGlow: string;      // RGBA para WhatsApp e.g. "rgba(34, 211, 238, 0.6)"
  borderHex: string;     // Hex con '#' para bordes suaves e.g. "#93C5FD"
}

// 9 Pares determinísticos (Contrastes AA verificados)
const PALETTE_SUBJECTS = [
  { pastelBg: "DBEAFE", pastelText: "1E3A8A", neon: "#22D3EE", border: "#93C5FD" }, // Azul
  { pastelBg: "DCFCE7", pastelText: "166534", neon: "#A3E635", border: "#86EFAC" }, // Verde
  { pastelBg: "FEF3C7", pastelText: "92400E", neon: "#FDE047", border: "#FDE68A" }, // Ámbar / Miel
  { pastelBg: "FCE7F3", pastelText: "9D174D", neon: "#F472B6", border: "#FBCFE8" }, // Rosa / Magenta
  { pastelBg: "E0E7FF", pastelText: "3730A3", neon: "#C084FC", border: "#C7D2FE" }, // Índigo / Lavanda
  { pastelBg: "FFEDD5", pastelText: "9A3412", neon: "#FB923C", border: "#FED7AA" }, // Naranja Suave
  { pastelBg: "F3E8FF", pastelText: "6B21A8", neon: "#E879F9", border: "#E9D5FF" }, // Púrpura
  { pastelBg: "CCFBF1", pastelText: "115E59", neon: "#2DD4BF", border: "#99F6E4" }, // Menta / Turquesa
  { pastelBg: "FEE2E2", pastelText: "991B1B", neon: "#F87171", border: "#FECACA" }  // Coral / Salmón
];

const COLOR_LIBRE: SubjectColor = {
  pastelBg: "F8FAFC",
  pastelBgHex: "#F8FAFC",
  pastelText: "94A3B8",
  pastelTextHex: "#94A3B8",
  neon: "#64748B",
  neonGlow: "rgba(100, 116, 139, 0.3)",
  borderHex: "#E2E8F0"
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Obtiene los colores determinísticos de una materia a partir de su nombre.
 */
export function getSubjectColors(materiaNombre?: string): SubjectColor {
  if (!materiaNombre || materiaNombre.trim().toLowerCase() === "libre" || materiaNombre.trim() === "—" || materiaNombre.trim() === "") {
    return COLOR_LIBRE;
  }
  const clean = materiaNombre.trim().toLowerCase();
  const index = hashString(clean) % PALETTE_SUBJECTS.length;
  const p = PALETTE_SUBJECTS[index];
  return {
    pastelBg: p.pastelBg,
    pastelBgHex: `#${p.pastelBg}`,
    pastelText: p.pastelText,
    pastelTextHex: `#${p.pastelText}`,
    neon: p.neon,
    neonGlow: `${p.neon}80`,
    borderHex: p.border
  };
}
