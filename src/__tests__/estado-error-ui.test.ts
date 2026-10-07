import { describe, it, expect } from "vitest";
import { calcularBadgePreDictamen, PreRevisionResultadoPersistida } from "../lib/pre-revision-badge";

describe("Cálculo de Badge de Pre-dictamen en UI", () => {
    it("debe retornar '⚠️ Error (Re-evaluar)' y color rojo cuando tipo es OTROS con error", () => {
        const errorResult: PreRevisionResultadoPersistida = {
            tipo: "OTROS",
            error: "Error crítico al analizar el documento con IA",
            detalle: "Failed to download file from Cloudinary (status 401)"
        };

        const badge = calcularBadgePreDictamen(errorResult);
        expect(badge.texto).toBe("⚠️ Error (Re-evaluar)");
        expect(badge.bg).toBe("#fdf2f2");
        expect(badge.color).toBe("#dc2626");
    });

    it("debe retornar '⚠️ Error (Re-evaluar)' cuando existe errorConexo", () => {
        const conexoResult: PreRevisionResultadoPersistida = {
            tipo: "PMC",
            errorConexo: true,
            error: "Timeout en llamada conexa"
        };

        const badge = calcularBadgePreDictamen(conexoResult);
        expect(badge.texto).toBe("⚠️ Error (Re-evaluar)");
        expect(badge.bg).toBe("#fdf2f2");
        expect(badge.color).toBe("#dc2626");
    });

    it("debe retornar '⚠️ Con Incidencias' cuando tieneIncidencias es true", () => {
        const incResult: PreRevisionResultadoPersistida = {
            tipo: "PMC",
            tieneIncidencias: true,
            aprobado: true,
            borradorCorreo: "Estimado director..."
        };

        const badge = calcularBadgePreDictamen(incResult);
        expect(badge.texto).toBe("⚠️ Con Incidencias");
        expect(badge.bg).toBe("#fdf2f2");
    });

    it("debe retornar '✓ Correcto' en verde únicamente si la entrega es válida y aprobada", () => {
        const validResult: PreRevisionResultadoPersistida = {
            tipo: "PMC",
            aprobado: true,
            tieneIncidencias: false,
            borradorCorreo: "Dictamen favorable..."
        };

        const badge = calcularBadgePreDictamen(validResult);
        expect(badge.texto).toBe("✓ Correcto");
        expect(badge.bg).toBe("#f0fdf4");
        expect(badge.color).toBe("#16a34a");
    });
});
