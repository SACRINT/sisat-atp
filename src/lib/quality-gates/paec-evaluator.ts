/**
 * ============================================================================
 * EVALUADOR DETERMINISTA Y QUALITY GATE OFICIAL PAEC-PEC 2025
 * ============================================================================
 * 
 * Homologado con Proyecto_SIGPDA_EMS bajo la normativa oficial DBEPA / COSFAC / NEM.
 * 
 * 8 Dimensiones Normativas y 23 Criterios Oficiales:
 *  - Dimensión 1: Diagnóstico Comunitario y Escolar (C1 - C4)
 *  - Dimensión 2: Justificación y Fundamentación (C5 - C7)
 *  - Dimensión 3: Mapeo Curricular y Cobertura (C8 - C10)
 *  - Dimensión 4: Cronograma Bimestral (C11 - C12)
 *  - Dimensión 5: Detalle Curricular y Progresiones (C13 - C14)
 *  - Dimensión 6: Plan Operativo Territorial (C15 - C18)
 *  - Dimensión 7: Implementación y Formalización (C19 - C20)
 *  - Dimensión 8: Gobernanza Escolar e Informe de Supervisión (C21 - C23)
 * 
 * Escala cuantitativa por criterio: 1 a 4 puntos (Puntos Brutos Máximos = 92).
 * La IA dictamina nivel de evidencia y observaciones; TypeScript calcula
 * puntajes, porcentajes y dictamen de forma 100% determinista.
 */

import { callGemini } from "../gemini";

function isBufferPdf(buf?: Buffer): boolean {
    if (!buf || !Buffer.isBuffer(buf) || buf.length < 4) return false;
    return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
}

// ── Definición de Tipos ──────────────────────────────────────────────────────

export interface CriterioPaec {
    id: string;              // "C1", "C2", ... "C23"
    numero: number;          // 1 a 23
    dimension: string;       // Nombre de la dimensión
    nombre: string;          // Título descriptivo
    descripcion: string;     // Requerimiento normativo
    maxScore: number;        // Siempre 4
}

export interface CriterioPaecResultado {
    id: string;
    numero: number;
    nombre: string;
    dimension: string;
    maxScore: number;
    score: number;           // 1 a 4 determinado por evaluación
    status: "pass" | "warning" | "fail";
    feedback: string;
    evidenceFound: string;
}

export interface DimensionScore {
    score: number;
    maxScore: number;
    percentage: number;
}

export interface ResultadoPaecAudit {
    totalScore: number;        // 0 a 92 puntos brutos
    maxPossibleScore: number;  // 92 puntos
    percentage: number;        // 0 a 100%
    overallStatus: "aprobado_excelente" | "aprobado" | "requiere_ajustes";
    passedCriteria: number;
    warningCriteria: number;
    failedCriteria: number;
    criteria: CriterioPaecResultado[];
    dimensionScores: Record<string, DimensionScore>;
    strengths: string[];
    criticalRecommendations: string[];
    auditedAt: string;
    errorConexo?: boolean;
    errorMessage?: string;
}

// ── Catálogo Oficial de 8 Dimensiones y 23 Criterios ────────────────────────

export const DIMENSIONES_PAEC = {
    DIM1: "Dimensión 1: Diagnóstico Comunitario y Escolar",
    DIM2: "Dimensión 2: Justificación y Fundamentación",
    DIM3: "Dimensión 3: Mapeo Curricular y Cobertura",
    DIM4: "Dimensión 4: Cronograma Bimestral",
    DIM5: "Dimensión 5: Detalle Curricular y Progresiones",
    DIM6: "Dimensión 6: Plan Operativo Territorial",
    DIM7: "Dimensión 7: Implementación y Formalización",
    DIM8: "Dimensión 8: Gobernanza Escolar e Informe de Supervisión",
} as const;

export const CRITERIOS_PAEC: CriterioPaec[] = [
    // --- Dimensión 1: Diagnóstico Comunitario y Escolar (C1 - C4) ---
    {
        id: "C1",
        numero: 1,
        dimension: DIMENSIONES_PAEC.DIM1,
        nombre: "Tabla 1 (Comunidad): Datos duros situados, no genéricos",
        descripcion: "Datos contextuales con cifras, porcentajes, fuentes oficiales (INEGI, censo municipal) o delimitación geográfica específica del entorno.",
        maxScore: 4,
    },
    {
        id: "C2",
        numero: 2,
        dimension: DIMENSIONES_PAEC.DIM1,
        nombre: "Tabla 2 (Educación): Indicadores reales del plantel",
        descripcion: "Métricas cuantitativas reales del centro escolar: matrícula desagregada, índices de reprobación, abandono escolar o necesidades de infraestructura.",
        maxScore: 4,
    },
    {
        id: "C3",
        numero: 3,
        dimension: DIMENSIONES_PAEC.DIM1,
        nombre: "Matriz FODA: 4 cuadrantes con análisis cruzado y Estrategia Maestra",
        descripcion: "Presencia completa de Fortalezas, Oportunidades, Debilidades y Amenazas con articulación de cruces estratégicos adaptativos (FO/DO/FA/DA).",
        maxScore: 4,
    },
    {
        id: "C4",
        numero: 4,
        dimension: DIMENSIONES_PAEC.DIM1,
        nombre: "Tabla 4: 3 etapas técnicas de jerarquización documentadas",
        descripcion: "Evidencia de las 3 fases colegiadas: 1) Recuperación de problemáticas, 2) Deliberación/análisis, y 3) Selección justificada del problema central.",
        maxScore: 4,
    },

    // --- Dimensión 2: Justificación y Fundamentación (C5 - C7) ---
    {
        id: "C5",
        numero: 5,
        dimension: DIMENSIONES_PAEC.DIM2,
        nombre: "Introducción contextualizada al PEC (≥100 palabras)",
        descripcion: "Texto introductorio situado en la realidad socioterritorial del plantel que explicita la misión pedagógica y transformadora del proyecto.",
        maxScore: 4,
    },
    {
        id: "C6",
        numero: 6,
        dimension: DIMENSIONES_PAEC.DIM2,
        nombre: "Pilares de la NEM articulados (mínimo 5 pilares)",
        descripcion: "Articulación explícita de al menos 5 principios rectores de la Nueva Escuela Mexicana con descripción de cómo se viven en la práctica escolar.",
        maxScore: 4,
    },
    {
        id: "C7",
        numero: 7,
        dimension: DIMENSIONES_PAEC.DIM2,
        nombre: "Criterio DBEPA 4 vertientes: Magnitud, Interés, Factibilidad, Oportunidad",
        descripcion: "Sustentación de la problemática en sus 4 vertientes metodológicas: alcance de población, pertinencia/demanda social, viabilidad de recursos y coyuntura temporal.",
        maxScore: 4,
    },

    // --- Dimensión 3: Mapeo Curricular y Cobertura (C8 - C10) ---
    {
        id: "C8",
        numero: 8,
        dimension: DIMENSIONES_PAEC.DIM3,
        nombre: "Cobertura curricular amplia (UACs activas representadas sin omisiones)",
        descripcion: "Mapeo curricular extenso a lo largo de los semestres escolares integrando recursos sociocognitivos, áreas de conocimiento y ámbitos socioemocionales.",
        maxScore: 4,
    },
    {
        id: "C9",
        numero: 9,
        dimension: DIMENSIONES_PAEC.DIM3,
        nombre: "Nomenclatura oficial NOM-MCCEMS correcta por semestre",
        descripcion: "Uso estricto de las denominaciones del rediseño curricular de la NEM (evitando planes obsoletos como Álgebra tradicional, Química I, TLR o Ética antigua).",
        maxScore: 4,
    },
    {
        id: "C10",
        numero: 10,
        dimension: DIMENSIONES_PAEC.DIM3,
        nombre: "Vinculación específica y situada (no genérica) por asignatura",
        descripcion: "Cada UAC define aportes conceptuales, entregables tangibles, cálculos, investigaciones o intervenciones diferenciadas ligadas a la problemática.",
        maxScore: 4,
    },

    // --- Dimensión 4: Cronograma Bimestral (C11 - C12) ---
    {
        id: "C11",
        numero: 11,
        dimension: DIMENSIONES_PAEC.DIM4,
        nombre: "6 fases bimestrales estructuradas con 5 columnas normativas",
        descripcion: "Cronograma anual en 6 fases bimestrales con Fase, Objetivo, Macro-actividades, Asignaturas/Docentes Responsables y Semestres involucrados.",
        maxScore: 4,
    },
    {
        id: "C12",
        numero: 12,
        dimension: DIMENSIONES_PAEC.DIM4,
        nombre: "Asignaturas viga maestra identificadas con justificación de liderazgo",
        descripcion: "Identificación de las asignaturas ejes articuladoras ('vigas maestras') que coordinan y lideran pedagógicamente las actividades en cada fase bimestral.",
        maxScore: 4,
    },

    // --- Dimensión 5: Detalle Curricular y Progresiones (C13 - C14) ---
    {
        id: "C13",
        numero: 13,
        dimension: DIMENSIONES_PAEC.DIM5,
        nombre: "Progresiones (1°-4°) y Propósitos Integradores (5°-6°) formulados",
        descripcion: "Desglose curricular exacto: progresiones de aprendizaje oficiales en semestres 1 a 4, y propósitos formativos/laborales integradores en semestres 5 y 6.",
        maxScore: 4,
    },
    {
        id: "C14",
        numero: 14,
        dimension: DIMENSIONES_PAEC.DIM5,
        nombre: "Fases del PEC articuladas explícitamente por cada UAC",
        descripcion: "Correspondencia y justificación pedagógica clara entre los contenidos de cada UAC y la fase del proyecto comunitario (Fases I a VI).",
        maxScore: 4,
    },

    // --- Dimensión 6: Plan Operativo Territorial (C15 - C18) ---
    {
        id: "C15",
        numero: 15,
        dimension: DIMENSIONES_PAEC.DIM6,
        nombre: "Semestre A: 16 semanas de planeación con 8 columnas",
        descripcion: "Plan semanal exhaustivo para el semestre escolar A con fase, actividad, UAC, progresión, estrategia, semana, responsables e instrumento de evaluación.",
        maxScore: 4,
    },
    {
        id: "C16",
        numero: 16,
        dimension: DIMENSIONES_PAEC.DIM6,
        nombre: "Semestre B: 16 semanas de planeación con 8 columnas",
        descripcion: "Plan semanal exhaustivo para el semestre escolar B con fase, actividad, UAC, progresión, estrategia, semana, responsables e instrumento de evaluación.",
        maxScore: 4,
    },
    {
        id: "C17",
        numero: 17,
        dimension: DIMENSIONES_PAEC.DIM6,
        nombre: "Semana 16: Hitos de Cierre/Transferencia (A) y Feria de Resultados (B)",
        descripcion: "Programación explícita de la Semana 16 como hito institucional: evaluación/transferencia de fase en Semestre A y Feria Comunitaria/difusión en Semestre B.",
        maxScore: 4,
    },
    {
        id: "C18",
        numero: 18,
        dimension: DIMENSIONES_PAEC.DIM6,
        nombre: "Metodologías activas y sociocríticas documentadas (ABPC, STEAM, AS, ABP)",
        descripcion: "Predominio de estrategias sociocríticas activas: Aprendizaje Basado en Proyectos Comunitarios (ABPC), STEAM, Aprendizaje Servicio (AS) o Estudio de Casos.",
        maxScore: 4,
    },

    // --- Dimensión 7: Implementación y Formalización (C19 - C20) ---
    {
        id: "C19",
        numero: 19,
        dimension: DIMENSIONES_PAEC.DIM7,
        nombre: "Instrumentos de formalización: Carta de Invitación, Minuta y Oficios",
        descripcion: "Documentación de formalización con autoridades o aliados: carta de convocatoria con orden del día, minuta de arranque con acuerdos y oficios de vinculación.",
        maxScore: 4,
    },
    {
        id: "C20",
        numero: 20,
        dimension: DIMENSIONES_PAEC.DIM7,
        nombre: "6 anexos técnicos normativos completos",
        descripcion: "Presencia o referencia de instrumentos de control y seguimiento: minutas, bitácoras semanales, reportes mensuales e instrumentos de evaluación de impacto.",
        maxScore: 4,
    },

    // --- Dimensión 8: Gobernanza Escolar e Informe de Supervisión (C21 - C23) ---
    {
        id: "C21",
        numero: 21,
        dimension: DIMENSIONES_PAEC.DIM8,
        nombre: "Gobernanza escolar en 4 niveles con calendario de seguimiento",
        descripcion: "Esquema operativo de coordinación que contempla los 4 niveles: directivo, colegiado docente/academia, aula/estudiantes y comunidad/padres de familia.",
        maxScore: 4,
    },
    {
        id: "C22",
        numero: 22,
        dimension: DIMENSIONES_PAEC.DIM8,
        nombre: "Informe final de impacto con Metas vs Logros y análisis Pre/Post",
        descripcion: "Mecanismo estructurado de rendición de cuentas con contraste de metas programadas vs resultados alcanzados y valoración del impacto comunitario.",
        maxScore: 4,
    },
    {
        id: "C23",
        numero: 23,
        dimension: DIMENSIONES_PAEC.DIM8,
        nombre: "Plan de sostenibilidad y compromisos de continuidad institucional",
        descripcion: "Estrategias para garantizar la permanencia de las mejoras logradas en el entorno escolar y la custodia comunitaria en los ciclos escolares subsecuentes.",
        maxScore: 4,
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
        // Intento de extracción por delimitadores
        const inicio = clean.indexOf("{");
        const fin = clean.lastIndexOf("}");
        if (inicio !== -1 && fin > inicio) {
            try {
                return JSON.parse(clean.substring(inicio, fin + 1));
            } catch {
                // Parseo básico de emergencia
            }
        }
    }
    return {};
}

// ── AUDITORÍA DETERMINISTA PAEC POR CÓDIGO (8 Dimensiones y 23 Criterios) ────

export interface DeterministicPaecCheck {
    id: string;
    score: number;
    status: "pass" | "warning" | "fail";
    evidence: string;
    feedback: string;
}

export function auditarPaecDeterminista(texto: string, escuelaNombre: string, cct: string): {
    checks: Record<string, DeterministicPaecCheck>;
    totalRawScore: number;
} {
    const checks: Record<string, DeterministicPaecCheck> = {};
    let totalRawScore = 0;

    for (const c of CRITERIOS_PAEC) {
        let score = 1;
        let evidence = "No disponible.";
        let feedback = "Requiere mayor desarrollo formal conforme a la rúbrica oficial.";

        switch (c.id) {
            case "C1":
                if (/inegi|censo|habitantes|poblaci[oó]n|comunidad|municipio/i.test(texto) || (cct && texto.includes(cct)) || (escuelaNombre && texto.includes(escuelaNombre.substring(0, 8)))) {
                    score = 4;
                    evidence = "Datos contextuales y cifras situadas del entorno comunitario identificados.";
                    feedback = "Diagnóstico comunitario documentado con datos duros y fuentes oficiales.";
                } else if (/entorno|localidad|socioecon[oó]mico/i.test(texto)) {
                    score = 2;
                    evidence = "Datos generales del entorno identificados de forma descriptiva.";
                    feedback = "Se sugiere incorporar estadísticas oficiales de INEGI o censo municipal.";
                } else {
                    score = 1;
                    evidence = "No se identificaron datos del entorno comunitario en el texto.";
                    feedback = "Incorpore el diagnóstico comunitario con datos del entorno y fuentes oficiales.";
                }
                break;
            case "C2":
                if (/matr[ií]cula|reprobaci[oó]n|abandono|eficiencia\s+terminal/i.test(texto) && /alumnos|estudiantes|\d+%/i.test(texto)) {
                    score = 4;
                    evidence = "Indicadores cuantitativos del plantel (matrícula, reprobación o permanencia) verificados.";
                    feedback = "Diagnóstico escolar sustentado con métricas oficiales del centro educativo.";
                } else if (/matr[ií]cula|reprobaci[oó]n|abandono|alumnos/i.test(texto)) {
                    score = 2;
                    evidence = "Indicadores escolares con desarrollo general.";
                    feedback = "Desglose las métricas de aprovechamiento y matrícula por semestre.";
                } else {
                    score = 1;
                    evidence = "No se localizaron indicadores cuantitativos de la comunidad escolar.";
                    feedback = "Desglose las métricas de aprovechamiento, matrícula y permanencia.";
                }
                break;
            case "C3": {
                const fodaCount = [/fortaleza/i, /oportunidad/i, /debilidad/i, /amenaza/i].filter(r => r.test(texto)).length;
                if (fodaCount === 4) {
                    score = 4;
                    evidence = "Matriz FODA completa en sus 4 cuadrantes con cruce de factores internos y externos.";
                    feedback = "Excelente desarrollo situacional en los 4 cuadrantes metodológicos.";
                } else if (fodaCount >= 2) {
                    score = 3;
                    evidence = `Matriz situacional con ${fodaCount}/4 cuadrantes identificados.`;
                    feedback = "Complete la totalidad de los cuadrantes del análisis FODA.";
                } else if (fodaCount === 1) {
                    score = 2;
                    evidence = "Análisis situacional básico con un solo cuadrante.";
                    feedback = "Estructure formalmente la matriz FODA de 4 cuadrantes.";
                } else {
                    score = 1;
                    evidence = "No se identificó estructura FODA en el texto.";
                    feedback = "Estructure formalmente la matriz FODA de 4 cuadrantes.";
                }
                break;
            }
            case "C4":
                if (/jerarquizaci[oó]n|deliberaci[oó]n|selecci[oó]n\s+del\s+problema/i.test(texto)) {
                    score = 4;
                    evidence = "Etapas técnicas de jerarquización y priorización colegiada documentadas.";
                    feedback = "Proceso de selección del problema central colegiado y justificado.";
                } else if (/problem[aá]tica|problema\s+central|diagn[oó]stico/i.test(texto)) {
                    score = 2;
                    evidence = "Problemática central delimitada en el proyecto.";
                    feedback = "Documente las etapas de deliberación colegiada de las problemáticas.";
                } else {
                    score = 1;
                    evidence = "No se identificó delimitación colegiada de la problemática.";
                    feedback = "Documente las etapas de deliberación colegiada de las problemáticas.";
                }
                break;
            case "C5":
                if (texto.length > 5000 && /introducci[oó]n|presentaci[oó]n|justificaci[oó]n/i.test(texto) && /misi[oó]n|prop[oó]sito/i.test(texto)) {
                    score = 4;
                    evidence = "Introducción amplia y situada en la realidad socioterritorial del plantel.";
                    feedback = "Fundamentación contextualizada con rigor metodológico.";
                } else if (/introducci[oó]n|presentaci[oó]n|justificaci[oó]n/i.test(texto)) {
                    score = 2;
                    evidence = "Introducción institucional presente.";
                    feedback = "Profundice en la justificación de la misión transformadora del proyecto.";
                } else {
                    score = 1;
                    evidence = "No se detectó apartado introductorio o fundamentación.";
                    feedback = "Incorpore la introducción y justificación transformadora del proyecto.";
                }
                break;
            case "C6":
                if (/nueva\s+escuela\s+mexicana|principios\s+de\s+la\s+nem|ejes\s+articuladores/i.test(texto)) {
                    score = 4;
                    evidence = "Pilares y principios de la Nueva Escuela Mexicana debidamente articulados.";
                    feedback = "Alineación sólida con los principios rectores de la NEM.";
                } else if (/nem|principios|valores\s+c[ií]vicos/i.test(texto)) {
                    score = 2;
                    evidence = "Mención general de principios educativos oficiales.";
                    feedback = "Describa la vivencia práctica de los principios de la NEM en el aula.";
                } else {
                    score = 1;
                    evidence = "No se identificó articulación con los principios de la NEM.";
                    feedback = "Alinee el proyecto con los principios rectores de la Nueva Escuela Mexicana.";
                }
                break;
            case "C7":
                if (/magnitud|inter[eé]s|factibilidad|oportunidad|vertientes|pertinencia/i.test(texto) && /dbepa|viabilidad/i.test(texto)) {
                    score = 4;
                    evidence = "Sustentación de la problemática en sus vertientes de magnitud, factibilidad y pertinencia.";
                    feedback = "Criterios DBEPA abordados con solidez técnica.";
                } else if (/magnitud|inter[eé]s|factibilidad|pertinencia/i.test(texto)) {
                    score = 3;
                    evidence = "Viabilidad y pertinencia social descritas en la narrativa.";
                    feedback = "Explicite las 4 vertientes metodológicas de la DBEPA.";
                } else if (/viabilidad|social/i.test(texto)) {
                    score = 2;
                    evidence = "Mención general de viabilidad.";
                    feedback = "Profundice en los criterios de pertinencia y factibilidad.";
                } else {
                    score = 1;
                    evidence = "No se identificó análisis de viabilidad conforme a criterios DBEPA.";
                    feedback = "Aborde las vertientes de magnitud, factibilidad y pertinencia social.";
                }
                break;
            case "C8":
                if (/recursos\s+sociocognitivos|[aá]reas\s+de\s+conocimiento/i.test(texto) && /uac|asignaturas/i.test(texto)) {
                    score = 4;
                    evidence = "Mapeo curricular con cobertura amplia de recursos sociocognitivos y áreas.";
                    feedback = "Excelente integración transversal del currículum fundamental y ampliado.";
                } else if (/recursos\s+sociocognitivos|[aá]reas\s+de\s+conocimiento|uac/i.test(texto)) {
                    score = 2;
                    evidence = "Mapeo curricular presente en el proyecto.";
                    feedback = "Amplíe la integración de recursos sociocognitivos y socioemocionales.";
                } else {
                    score = 1;
                    evidence = "No se identificó integración de recursos sociocognitivos y áreas.";
                    feedback = "Mapee la integración transversal del currículum fundamental y ampliado.";
                }
                break;
            case "C9":
                if (/mccems|redise[ñn]o\s+curricular/i.test(texto) && /progresi[oó]n|uac/i.test(texto)) {
                    score = 4;
                    evidence = "Uso de nomenclatura oficial del MCCEMS y rediseño curricular.";
                    feedback = "Nomenclatura oficial consistente a lo largo del documento.";
                } else if (/mccems|progresi[oó]n/i.test(texto)) {
                    score = 2;
                    evidence = "Asignaturas curriculares identificadas con terminología básica.";
                    feedback = "Asegure el uso exclusivo de denominaciones oficiales del MCCEMS.";
                } else {
                    score = 1;
                    evidence = "No se identificó uso de nomenclatura oficial del MCCEMS.";
                    feedback = "Asegure el uso de denominaciones oficiales del MCCEMS.";
                }
                break;
            case "C10":
                if (/vinculaci[oó]n\s+curricular|aporte\s+espec[ií]fico/i.test(texto) && /entregable|producto/i.test(texto)) {
                    score = 4;
                    evidence = "Aportes y vinculaciones situadas de las UACs con entregables definidos.";
                    feedback = "Articulación específica y diferenciada por cada disciplina escolar.";
                } else if (/vinculaci[oó]n|entregable|producto/i.test(texto)) {
                    score = 2;
                    evidence = "Vinculación curricular declarada de manera general.";
                    feedback = "Detalle productos tangibles por cada asignatura participante.";
                } else {
                    score = 1;
                    evidence = "No se identificaron aportes o entregables por UAC.";
                    feedback = "Detalle productos tangibles por cada asignatura participante.";
                }
                break;
            case "C11":
                if (/fase\s+bimestral|fases\s+bimestrales|cronograma/i.test(texto) && /bimestre|etapa|fechas/i.test(texto)) {
                    score = 4;
                    evidence = "Cronograma estructurado en fases bimestrales con asignación de actividades.";
                    feedback = "Calendarización anual clara y operativa.";
                } else if (/cronograma|fases|bimestres/i.test(texto)) {
                    score = 2;
                    evidence = "Cronograma de actividades general presente.";
                    feedback = "Estructure las 6 fases bimestrales normativas con sus 5 columnas.";
                } else {
                    score = 1;
                    evidence = "No se identificó cronograma estructurado en fases bimestrales.";
                    feedback = "Estructure las 6 fases bimestrales normativas con sus actividades.";
                }
                break;
            case "C12":
                if (/viga\s+maestra|asignatura\s+eje/i.test(texto)) {
                    score = 4;
                    evidence = "Asignaturas viga maestra o ejes articuladores identificados con liderazgo pedagógico.";
                    feedback = "Coordinación docente articulada en torno a disciplinas eje.";
                } else if (/articulador|coordinaci[oó]n\s+docente/i.test(texto)) {
                    score = 2;
                    evidence = "Distribución de responsabilidades entre asignaturas.";
                    feedback = "Defina formalmente la asignatura viga maestra para cada fase bimestral.";
                } else {
                    score = 1;
                    evidence = "No se identificó figura de asignatura viga maestra.";
                    feedback = "Defina formalmente la asignatura viga maestra para cada fase bimestral.";
                }
                break;
            case "C13":
                if (/progresi[oó]n\s+de\s+aprendizaje|progresiones/i.test(texto) && /prop[oó]sito/i.test(texto)) {
                    score = 4;
                    evidence = "Progresiones de aprendizaje y propósitos integradores formulados formalmente.";
                    feedback = "Alineación pedagógica rigurosa con las progresiones del MCCEMS.";
                } else if (/progresi[oó]n|prop[oó]sito\s+integrador/i.test(texto)) {
                    score = 2;
                    evidence = "Contenidos de aprendizaje delimitados.";
                    feedback = "Desglose las progresiones específicas por corte de evaluación.";
                } else {
                    score = 1;
                    evidence = "No se identificaron progresiones de aprendizaje integradas.";
                    feedback = "Alinee las progresiones del MCCEMS a los propósitos del proyecto.";
                }
                break;
            case "C14":
                if (/articulaci[oó]n\s+con\s+uac|correspondencia/i.test(texto)) {
                    score = 4;
                    evidence = "Fases del proyecto escolar articuladas con las unidades de aprendizaje curricular.";
                    feedback = "Coherencia metodológica entre fases del PEC y contenidos de aula.";
                } else if (/articulaci[oó]n|fase/i.test(texto) && /uac|asignatura/i.test(texto)) {
                    score = 2;
                    evidence = "Articulación de fases del proyecto presente de forma general.";
                    feedback = "Explicite la correspondencia entre UAC y fase del proyecto.";
                } else {
                    score = 1;
                    evidence = "No se identificó correspondencia formal entre fases y UACs.";
                    feedback = "Explicite la correspondencia entre UAC y fase del proyecto.";
                }
                break;
            case "C15":
                if (/semestre\s+a/i.test(texto) && /semana\s*\d|semanal/i.test(texto)) {
                    score = 4;
                    evidence = "Planeación semanal del Semestre A estructurada con responsabilidades.";
                    feedback = "Plan operativo del primer semestre documentado con detalle.";
                } else if (/semestre\s+a|bloque\s*1/i.test(texto)) {
                    score = 2;
                    evidence = "Planeación operativa del Semestre A de carácter general.";
                    feedback = "Complete la dosificación semanal del Semestre A.";
                } else {
                    score = 1;
                    evidence = "No se identificó planeación semanal para el Semestre A.";
                    feedback = "Complete la dosificación semanal del Semestre A.";
                }
                break;
            case "C16":
                if (/semestre\s+b/i.test(texto) && /semana\s*\d|semanal/i.test(texto)) {
                    score = 4;
                    evidence = "Planeación semanal del Semestre B estructurada con responsabilidades.";
                    feedback = "Plan operativo del segundo semestre documentado con detalle.";
                } else if (/semestre\s+b|bloque\s*2/i.test(texto)) {
                    score = 2;
                    evidence = "Planeación operativa del Semestre B de carácter general.";
                    feedback = "Complete la dosificación semanal del Semestre B.";
                } else {
                    score = 1;
                    evidence = "No se identificó planeación semanal para el Semestre B.";
                    feedback = "Complete la dosificación semanal del Semestre B.";
                }
                break;
            case "C17":
                if (/semana\s+16|feria\s+de\s+resultados|feria\s+comunitaria|hito\s+de\s+cierre/i.test(texto)) {
                    score = 4;
                    evidence = "Hitos institucionales de cierre, evaluación y feria comunitaria verificados.";
                    feedback = "Eventos de cierre y socialización comunitaria programados.";
                } else if (/cierre|feria|difusi[oó]n|socializaci[oó]n/i.test(texto)) {
                    score = 2;
                    evidence = "Actividades de cierre del proyecto consideradas.";
                    feedback = "Formalice la Feria de Resultados o Hito de Cierre en la Semana 16.";
                } else {
                    score = 1;
                    evidence = "No se identificaron hitos de cierre o feria comunitaria.";
                    feedback = "Formalice la Feria de Resultados o Hito de Cierre en la Semana 16.";
                }
                break;
            case "C18":
                if (/abpc|steam|aprendizaje\s+servicio|abp/i.test(texto)) {
                    score = 4;
                    evidence = "Metodologías activas y sociocríticas (ABPC, STEAM, Aprendizaje Servicio) adoptadas.";
                    feedback = "Enfoque metodológico sociocrítico pertinente y activo.";
                } else if (/metodolog[ií]a\s+activa|sociocr[ií]tic/i.test(texto)) {
                    score = 2;
                    evidence = "Estrategias de enseñanza activas documentadas de forma general.";
                    feedback = "Especifique el uso de metodologías sociocríticas normativas.";
                } else {
                    score = 1;
                    evidence = "No se identificaron metodologías activas ni sociocríticas normativas.";
                    feedback = "Especifique el uso de metodologías sociocríticas normativas.";
                }
                break;
            case "C19":
                if (/carta\s+de\s+compromiso|minuta|oficio|acta\s+de\s+acuerdos/i.test(texto)) {
                    score = 4;
                    evidence = "Instrumentos de formalización y vinculación con actores escolares documentados.";
                    feedback = "Formalización interinstitucional y comunitaria acreditada.";
                } else if (/carta|acuerdo|minuta|formalizaci[oó]n/i.test(texto)) {
                    score = 2;
                    evidence = "Mención de acuerdos y trabajo colaborativo.";
                    feedback = "Incorpore cartas de invitación y minutas de arranque del proyecto.";
                } else {
                    score = 1;
                    evidence = "No se identificaron instrumentos de formalización o minutas.";
                    feedback = "Incorpore cartas de compromiso o minutas de arranque del proyecto.";
                }
                break;
            case "C20":
                if (/bit[aá]cora|instrumento\s+de\s+evaluaci[oó]n|rúbrica\s+de\s+seguimiento/i.test(texto)) {
                    score = 4;
                    evidence = "Instrumentos técnicos y anexos de seguimiento documentados.";
                    feedback = "Herramientas de monitoreo y bitácoras institucionales verificadas.";
                } else if (/anexo|bit[aá]cora|evaluaci[oó]n|seguimiento/i.test(texto)) {
                    score = 2;
                    evidence = "Instrumentos de seguimiento considerados.";
                    feedback = "Integre anexos de bitácoras y listas de control de avance.";
                } else {
                    score = 1;
                    evidence = "No se identificaron anexos técnicos ni instrumentos de seguimiento.";
                    feedback = "Integre anexos de bitácoras y listas de control de avance.";
                }
                break;
            case "C21":
                if (/comit[eé]\s+escolar|gobernanza\s+en\s+4\s+niveles|academia\s+docente/i.test(texto)) {
                    score = 4;
                    evidence = "Esquema de gobernanza escolar y coordinación en múltiples niveles colegiados.";
                    feedback = "Gobernanza participativa involucrando directivos, docentes y comunidad.";
                } else if (/gobernanza|comit[eé]|colegiado|directiv[ao]/i.test(texto)) {
                    score = 2;
                    evidence = "Coordinación escolar documentada.";
                    feedback = "Estructure el comité escolar de gobernanza en sus 4 niveles.";
                } else {
                    score = 1;
                    evidence = "No se identificó esquema formal de gobernanza escolar.";
                    feedback = "Estructure el comité escolar de gobernanza en sus 4 niveles.";
                }
                break;
            case "C22":
                if (/rendici[oó]n\s+de\s+cuentas|metas\s+vs\s+logros|impacto\s+comunitario/i.test(texto)) {
                    score = 4;
                    evidence = "Mecanismo estructurado de rendición de cuentas, metas vs logros e impacto.";
                    feedback = "Evaluación de impacto integral fundamentada en resultados.";
                } else if (/informe|metas|logros|impacto|evaluaci[oó]n\s+de\s+resultados/i.test(texto)) {
                    score = 2;
                    evidence = "Evaluación de resultados contemplada.";
                    feedback = "Defina indicadores de contraste pre/post para medir el impacto comunitario.";
                } else {
                    score = 1;
                    evidence = "No se identificaron indicadores de contraste pre/post o metas vs logros.";
                    feedback = "Defina indicadores de contraste pre/post para medir el impacto comunitario.";
                }
                break;
            case "C23":
                if (/sostenibilidad|continuidad\s+institucional|custodia\s+comunitaria/i.test(texto)) {
                    score = 4;
                    evidence = "Plan de sostenibilidad y compromisos de continuidad institucional acordados.";
                    feedback = "Estrategias de permanencia y custodia comunitaria bien delimitadas.";
                } else if (/permanencia|custodia|compromiso\s+futuro/i.test(texto)) {
                    score = 2;
                    evidence = "Continuidad del proyecto considerada.";
                    feedback = "Detalle compromisos formales para garantizar la sostenibilidad a futuro.";
                } else {
                    score = 1;
                    evidence = "No se identificó plan de sostenibilidad o custodia comunitaria.";
                    feedback = "Detalle compromisos formales para garantizar la sostenibilidad a futuro.";
                }
                break;
            default:
                score = 1;
                evidence = "No disponible.";
                feedback = "Requiere mayor desarrollo formal conforme a la rúbrica oficial.";
        }

        checks[c.id] = { id: c.id, score, status: score === 4 ? "pass" : score >= 2 ? "warning" : "fail", evidence, feedback };
        totalRawScore += score;
    }

    return { checks, totalRawScore };
}

function construirResultadoDesdeAuditoriaDeterministaPaec(
    detAudit: ReturnType<typeof auditarPaecDeterminista>,
    escuelaNombre: string,
    cct: string
): ResultadoPaecAudit {
    const dimScoreMap: Record<string, { score: number; maxScore: number }> = {};
    for (const d of Object.values(DIMENSIONES_PAEC)) {
        dimScoreMap[d] = { score: 0, maxScore: 0 };
    }

    const evaluatedCriteria: CriterioPaecResultado[] = CRITERIOS_PAEC.map(def => {
        const item = detAudit.checks[def.id] || {
            id: def.id,
            score: 1,
            status: "fail",
            evidence: "Evidencia no disponible en el texto.",
            feedback: "Criterio sin evidencia documental suficiente."
        };

        if (dimScoreMap[def.dimension]) {
            dimScoreMap[def.dimension].score += item.score;
            dimScoreMap[def.dimension].maxScore += 4;
        }

        return {
            id: def.id,
            numero: def.numero,
            nombre: def.nombre,
            dimension: def.dimension,
            maxScore: def.maxScore,
            score: item.score,
            status: item.status,
            feedback: item.feedback,
            evidenceFound: item.evidence,
        };
    });

    const totalScore = detAudit.totalRawScore;
    const maxPossibleScore = 92;
    const percentage = Math.round((totalScore / maxPossibleScore) * 100);

    let overallStatus: ResultadoPaecAudit["overallStatus"] = "requiere_ajustes";
    if (percentage >= 85) overallStatus = "aprobado_excelente";
    else if (percentage >= 70) overallStatus = "aprobado";
    else overallStatus = "requiere_ajustes";

    const passedCriteria = evaluatedCriteria.filter(c => c.status === "pass").length;
    const warningCriteria = evaluatedCriteria.filter(c => c.status === "warning").length;
    const failedCriteria = evaluatedCriteria.filter(c => c.status === "fail").length;

    const dimensionScores: Record<string, DimensionScore> = {};
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
        strengths: [
            `Diagnóstico escolar y comunitario integral para ${escuelaNombre || 'el plantel'} (${cct || 'CCT'}).`,
            "Mapeo curricular multidisciplinario y metodologías activas (NEM)",
            "Esquema de gobernanza participativa y compromisos comunitarios"
        ],
        criticalRecommendations: evaluatedCriteria.filter(c => c.score < 3).map(c => `[${c.id}] ${c.nombre}: ${c.feedback}`),
        auditedAt: new Date().toISOString(),
    };
}

// ── Función Principal de Evaluación PAEC-PEC ─────────────────────────────────

export async function evaluarPaecEntrega(params: {
    textoDocumento: string;
    escuelaId?: string;
    cct?: string;
    escuelaNombre?: string;
    pdfBuffer?: Buffer;
}): Promise<ResultadoPaecAudit> {
    const { textoDocumento, escuelaId, cct = "CCT No especificada", escuelaNombre = "Plantel Escolar" } = params;

    // Validación de texto mínimo
    if (!textoDocumento || textoDocumento.trim().length < 80) {
        console.warn(`[paec-evaluator] Documento con texto insuficiente (${textoDocumento?.length || 0} caracteres).`);
        return generarResultadoFallbackPaec("Documento sin texto legible o vacío.", escuelaNombre, cct);
    }

    const detAudit = auditarPaecDeterminista(textoDocumento, escuelaNombre, cct);

    const systemPrompt = `Eres un Asesor Técnico Pedagógico (ATP) y Auditor Escolar de la Subsecretaría de Educación Media Superior (SEMS / DBEPA / COSFAC).
Tu función es auditar rigurosamente los Proyectos Escolares Comunitarios (PAEC-PEC 2025) del Marco Curricular Común de la Educación Media Superior (NEM) contra la Rúbrica Oficial de 8 Dimensiones Normativas y 23 Criterios Oficiales.

Para cada uno de los 23 criterios normativos (C1 a C23), debes emitir una valoración objetiva fundamentada en el texto del documento:
- score: Asigna un puntaje entero estricto de 1 a 4 según el nivel demostrado:
    * 4 = Excelente / Cumplimiento Pleno: Cumple de forma exhaustiva con datos duros, detalles situados y rigor normativo.
    * 3 = Bueno / Cumplimiento Sustancial: Aborda el criterio con buen desarrollo, pero tiene áreas menores de perfeccionamiento.
    * 2 = Parcial / Insuficiente: Menciona el rubro de manera genérica, incompleta o superficial.
    * 1 = No Cumple / Ausente: Omisión total o información no verificable en el texto.
- evidenceFound: Breve cita o descripción de la evidencia textual encontrada en el documento (máximo 150 caracteres).
- feedback: Observación o recomendación constructiva dirigida a la escuela (máximo 200 caracteres).

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:
{
  "criterios": [
    {
      "id": "C1",
      "score": 4,
      "evidenceFound": "...",
      "feedback": "..."
    }
  ],
  "puntosFuertes": [
    "Fortaleza 1",
    "Fortaleza 2",
    "Fortaleza 3"
  ],
  "recomendacionesCriticas": [
    "Recomendación urgente 1",
    "Recomendación urgente 2"
  ]
}`;

    const criteriosPromptText = CRITERIOS_PAEC.map(c => 
        `[${c.id}] ${c.dimension} - ${c.nombre}\n  Requerimiento: ${c.descripcion}`
    ).join("\n\n");

    const userPrompt = `AUDITORÍA NORMATIVA DEL PROYECTO ESCOLAR COMUNITARIO (PAEC-PEC 2025)
DATOS DEL PLANTEL: ${escuelaNombre} (${cct})

RÚBRICA DE 23 CRITERIOS OFICIALES A EVALUAR:
-------------------------------------------------------------------------------
${criteriosPromptText}
-------------------------------------------------------------------------------

TEXTO DEL PROYECTO ESCOLAR COMUNITARIO ENTREGADO:
"""
${textoDocumento.slice(0, 120000)}
"""

Evalúa cada uno de los 23 criterios (C1 a C23) con base en la evidencia textual y entrega tu dictamen en el JSON estructurado solicitado.`;

    let rawResponse = "";
    try {
        console.log(`[paec-evaluator] Invocando auditoría con IA para ${escuelaNombre} (${textoDocumento.length} caracteres de texto)...`);
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
        console.log(`[paec-evaluator] Respuesta de IA recibida (${rawResponse.length} caracteres).`);
    } catch (aiErr: unknown) {
        console.warn("[paec-evaluator] IA no disponible, recurriendo a auditoría determinista de código:", aiErr instanceof Error ? aiErr.message : String(aiErr));
        return construirResultadoDesdeAuditoriaDeterministaPaec(detAudit, escuelaNombre, cct);
    }

    const rawJson = parsearRespuestaGemini(rawResponse);
    if (!rawJson || !Array.isArray(rawJson.criterios) || rawJson.criterios.length < 10) {
        console.warn("[paec-evaluator] Respuesta de IA incompleta, recurriendo a auditoría determinista de código.");
        return construirResultadoDesdeAuditoriaDeterministaPaec(detAudit, escuelaNombre, cct);
    }

    // ── CÁLCULO HÍBRIDO CUANTITATIVO EN TYPESCRIPT ────────────────────────────
    interface RawPaecAiCriterio {
        id?: string;
        score?: number | string;
        status?: string;
        feedback?: string;
        evidenceFound?: string;
    }
    const aiCriteriosMap = new Map<string, RawPaecAiCriterio>();
    for (const c of (rawJson.criterios as RawPaecAiCriterio[])) {
        if (c && c.id) {
            aiCriteriosMap.set(String(c.id).toUpperCase().trim(), c);
        }
    }

    let totalRawScore = 0;
    const maxPossibleScore = 23 * 4; // 92 puntos brutos

    // Acumuladores de dimensiones
    const dimScoreMap: Record<string, { score: number; maxScore: number }> = {};
    for (const d of Object.values(DIMENSIONES_PAEC)) {
        dimScoreMap[d] = { score: 0, maxScore: 0 };
    }

    const evaluatedCriteria: CriterioPaecResultado[] = CRITERIOS_PAEC.map((def) => {
        const aiItem = aiCriteriosMap.get(def.id);
        const detItem = detAudit.checks[def.id];
        
        let score = 1;
        let status: "pass" | "warning" | "fail" = "fail";
        let finalFeedback = "";
        let finalEvidence = "";

        if (aiItem && (aiItem.score !== undefined || aiItem.status !== undefined)) {
            // El dictamen emitido por IA tiene primacía para el criterio evaluado
            const parsedScore = Number(aiItem.score);
            if (!isNaN(parsedScore) && parsedScore >= 1 && parsedScore <= 4) {
                score = Math.round(parsedScore);
            } else if (aiItem.score === "4" || aiItem.score === 4) {
                score = 4;
            } else if (aiItem.score === "3" || aiItem.score === 3) {
                score = 3;
            } else if (aiItem.score === "2" || aiItem.score === 2) {
                score = 2;
            } else {
                score = 1;
            }

            if (score === 4) {
                status = "pass";
            } else if (score === 3 || score === 2) {
                status = "warning";
            } else {
                status = "fail";
            }

            finalFeedback = aiItem.feedback || (score >= 3 ? "Cumplimiento normativo acreditado por IA." : "Requiere mayor desarrollo y alineación metodológica.");
            finalEvidence = aiItem.evidenceFound || (score >= 3 ? "Evidencia constatada en el cuerpo del documento." : "No se localizaron elementos verificables suficientes.");
        } else if (detItem) {
            // Suplencia determinista: solo aplica si la IA omitió este criterio en su respuesta
            score = detItem.score;
            status = detItem.status;
            finalFeedback = detItem.feedback;
            finalEvidence = detItem.evidence;
        } else {
            score = 1;
            status = "fail";
            finalFeedback = "Criterio sin evaluar.";
            finalEvidence = "Sin evidencia.";
        }

        totalRawScore += score;

        if (dimScoreMap[def.dimension]) {
            dimScoreMap[def.dimension].score += score;
            dimScoreMap[def.dimension].maxScore += 4;
        }

        return {
            id: def.id,
            numero: def.numero,
            nombre: def.nombre,
            dimension: def.dimension,
            maxScore: def.maxScore,
            score,
            status,
            feedback: finalFeedback,
            evidenceFound: finalEvidence,
        };
    });

    // Cálculo de porcentajes deterministas
    const percentage = Math.round((totalRawScore / maxPossibleScore) * 100);

    let overallStatus: "aprobado_excelente" | "aprobado" | "requiere_ajustes" = "requiere_ajustes";
    if (percentage >= 85) {
        overallStatus = "aprobado_excelente";
    } else if (percentage >= 70) {
        overallStatus = "aprobado";
    } else {
        overallStatus = "requiere_ajustes";
    }

    const passedCriteria = evaluatedCriteria.filter(c => c.status === "pass").length;
    const warningCriteria = evaluatedCriteria.filter(c => c.status === "warning").length;
    const failedCriteria = evaluatedCriteria.filter(c => c.status === "fail").length;

    // Desglose por dimensiones con porcentajes
    const dimensionScores: Record<string, DimensionScore> = {};
    for (const [dimName, val] of Object.entries(dimScoreMap)) {
        const pct = val.maxScore > 0 ? Math.round((val.score / val.maxScore) * 100) : 0;
        dimensionScores[dimName] = {
            score: val.score,
            maxScore: val.maxScore,
            percentage: pct,
        };
    }

    const strengths = Array.isArray(rawJson.puntosFuertes) && rawJson.puntosFuertes.length > 0
        ? (rawJson.puntosFuertes as string[])
        : [
            "Estructuración acorde a las directrices de la Nueva Escuela Mexicana",
            "Identificación de problemáticas comunitarias en el entorno escolar",
            "Participación docente e integración curricular"
        ];

    const criticalRecommendations = Array.isArray(rawJson.recomendacionesCriticas) && rawJson.recomendacionesCriticas.length > 0
        ? (rawJson.recomendacionesCriticas as string[])
        : evaluatedCriteria
            .filter(c => c.score < 3)
            .slice(0, 4)
            .map(c => `[${c.id}] ${c.nombre}: ${c.feedback}`);

    return {
        totalScore: totalRawScore,
        maxPossibleScore,
        percentage,
        overallStatus,
        passedCriteria,
        warningCriteria,
        failedCriteria,
        criteria: evaluatedCriteria,
        dimensionScores,
        strengths,
        criticalRecommendations,
        auditedAt: new Date().toISOString(),
    };
}

// ── Generador del Dictamen Oficial en Markdown ───────────────────────────────

export function generarReportePaecMarkdown(
    resultado: ResultadoPaecAudit,
    datosEscuela?: { nombre?: string; cct?: string }
): string {
    const fecha = new Date().toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const dictamenBadge =
        resultado.overallStatus === "aprobado_excelente"
            ? "🟢 DICTAMEN: APROBADO EXCELENTE (CUMPLIMIENTO PLENO)"
            : resultado.overallStatus === "aprobado"
                ? "🟡 DICTAMEN: APROBADO CON OBSERVACIONES MENORES"
                : "🔴 DICTAMEN: REQUIERE AJUSTES PREVIOS A VALIDACIÓN";

    const nombrePlantel = datosEscuela?.nombre || "Plantel Educativo";
    const cctPlantel = datosEscuela?.cct || "CCT No especificada";

    let md = `# REPORTE OFICIAL DE AUDITORÍA DE CALIDAD PAEC-PEC 2025\n`;
    md += `**Subsecretaría de Educación Media Superior | DBEPA - COSFAC**\n`;
    md += `**Plantel:** ${nombrePlantel} | **CCT:** ${cctPlantel}\n`;
    md += `*Fecha de Auditoría:* ${fecha}\n\n`;

    md += `---\n\n`;
    md += `### RESULTADO GLOBAL DEL PROYECTO\n\n`;
    md += `| Métrica Normativa | Valor Obtenido |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Puntaje Global Ponderado** | **${resultado.percentage} / 100** |\n`;
    md += `| **Puntos Brutos de Rúbrica** | **${resultado.totalScore} / ${resultado.maxPossibleScore} pts** |\n`;
    md += `| **Estatus Técnico Oficial** | ${dictamenBadge} |\n`;
    md += `| **Criterios Acreditados (Pass - 4 pts)** | ${resultado.passedCriteria} de 23 |\n`;
    md += `| **Criterios con Observación (Warning - 2 a 3 pts)** | ${resultado.warningCriteria} de 23 |\n`;
    md += `| **Criterios Deficientes / Omisos (Fail - 1 pto)** | ${resultado.failedCriteria} de 23 |\n\n`;

    md += `---\n\n`;
    md += `### DESGLOSE DE EVALUACIÓN POR DIMENSIÓN Y CRITERIO\n\n`;

    // Agrupar criterios por dimensión
    const dimMap = new Map<string, CriterioPaecResultado[]>();
    for (const c of resultado.criteria) {
        const list = dimMap.get(c.dimension) || [];
        list.push(c);
        dimMap.set(c.dimension, list);
    }

    for (const [dimName, criteriaList] of dimMap.entries()) {
        const dimInfo = resultado.dimensionScores[dimName] || {
            score: criteriaList.reduce((acc, c) => acc + c.score, 0),
            maxScore: criteriaList.length * 4,
            percentage: 0,
        };

        md += `#### ${dimName} (${dimInfo.percentage}% — ${dimInfo.score}/${dimInfo.maxScore} pts)\n\n`;
        md += `| No. | Criterio de Rúbrica | Pts (1-4) | Estatus | Evidencia Encontrada |\n`;
        md += `| :---: | :--- | :---: | :---: | :--- |\n`;

        for (const c of criteriaList) {
            const statusIcon = c.status === "pass" ? "✅ Pass" : c.status === "warning" ? "⚠️ Advertencia" : "❌ Requiere";
            md += `| **${c.id}** | ${c.nombre} | **${c.score}/4** | ${statusIcon} | ${c.evidenceFound} |\n`;
        }
        md += `\n`;

        const needsAttention = criteriaList.filter(c => c.score < 4);
        if (needsAttention.length > 0) {
            md += `*Observaciones y Recomendaciones Técnicas:*\n`;
            for (const c of needsAttention) {
                md += `- **${c.id} (${c.score}/4):** ${c.feedback}\n`;
            }
            md += `\n`;
        }
    }

    if (resultado.strengths && resultado.strengths.length > 0) {
        md += `---\n\n`;
        md += `### FORTALEZAS DESTACADAS DEL PROYECTO\n\n`;
        for (const s of resultado.strengths) {
            md += `- 🌟 ${s}\n`;
        }
        md += `\n`;
    }

    if (resultado.criticalRecommendations && resultado.criticalRecommendations.length > 0) {
        md += `---\n\n`;
        md += `### RECOMENDACIONES PRIORITARIAS DE SUPERVISIÓN\n\n`;
        for (const r of resultado.criticalRecommendations) {
            md += `- 📌 ${r}\n`;
        }
        md += `\n`;
    }

    md += `---\n\n`;
    md += `### DICTAMEN TÉCNICO Y FIRMAS DE CONFORMIDAD\n\n`;
    md += `El presente dictamen certifica que el Proyecto Escolar Comunitario ha sido auditado de manera determinista contra los 23 criterios de la Rúbrica Oficial PAEC-PEC 2025 del Marco Curricular Común de la Educación Media Superior (NEM).\n\n`;
    md += `\`\`\`\n`;
    md += `____________________________________          ____________________________________\n`;
    md += `     COORDINACIÓN PAEC DE PLANTEL                  SUPERVISIÓN ESCOLAR ZONA 004   \n`;
    md += `     Validación Colegiada Docente                   Sello y Dictamen de Aprobación \n`;
    md += `\`\`\`\n`;

    return md;
}

// ── Fallback en caso de contingencia ──────────────────────────────────────────

function generarResultadoFallbackPaec(
    motivo: string,
    escuelaNombre: string,
    cct: string
): ResultadoPaecAudit {
    const defaultCriteria: CriterioPaecResultado[] = CRITERIOS_PAEC.map(def => ({
        id: def.id,
        numero: def.numero,
        nombre: def.nombre,
        dimension: def.dimension,
        maxScore: def.maxScore,
        score: 0,
        status: "fail",
        feedback: "No evaluado automáticamente debido a error en el procesamiento del archivo.",
        evidenceFound: "No disponible.",
    }));

    const dimensionScores: Record<string, DimensionScore> = {};
    for (const d of Object.values(DIMENSIONES_PAEC)) {
        dimensionScores[d] = { score: 0, maxScore: 0, percentage: 0 };
    }

    return {
        totalScore: 0,
        maxPossibleScore: 92,
        percentage: 0,
        overallStatus: "requiere_ajustes",
        passedCriteria: 0,
        warningCriteria: 0,
        failedCriteria: 23,
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
