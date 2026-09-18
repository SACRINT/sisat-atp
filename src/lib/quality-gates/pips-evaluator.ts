/**
 * ============================================================================
 * EVALUADOR DETERMINISTA Y QUALITY GATE OFICIAL PIPS 2026-2027
 * (Cartografía Territorial Pedagógica / Plan de Intervención de Supervisión)
 * ============================================================================
 * 
 * Homologado con Proyecto_SIGPDA_EMS bajo la Guía Oficial de Supervisión Escolar de la DBEPA.
 * 
 * 6 Dimensiones Zonales y 7 Criterios Normativos:
 *  - Dimensión 1: Identificación Zonal y Encuadre Institucional (C1) [10 pts]
 *  - Dimensión 2: Reflexión Retrospectiva y Diagnóstico Zonal (C2, C4) [25 pts: C2=10, C4=15]
 *  - Dimensión 3: Censo y Matrícula Desagregada de Planteles (C3) [15 pts]
 *  - Dimensión 4: Objetivos de Supervisión y Metas Operativas (C5) [20 pts]
 *  - Dimensión 5: Cronograma de Acompañamiento Técnico-Pedagógico (C6) [15 pts]
 *  - Dimensión 6: Monitoreo, Semáforos e Instrumentos de Evaluación (C7) [15 pts]
 * 
 * Total: 100 puntos brutos máximos.
 * Dictamen Oficial:
 *  - >= 85% EXCELENTE
 *  - >= 70% SATISFACTORIO
 *  - >= 50% EN_DESARROLLO
 *  - < 50% REQUIERE_REVISION
 */

import { callGemini } from "../gemini";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface CriterioPips {
    id: string;              // "C1" ... "C7"
    numero: number;          // 1 a 7
    dimension: string;       // Nombre de la dimensión
    nombre: string;          // Título descriptivo
    descripcion: string;     // Requerimiento normativo
    weight: number;          // Peso en puntos (10 a 20 pts)
}

export interface CriterioPipsResultado {
    id: string;
    numero: number;
    nombre: string;
    dimension: string;
    weight: number;
    score: number;           // Puntos obtenidos (0 a weight)
    status: "pass" | "warning" | "fail";
    feedback: string;
    evidenceFound: string;
}

export interface DimensionPipsScore {
    score: number;
    maxScore: number;
    percentage: number;
}

export interface ResultadoPipsAudit {
    totalScore: number;        // 0 a 100 puntos
    maxPossibleScore: number;  // 100 puntos
    percentage: number;        // 0 a 100%
    overallStatus: "EXCELENTE" | "SATISFACTORIO" | "EN_DESARROLLO" | "REQUIERE_REVISION";
    passedCriteria: number;
    warningCriteria: number;
    failedCriteria: number;
    criteria: CriterioPipsResultado[];
    dimensionScores: Record<string, DimensionPipsScore>;
    strengths: string[];
    criticalRecommendations: string[];
    auditedAt: string;
}

// ── Catálogo Oficial de 6 Dimensiones y 7 Criterios ──────────────────────────

export const DIMENSIONES_PIPS = {
    DIM1: "Dimensión 1: Identificación Zonal y Encuadre Institucional",
    DIM2: "Dimensión 2: Reflexión Retrospectiva y Diagnóstico Zonal",
    DIM3: "Dimensión 3: Censo y Matrícula Desagregada de Planteles",
    DIM4: "Dimensión 4: Objetivos de Supervisión y Metas Operativas",
    DIM5: "Dimensión 5: Cronograma de Acompañamiento Técnico-Pedagógico",
    DIM6: "Dimensión 6: Monitoreo, Semáforos e Instrumentos de Evaluación",
} as const;

export const CRITERIOS_PIPS: CriterioPips[] = [
    // --- Dimensión 1: Identificación Zonal (C1) [10 pts] ---
    {
        id: "C1",
        numero: 1,
        dimension: DIMENSIONES_PIPS.DIM1,
        nombre: "Identificación Zonal y Encuadre Institucional",
        descripcion: "Registro de 7 campos normativos: clave y nombre de zona, supervisor titular, municipio sede, municipios de cobertura, ciclo escolar, subsistema y presentación oficial del supervisor.",
        weight: 10,
    },

    // --- Dimensión 2: Reflexión y Diagnóstico (C2, C4) [25 pts] ---
    {
        id: "C2",
        numero: 2,
        dimension: DIMENSIONES_PIPS.DIM2,
        nombre: "Reflexión Retrospectiva del Ciclo Previo",
        descripcion: "Balance crítico del PIPS anterior con aprendizajes institucionales, fortalezas pedagógicas consolidadas y áreas de oportunidad delimitadas.",
        weight: 10,
    },
    {
        id: "C4",
        numero: 4,
        dimension: DIMENSIONES_PIPS.DIM2,
        nombre: "Diagnóstico Territorial y Jerarquización de Problemáticas",
        descripcion: "Fundamentación amplia del contexto territorial zonal (≥200 caracteres) y matriz de problemáticas clasificadas por nivel de prioridad (alta, media, baja).",
        weight: 15,
    },

    // --- Dimensión 3: Censo de Planteles (C3) [15 pts] ---
    {
        id: "C3",
        numero: 3,
        dimension: DIMENSIONES_PIPS.DIM3,
        nombre: "Censo y Matrícula Desagregada de Planteles",
        descripcion: "Inventario oficial de todos los centros escolares adscritos a la zona con CCT válido de 10 dígitos, localidad y matrícula desagregada por género y total.",
        weight: 15,
    },

    // --- Dimensión 4: Objetivos y Metas (C5) [20 pts] ---
    {
        id: "C5",
        numero: 5,
        dimension: DIMENSIONES_PIPS.DIM4,
        nombre: "Objetivos de Supervisión y Metas Operativas",
        descripcion: "Objetivo general delimitado y al menos 2 objetivos específicos con metas medibles, indicadores de logro cuantificables y responsables asignados.",
        weight: 20,
    },

    // --- Dimensión 5: Cronograma de Acompañamiento (C6) [15 pts] ---
    {
        id: "C6",
        numero: 6,
        dimension: DIMENSIONES_PIPS.DIM5,
        nombre: "Cronograma de Acompañamiento Técnico-Pedagógico",
        descripcion: "Programación sistemática de al menos 4 actividades (visitas áulicas, asesorías técnicas, reuniones de directores, CTE) con responsables y meses programados.",
        weight: 15,
    },

    // --- Dimensión 6: Monitoreo y Evaluación (C7) [15 pts] ---
    {
        id: "C7",
        numero: 7,
        dimension: DIMENSIONES_PIPS.DIM6,
        nombre: "Monitoreo, Semáforos e Instrumentos de Evaluación",
        descripcion: "Definición de al menos 2 mecanismos o instrumentos formales de seguimiento de la supervisión con indicador, meta porcentual e instrumento de verificación.",
        weight: 15,
    },
];

// ── Parser JSON Seguro ───────────────────────────────────────────────────────

function parsearRespuestaGemini(raw: string): any {
    let clean = raw.trim();
    if (clean.startsWith("```")) {
        clean = clean.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }
    try {
        return JSON.parse(clean);
    } catch {
        const inicio = clean.indexOf("{");
        const fin = clean.lastIndexOf("}");
        if (inicio !== -1 && fin > inicio) {
            try {
                return JSON.parse(clean.substring(inicio, fin + 1));
            } catch {}
        }
    }
    return {};
}

// ── Función Principal de Evaluación PIPS ─────────────────────────────────────

export async function evaluarPipsEntrega(params: {
    textoDocumento: string;
    escuelaId?: string;
    cct?: string;
    escuelaNombre?: string;
    pdfBuffer?: Buffer;
}): Promise<ResultadoPipsAudit> {
    const { textoDocumento, escuelaId, cct = "CCT No especificada", escuelaNombre = "Zona Escolar / Plantel" } = params;

    if (!textoDocumento || textoDocumento.trim().length < 80) {
        console.warn(`[pips-evaluator] Documento PIPS con texto insuficiente (${textoDocumento?.length || 0} chars).`);
        return generarResultadoFallbackPips("Documento sin texto legible o vacío.", escuelaNombre, cct);
    }

    const systemPrompt = `Eres un Asesor Técnico Pedagógico (ATP) y Auditor de la Subsecretaría de Educación Media Superior (SEMS / DBEPA Puebla).
Tu función es auditar con rigor normativo el Plan de Intervención Pedagógica de Supervisión Escolar (PIPS) / Cartografía Territorial Pedagógica de una zona escolar con base en los 7 criterios institucionales oficiales de la DBEPA.

Para cada uno de los 7 criterios (C1 a C7), debes evaluar la evidencia en el texto y asignar un estado:
- "pass": Cumplimiento pleno y exhaustivo conforme al peso máximo del criterio.
- "warning": Cumplimiento parcial o preliminar (recibe aprox. el 50% de los puntos).
- "fail": Omisión o ausencia de evidencia verificable (recibe 0 puntos).

Responde ÚNICAMENTE en formato JSON válido con el siguiente esquema:
{
  "criterios": [
    {
      "id": "C1",
      "status": "pass" | "warning" | "fail",
      "evidenceFound": "Evidencia concreta identificada en el documento",
      "feedback": "Observación constructiva fundamentada"
    }
  ],
  "puntosFuertes": ["Fortaleza destacada 1", "Fortaleza 2"],
  "recomendacionesCriticas": ["Recomendación prioritaria 1", "Recomendación 2"]
}`;

    const criteriosPromptText = CRITERIOS_PIPS.map(c =>
        `[${c.id}] ${c.dimension} - ${c.nombre} (Valor: ${c.weight} pts)\n  Requisito: ${c.descripcion}`
    ).join("\n\n");

    const userPrompt = `AUDITORÍA NORMATIVA DEL PLAN DE INTERVENCIÓN PEDAGÓGICA DE SUPERVISIÓN (PIPS)
ZONA ESCOLAR / CENTRO EVALUADO: ${escuelaNombre} (${cct})

RÚBRICA DE LOS 7 CRITERIOS INSTITUCIONALES DBEPA:
-------------------------------------------------------------------------------
${criteriosPromptText}
-------------------------------------------------------------------------------

TEXTO EXTRAÍDO DEL DOCUMENTO PIPS ENTREGADO:
\"\"\"
${textoDocumento.slice(0, 20000)}
\"\"\"

Dictamina cada uno de los 7 criterios normativos con base en la evidencia textual.`;

    let rawResponse = "";
    try {
        console.log(`[pips-evaluator] Invocando auditoría PIPS para ${escuelaNombre}...`);
        rawResponse = await callGemini(
            systemPrompt,
            userPrompt,
            params.pdfBuffer,
            "application/pdf",
            undefined,
            false,
            escuelaId
        );
        console.log(`[pips-evaluator] Respuesta IA recibida (${rawResponse.length} chars).`);
    } catch (aiErr: any) {
        console.error("[pips-evaluator] Error al invocar motor de IA:", aiErr);
        return generarResultadoFallbackPips(`Fallo al evaluar con IA: ${aiErr?.message || String(aiErr)}`, escuelaNombre, cct);
    }

    const rawJson = parsearRespuestaGemini(rawResponse);

    // ── CÁLCULO DETERMINISTA EN TYPESCRIPT ───────────────────────────────────
    const aiCriteriosMap = new Map<string, any>();
    if (Array.isArray(rawJson.criterios)) {
        for (const c of rawJson.criterios) {
            if (c && c.id) aiCriteriosMap.set(String(c.id).toUpperCase().trim(), c);
        }
    }

    let totalScore = 0;
    const maxPossibleScore = 100;

    const dimScoreMap: Record<string, { score: number; maxScore: number }> = {};
    for (const d of Object.values(DIMENSIONES_PIPS)) {
        dimScoreMap[d] = { score: 0, maxScore: 0 };
    }

    const evaluatedCriteria: CriterioPipsResultado[] = CRITERIOS_PIPS.map(def => {
        const aiItem = aiCriteriosMap.get(def.id) || {};
        let status: "pass" | "warning" | "fail" = "fail";
        const rawStatus = String(aiItem.status || "").toLowerCase().trim();

        if (rawStatus === "pass" || rawStatus === "aprobado") {
            status = "pass";
        } else if (rawStatus === "warning" || rawStatus === "parcial") {
            status = "warning";
        } else {
            status = "fail";
        }

        let score = 0;
        if (status === "pass") {
            score = def.weight;
        } else if (status === "warning") {
            score = Math.round(def.weight * 0.5);
        } else {
            score = 0;
        }

        totalScore += score;

        if (dimScoreMap[def.dimension]) {
            dimScoreMap[def.dimension].score += score;
            dimScoreMap[def.dimension].maxScore += def.weight;
        }

        return {
            id: def.id,
            numero: def.numero,
            nombre: def.nombre,
            dimension: def.dimension,
            weight: def.weight,
            score,
            status,
            feedback: aiItem.feedback || (status === "pass" ? "Cumplimiento normativo acreditado." : "Área de oportunidad para fortalecimiento del plan zonal."),
            evidenceFound: aiItem.evidenceFound || (status === "pass" ? "Evidencias constatadas en el cuerpo del PIPS." : "No se localizaron elementos suficientes en el texto."),
        };
    });

    const percentage = Math.round((totalScore / maxPossibleScore) * 100);
    const passedCriteria = evaluatedCriteria.filter(c => c.status === "pass").length;
    const warningCriteria = evaluatedCriteria.filter(c => c.status === "warning").length;
    const failedCriteria = evaluatedCriteria.filter(c => c.status === "fail").length;

    let overallStatus: ResultadoPipsAudit["overallStatus"] = "REQUIERE_REVISION";
    if (percentage >= 85 && failedCriteria === 0) {
        overallStatus = "EXCELENTE";
    } else if (percentage >= 70) {
        overallStatus = "SATISFACTORIO";
    } else if (percentage >= 50) {
        overallStatus = "EN_DESARROLLO";
    } else {
        overallStatus = "REQUIERE_REVISION";
    }

    const dimensionScores: Record<string, DimensionPipsScore> = {};
    for (const [dimName, val] of Object.entries(dimScoreMap)) {
        dimensionScores[dimName] = {
            score: val.score,
            maxScore: val.maxScore,
            percentage: val.maxScore > 0 ? Math.round((val.score / val.maxScore) * 100) : 0,
        };
    }

    return {
        totalScore,
        maxPossibleScore,
        percentage,
        overallStatus,
        passedCriteria,
        warningCriteria,
        failedCriteria,
        criteria: evaluatedCriteria,
        dimensionScores,
        strengths: Array.isArray(rawJson.puntosFuertes) && rawJson.puntosFuertes.length > 0
            ? rawJson.puntosFuertes
            : ["Articulación territorial de la zona escolar", "Plan de acompañamiento técnico-pedagógico"],
        criticalRecommendations: Array.isArray(rawJson.recomendacionesCriticas) && rawJson.recomendacionesCriticas.length > 0
            ? rawJson.recomendacionesCriticas
            : evaluatedCriteria.filter(c => c.score < c.weight).map(c => `[${c.id}] ${c.nombre}: ${c.feedback}`),
        auditedAt: new Date().toISOString(),
    };
}

// ── Generador del Dictamen Oficial en Markdown ───────────────────────────────

export function generarReportePipsMarkdown(
    resultado: ResultadoPipsAudit,
    datosEscuela?: { nombre?: string; cct?: string }
): string {
    const fecha = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const nombreEntidad = datosEscuela?.nombre || "Zona Escolar de Bachilleratos Generales";
    const cctEntidad = datosEscuela?.cct || "Sede Zonal";

    const dictamenBadge =
        resultado.overallStatus === "EXCELENTE"
            ? "🟢 DICTAMEN: EXCELENTE (GESTIÓN TERRITORIAL PLENA)"
            : resultado.overallStatus === "SATISFACTORIO"
                ? "🟡 DICTAMEN: SATISFACTORIO (APROBADO CON RECOMENDACIONES)"
                : resultado.overallStatus === "EN_DESARROLLO"
                    ? "🟠 DICTAMEN: EN DESARROLLO (REQUIERE CONSOLIDACIÓN)"
                    : "🔴 DICTAMEN: REQUIERE REVISIÓN (INSUFICIENTE ALINEACIÓN ZONAL)";

    let md = `# REPORTE OFICIAL DE AUDITORÍA TÉCNICA PIPS 2026-2027\n`;
    md += `**Subsecretaría de Educación Media Superior | Dirección de Bachilleratos Estatales y Preparatoria Abierta**\n`;
    md += `**Ámbito:** ${nombreEntidad} | **Identificación:** ${cctEntidad}\n`;
    md += `*Fecha de Auditoría:* ${fecha}\n\n`;

    md += `---\n\n`;
    md += `### RESULTADO GLOBAL DE LA CARTOGRAFÍA TERRITORIAL (PIPS)\n\n`;
    md += `| Métrica Normativa | Valor Obtenido |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Puntaje Global Ponderado** | **${resultado.totalScore} / 100 pts (${resultado.percentage}%)** |\n`;
    md += `| **Estatus Técnico Oficial** | ${dictamenBadge} |\n`;
    md += `| **Criterios Acreditados Plenamente** | ${resultado.passedCriteria} de 7 |\n`;
    md += `| **Criterios con Observación / Parciales** | ${resultado.warningCriteria} de 7 |\n`;
    md += `| **Criterios Omisos o No Conformes** | ${resultado.failedCriteria} de 7 |\n\n`;

    md += `---\n\n`;
    md += `### DESGLOSE DE EVALUACIÓN POR DIMENSIONES ZONALES\n\n`;

    const dimMap = new Map<string, CriterioPipsResultado[]>();
    for (const c of resultado.criteria) {
        const list = dimMap.get(c.dimension) || [];
        list.push(c);
        dimMap.set(c.dimension, list);
    }

    for (const [dimName, criteriaList] of dimMap.entries()) {
        const dimInfo = resultado.dimensionScores[dimName] || {
            score: criteriaList.reduce((acc, c) => acc + c.score, 0),
            maxScore: criteriaList.reduce((acc, c) => acc + c.weight, 0),
            percentage: 0,
        };

        md += `#### ${dimName} (${dimInfo.percentage}% — ${dimInfo.score}/${dimInfo.maxScore} pts)\n\n`;
        md += `| No. | Criterio de Rúbrica | Pts Obtenidos | Estatus | Evidencia Encontrada |\n`;
        md += `| :---: | :--- | :---: | :---: | :--- |\n`;

        for (const c of criteriaList) {
            const statusIcon = c.status === "pass" ? "✅ Pass" : c.status === "warning" ? "⚠️ Parcial" : "❌ No Cumple";
            md += `| **${c.id}** | ${c.nombre} | **${c.score}/${c.weight}** | ${statusIcon} | ${c.evidenceFound} |\n`;
        }
        md += `\n`;

        const needsAttention = criteriaList.filter(c => c.score < c.weight);
        if (needsAttention.length > 0) {
            md += `*Observaciones y Recomendaciones Técnicas:*\n`;
            for (const c of needsAttention) {
                md += `- **${c.id} (${c.score}/${c.weight} pts):** ${c.feedback}\n`;
            }
            md += `\n`;
        }
    }

    if (resultado.strengths && resultado.strengths.length > 0) {
        md += `---\n\n`;
        md += `### FORTALEZAS DESTACADAS DE LA INTERVENCIÓN ZONAL\n\n`;
        for (const s of resultado.strengths) {
            md += `- 🌟 ${s}\n`;
        }
        md += `\n`;
    }

    if (resultado.criticalRecommendations && resultado.criticalRecommendations.length > 0) {
        md += `---\n\n`;
        md += `### RECOMENDACIONES TÉCNICAS PRIORITARIAS DE SUPERVISIÓN\n\n`;
        for (const r of resultado.criticalRecommendations) {
            md += `- 📌 ${r}\n`;
        }
        md += `\n`;
    }

    md += `---\n\n`;
    md += `### DICTAMEN TÉCNICO Y FIRMAS INSTITUCIONALES\n\n`;
    md += `\`\`\`\n`;
    md += `____________________________________          ____________________________________\n`;
    md += `     SUPERVISIÓN ESCOLAR DE ZONA                   ASESORÍA TÉCNICO-PEDAGÓGICA (ATP)\n`;
    md += `     Titular de la Zona Escolar                    Validación y Acompañamiento Zonal\n`;
    md += `\`\`\`\n`;

    return md;
}

// ── Fallback de Contingencia ──────────────────────────────────────────────────

function generarResultadoFallbackPips(motivo: string, escuelaNombre: string, cct: string): ResultadoPipsAudit {
    const defaultCriteria: CriterioPipsResultado[] = CRITERIOS_PIPS.map(def => ({
        id: def.id,
        numero: def.numero,
        nombre: def.nombre,
        dimension: def.dimension,
        weight: def.weight,
        score: 0,
        status: "fail",
        feedback: "No evaluado automáticamente por error en el archivo digital.",
        evidenceFound: "No disponible.",
    }));

    const dimensionScores: Record<string, DimensionPipsScore> = {};
    for (const d of Object.values(DIMENSIONES_PIPS)) {
        dimensionScores[d] = { score: 0, maxScore: 0, percentage: 0 };
    }

    return {
        totalScore: 0,
        maxPossibleScore: 100,
        percentage: 0,
        overallStatus: "REQUIERE_REVISION",
        passedCriteria: 0,
        warningCriteria: 0,
        failedCriteria: 7,
        criteria: defaultCriteria,
        dimensionScores,
        strengths: [],
        criticalRecommendations: [
            motivo,
            "Verifique que el archivo subido sea un documento digital legible (PDF con texto extraíble o Word .docx)."
        ],
        auditedAt: new Date().toISOString(),
    };
}
