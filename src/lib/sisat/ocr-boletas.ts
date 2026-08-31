import { callGemini } from '@/lib/gemini';

export interface CalificacionMateria {
  materia: string;
  calificacionParcial1?: number | null;
  calificacionParcial2?: number | null;
  calificacionParcial3?: number | null;
  calificacionFinal: number;
  asistenciaPorcentaje?: number | null;
  aprobada: boolean;
}

export interface AlumnoBoletaExtraido {
  nombreCompleto: string;
  matricula?: string;
  curp?: string;
  semestre?: number;
  grupo?: string;
  materias: CalificacionMateria[];
  promedioFinal: number;
  materiasReprobadas: number;
  estatusAcademico: 'REGULAR' | 'IRREGULAR' | 'REPETIDOR';
}

export interface BoletaOcrResultado {
  cicloEscolar: string;
  plantel?: string;
  cct?: string;
  semestre?: number;
  grupo?: string;
  totalAlumnos: number;
  promedioGrupo: number;
  alumnos: AlumnoBoletaExtraido[];
  confidence: number;
  observaciones?: string;
}

const OCR_BOLETAS_SYSTEM_PROMPT = `Eres un sistema experto de OCR e Inteligencia Documental especializado en formatos escolares oficiales de Educación Media Superior (SEP Puebla / SICEP / Bachilleratos Estatales y Tecnológicos).
Tu objetivo es analizar digitalizaciones o fotografías de boletas de calificaciones, kardex históricos o sábanas de evaluación y extraer estructuradamente toda la información académica con la máxima precisión posible.

Debes extraer:
1. Ciclo escolar (ej. "2024-2025", "2023-2024").
2. Datos del plantel (nombre y CCT si aparecen).
3. Semestre y grupo (ej. Semestre 2, Grupo "A").
4. Lista detallada de cada alumno identificado:
   - Nombre completo (APELLIDO PATERNO, APELLIDO MATERNO, NOMBRES).
   - Matrícula / No. de Control y CURP (si son legibles).
   - Calificaciones por cada materia (parciales 1, 2, 3 si existen, y calificación final del 5 al 10).
   - Promedio general o final calculado/registrado.
   - Conteo de materias no acreditadas (calificación < 6.0).
   - Estatus: "REGULAR" (todas aprobadas >= 6), "IRREGULAR" (1 a 2 reprobadas), "REPETIDOR" (3 o más).

Devuelve OBLIGATORIAMENTE un JSON estrictamente válido acorde a la estructura solicitada.`;

const OCR_BOLETAS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    cicloEscolar: { type: 'STRING' },
    plantel: { type: 'STRING' },
    cct: { type: 'STRING' },
    semestre: { type: 'INTEGER' },
    grupo: { type: 'STRING' },
    totalAlumnos: { type: 'INTEGER' },
    promedioGrupo: { type: 'NUMBER' },
    alumnos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nombreCompleto: { type: 'STRING' },
          matricula: { type: 'STRING' },
          curp: { type: 'STRING' },
          semestre: { type: 'INTEGER' },
          grupo: { type: 'STRING' },
          materias: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                materia: { type: 'STRING' },
                calificacionParcial1: { type: 'NUMBER', nullable: true },
                calificacionParcial2: { type: 'NUMBER', nullable: true },
                calificacionParcial3: { type: 'NUMBER', nullable: true },
                calificacionFinal: { type: 'NUMBER' },
                asistenciaPorcentaje: { type: 'NUMBER', nullable: true },
                aprobada: { type: 'BOOLEAN' },
              },
              required: ['materia', 'calificacionFinal', 'aprobada'],
            },
          },
          promedioFinal: { type: 'NUMBER' },
          materiasReprobadas: { type: 'INTEGER' },
          estatusAcademico: {
            type: 'STRING',
            enum: ['REGULAR', 'IRREGULAR', 'REPETIDOR'],
          },
        },
        required: ['nombreCompleto', 'materias', 'promedioFinal', 'materiasReprobadas', 'estatusAcademico'],
      },
    },
    observaciones: { type: 'STRING' },
  },
  required: ['cicloEscolar', 'alumnos', 'totalAlumnos'],
};

export async function procesarBoletaOcr(params: {
  fileBuffer?: Buffer;
  mimeType?: string;
  escuelaId?: string;
  cicloEscolarSugerido?: string;
  rawText?: string;
}): Promise<BoletaOcrResultado> {
  const { fileBuffer, mimeType = 'application/pdf', escuelaId, cicloEscolarSugerido = '2024-2025', rawText } = params;

  const prompt = `Analiza la siguiente boleta / sábana de calificaciones escaneada.
${cicloEscolarSugerido ? `Ciclo escolar de referencia: ${cicloEscolarSugerido}.` : ''}
${rawText ? `Texto OCR preliminar extraído:\n${rawText}\n` : ''}
Extrae con alta fidelidad todos los alumnos, materias, notas y promedios.`;

  try {
    const rawResponse = await callGemini(
      OCR_BOLETAS_SYSTEM_PROMPT,
      prompt,
      fileBuffer,
      mimeType,
      OCR_BOLETAS_SCHEMA,
      true, // usar modelo de alta precisión
      escuelaId
    );

    // Limpiar delimitadores markdown si el modelo los incluyó
    let cleanJson = rawResponse.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleanJson);

    // Calcular estadísticas y score de confianza
    const alumnos = Array.isArray(parsed.alumnos) ? parsed.alumnos : [];
    let sumPromedios = 0;
    let validPromedios = 0;

    for (const al of alumnos) {
      if (typeof al.promedioFinal === 'number' && !isNaN(al.promedioFinal)) {
        sumPromedios += al.promedioFinal;
        validPromedios++;
      }
    }

    const promedioGrupo = validPromedios > 0 ? Number((sumPromedios / validPromedios).toFixed(2)) : (parsed.promedioGrupo || 0);

    // Estimación heurística de confianza basada en extracción de campos clave
    let confidence = 0.85;
    if (alumnos.length > 0) {
      const hasCurpOrMat = alumnos.some((a: any) => a.curp || a.matricula);
      const hasMaterias = alumnos.every((a: any) => Array.isArray(a.materias) && a.materias.length > 0);
      if (hasCurpOrMat && hasMaterias) confidence = 0.95;
      else if (hasMaterias) confidence = 0.90;
    }

    return {
      cicloEscolar: parsed.cicloEscolar || cicloEscolarSugerido,
      plantel: parsed.plantel,
      cct: parsed.cct,
      semestre: parsed.semestre,
      grupo: parsed.grupo,
      totalAlumnos: alumnos.length || parsed.totalAlumnos || 0,
      promedioGrupo,
      alumnos,
      confidence,
      observaciones: parsed.observaciones || 'Extracción estructurada con éxito',
    };
  } catch (error: any) {
    console.error('[procesarBoletaOcr error]:', error);
    throw new Error(`Error en el procesamiento OCR de la boleta: ${error?.message || String(error)}`);
  }
}
