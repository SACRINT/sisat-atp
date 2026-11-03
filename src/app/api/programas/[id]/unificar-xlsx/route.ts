import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getNombrePeriodo } from "@/lib/constants";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** 1 pixel in DrawingML EMUs at 96 DPI */
const EMU_PER_PIXEL = 9525;
const MAX_SERVERLESS_BYTES = 20 * 1024 * 1024; // 20 MB

function configureCloudinary() {
    cloudinary.config({
        cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
}

function parseCloudinaryUrl(url: string) {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(
        /res\.cloudinary\.com\/([^/]+)\/(\w+)\/upload\/(?:v\d+\/)?(.+)$/
    );
    if (!match) return null;

    const cloudName = match[1];
    const resourceType = match[2];
    const fullPath = match[3];
    const lastDot = fullPath.lastIndexOf(".");
    const format = lastDot > 0 ? fullPath.slice(lastDot + 1) : "";

    const publicId =
        resourceType === "raw"
            ? fullPath
            : (lastDot > 0 ? fullPath.slice(0, lastDot) : fullPath);

    return { cloudName, resourceType, publicId, format };
}

/**
 * Extracts cell value as clean string, unpacking OpenXML RichText and formula results.
 * Prevents `[object Object]` from appearing in consolidated tables.
 */
function getCellValueAsString(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (typeof value === "object") {
        const valObj = value as Record<string, unknown>;
        if (Array.isArray(valObj.richText)) {
            return valObj.richText.map((p: any) => p?.text || "").join("").trim();
        }
        if (valObj.result !== undefined) {
            return getCellValueAsString(valObj.result);
        }
        if (typeof valObj.text === "string") {
            return valObj.text.trim();
        }
    }
    return String(value).trim();
}

/**
 * Normalizes strings by removing accents and converting to uppercase for comparison.
 */
function normalizeText(s: string): string {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

/**
 * Downloads file buffer with fallback between direct CDN URL and signed Cloudinary HMAC URL candidates.
 */
async function fetchFileBuffer(fileUrl: string, driveId?: string | null): Promise<Buffer | null> {
    try {
        const directRes = await fetch(fileUrl, {
            headers: { "User-Agent": "SISAT-ATP/1.0" },
            signal: AbortSignal.timeout(12000),
        });
        if (directRes.ok) {
            const arr = await directRes.arrayBuffer();
            return Buffer.from(arr);
        }
    } catch {
        // Direct fetch failed, continue to Cloudinary fallback
    }

    try {
        const cloudName = process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET;

        if (cloudName && apiKey && apiSecret && fileUrl.includes("res.cloudinary.com")) {
            configureCloudinary();
            const parsed = parseCloudinaryUrl(fileUrl);
            const basePublicId = driveId || parsed?.publicId;
            if (basePublicId) {
                const candidates = [
                    { resType: "raw", id: basePublicId, format: "" },
                    { resType: "raw", id: basePublicId.replace(/\.[^/.]+$/, ""), format: "xlsx" },
                    { resType: "image", id: basePublicId.replace(/\.[^/.]+$/, ""), format: "xlsx" },
                    { resType: "image", id: basePublicId, format: "" },
                ];

                for (const cand of candidates) {
                    try {
                        const signedUrl = cloudinary.utils.private_download_url(
                            cand.id,
                            cand.format,
                            { resource_type: cand.resType as any, type: "upload" }
                        );
                        const signedRes = await fetch(signedUrl, { signal: AbortSignal.timeout(10000) });
                        if (signedRes.ok) {
                            const arr = await signedRes.arrayBuffer();
                            return Buffer.from(arr);
                        }
                    } catch {
                        // continue to next candidate
                    }
                }
            }
        }
    } catch (e) {
        console.warn(`[unificar-xlsx] Failed fallback download for ${fileUrl}:`, e);
    }
    return null;
}

/**
 * Locates the master template from public/ or other server directories.
 */
function getMasterTemplatePath(): string | null {
    const candidates = [
        path.join(process.cwd(), "public", "plantillas", "Dia_Naranja", "EVIDENCIA DE ACTIVIDADES DÍA NARANJA ZONA004.xlsx"),
        path.join(process.cwd(), "documentos_referencia", "Dia_Naranja", "EVIDENCIA DE ACTIVIDADES DÍA NARANJA ZONA004.xlsx"),
        path.join(__dirname, "..", "..", "..", "..", "..", "public", "plantillas", "Dia_Naranja", "EVIDENCIA DE ACTIVIDADES DÍA NARANJA ZONA004.xlsx"),
        path.join(__dirname, "..", "..", "..", "..", "..", "documentos_referencia", "Dia_Naranja", "EVIDENCIA DE ACTIVIDADES DÍA NARANJA ZONA004.xlsx"),
        path.resolve("./public/plantillas/Dia_Naranja/EVIDENCIA DE ACTIVIDADES DÍA NARANJA ZONA004.xlsx"),
        path.resolve("./documentos_referencia/Dia_Naranja/EVIDENCIA DE ACTIVIDADES DÍA NARANJA ZONA004.xlsx"),
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

/**
 * Safely extracts image buffer and extension from an ExcelJS workbook without assuming raw internal model indices.
 */
function extractImageMedia(
    workbook: ExcelJS.Workbook,
    img: { imageId: string; range: ExcelJS.ImageRange } | any
): { buffer: Buffer; extension: string } | null {
    // 1. Try public API workbook.getImage(numericId)
    const numericId = parseInt(img.imageId, 10);
    let mediaItem: any = !isNaN(numericId) ? workbook.getImage(numericId) : null;

    // 2. Safe fallback: search media array by id/index/name
    if (!mediaItem && Array.isArray((workbook as any).media)) {
        mediaItem = (workbook as any).media.find((m: any, idx: number) =>
            idx === numericId || String(m.index) === String(img.imageId) || String(m.name) === String(img.imageId)
        );
    }

    if (!mediaItem && Array.isArray((workbook as any).model?.media)) {
        mediaItem = (workbook as any).model.media.find((m: any, idx: number) =>
            idx === numericId || String(m.index) === String(img.imageId) || String(m.name) === String(img.imageId)
        );
    }

    if (!mediaItem) return null;

    let buf: Buffer | null = null;
    if (Buffer.isBuffer(mediaItem.buffer)) {
        buf = mediaItem.buffer;
    } else if (mediaItem.buffer instanceof Uint8Array || mediaItem.buffer instanceof ArrayBuffer) {
        buf = Buffer.from(mediaItem.buffer);
    } else if (typeof mediaItem.base64 === "string") {
        buf = Buffer.from(mediaItem.base64, "base64");
    }

    if (!buf) return null;
    const extension = (mediaItem.extension === "jpg" ? "jpeg" : mediaItem.extension) || "jpeg";
    return { buffer: buf, extension };
}

interface ColumnaPersonalMap {
    mantenimiento?: number;
    administrativos?: number;
    docentes?: number;
    directores?: number;
    supervisores?: number;
    atp?: number;
    jefes?: number;
}

/**
 * Dynamically detects personnel columns by inspecting header text in rows 15-18.
 * Avoids hardcoding column letters (H, I, J, K, L, M, N).
 */
function detectarColumnasPersonal(ws: ExcelJS.Worksheet): ColumnaPersonalMap {
    const colMap: ColumnaPersonalMap = {};
    for (let r = 15; r <= 18; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= 20; c++) {
            const val = normalizeText(getCellValueAsString(row.getCell(c).value));
            if (val.includes("MANTENIMIENTO")) colMap.mantenimiento = c;
            else if (val.includes("ADMINISTRATIV")) colMap.administrativos = c;
            else if (val.includes("DOCENTE")) colMap.docentes = c;
            else if (val.includes("DIRECTOR")) colMap.directores = c;
            else if (val.includes("SUPERVISOR")) colMap.supervisores = c;
            else if (val.includes("A.T.P.") || val.includes("ATP") || val.includes("INSPECTOR")) colMap.atp = c;
            else if (val.includes("JEFE")) colMap.jefes = c;
        }
    }
    return colMap;
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // 1. Auth check: Admin only
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const programaId = params.id;

        const body = await request.json().catch(() => ({}));
        const { periodoId } = body as { periodoId?: string };

        // 2. Exigir periodoId explícito (evita adivinanzas)
        if (!periodoId || typeof periodoId !== "string" || !periodoId.trim()) {
            return NextResponse.json({
                error: "Debe especificar un 'periodoId' válido para generar el concentrado zonal de ese periodo."
            }, { status: 400 });
        }

        // 3. Query program and target period
        const programa = await prisma.programa.findUnique({
            where: { id: programaId },
            include: {
                periodos: {
                    where: { id: periodoId },
                    include: {
                        entregas: {
                            include: {
                                escuela: true,
                                archivos: true,
                            }
                        }
                    }
                }
            }
        });

        if (!programa) {
            return NextResponse.json({ error: "Programa no encontrado" }, { status: 404 });
        }

        const targetPeriodo = programa.periodos[0];
        if (!targetPeriodo) {
            return NextResponse.json({
                error: `No se encontró el periodo con id '${periodoId}' para este programa.`
            }, { status: 404 });
        }

        // 4. Filtrar entregas que tengan archivos válidos de tipo ENTREGA con extensión .xlsx
        const entregasConXlsx = targetPeriodo.entregas.filter(e =>
            e.archivos && e.archivos.some(a =>
                a.tipo === "ENTREGA" &&
                a.driveUrl &&
                (a.nombre.toLowerCase().endsWith(".xlsx") || a.driveUrl.toLowerCase().includes(".xlsx"))
            )
        );

        if (entregasConXlsx.length === 0) {
            return NextResponse.json({
                error: "No se encontraron archivos de entrega en Excel (.xlsx) en este periodo."
            }, { status: 404 });
        }

        // 5. Localizar plantilla maestra verificando con fs.existsSync
        const templatePath = getMasterTemplatePath();
        if (!templatePath) {
            return NextResponse.json({
                error: "Plantilla maestra de Día Naranja no encontrada en el servidor. Verifique que exista en public/plantillas/Dia_Naranja/."
            }, { status: 500 });
        }

        // 6. Leer plantilla maestra con ExcelJS
        const masterWb = new ExcelJS.Workbook();
        await masterWb.xlsx.readFile(templatePath);
        const masterWs = masterWb.worksheets[0];

        // Ancho suficiente en Columna G para fotos horizontales lado a lado
        masterWs.getColumn("G").width = 78;

        // Detectar columnas de personal en la plantilla maestra
        const masterCols = detectarColumnasPersonal(masterWs);

        // Detectar escuelas en filas 18-34 de la plantilla maestra
        const escuelasMaster: Record<string, { row: number; label: string }> = {};
        for (let r = 18; r <= 34; r++) {
            const val = getCellValueAsString(masterWs.getCell(`G${r}`).value);
            const match = val.match(/\((21[A-Z0-9]+)\)/i);
            if (match) {
                escuelasMaster[match[1].toUpperCase()] = { row: r, label: val };
            }
        }

        // 7. Procesar entregas por escuela
        interface DatosEscuela {
            cct: string;
            nombreCt?: string;
            topCounts?: {
                mantenimiento: number | null;
                administrativos: number | null;
                docentes: number | null;
                directores: number | null;
                supervisores: number | null;
                atp: number | null;
                jefes: any;
            };
            actData?: {
                nombreCt: string | null;
                actividad: string;
                objetivo: string;
                descripcion: string;
            };
            images: { buffer: Buffer; extension: string }[];
        }

        const datosEscuelas: Record<string, DatosEscuela> = {};
        const escuelasExitosas: { cct: string; nombre: string; fotos: number }[] = [];
        const escuelasFallidas: { cct: string; nombre: string; motivo: string }[] = [];

        // Registrar escuelas que entregaron solo PDF o no entregaron .xlsx
        for (const e of targetPeriodo.entregas) {
            const cct = e.escuela.cct.toUpperCase();
            if (!escuelasMaster[cct]) continue;
            const tieneXlsx = e.archivos?.some(a =>
                a.tipo === "ENTREGA" &&
                a.driveUrl &&
                (a.nombre.toLowerCase().endsWith(".xlsx") || a.driveUrl.toLowerCase().includes(".xlsx"))
            );
            if (!tieneXlsx) {
                const tienePdf = e.archivos?.some(a => a.tipo === "ENTREGA");
                escuelasFallidas.push({
                    cct,
                    nombre: e.escuela.nombre,
                    motivo: tienePdf
                        ? "Entregó solo archivo PDF (falta formato Excel .xlsx)"
                        : "Sin archivo de entrega en este periodo"
                });
            }
        }

        // Ordenar entregas por fecha más reciente
        const entregasOrdenadas = [...entregasConXlsx].sort((a, b) => {
            const dateA = a.fechaSubida ? new Date(a.fechaSubida).getTime() : new Date(a.createdAt).getTime();
            const dateB = b.fechaSubida ? new Date(b.fechaSubida).getTime() : new Date(b.createdAt).getTime();
            return dateB - dateA;
        });

        for (const entrega of entregasOrdenadas) {
            const cct = entrega.escuela.cct.toUpperCase();

            // Filtrar archivos de tipo ENTREGA con extensión .xlsx y tomar el más reciente
            const archivosXlsx = entrega.archivos
                .filter(a => a.tipo === "ENTREGA" && a.driveUrl && (a.nombre.toLowerCase().endsWith(".xlsx") || a.driveUrl.toLowerCase().includes(".xlsx")))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            const archivoXlsx = archivosXlsx[0];
            if (!archivoXlsx || !archivoXlsx.driveUrl) {
                escuelasFallidas.push({ cct, nombre: entrega.escuela.nombre, motivo: "Sin archivo de tipo ENTREGA .xlsx" });
                continue;
            }

            const fileBuf = await fetchFileBuffer(archivoXlsx.driveUrl, archivoXlsx.driveId);
            if (!fileBuf) {
                escuelasFallidas.push({ cct, nombre: entrega.escuela.nombre, motivo: "Archivo no encontrado en almacenamiento remoto (HTTP 404)" });
                continue;
            }

            try {
                const schoolWb = new ExcelJS.Workbook();
                await schoolWb.xlsx.load(fileBuf as any);
                const schoolWs = schoolWb.worksheets[0];

                // Detectar columnas de personal dinámicamente en la hoja de la escuela
                const schoolCols = detectarColumnasPersonal(schoolWs);

                // 7.1. Detección dinámica de cabecera de actividad
                let actHeaderRow: number | null = null;
                for (let r = 20; r <= Math.min(schoolWs.rowCount, 55); r++) {
                    for (let c = 1; c <= 8; c++) {
                        const cellVal = normalizeText(getCellValueAsString(schoolWs.getRow(r).getCell(c).value));
                        if (cellVal.includes("ACTIVIDAD") || cellVal.includes("OBJETIVO") || cellVal.includes("DESCRIPCI")) {
                            actHeaderRow = r;
                            break;
                        }
                    }
                    if (actHeaderRow) break;
                }

                // 7.2. Extraer datos de la actividad
                let actData: DatosEscuela["actData"] = undefined;
                if (actHeaderRow) {
                    for (let r = actHeaderRow + 1; r <= Math.min(schoolWs.rowCount, actHeaderRow + 10); r++) {
                        const row = schoolWs.getRow(r);
                        const act = getCellValueAsString(row.getCell(4).value);
                        const obj = getCellValueAsString(row.getCell(5).value);
                        const desc = getCellValueAsString(row.getCell(6).value);
                        const nombreCt = getCellValueAsString(row.getCell(3).value);

                        if ((act || obj || desc) && act !== "#VALUE!") {
                            actData = {
                                nombreCt: nombreCt || null,
                                actividad: act,
                                objetivo: obj,
                                descripcion: desc,
                            };
                            break;
                        }
                    }
                }

                // 7.3. Extraer conteos de personal con búsqueda en 3 niveles (CCT, Nombre, fila 18)
                let topCounts: DatosEscuela["topCounts"] = undefined;
                const normCct = normalizeText(cct);
                const normNom = normalizeText(entrega.escuela.nombre);
                const nomTokens = normNom
                    .split(/[^A-Z0-9]+/)
                    .filter(t => t.length >= 3 && t !== "BACHILLERATO" && t !== "GENERAL" && t !== "OFICIAL");

                let personalTargetRow: number | null = null;

                // Nivel 1: CCT en filas 17-34
                for (let r = 17; r <= Math.min(schoolWs.rowCount, 34); r++) {
                    const row = schoolWs.getRow(r);
                    for (let c = 1; c <= 15; c++) {
                        const val = normalizeText(getCellValueAsString(row.getCell(c).value));
                        if (val.includes(normCct)) {
                            personalTargetRow = r;
                            break;
                        }
                    }
                    if (personalTargetRow) break;
                }

                // Nivel 2: Nombre de la escuela en filas 17-34
                if (!personalTargetRow) {
                    for (let r = 17; r <= Math.min(schoolWs.rowCount, 34); r++) {
                        const cell7Val = normalizeText(getCellValueAsString(schoolWs.getRow(r).getCell(7).value));
                        if (nomTokens.length > 0 && nomTokens.every(tok => cell7Val.includes(tok))) {
                            personalTargetRow = r;
                            break;
                        }
                    }
                }

                if (!personalTargetRow) {
                    for (let r = 17; r <= Math.min(schoolWs.rowCount, 34); r++) {
                        const cell7Val = normalizeText(getCellValueAsString(schoolWs.getRow(r).getCell(7).value));
                        const matchCount = nomTokens.filter(tok => cell7Val.includes(tok)).length;
                        if (matchCount >= 2 || (nomTokens.length === 1 && matchCount === 1)) {
                            personalTargetRow = r;
                            break;
                        }
                    }
                }

                // Nivel 3: Plantilla individual (fila 18)
                if (!personalTargetRow && schoolWs.rowCount >= 18) {
                    const r18 = schoolWs.getRow(18);
                    const docVal = r18.getCell(schoolCols.docentes || 10).value;
                    if (docVal !== null && docVal !== undefined && docVal !== "") {
                        personalTargetRow = 18;
                    }
                }

                if (personalTargetRow) {
                    const r = personalTargetRow;
                    const getNum = (colIdx?: number) => {
                        if (!colIdx) return null;
                        const raw = schoolWs.getRow(r).getCell(colIdx).value;
                        const str = getCellValueAsString(raw);
                        if (!str || str === "" || str === " ") return null;
                        const n = Number(str);
                        return isNaN(n) ? null : n;
                    };
                    const getRaw = (colIdx?: number) => {
                        if (!colIdx) return null;
                        const str = getCellValueAsString(schoolWs.getRow(r).getCell(colIdx).value);
                        return str || null;
                    };

                    topCounts = {
                        mantenimiento: getNum(schoolCols.mantenimiento || 8),
                        administrativos: getNum(schoolCols.administrativos || 9),
                        docentes: getNum(schoolCols.docentes || 10),
                        directores: getNum(schoolCols.directores || 11),
                        supervisores: getNum(schoolCols.supervisores || 12),
                        atp: getNum(schoolCols.atp || 13),
                        jefes: getRaw(schoolCols.jefes || 14),
                    };
                }

                // 7.4. Extraer fotografías usando API pública con fallback para imágenes "En Celda" (Excel 365)
                const schoolImages = schoolWs.getImages();
                const validImages: { buffer: Buffer; extension: string }[] = [];
                for (const img of schoolImages) {
                    if (img.range.tl.row < 10) continue; // Descartar logo institucional de cabecera
                    const media = extractImageMedia(schoolWb, img);
                    if (media && media.buffer) {
                        validImages.push(media);
                    }
                }

                // Fallback para imágenes incrustadas dentro de celda (model.media)
                if (validImages.length === 0) {
                    const rawMedia = (schoolWb.model as any)?.media || (schoolWb as any).media || [];
                    for (const m of rawMedia) {
                        let mBuf: Buffer | null = null;
                        if (Buffer.isBuffer(m.buffer)) mBuf = m.buffer;
                        else if (m.buffer instanceof Uint8Array || m.buffer instanceof ArrayBuffer) mBuf = Buffer.from(m.buffer);
                        else if (typeof m.base64 === "string") mBuf = Buffer.from(m.base64, "base64");

                        if (mBuf && mBuf.byteLength > 2000) {
                            const isSepLogo = (mBuf.byteLength >= 106000 && mBuf.byteLength <= 107000 && (m.extension === "png" || m.name?.includes("image")));
                            if (!isSepLogo) {
                                const extension = (m.extension === "jpg" ? "jpeg" : m.extension) || "jpeg";
                                validImages.push({ buffer: mBuf, extension });
                            }
                        }
                    }
                }

                // Combinación sin pérdida de datos válidos
                if (!datosEscuelas[cct]) {
                    datosEscuelas[cct] = {
                        cct,
                        nombreCt: entrega.escuela.nombre,
                        topCounts,
                        actData,
                        images: validImages,
                    };
                } else {
                    if (!datosEscuelas[cct].actData && actData) datosEscuelas[cct].actData = actData;
                    if (!datosEscuelas[cct].topCounts && topCounts) datosEscuelas[cct].topCounts = topCounts;
                    if (datosEscuelas[cct].images.length === 0 && validImages.length > 0) datosEscuelas[cct].images = validImages;
                }

                escuelasExitosas.push({ cct, nombre: entrega.escuela.nombre, fotos: validImages.length });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[unificar-xlsx] Error procesando Excel de ${cct}:`, msg);
                escuelasFallidas.push({ cct, nombre: entrega.escuela.nombre, motivo: `Error al procesar archivo: ${msg}` });
            }
        }

        // 8. Escribir conteos en tabla superior (filas 18-34) usando columnas dinámicas
        for (const [cct, info] of Object.entries(escuelasMaster)) {
            const sData = datosEscuelas[cct];
            if (sData && sData.topCounts) {
                const tc = sData.topCounts;
                const r = info.row;
                if (masterCols.mantenimiento && tc.mantenimiento !== null) masterWs.getRow(r).getCell(masterCols.mantenimiento).value = tc.mantenimiento;
                if (masterCols.administrativos && tc.administrativos !== null) masterWs.getRow(r).getCell(masterCols.administrativos).value = tc.administrativos;
                if (masterCols.docentes && tc.docentes !== null) masterWs.getRow(r).getCell(masterCols.docentes).value = tc.docentes;
                if (masterCols.directores && tc.directores !== null) masterWs.getRow(r).getCell(masterCols.directores).value = tc.directores;
                if (masterCols.supervisores && tc.supervisores !== null) masterWs.getRow(r).getCell(masterCols.supervisores).value = tc.supervisores;
                if (masterCols.atp && tc.atp !== null) masterWs.getRow(r).getCell(masterCols.atp).value = tc.atp;
                if (masterCols.jefes && tc.jefes !== null && tc.jefes !== undefined) masterWs.getRow(r).getCell(masterCols.jefes).value = tc.jefes;
            }
        }

        // 8.1. Garantizar fórmulas limpias y explícitas en fila 35 de Totales
        if (masterCols.mantenimiento) {
            const colLetter = masterWs.getColumn(masterCols.mantenimiento).letter;
            masterWs.getCell(`${colLetter}35`).value = { formula: `SUM(${colLetter}18:${colLetter}34)` };
        }
        if (masterCols.administrativos) {
            const colLetter = masterWs.getColumn(masterCols.administrativos).letter;
            masterWs.getCell(`${colLetter}35`).value = { formula: `SUM(${colLetter}18:${colLetter}34)` };
        }
        if (masterCols.docentes) {
            const colLetter = masterWs.getColumn(masterCols.docentes).letter;
            masterWs.getCell(`${colLetter}35`).value = { formula: `SUM(${colLetter}18:${colLetter}34)` };
        }
        if (masterCols.directores) {
            const colLetter = masterWs.getColumn(masterCols.directores).letter;
            masterWs.getCell(`${colLetter}35`).value = { formula: `SUM(${colLetter}18:${colLetter}34)` };
        }

        // 9. Construir tabla de actividades (fila 40+, una fila por escuela ordenada por CCT)
        const cctsSorted = Object.keys(escuelasMaster).sort();
        let currentRow = 40;

        for (const cct of cctsSorted) {
            const info = escuelasMaster[cct];
            const sData = datosEscuelas[cct] || { cct, images: [] };
            const act = sData.actData || { nombreCt: null, actividad: "", objetivo: "", descripcion: "" };
            const images = sData.images || [];

            masterWs.getCell(`A${currentRow}`).value = "GEN004";
            masterWs.getCell(`B${currentRow}`).value = cct;
            const nombreCt = act.nombreCt || sData.nombreCt || info.label.split("(")[0].trim();
            masterWs.getCell(`C${currentRow}`).value = nombreCt;
            masterWs.getCell(`D${currentRow}`).value = act.actividad || "";
            masterWs.getCell(`E${currentRow}`).value = act.objetivo || "";
            masterWs.getCell(`F${currentRow}`).value = act.descripcion || "";
            masterWs.getCell(`G${currentRow}`).value = ""; // Contenedor de fotos

            // Bordes, tipografía y alineación
            for (let c = 1; c <= 7; c++) {
                const cell = masterWs.getRow(currentRow).getCell(c);
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" }
                };
                cell.alignment = {
                    wrapText: true,
                    vertical: "middle",
                    horizontal: c <= 2 ? "center" : "left"
                };
                cell.font = { name: "Calibri", size: 9 };
            }

            // Distribuir fotografías horizontalmente sin solapamiento
            if (images.length > 0) {
                masterWs.getRow(currentRow).height = 195;
                const count = Math.min(images.length, 4);

                let imgW = 200;
                let imgH = 175;
                let startPx = 15;
                let gapPx = 10;

                if (count === 1) {
                    imgW = 220;
                    imgH = 175;
                    startPx = 25;
                } else if (count === 2) {
                    imgW = 160;
                    imgH = 175;
                    startPx = 15;
                    gapPx = 15;
                } else if (count === 3) {
                    imgW = 125;
                    imgH = 170;
                    startPx = 10;
                    gapPx = 10;
                } else if (count >= 4) {
                    imgW = 115;
                    imgH = 170;
                    startPx = 8;
                    gapPx = 8;
                }

                for (let i = 0; i < count; i++) {
                    const img = images[i];
                    const addedId = masterWb.addImage({
                        buffer: img.buffer as any,
                        extension: img.extension as "jpeg" | "png" | "gif",
                    });

                    const colOffPx = startPx + i * (imgW + gapPx);
                    const rowOffPx = 12;

                    masterWs.addImage(addedId, {
                        tl: {
                            nativeCol: 6, // Columna G
                            nativeColOff: Math.floor(colOffPx * EMU_PER_PIXEL),
                            nativeRow: currentRow - 1,
                            nativeRowOff: Math.floor(rowOffPx * EMU_PER_PIXEL),
                        } as any,
                        ext: { width: imgW, height: imgH },
                        editAs: "oneCell"
                    });
                }
            } else {
                masterWs.getRow(currentRow).height = 55;
            }

            currentRow++;
        }

        // 10. Generar buffer XLSX y validar límite de respuesta para serverless
        const buffer = await masterWb.xlsx.writeBuffer();
        if (buffer.byteLength > MAX_SERVERLESS_BYTES) {
            return NextResponse.json({
                error: `El archivo generado (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB) excede el umbral seguro de descarga.`
            }, { status: 413 });
        }

        const periodoNombre = getNombrePeriodo(targetPeriodo, programa.nombre);
        const fileName = `CONCENTRADO_ZONAL_DIA_NARANJA_${periodoNombre.toUpperCase().replace(/[/\\?%*:|"<>]/g, "_")}.xlsx`;

        // Reporte de procesamiento para el frontend en encabezado HTTP
        const resumenProceso = {
            total: Object.keys(escuelasMaster).length,
            procesadas: escuelasExitosas.length,
            exitosas: escuelasExitosas,
            fallidas: escuelasFallidas,
        };

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "Content-Length": String(buffer.byteLength),
                "X-Resumen-Proceso": encodeURIComponent(JSON.stringify(resumenProceso)),
                "Cache-Control": "no-store",
            },
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[unificar-xlsx] Error no controlado:", msg);
        return NextResponse.json({ error: `Error al unificar Excel: ${msg}` }, { status: 500 });
    }
}
