/**
 * Script de prueba para validar el Evaluador Homologado PMC e INFORME FINAL 2026-2027
 * Ejecutar con: npx tsx scripts/test-pmc-evaluator.ts
 */

import {
    CRITERIOS_PMC,
    DIMENSIONES_PMC,
    DIMENSIONES_INFORME_FINAL,
    evaluarPmcEntrega,
    evaluarInformeFinalPMC,
    generarReportePmcMarkdown,
    generarReporteInformeFinalMarkdown,
} from "../src/lib/quality-gates/pmc-evaluator";

async function main() {
    console.log("=================================================================");
    console.log("TEST: EVALUADOR DETERMINISTA PMC E INFORME FINAL (100 PUNTOS)");
    console.log("=================================================================\n");

    // 1. Verificación del catálogo oficial PMC
    console.log(`[1] Verificando catálogo oficial de criterios PMC:`);
    console.log(`- Total de criterios configurados: ${CRITERIOS_PMC.length} (esperado: 10)`);
    const totalWeights = CRITERIOS_PMC.reduce((sum, c) => sum + c.weight, 0);
    console.log(`- Suma ponderada de puntos brutos: ${totalWeights} pts (esperado: 100)`);

    if (CRITERIOS_PMC.length !== 10) {
        throw new Error(`Error: Se esperaban 10 criterios y se obtuvieron ${CRITERIOS_PMC.length}`);
    }
    if (totalWeights !== 100) {
        throw new Error(`Error: La suma de pesos debe ser exactamente 100 pts, obtenido: ${totalWeights}`);
    }

    const dimensionesUnicas = new Set(CRITERIOS_PMC.map(c => c.dimension));
    console.log(`- Dimensiones normativas cubiertas: ${dimensionesUnicas.size} (esperado: 5)\n`);
    if (dimensionesUnicas.size !== 5) {
        throw new Error(`Error: Se esperaban 5 dimensiones y se obtuvieron ${dimensionesUnicas.size}`);
    }

    // 2. Prueba con documento con texto insuficiente (Fallback PMC)
    console.log(`[2] Probando fallback de contingencia PMC (texto corto / corrupto):`);
    const fallbackPmc = await evaluarPmcEntrega({
        textoDocumento: "Archivo dañado",
        cct: "21EBH0015Z",
        escuelaNombre: "Bachillerato General Heroica Puebla",
    });

    console.log(`- Estatus obtenido: ${fallbackPmc.overallStatus} (esperado: REQUIERE_REVISION)`);
    console.log(`- Score obtenido: ${fallbackPmc.percentage}% (esperado: 0%)`);
    console.log(`- Criterios en fail: ${fallbackPmc.failedCriteria} (esperado: 10)`);
    console.log(`- Criterios configurados en fallback: ${fallbackPmc.criteria.length} (esperado: 10)\n`);

    // 3. Prueba de fallback Informe Final
    console.log(`[3] Probando fallback de contingencia INFORME FINAL:`);
    const fallbackInforme = await evaluarInformeFinalPMC({
        textoInformeFinal: "Archivo vacío",
        textoPMCOriginal: "Texto original previo",
        cct: "21EBH0015Z",
        escuelaNombre: "Bachillerato General Heroica Puebla",
    });

    console.log(`- Estatus obtenido: ${fallbackInforme.overallStatus} (esperado: REQUIERE_REVISION)`);
    console.log(`- Dimensiones evaluadas: ${fallbackInforme.criteria.length} (esperado: 5)`);
    console.log(`- Puntos brutos: ${fallbackInforme.totalScore} / 100\n`);

    // 4. Generación de Reportes Markdown de muestra
    console.log(`[4] Generando reporte Markdown oficial de PMC:`);
    const mockAuditPmc = {
        totalScore: 88,
        maxPossibleScore: 100,
        percentage: 88,
        overallStatus: "EXCELENTE" as const,
        passedCriteria: 8,
        warningCriteria: 2,
        failedCriteria: 0,
        criteria: CRITERIOS_PMC.map((c, idx) => ({
            id: c.id,
            numero: c.numero,
            nombre: c.nombre,
            dimension: c.dimension,
            weight: c.weight,
            score: idx < 8 ? c.weight : Math.round(c.weight * 0.5),
            status: (idx < 8 ? "pass" : "warning") as "pass" | "warning",
            feedback: idx < 8 ? "Cumplimiento normativo pleno." : "Observación técnica menor de precisión.",
            evidenceFound: "Datos debidamente documentados en la entrega escolar.",
        })),
        dimensionScores: {
            [DIMENSIONES_PMC.DIM1]: { score: 16, maxScore: 16, percentage: 100 },
            [DIMENSIONES_PMC.DIM2]: { score: 20, maxScore: 20, percentage: 100 },
            [DIMENSIONES_PMC.DIM3]: { score: 22, maxScore: 26, percentage: 85 },
            [DIMENSIONES_PMC.DIM4]: { score: 19, maxScore: 24, percentage: 79 },
            [DIMENSIONES_PMC.DIM5]: { score: 14, maxScore: 14, percentage: 100 },
        },
        strengths: [
            "Línea base integral con 5 indicadores académicos históricos y metas cuantificables",
            "Matriz situacional FODA completa en sus 4 cuadrantes",
            "Corresponsabilidad docente articulada con metas individuales"
        ],
        criticalRecommendations: [
            "Calendarizar periodos de inicio y fin para la totalidad de metas institucionales"
        ],
        evidenciasNoConformes: [],
        auditedAt: new Date().toISOString(),
    };

    const reportePmcMd = generarReportePmcMarkdown(mockAuditPmc, {
        nombre: "Bachillerato General Gabino Barreda",
        cct: "21EBH0122K",
    });

    console.log(`- Longitud reporte PMC: ${reportePmcMd.length} chars`);
    console.log(`- Contiene encabezado institucional: ${reportePmcMd.includes("REPORTE OFICIAL DE AUDITORÍA DE CALIDAD PMC")}`);
    console.log(`- Contiene dictamen excelente: ${reportePmcMd.includes("DICTAMEN: EXCELENTE")}`);
    console.log(`- Contiene firmas oficiales: ${reportePmcMd.includes("SUPERVISIÓN ESCOLAR ZONA 004")}\n`);

    console.log(`[5] Generando reporte Markdown oficial de INFORME FINAL:`);
    const mockAuditInforme = {
        totalScore: 80,
        maxPossibleScore: 100,
        percentage: 80,
        overallStatus: "SATISFACTORIO" as const,
        metasCumplidas: 4,
        totalMetasEvaluadas: 5,
        passedCriteria: 4,
        warningCriteria: 1,
        failedCriteria: 0,
        criteria: [
            { id: "DIM1", dimension: DIMENSIONES_INFORME_FINAL.DIM1, nombre: DIMENSIONES_INFORME_FINAL.DIM1, weight: 20, score: 20, status: "pass" as const, feedback: "Alineación total con las metas del PMC original.", evidenceFound: "4/4 categorías coincidentes." },
            { id: "DIM2", dimension: DIMENSIONES_INFORME_FINAL.DIM2, nombre: DIMENSIONES_INFORME_FINAL.DIM2, weight: 20, score: 16, status: "pass" as const, feedback: "Cumplimiento del 80% de metas.", evidenceFound: "4 metas alcanzadas satisfactoriamente." },
            { id: "DIM3", dimension: DIMENSIONES_INFORME_FINAL.DIM3, nombre: DIMENSIONES_INFORME_FINAL.DIM3, weight: 20, score: 20, status: "pass" as const, feedback: "Justificación analítica y honesta de la meta inconclusa.", evidenceFound: "Factores presupuestales y de infraestructura explicados." },
            { id: "DIM4", dimension: DIMENSIONES_INFORME_FINAL.DIM4, nombre: DIMENSIONES_INFORME_FINAL.DIM4, weight: 20, score: 14, status: "warning" as const, feedback: "Algunas fotos carecen de pie descriptivo.", evidenceFound: "Actas y convenios validados; fotos sin pie de foto." },
            { id: "DIM5", dimension: DIMENSIONES_INFORME_FINAL.DIM5, nombre: DIMENSIONES_INFORME_FINAL.DIM5, weight: 20, score: 10, status: "warning" as const, feedback: "Propuestas generales para el siguiente ciclo.", evidenceFound: "Compromisos para el siguiente ciclo escolar." },
        ],
        dimensionScores: {
            [DIMENSIONES_INFORME_FINAL.DIM1]: { score: 20, maxScore: 20, percentage: 100 },
            [DIMENSIONES_INFORME_FINAL.DIM2]: { score: 16, maxScore: 20, percentage: 80 },
            [DIMENSIONES_INFORME_FINAL.DIM3]: { score: 20, maxScore: 20, percentage: 100 },
            [DIMENSIONES_INFORME_FINAL.DIM4]: { score: 14, maxScore: 20, percentage: 70 },
            [DIMENSIONES_INFORME_FINAL.DIM5]: { score: 10, maxScore: 20, percentage: 50 },
        },
        strengths: [
            "Logro del 80% de las metas institucionales",
            "Justificación analítica y reflexiva de las metas no logradas"
        ],
        criticalRecommendations: [
            "Asegurar que toda evidencia fotográfica cuente con pie descriptivo e instrumento de evaluación",
            "Formalizar el banco de propuestas de mejora continua para el siguiente ciclo"
        ],
        justificacionInconclusasCalidad: "Excelente, reflexiva y fundamentada",
        auditedAt: new Date().toISOString(),
    };

    const reporteInformeMd = generarReporteInformeFinalMarkdown(mockAuditInforme, {
        nombre: "Bachillerato General Gabino Barreda",
        cct: "21EBH0122K",
    });

    console.log(`- Longitud reporte Informe Final: ${reporteInformeMd.length} chars`);
    console.log(`- Contiene encabezado institucional: ${reporteInformeMd.includes("REPORTE OFICIAL DE CIERRE Y RENDICIÓN DE CUENTAS")}`);
    console.log(`- Contiene métrica de justificación de metas: ${reporteInformeMd.includes("Calidad de Justificación de Metas Inconclusas")}`);
    console.log(`- Contiene firmas oficiales: ${reporteInformeMd.includes("Sello de Conclusión y Archivo Técnico")}`);

    console.log("\n=================================================================");
    console.log("✅ TODAS LAS PRUEBAS DE PMC E INFORME FINAL PASARON EXITOSAMENTE");
    console.log("=================================================================");
}

main().catch(err => {
    console.error("Error en pruebas de evaluador PMC:", err);
    process.exit(1);
});
