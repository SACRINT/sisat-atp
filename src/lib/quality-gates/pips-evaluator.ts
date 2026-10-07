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

function isBufferPdf(buf?: Buffer): boolean {
    if (!buf || !Buffer.isBuffer(buf) || buf.length < 4) return false;
    return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
}

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
    errorConexo?: boolean;
    errorMessage?: string;
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

function parsearRespuestaGemini(raw: string): Record<string, unknown> {
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

// ── AUDITORÍA DETERMINISTA PIPS POR CÓDIGO (6 Dimensiones y 7 Criterios) ────

export interface DeterministicPipsCheck {
    id: string;
    score: number;
    status: "pass" | "warning" | "fail";
    evidence: string;
    feedback: string;
}

export function auditarPipsDeterminista(texto: string, escuelaNombre: string, cct: string): {
    checks: Record<string, DeterministicPipsCheck>;
    totalScore: number;
} {
    const checks: Record<string, DeterministicPipsCheck> = {};
    let totalScore = 0;

    // C1: Identificación Zonal y Encuadre Institucional (10 pts)
    const hasZona = /zona\s*(escolar)?\s*[:\s#0-9A-Z]|zona\s*004|zona\s*\d+/i.test(texto);
    const hasSupervisor = /supervisor|titular|supervisi[oó]n|asesor[ií]a\s+t[eé]cnica/i.test(texto);
    const hasCiclo = /202[4-6]\s*[-–/]\s*202[5-7]/i.test(texto);
    const hasSchool = escuelaNombre ? texto.toLowerCase().includes(escuelaNombre.toLowerCase().substring(0, 8)) : false;
    const hasCct = cct ? texto.includes(cct) : false;
    const hasSubsistema = /subsistema|bachillerato|dgb|dbepa|preparatoria|sems/i.test(texto) || hasSchool || hasCct;
    const c1Matches = [hasZona, hasSupervisor, hasCiclo, hasSubsistema].filter(Boolean).length;

    if (c1Matches >= 3) {
        checks["C1"] = {
            id: "C1",
            score: 10,
            status: "pass",
            evidence: `Identificación zonal completa: Zona escolar, titular de supervisión, ciclo escolar y subsistema verificados.`,
            feedback: "Encuadre institucional de la zona escolar plenamente identificado conforme a la norma."
        };
    } else if (c1Matches >= 1) {
        checks["C1"] = {
            id: "C1",
            score: 5,
            status: "warning",
            evidence: "Identificación zonal parcial detectada en el encabezado del documento.",
            feedback: "Complete los 7 campos normativos: clave de zona, supervisor titular, sede, cobertura, ciclo y presentación."
        };
    } else {
        checks["C1"] = {
            id: "C1",
            score: 0,
            status: "fail",
            evidence: "No se localizaron datos formales de identificación zonal.",
            feedback: "Debe incorporar los datos de identificación oficial de la zona escolar."
        };
    }

    // C2: Reflexión Retrospectiva del Ciclo Previo (10 pts)
    const hasRetrospectiva = /retrospectiv|ciclo\s+(anterior|previo)|balance|aprendizajes?\s+(institucionales|clave)|fortalezas\s+pedag[oó]gicas|[aá]reas?\s+de\s+oportunidad/i.test(texto);
    const hasBalance = /balance|evaluaci[oó]n\s+del\s+ciclo|logros|retos/i.test(texto);

    if (hasRetrospectiva && hasBalance) {
        checks["C2"] = {
            id: "C2",
            score: 10,
            status: "pass",
            evidence: "Reflexión retrospectiva del ciclo previo con balance de fortalezas pedagógicas y áreas de oportunidad.",
            feedback: "Balance crítico retrospectivo sólido que fundamenta la intervención del nuevo ciclo escolar."
        };
    } else if (hasRetrospectiva || hasBalance) {
        checks["C2"] = {
            id: "C2",
            score: 5,
            status: "warning",
            evidence: "Mención general de antecedentes o balance del ciclo previo.",
            feedback: "Profundice en los aprendizajes institucionales consolidados y delimite áreas de oportunidad específicas."
        };
    } else {
        checks["C2"] = {
            id: "C2",
            score: 0,
            status: "fail",
            evidence: "No se identificó reflexión retrospectiva ni balance del ciclo escolar anterior.",
            feedback: "Debe incorporar la sección de balance crítico del ciclo previo conforme a la guía DBEPA."
        };
    }

    // C3: Censo y Matrícula Desagregada de Planteles (15 pts)
    const cctsFound = (texto.match(/\b\d{2}[A-Z]{3}\d{4}[A-Z]\b/gi) || []);
    const hasMatricula = /matr[ií]cula|censo|hombres|mujeres|alumnos|estudiantes|planteles\s+adscritos/i.test(texto);

    if (cctsFound.length >= 2 || (hasMatricula && cctsFound.length >= 1)) {
        checks["C3"] = {
            id: "C3",
            score: 15,
            status: "pass",
            evidence: `Censo zonal verificado: ${cctsFound.length} claves CCT detectadas con desglose de centros escolares y matrícula.`,
            feedback: "Inventario oficial de planteles adscritos completo con CCT y datos de población estudiantil."
        };
    } else if (cctsFound.length >= 1 || hasMatricula) {
        checks["C3"] = {
            id: "C3",
            score: 8,
            status: "warning",
            evidence: "Inventario de planteles preliminar con referencias parciales de CCT o matrícula.",
            feedback: "Asegure el censo completo de todos los planteles de la zona con CCT oficial y matrícula por género."
        };
    } else {
        checks["C3"] = {
            id: "C3",
            score: 0,
            status: "fail",
            evidence: "No se detectó el censo de planteles ni la matrícula zonal.",
            feedback: "Incorpore el catálogo de planteles adscritos con sus CCTs oficiales y estadísticas de matrícula."
        };
    }

    // C4: Diagnóstico Territorial y Jerarquización de Problemáticas (15 pts)
    const hasDiagnostico = /diagn[oó]stico\s+territorial|contexto\s+zonal|entorno|territorio|municipios/i.test(texto);
    const hasProblemas = /problem[aá]ticas?|priorizaci[oó]n|jerarquizaci[oó]n|prioridad\s+(alta|media|baja)/i.test(texto);
    const hasLargoNarrativa = texto.length > 2500;

    if (hasDiagnostico && hasProblemas && hasLargoNarrativa) {
        checks["C4"] = {
            id: "C4",
            score: 15,
            status: "pass",
            evidence: "Diagnóstico territorial zonal documentado con matriz de problemáticas y niveles de prioridad.",
            feedback: "Fundamentación contextual robusta articulada a la realidad territorial de los centros escolares."
        };
    } else if (hasDiagnostico || hasProblemas) {
        checks["C4"] = {
            id: "C4",
            score: 8,
            status: "warning",
            evidence: "Diagnóstico territorial en desarrollo con identificación descriptiva de problemáticas.",
            feedback: "Jerarquice las problemáticas zonales por nivel de prioridad (alta, media, baja) para focalizar la supervisión."
        };
    } else {
        checks["C4"] = {
            id: "C4",
            score: 0,
            status: "fail",
            evidence: "No se encontró diagnóstico territorial ni jerarquización de problemáticas.",
            feedback: "Debe incorporar el diagnóstico territorial fundamentado de la zona escolar."
        };
    }

    // C5: Objetivos de Supervisión y Metas Operativas (20 pts)
    const hasObjGeneral = /objetivo\s+general|prop[oó]sito\s+general/i.test(texto);
    const hasObjEspec = /objetivos?\s+espec[ií]ficos?|metas?\s+operativas?/i.test(texto);
    const hasMetasQuant = (texto.match(/meta\s*\d*[\s\S]{1,120}?\d+%/gi) || []).length >= 1 || /\b\d+(\.\d+)?\s*%/g.test(texto);

    if (hasObjGeneral && hasObjEspec && hasMetasQuant) {
        checks["C5"] = {
            id: "C5",
            score: 20,
            status: "pass",
            evidence: "Objetivo general de supervisión, objetivos específicos y metas operativas cuantificables formulados.",
            feedback: "Alineación de objetivos y metas operativas conforme a las prioridades técnico-pedagógicas."
        };
    } else if (hasObjGeneral || hasObjEspec) {
        checks["C5"] = {
            id: "C5",
            score: 10,
            status: "warning",
            evidence: "Objetivos de supervisión formulados pero con metas predominantemente cualitativas.",
            feedback: "Incorpore indicadores cuantitativos e indicadores de logro porcentuales en las metas operativas."
        };
    } else {
        checks["C5"] = {
            id: "C5",
            score: 0,
            status: "fail",
            evidence: "Ausencia de objetivos y metas de supervisión formalmente estructurados.",
            feedback: "Defina el objetivo general y al menos 2 objetivos específicos con metas medibles."
        };
    }

    // C6: Cronograma de Acompañamiento Técnico-Pedagógico (15 pts)
    const hasCronograma = /cronograma|calendario|programaci[oó]n|fechas|meses/i.test(texto);
    const hasActividadesATP = /acompañamiento|visitas?\s+[aá]ulicas?|asesor[ií]a|cte|consejo\s+t[eé]cnico|reuniones?\s+de\s+directores/i.test(texto);

    if (hasCronograma && hasActividadesATP) {
        checks["C6"] = {
            id: "C6",
            score: 15,
            status: "pass",
            evidence: "Cronograma de acompañamiento técnico-pedagógico con actividades programadas y calendarizadas.",
            feedback: "Calendarización integral de visitas áulicas, asesorías y sesiones colegiadas con los directores."
        };
    } else if (hasCronograma || hasActividadesATP) {
        checks["C6"] = {
            id: "C6",
            score: 8,
            status: "warning",
            evidence: "Actividades de acompañamiento descritas de manera preliminar sin cronograma detallado.",
            feedback: "Estructure un cronograma mensual con al menos 4 actividades clave de acompañamiento técnico."
        };
    } else {
        checks["C6"] = {
            id: "C6",
            score: 0,
            status: "fail",
            evidence: "No se identificó cronograma de acompañamiento técnico-pedagógico.",
            feedback: "Debe incorporar la programación de visitas áulicas y asesorías de la supervisión escolar."
        };
    }

    // C7: Monitoreo, Semáforos e Instrumentos de Evaluación (15 pts)
    const hasMonitoreo = /monitoreo|seguimiento|sem[aá]foro|instrumentos?\s+de\s+evaluaci[oó]n|r[uú]brica|gu[ií]a\s+de\s+observaci[oó]n|lista\s+de\s+cotejo/i.test(texto);
    const hasVerificacion = /indicador|verificaci[oó]n|evidencia|meta\s+porcentual/i.test(texto);

    if (hasMonitoreo && hasVerificacion) {
        checks["C7"] = {
            id: "C7",
            score: 15,
            status: "pass",
            evidence: "Mecanismos de monitoreo, semaforización e instrumentos formales de seguimiento de supervisión acreditados.",
            feedback: "Sistema de seguimiento e instrumentos de evaluación bien definidos para la supervisión zonal."
        };
    } else if (hasMonitoreo || hasVerificacion) {
        checks["C7"] = {
            id: "C7",
            score: 8,
            status: "warning",
            evidence: "Seguimiento y evaluación descritos con instrumentos preliminares o generales.",
            feedback: "Defina formalmente al menos 2 instrumentos de seguimiento con semáforos o indicadores porcentuales."
        };
    } else {
        checks["C7"] = {
            id: "C7",
            score: 0,
            status: "fail",
            evidence: "No se identificaron instrumentos formales de monitoreo ni semaforización.",
            feedback: "Incorpore instrumentos de evaluación y semáforos de seguimiento para la supervisión zonal."
        };
    }

    for (const c of Object.values(checks)) {
        totalScore += c.score;
    }

    return { checks, totalScore };
}

function construirResultadoDesdeAuditoriaDeterministaPips(
    detAudit: ReturnType<typeof auditarPipsDeterminista>,
    escuelaNombre: string,
    cct: string
): ResultadoPipsAudit {
    const dimScoreMap: Record<string, { score: number; maxScore: number }> = {};
    for (const d of Object.values(DIMENSIONES_PIPS)) {
        dimScoreMap[d] = { score: 0, maxScore: 0 };
    }

    const evaluatedCriteria: CriterioPipsResultado[] = CRITERIOS_PIPS.map(def => {
        const item = detAudit.checks[def.id] || {
            id: def.id,
            score: Math.round(def.weight * 0.5),
            status: "warning" as const,
            evidence: "Evidencia zonal documentada.",
            feedback: "Revisión técnica institucional."
        };

        if (dimScoreMap[def.dimension]) {
            dimScoreMap[def.dimension].score += item.score;
            dimScoreMap[def.dimension].maxScore += def.weight;
        }

        return {
            id: def.id,
            numero: def.numero,
            nombre: def.nombre,
            dimension: def.dimension,
            weight: def.weight,
            score: item.score,
            status: item.status,
            feedback: item.feedback,
            evidenceFound: item.evidence,
        };
    });

    const totalScore = detAudit.totalScore;
    const maxPossibleScore = 100;
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

    const strengths: string[] = [
        `Plan de Intervención y Acompañamiento Pedagógico (PIPS) para ${escuelaNombre || 'el plantel'} (${cct || 'CCT'}).`
    ];
    if (detAudit.checks["C1"]?.status === "pass") strengths.push("Identificación zonal y encuadre institucional completo");
    if (detAudit.checks["C3"]?.status === "pass") strengths.push("Censo exhaustivo de centros escolares y matrícula desagregada");
    if (detAudit.checks["C4"]?.status === "pass") strengths.push("Diagnóstico territorial articulado y jerarquización de problemáticas");
    if (detAudit.checks["C5"]?.status === "pass") strengths.push("Objetivos de supervisión claros con metas operativas cuantitativas");
    if (detAudit.checks["C6"]?.status === "pass") strengths.push("Cronograma sistemático de acompañamiento técnico-pedagógico");
    if (strengths.length === 0) strengths.push("Estructura de intervención zonal conforme a los lineamientos oficiales DBEPA");

    const criticalRecommendations = evaluatedCriteria
        .filter(c => c.score < c.weight)
        .map(c => `[${c.id}] ${c.nombre}: ${c.feedback}`);

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
        strengths,
        criticalRecommendations: criticalRecommendations.length > 0 ? criticalRecommendations : ["Mantener el seguimiento y actualización periódica del plan zonal."],
        auditedAt: new Date().toISOString(),
    };
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

    const detAudit = auditarPipsDeterminista(textoDocumento, escuelaNombre, cct);

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
"""
${textoDocumento.slice(0, 120000)}
"""

Dictamina cada uno de los 7 criterios normativos con base en la evidencia textual.`;

    let rawResponse = "";
    try {
        console.log(`[pips-evaluator] Invocando auditoría PIPS para ${escuelaNombre} (${textoDocumento.length} caracteres de texto)...`);
        const validPdf = params.pdfBuffer && isBufferPdf(params.pdfBuffer) ? params.pdfBuffer : undefined;
        rawResponse = await callGemini(
            systemPrompt,
            userPrompt,
            validPdf,
            validPdf ? "application/pdf" : undefined,
            undefined,
            false,
            escuelaId
        );
        console.log(`[pips-evaluator] Respuesta IA recibida (${rawResponse.length} chars).`);
    } catch (aiErr: unknown) {
        console.warn("[pips-evaluator] IA no disponible, recurriendo a auditoría determinista de código:", aiErr instanceof Error ? aiErr.message : String(aiErr));
        return construirResultadoDesdeAuditoriaDeterministaPips(detAudit, escuelaNombre, cct);
    }

    const rawJson = parsearRespuestaGemini(rawResponse);
    if (!rawJson || !Array.isArray(rawJson.criterios) || rawJson.criterios.length < 4) {
        console.warn("[pips-evaluator] Respuesta de IA incompleta, recurriendo a auditoría determinista de código.");
        return construirResultadoDesdeAuditoriaDeterministaPips(detAudit, escuelaNombre, cct);
    }

    // ── CÁLCULO HÍBRIDO DETERMINISTA EN TYPESCRIPT ───────────────────────────
    interface RawPipsAiCriterio {
        id?: string;
        score?: number;
        status?: string;
        feedback?: string;
        evidenceFound?: string;
    }
    const aiCriteriosMap = new Map<string, RawPipsAiCriterio>();
    for (const c of (rawJson.criterios as RawPipsAiCriterio[])) {
        if (c && c.id) aiCriteriosMap.set(String(c.id).toUpperCase().trim(), c);
    }

    let totalScore = 0;
    const maxPossibleScore = 100;

    const dimScoreMap: Record<string, { score: number; maxScore: number }> = {};
    for (const d of Object.values(DIMENSIONES_PIPS)) {
        dimScoreMap[d] = { score: 0, maxScore: 0 };
    }

    const evaluatedCriteria: CriterioPipsResultado[] = CRITERIOS_PIPS.map(def => {
        const aiItem = aiCriteriosMap.get(def.id);
        const detItem = detAudit.checks[def.id];
        let status: "pass" | "warning" | "fail" = "fail";
        let finalFeedback = "";
        let finalEvidence = "";

        if (aiItem && (aiItem.status !== undefined || aiItem.score !== undefined)) {
            const rawStatus = String(aiItem.status || "").toLowerCase().trim();
            if (rawStatus === "pass" || rawStatus === "aprobado") {
                status = "pass";
            } else if (rawStatus === "warning" || rawStatus === "parcial") {
                status = "warning";
            } else {
                status = "fail";
            }
            finalFeedback = aiItem.feedback || (status === "pass" ? "Cumplimiento normativo acreditado por IA." : "Área de oportunidad para fortalecimiento del plan zonal.");
            finalEvidence = aiItem.evidenceFound || (status === "pass" ? "Evidencia constatada en el texto del documento." : "No se localizaron evidencias suficientes.");
        } else if (detItem) {
            status = detItem.status;
            finalFeedback = detItem.feedback;
            finalEvidence = detItem.evidence;
        } else {
            status = "fail";
            finalFeedback = "Criterio sin evaluar.";
            finalEvidence = "Sin evidencia.";
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
            feedback: finalFeedback,
            evidenceFound: finalEvidence,
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
            ? (rawJson.puntosFuertes as string[])
            : ["Articulación territorial de la zona escolar", "Plan de acompañamiento técnico-pedagógico"],
        criticalRecommendations: Array.isArray(rawJson.recomendacionesCriticas) && rawJson.recomendacionesCriticas.length > 0
            ? (rawJson.recomendacionesCriticas as string[])
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
            `Plantel: ${escuelaNombre || 'N/D'} (${cct || 'N/D'}).`,
            "Reintente la evaluación para procesar el documento con el motor de IA."
        ],
        auditedAt: new Date().toISOString(),
        errorConexo: true,
        errorMessage: motivo,
    };
}
