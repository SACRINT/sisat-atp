/**
 * Helper centralizado para cálculo de pre-dictamen y estilos de badges
 * Utilizado por ListadoEscuelas, ListadoProgramas y suite de pruebas Vitest.
 */

export interface PreRevisionResultadoPersistida {
    tipo?: string;
    aprobado?: boolean;
    error?: string;
    errorConexo?: boolean;
    estadoError?: string;
    tieneIncidencias?: boolean;
    borradorCorreo?: string;
    reporteMarkdown?: string;
    puntuacion?: string;
    explicacion?: string;
    detalle?: string;
    scoreNumerico?: number;
    totalPuntosBrutos?: string;
    estatusOficial?: string;
    resultadoPrevia?: unknown;
    actualizadoEn?: string;
    [key: string]: unknown;
}

export interface BadgeDictamenInfo {
    texto: string;
    bg: string;
    color: string;
    border: string;
}

export function calcularBadgePreDictamen(
    r?: PreRevisionResultadoPersistida | null
): BadgeDictamenInfo {
    if (!r || !r.tipo) {
        return {
            texto: "Pendiente",
            bg: "#f8fafc",
            color: "#64748b",
            border: "1px solid #cbd5e1"
        };
    }

    const isAiType =
        r.tipo === "PMC" ||
        r.tipo === "PAEC" ||
        r.tipo === "INFORME_FINAL" ||
        r.tipo === "PIPS";

    const isError = Boolean(
        r.error ||
        r.errorConexo ||
        r.tipo === "OTROS" ||
        (isAiType && !r.borradorCorreo)
    );

    let texto = "✓ Correcto";
    if (isError) {
        texto = "⚠️ Error (Re-evaluar)";
    } else if (r.tieneIncidencias) {
        texto = "⚠️ Con Incidencias";
    } else if (r.aprobado === false) {
        texto = "⚠️ Firma/Sello Faltante";
    }

    const hasProblem = Boolean(r.tieneIncidencias || r.aprobado === false || isError);

    return {
        texto,
        bg: hasProblem ? "#fdf2f2" : "#f0fdf4",
        color: hasProblem ? "#dc2626" : "#16a34a",
        border: `1px solid ${hasProblem ? "#f87171" : "#86efac"}`
    };
}
