import { describe, it, expect } from "vitest";
import { auditarPmcDeterminista, CRITERIOS_PMC } from "../lib/quality-gates/pmc-evaluator";

describe("Motor Determinista PMC (auditarPmcDeterminista)", () => {
    it("debe calificar 0% y estatus fail para todos los criterios con texto vacío", () => {
        const audit = auditarPmcDeterminista("", "Plantel Muestra", "21EBH0001X");
        expect(audit.totalScore).toBe(0);
        for (const crit of CRITERIOS_PMC) {
            const check = audit.checks[crit.id];
            expect(check).toBeDefined();
            expect(check.status).toBe("fail");
            expect(check.score).toBe(0);
        }
    });

    it("debe calificar 0% para texto genérico o lorem ipsum sin elementos normativos", () => {
        const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.";
        const audit = auditarPmcDeterminista(lorem, "Plantel Muestra", "21EBH0001X");
        expect(audit.totalScore).toBe(0);
        expect(audit.totalScore / 100).toBeLessThan(0.5);
    });

    it("debe identificar CCT, ciclo escolar y figuras educativas en texto institucional", () => {
        const sampleText = `
            GOBIERNO DEL ESTADO DE PUEBLA
            SECRETARÍA DE EDUCACIÓN PÚBLICA
            PROGRAMA DE MEJORA CONTINUA (PMC) CICLO ESCOLAR 2025-2026
            PLANTEL: BACHILLERATO GENERAL MOISÉS SÁENZ GARZA
            CCT OFICIAL: 21EBH0465E
            PLANTILLA DOCENTE Y ADMINISTRATIVA:
            Director, Subdirector, Docente 1, Docente 2, Profesor de matemáticas, Personal administrativo, Academia colegiada, Colectivo escolar.
            INDICADORES ACADÉMICOS Y LÍNEA BASE:
            Matrícula total: 150 alumnos. Aprobación: 88.5%. Reprobación: 11.5%. Abandono escolar: 3.2%. Eficiencia terminal: 85.0%.
            DIAGNÓSTICO SOCIOEDUCATIVO Y CONTEXTO TERRITORIAL:
            El entorno comunitario y territorial del plantel presenta características semiurbanas... ${"contexto amplio ".repeat(400)}
            MATRIZ FODA:
            Fortaleza: Colectivo comprometido. Oportunidad: Alianzas comunitarias. Debilidad: Infraestructura. Amenaza: Factores climáticos.
            CATEGORÍAS Y ÁMBITOS:
            Apropiación curricular, permanencia y gestión comunitaria en el Cuadro 2... ${"categoría ámbito ".repeat(300)}
            PRESENTACIÓN Y ARTICULACIÓN INSTITUCIONAL:
            Introducción, justificación y objetivo general institucional... ${"narrativa institucional articulada ".repeat(400)}
            METAS CREAA:
            Meta 1: Incrementar en 5% la retención escolar para el ciclo 2025-2026.
            Meta 2: Reducir en 3% la reprobación durante el ciclo escolar 2025-2026.
            PLAN DE ACCIÓN:
            Plan de acción calendarizado con cronograma de actividades y responsable asignado para cada sesión.
            CORRESPONSABILIDAD DEL PERSONAL:
            Compromisos de corresponsabilidad docente y metas del personal escolar... ${"corresponsabilidad y metas de la plantilla docente ".repeat(400)}
        `;

        const audit = auditarPmcDeterminista(sampleText, "MOISÉS SÁENZ GARZA", "21EBH0465E");
        expect(audit.totalScore).toBeGreaterThanOrEqual(85);
        expect(audit.checks["C1"].status).toBe("pass");
        expect(audit.checks["C2"].status).toBe("pass");
        expect(audit.checks["C3"].status).toBe("pass");
        expect(audit.checks["C5"].status).toBe("pass");
        expect(audit.checks["C8"].status).toBe("pass");
    });
});
