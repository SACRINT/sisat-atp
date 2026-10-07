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
        expect(audit.totalScore).toBeGreaterThanOrEqual(95);
        expect(audit.checks["C1"].status).toBe("pass");
        expect(audit.checks["C2"].status).toBe("pass");
        expect(audit.checks["C3"].status).toBe("pass");
        expect(audit.checks["C5"].status).toBe("pass");
        expect(audit.checks["C8"].status).toBe("pass");
        expect(audit.checks["C8"].score).toBe(14);
        expect(audit.checks["C11"].status).toBe("pass");
        expect(audit.checks["C11"].score).toBe(10);
    });

    it("C11: debe reprobar con 0 pts y registrar evidencia no conforme si contiene SIGPDA o SIGPDA-EMS", () => {
        const textWithForbidden = `
            BACHILLERATO GENERAL OFICIAL
            CCT: 21EBH0465E
            Ciclo escolar 2025-2026
            Director y docentes presentes.
            Matrícula 120 alumnos, aprobación 90%.
            Diagnóstico territorial amplio.
            El documento fue generado con la plataforma SIGPDA-EMS en el módulo SIGPDA.
        `;
        const audit = auditarPmcDeterminista(textWithForbidden, "Plantel", "21EBH0465E");
        expect(audit.checks["C11"]).toBeDefined();
        expect(audit.checks["C11"].status).toBe("fail");
        expect(audit.checks["C11"].score).toBe(0);
        expect(audit.evidenciasNoConformes.length).toBeGreaterThan(0);
        expect(audit.evidenciasNoConformes[0]).toContain("referencias a la plataforma técnica");
    });

    it("C8: debe verificar la fórmula sintáctica CREAA (Verbo + Magnitud % + Temporalidad)", () => {
        // Texto con metas puramente declarativas (sin verbo de acción o sin % o sin ciclo)
        const textMetasPobres = `
            BACHILLERATO GENERAL CCT 21EBH0001X Ciclo 2025-2026
            Director y profesores.
            Meta 1: Queremos que los alumnos estén mejor y más contentos en la escuela.
            Meta 2: Atender a los estudiantes en sus necesidades escolares.
        `;
        const auditPobres = auditarPmcDeterminista(textMetasPobres, "Plantel", "21EBH0001X");
        expect(auditPobres.checks["C8"].status).toBe("warning");
        expect(auditPobres.checks["C8"].score).toBe(7);

        // Texto con metas CREAA estructuradas completas
        const textMetasCreaa = `
            BACHILLERATO GENERAL CCT 21EBH0001X Ciclo 2025-2026
            Director y profesores.
            Meta 1: Incrementar en 8.5% la aprobación escolar para el ciclo 2025-2026.
            Meta 2: Reducir en 4% el abandono escolar durante el ciclo 2025-2026.
        `;
        const auditCreaa = auditarPmcDeterminista(textMetasCreaa, "Plantel", "21EBH0001X");
        expect(auditCreaa.checks["C8"].status).toBe("pass");
        expect(auditCreaa.checks["C8"].score).toBe(14);
    });

    it("Catálogo oficial debe contemplar exactamente 11 criterios que suman 110 puntos", () => {
        expect(CRITERIOS_PMC.length).toBe(11);
        const totalMax = CRITERIOS_PMC.reduce((acc, c) => acc + c.weight, 0);
        expect(totalMax).toBe(110);
    });
});
