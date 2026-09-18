/**
 * ============================================================================
 * EVALUADOR DETERMINISTA Y QUALITY GATE OFICIAL PMC E INFORME FINAL 2026-2027
 * ============================================================================
 * 
 * Homologado con Proyecto_SIGPDA_EMS bajo la normativa oficial DBEPA / MCCEMS.
 * 
 * PMC (Programa de Mejora Continua):
 *  - 5 Dimensiones Normativas
 *  - 10 Criterios Oficiales (Pesos ponderados = 100 puntos brutos máximos)
 *  - Dictamen: >=85% EXCELENTE, >=70% SATISFACTORIO, >=50% EN_DESARROLLO, <50% REQUIERE_REVISION
 * 
 * INFORME FINAL (Cierre de Ciclo Escolar):
 *  - Contraste con metas del PMC original planeado
 *  - Valoración del grado de cumplimiento y justificación de metas no logradas
 *  - Auditoría de evidencias de impacto real vs evidencias no conformes
 *  - Propuestas de mejora para el siguiente ciclo escolar
 */

import { callGemini } from "../gemini";

// ── Tipos y Rúbricas para PMC ────────────────────────────────────────────────

export interface CriterioPmc {
    id: string;              // "C1" ... "C10"
    numero: number;          // 1 a 10
    dimension: string;       // Nombre de la dimensión
    nombre: string;          // Título del criterio
    descripcion: string;     // Requerimiento normativo
    weight: number;          // Puntos máximos asignados (total = 100)
}

export interface CriterioPmcResultado {
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

export interface DimensionPmcScore {
    score: number;
    maxScore: number;
    percentage: number;
}

export interface ResultadoPmcAudit {
    totalScore: number;        // 0 a 100 puntos
    maxPossibleScore: number;  // 100 puntos
    percentage: number;        // 0 a 100%
    overallStatus: "EXCELENTE" | "SATISFACTORIO" | "EN_DESARROLLO" | "REQUIERE_REVISION";
    passedCriteria: number;
    warningCriteria: number;
    failedCriteria: number;
    criteria: CriterioPmcResultado[];
    dimensionScores: Record<string, DimensionPmcScore>;
    strengths: string[];
    criticalRecommendations: string[];
    evidenciasNoConformes: string[];
    auditedAt: string;
}

// ── Tipos y Rúbricas para INFORME FINAL ───────────────────────────────────────

export interface CriterioInformeFinalResultado {
    id: string;
    dimension: string;
    nombre: string;
    weight: number;
    score: number;
    status: "pass" | "warning" | "fail";
    feedback: string;
    evidenceFound: string;
}

export interface ResultadoInformeFinalAudit {
    totalScore: number;
    maxPossibleScore: number;
    percentage: number;
    overallStatus: "EXCELENTE" | "SATISFACTORIO" | "EN_DESARROLLO" | "REQUIERE_REVISION";
    metasCumplidas: number;
    totalMetasEvaluadas: number;
    passedCriteria: number;
    warningCriteria: number;
    failedCriteria: number;
    criteria: CriterioInformeFinalResultado[];
    dimensionScores: Record<string, DimensionPmcScore>;
    strengths: string[];
    criticalRecommendations: string[];
    justificacionInconclusasCalidad: string;
    auditedAt: string;
}

// ── Catálogo Oficial de 5 Dimensiones y 10 Criterios PMC ─────────────────────

export const DIMENSIONES_PMC = {
    DIM1: "Dimensión 1: Identificación y Organización Escolar",
    DIM2: "Dimensión 2: Diagnóstico Integral e Indicadores Académicos",
    DIM3: "Dimensión 3: Análisis Situacional FODA y Priorización",
    DIM4: "Dimensión 4: Plan de Acción y Metas Institucionales",
    DIM5: "Dimensión 5: Corresponsabilidad y Metas del Personal",
} as const;

export const CRITERIOS_PMC: CriterioPmc[] = [
    // --- Dimensión 1: Identificación y Organización Escolar (C1 - C2) [16 pts] ---
    {
        id: "C1",
        numero: 1,
        dimension: DIMENSIONES_PMC.DIM1,
        nombre: "Identificación Institucional y CCT Oficial",
        descripcion: "CCT normativo oficial válido de 10 dígitos, nombre de escuela, zona escolar, municipio, director y ciclo escolar.",
        weight: 8,
    },
    {
        id: "C2",
        numero: 2,
        dimension: DIMENSIONES_PMC.DIM1,
        nombre: "Plantilla Docente y Administrativa",
        descripcion: "Censo del colectivo escolar con funciones y cargos operativos definidos (mínimo 5 integrantes con asignación clara).",
        weight: 8,
    },

    // --- Dimensión 2: Diagnóstico Integral e Indicadores Académicos (C3 - C4) [20 pts] ---
    {
        id: "C3",
        numero: 3,
        dimension: DIMENSIONES_PMC.DIM2,
        nombre: "Indicadores Académicos y Línea Base",
        descripcion: "Métricas cuantitativas clave: matrícula, aprobación, reprobación, deserción/abandono y eficiencia terminal con metas de mejora.",
        weight: 10,
    },
    {
        id: "C4",
        numero: 4,
        dimension: DIMENSIONES_PMC.DIM2,
        nombre: "Diagnóstico Socioeducativo y Contexto Territorial",
        descripcion: "Narrativa amplia (≥300 caracteres) fundamentando el contexto sociocultural, económico y las condiciones del entorno del plantel.",
        weight: 10,
    },

    // --- Dimensión 3: Análisis Situacional FODA y Priorización (C5 - C7) [26 pts] ---
    {
        id: "C5",
        numero: 5,
        dimension: DIMENSIONES_PMC.DIM3,
        nombre: "Matriz Situacional FODA (4 cuadrantes completos)",
        descripcion: "Análisis sustantivo de los 4 cuadrantes: Fortalezas y Debilidades (internas) frente a Oportunidades y Amenazas (externas).",
        weight: 10,
    },
    {
        id: "C6",
        numero: 6,
        dimension: DIMENSIONES_PMC.DIM3,
        nombre: "Priorización de Categorías y Ámbitos de Intervención",
        descripcion: "Selección focalizada de al menos 2 categorías estratégicas y temáticas prioritarias derivadas de las problemáticas del diagnóstico.",
        weight: 8,
    },
    {
        id: "C7",
        numero: 7,
        dimension: DIMENSIONES_PMC.DIM3,
        nombre: "Articulación y Narrativa del Diagnóstico Institucional",
        descripcion: "Coherencia de la síntesis diagnóstica en al menos 4 secciones: presentación, análisis de contexto, cruce FODA y justificación.",
        weight: 8,
    },

    // --- Dimensión 4: Plan de Acción y Metas Institucionales (C8 - C9) [24 pts] ---
    {
        id: "C8",
        numero: 8,
        dimension: DIMENSIONES_PMC.DIM4,
        nombre: "Metas Institucionales SMART y Entregables",
        descripcion: "Al menos 2 metas cuantificables con objetivos delimitados, estrategias operativas y productos/entregables tangibles verificables.",
        weight: 14,
    },
    {
        id: "C9",
        numero: 9,
        dimension: DIMENSIONES_PMC.DIM4,
        nombre: "Asignación de Responsabilidades y Temporalidad",
        descripcion: "Designación nominal de personal responsable y ventanas calendarizadas (periodo de inicio y fin) para cada meta del plan.",
        weight: 10,
    },

    // --- Dimensión 5: Corresponsabilidad y Metas del Personal (C10) [14 pts] ---
    {
        id: "C10",
        numero: 10,
        dimension: DIMENSIONES_PMC.DIM5,
        nombre: "Corresponsabilidad y Metas Individuales del Personal",
        descripcion: "Al menos 3 compromisos individuales de docentes y directivos vinculados a los objetivos del PMC con entregables tangibles.",
        weight: 14,
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

// ── 1. EVALUADOR DEL PMC (Planeación Inicial de Ciclo) ───────────────────────

export async function evaluarPmcEntrega(params: {
    textoDocumento: string;
    escuelaId?: string;
    cct?: string;
    escuelaNombre?: string;
    pdfBuffer?: Buffer;
}): Promise<ResultadoPmcAudit> {
    const { textoDocumento, escuelaId, cct = "CCT No especificada", escuelaNombre = "Plantel Escolar" } = params;

    if (!textoDocumento || textoDocumento.trim().length < 80) {
        console.warn(`[pmc-evaluator] Documento PMC con texto insuficiente (${textoDocumento?.length || 0} chars).`);
        return generarResultadoFallbackPmc("Documento sin texto legible, vacío o escaneado sin OCR.", escuelaNombre, cct);
    }

    const systemPrompt = `Eres un Asesor Técnico Pedagógico (ATP) y Auditor de Planes de Mejora Continua (PMC) de la Subsecretaría de Educación Media Superior (SEMS / DBEPA Puebla).
Tu tarea es auditar de forma objetiva y rigurosa el Plan de Mejora Continua (PMC) de un bachillerato general con base en los 10 criterios oficiales de la Rúbrica Institucional DBEPA.

Para cada uno de los 10 criterios (C1 a C10), debes asignar un estado:
- "pass": Cumplimiento pleno y satisfactorio según el peso máximo del criterio.
- "warning": Cumplimiento parcial, formulación genérica o datos incompletos (recibe aprox. el 50% de los puntos).
- "fail": Omisión total o información ausente/inverificable (recibe 0 puntos).

Además, detecta si existen "evidencias no conformes" o malas prácticas (fotos sin contexto, firmas ausentes, metas puramente declarativas sin entregable medible).

Responde ÚNICAMENTE con un JSON con este esquema exacto:
{
  "criterios": [
    {
      "id": "C1",
      "status": "pass" | "warning" | "fail",
      "evidenceFound": "Evidencia concreta localizada en el texto",
      "feedback": "Observación técnica constructiva"
    }
  ],
  "puntosFuertes": ["Fortaleza 1", "Fortaleza 2"],
  "recomendacionesCriticas": ["Recomendación 1", "Recomendación 2"],
  "evidenciasNoConformes": ["Ej. Se mencionan fotos sin pie descriptivo"]
}`;

    const criteriosPromptText = CRITERIOS_PMC.map(c =>
        `[${c.id}] ${c.dimension} - ${c.nombre} (Valor: ${c.weight} pts)\n  Requisito: ${c.descripcion}`
    ).join("\n\n");

    const userPrompt = `AUDITORÍA NORMATIVA DEL PLAN DE MEJORA CONTINUA (PMC)
PLANTEL: ${escuelaNombre} (${cct})

RÚBRICA DE LOS 10 CRITERIOS INSTITUCIONALES DBEPA:
-------------------------------------------------------------------------------
${criteriosPromptText}
-------------------------------------------------------------------------------

TEXTO EXTRAÍDO DEL PLAN DE MEJORA CONTINUA ENTREGADO:
\"\"\"
${textoDocumento.slice(0, 20000)}
\"\"\"

Dictamina cada uno de los 10 criterios normativos con base en la evidencia textual.`;

    let rawResponse = "";
    try {
        console.log(`[pmc-evaluator] Invocando auditoría PMC con IA para ${escuelaNombre}...`);
        rawResponse = await callGemini(
            systemPrompt,
            userPrompt,
            params.pdfBuffer,
            "application/pdf",
            undefined,
            false,
            escuelaId
        );
        console.log(`[pmc-evaluator] Respuesta IA recibida (${rawResponse.length} chars).`);
    } catch (aiErr: any) {
        console.error("[pmc-evaluator] Error al invocar motor de IA:", aiErr);
        return generarResultadoFallbackPmc(`Error de conexión al evaluar: ${aiErr?.message || String(aiErr)}`, escuelaNombre, cct);
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
    for (const d of Object.values(DIMENSIONES_PMC)) {
        dimScoreMap[d] = { score: 0, maxScore: 0 };
    }

    const evaluatedCriteria: CriterioPmcResultado[] = CRITERIOS_PMC.map(def => {
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

        // Asignación determinista de puntos por criterio
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
            feedback: aiItem.feedback || (status === "pass" ? "Cumplimiento normativo acreditado." : "Requiere mayor precisión técnica y desarrollo formal."),
            evidenceFound: aiItem.evidenceFound || (status === "pass" ? "Evidencia constatada en el texto del documento." : "No se localizaron evidencias suficientes."),
        };
    });

    const percentage = Math.round((totalScore / maxPossibleScore) * 100);
    const passedCriteria = evaluatedCriteria.filter(c => c.status === "pass").length;
    const warningCriteria = evaluatedCriteria.filter(c => c.status === "warning").length;
    const failedCriteria = evaluatedCriteria.filter(c => c.status === "fail").length;

    let overallStatus: ResultadoPmcAudit["overallStatus"] = "REQUIERE_REVISION";
    if (percentage >= 85 && failedCriteria === 0) {
        overallStatus = "EXCELENTE";
    } else if (percentage >= 70) {
        overallStatus = "SATISFACTORIO";
    } else if (percentage >= 50) {
        overallStatus = "EN_DESARROLLO";
    } else {
        overallStatus = "REQUIERE_REVISION";
    }

    const dimensionScores: Record<string, DimensionPmcScore> = {};
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
            : ["Diagnóstico inicial articulado a las necesidades escolares", "Definición de metas institucionales"],
        criticalRecommendations: Array.isArray(rawJson.recomendacionesCriticas) && rawJson.recomendacionesCriticas.length > 0
            ? rawJson.recomendacionesCriticas
            : evaluatedCriteria.filter(c => c.score < c.weight).map(c => `[${c.id}] ${c.nombre}: ${c.feedback}`),
        evidenciasNoConformes: Array.isArray(rawJson.evidenciasNoConformes) ? rawJson.evidenciasNoConformes : [],
        auditedAt: new Date().toISOString(),
    };
}

// ── 2. EVALUADOR DEL INFORME FINAL (Cierre de Ciclo vs PMC Original) ──────────

export const DIMENSIONES_INFORME_FINAL = {
    DIM1: "Dimensión 1: Coherencia y Trazabilidad con el PMC Original",
    DIM2: "Dimensión 2: Grado de Cumplimiento de Metas Institucionales",
    DIM3: "Dimensión 3: Justificación Analítica de Metas Inconclusas",
    DIM4: "Dimensión 4: Evidencias de Impacto Real vs No Conformes",
    DIM5: "Dimensión 5: Propuestas de Mejora Continua para el Siguiente Ciclo",
} as const;

export async function evaluarInformeFinalPMC(params: {
    textoInformeFinal: string;
    textoPMCOriginal: string;
    escuelaId?: string;
    cct?: string;
    escuelaNombre?: string;
    pdfBuffer?: Buffer;
}): Promise<ResultadoInformeFinalAudit> {
    const { textoInformeFinal, textoPMCOriginal, escuelaId, cct = "CCT No especificada", escuelaNombre = "Plantel Escolar" } = params;

    if (!textoInformeFinal || textoInformeFinal.trim().length < 80) {
        return generarResultadoFallbackInformeFinal("Informe Final con texto insuficiente o corrupto.", escuelaNombre, cct);
    }

    const systemPrompt = `Eres un Asesor Técnico Pedagógico (ATP) de Supervisión Escolar evaluando el INFORME FINAL DE CIERRE DE CICLO de un Plan de Mejora Continua (PMC).
Tu tarea es auditar los RESULTADOS REALES obtenidos contrastándolos con las metas que la escuela planeó originalmente en su PMC inicial.

¡DIRECTRICES NORMATIVAS CRÍTICAS!:
1. El Informe Final reporta RESULTADOS PASADOS y NO planes futuros. No debes sancionar que los hechos estén consumados.
2. Si una meta NO se logró al 100%, NO se reprueba automáticamente: se valora positivamente si el plantel presenta una JUSTIFICACIÓN HONESTA, REFLEXIVA Y SUSTENTADA de los factores limitantes.
3. Evalúa la CALIDAD de las evidencias: actas, convenios, reportes de retención/aprobación reales tienen máximo valor; fotografías sin descripción ni contexto son evidencias no conformes.

Evalúa las 5 Dimensiones Normativas de Cierre (20 puntos c/u = 100 puntos totales):
- DIM1: Coherencia y Trazabilidad con el PMC Original (Weight: 20 pts)
- DIM2: Grado de Cumplimiento de Metas Institucionales (Weight: 20 pts)
- DIM3: Justificación Analítica de Metas Inconclusas (Weight: 20 pts)
- DIM4: Evidencias de Impacto Real vs No Conformes (Weight: 20 pts)
- DIM5: Propuestas de Mejora Continua para el Siguiente Ciclo (Weight: 20 pts)

Para cada dimensión, dictamina:
- status: "pass" (100% de puntos), "warning" (50% de puntos), "fail" (0 puntos).
- score: puntos asignados (0 a 20).
- evidenceFound: resumen de evidencias encontradas en el informe.
- feedback: recomendaciones técnicas de supervisión.

Responde ÚNICAMENTE en formato JSON:
{
  "metasCumplidas": 3,
  "totalMetasEvaluadas": 4,
  "justificacionInconclusasCalidad": "Excelente / Aceptable / Insuficiente",
  "dimensiones": [
    { "id": "DIM1", "status": "pass", "score": 20, "evidenceFound": "...", "feedback": "..." },
    { "id": "DIM2", "status": "pass", "score": 20, "evidenceFound": "...", "feedback": "..." },
    { "id": "DIM3", "status": "pass", "score": 20, "evidenceFound": "...", "feedback": "..." },
    { "id": "DIM4", "status": "pass", "score": 20, "evidenceFound": "...", "feedback": "..." },
    { "id": "DIM5", "status": "pass", "score": 20, "evidenceFound": "...", "feedback": "..." }
  ],
  "puntosFuertes": ["Fortaleza 1", "Fortaleza 2"],
  "recomendacionesCriticas": ["Recomendación 1", "Recomendación 2"]
}`;

    const userPrompt = `AUDITORÍA DE CIERRE DE CICLO: INFORME FINAL vs PMC ORIGINAL
PLANTEL: ${escuelaNombre} (${cct})

===============================================================================
REFERENCIA DEL PMC ORIGINAL PLANEADO PARA EL CICLO:
${textoPMCOriginal ? textoPMCOriginal.slice(0, 10000) : "No se localizó archivo digital previo del PMC inicial en el sistema. Evalúa con base en las metas retrospectivas declaradas en el informe."}
===============================================================================

TEXTO DEL INFORME FINAL ENTREGADO POR LA ESCUELA:
\"\"\"
${textoInformeFinal.slice(0, 18000)}
\"\"\"

Realiza la auditoría integral y responde en el JSON requerido.`;

    let rawResponse = "";
    try {
        console.log(`[pmc-evaluator] Evaluando Informe Final para ${escuelaNombre}...`);
        rawResponse = await callGemini(
            systemPrompt,
            userPrompt,
            params.pdfBuffer,
            "application/pdf",
            undefined,
            false,
            escuelaId
        );
    } catch (aiErr: any) {
        console.error("[pmc-evaluator] Error al evaluar Informe Final:", aiErr);
        return generarResultadoFallbackInformeFinal(`Fallo de conexión al evaluar Informe Final: ${aiErr?.message || String(aiErr)}`, escuelaNombre, cct);
    }

    const rawJson = parsearRespuestaGemini(rawResponse);

    // Dimensiones predefinidas
    const dimsDef = [
        { id: "DIM1", nombre: DIMENSIONES_INFORME_FINAL.DIM1, weight: 20 },
        { id: "DIM2", nombre: DIMENSIONES_INFORME_FINAL.DIM2, weight: 20 },
        { id: "DIM3", nombre: DIMENSIONES_INFORME_FINAL.DIM3, weight: 20 },
        { id: "DIM4", nombre: DIMENSIONES_INFORME_FINAL.DIM4, weight: 20 },
        { id: "DIM5", nombre: DIMENSIONES_INFORME_FINAL.DIM5, weight: 20 },
    ];

    const aiDimsMap = new Map<string, any>();
    if (Array.isArray(rawJson.dimensiones)) {
        for (const d of rawJson.dimensiones) {
            if (d && d.id) aiDimsMap.set(String(d.id).toUpperCase().trim(), d);
        }
    }

    let totalScore = 0;
    const maxPossibleScore = 100;
    const dimensionScores: Record<string, DimensionPmcScore> = {};

    const criteriaResults: CriterioInformeFinalResultado[] = dimsDef.map(def => {
        const aiItem = aiDimsMap.get(def.id) || {};
        let status: "pass" | "warning" | "fail" = "fail";
        const rawStatus = String(aiItem.status || "").toLowerCase().trim();

        if (rawStatus === "pass") status = "pass";
        else if (rawStatus === "warning") status = "warning";
        else status = "fail";

        let score = 0;
        if (status === "pass") score = def.weight;
        else if (status === "warning") score = Math.round(def.weight * 0.5);
        else score = 0;

        totalScore += score;

        dimensionScores[def.nombre] = {
            score,
            maxScore: def.weight,
            percentage: Math.round((score / def.weight) * 100),
        };

        return {
            id: def.id,
            dimension: def.nombre,
            nombre: def.nombre,
            weight: def.weight,
            score,
            status,
            feedback: aiItem.feedback || "Evaluación conforme a la evidencia documental.",
            evidenceFound: aiItem.evidenceFound || "Evidencia localizada en el informe de cierre.",
        };
    });

    const percentage = Math.round((totalScore / maxPossibleScore) * 100);
    const passedCriteria = criteriaResults.filter(c => c.status === "pass").length;
    const warningCriteria = criteriaResults.filter(c => c.status === "warning").length;
    const failedCriteria = criteriaResults.filter(c => c.status === "fail").length;

    let overallStatus: ResultadoInformeFinalAudit["overallStatus"] = "REQUIERE_REVISION";
    if (percentage >= 85 && failedCriteria === 0) {
        overallStatus = "EXCELENTE";
    } else if (percentage >= 70) {
        overallStatus = "SATISFACTORIO";
    } else if (percentage >= 50) {
        overallStatus = "EN_DESARROLLO";
    } else {
        overallStatus = "REQUIERE_REVISION";
    }

    const metasCumplidas = Number(rawJson.metasCumplidas) || passedCriteria;
    const totalMetasEvaluadas = Number(rawJson.totalMetasEvaluadas) || 5;

    return {
        totalScore,
        maxPossibleScore,
        percentage,
        overallStatus,
        metasCumplidas,
        totalMetasEvaluadas,
        passedCriteria,
        warningCriteria,
        failedCriteria,
        criteria: criteriaResults,
        dimensionScores,
        strengths: Array.isArray(rawJson.puntosFuertes) && rawJson.puntosFuertes.length > 0
            ? rawJson.puntosFuertes
            : ["Rendición de cuentas estructurada", "Evidencias documentales reportadas"],
        criticalRecommendations: Array.isArray(rawJson.recomendacionesCriticas) && rawJson.recomendacionesCriticas.length > 0
            ? rawJson.recomendacionesCriticas
            : criteriaResults.filter(c => c.score < c.weight).map(c => `[${c.id}] ${c.nombre}: ${c.feedback}`),
        justificacionInconclusasCalidad: rawJson.justificacionInconclusasCalidad || "Adecuada y analítica",
        auditedAt: new Date().toISOString(),
    };
}

// ── 3. GENERADORES DE REPORTE MARKDOWN OFICIAL ───────────────────────────────

export function generarReportePmcMarkdown(
    resultado: ResultadoPmcAudit,
    datosEscuela?: { nombre?: string; cct?: string }
): string {
    const fecha = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const nombrePlantel = datosEscuela?.nombre || "Plantel Educativo";
    const cctPlantel = datosEscuela?.cct || "CCT No especificada";

    const dictamenBadge =
        resultado.overallStatus === "EXCELENTE"
            ? "🟢 DICTAMEN: EXCELENTE (CUMPLIMIENTO PLENO)"
            : resultado.overallStatus === "SATISFACTORIO"
                ? "🟡 DICTAMEN: SATISFACTORIO (APROBADO CON OBSERVACIONES)"
                : resultado.overallStatus === "EN_DESARROLLO"
                    ? "🟠 DICTAMEN: EN DESARROLLO (REQUIERE FORTALECIMIENTO)"
                    : "🔴 DICTAMEN: REQUIERE REVISIÓN INTEGRAL";

    let md = `# REPORTE OFICIAL DE AUDITORÍA DE CALIDAD PMC 2026-2027\n`;
    md += `**Subsecretaría de Educación Media Superior | DBEPA Puebla**\n`;
    md += `**Plantel:** ${nombrePlantel} | **CCT:** ${cctPlantel}\n`;
    md += `*Fecha de Auditoría:* ${fecha}\n\n`;

    md += `---\n\n`;
    md += `### RESULTADO GLOBAL DE LA PLANEACIÓN ESCOLAR\n\n`;
    md += `| Métrica Normativa | Valor Obtenido |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Puntaje Global Ponderado** | **${resultado.totalScore} / 100 pts (${resultado.percentage}%)** |\n`;
    md += `| **Estatus Técnico Oficial** | ${dictamenBadge} |\n`;
    md += `| **Criterios Acreditados Plenamente** | ${resultado.passedCriteria} de 10 |\n`;
    md += `| **Criterios con Observación / Parciales** | ${resultado.warningCriteria} de 10 |\n`;
    md += `| **Criterios Omisos o No Conformes** | ${resultado.failedCriteria} de 10 |\n\n`;

    md += `---\n\n`;
    md += `### DESGLOSE DE EVALUACIÓN POR DIMENSIÓN Y CRITERIO\n\n`;

    const dimMap = new Map<string, CriterioPmcResultado[]>();
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

    if (resultado.evidenciasNoConformes && resultado.evidenciasNoConformes.length > 0) {
        md += `---\n\n`;
        md += `### ⚠️ ALERTA DE EVIDENCIAS NO CONFORMES DETECTADAS\n\n`;
        for (const enc of resultado.evidenciasNoConformes) {
            md += `- ⚠️ ${enc}\n`;
        }
        md += `\n`;
    }

    if (resultado.strengths && resultado.strengths.length > 0) {
        md += `---\n\n`;
        md += `### FORTALEZAS DESTACADAS\n\n`;
        for (const s of resultado.strengths) {
            md += `- 🌟 ${s}\n`;
        }
        md += `\n`;
    }

    if (resultado.criticalRecommendations && resultado.criticalRecommendations.length > 0) {
        md += `---\n\n`;
        md += `### RECOMENDACIONES TÉCNICAS PRIORITARIAS\n\n`;
        for (const r of resultado.criticalRecommendations) {
            md += `- 📌 ${r}\n`;
        }
        md += `\n`;
    }

    md += `---\n\n`;
    md += `### DICTAMEN TÉCNICO Y FIRMAS INSTITUCIONALES\n\n`;
    md += `\`\`\`\n`;
    md += `____________________________________          ____________________________________\n`;
    md += `     DIRECCIÓN DEL PLANTEL                         SUPERVISIÓN ESCOLAR ZONA 004   \n`;
    md += `     Responsable de Planeación                     Sello y Validación Técnico-Pedagógica\n`;
    md += `\`\`\`\n`;

    return md;
}

export function generarReporteInformeFinalMarkdown(
    resultado: ResultadoInformeFinalAudit,
    datosEscuela?: { nombre?: string; cct?: string }
): string {
    const fecha = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const nombrePlantel = datosEscuela?.nombre || "Plantel Educativo";
    const cctPlantel = datosEscuela?.cct || "CCT No especificada";

    const dictamenBadge =
        resultado.overallStatus === "EXCELENTE"
            ? "🟢 DICTAMEN: EXCELENTE (IMPACTO PLENO Y LOGRO CONSOLIDADO)"
            : resultado.overallStatus === "SATISFACTORIO"
                ? "🟡 DICTAMEN: SATISFACTORIO (LOGRO SUSTANCIAL DE METAS)"
                : resultado.overallStatus === "EN_DESARROLLO"
                    ? "🟠 DICTAMEN: EN DESARROLLO (AVANCES PARCIALES)"
                    : "🔴 DICTAMEN: REQUIERE REVISIÓN (METAS SIN SOSTÉN DOCUMENTAL)";

    let md = `# REPORTE OFICIAL DE CIERRE Y RENDICIÓN DE CUENTAS (INFORME FINAL PMC)\n`;
    md += `**Subsecretaría de Educación Media Superior | DBEPA Puebla**\n`;
    md += `**Plantel:** ${nombrePlantel} | **CCT:** ${cctPlantel}\n`;
    md += `*Fecha de Auditoría:* ${fecha}\n\n`;

    md += `---\n\n`;
    md += `### RESULTADO DE LOGRO Y EFECTIVIDAD INSTITUCIONAL\n\n`;
    md += `| Métrica de Cierre | Valor Obtenido |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Puntaje de Rendición de Cuentas** | **${resultado.totalScore} / 100 pts (${resultado.percentage}%)** |\n`;
    md += `| **Estatus Oficial de Cierre** | ${dictamenBadge} |\n`;
    md += `| **Metas Institucionales Cumplidas** | ${resultado.metasCumplidas} de ${resultado.totalMetasEvaluadas} |\n`;
    md += `| **Calidad de Justificación de Metas Inconclusas** | **${resultado.justificacionInconclusasCalidad}** |\n\n`;

    md += `---\n\n`;
    md += `### DESGLOSE DE AUDITORÍA POR DIMENSIONES DE CIERRE\n\n`;
    md += `| Dimensión Evaluada | Pts (Máx 20) | Estatus | Evidencia de Cierre |\n`;
    md += `| :--- | :---: | :---: | :--- |\n`;

    for (const c of resultado.criteria) {
        const icon = c.status === "pass" ? "✅ Acreditado" : c.status === "warning" ? "⚠️ Parcial" : "❌ No Comprobado";
        md += `| **${c.nombre}** | **${c.score}/20** | ${icon} | ${c.evidenceFound} |\n`;
    }
    md += `\n`;

    md += `*Observaciones Técnicas por Dimensión:*\n`;
    for (const c of resultado.criteria) {
        md += `- **${c.nombre}:** ${c.feedback}\n`;
    }
    md += `\n`;

    if (resultado.strengths && resultado.strengths.length > 0) {
        md += `---\n\n`;
        md += `### FORTALEZAS Y LOGROS DESTACADOS DEL CICLO\n\n`;
        for (const s of resultado.strengths) {
            md += `- 🌟 ${s}\n`;
        }
        md += `\n`;
    }

    if (resultado.criticalRecommendations && resultado.criticalRecommendations.length > 0) {
        md += `---\n\n`;
        md += `### RECOMENDACIONES DE MEJORA PARA EL SIGUIENTE CICLO ESCOLAR\n\n`;
        for (const r of resultado.criticalRecommendations) {
            md += `- 📌 ${r}\n`;
        }
        md += `\n`;
    }

    md += `---\n\n`;
    md += `### DICTAMEN DE CONFORMIDAD Y CIERRE DE CICLO\n\n`;
    md += `\`\`\`\n`;
    md += `____________________________________          ____________________________________\n`;
    md += `     DIRECCIÓN DEL PLANTEL                         SUPERVISIÓN ESCOLAR ZONA 004   \n`;
    md += `     Titular del Centro Escolar                    Sello de Conclusión y Archivo Técnico\n`;
    md += `\`\`\`\n`;

    return md;
}

// ── Fallbacks de Contingencia ─────────────────────────────────────────────────

function generarResultadoFallbackPmc(motivo: string, escuelaNombre: string, cct: string): ResultadoPmcAudit {
    const defaultCriteria: CriterioPmcResultado[] = CRITERIOS_PMC.map(def => ({
        id: def.id,
        numero: def.numero,
        nombre: def.nombre,
        dimension: def.dimension,
        weight: def.weight,
        score: 0,
        status: "fail",
        feedback: "No evaluado automáticamente por error en el archivo.",
        evidenceFound: "No disponible.",
    }));

    const dimensionScores: Record<string, DimensionPmcScore> = {};
    for (const d of Object.values(DIMENSIONES_PMC)) {
        dimensionScores[d] = { score: 0, maxScore: 0, percentage: 0 };
    }

    return {
        totalScore: 0,
        maxPossibleScore: 100,
        percentage: 0,
        overallStatus: "REQUIERE_REVISION",
        passedCriteria: 0,
        warningCriteria: 0,
        failedCriteria: 10,
        criteria: defaultCriteria,
        dimensionScores,
        strengths: [],
        criticalRecommendations: [
            motivo,
            "Verifique que el archivo subido sea un documento digital legible de Word (.docx) o PDF con texto extraíble."
        ],
        evidenciasNoConformes: [],
        auditedAt: new Date().toISOString(),
    };
}

function generarResultadoFallbackInformeFinal(motivo: string, escuelaNombre: string, cct: string): ResultadoInformeFinalAudit {
    const dimsDef = [
        { id: "DIM1", nombre: DIMENSIONES_INFORME_FINAL.DIM1, weight: 20 },
        { id: "DIM2", nombre: DIMENSIONES_INFORME_FINAL.DIM2, weight: 20 },
        { id: "DIM3", nombre: DIMENSIONES_INFORME_FINAL.DIM3, weight: 20 },
        { id: "DIM4", nombre: DIMENSIONES_INFORME_FINAL.DIM4, weight: 20 },
        { id: "DIM5", nombre: DIMENSIONES_INFORME_FINAL.DIM5, weight: 20 },
    ];

    const dimensionScores: Record<string, DimensionPmcScore> = {};
    for (const d of dimsDef) {
        dimensionScores[d.nombre] = { score: 0, maxScore: d.weight, percentage: 0 };
    }

    return {
        totalScore: 0,
        maxPossibleScore: 100,
        percentage: 0,
        overallStatus: "REQUIERE_REVISION",
        metasCumplidas: 0,
        totalMetasEvaluadas: 0,
        passedCriteria: 0,
        warningCriteria: 0,
        failedCriteria: 5,
        criteria: dimsDef.map(d => ({
            id: d.id,
            dimension: d.nombre,
            nombre: d.nombre,
            weight: d.weight,
            score: 0,
            status: "fail",
            feedback: "No evaluado automáticamente debido a error en el documento.",
            evidenceFound: "No disponible.",
        })),
        dimensionScores,
        strengths: [],
        criticalRecommendations: [motivo, "Contactar al ATP de la zona escolar para revisión presencial o manual."],
        justificacionInconclusasCalidad: "No evaluada",
        auditedAt: new Date().toISOString(),
    };
}
