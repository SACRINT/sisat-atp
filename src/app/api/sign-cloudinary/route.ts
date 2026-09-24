import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildFolderPath } from "@/lib/cloudinary";
import { buildExpedienteFileName } from "@/lib/download-url";

/**
 * Sanitiza y limita el nombre del public_id para que el path completo
 * `${folder}/${publicId}` NUNCA supere el límite estricto de 255 caracteres de Cloudinary.
 */
function sanitizePublicId(name: string, maxLength: number): string {
    return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remover acentos
        .replace(/\s+/g, "_")             // espacios a guiones bajos
        .replace(/[^a-zA-Z0-9._\-]/g, "") // caracteres seguros para Cloudinary
        .replace(/_+/g, "_")              // colapsar guiones repetidos
        .slice(0, maxLength)              // truncar al espacio seguro
        .replace(/^_+|_+$/g, "");         // recortar guiones en los extremos
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const {
            entregaId, originalFilename, etiqueta, subfolder,
            programa, cct, escuelaNombre,
            // Expedientes-specific fields for descriptive naming
            apellidoPaterno, apellidoMaterno, nombre: personalNombre, tipoDocumento,
        } = await req.json();

        let folder: string;
        let escuelaCct: string = "";
        let escuelaNombreResolved: string = "";
        let programaNombre: string = "";
        let publicId: string | undefined = undefined;

        // ─── SESION_CAPEMS mode: repositorio zonal fijo, no entregaId ni escuela ───
        if (programa === "SESION_CAPEMS") {
            folder = "SISAT-ATP/CAPEMS/zona004";
            if (originalFilename) {
                const docName = originalFilename
                    .replace(/\.(pdf|pptx)$/i, "")
                    .replace(/\s+/g, "_")
                    .replace(/[^a-zA-Z0-9._\-]/g, "")
                    .slice(0, 80);
                publicId = `${Date.now()}_${docName}`;
            }
        } else if (programa === "CAPEMS" && cct && escuelaNombre) {
            escuelaCct = cct;
            escuelaNombreResolved = escuelaNombre;
            programaNombre = "CAPEMS";
            let folderPath = buildFolderPath(cct, escuelaNombre, "CAPEMS");
            if (subfolder) {
                folderPath += `/${subfolder.replace(/^\/+/, '')}`;
            }
            folder = `SISAT-ATP/${folderPath}`;
        } else if (programa === "Expedientes" && cct && escuelaNombre) {
            // ─── Expedientes de Personal mode: no entregaId needed ───
            escuelaCct = cct;
            escuelaNombreResolved = escuelaNombre;
            programaNombre = "Expedientes";
            let folderPath = buildFolderPath(cct, escuelaNombre, "Expedientes");
            if (subfolder) {
                folderPath += `/${subfolder.replace(/^\/+/, '')}`;
            }
            folder = `SISAT-ATP/${folderPath}`;
        } else {
            // ─── Standard mode: requires entregaId ───
            if (!entregaId) {
                return NextResponse.json({ error: "EntregaId es requerido" }, { status: 400 });
            }

            const entrega = await prisma.entrega.findUnique({
                where: { id: entregaId },
                include: {
                    escuela: true,
                    periodoEntrega: { include: { programa: true, cicloEscolar: true } },
                },
            });

            if (!entrega) {
                return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
            }

            escuelaCct = entrega.escuela.cct;
            escuelaNombreResolved = entrega.escuela.nombre;
            programaNombre = entrega.periodoEntrega.programa.nombre;

            let folderPath = buildFolderPath(entrega.escuela.cct, entrega.escuela.nombre, entrega.periodoEntrega.programa.nombre);
            if (subfolder) {
                folderPath += `/${subfolder.replace(/^\/+/, '')}`;
            }
            folder = `SISAT-ATP/${folderPath}`;
        }

        if (originalFilename && programa !== "SESION_CAPEMS") {
            const isAcosoEscolar = programaNombre.toUpperCase().includes("ACOSO ESCOLAR");
            const isExpedientes = programaNombre === "Expedientes";

            // Cloudinary limita el public_id completo (folder + '/' + public_id) a 255 caracteres.
            // Dejamos un margen seguro de 15 caracteres (max 240 caracteres totales).
            const maxPublicIdLength = Math.max(30, 240 - folder.length);

            let finalName: string;

            if (isExpedientes && apellidoPaterno) {
                // Nomenclatura para Expedientes: CCT_ApellidosNombre_TipoDocumento
                finalName = buildExpedienteFileName(
                    escuelaCct,
                    apellidoPaterno || "",
                    apellidoMaterno || "",
                    personalNombre || "",
                    tipoDocumento || "DOCUMENTO",
                    etiqueta,
                    originalFilename
                ).replace(/\.[^.]+$/, ""); // strip extension for public_id
            } else if (isAcosoEscolar && entregaId) {
                // Nomenclatura especial para Acoso Escolar (solo en modo standard)
                const entrega = await prisma.entrega.findUnique({
                    where: { id: entregaId },
                    include: { periodoEntrega: { include: { cicloEscolar: true } } },
                });
                const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                const periodo = entrega?.periodoEntrega;
                const cicloNombre = periodo?.cicloEscolar?.nombre || "2025-2026";
                const anio = cicloNombre.split("-").pop() || new Date().getFullYear().toString();
                const mes = periodo?.mes ? MESES[periodo.mes] : (periodo?.semestre ? `Semestre${periodo.semestre}` : "CicloCompleto");

                finalName = `${escuelaCct}_ACOSO_ESCOLAR_${anio}_${mes}${subfolder === "_correcciones" ? "_Correccion" : ""}`;
            } else {
                // Formato default: CCT_Etiqueta o CCT_NombreArchivo
                // No repetimos escuelaNombre ni programaNombre porque ya están en el folder padre
                const docName = etiqueta ? etiqueta : originalFilename.split('.').slice(0, -1).join('.');
                const prefix = `${escuelaCct}${subfolder === "_correcciones" ? "_Correccion" : ""}`;
                finalName = `${prefix}_${docName}`;
            }

            publicId = sanitizePublicId(finalName, maxPublicIdLength);
            if (!publicId) {
                publicId = `${Date.now()}`;
            }
        }

        // Configure cloudinary using env vars
        cloudinary.config({
            cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
            secure: true,
        });

        const timestamp = Math.round(new Date().getTime() / 1000);

        // Parameters to sign
        const paramsToSign: Record<string, any> = {
            timestamp,
            folder
        };

        if (publicId) {
            paramsToSign.public_id = publicId;
        }

        const signature = cloudinary.utils.api_sign_request(
            paramsToSign,
            process.env.CLOUDINARY_API_SECRET!
        );

        return NextResponse.json({
            signature,
            timestamp,
            folder,
            publicId,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY
        });
    } catch (error) {
        console.error("Signature error:", error);
        return NextResponse.json({ error: "Error al generar firma" }, { status: 500 });
    }
}
