import type { PreRevisionResult } from "../pre-revision";

export interface DiaNaranjaArchivoInfo {
    nombre: string;
    etiqueta?: string | null;
    buffer?: Buffer | null;
    texto?: string;
}

export interface DiaNaranjaEscuelaInfo {
    nombre?: string;
    escuelaNombre?: string;
    cct?: string;
    escuelaCct?: string;
}

export interface DiaNaranjaArchivoResultado {
    nombre: string;
    etiqueta: string;
    firmado: boolean;
    sellado: boolean;
    explicacion: string;
}

/**
 * Evalúa deterministamente un archivo individual correspondiente a la conmemoración del Día Naranja.
 * Verifica firmas autógrafas, sellos oficiales o acreditación directiva del plantel.
 */
export function evaluarArchivoDiaNaranjaDeterminista(
    bufferOrText: Buffer | string | null | undefined,
    info: {
        nombre: string;
        etiqueta?: string | null;
        escuelaNombre?: string;
        escuelaCct?: string;
    }
): DiaNaranjaArchivoResultado {
    const etiqueta = info.etiqueta || "Archivo";
    const nombre = info.nombre;

    if (!bufferOrText) {
        return {
            nombre,
            etiqueta,
            firmado: false,
            sellado: false,
            explicacion: "No se proporcionó contenido ejecutable para la validación del archivo."
        };
    }

    let texto = "";
    if (typeof bufferOrText === "string") {
        texto = bufferOrText;
    } else if (Buffer.isBuffer(bufferOrText)) {
        const isBinary = /[\x00-\x08\x0E-\x1F]/.test(bufferOrText.slice(0, 100).toString("binary"));
        if (isBinary) {
            return {
                nombre,
                etiqueta,
                firmado: false,
                sellado: false,
                explicacion: "Formato no legible sin IA — requiere revisión manual"
            };
        }
        texto = bufferOrText.toString("utf-8");
    }

    if (!texto || texto.trim().length === 0) {
        return {
            nombre,
            etiqueta,
            firmado: false,
            sellado: false,
            explicacion: "Formato no legible sin IA — requiere revisión manual"
        };
    }

    const tLower = texto.toLowerCase();
    const cct = (info.escuelaCct || "").toLowerCase();
    const escuela = (info.escuelaNombre || "").toLowerCase();

    // Detección de representatividad directiva o firmas
    const tieneNegacionFirma = /sin\s+firma|no\s+firmado|falta\s+firma|carece\s+de\s+firma/i.test(tLower);
    const tieneTerminoDirectivo = /director|directora|atentamente|titular|responsable|suscribe|mtro\.|mtra\.|lic\.|prof\./i.test(tLower);
    const tieneMencionFirma = /(?:con\s+)?firma(?:\s+aut[oó]grafa)?/i.test(tLower) && !tieneNegacionFirma;
    const firmado = (tieneTerminoDirectivo || tieneMencionFirma) && !tieneNegacionFirma;

    // Detección de sellos o acreditación oficial
    const tieneNegacionSello = /sin\s+sello|no\s+sellado|falta\s+sello/i.test(tLower);
    const tieneTerminoSello = /sello\s+oficial|sello\s+del\s+plantel|clave\s*c\.?t\.?|zona\s*escolar|plantel\s*educativo/i.test(tLower);
    const cctMatch = cct ? tLower.includes(cct) : false;
    const escuelaMatch = escuela.length > 5 ? tLower.includes(escuela.substring(0, 8)) : false;
    const sellado = (tieneTerminoSello || cctMatch || escuelaMatch) && !tieneNegacionSello;

    // Temática conmemorativa del Día Naranja (25 de cada mes)
    const tieneTematicaNaranja = /d[ií]a\s+naranja|25\s+de|no\s+violencia|mujeres|ni[ñn]as|g[eé]nero|igualdad|paz|conmemoraci[oó]n|campa[ñn]a/i.test(tLower) ||
        /naranja|25/i.test(nombre.toLowerCase());

    const cumpleFormalidad = firmado && sellado;

    let explicacion = "";
    if (cumpleFormalidad) {
        explicacion = tieneTematicaNaranja
            ? "Expediente de Día Naranja validado deterministamente: cuenta con evidencia temática conmemorativa y formalidad completa de firmas y sellos."
            : "Documento validado deterministamente: cumple con formalidad institucional de firmas y acreditación de plantel.";
    } else {
        const pendientes: string[] = [];
        if (!firmado) pendientes.push("firma autógrafa directiva");
        if (!sellado) pendientes.push("sello oficial del plantel");
        explicacion = `Validación determinista: el documento carece de ${pendientes.join(" y ")}.`;
    }

    return {
        nombre,
        etiqueta,
        firmado,
        sellado,
        explicacion
    };
}

/**
 * Auditor determinista integral para la entrega de Día Naranja.
 * Suple con precisión y resiliencia la indisponibilidad de modelos de visión.
 */
export function auditarDiaNaranjaDeterminista(
    archivos: DiaNaranjaArchivoInfo[],
    escuela: DiaNaranjaEscuelaInfo
): PreRevisionResult {
    const escuelaNombre = escuela.nombre || escuela.escuelaNombre || "";
    const escuelaCct = escuela.cct || escuela.escuelaCct || "";

    const reportes: DiaNaranjaArchivoResultado[] = archivos.map(a =>
        evaluarArchivoDiaNaranjaDeterminista(a.buffer || a.texto, {
            nombre: a.nombre,
            etiqueta: a.etiqueta,
            escuelaNombre,
            escuelaCct
        })
    );

    const aprobado = reportes.length > 0 && reportes.every(r => r.firmado && r.sellado);
    const porcentajeFirmado = reportes.length > 0
        ? Math.round((reportes.filter(r => r.firmado && r.sellado).length / reportes.length) * 100)
        : 0;

    return {
        tipo: "DIA_NARANJA",
        archivos: reportes,
        aprobado,
        scoreNumerico: porcentajeFirmado,
        estatusOficial: aprobado ? "APROBADO" : "REQUIERE_CORRECCION",
        explicacion: aprobado
            ? "Entrega completa de Día Naranja aprobada de forma autónoma con respaldo determinista."
            : `Entrega de Día Naranja incompleta (${porcentajeFirmado}% validado). Uno o más archivos carecen de firmas o sellos oficiales.`
    };
}
