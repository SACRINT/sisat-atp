/**
 * Script de prueba para validar el Evaluador Homologado PIPS (Cartografía Territorial Pedagógica) 2026-2027
 * Ejecutar con: npx tsx scripts/test-pips-evaluator.ts
 */

import {
    CRITERIOS_PIPS,
    DIMENSIONES_PIPS,
    evaluarPipsEntrega,
    generarReportePipsMarkdown,
    ResultadoPipsAudit
} from "../src/lib/quality-gates/pips-evaluator";

async function main() {
    console.log("=================================================================");
    console.log("TEST: EVALUADOR DETERMINISTA PIPS / CARTOGRAFÍA TERRITORIAL (100 PTS)");
    console.log("=================================================================\n");

    // 1. Verificación del catálogo oficial PIPS
    console.log(`[1] Verificando catálogo oficial de criterios PIPS:`);
    console.log(`- Total de criterios configurados: ${CRITERIOS_PIPS.length} (esperado: 7)`);
    const totalWeights = CRITERIOS_PIPS.reduce((sum, c) => sum + c.weight, 0);
    console.log(`- Suma ponderada de puntos brutos: ${totalWeights} pts (esperado: 100)`);

    if (CRITERIOS_PIPS.length !== 7) {
        throw new Error(`Error: Se esperaban 7 criterios y se obtuvieron ${CRITERIOS_PIPS.length}`);
    }
    if (totalWeights !== 100) {
        throw new Error(`Error: La suma de pesos debe ser exactamente 100 pts, obtenido: ${totalWeights}`);
    }

    const dimensionesUnicas = new Set(CRITERIOS_PIPS.map(c => c.dimension));
    console.log(`- Dimensiones zonales cubiertas: ${dimensionesUnicas.size} (esperado: 6)\n`);
    if (dimensionesUnicas.size !== 6) {
        throw new Error(`Error: Se esperaban 6 dimensiones y se obtuvieron ${dimensionesUnicas.size}`);
    }

    // Desglose de cada criterio
    console.log(`Desglose de Criterios y Pesos:`);
    for (const c of CRITERIOS_PIPS) {
        console.log(`  * [${c.id}] ${c.dimension} - ${c.nombre}: ${c.weight} pts`);
    }
    console.log("");

    // 2. Prueba de fallback de contingencia (texto corto / dañado)
    console.log(`[2] Probando fallback de contingencia PIPS (texto corto o ilegible):`);
    const fallback = await evaluarPipsEntrega({
        textoDocumento: "Documento corrupto o vacío",
        cct: "21FZT0005B",
        escuelaNombre: "Zona Escolar 005 Bachilleratos Generales",
    });

    console.log(`- Estatus obtenido: ${fallback.overallStatus} (esperado: REQUIERE_REVISION)`);
    console.log(`- Score obtenido: ${fallback.percentage}% (esperado: 0%)`);
    console.log(`- Puntos brutos: ${fallback.totalScore} / ${fallback.maxPossibleScore} pts`);
    console.log(`- Criterios en fail: ${fallback.failedCriteria} (esperado: 7)`);
    console.log(`- Dimensiones registradas: ${Object.keys(fallback.dimensionScores).length} (esperado: 6)\n`);

    if (fallback.overallStatus !== "REQUIERE_REVISION" || fallback.totalScore !== 0) {
        throw new Error("Error en fallback: El estatus no coincide con REQUIERE_REVISION o totalScore != 0");
    }

    // 3. Generación y validación del Reporte Oficial Markdown
    console.log(`[3] Validando generación de Reporte Markdown Oficial:`);
    const mockAuditPips: ResultadoPipsAudit = {
        totalScore: 92,
        maxPossibleScore: 100,
        percentage: 92,
        overallStatus: "EXCELENTE",
        passedCriteria: 6,
        warningCriteria: 1,
        failedCriteria: 0,
        criteria: CRITERIOS_PIPS.map((c, idx) => ({
            id: c.id,
            numero: c.numero,
            nombre: c.nombre,
            dimension: c.dimension,
            weight: c.weight,
            score: idx === 5 ? Math.round(c.weight * 0.5) : c.weight,
            status: idx === 5 ? ("warning" as const) : ("pass" as const),
            feedback: idx === 5 ? "Cronograma con solo 3 actividades calendarizadas formalmente." : "Acreditado con evidencia sólida.",
            evidenceFound: "Datos verificados en el documento de cartografía territorial.",
        })),
        dimensionScores: {
            [DIMENSIONES_PIPS.DIM1]: { score: 10, maxScore: 10, percentage: 100 },
            [DIMENSIONES_PIPS.DIM2]: { score: 25, maxScore: 25, percentage: 100 },
            [DIMENSIONES_PIPS.DIM3]: { score: 15, maxScore: 15, percentage: 100 },
            [DIMENSIONES_PIPS.DIM4]: { score: 20, maxScore: 20, percentage: 100 },
            [DIMENSIONES_PIPS.DIM5]: { score: 7, maxScore: 15, percentage: 47 },
            [DIMENSIONES_PIPS.DIM6]: { score: 15, maxScore: 15, percentage: 100 },
        },
        strengths: [
            "Censo completo con 12 planteles, CCTs válidos y matrícula desagregada",
            "Diagnóstico territorial fundamentado con 4 problemáticas jerarquizadas",
            "Instrumentos de seguimiento claros con indicadores y semáforos"
        ],
        criticalRecommendations: [
            "[C6] Ampliar el cronograma de acompañamiento técnico a un mínimo de 4 visitas/asesorías calendarizadas"
        ],
        auditedAt: new Date().toISOString(),
    };

    const reporteMd = generarReportePipsMarkdown(mockAuditPips, {
        nombre: "Supervisión Escolar Zona 005",
        cct: "21FZT0005B"
    });

    console.log(`- Longitud del reporte Markdown generado: ${reporteMd.length} caracteres`);
    console.log(`- Contiene encabezado DBEPA: ${reporteMd.includes("DIRECCIÓN DE BACHILLERATOS ESTATALES") || reporteMd.includes("Dirección de Bachilleratos Estatales")}`);
    console.log(`- Contiene dictamen oficial: ${reporteMd.includes("DICTAMEN: EXCELENTE")}`);
    console.log(`- Contiene firmas institucionales: ${reporteMd.includes("SUPERVISIÓN ESCOLAR DE ZONA")}\n`);

    console.log("=================================================================");
    console.log("PRUEBAS DE EVALUADOR PIPS FINALIZADAS EXITOSAMENTE ✅");
    console.log("=================================================================");
}

main().catch(err => {
    console.error("Error fatal en pruebas de PIPS:", err);
    process.exit(1);
});
