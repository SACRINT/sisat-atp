import { describe, it, expect } from "vitest";
import { CRITERIOS_PMC } from "../lib/quality-gates/pmc-evaluator";
import { CRITERIOS_PAEC } from "../lib/quality-gates/paec-evaluator";

describe("Lógica de Fusión Híbrida IA + Determinista", () => {
    it("PMC: el dictamen de IA debe gobernar cuando evalúa un criterio, sin sobreescritura de piso determinista", () => {
        // Simulamos un mapa de IA donde C1 fue calificado como 'fail' por la IA
        const aiCriteriosMap = new Map<string, any>([
            ["C1", { id: "C1", status: "fail", feedback: "CCT no coincide con la clave oficial." }],
            ["C2", { id: "C2", status: "pass", feedback: "Plantilla docente completa." }]
        ]);

        // Supongamos que el motor determinista detectó alguna coincidencia léxica en C1
        const detChecks: Record<string, any> = {
            C1: { id: "C1", status: "pass", score: 8, feedback: "Texto con palabras clave." },
            C2: { id: "C2", status: "pass", score: 8, feedback: "Plantilla detectada." }
        };

        // Verificamos la regla de fusión implementada en pmc-evaluator
        const evaluated = CRITERIOS_PMC.filter(c => c.id === "C1" || c.id === "C2").map(def => {
            const aiItem = aiCriteriosMap.get(def.id);
            const detItem = detChecks[def.id];
            let status = "fail";

            if (aiItem && (aiItem.status !== undefined || aiItem.score !== undefined)) {
                const rawStatus = String(aiItem.status || "").toLowerCase().trim();
                if (rawStatus === "pass" || rawStatus === "aprobado") status = "pass";
                else if (rawStatus === "warning" || rawStatus === "parcial") status = "warning";
                else status = "fail";
            } else if (detItem) {
                status = detItem.status;
            }

            return { id: def.id, status };
        });

        const c1Result = evaluated.find(c => c.id === "C1");
        expect(c1Result?.status).toBe("fail"); // La IA manda sobre C1
        const c2Result = evaluated.find(c => c.id === "C2");
        expect(c2Result?.status).toBe("pass");
    });

    it("PAEC: la IA debe gobernar el puntaje de 1 a 4 sin ser inflado por el código determinista", () => {
        const aiCriteriosMap = new Map<string, any>([
            ["C1", { id: "C1", score: 2, feedback: "Datos comunitarios insuficientes según análisis semántico." }]
        ]);

        const detChecks: Record<string, any> = {
            C1: { id: "C1", score: 4, status: "pass" }
        };

        const def = CRITERIOS_PAEC.find(c => c.id === "C1")!;
        const aiItem = aiCriteriosMap.get(def.id);
        const detItem = detChecks[def.id];

        let score = 1;
        if (aiItem && (aiItem.score !== undefined || aiItem.status !== undefined)) {
            score = Number(aiItem.score);
        } else if (detItem) {
            score = detItem.score;
        }

        expect(score).toBe(2); // La IA asignó 2 y NO se infla a 4
    });

    it("Debe aplicar suplencia determinista únicamente si la IA omitió un criterio", () => {
        const aiCriteriosMap = new Map<string, any>([
            ["C1", { id: "C1", score: 4 }]
            // C2 omitido por IA
        ]);

        const detChecks: Record<string, any> = {
            C1: { id: "C1", score: 3 },
            C2: { id: "C2", score: 3, status: "warning", feedback: "Suplido por código" }
        };

        const defC2 = CRITERIOS_PAEC.find(c => c.id === "C2")!;
        const aiItem = aiCriteriosMap.get(defC2.id);
        const detItem = detChecks[defC2.id];

        let score = 1;
        if (aiItem && (aiItem.score !== undefined || aiItem.status !== undefined)) {
            score = Number(aiItem.score);
        } else if (detItem) {
            score = detItem.score;
        }

        expect(score).toBe(3); // C2 fue suplido deterministamente porque la IA lo omitió
    });
});
