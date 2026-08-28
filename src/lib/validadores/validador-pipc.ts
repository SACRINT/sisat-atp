import { callGemini } from "../gemini";

export interface EvaluacionPIPC {
  aprobado: boolean;
  puntuacion: string;
  tieneBrigadas: boolean;
  tienePlanEvacuacion: boolean;
  tieneCroquisSenaletica: boolean;
  tieneDirectorioEmergencias: boolean;
  tieneFirmasSellos: boolean;
  observaciones: string;
  estadoRecomendado: "APROBADO" | "REQUIERE_CORRECCION";
}

export async function evaluarPIPC(
  extractedText: string,
  buffer?: Buffer,
  escuelaInfo?: { nombre: string; cct: string },
  escuelaId?: string
): Promise<EvaluacionPIPC> {
  const systemInstruction = "Eres un Asesor Técnico Pedagógico (ATP) experto en normatividad de Protección Civil y Seguridad Escolar en Educación Media Superior.";

  const prompt = `Analiza este documento correspondiente al **Programa Interno de Protección Civil (PIPC)** de la escuela ${escuelaInfo?.nombre || "Plantel"} (${escuelaInfo?.cct || "S/CCT"}).

Verifica el cumplimiento de los componentes normativos esenciales:
1. **Acta e Integración de Brigadas:** ¿Se mencionan o detallan las brigadas escolares (Primeros auxilios, Evacuación, Incendios, Búsqueda y Rescate/Comunicación) con sus responsables?
2. **Diagnóstico y Análisis de Riesgos:** ¿Se identifican riesgos internos y externos del inmueble escolar?
3. **Plan de Contingencia / Evacuación:** ¿Se establecen protocolos de actuación ante sismo, incendio u otras emergencias?
4. **Directorio y Croquis:** ¿Incluye directorio de emergencias (Bomberos, Cruz Roja, Policía) y referencia a croquis o rutas de evacuación?
5. **Firmas y Formalidad:** ¿Cuenta con firmas de los brigadistas y visto bueno del director del plantel con sello oficial?

Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
{
  "aprobado": true/false,
  "puntuacion": "Porcentaje de cumplimiento (ej. '85%')",
  "tieneBrigadas": true/false,
  "tienePlanEvacuacion": true/false,
  "tieneCroquisSenaletica": true/false,
  "tieneDirectorioEmergencias": true/false,
  "tieneFirmasSellos": true/false,
  "observaciones": "Informe técnico en Markdown (máx 300 palabras) señalando secciones completas, omisiones normativas y recomendaciones de corrección.",
  "estadoRecomendado": "APROBADO" o "REQUIERE_CORRECCION"
}`;

  let rawResponse: string;
  if (extractedText && extractedText.length > 50) {
    rawResponse = await callGemini(
      systemInstruction,
      `${prompt}\n\n--- TEXTO EXTRAÍDO DEL PIPC ---\n${extractedText.slice(0, 16000)}`,
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
    tieneBrigadas: !!parsed.tieneBrigadas,
    tienePlanEvacuacion: !!parsed.tienePlanEvacuacion,
    tieneCroquisSenaletica: !!parsed.tieneCroquisSenaletica,
    tieneDirectorioEmergencias: !!parsed.tieneDirectorioEmergencias,
    tieneFirmasSellos: !!parsed.tieneFirmasSellos,
    observaciones: parsed.observaciones || "Revisión de PIPC completada.",
    estadoRecomendado: parsed.estadoRecomendado === "APROBADO" ? "APROBADO" : "REQUIERE_CORRECCION",
  };
}
