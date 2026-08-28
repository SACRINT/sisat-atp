import { callGemini } from "../gemini";

export interface EvaluacionCulturaPaz {
  aprobado: boolean;
  puntuacion: string;
  resumenActividad: string;
  tieneEvidenciaFotografica: boolean;
  tieneFirmasSellos: boolean;
  participantesEstimados?: string;
  observaciones: string;
  estadoRecomendado: "APROBADO" | "REQUIERE_CORRECCION";
}

export async function evaluarCulturaPaz(
  extractedText: string,
  buffer?: Buffer,
  escuelaInfo?: { nombre: string; cct: string },
  actividadNombre?: string,
  escuelaId?: string
): Promise<EvaluacionCulturaPaz> {
  const systemInstruction = "Eres un Asesor Técnico Pedagógico (ATP) de supervisión escolar de bachilleratos, experto en revisión y dictamen de evidencias de Cultura de Paz.";

  const prompt = `Analiza este documento de evidencia entregado por la escuela ${escuelaInfo?.nombre || "Plantel"} (${escuelaInfo?.cct || "S/CCT"}) correspondiente a la actividad de Cultura de Paz: **"${actividadNombre || "Actividad de Cultura de Paz"}"**.

Tu objetivo como ATP es evaluar la calidad de la evidencia presentada para determinar si cumple con los requerimientos y extraer información clave que permita integrar el informe institucional de la zona escolar.

Criterios de evaluación:
1. **Propósito y Desarrollo:** ¿El documento explica claramente el objetivo de la actividad y cómo se llevó a cabo?
2. **Resultados y Participación:** ¿Se describen aprendizajes, resultados o se menciona la cantidad/tipo de participantes (estudiantes, docentes, padres)?
3. **Evidencia:** ¿Se incluyen fotografías, carteles, actas o productos elaborados por los alumnos/comunidad?
4. **Formalidad:** ¿Cuenta con firma del director o sello institucional?

Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
{
  "aprobado": true/false,
  "puntuacion": "Porcentaje de cumplimiento (ej. '90%')",
  "resumenActividad": "Breve síntesis ejecutiva de la actividad realizada (máx 3 líneas) para apoyar al ATP a llenar el informe institucional.",
  "tieneEvidenciaFotografica": true/false,
  "tieneFirmasSellos": true/false,
  "participantesEstimados": "Número o sectores identificados (ej. 'Aprox 120 alumnos y 8 docentes')",
  "observaciones": "Comentarios detallados de fortalezas y áreas de oportunidad encontradas (máx 250 palabras).",
  "estadoRecomendado": "APROBADO" o "REQUIERE_CORRECCION"
}`;

  let rawResponse: string;
  if (extractedText && extractedText.length > 50) {
    rawResponse = await callGemini(
      systemInstruction,
      `${prompt}\n\n--- TEXTO EXTRAÍDO DEL DOCUMENTO ---\n${extractedText.slice(0, 15000)}`,
      undefined,
      undefined,
      undefined,
      false,
      escuelaId
    );
  } else {
    rawResponse = await callGemini(
      systemInstruction,
      prompt,
      buffer,
      "application/pdf",
      undefined,
      false,
      escuelaId
    );
  }

  let text = rawResponse.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  const parsed = JSON.parse(text);

  return {
    aprobado: !!parsed.aprobado,
    puntuacion: parsed.puntuacion || "N/D",
    resumenActividad: parsed.resumenActividad || "Evidencia recibida.",
    tieneEvidenciaFotografica: !!parsed.tieneEvidenciaFotografica,
    tieneFirmasSellos: !!parsed.tieneFirmasSellos,
    participantesEstimados: parsed.participantesEstimados || "No especificado",
    observaciones: parsed.observaciones || "Revisión completada.",
    estadoRecomendado: parsed.estadoRecomendado === "APROBADO" ? "APROBADO" : "REQUIERE_CORRECCION",
  };
}
