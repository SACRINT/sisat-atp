import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { callGemini } from '@/lib/gemini';

export interface AnalisisHallazgosResult {
  categoria: string;
  hallazgos: string[];
  nivelCumplimiento: 'optimo' | 'aceptable' | 'regular' | 'requiere_atencion_urgente';
  recomendaciones: string[];
  urgencia: 'baja' | 'media' | 'alta' | 'critica';
  resumenEjecutivo: string;
}

const SYSTEM_INSTRUCTION = `Eres el Asistente Experto en Acompañamiento y Supervisión Técnico-Pedagógica de Educación Media Superior (SEP Puebla).
Tu tarea es analizar transcripciones de audio dictadas en campo por Asesores Técnico-Pedagógicos (ATPs) durante visitas de supervisión escolar (observación de clase, infraestructura, diagnóstico institucional, incidencias).

Debes estructurar y clasificar los comentarios dictados de forma precisa, objetiva y alineada al Marco Curricular Común (MCCEMS) y a las normas de la Supervisión de Bachilleratos.

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido que cumpla la siguiente estructura exacta (sin texto introductorio ni bloques de código markdown innecesarios):
{
  "categoria": "academica | infraestructura | gestion_directiva | convivencia_incidencias",
  "hallazgos": ["hallazgo 1 claro y concreto", "hallazgo 2..."],
  "nivelCumplimiento": "optimo | aceptable | regular | requiere_atencion_urgente",
  "recomendaciones": ["recomendación pedagógica o administrativa 1", "recomendación 2..."],
  "urgencia": "baja | media | alta | critica",
  "resumenEjecutivo": "Síntesis formal de 2-3 oraciones lista para el acta de supervisión"
}`;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { transcripcion, tipoCedula, contextoPlantel } = body;

    if (!transcripcion || typeof transcripcion !== 'string' || transcripcion.trim().length < 10) {
      return NextResponse.json(
        { error: 'Transcripción insuficiente para análisis (mínimo 10 caracteres).' },
        { status: 400 }
      );
    }

    const userPrompt = `
Tipo de Cédula de Supervisión: ${tipoCedula || 'OBSERVACION_CLASE'}
Contexto adicional del plantel: ${contextoPlantel || 'Bachillerato General Estatal - Zona Escolar Puebla'}

Transcripción dictada por el ATP en campo:
"""
${transcripcion.trim()}
"""

Analiza el texto dictado, extrae los puntos críticos, clasifica los hallazgos y genera recomendaciones de acompañamiento formativo conforme a la estructura JSON requerida.`;

    const rawResponse = await callGemini(SYSTEM_INSTRUCTION, userPrompt);

    // Parse JSON from response
    let parsed: AnalisisHallazgosResult;
    try {
      const cleanJson = rawResponse
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.warn('[analyze-hallazgos] Falló el parseo directo de JSON, usando fallback estructurado:', rawResponse);
      parsed = {
        categoria: tipoCedula === 'INFRAESTRUCTURA' ? 'infraestructura' : 'academica',
        hallazgos: [transcripcion.trim()],
        nivelCumplimiento: 'aceptable',
        recomendaciones: ['Dar seguimiento a las observaciones señaladas durante la próxima visita de supervisión.'],
        urgencia: 'media',
        resumenEjecutivo: rawResponse.slice(0, 250),
      };
    }

    return NextResponse.json({ analisis: parsed });
  } catch (error: any) {
    console.error('[API cedulas analyze error]:', error);
    return NextResponse.json(
      { error: 'Error al procesar el análisis con IA de la transcripción' },
      { status: 500 }
    );
  }
}
