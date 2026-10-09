/**
 * estadistica-911-pdf-extractor.ts
 * Servicio de extracción multimodal y determinista para formatos oficiales 911 (PDF digital, escaneado o imagen).
 * Integra extracción de texto local (pdf-parse) y fallback a IA Multimodal (Gemini Flash) para OCR de tablas.
 */

import { DatosFormato911, DetalleGradoInput } from "./estadistica-911-engine";
import { callGemini } from "./gemini";

interface GeminiSemestreDto {
    semestre: number;
    hombres: number;
    mujeres: number;
    total: number;
    grupos?: number | null;
}

interface GeminiExtraccion911Dto {
    cct?: string | null;
    nombreEscuela?: string | null;
    totalDocentes?: number | null;
    totalAlumnos?: number | null;
    tipoCorte?: "INICIO_DE_CURSOS" | "FIN_DE_CURSOS" | null;
    semestres?: GeminiSemestreDto[] | null;
}

const geminiResponseSchema = {
    type: "OBJECT",
    properties: {
        cct: { type: "STRING" },
        nombreEscuela: { type: "STRING" },
        totalDocentes: { type: "INTEGER" },
        totalAlumnos: { type: "INTEGER" },
        tipoCorte: { type: "STRING", enum: ["INICIO_DE_CURSOS", "FIN_DE_CURSOS"] },
        semestres: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    semestre: { type: "INTEGER" },
                    hombres: { type: "INTEGER" },
                    mujeres: { type: "INTEGER" },
                    total: { type: "INTEGER" },
                    grupos: { type: "INTEGER" }
                },
                required: ["semestre", "hombres", "mujeres", "total"]
            }
        }
    },
    required: ["cct", "semestres"]
};

/**
 * Limpia y parsea la respuesta JSON emitida por la IA, eliminando bloques de markdown.
 */
function parseJsonSeguro(rawText: string): GeminiExtraccion911Dto | null {
    try {
        let cleaned = rawText.trim();
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "");
        }
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
        return JSON.parse(cleaned) as GeminiExtraccion911Dto;
    } catch {
        return null;
    }
}

/**
 * Intenta extraer datos del texto digital mediante heurísticas y expresiones regulares.
 */
function intentarExtraerTextoDigital(texto: string): DatosFormato911 | null {
    // 1. CCT
    const cctMatch = texto.match(/\b\d{2}[A-Z]{3}\d{4}[A-Z]\b/);
    const cct = cctMatch ? cctMatch[0] : undefined;

    // 2. Nombre de escuela (si se identifica línea previa al CCT o encabezado)
    let nombreEscuela: string | undefined;
    const lines = texto.split("\n").map(l => l.trim()).filter(Boolean);
    if (cct) {
        const cctIdx = lines.findIndex(l => l.includes(cct));
        if (cctIdx > 0) {
            const prev = lines[cctIdx - 1];
            if (prev && !prev.includes("CLAVE") && !prev.includes("CENTRO") && prev.length > 3) {
                nombreEscuela = prev;
            }
        }
    }

    // 3. Docentes
    let totalDocentes: number | undefined;
    const docMatch = texto.match(/(?:TOTAL DE DOCENTES|DOCENTES FRENTE A GRUPO|DOCENTES)[\s:]+(\d+)/i);
    if (docMatch) {
        totalDocentes = parseInt(docMatch[1], 10);
    }

    // 4. Tipo de corte
    const tipoCorte = (texto.toUpperCase().includes("FIN DE CURSOS") || texto.toUpperCase().includes("FIN DE CICLO"))
        ? "FIN_DE_CURSOS"
        : "INICIO_DE_CURSOS";

    // 5. Semestres por regex
    const semestresMap: Record<number, DetalleGradoInput> = {
        1: { semestreGrado: 1, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
        2: { semestreGrado: 2, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
        3: { semestreGrado: 3, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
        4: { semestreGrado: 4, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
        5: { semestreGrado: 5, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
        6: { semestreGrado: 6, hombres: 0, mujeres: 0, total: 0, grupos: 0 }
    };

    let semestresDetectados = 0;

    for (const linea of lines) {
        for (let s = 1; s <= 6; s++) {
            const semRegex = new RegExp(`(^|[^0-9])${s}(?:°|ER|DO|RO|TO|\\s+SEMESTRE|\\s+SEM)(.*)`, "i");
            const match = linea.match(semRegex);
            if (match) {
                const resto = match[2];
                const nums = (resto.match(/\b\d+\b/g) || []).map(n => parseInt(n, 10));
                if (nums.length >= 3) {
                    const h = nums[0];
                    const m = nums[1];
                    const tot = nums[2];
                    const grp = nums.length >= 4 ? nums[3] : (tot > 0 ? 1 : 0);
                    semestresMap[s] = {
                        semestreGrado: s,
                        hombres: h,
                        mujeres: m,
                        total: tot,
                        grupos: grp
                    };
                    if (tot > 0 || h > 0 || m > 0) {
                        semestresDetectados++;
                    }
                }
            }
        }
    }

    // Si no logramos al menos 1 semestre con números positivos, caer a OCR
    if (semestresDetectados === 0) {
        return null;
    }

    const grados: DetalleGradoInput[] = [];
    for (let s = 1; s <= 6; s++) {
        grados.push(semestresMap[s]);
    }

    const totalCalculado = grados.reduce((acc, g) => acc + g.total, 0);

    return {
        cct,
        nombreEscuela,
        tipoCorte,
        totalDocentes,
        totalAlumnos: totalCalculado > 0 ? totalCalculado : undefined,
        grados
    };
}

/**
 * Ejecuta OCR y extracción estructurada con IA Multimodal (Gemini Flash).
 */
async function extraerConOcrGemini(buffer: Buffer, mimeType: string): Promise<DatosFormato911 | null> {
    try {
        const systemInstruction = `Eres un experto de alta precisión en análisis e interpretación de formatos oficiales de Estadística 911 y Concentrado Estadístico de Educación Media Superior en México (SEP, DGB, SEMS).
Tu misión es extraer fielmente las cifras oficiales de matrícula por grado/semestre, total de alumnos, docentes y datos del plantel.
Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin bloques de código markdown, explicaciones ni texto adicional.`;

        const prompt = `Extrae los datos del formato 911. Devuelve SOLO JSON con: cct, nombreEscuela, totalDocentes, totalAlumnos, y semestres[] con {semestre:1-6, hombres, mujeres, total, grupos}. No inventes; usa null si falta un dato.`;

        const pdfMimeType = mimeType.startsWith("image/") ? mimeType : "application/pdf";
        const rawResponse = await callGemini(
            systemInstruction,
            prompt,
            buffer,
            pdfMimeType,
            geminiResponseSchema,
            false
        );

        if (!rawResponse || typeof rawResponse !== "string") {
            return null;
        }

        const parsed = parseJsonSeguro(rawResponse);
        if (!parsed) {
            return null;
        }

        const semestresMap: Record<number, DetalleGradoInput> = {
            1: { semestreGrado: 1, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
            2: { semestreGrado: 2, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
            3: { semestreGrado: 3, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
            4: { semestreGrado: 4, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
            5: { semestreGrado: 5, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
            6: { semestreGrado: 6, hombres: 0, mujeres: 0, total: 0, grupos: 0 }
        };

        let tieneNumerosValidos = false;

        if (Array.isArray(parsed.semestres)) {
            for (const s of parsed.semestres) {
                const numSem = Number(s.semestre);
                if (numSem >= 1 && numSem <= 6) {
                    const h = Math.max(0, Number(s.hombres) || 0);
                    const m = Math.max(0, Number(s.mujeres) || 0);
                    const tot = Math.max(0, Number(s.total) || 0);
                    const grp = s.grupos !== undefined && s.grupos !== null
                        ? Math.max(0, Number(s.grupos) || 0)
                        : (tot > 0 ? 1 : 0);

                    semestresMap[numSem] = {
                        semestreGrado: numSem,
                        hombres: h,
                        mujeres: m,
                        total: tot,
                        grupos: grp
                    };

                    if (h > 0 || m > 0 || tot > 0) {
                        tieneNumerosValidos = true;
                    }
                }
            }
        }

        // Validación de sanidad: Si no hay semestres numéricos válidos, rechazar
        const totalAlumnosReportado = parsed.totalAlumnos !== null && parsed.totalAlumnos !== undefined
            ? Number(parsed.totalAlumnos)
            : undefined;

        if (!tieneNumerosValidos || (totalAlumnosReportado !== undefined && totalAlumnosReportado > 0 && !tieneNumerosValidos)) {
            return null;
        }

        const grados: DetalleGradoInput[] = [];
        for (let s = 1; s <= 6; s++) {
            grados.push(semestresMap[s]);
        }

        return {
            cct: parsed.cct || undefined,
            nombreEscuela: parsed.nombreEscuela || undefined,
            tipoCorte: parsed.tipoCorte || "INICIO_DE_CURSOS",
            totalDocentes: parsed.totalDocentes !== null && parsed.totalDocentes !== undefined
                ? Number(parsed.totalDocentes)
                : undefined,
            totalAlumnos: totalAlumnosReportado,
            grados
        };
    } catch {
        return null;
    }
}

/**
 * Función principal que orquesta la extracción del formato 911 desde PDF o imagen.
 */
export async function extraerDatos911(buffer: Buffer, mimeType: string): Promise<DatosFormato911 | null> {
    try {
        const esImagen = mimeType.startsWith("image/");
        let textoDigital = "";

        if (!esImagen) {
            try {
                const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
                const pdfData = await pdfParse(buffer);
                textoDigital = (pdfData.text || "").trim();
            } catch {
                textoDigital = "";
            }
        }

        // Si es imagen o el texto es escaso (< 80 caracteres), canalizar a OCR
        if (esImagen || textoDigital.length < 80) {
            return await extraerConOcrGemini(buffer, mimeType);
        }

        // 2. Intentar rama digital con regex
        const datosDigitales = intentarExtraerTextoDigital(textoDigital);
        if (datosDigitales) {
            return datosDigitales;
        }

        // 3. Fallback a OCR si la heurística regex no detectó semestres válidos
        return await extraerConOcrGemini(buffer, mimeType);
    } catch {
        return null;
    }
}
