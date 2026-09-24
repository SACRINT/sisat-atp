

import { prisma } from "./db";
import { callGemini } from "./gemini";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { v2 as cloudinary } from "cloudinary";
import { evaluarPaecEntrega, generarReportePaecMarkdown } from "./quality-gates/paec-evaluator";
import {
    evaluarPmcEntrega,
    evaluarInformeFinalPMC,
    generarReportePmcMarkdown,
    generarReporteInformeFinalMarkdown
} from "./quality-gates/pmc-evaluator";
import { evaluarPipsEntrega, generarReportePipsMarkdown } from "./quality-gates/pips-evaluator";

function parseCloudinaryUrl(url: string) {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(
        /res\.cloudinary\.com\/([^/]+)\/(\w+)\/upload\/(?:v\d+\/)?(.+)$/
    );
    if (!match) return null;

    const cloudName    = match[1];
    const resourceType = match[2];          // "image" | "raw" | "video"
    const fullPath     = match[3];
    const lastDot      = fullPath.lastIndexOf(".");
    const format       = lastDot > 0 ? fullPath.slice(lastDot + 1) : "";

    const publicId =
        resourceType === "raw"
            ? fullPath
            : (lastDot > 0 ? fullPath.slice(0, lastDot) : fullPath);

    return { cloudName, resourceType, publicId, format };
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const docFile = zip.file("word/document.xml");
    if (!docFile) {
        throw new Error("No word/document.xml found in DOCX file");
    }
    const docXml = await docFile.async("string");
    const matches = docXml.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
    const rawText = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
    const text = rawText
        .replace(/[ \t]+/g, " ")
        .replace(/\r\n/g, "\n")
        .replace(/\n\s*\n/g, "\n")
        .trim();
    return text;
}

export async function extractTextFromPdf(
    buffer: Buffer,
    pageOptions?: { start?: number; end?: number }
): Promise<{ text: string; total: number }> {
    try {
        console.log("[pre-revision] Starting local PDF text extraction, buffer size:", buffer.length);
        const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
        const data = await pdfParse(buffer);
        const rawText = data.text || "";
        const text = rawText
            .replace(/[ \t]+/g, " ")
            .replace(/\r\n/g, "\n")
            .replace(/\n\s*\n/g, "\n")
            .trim();
        console.log(`[pre-revision] Text extraction complete. Pages: ${data.numpages}. Raw length: ${rawText.length}, Clean length: ${text.length}`);
        return { text, total: data.numpages || 0 };
    } catch (error) {
        console.error("[pre-revision] Error extracting text from PDF locally:", error);
        throw error;
    }
}

function cleanAndParseGeminiJson(raw: string) {
    let text = raw.trim();
    // Extraer bloque JSON si viene envuelto en markdown ```json ... ``` o texto explicativo
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        text = text.slice(firstBrace, lastBrace + 1).trim();
    } else if (text.includes("```")) {
        text = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn("[pre-revision] JSON.parse failed, attempting regex fallback repair...", e);
        try {
            const aprobadoMatch = text.match(/"aprobado"\s*:\s*(true|false)/i);
            const puntuacionMatch = text.match(/"puntuacion"\s*:\s*"([^"]*)"/i);
            const estadoMatch = text.match(/"estadoRecomendado"\s*:\s*"([^"]*)"/i);
            
            let observaciones = "";
            const obsStart = text.indexOf('"observaciones"');
            if (obsStart !== -1) {
                const rest = text.substring(obsStart + 15);
                const firstQuote = rest.indexOf('"');
                if (firstQuote !== -1) {
                    const content = rest.substring(firstQuote + 1);
                    const nextKey = content.search(/"\s*,\s*"(?:estadoRecomendado|aprobado|puntuacion)"/);
                    if (nextKey !== -1) {
                        observaciones = content.substring(0, nextKey);
                    } else {
                        const lastBrace = content.lastIndexOf("}");
                        if (lastBrace !== -1) {
                            const trimmed = content.substring(0, lastBrace).trim();
                            observaciones = trimmed.endsWith('"') ? trimmed.slice(0, -1) : trimmed;
                        } else {
                            observaciones = content;
                        }
                    }
                }
            }
            
            return {
                aprobado: aprobadoMatch ? aprobadoMatch[1] === "true" : false,
                puntuacion: puntuacionMatch ? puntuacionMatch[1] : "N/D",
                observaciones: observaciones || "Sin observaciones específicas.",
                estadoRecomendado: estadoMatch ? estadoMatch[1] : "REQUIERE_CORRECCION"
            };
        } catch (repairError) {
            console.error("[pre-revision] Regex repair failed:", repairError);
        }
        throw e;
    }
}

export interface PreRevisionResult {
    tipo: "DIA_NARANJA" | "ACOSO_ESCOLAR" | "PMC" | "PAEC" | "INFORME_FINAL" | "PIPS" | "CONCENTRADO_INSCRITOS" | "CARTAS_COMPROMISO" | "INFORMES_BIMESTRALES" | "SIMULACRO" | "CULTURA_PAZ" | "PIPC" | "SEGUROS" | "OTROS";
    aprobado?: boolean;
    error?: string;
    // Día Naranja fields
    archivos?: {
        nombre: string;
        etiqueta: string;
        firmado: boolean;
        sellado: boolean;
        explicacion: string;
    }[];
    // Acoso Escolar fields
    tieneIncidencias?: boolean;
    incidenciasDetalle?: {
        mes: string;
        categoria: string;
        edad: string;
        violencia: string[];
        escuela: string;
        cct: string;
        localidad: string;
    }[];
    borradorCorreo?: string;
    firmado?: boolean;
    sellado?: boolean;
    explicacion?: string;
    puntuacion?: string;
    // Cultura de Paz fields
    resumenActividad?: string;
    participantesEstimados?: string;
    tieneEvidenciaFotografica?: boolean;
    tieneFirmasSellos?: boolean;
    // PIPC fields
    tieneBrigadas?: boolean;
    tienePlanEvacuacion?: boolean;
    tieneCroquisSenaletica?: boolean;
    tieneDirectorioEmergencias?: boolean;
    // Seguros fields
    tipoSiniestroReportado?: string;
    tienePolizaReferenciada?: boolean;
    tieneEvidenciaSoporte?: boolean;
    // Campos estructurados de Quality Gates / Auditoría Homologada
    scoreNumerico?: number;
    totalPuntosBrutos?: string;
    estatusOficial?: string;
    dimensionesDesglose?: any;
    criteriosEvaluados?: any[];
    fortalezas?: string[];
    recomendaciones?: string[];
}

function parsePercentage(scoreStr: string): number {
    const match = scoreStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

function obtenerPartesEvaluacion(
    modulo: "PMC" | "PAEC" | "INFORME_FINAL" | "PIPS",
    templateContent: string,
    escuelaNombre: string,
    escuelaCct: string,
    textoOriginalPMC: string,
    extractedText: string
) {
    let partes: { titulo: string; enfoque: string }[] = [];
    let customTemplateContent = templateContent;

    if (modulo === "PIPS") {
        partes = [
            {
                titulo: "Sección I: Antecedentes, Retroalimentación Zonal y Diagnóstico Integrado (PIPS)",
                enfoque: `Analiza el Plan de Intervención Pedagógica de Supervisión Escolar (PIPS) de la zona o supervisión ${escuelaNombre} (${escuelaCct}) correspondiente a la Fase 1 (Diseño) y Fase 2 (Desarrollo):
1. Revisa los datos de identificación, CCT de supervisión, municipio, Supervisor Escolar y ATPs. Comprueba si existen marcas de borrador ([PENDIENTE], [CONFIRMAR]).
2. Evalúa si se menciona la retroalimentación del PIPS del ciclo anterior recibida de la DBEPA (o la aplicación del Anexo 1 para reconstruir línea base).
3. Evalúa si el diagnóstico zonal integra hallazgos de PMC y PAEC-PEC de los planteles de la zona (identificando evidencias prohibidas en PMC, confusión de nomenclatura en PAEC-PEC y gobernanza de comités).`
            },
            {
                titulo: "Sección II: Estructura, Formato, Extensión Normativa y Referencias (PIPS)",
                enfoque: `Analiza la estructura formal y formato técnico del PIPS (Fase 3):
1. Verifica el cumplimiento de extensión según la etapa (Inicial: 8-10 cuartillas en cuerpo principal sin anexos; Avance: sintético; Final: 15-25 cuartillas). Si excede, indica qué tablas reubicar en Anexos.
2. Evalúa el formato técnico: Arial 12, interlineado sencillo, márgenes 2.54 cm, alineación a la NEM/MCCEMS y citas formales en APA 7ª ed.
3. Comprueba que cuente con los espacios de firma autógrafa del Supervisor Escolar y del equipo de ATP.`
            },
            {
                titulo: "Sección III: Cronograma Operativo, Batería de Instrumentos y Anexos Operativos (PIPS)",
                enfoque: `Analiza la implementación, seguimiento y anexos del PIPS (Fases 4 y 5):
1. Evalúa el Cronograma Operativo (Problemática, Objetivo, Meta SMART, Acción, Responsable, Recursos, calendario mensualizado Agosto-Julio).
2. Verifica los instrumentos de seguimiento: Bitácora del Supervisor Escolar (instrumento rector), cuestionarios a directivos y guías de observación áulica.
3. Audita la inclusión de los Anexos A a F (matrícula, cronograma, bitácora, FODA, guías de observación, fichas por plantel). Reporta si falta alguno como ANEXO AUSENTE.`
            }
        ];
    } else if (modulo === "INFORME_FINAL") {

        // Rúbrica de evaluación específica para el Informe Final de Cierre,
        // evitando evaluar el documento como si fuera la planeación de metas iniciales.
        customTemplateContent = `LINEAMIENTOS DE EVALUACIÓN DE INFORME FINAL (CERRADO):
1. Estructura y Coherencia General: Verificar que se presenten las secciones de cierre (resultados por categoría, evidencias, autoevaluación, firmas/sellos). Comparar los resultados con las metas originales planeadas.
2. Evaluación de Resultados y Justificación de Metas Inconclusas: Evaluar el grado de cumplimiento reportado y si las metas que no se cumplieron al 100% cuentan con justificaciones válidas, razonables y reflexivas sobre las dificultades enfrentadas.
3. Evidencias de Cumplimiento: Evaluar que las evidencias reportadas (como actas, oficios, convenios, reportes de vinculación) sean válidas, legibles y demuestren el cumplimiento real y el impacto, no simples listas vacías ni fotografías sin descripción.
4. Recomendaciones Finales: Evaluar las propuestas de mejora sugeridas para el próximo ciclo escolar.`;

        partes = [
            {
                titulo: "Sección I: Coherencia General con el PMC Planeado y Diagnóstico de Resultados",
                enfoque: `Analiza la estructura del Informe Final de PMC de la escuela ${escuelaNombre} (${escuelaCct}) en comparación con el PMC planeado originalmente:
1. Compara si el Informe Final aborda las mismas categorías, prioridades y metas que se planearon en el PMC original.
2. Evalúa si el diagnóstico final describe adecuadamente los avances y resultados del ciclo escolar terminado.
3. Comprueba si el documento cuenta con todas las secciones de cierre requeridas.`
            },
            {
                titulo: "Sección II: Evaluación de Resultados y Justificación de Metas Inconclusas",
                enfoque: `Analiza a detalle las metas y resultados del Informe Final:
1. Evalúa el estado de cumplimiento reportado para cada meta.
2. Examina minuciosamente si las justificaciones presentadas para las metas no cumplidas al 100% son válidas, sólidas y proponen acciones de mejora para el futuro.
3. Comprueba la coherencia interna de los resultados con el reporte de avances.`
            },
            {
                titulo: "Sección III: Análisis de Evidencias, Impacto y Recomendaciones Finales",
                enfoque: `Analiza las evidencias y el impacto final del plantel:
1. Evalúa si las evidencias entregadas (reportes, convenios, oficios, constancias) demuestran documentalmente el cumplimiento efectivo de las metas.
2. Determina si las evidencias son de carácter analítico y de calidad, o si son meros registros de asistencia y fotos sin contexto.
3. Genera conclusiones claras y recomendaciones específicas de mejora para planear el siguiente ciclo escolar.`
            }
        ];
    } else if (modulo === "PAEC") {
        partes = [
            {
                titulo: "Sección I: Diagnóstico Comunitario y Planteamiento del Problema (PAEC)",
                enfoque: `Analiza el Proyecto Escolar Comunitario (PEC/PAEC) de la escuela ${escuelaNombre} (${escuelaCct}):
1. Evalúa si presenta un diagnóstico comunitario participativo real.
2. Comprueba si las problemáticas del entorno (sociales, ambientales, de salud, de convivencia, etc.) están plenamente identificadas y delimitadas.
3. Determina si el problema seleccionado es pertinente y prioritario para la comunidad escolar.`
            },
            {
                titulo: "Sección II: Vinculación con la Comunidad y Coherencia de Objetivos (PAEC)",
                enfoque: `Analiza los objetivos del Proyecto Escolar Comunitario (PEC/PAEC) de la escuela ${escuelaNombre} (${escuelaCct}):
1. Evalúa si los objetivos y metas del proyecto se alinean directamente a resolver la problemática delimitada.
2. Verifica si se promueve una vinculación real con padres de familia, instituciones públicas, comités comunitarios u otros actores locales.
3. Analiza si se respeta el enfoque de la Nueva Escuela Mexicana.`
            },
            {
                titulo: "Sección III: Plan de Acción, Responsabilidades y Evaluación (PAEC)",
                enfoque: `Analiza el Plan de Acción del Proyecto Escolar Comunitario (PEC/PAEC) de la escuela ${escuelaNombre} (${escuelaCct}):
1. Revisa las acciones planteadas: si son viables, lógicas, calendarizadas and con responsables definidos.
2. Evalúa las evidencias de cumplimiento propuestas y los indicadores de evaluación.
3. Genera recomendaciones y observaciones de mejora específicas.`
            }
        ];
    } else {
        partes = [
            {
                titulo: "Sección I: Estructura General, Diagnóstico y FODA (PMC)",
                enfoque: `Analiza el Plan de Mejora Continua (PMC) de la escuela ${escuelaNombre} (${escuelaCct}):
1. Revisa si el documento contiene la estructura formal solicitada (Presentación, Objetivos, Diagnóstico, FODA, Plan de Acción, Firmas/Sellos).
2. Evalúa la calidad de la contextualización y diagnóstico (uso de estadísticas de aprovechamiento escolar, deserción, rezago, estado de infraestructura y entorno socioeconómico).
3. Revisa la solidez del análisis FODA y la correcta priorización de categorías/necesidades con base en el diagnóstico.`
            },
            {
                titulo: "Sección II: Coherencia de Objetivos, Metas e Indicadores (PMC)",
                enfoque: `Analiza los Objetivos, Metas e Indicadores del Plan de Mejora Continua (PMC) de la escuela ${escuelaNombre} (${escuelaCct}):
1. Evalúa si los objetivos redactados son claros, atienden las causas raíz de las problemáticas prioritarias y son viables.
2. Examina si las metas son SMART (específicas, medibles, alcanzables, realistas y con tiempo definido) y si tienen coherencia directa con los objetivos.
3. Verifica la pertinencia de los indicadores propuestos para medir el avance.`
            },
            {
                titulo: "Sección III: Plan de Acción (Estrategias, Acciones, Responsables y Evidencias) (PMC)",
                enfoque: `Analiza el Plan de Acción del Plan de Mejora Continua (PMC) de la escuela ${escuelaNombre} (${escuelaCct}):
1. Revisa si las estrategias y acciones son lógicas, suficientes y viables para lograr las metas.
2. Verifica si se asignan responsables específicos y fechas límite lógicas.
3. Evalúa si las evidencias/entregables definidos son idóneos y suficientes para comprobar el cumplimiento. Genera observaciones finales y recomendaciones concretas de mejora.`
            }
        ];
    }

    return partes.map((parte, index) => {
        let p = `A continuación se presenta el prompt maestro de evaluación oficial que define los lineamientos y rúbricas a evaluar:
---
${customTemplateContent}
---

Evalúa el documento entregado por el plantel: ${escuelaNombre} (${escuelaCct}).
Esta es la PARTE ${index + 1} de la evaluación, enfocada en: **${parte.titulo}**.

¡ADVERTENCIA CRÍTICA PARA EL EVALUADOR!:
El documento entregado es un INFORME FINAL (cierre de ciclo). Reporta RESULTADOS PASADOS y no planes futuros.
NO debes criticar que las metas ya estén ejecutadas ni exigir que se formulen metas SMART a futuro dentro de este informe.
Tu tarea es valorar exclusivamente el nivel de logro de los resultados, si las desviaciones están bien justificadas y si las evidencias reportadas demuestran el cumplimiento real.

Pautas específicas para esta parte:
${parte.enfoque}`;

        if (modulo === "INFORME_FINAL" && textoOriginalPMC) {
            p += `

A continuación se proporciona el texto o análisis del PLAN DE MEJORA CONTINUA (PMC) original planeado por la escuela para este ciclo escolar. Úsalo como referencia obligatoria para comparar el Informe Final con las metas, actividades y categorías del PMC original:
----------------------------------
${textoOriginalPMC.slice(0, 12000)}
----------------------------------`;
        }

        p += `

${extractedText 
    ? "Texto extraído del documento entregado para tu evaluación:\n" + extractedText
    : "El documento se incluye en formato binario para tu análisis."
}

Debes responder ÚNICAMENTE en formato JSON con la siguiente estructura de esquema:
{
  "aprobado": true,
  "puntuacion": "Porcentaje de cumplimiento asignado a esta parte (ej. '70%')",
  "observaciones": "Tu informe detallado para esta sección en Markdown (aproximadamente 350-500 palabras), describiendo con precisión fortalezas, áreas de oportunidad, omisiones o inconsistencias encontradas y recomendaciones de mejora.",
  "estadoRecomendado": "APROBADO"
}`;
        return p;
    });
}

/**
 * Downloads a file as buffer from a URL (e.g. Cloudinary secure URL)
 */
export async function downloadFile(url: string): Promise<Buffer> {
    if (url.includes("res.cloudinary.com")) {
        try {
            const parsed = parseCloudinaryUrl(url);
            if (parsed) {
                cloudinary.config({
                    cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
                    secure: true,
                });

                const tryTypes = [parsed.resourceType, "image", "raw", "video"]
                    .filter((v, i, a) => a.indexOf(v) === i);

                for (const resType of tryTypes) {
                    let id = parsed.publicId;
                    if (resType === "raw" && parsed.format && !id.endsWith(`.${parsed.format}`)) {
                        id = `${id}.${parsed.format}`;
                    } else if (resType !== "raw" && /\.\w{2,5}$/.test(id)) {
                        id = id.replace(/\.[^/.]+$/, "");
                    }

                    try {
                        const formatToUse = resType === "raw" ? "" : parsed.format;
                        const signedUrl = cloudinary.utils.private_download_url(id, formatToUse, {
                            resource_type: resType as "image" | "raw" | "video",
                            type: "upload",
                            attachment: true, // Paridad total con /api/download
                        });

                        console.log(`[pre-revision] Trying to download signed url with resType: ${resType}, id: ${id}`);
                        const res = await fetch(signedUrl, {
                            signal: AbortSignal.timeout(10000)
                        });
                        if (res.ok) {
                            console.log(`[pre-revision] Download success for resType: ${resType}`);
                            const arrayBuffer = await res.arrayBuffer();
                            return Buffer.from(arrayBuffer);
                        } else {
                            console.warn(`[pre-revision] Download failed for resType ${resType} with status: ${res.status}`);
                        }
                    } catch (err) {
                        console.error(`[pre-revision] Error fetching signed URL for ${resType}:`, err);
                    }
                }
            }
        } catch (e: any) {
            console.error("[pre-revision] Error generating signed Cloudinary URL:", e);
        }
    }

    // --- SEGUNDA LÍNEA DE DEFENSA: Proxy Local (robusto y validado en producción) ---
    try {
        let baseUrl = "http://localhost:3000";
        if (process.env.VERCEL_URL) {
            baseUrl = `https://${process.env.VERCEL_URL}`;
        } else if (process.env.NEXTAUTH_URL) {
            baseUrl = process.env.NEXTAUTH_URL;
        }
        const localProxyUrl = `${baseUrl}/api/download?url=${encodeURIComponent(url)}`;
        console.log(`[pre-revision] Attempting fallback download via local proxy: ${localProxyUrl}`);
        const res = await fetch(localProxyUrl, {
            signal: AbortSignal.timeout(15000),
            headers: { "User-Agent": "SISAT-ATP/1.0" }
        });
        if (res.ok) {
            console.log(`[pre-revision] Local proxy download success!`);
            const arrayBuffer = await res.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } else {
            console.warn(`[pre-revision] Local proxy download failed with status: ${res.status}`);
        }
    } catch (proxyErr) {
        console.warn(`[pre-revision] Error calling local proxy download:`, proxyErr);
    }

    console.log(`[pre-revision] Falling back to direct fetch for URL: ${url}`);
    const res = await fetch(url, {
        signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
        throw new Error(`Failed to download file from ${url} (status ${res.status})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Performs background pre-revision analysis for a school delivery
 */
export async function analizarEntregaConIA(entregaId: string, textoCompletoInput?: string): Promise<void> {
    try {
        const entrega = await prisma.entrega.findUnique({
            where: { id: entregaId },
            include: {
                archivos: true,
                periodoEntrega: { include: { programa: true } },
                escuela: true,
            }
        });

        if (!entrega || entrega.archivos.length === 0) {
            console.warn(`No files found for delivery ${entregaId} in pre-revision.`);
            return;
        }

        const programaNombre = entrega.periodoEntrega.programa.nombre.toUpperCase().trim();
        const escuelaCct = entrega.escuela.cct;
        const escuelaNombre = entrega.escuela.nombre;

        let resultado: PreRevisionResult | null = null;

        if (programaNombre.includes("DÍA NARANJA") || programaNombre.includes("DIA NARANJA")) {
            // --- DÍA NARANJA PRE-REVISION ---
            const pdfFiles = entrega.archivos.filter(a => a.tipo === "ENTREGA" && a.driveUrl);
            const reportes: any[] = [];

            for (const file of pdfFiles) {
                try {
                    const buffer = await downloadFile(file.driveUrl!);
                    
                    const systemInstruction = "Eres un Asesor Técnico Pedagógico experto en revisión de expedientes escolares.";
                    const prompt = `Analiza este documento PDF de entrega correspondiente a la escuela ${escuelaNombre} (${escuelaCct}).
Determina si cuenta con:
1. La firma autógrafa del Director del plantel en la página final o donde se presenten las firmas.
2. El sello oficial de la institución.

Responde únicamente en formato JSON con la siguiente estructura:
{
  "signed": true/false,
  "sealed": true/false,
  "explanation": "Breve explicación detallada de lo encontrado (máximo 2 líneas)"
}`;

                    const rawResponse = await callGemini(systemInstruction, prompt, buffer, undefined, undefined, false, entrega.escuelaId);
                    const parsed = cleanAndParseGeminiJson(rawResponse);

                    reportes.push({
                        nombre: file.nombre,
                        etiqueta: file.etiqueta || "Archivo",
                        firmado: !!parsed.signed,
                        sellado: !!parsed.sealed,
                        explicacion: parsed.explanation || "Analizado correctamente."
                    });
                } catch (e: any) {
                    console.error(`Error analyzing file ${file.nombre}:`, e);
                    reportes.push({
                        nombre: file.nombre,
                        etiqueta: file.etiqueta || "Archivo",
                        firmado: false,
                        sellado: false,
                        explicacion: `Error de análisis: ${e.message}`
                    });
                }
            }

            resultado = {
                tipo: "DIA_NARANJA",
                archivos: reportes,
                aprobado: reportes.every(r => r.firmado && r.sellado)
            };

        } else if (programaNombre.includes("ACOSO ESCOLAR")) {
            // --- ACOSO ESCOLAR PRE-REVISION ---
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (!file) return;

            const isExcel = file.nombre.toLowerCase().endsWith(".xlsx") || file.nombre.toLowerCase().endsWith(".xls");

            if (isExcel) {
                // EXCEL: Report with incidents
                try {
                    const buffer = await downloadFile(file.driveUrl!);
                    const workbook = XLSX.read(buffer, { type: "buffer" });
                    const sheetNames = workbook.SheetNames;
                    const incidencias: any[] = [];

                    for (const sheetName of sheetNames) {
                        const sheet = workbook.Sheets[sheetName];
                        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];
                        
                        let currentCategoria = "";
                        for (let r = 7; r < rows.length; r++) {
                            const row = rows[r];
                            if (!row || row.length === 0) continue;
                            
                            if (row[0] && typeof row[0] === 'string' && ['NIÑAS', 'NIÑOS', 'ADOLESCENTES', 'MUJER', 'HOMBRE'].includes(row[0].toUpperCase().trim())) {
                                currentCategoria = row[0].toUpperCase().trim();
                            }
                            
                            const schoolName = row[7];
                            const cct = row[8];
                            
                            if (schoolName || cct) {
                                const agFisica = row[2];
                                const hostigamiento = row[3];
                                const discriminatorio = row[4];
                                const otro = row[5];
                                
                                const tieneCaso = [agFisica, hostigamiento, discriminatorio, otro].some(val => 
                                    val && typeof val === 'string' && val.toUpperCase().trim() === 'X'
                                );
                                
                                if (tieneCaso) {
                                    const tiposViolencia: string[] = [];
                                    if (agFisica && agFisica.toUpperCase().trim() === 'X') tiposViolencia.push("Agresión Física");
                                    if (hostigamiento && hostigamiento.toUpperCase().trim() === 'X') tiposViolencia.push("Hostigamiento");
                                    if (discriminatorio && discriminatorio.toUpperCase().trim() === 'X') tiposViolencia.push("Discriminatorio");
                                    if (otro && otro.toUpperCase().trim() === 'X') tiposViolencia.push("Otro");

                                    incidencias.push({
                                        mes: sheetName,
                                        categoria: currentCategoria || "General",
                                        edad: row[1] || "S/D",
                                        violencia: tiposViolencia,
                                        escuela: schoolName ? schoolName.toString().trim() : "N/D",
                                        cct: cct ? cct.toString().trim() : "N/D",
                                        localidad: row[9] ? row[9].toString().trim() : "N/D"
                                    });
                                }
                            }
                        }
                    }

                    let borradorCorreo = "";
                    if (incidencias.length > 0) {
                        // Call Gemini to draft a formal email with the parsed incidents
                        const systemInstruction = "Eres un Asesor Técnico Pedagógico (ATP) de supervisión escolar de bachilleratos.";
                        const prompt = `Redacta un correo institucional formal dirigido a la Dirección General de Bachilleratos, notificando que se detectaron incidencias de acoso escolar en la zona escolar.
Los detalles de las incidencias reportadas por el director en el archivo Excel son los siguientes:
${JSON.stringify(incidencias, null, 2)}

El correo debe:
- Ser formal, claro y profesional.
- Resumir de forma consolidada las escuelas afectadas, el tipo de población y el tipo de violencia/acoso reportado.
- Mencionar que el reporte fue consolidado por la supervisión de zona a cargo del ATP.

Responde únicamente en formato JSON con la siguiente estructura:
{
  "email_draft": "Cuerpo completo del correo redactado..."
}`;

                        try {
                            const rawResponse = await callGemini(systemInstruction, prompt, undefined, undefined, undefined, false, entrega.escuelaId);
                            const parsed = cleanAndParseGeminiJson(rawResponse);
                            borradorCorreo = parsed.email_draft || "";
                        } catch (e) {
                            console.error("Error generating email draft with Gemini:", e);
                            borradorCorreo = `Error al redactar borrador: ${e instanceof Error ? e.message : String(e)}`;
                        }
                    }

                    resultado = {
                        tipo: "ACOSO_ESCOLAR",
                        tieneIncidencias: true,
                        incidenciasDetalle: incidencias,
                        borradorCorreo: borradorCorreo || "No se pudo generar el borrador."
                    };

                } catch (e: any) {
                    console.error("Error parsing acoso Excel:", e);
                    resultado = {
                        tipo: "ACOSO_ESCOLAR",
                        tieneIncidencias: true,
                        error: `Error al leer Excel: ${e.message}`,
                        borradorCorreo: "Error al leer el archivo Excel."
                    };
                }

            } else {
                // PDF: Report without incidents (standard letter declaring zero cases)
                try {
                    const buffer = await downloadFile(file.driveUrl!);
                    const systemInstruction = "Eres un Asesor Técnico Pedagógico experto en revisión de expedientes escolares.";
                    const prompt = `Analiza este informe de Acoso Escolar en PDF de la escuela ${escuelaNombre} (${escuelaCct}).
Determina si:
1. El informe cuenta con la firma autógrafa del Director.
2. Cuenta con el sello oficial del plantel.

Responde únicamente en formato JSON con la siguiente estructura:
{
  "signed": true/false,
  "sealed": true/false,
  "explanation": "Breve explicación del análisis visual (máximo 2 líneas)"
}`;

                    const rawResponse = await callGemini(systemInstruction, prompt, buffer, undefined, undefined, false, entrega.escuelaId);
                    const parsed = cleanAndParseGeminiJson(rawResponse);

                    resultado = {
                        tipo: "ACOSO_ESCOLAR",
                        tieneIncidencias: false,
                        firmado: !!parsed.signed,
                        sellado: !!parsed.sealed,
                        explicacion: parsed.explanation || "Reporte sin incidencias validado correctamente."
                    };
                } catch (e: any) {
                    console.error("Error analyzing acoso PDF:", e);
                    resultado = {
                        tipo: "ACOSO_ESCOLAR",
                        tieneIncidencias: false,
                        firmado: false,
                        sellado: false,
                        explicacion: `Error de análisis visual: ${e.message}`
                    };
                }
            }
        } else if (programaNombre.includes("PMC") || programaNombre.includes("PAEC") || programaNombre.includes("PEC") || programaNombre.includes("PLAN DE MEJORA CONTINUA") || programaNombre.includes("PIPS") || programaNombre.includes("INTERVENCI")) {
            // --- PMC / PAEC / PIPS PRE-REVISION (Fase 3: Rúbricas y Prompts) ---
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (file) {
                let modulo: "PMC" | "PAEC" | "INFORME_FINAL" | "PIPS" = "PMC";
                if (programaNombre.includes("PIPS") || programaNombre.includes("INTERVENCI")) {
                    modulo = "PIPS";
                } else if (programaNombre.includes("INFORME FINAL")) {
                    modulo = "INFORME_FINAL";
                } else if (programaNombre.includes("PAEC") || programaNombre.includes("PEC")) {
                    modulo = "PAEC";
                }

                // 1. Fetch active evaluation template
                const template = await prisma.plantillaEvaluacion.findFirst({
                    where: { modulo, activo: true }
                });

                const templateContent = template?.contenido || (modulo === "PIPS"
                    ? "Evalúa este Plan de Intervención Pedagógica de Supervisión Escolar (PIPS) conforme a sus 5 Fases Normativas y Anexos A-F."
                    : modulo === "INFORME_FINAL"
                        ? "Evalúa este Informe Final del PMC y comprueba que se justifiquen las metas no cumplidas y se reporten evidencias de las cumplidas."
                        : modulo === "PMC"
                            ? "Evalúa este Plan de Mejora Continua (PMC) y verifica si cuenta con objetivos, metas y responsables."
                            : "Evalúa este Proyecto Escolar Comunitario (PEC) y verifica que cumpla con los lineamientos del PAEC.");

                try {
                    console.log(`[pre-revision] Starting evaluation of ${modulo} for delivery ${entregaId}...`);

                    // Fetch the original PMC for comparison if we are evaluating the INFORME_FINAL
                    let textoOriginalPMC = "";
                    if (modulo === "INFORME_FINAL") {
                        try {
                            console.log(`[pre-revision] Evaluating INFORME_FINAL. Looking up original PMC for school ${entrega.escuelaId}...`);
                            const pmcEntrega = await prisma.entrega.findFirst({
                                where: {
                                    escuelaId: entrega.escuelaId,
                                    periodoEntrega: {
                                        cicloEscolarId: entrega.periodoEntrega.cicloEscolarId,
                                        programa: {
                                            nombre: {
                                                contains: "PMC",
                                                mode: "insensitive"
                                            },
                                            NOT: {
                                                nombre: {
                                                    contains: "INFORME FINAL",
                                                    mode: "insensitive"
                                                }
                                            }
                                        }
                                    }
                                },
                                include: {
                                    archivos: true,
                                    preRevision: true
                                }
                            });

                            if (pmcEntrega) {
                                const pmcFile = pmcEntrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
                                if (pmcFile) {
                                    try {
                                        console.log(`[pre-revision] Downloading PMC file: ${pmcFile.nombre} to compare...`);
                                        const pmcBuffer = await downloadFile(pmcFile.driveUrl!);
                                        if (pmcFile.nombre.toLowerCase().endsWith(".docx")) {
                                            textoOriginalPMC = await extractTextFromDocx(pmcBuffer);
                                        } else if (pmcFile.nombre.toLowerCase().endsWith(".pdf")) {
                                            const pdfRes = await extractTextFromPdf(pmcBuffer);
                                            textoOriginalPMC = pdfRes.text;
                                        }
                                        console.log(`[pre-revision] Original PMC text extracted successfully. Chars: ${textoOriginalPMC.length}`);
                                    } catch (err) {
                                        console.error("[pre-revision] Failed to extract text from original PMC:", err);
                                        if (pmcEntrega.preRevision?.resultado) {
                                            const resObj = pmcEntrega.preRevision.resultado as any;
                                            textoOriginalPMC = `Observaciones y Metas del PMC Original:\n${resObj.borradorCorreo || ""}`;
                                        }
                                    }
                                } else if (pmcEntrega.preRevision?.resultado) {
                                    const resObj = pmcEntrega.preRevision.resultado as any;
                                    textoOriginalPMC = `Observaciones y Metas del PMC Original:\n${resObj.borradorCorreo || ""}`;
                                }
                            }
                        } catch (pmcErr) {
                            console.error("[pre-revision] Error querying original PMC:", pmcErr);
                        }
                    }
                    
                    let extractedText = textoCompletoInput || "";
                    let buffer: Buffer | null = null;
                    const isDocx = file.nombre.toLowerCase().endsWith(".docx");
                    const isPdf = file.nombre.toLowerCase().endsWith(".pdf");

                    if (!extractedText) {
                        console.log(`[pre-revision] Downloading file: ${file.nombre} from Cloudinary...`);
                        buffer = await downloadFile(file.driveUrl!);
                        console.log(`[pre-revision] File downloaded. Size: ${buffer.length} bytes. Format isDocx: ${isDocx}, isPdf: ${isPdf}`);
                        
                        if (isDocx) {
                            console.log("[pre-revision] Extracting text from DOCX...");
                            extractedText = await extractTextFromDocx(buffer);
                            console.log(`[pre-revision] DOCX text extraction successful. Characters: ${extractedText.length}`);
                        } else if (isPdf) {
                            try {
                                const resPdf = await extractTextFromPdf(buffer);
                                extractedText = resPdf.text;
                            } catch (err) {
                                console.error("[pre-revision] Local PDF text extraction failed. Falling back to raw binary.", err);
                            }
                        }
                    } else {
                        console.log(`[pre-revision] Using provided pre-extracted text. Characters: ${extractedText.length}`);
                    }
                    
                    if (!extractedText || extractedText.trim().length < 100) {
                        console.warn(`[pre-revision] Extracted text too short (${extractedText?.length || 0} chars) for delivery ${entregaId}. Generating illegible warning.`);
                        resultado = {
                            tipo: "OTROS",
                            error: "Documento ilegible",
                            explicacion: "El documento subido no contiene texto extraíble (ilegible, escaneado sin OCR o vacío). Por favor, suba una versión legible o digitalizada directamente.",
                            borradorCorreo: `# Documento Ilegible o Escaneado sin OCR\n\nEl sistema de validación de la plataforma SISAT-ATP ha detectado que el archivo entregado no contiene texto digital extraíble.\n\n### Posibles causas:\n1. El archivo PDF es una imagen escaneada directamente sin haberle aplicado reconocimiento óptico de caracteres (OCR).\n2. El archivo de Word o PDF está vacío o corrupto.\n\n### ¿Cómo solucionarlo?\nPor favor, genere el documento PDF directamente desde su procesador de textos (ej. Microsoft Word haciendo clic en "Guardar como PDF") y evite escanear la hoja impresa, para que la plataforma pueda validar su contenido de manera automática.`,
                            tieneIncidencias: true
                        };
                    } else if (modulo === "PAEC") {
                        console.log(`[pre-revision] Iniciando evaluación homologada PAEC-PEC para entrega ${entregaId} (${escuelaNombre})...`);
                        const resultadoPaec = await evaluarPaecEntrega({
                            textoDocumento: extractedText,
                            escuelaId: entrega.escuelaId,
                            cct: escuelaCct,
                            escuelaNombre,
                            pdfBuffer: buffer || undefined,
                        });

                        resultado = {
                            tipo: "PAEC",
                            aprobado: resultadoPaec.overallStatus !== "requiere_ajustes",
                            puntuacion: `${resultadoPaec.percentage}%`,
                            explicacion: `Evaluación normativa DBEPA: ${resultadoPaec.passedCriteria}/23 criterios acreditados con excelencia (${resultadoPaec.percentage}% global)`,
                            borradorCorreo: generarReportePaecMarkdown(resultadoPaec, { nombre: escuelaNombre, cct: escuelaCct }),
                            tieneIncidencias: resultadoPaec.overallStatus === "requiere_ajustes",
                            // Nuevos campos cuantitativos estructurados
                            scoreNumerico: resultadoPaec.percentage,
                            totalPuntosBrutos: `${resultadoPaec.totalScore}/92`,
                            estatusOficial: resultadoPaec.overallStatus,
                            dimensionesDesglose: resultadoPaec.dimensionScores,
                            criteriosEvaluados: resultadoPaec.criteria,
                            fortalezas: resultadoPaec.strengths,
                            recomendaciones: resultadoPaec.criticalRecommendations,
                        };
                    } else if (modulo === "PMC") {
                        console.log(`[pre-revision] Iniciando evaluación homologada PMC para entrega ${entregaId} (${escuelaNombre})...`);
                        const resultadoPmc = await evaluarPmcEntrega({
                            textoDocumento: extractedText,
                            escuelaId: entrega.escuelaId,
                            cct: escuelaCct,
                            escuelaNombre,
                            pdfBuffer: buffer || undefined,
                        });

                        resultado = {
                            tipo: "PMC",
                            aprobado: resultadoPmc.overallStatus === "EXCELENTE" || resultadoPmc.overallStatus === "SATISFACTORIO",
                            puntuacion: `${resultadoPmc.percentage}%`,
                            explicacion: `Evaluación normativa DBEPA: ${resultadoPmc.passedCriteria}/10 criterios acreditados (${resultadoPmc.percentage}% de cumplimiento global - ${resultadoPmc.overallStatus})`,
                            borradorCorreo: generarReportePmcMarkdown(resultadoPmc, { nombre: escuelaNombre, cct: escuelaCct }),
                            tieneIncidencias: resultadoPmc.overallStatus === "REQUIERE_REVISION" || resultadoPmc.overallStatus === "EN_DESARROLLO",
                            scoreNumerico: resultadoPmc.percentage,
                            totalPuntosBrutos: `${resultadoPmc.totalScore}/100`,
                            estatusOficial: resultadoPmc.overallStatus,
                            dimensionesDesglose: resultadoPmc.dimensionScores,
                            criteriosEvaluados: resultadoPmc.criteria,
                            fortalezas: resultadoPmc.strengths,
                            recomendaciones: resultadoPmc.criticalRecommendations,
                        };
                    } else if (modulo === "INFORME_FINAL") {
                        console.log(`[pre-revision] Iniciando evaluación homologada INFORME FINAL PMC para entrega ${entregaId} (${escuelaNombre})...`);
                        const resultadoInforme = await evaluarInformeFinalPMC({
                            textoInformeFinal: extractedText,
                            textoPMCOriginal: textoOriginalPMC,
                            escuelaId: entrega.escuelaId,
                            cct: escuelaCct,
                            escuelaNombre,
                            pdfBuffer: buffer || undefined,
                        });

                        resultado = {
                            tipo: "INFORME_FINAL",
                            aprobado: resultadoInforme.overallStatus === "EXCELENTE" || resultadoInforme.overallStatus === "SATISFACTORIO",
                            puntuacion: `${resultadoInforme.percentage}%`,
                            explicacion: `Evaluación de Cierre de Ciclo: ${resultadoInforme.metasCumplidas}/${resultadoInforme.totalMetasEvaluadas} metas acreditadas (${resultadoInforme.percentage}% de efectividad - ${resultadoInforme.overallStatus})`,
                            borradorCorreo: generarReporteInformeFinalMarkdown(resultadoInforme, { nombre: escuelaNombre, cct: escuelaCct }),
                            tieneIncidencias: resultadoInforme.overallStatus === "REQUIERE_REVISION" || resultadoInforme.overallStatus === "EN_DESARROLLO",
                            scoreNumerico: resultadoInforme.percentage,
                            totalPuntosBrutos: `${resultadoInforme.totalScore}/100`,
                            estatusOficial: resultadoInforme.overallStatus,
                            dimensionesDesglose: resultadoInforme.dimensionScores,
                            criteriosEvaluados: resultadoInforme.criteria,
                            fortalezas: resultadoInforme.strengths,
                            recomendaciones: resultadoInforme.criticalRecommendations,
                        };
                    } else if (modulo === "PIPS") {
                        console.log(`[pre-revision] Iniciando evaluación homologada PIPS para entrega ${entregaId} (${escuelaNombre})...`);
                        const resultadoPips = await evaluarPipsEntrega({
                            textoDocumento: extractedText,
                            escuelaId: entrega.escuelaId,
                            cct: escuelaCct,
                            escuelaNombre,
                            pdfBuffer: buffer || undefined,
                        });

                        resultado = {
                            tipo: "PIPS",
                            aprobado: resultadoPips.overallStatus === "EXCELENTE" || resultadoPips.overallStatus === "SATISFACTORIO",
                            puntuacion: `${resultadoPips.percentage}%`,
                            explicacion: `Evaluación de Cartografía Territorial: ${resultadoPips.passedCriteria}/7 criterios acreditados (${resultadoPips.percentage}% global - ${resultadoPips.overallStatus})`,
                            borradorCorreo: generarReportePipsMarkdown(resultadoPips, { nombre: escuelaNombre, cct: escuelaCct }),
                            tieneIncidencias: resultadoPips.overallStatus === "REQUIERE_REVISION" || resultadoPips.overallStatus === "EN_DESARROLLO",
                            scoreNumerico: resultadoPips.percentage,
                            totalPuntosBrutos: `${resultadoPips.totalScore}/100`,
                            estatusOficial: resultadoPips.overallStatus,
                            dimensionesDesglose: resultadoPips.dimensionScores,
                            criteriosEvaluados: resultadoPips.criteria,
                            fortalezas: resultadoPips.strengths,
                            recomendaciones: resultadoPips.criticalRecommendations,
                        };
                    } else {
                        console.warn(`[pre-revision] Módulo general o no contemplado en evaluadores especializados: ${modulo}. Usando dictamen genérico.`);
                        resultado = {
                            tipo: modulo,
                            aprobado: true,
                            puntuacion: "100%",
                            explicacion: `Documento registrado y aceptado bajo el módulo ${modulo}.`,
                            borradorCorreo: `# Recepción Registrada\nEl documento entregado ha sido registrado bajo el módulo ${modulo}.`,
                            tieneIncidencias: false
                        };
                    }

                } catch (e: any) {
                    console.error(`Error analyzing PMC/PAEC delivery ${entregaId}:`, e);
                    throw e;
                }
            }

        } else if (programaNombre.includes("CONCENTRADO") || programaNombre.includes("INSCRITOS")) {
            // --- CONCENTRADO DE INSCRITOS/REINSCRITOS ---
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (file) {
                const isExcel = file.nombre.toLowerCase().endsWith(".xlsx") || file.nombre.toLowerCase().endsWith(".xls");
                if (!isExcel) {
                    resultado = { tipo: "CONCENTRADO_INSCRITOS", aprobado: false, error: "El archivo debe ser un Excel (.xlsx)" };
                } else {
                    try {
                        const { validarConcentrado } = await import("@/lib/validadores/validador-concentrados");
                        const buffer = await downloadFile(file.driveUrl!);
                        const resultadoValidacion = validarConcentrado(buffer);

                        const erroresCriticos = resultadoValidacion.inconsistencias.filter(i => i.severidad === "ERROR_CRITICO").length;
                        const aprobado = erroresCriticos === 0;
                        const score = Math.max(0, 100 - resultadoValidacion.inconsistencias.length * 5);

                        resultado = {
                            tipo: "CONCENTRADO_INSCRITOS",
                            aprobado,
                            puntuacion: `${score}%`,
                            explicacion: `Registros: ${resultadoValidacion.totalRegistros} | H: ${resultadoValidacion.totalHombres} | M: ${resultadoValidacion.totalMujeres} | Inconsistencias: ${resultadoValidacion.inconsistencias.length} (${erroresCriticos} críticas)`,
                        };
                    } catch (e: any) {
                        console.error("Error validating concentrado Excel:", e);
                        resultado = { tipo: "CONCENTRADO_INSCRITOS", aprobado: false, error: e.message };
                    }
                }
            }

        } else if (programaNombre.includes("CARTAS") && programaNombre.includes("COMPROMISO")) {
            // --- SEGUIMIENTO A CARTAS COMPROMISO ---
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (file) {
                try {
                    const buffer = await downloadFile(file.driveUrl!);
                    let extractedText = "";
                    if (file.nombre.toLowerCase().endsWith(".pdf")) {
                        const pdfRes = await extractTextFromPdf(buffer);
                        extractedText = pdfRes.text;
                    } else if (file.nombre.toLowerCase().endsWith(".docx")) {
                        extractedText = await extractTextFromDocx(buffer);
                    }

                    const systemInstruction = "Eres un Asesor Técnico Pedagógico experto en revisión de documentación escolar.";
                    const prompt = `Analiza este documento de seguimiento a Cartas Compromiso de la escuela ${escuelaNombre} (${escuelaCct}).
Verifica que:
1. Todos los alumnos cuenten con carta compromiso firmada.
2. Las fechas de firma estén dentro del ciclo escolar actual.
3. Esté presente la firma del director.
4. No haya campos obligatorios vacíos.

Responde únicamente en formato JSON:
{
  "aprobado": true/false,
  "puntuacion": "Porcentaje de cumplimiento",
  "observaciones": "Detalle hallazgos (máx 300 palabras)",
  "estadoRecomendado": "APROBADO" o "REQUIERE_CORRECCION"
}`;

                    let rawResponse: string;
                    if (extractedText && extractedText.length > 50) {
                        rawResponse = await callGemini(systemInstruction, prompt + "\n\nTexto extraído del documento:\n" + extractedText.slice(0, 15000), undefined, undefined, undefined, false, entrega.escuelaId);
                    } else {
                        rawResponse = await callGemini(systemInstruction, prompt, buffer, undefined, undefined, false, entrega.escuelaId);
                    }
                    const parsed = cleanAndParseGeminiJson(rawResponse);
                    resultado = {
                        tipo: "CARTAS_COMPROMISO",
                        aprobado: parsed.aprobado,
                        puntuacion: parsed.puntuacion,
                        explicacion: parsed.observaciones,
                        tieneIncidencias: parsed.estadoRecomendado === "REQUIERE_CORRECCION",
                    };
                } catch (e: any) {
                    console.error("Error analyzing cartas compromiso:", e);
                    resultado = { tipo: "CARTAS_COMPROMISO", aprobado: false, error: e.message };
                }
            }

        } else if (programaNombre.includes("INFORMES BIMESTRALES") || programaNombre.includes("INFORME BIMESTRAL")) {
            // --- INFORMES BIMESTRALES A PADRES ---
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (file) {
                try {
                    const buffer = await downloadFile(file.driveUrl!);
                    let extractedText = "";
                    if (file.nombre.toLowerCase().endsWith(".pdf")) {
                        const pdfRes = await extractTextFromPdf(buffer);
                        extractedText = pdfRes.text;
                    } else if (file.nombre.toLowerCase().endsWith(".docx")) {
                        extractedText = await extractTextFromDocx(buffer);
                    }

                    const systemInstruction = "Eres un Asesor Técnico Pedagógico experto en revisión de informes escolares.";
                    const prompt = `Analiza este Informe Bimestral a Padres de Familia de ${escuelaNombre} (${escuelaCct}).
Verifica:
1. Estructura del informe (estadísticas, asistencia, aprovechamiento).
2. Fechas correctas del bimestre.
3. Firma del director.
4. Estadísticas presentes (alumnos, aprovechamiento, deserción).

Responde únicamente en formato JSON:
{
  "aprobado": true/false,
  "puntuacion": "Porcentaje",
  "observaciones": "Detalle (máx 300 palabras)",
  "estadoRecomendado": "APROBADO" o "REQUIERE_CORRECCION"
}`;

                    let rawResponse: string;
                    if (extractedText && extractedText.length > 50) {
                        rawResponse = await callGemini(systemInstruction, prompt + "\n\nTexto extraído:\n" + extractedText.slice(0, 15000), undefined, undefined, undefined, false, entrega.escuelaId);
                    } else {
                        rawResponse = await callGemini(systemInstruction, prompt, buffer, undefined, undefined, false, entrega.escuelaId);
                    }
                    const parsed = cleanAndParseGeminiJson(rawResponse);
                    resultado = {
                        tipo: "INFORMES_BIMESTRALES",
                        aprobado: parsed.aprobado,
                        puntuacion: parsed.puntuacion,
                        explicacion: parsed.observaciones,
                        tieneIncidencias: parsed.estadoRecomendado === "REQUIERE_CORRECCION",
                    };
                } catch (e: any) {
                    console.error("Error analyzing informe bimestral:", e);
                    resultado = { tipo: "INFORMES_BIMESTRALES", aprobado: false, error: e.message };
                }
            }

        } else if (programaNombre.includes("SIMULACRO")) {
            // --- SIMULACRO NACIONAL ---
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (file) {
                try {
                    const buffer = await downloadFile(file.driveUrl!);
                    let extractedText = "";
                    if (file.nombre.toLowerCase().endsWith(".pdf")) {
                        const pdfRes = await extractTextFromPdf(buffer);
                        extractedText = pdfRes.text;
                    }

                    const systemInstruction = "Eres un experto en protección civil escolar.";
                    const prompt = `Analiza este reporte del Simulacro Nacional de ${escuelaNombre} (${escuelaCct}).
Verifica:
1. Hora de evacuación reportada.
2. Número de participantes.
3. Tiempo de evacuación.
4. Descripción de incidencias.

Responde únicamente en formato JSON:
{
  "aprobado": true/false,
  "puntuacion": "Porcentaje",
  "observaciones": "Detalle (máx 300 palabras)",
  "estadoRecomendado": "APROBADO" o "REQUIERE_CORRECCION"
}`;

                    let rawResponse: string;
                    if (extractedText && extractedText.length > 50) {
                        rawResponse = await callGemini(systemInstruction, prompt + "\n\nTexto extraído:\n" + extractedText.slice(0, 15000), undefined, undefined, undefined, false, entrega.escuelaId);
                    } else {
                        rawResponse = await callGemini(systemInstruction, prompt, buffer, undefined, undefined, false, entrega.escuelaId);
                    }
                    const parsed = cleanAndParseGeminiJson(rawResponse);
                    resultado = {
                        tipo: "SIMULACRO",
                        aprobado: parsed.aprobado,
                        puntuacion: parsed.puntuacion,
                        explicacion: parsed.observaciones,
                        tieneIncidencias: parsed.estadoRecomendado === "REQUIERE_CORRECCION",
                    };
                } catch (e: any) {
                    console.error("Error analyzing simulacro:", e);
                    resultado = { tipo: "SIMULACRO", aprobado: false, error: e.message };
                }
            }

        } else if (programaNombre.includes("CULTURA DE PAZ") || programaNombre.includes("SEGURIDAD Y CULTURA")) {
            // --- CULTURA DE PAZ ---
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (file) {
                try {
                    const { evaluarCulturaPaz } = await import("@/lib/validadores/validador-cultura-paz");
                    const { ACTIVIDADES_CULTURA_PAZ } = await import("@/lib/constants");
                    const buffer = await downloadFile(file.driveUrl!);
                    let extractedText = "";
                    if (file.nombre.toLowerCase().endsWith(".pdf")) {
                        const pdfRes = await extractTextFromPdf(buffer);
                        extractedText = pdfRes.text;
                    } else if (file.nombre.toLowerCase().endsWith(".docx")) {
                        extractedText = await extractTextFromDocx(buffer);
                    }

                    const mesIndex = entrega.periodoEntrega.mes || 1;
                    const actividadNombre = ACTIVIDADES_CULTURA_PAZ[mesIndex] || "Actividad de Cultura de Paz";

                    const evaluacion = await evaluarCulturaPaz(
                        extractedText,
                        buffer,
                        { nombre: escuelaNombre, cct: escuelaCct },
                        actividadNombre,
                        entrega.escuelaId
                    );

                    resultado = {
                        tipo: "CULTURA_PAZ",
                        aprobado: evaluacion.aprobado,
                        puntuacion: evaluacion.puntuacion,
                        resumenActividad: evaluacion.resumenActividad,
                        tieneEvidenciaFotografica: evaluacion.tieneEvidenciaFotografica,
                        tieneFirmasSellos: evaluacion.tieneFirmasSellos,
                        participantesEstimados: evaluacion.participantesEstimados,
                        explicacion: evaluacion.observaciones,
                        tieneIncidencias: evaluacion.estadoRecomendado === "REQUIERE_CORRECCION",
                    };
                } catch (e: any) {
                    console.error("Error analyzing cultura de paz:", e);
                    resultado = { tipo: "CULTURA_PAZ", aprobado: false, error: e.message };
                }
            }

        } else if (programaNombre.includes("PIPC") || programaNombre.includes("PROTECCIÓN CIVIL") || programaNombre.includes("PROTECCION CIVIL")) {
            // --- PIPC ---
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (file) {
                try {
                    const { evaluarPIPC } = await import("@/lib/validadores/validador-pipc");
                    const buffer = await downloadFile(file.driveUrl!);
                    let extractedText = "";
                    if (file.nombre.toLowerCase().endsWith(".pdf")) {
                        const pdfRes = await extractTextFromPdf(buffer);
                        extractedText = pdfRes.text;
                    } else if (file.nombre.toLowerCase().endsWith(".docx")) {
                        extractedText = await extractTextFromDocx(buffer);
                    }

                    const evaluacion = await evaluarPIPC(
                        extractedText,
                        buffer,
                        { nombre: escuelaNombre, cct: escuelaCct },
                        entrega.escuelaId
                    );

                    resultado = {
                        tipo: "PIPC",
                        aprobado: evaluacion.aprobado,
                        puntuacion: evaluacion.puntuacion,
                        tieneBrigadas: evaluacion.tieneBrigadas,
                        tienePlanEvacuacion: evaluacion.tienePlanEvacuacion,
                        tieneCroquisSenaletica: evaluacion.tieneCroquisSenaletica,
                        tieneDirectorioEmergencias: evaluacion.tieneDirectorioEmergencias,
                        tieneFirmasSellos: evaluacion.tieneFirmasSellos,
                        explicacion: evaluacion.observaciones,
                        tieneIncidencias: evaluacion.estadoRecomendado === "REQUIERE_CORRECCION",
                    };
                } catch (e: any) {
                    console.error("Error analyzing PIPC:", e);
                    resultado = { tipo: "PIPC", aprobado: false, error: e.message };
                }
            }

        } else if (programaNombre.includes("SEGUROS") || programaNombre.includes("SINIESTRO")) {
            // --- SEGUROS / SINIESTROS ---
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (file) {
                try {
                    const { evaluarSeguros } = await import("@/lib/validadores/validador-seguros");
                    const buffer = await downloadFile(file.driveUrl!);
                    let extractedText = "";
                    if (file.nombre.toLowerCase().endsWith(".pdf")) {
                        const pdfRes = await extractTextFromPdf(buffer);
                        extractedText = pdfRes.text;
                    } else if (file.nombre.toLowerCase().endsWith(".docx")) {
                        extractedText = await extractTextFromDocx(buffer);
                    }

                    const evaluacion = await evaluarSeguros(
                        extractedText,
                        buffer,
                        { nombre: escuelaNombre, cct: escuelaCct },
                        entrega.escuelaId
                    );

                    resultado = {
                        tipo: "SEGUROS",
                        aprobado: evaluacion.aprobado,
                        puntuacion: evaluacion.puntuacion,
                        tipoSiniestroReportado: evaluacion.tipoSiniestroReportado,
                        tienePolizaReferenciada: evaluacion.tienePolizaReferenciada,
                        tieneEvidenciaSoporte: evaluacion.tieneEvidenciaSoporte,
                        tieneFirmasSellos: evaluacion.tieneFirmasSellos,
                        explicacion: evaluacion.observaciones,
                        tieneIncidencias: evaluacion.estadoRecomendado === "REQUIERE_CORRECCION",
                    };
                } catch (e: any) {
                    console.error("Error analyzing seguros:", e);
                    resultado = { tipo: "SEGUROS", aprobado: false, error: e.message };
                }
            }
        }

        // Save result in DB (only executed if no error was thrown)
        if (resultado) {
            await prisma.preRevision.upsert({
                where: { entregaId },
                update: {
                    resultado: resultado as any
                },
                create: {
                    entregaId,
                    resultado: resultado as any
                }
            });
            console.log(`Pre-revision results saved successfully for delivery ${entregaId}`);
        }

    } catch (error) {
        console.error(`Critical error in analizarEntregaConIA for delivery ${entregaId}:`, error);
        try {
            await prisma.preRevision.upsert({
                where: { entregaId },
                update: {
                    resultado: { 
                        tipo: "OTROS",
                        error: "Error crítico al analizar el documento con IA",
                        detalle: error instanceof Error ? error.message : String(error)
                    } as any
                },
                create: {
                    entregaId,
                    resultado: { 
                        tipo: "OTROS",
                        error: "Error crítico al analizar el documento con IA",
                        detalle: error instanceof Error ? error.message : String(error)
                    } as any
                }
            });
        } catch (dbErr) {
            console.error("Failed to save error state to DB:", dbErr);
        }
    }
}
