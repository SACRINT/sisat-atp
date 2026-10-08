import * as XLSX from "xlsx";
import type { PreRevisionResult } from "../pre-revision";

export interface IncidenciaAcosoDetalle {
    mes: string;
    categoria: string;
    edad: string;
    violencia: string[];
    escuela: string;
    cct: string;
    localidad: string;
}

export interface AcosoEscuelaInfo {
    nombre?: string;
    escuelaNombre?: string;
    cct?: string;
    escuelaCct?: string;
    zonaEscolar?: string;
}

export interface AcosoPdfAuditResult {
    firmado: boolean;
    sellado: boolean;
    aprobado: boolean;
    explicacion: string;
}

/**
 * Extrae incidencias de acoso escolar desde el libro Excel oficial.
 * Mapea cada incidencia preservando el mes desde el nombre de la pestaña (sheetName).
 */
export function extraerIncidenciasAcosoExcel(buffer: Buffer): IncidenciaAcosoDetalle[] {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetNames = workbook.SheetNames;
    const incidencias: IncidenciaAcosoDetalle[] = [];

    const isX = (val: unknown): boolean =>
        typeof val === "string" && val.toUpperCase().trim() === "X";

    for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        let currentCategoria = "";

        for (let r = 7; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;

            const celda0 = row[0];
            if (
                celda0 &&
                typeof celda0 === "string" &&
                ["NIÑAS", "NIÑOS", "ADOLESCENTES", "MUJER", "HOMBRE"].includes(celda0.toUpperCase().trim())
            ) {
                currentCategoria = celda0.toUpperCase().trim();
            }

            const schoolName = row[7];
            const cct = row[8];

            if (schoolName || cct) {
                const agFisica = row[2];
                const hostigamiento = row[3];
                const discriminatorio = row[4];
                const otro = row[5];

                const tieneCaso = [agFisica, hostigamiento, discriminatorio, otro].some(isX);

                if (tieneCaso) {
                    const tiposViolencia: string[] = [];
                    if (isX(agFisica)) tiposViolencia.push("Agresión Física");
                    if (isX(hostigamiento)) tiposViolencia.push("Hostigamiento");
                    if (isX(discriminatorio)) tiposViolencia.push("Discriminatorio");
                    if (isX(otro)) tiposViolencia.push("Otro");

                    incidencias.push({
                        mes: sheetName,
                        categoria: currentCategoria || "General",
                        edad: row[1] ? String(row[1]) : "S/D",
                        violencia: tiposViolencia,
                        escuela: schoolName ? String(schoolName).trim() : "N/D",
                        cct: cct ? String(cct).trim() : "N/D",
                        localidad: row[9] ? String(row[9]).trim() : "N/D"
                    });
                }
            }
        }
    }

    return incidencias;
}

/**
 * Generador determinista de borrador de oficio o notificación institucional.
 * Suple con total formalidad la generación de texto en caso de indisponibilidad de IA.
 */
export function generarBorradorOficioAcosoDeterminista(params: {
    escuelaNombre: string;
    escuelaCct: string;
    incidencias: IncidenciaAcosoDetalle[];
    zonaEscolar?: string;
}): string {
    const { escuelaNombre, escuelaCct, incidencias, zonaEscolar } = params;
    const zonaTexto = zonaEscolar ? `Zona Escolar: ${zonaEscolar}` : "Zona Escolar de Bachilleratos";

    const agrupadasPorMes: Record<string, IncidenciaAcosoDetalle[]> = {};
    for (const inc of incidencias) {
        if (!agrupadasPorMes[inc.mes]) {
            agrupadasPorMes[inc.mes] = [];
        }
        agrupadasPorMes[inc.mes].push(inc);
    }

    const desgloseMeses = Object.entries(agrupadasPorMes)
        .map(([mes, lista]) => {
            const casos = lista.map((item, idx) => 
                `   ${idx + 1}. Población: ${item.categoria} (Edad: ${item.edad}) | Modalidad: ${item.violencia.join(", ")} | Sede: ${item.escuela} (${item.cct})`
            ).join("\n");
            return `• Periodo / Mes: ${mes} (${lista.length} caso${lista.length > 1 ? "s" : ""}):\n${casos}`;
        })
        .join("\n\n");

    return `ASUNTO: Notificación de Incidencias Registradas de Acoso Escolar
DESTINATARIO: Dirección General de Bachilleratos / Supervisión Escolar
REMITENTE: Supervisión Técnica Pedagógica - ${zonaTexto}
PLANTEL DE ORIGEN: ${escuelaNombre} (CCT: ${escuelaCct})

Por medio de la presente, se hace del conocimiento de la autoridad competente que, derivado de la revisión y consolidación del expediente mensual de Acoso Escolar presentado por el plantel educativo ${escuelaNombre} (${escuelaCct}), se han identificado un total de ${incidencias.length} incidencia(s) registradas conforme al formato oficial:

${desgloseMeses}

FUNDAMENTACIÓN Y MEDIDAS INMEDIATAS:
Con base en los Lineamientos y Protocolos para la Prevención, Detección y Actuación en Casos de Violencia Escolar de la Dirección General de Bachilleratos (DGB) y el Marco Curricular Común de la Educación Media Superior (MCCEMS), se solicita al plantel:
1. Activar de inmediato las bitácoras de seguimiento y medidas de protección integral a la comunidad estudiantil.
2. Coordinar el acompañamiento psicopedagógico con las instancias de apoyo institucional y tutores legales.
3. Remitir el informe pormenorizado de actuaciones en un plazo no mayor a 5 días hábiles a esta supervisión.

Atentamente,
Supervisión Técnica Pedagógica`;
}

/**
 * Auditor determinista para archivos de reporte de Acoso Escolar en formato Excel.
 */
export function auditarAcosoDeterministaExcel(
    buffer: Buffer,
    escuela: AcosoEscuelaInfo
): PreRevisionResult {
    const incidencias = extraerIncidenciasAcosoExcel(buffer);
    const escuelaNombre = escuela.nombre || escuela.escuelaNombre || "Plantel Educativo";
    const escuelaCct = escuela.cct || escuela.escuelaCct || "S/CCT";

    if (incidencias.length > 0) {
        const borradorCorreo = generarBorradorOficioAcosoDeterminista({
            escuelaNombre,
            escuelaCct,
            incidencias,
            zonaEscolar: escuela.zonaEscolar
        });

        return {
            tipo: "ACOSO_ESCOLAR",
            tieneIncidencias: true,
            incidenciasDetalle: incidencias,
            borradorCorreo,
            aprobado: true,
            explicacion: `Se detectaron ${incidencias.length} incidencias de acoso escolar en el reporte Excel. Se generó borrador institucional de notificación.`
        };
    }

    return {
        tipo: "ACOSO_ESCOLAR",
        tieneIncidencias: false,
        incidenciasDetalle: [],
        aprobado: true,
        explicacion: "Reporte en Excel sin incidencias registradas. No se detectaron casos de acoso escolar en los periodos analizados."
    };
}

/**
 * Auditor determinista para archivos de reporte de Acoso Escolar en formato PDF (Reporte de Cero Casos).
 * Verifica formalidad institucional (firmas, sellos, membretes o texto de declaratoria).
 */
export function auditarAcosoDeterministaPdf(
    bufferOrText: Buffer | string,
    escuela: AcosoEscuelaInfo
): AcosoPdfAuditResult {
    let texto = "";

    if (typeof bufferOrText === "string") {
        texto = bufferOrText;
    } else if (Buffer.isBuffer(bufferOrText)) {
        const isBinary = /[\x00-\x08\x0E-\x1F]/.test(bufferOrText.slice(0, 100).toString("binary"));
        if (isBinary) {
            return {
                firmado: false,
                sellado: false,
                aprobado: false,
                explicacion: "Formato no legible sin IA — requiere revisión manual"
            };
        }
        texto = bufferOrText.toString("utf-8");
    }

    if (!texto || texto.trim().length === 0) {
        return {
            firmado: false,
            sellado: false,
            aprobado: false,
            explicacion: "Formato no legible sin IA — requiere revisión manual"
        };
    }

    const tLower = texto.toLowerCase();

    // Verificación de firma autógrafa y representatividad directiva
    const tieneNegacionFirma = /sin\s+firma|no\s+firmado|falta\s+firma|carece\s+de\s+firma/i.test(tLower);
    const tieneRepresentante = /director|directora|atentamente|titular|responsable|suscribe|mtro\.|mtra\.|lic\.|prof\./i.test(tLower);
    const tieneMencionFirmaPositiva = /(?:con\s+)?firma(?:\s+aut[oó]grafa)?/i.test(tLower) && !tieneNegacionFirma;
    const firmado = (tieneRepresentante || tieneMencionFirmaPositiva) && !tieneNegacionFirma;

    // Verificación de sello o adscripción oficial
    const tieneNegacionSello = /sin\s+sello|no\s+sellado|falta\s+sello/i.test(tLower);
    const tieneTerminoSello = /sello\s+oficial|sello\s+del\s+plantel|clave\s*c\.?t\.?|zona\s*escolar/i.test(tLower);
    const cctVal = escuela.cct || escuela.escuelaCct || "";
    const cctMatch = cctVal ? tLower.includes(cctVal.toLowerCase()) : false;
    const sellado = (tieneTerminoSello || cctMatch) && !tieneNegacionSello;
    const aprobado = firmado && sellado;

    let explicacion = "";
    if (aprobado) {
        explicacion = "Oficio de reporte sin incidencias validado deterministamente: cuenta con formalidad de firma institucional y sello/adscripción del plantel.";
    } else {
        const faltantes: string[] = [];
        if (!firmado) faltantes.push("firma del titular");
        if (!sellado) faltantes.push("sello oficial o clave de centro de trabajo");
        explicacion = `El documento carece de elementos formales indispensables: ${faltantes.join(", ")}.`;
    }

    return {
        firmado,
        sellado,
        aprobado,
        explicacion
    };
}
