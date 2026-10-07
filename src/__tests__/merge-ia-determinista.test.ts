import { describe, it, expect } from "vitest";
import {
    CRITERIOS_PMC,
    fusionarCriterioPMC,
    RawAiCriterio,
    DeterministicPmcCheck
} from "../lib/quality-gates/pmc-evaluator";
import {
    CRITERIOS_PAEC,
    fusionarCriterioPAEC,
    RawPaecAiCriterio,
    DeterministicPaecCheck as DeterministicPaecCheckType
} from "../lib/quality-gates/paec-evaluator";

describe("Lógica de Fusión Híbrida IA + Determinista", () => {
    it("PMC: el dictamen de IA debe gobernar cuando evalúa un criterio, sin sobreescritura de piso determinista", () => {
        // Simulamos un mapa de IA donde C1 fue calificado como 'fail' por la IA
        const aiCriteriosMap = new Map<string, RawAiCriterio>([
            ["C1", { id: "C1", status: "fail", feedback: "CCT no coincide con la clave oficial." }],
            ["C2", { id: "C2", status: "pass", feedback: "Plantilla docente completa." }]
        ]);

        // Supongamos que el motor determinista detectó alguna coincidencia léxica en C1
        const detChecks: Record<string, DeterministicPmcCheck> = {
            C1: { id: "C1", status: "pass", score: 8, feedback: "Texto con palabras clave.", evidence: "CCT detectado" },
            C2: { id: "C2", status: "pass", score: 8, feedback: "Plantilla detectada.", evidence: "Docentes detectados" }
        };

        // Verificamos usando la función de producción real fusionarCriterioPMC
        const defC1 = CRITERIOS_PMC.find(c => c.id === "C1")!;
        const c1Merged = fusionarCriterioPMC(defC1, aiCriteriosMap.get("C1"), detChecks["C1"]);
        expect(c1Merged.status).toBe("fail"); // La IA manda sobre C1
        expect(c1Merged.score).toBe(0);

        const defC2 = CRITERIOS_PMC.find(c => c.id === "C2")!;
        const c2Merged = fusionarCriterioPMC(defC2, aiCriteriosMap.get("C2"), detChecks["C2"]);
        expect(c2Merged.status).toBe("pass");
        expect(c2Merged.score).toBe(defC2.weight);
    });

    it("PAEC: la IA debe gobernar el puntaje de 1 a 4 sin ser inflado por el código determinista", () => {
        const aiCriteriosMap = new Map<string, RawPaecAiCriterio>([
            ["C1", { id: "C1", score: 2, feedback: "Datos comunitarios insuficientes según análisis semántico." }]
        ]);

        const detChecks: Record<string, DeterministicPaecCheckType> = {
            C1: { id: "C1", score: 4, status: "pass", evidence: "INEGI encontrado", feedback: "Datos duros" }
        };

        const def = CRITERIOS_PAEC.find(c => c.id === "C1")!;
        const merged = fusionarCriterioPAEC(def, aiCriteriosMap.get("C1"), detChecks["C1"]);

        expect(merged.score).toBe(2); // La IA asignó 2 y NO se infla a 4
        expect(merged.status).toBe("warning");
    });

    it("Debe aplicar suplencia determinista únicamente si la IA omitió un criterio", () => {
        const aiCriteriosMap = new Map<string, RawPaecAiCriterio>([
            ["C1", { id: "C1", score: 4 }]
            // C2 omitido por IA
        ]);

        const detChecks: Record<string, DeterministicPaecCheckType> = {
            C1: { id: "C1", score: 3, status: "warning", evidence: "Parcial", feedback: "Observación" },
            C2: { id: "C2", score: 3, status: "warning", evidence: "Evidencia de código", feedback: "Suplido por código" }
        };

        const defC2 = CRITERIOS_PAEC.find(c => c.id === "C2")!;
        const c2Merged = fusionarCriterioPAEC(defC2, aiCriteriosMap.get(defC2.id), detChecks[defC2.id]);

        expect(c2Merged.score).toBe(3); // C2 fue suplido deterministamente porque la IA lo omitió
        expect(c2Merged.status).toBe("warning");
        expect(c2Merged.feedback).toBe("Suplido por código");
    });
});
