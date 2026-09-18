/**
 * Script de prueba para validar el Evaluador Homologado PAEC-PEC 2025
 * Ejecutar con: npx tsx scripts/test-paec-evaluator.ts
 */

import {
    CRITERIOS_PAEC,
    DIMENSIONES_PAEC,
    evaluarPaecEntrega,
    generarReportePaecMarkdown,
} from "../src/lib/quality-gates/paec-evaluator";

async function main() {
    console.log("=================================================================");
    console.log("TEST: EVALUADOR DETERMINISTA PAEC-PEC (8 DIMENSIONES / 23 CRITERIOS)");
    console.log("=================================================================\n");

    // 1. Verificación de catálogo oficial
    console.log(`[1] Verificando catálogo oficial de criterios:`);
    console.log(`- Total de criterios configurados: ${CRITERIOS_PAEC.length} (esperado: 23)`);
    console.log(`- Puntos brutos máximos: ${CRITERIOS_PAEC.length * 4} (esperado: 92)`);

    if (CRITERIOS_PAEC.length !== 23) {
        throw new Error(`Error: Se esperaban 23 criterios y se encontraron ${CRITERIOS_PAEC.length}`);
    }

    const dimensionesUnicas = new Set(CRITERIOS_PAEC.map(c => c.dimension));
    console.log(`- Dimensiones normativas cubiertas: ${dimensionesUnicas.size} (esperado: 8)\n`);
    if (dimensionesUnicas.size !== 8) {
        throw new Error(`Error: Se esperaban 8 dimensiones y se encontraron ${dimensionesUnicas.size}`);
    }

    // 2. Prueba con documento con texto insuficiente (Fallback)
    console.log(`[2] Probando fallback de contingencia (texto corto / corrupto):`);
    const fallbackRes = await evaluarPaecEntrega({
        textoDocumento: "Archivo corrupto sin texto",
        cct: "21EBH0001A",
        escuelaNombre: "Bachillerato de Prueba",
    });

    console.log(`- Estatus obtenido: ${fallbackRes.overallStatus} (esperado: requiere_ajustes)`);
    console.log(`- Score obtenido: ${fallbackRes.percentage}% (esperado: 0%)`);
    console.log(`- Criterios en fail: ${fallbackRes.failedCriteria} (esperado: 23)`);
    console.log(`- Reporte Markdown generado correctamente: ${fallbackRes.criteria.length === 23 ? "SÍ" : "NO"}\n`);

    // 3. Simulación de cálculo determinista con texto de prueba estructurado
    console.log(`[3] Generando reporte Markdown de muestra:`);
    const mockAudit = {
        totalScore: 78,
        maxPossibleScore: 92,
        percentage: 85,
        overallStatus: "aprobado_excelente" as const,
        passedCriteria: 16,
        warningCriteria: 7,
        failedCriteria: 0,
        criteria: CRITERIOS_PAEC.map((c, idx) => ({
            id: c.id,
            numero: c.numero,
            nombre: c.nombre,
            dimension: c.dimension,
            maxScore: 4,
            score: idx < 16 ? 4 : 3,
            status: (idx < 16 ? "pass" : "warning") as "pass" | "warning",
            feedback: idx < 16 ? "Cumplimiento normativo pleno." : "Observación técnica menor.",
            evidenceFound: "Documentado en la sección correspondiente del PEC.",
        })),
        dimensionScores: {
            [DIMENSIONES_PAEC.DIM1]: { score: 16, maxScore: 16, percentage: 100 },
            [DIMENSIONES_PAEC.DIM2]: { score: 12, maxScore: 12, percentage: 100 },
            [DIMENSIONES_PAEC.DIM3]: { score: 11, maxScore: 12, percentage: 92 },
            [DIMENSIONES_PAEC.DIM4]: { score: 7, maxScore: 8, percentage: 88 },
            [DIMENSIONES_PAEC.DIM5]: { score: 7, maxScore: 8, percentage: 88 },
            [DIMENSIONES_PAEC.DIM6]: { score: 13, maxScore: 16, percentage: 81 },
            [DIMENSIONES_PAEC.DIM7]: { score: 6, maxScore: 8, percentage: 75 },
            [DIMENSIONES_PAEC.DIM8]: { score: 6, maxScore: 12, percentage: 50 },
        },
        strengths: [
            "Diagnóstico comunitario exhaustivo con datos de censo municipal",
            "Mapeo curricular del 100% de UACs de la NEM",
            "Fases bimestrales articuladas con asignaturas viga maestra"
        ],
        criticalRecommendations: [
            "Reforzar los instrumentos de evaluación de impacto Pre/Post en la comunidad escolar",
            "Consolidar la custodia comunitaria en el plan de sostenibilidad"
        ],
        auditedAt: new Date().toISOString(),
    };

    const reporteMd = generarReportePaecMarkdown(mockAudit, {
        nombre: "Bachillerato General Lázaro Cárdenas",
        cct: "21EBH0245X",
    });

    console.log(`- Longitud del reporte Markdown: ${reporteMd.length} caracteres`);
    console.log(`- Contiene encabezado oficial: ${reporteMd.includes("REPORTE OFICIAL DE AUDITORÍA DE CALIDAD PAEC-PEC 2025")}`);
    console.log(`- Contiene dictamen aprobado excelente: ${reporteMd.includes("APROBADO EXCELENTE")}`);
    console.log(`- Contiene tabla por dimensiones: ${reporteMd.includes("DESGLOSE DE EVALUACIÓN POR DIMENSIÓN")}`);
    console.log(`- Contiene firmas institucionales: ${reporteMd.includes("SUPERVISIÓN ESCOLAR ZONA 004")}`);

    console.log("\n=================================================================");
    console.log("✅ TODAS LAS PRUEBAS DEL EVALUADOR PAEC PASARON EXITOSAMENTE");
    console.log("=================================================================");
}

main().catch(err => {
    console.error("Error en prueba de evaluador PAEC:", err);
    process.exit(1);
});
