import { describe, it, expect } from "vitest";
import {
    calcularBadgePreDictamen,
    calcularPillDirector,
    calcularHasErrorAdmin,
    PreRevisionResultadoPersistida
} from "../lib/pre-revision-badge";

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

describe("Cálculo de Píldora de Autoevaluación en Vista Director (T1 / H-1)", () => {
    it("con fixture {tipo:'PMC', aprobado:true, puntuacion:'65%', errorConexo:true} el texto del pill NO es 'Aprobado'", () => {
        const fixture: PreRevisionResultadoPersistida = {
            tipo: "PMC",
            aprobado: true,
            puntuacion: "65%",
            errorConexo: true
        };

        const pill = calcularPillDirector(fixture);
        expect(pill.isApproved).toBe(false);
        expect(pill.texto).not.toContain("· Aprobado");
        expect(pill.texto).toBe("Puntuación: 65% · Preliminar (IA no disponible)");
        expect(pill.bg).toBe("#fef3c7");
        expect(pill.color).toBe("#b45309");
    });

    it("debe marcar isApproved: true y color verde si la autoevaluación fue exitosa y sin error", () => {
        const fixture: PreRevisionResultadoPersistida = {
            tipo: "PMC",
            aprobado: true,
            puntuacion: "95%",
            errorConexo: false
        };

        const pill = calcularPillDirector(fixture);
        expect(pill.isApproved).toBe(true);
        expect(pill.texto).toBe("Puntuación: 95% · Aprobado");
        expect(pill.bg).toBe("#dcfce7");
        expect(pill.color).toBe("#15803d");
    });

    it("debe marcar isApproved: false y 'Requiere Ajustes' si el puntaje no alcanzó aprobación", () => {
        const fixture: PreRevisionResultadoPersistida = {
            tipo: "PMC",
            aprobado: false,
            puntuacion: "45%"
        };

        const pill = calcularPillDirector(fixture);
        expect(pill.isApproved).toBe(false);
        expect(pill.texto).toBe("Puntuación: 45% · Requiere Ajustes");
        expect(pill.bg).toBe("#fee2e2");
        expect(pill.color).toBe("#b91c1c");
    });
});

describe("Aviso de Falla en Panel de Administración (T2 / H-2)", () => {
    it("debe activar hasError cuando existe errorConexo o error explícito", () => {
        expect(calcularHasErrorAdmin({ errorConexo: true, borradorCorreo: "algo" })).toBe(true);
        expect(calcularHasErrorAdmin({ error: "Fallo IA", borradorCorreo: "algo" })).toBe(true);
    });

    it("debe activar hasError cuando la descarga falló o no existe borradorCorreo", () => {
        expect(calcularHasErrorAdmin({ explicacion: "Failed to download file", borradorCorreo: "algo" })).toBe(true);
        expect(calcularHasErrorAdmin({ borradorCorreo: "" })).toBe(true);
        expect(calcularHasErrorAdmin({})).toBe(true);
    });

    it("debe retornar hasError: false para una evaluación completa sin errores", () => {
        expect(calcularHasErrorAdmin({
            tipo: "PMC",
            aprobado: true,
            borradorCorreo: "Evaluación favorable..."
        })).toBe(false);
    });
});

