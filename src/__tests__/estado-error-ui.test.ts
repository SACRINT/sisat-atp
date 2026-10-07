import { describe, it, expect } from "vitest";

// Función extractora que replica la lógica exacta de badges de ListadoEscuelas y ListadoProgramas
function calcularBadgePredictamen(r: any): string {
    if (!r || !r.tipo) return "Pendiente";
    const isAiType = r.tipo === "PMC" || r.tipo === "PAEC" || r.tipo === "INFORME_FINAL" || r.tipo === "PIPS";
    if (r.error || r.errorConexo || r.tipo === "OTROS" || (isAiType && !r.borradorCorreo && !r.reporteMarkdown)) {
        return "⚠️ Error (Re-evaluar)";
    }
    if (r.tieneIncidencias) return "⚠️ Con Incidencias";
    if (r.aprobado === false) return "⚠️ Firma/Sello Faltante";
    return "✓ Correcto";
}

function calcularEstilosPredictamen(r: any): { bg: string; color: string; border: string } {
    if (!r || !r.tipo) return { bg: "#f8fafc", color: "#64748b", border: "1px solid #cbd5e1" };
    const isAiType = r.tipo === "PMC" || r.tipo === "PAEC" || r.tipo === "INFORME_FINAL" || r.tipo === "PIPS";
    const isError = Boolean(r.error || r.errorConexo || r.tipo === "OTROS" || (isAiType && !r.borradorCorreo && !r.reporteMarkdown));
    const isWarnOrError = Boolean(r.tieneIncidencias || r.aprobado === false || isError);

    return {
        bg: isWarnOrError ? "#fdf2f2" : "#f0fdf4",
        color: isWarnOrError ? "#dc2626" : "#16a34a",
        border: `1px solid ${isWarnOrError ? "#f87171" : "#86efac"}`
    };
}

describe("Cálculo de Badge de Pre-dictamen en UI", () => {
    it("debe retornar '⚠️ Error (Re-evaluar)' y color rojo cuando tipo es OTROS con error", () => {
        const errorResult = {
            tipo: "OTROS",
            error: "Error crítico al analizar el documento con IA",
            detalle: "Failed to download file from Cloudinary (status 401)"
        };

        expect(calcularBadgePredictamen(errorResult)).toBe("⚠️ Error (Re-evaluar)");
        const estilos = calcularEstilosPredictamen(errorResult);
        expect(estilos.bg).toBe("#fdf2f2");
        expect(estilos.color).toBe("#dc2626");
    });

    it("debe retornar '⚠️ Error (Re-evaluar)' cuando existe errorConexo", () => {
        const conexoResult = {
            tipo: "PMC",
            errorConexo: true,
            error: "Timeout en llamada conexa"
        };

        expect(calcularBadgePredictamen(conexoResult)).toBe("⚠️ Error (Re-evaluar)");
    });

    it("debe retornar '⚠️ Con Incidencias' cuando tieneIncidencias es true", () => {
        const incResult = {
            tipo: "PMC",
            tieneIncidencias: true,
            aprobado: true,
            borradorCorreo: "Estimado director..."
        };

        expect(calcularBadgePredictamen(incResult)).toBe("⚠️ Con Incidencias");
    });

    it("debe retornar '✓ Correcto' en verde únicamente si la entrega es válida y aprobada", () => {
        const validResult = {
            tipo: "PMC",
            aprobado: true,
            tieneIncidencias: false,
            borradorCorreo: "Dictamen favorable..."
        };

        expect(calcularBadgePredictamen(validResult)).toBe("✓ Correcto");
        const estilos = calcularEstilosPredictamen(validResult);
        expect(estilos.bg).toBe("#f0fdf4");
        expect(estilos.color).toBe("#16a34a");
    });
});
