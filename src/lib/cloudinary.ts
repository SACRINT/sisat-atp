import { v2 as cloudinary } from "cloudinary";

// ─── Cloudinary client ──────────────────────────────────────────────────────

function getCloudinaryConfig() {
    cloudinary.config({
        cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
    return cloudinary;
}

// ─── Upload ─────────────────────────────────────────────────────────────────

export interface CloudinaryUploadResult {
    publicId: string;   // stored as driveId in Archivo
    url: string;        // stored as driveUrl in Archivo
}

/**
 * Uploads a buffer to Cloudinary.
 * Files are organized in folders: folder/CCT_Programa/
 * Returns { publicId, url }
 */
export async function uploadFileToCloudinary(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folderPath: string,
    /** Optional: descriptive name for the public_id in Cloudinary (e.g. "21EBH0682T_CAPEM_1_FichaTrabajo").
     *  If omitted, falls back to timestamp-based name. */
    descriptiveName?: string
): Promise<CloudinaryUploadResult> {
    const client = getCloudinaryConfig();

    // Cloudinary folder path: SISAT-ATP/CCT - Escuela/Programa
    const folder = `SISAT-ATP/${folderPath}`;

    // Determine resource type
    const resourceType = mimeType.startsWith("image/") ? "image" : "raw";

    // Build public_id: prefer descriptive name, fall back to timestamp
    const publicId = descriptiveName
        ? sanitizeFileName(descriptiveName)
        : `${Date.now()}_${sanitizeFileName(fileName)}`;

    return new Promise((resolve, reject) => {
        const uploadStream = client.uploader.upload_stream(
            {
                folder,
                public_id: publicId,
                resource_type: resourceType,
                // Preserve original filename in display
                use_filename: false,
                overwrite: false,
            },
            (error, result) => {
                if (error || !result) {
                    reject(error || new Error("Cloudinary upload returned no result"));
                    return;
                }
                resolve({
                    publicId: result.public_id,
                    url: result.secure_url,
                });
            }
        );

        uploadStream.end(buffer);
    });
}


// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Deletes a file from Cloudinary by its public_id.
 * Tries both resource_type: raw and image to cover all file types.
 */
export async function deleteFileFromCloudinary(publicId: string): Promise<void> {
    const client = getCloudinaryConfig();

    // Try raw first (PDFs, docs, etc.), then image
    try {
        await client.uploader.destroy(publicId, { resource_type: "raw" });
    } catch {
        try {
            await client.uploader.destroy(publicId, { resource_type: "image" });
        } catch {
            // File might not exist — ignore silently
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Descarga un archivo desde Cloudinary como Buffer usando enlaces firmados HMAC.
 * Intenta en orden:
 *   a) private_download_url con resource_type: "raw"
 *   b) private_download_url con resource_type: "image"
 *   c) fetch directo a la URL del archivo
 */
export async function downloadCloudinaryBuffer(opts: {
    archivoUrl: string;
    archivoPublicId: string;
    nombreArchivo: string;
}): Promise<Buffer> {
    const { archivoUrl, archivoPublicId, nombreArchivo } = opts;
    getCloudinaryConfig();

    let lastStatus: number | string = "desconocido";

    // a) Intento con resource_type: "raw"
    try {
        const signedRawUrl = cloudinary.utils.private_download_url(archivoPublicId, "", {
            resource_type: "raw",
            type: "upload",
        });
        console.log(`[cloudinary] Descargando buffer (raw): publicId=${archivoPublicId} (${nombreArchivo})`);
        const resRaw = await fetch(signedRawUrl, {
            signal: AbortSignal.timeout(15000),
        });
        console.log(`[cloudinary] Intento raw status: ${resRaw.status}`);
        if (resRaw.ok) {
            return Buffer.from(await resRaw.arrayBuffer());
        }
        lastStatus = resRaw.status;
    } catch (err: any) {
        console.warn(`[cloudinary] Error en intento raw:`, err.message || err);
    }

    // b) Intento con resource_type: "image"
    try {
        const signedImageUrl = cloudinary.utils.private_download_url(archivoPublicId, "", {
            resource_type: "image",
            type: "upload",
        });
        console.log(`[cloudinary] Descargando buffer (image): publicId=${archivoPublicId} (${nombreArchivo})`);
        const resImage = await fetch(signedImageUrl, {
            signal: AbortSignal.timeout(15000),
        });
        console.log(`[cloudinary] Intento image status: ${resImage.status}`);
        if (resImage.ok) {
            return Buffer.from(await resImage.arrayBuffer());
        }
        lastStatus = resImage.status;
    } catch (err: any) {
        console.warn(`[cloudinary] Error en intento image:`, err.message || err);
    }

    // c) fetch directo de archivoUrl con header User-Agent
    try {
        console.log(`[cloudinary] Descargando buffer directo de archivoUrl: ${archivoUrl}`);
        const resDirect = await fetch(archivoUrl, {
            headers: { "User-Agent": "SISAT-ATP/1.0" },
            signal: AbortSignal.timeout(15000),
        });
        console.log(`[cloudinary] Intento directo status: ${resDirect.status}`);
        if (resDirect.ok) {
            return Buffer.from(await resDirect.arrayBuffer());
        }
        lastStatus = resDirect.status;
    } catch (err: any) {
        console.warn(`[cloudinary] Error en intento directo:`, err.message || err);
    }

    throw new Error(`No se pudo descargar desde Cloudinary (último intento HTTP ${lastStatus}). publicId=${archivoPublicId}`);
}

/**
 * Removemos caracteres no permitidos en el public_id de Cloudinary.
 */
function sanitizeFileName(name: string): string {
    return name
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._\-]/g, "")
        .slice(0, 80); // max length
}

/**
 * Genera un slug corto y estandarizado para carpetas y nombres de programas.
 * Evita rutas excesivamente largas que superen el límite de 255 caracteres de Cloudinary.
 */
export function getProgramaSlug(programaNombre: string): string {
    const norm = programaNombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();

    if (norm.includes("PMC")) return "PMC";
    if (norm.includes("PAEC")) return "PAEC";
    if (norm.includes("ACOSO")) return "ACOSO";
    if (norm.includes("NARANJA")) return "DNARANJA";
    if (norm.includes("CULTURA DE PAZ") || norm.includes("SEGURIDAD Y CULTURA")) return "SEG_PAZ";
    if (norm.includes("PROTECCION CIVIL") || norm.includes("PIPC")) return "PIPC";
    if (norm.includes("SINIESTROS") || norm.includes("SEGUROS")) return "SEGUROS";
    if (norm.includes("INSCRITOS") || norm.includes("REINSCRITOS")) return "INSCRITOS";
    if (norm.includes("CARTAS COMPROMISO")) return "CARTAS_COMP";
    if (norm.includes("PADRES DE FAMILIA")) return "INF_PADRES";
    if (norm.includes("SIMULACRO")) return "SIMULACRO";
    if (norm.includes("INDICADORES Y METAS") || norm.includes("METAS")) return "METAS";
    if (norm.includes("PIPS")) return "PIPS";
    if (norm.includes("JUEGOS TRADICIONALES")) return "JUEGOS_TRAD";
    if (norm.includes("ABC")) {
        const actMatch = norm.match(/ACTIVIDAD\s*(\d+)/);
        return actMatch ? `ACT${actMatch[1]}_ABC` : "ABC_EMOCIONES";
    }
    if (norm.includes("SANAMENTE")) return "SANAMENTE";
    if (norm.includes("LECTURA")) return "LECTURA";
    if (norm.includes("EXPEDIENTES")) return "EXPEDIENTES";
    if (norm.includes("CAPEMS")) return "CAPEMS";

    const parenMatch = norm.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1].length <= 8) {
        return parenMatch[1].replace(/[^A-Z0-9]/g, "");
    }

    const stopWords = new Set(["DE", "DEL", "LA", "LAS", "EL", "LOS", "Y", "A", "EN", "POR", "PARA"]);
    const words = norm
        .replace(/[^A-Z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 1 && !stopWords.has(w));

    return words.slice(0, 3).join("_").slice(0, 20) || "PROG";
}

/**
 * Función para generar la estructura de carpetas compacta: "CCT/ProgramaSlug"
 * Garantiza que la ruta total de carpeta no exceda los 35 caracteres.
 */
export function buildFolderPath(cct: string, _escuelaNombre: string, programaNombre: string): string {
    const escuelaFolder = sanitizeFileName(cct);
    const programaFolder = getProgramaSlug(programaNombre);
    return `${escuelaFolder}/${programaFolder}`;
}



