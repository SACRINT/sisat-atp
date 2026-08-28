import { callGemini } from "../gemini";

export interface EvaluacionSeguros {
  aprobado: boolean;
  puntuacion: string;
  tipoSiniestroReportado: string;
  tienePolizaReferenciada: boolean;
  tieneEvidenciaSoporte: boolean;
  tieneFirmasSellos: boolean;
  observaciones: string;
  estadoRecomendado: "APROBADO" | "REQUIERE_CORRECCION";
}

export async function evaluarSeguros(
  extractedText: string,
  buffer?: Buffer,
  escuelaInfo?: { nombre: string; cct: string },
  escuelaId?: string
): Promise<EvaluacionSeguros> {
  const systemInstruction = "Eres un Asesor Técnico Pedagógico (ATP) de supervisión escolar experto en trámites de seguro escolar, siniestros y resguardo patrimonial.";

  const prompt = `Analiza este documento entregado por la escuela ${escuelaInfo?.nombre || "Plantel"} (${escuelaInfo?.cct || "S/CCT"}) para el programa de **Seguros y Siniestros Escolares**.

Verifica los siguientes aspectos:
1. **Tipo de Reporte:** Determina si el documento reporta un siniestro específico (accidente escolar, robo, daño por fenómeno natural) o si es una constancia de vigencia/difusión de póliza sin siniestros.
2. **Datos de Póliza / Cobertura:** ¿Se menciona el número de póliza, aseguradora o vigencia del seguro institucional?
3. **Evidencias y Soporte:** Si hubo siniestro, ¿se describen los hechos, personas afectadas, actas circunstanciadas o fotografías?
4. **Formalidad:** ¿Cuenta con la firma del director del plantel y sello oficial?

Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
{
  "aprobado": true/false,
  "puntuacion": "Porcentaje de cumplimiento (ej. '90%')",
  "tipoSiniestroReportado": "Descripción breve del siniestro o 'Constancia sin siniestros'",
  "tienePolizaReferenciada": true/false,
  "tieneEvidenciaSoporte": true/false,
  "tieneFirmasSellos": true/false,
  "observaciones": "Informe en Markdown (máx 250 palabras) detallando el estado de la documentación y pasos a seguir en caso de requerir correcciones.",
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
    tipoSiniestroReportado: parsed.tipoSiniestroReportado || "No especificado",
    tienePolizaReferenciada: !!parsed.tienePolizaReferenciada,
    tieneEvidenciaSoporte: !!parsed.tieneEvidenciaSoporte,
    tieneFirmasSellos: !!parsed.tieneFirmasSellos,
    observaciones: parsed.observaciones || "Revisión de seguros completada.",
    estadoRecomendado: parsed.estadoRecomendado === "APROBADO" ? "APROBADO" : "REQUIERE_CORRECCION",
  };
}
