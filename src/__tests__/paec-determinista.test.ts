import { describe, it, expect } from "vitest";
import { auditarPaecDeterminista, CRITERIOS_PAEC } from "../lib/quality-gates/paec-evaluator";

describe("Motor Determinista PAEC (auditarPaecDeterminista)", () => {
    it("debe calificar 25% (23/92 pts) y estatus fail para texto vacío", () => {
        const audit = auditarPaecDeterminista("", "Plantel Muestra", "21EBH0001X");
        expect(audit.totalRawScore).toBe(23);
        const percentage = Math.round((audit.totalRawScore / (23 * 4)) * 100);
        expect(percentage).toBe(25);
        expect(percentage).toBeLessThan(70);

        for (const crit of CRITERIOS_PAEC) {
            const check = audit.checks[crit.id];
            expect(check).toBeDefined();
            expect(check.status).toBe("fail");
            expect(check.score).toBe(1);
        }
    });

    it("debe calificar 25% (23/92 pts) con texto lorem ipsum sin elementos normativos", () => {
        const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero.";
        const audit = auditarPaecDeterminista(lorem, "Plantel Muestra", "21EBH0001X");
        expect(audit.totalRawScore).toBe(23);
        const percentage = Math.round((audit.totalRawScore / (23 * 4)) * 100);
        expect(percentage).toBeLessThan(70);
    });

    it("debe evaluar positivamente criterios que contienen evidencia formal en PAEC", () => {
        const validText = `
            PROYECTO ESCOLAR COMUNITARIO (PAEC-PEC)
            C1: Población y comunidad con datos del INEGI y censo del municipio.
            C2: Indicadores cuantitativos del plantel: matrícula 150 alumnos, reprobación 8%, abandono 2%, eficiencia terminal 90%.
            C3: Matriz FODA: fortaleza, oportunidad, debilidad y amenaza en 4 cuadrantes.
            C4: Jerarquización y deliberación colegiada de la problemática seleccionada.
            C5: Introducción y justificación situada en la realidad comunitaria... ${"misión y propósito institucional transformador ".repeat(300)}
            C6: Nueva Escuela Mexicana con principios de la NEM y ejes articuladores.
            C7: Magnitud, factibilidad, pertinencia y viabilidad social conforme a la DBEPA.
            C8: Recursos sociocognitivos, áreas de conocimiento y UAC asignaturas vinculadas.
            C9: Marco Curricular Común de la Educación Media Superior MCCEMS y rediseño curricular con progresión.
            C10: Vinculación curricular con aportes específicos y entregables definidos por UAC.
            C11: Fase bimestral con cronograma en 6 bimestres normativos y etapas calendarizadas.
            C12: Asignatura viga maestra o disciplina eje articulador con liderazgo técnico docente.
            C13: Progresiones de aprendizaje articuladas a los propósitos pedagógicos del proyecto.
            C14: Articulación con UAC y correspondencia formal entre fases del proyecto y asignaturas.
            C15: Semestre A con planeación semanal dosificada y responsabilidades.
            C16: Semestre B con planeación semanal dosificada y responsabilidades.
            C17: Semana 16 con feria de resultados comunitaria e hito de cierre institucional.
            C18: Metodologías activas sociocríticas: ABPC, STEAM y Aprendizaje Servicio.
            C19: Carta de compromiso, minuta de arranque y acta de acuerdos formalizada.
            C20: Bitácora de seguimiento, instrumentos de evaluación y rúbrica técnica.
            C21: Comité escolar de gobernanza comunitaria en 4 niveles y academia docente.
            C22: Rendición de cuentas institucional, metas vs logros e impacto comunitario.
            C23: Sostenibilidad del proyecto y custodia comunitaria para la permanencia institucional.
        `;

        const audit = auditarPaecDeterminista(validText, "PLANTEL EJEMPLAR", "21EBH9999Z");
        expect(audit.totalRawScore).toBeGreaterThanOrEqual(80);
        expect(audit.checks["C1"].score).toBe(4);
        expect(audit.checks["C2"].score).toBe(4);
        expect(audit.checks["C3"].score).toBe(4);
        expect(audit.checks["C6"].score).toBe(4);
        expect(audit.checks["C17"].score).toBe(4);
        expect(audit.checks["C18"].score).toBe(4);
    });
});
