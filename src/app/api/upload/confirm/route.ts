import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendUploadConfirmation } from "@/lib/email";
import { analizarEntregaConIA } from "@/lib/pre-revision";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 60; // Allow up to 60 seconds for Vercel Hobby limits during upload and analysis

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { entregaId, etiqueta, fileData } = body;

        if (!entregaId || !fileData || !fileData.url || !fileData.publicId) {
            return NextResponse.json({ error: "Faltan datos de confirmación" }, { status: 400 });
        }

        // Get the entrega and verify ownership
        const entrega = await prisma.entrega.findUnique({
            where: { id: entregaId },
            include: {
                escuela: true,
                periodoEntrega: { include: { programa: true } },
            },
        });

        if (!entrega) {
            return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
        }

        // Directors can only upload to their own school
        const user = session.user as { role?: string; cct?: string } | undefined;
        const userRole = user?.role;
        if (userRole === "director") {
            const userCct = user?.cct;
            if (entrega.escuela.cct !== userCct) {
                return NextResponse.json({ error: "No autorizado" }, { status: 403 });
            }
            if (entrega.estado === "APROBADO") {
                return NextResponse.json(
                    { error: "Esta entrega ya fue aprobada. No se puede modificar." },
                    { status: 403 }
                );
            }
        }

        const programa = entrega.periodoEntrega.programa;
        const escuela = entrega.escuela;
        const periodo = entrega.periodoEntrega;

        let nombreFinal = fileData.name;
        const pNom = programa.nombre.toUpperCase();
        if (pNom.includes("CULTURA DE PAZ") || pNom.includes("SEGURIDAD")) {
            const ext = fileData.name.includes(".") ? fileData.name.slice(fileData.name.lastIndexOf(".")) : "";
            const zona = (escuela.zonaEscolar || "Zona004").replace(/\s+/g, "");
            const { ACTIVIDADES_CULTURA_PAZ } = await import("@/lib/constants");
            const actividad = periodo.mes && ACTIVIDADES_CULTURA_PAZ[periodo.mes]
                ? ACTIVIDADES_CULTURA_PAZ[periodo.mes]
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-zA-Z0-9]/g, "_")
                    .toLowerCase()
                : "culturadepaz";
            const fechaObj = periodo.fechaLimite ? new Date(periodo.fechaLimite) : new Date();
            const d = String(fechaObj.getDate()).padStart(2, "0");
            const m = String(fechaObj.getMonth() + 1).padStart(2, "0");
            const y = String(fechaObj.getFullYear());
            nombreFinal = `${zona}_${actividad}_${d}${m}${y}${ext}`;
        }

        // Save Archivo record
        const archivo = await prisma.archivo.create({
            data: {
                entregaId,
                nombre: nombreFinal,
                driveId: fileData.publicId, // using Cloudinary public_id
                driveUrl: fileData.url,     // using Cloudinary secure_url
                tipo: "ENTREGA",
                subidoPor: "director",
                etiqueta: etiqueta || null,
            },
        });

        // Update entrega status
        await prisma.entrega.update({
            where: { id: entregaId },
            data: {
                estado: "PENDIENTE",
                fechaSubida: new Date(),
            },
        });

        // Build period label for email notification
        let periodoLabel = "Ciclo 2026-2027";
        if (periodo.mes) {
            const meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            periodoLabel = meses[periodo.mes];
        } else if (periodo.semestre) {
            periodoLabel = `Semestre ${periodo.semestre}`;
        }

        // Enviar acuse de recibo por email en segundo plano (usando waitUntil para evitar freeze en Vercel)
        waitUntil(
            sendUploadConfirmation(
                escuela.email,
                escuela.nombre,
                programa.nombre,
                periodoLabel
            ).catch(err => console.error("Error al enviar confirmación de correo:", err))
        );

        // Ejecutar pre-revisión respetando la configuración y límites de IA si es director
        if (userRole === "director") {
            const aiConfig = await prisma.preRevisionConfig.findUnique({ where: { id: "singleton" } });
            const isAiActive = aiConfig?.activoDirectores ?? false;
            const limit = aiConfig?.limiteIntentos ?? 3;

            if (isAiActive) {
                const preRev = await prisma.preRevision.findUnique({ where: { entregaId } });
                const currentAttempts = preRev?.intentosUsados ?? 0;

                if (currentAttempts < limit) {
                    // Incrementar el contador de intentos
                    await prisma.preRevision.upsert({
                        where: { entregaId },
                        update: { intentosUsados: { increment: 1 } },
                        create: { entregaId, resultado: {}, intentosUsados: 1 }
                    });

                    console.log(`[confirm] AI triggered for director (${currentAttempts + 1}/${limit})`);
                    // Disparar en segundo plano usando waitUntil para asegurar ejecucion en Vercel
                    waitUntil(
                        analizarEntregaConIA(entregaId).catch(err => {
                            console.error("Error al ejecutar pre-revisión en segundo plano:", err);
                        })
                    );
                } else {
                    console.log(`[confirm] AI skipped: director exceeded quota (${currentAttempts}/${limit})`);
                }
            } else {
                console.log(`[confirm] AI skipped: disabled for directors`);
            }
        } else {
            // Carga por ATP/Admin: siempre evalúa de manera ilimitada
            console.log(`[confirm] AI triggered for ATP (unlimited)`);
            // Disparar en segundo plano usando waitUntil para asegurar ejecucion en Vercel
            waitUntil(
                analizarEntregaConIA(entregaId).catch(err => {
                    console.error("Error al ejecutar pre-revisión en segundo plano:", err);
                })
            );
        }

        return NextResponse.json({
            success: true,
            message: `Archivo confirmado correctamente`,
            archivo,
        });
    } catch (error: unknown) {
        console.error("Confirmation error:", error);

        const errObj = error as Record<string, unknown>;
        const message = errObj?.message || "Error al procesar el archivo";

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
