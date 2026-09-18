/**
 * GET  /api/director/planeaciones          → Lista planeaciones de la escuela + estado de requisitos
 * POST /api/director/planeaciones          → Sube una nueva planeación y lanza revisión IA
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";
import { evaluarPlaneacion, determinarTipoEvaluacion } from "@/lib/planeaciones-evaluator";
import { extractTextFromDocx, extractTextFromPdf, downloadFile } from "@/lib/pre-revision";

export const maxDuration = 60;

import { verificarRequisitosPlaneaciones } from "@/lib/ia-requisitos";

/**
 * Alias para compatibilidad interna con el resto del archivo.
 * Usa la función centralizada que corrige el bug de tieneApiKey = true siempre.
 */
async function verificarRequisitos(escuelaId: string) {
  return verificarRequisitosPlaneaciones(escuelaId);
}

async function obtenerEscuelaId(user: any): Promise<string | null> {
    if (!user) return null;
    if (user.escuelaId) return user.escuelaId;
    if (user.id && (user.role === "director" || !user.role)) return user.id;
    if (user.cct) {
        const esc = await prisma.escuela.findUnique({ where: { cct: user.cct }, select: { id: true } });
        if (esc) return esc.id;
    }
    return user.id || null;
}

// ── GET — Lista planeaciones + estado de requisitos ──────────────────────────

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const searchParams = req.nextUrl.searchParams;
    const escuelaIdQuery = searchParams.get("escuelaId");

    let escuelaId: string | null;
    if (user.role === "admin" || user.role === "supervision") {
        escuelaId = escuelaIdQuery || await obtenerEscuelaId(user);
    } else {
        escuelaId = await obtenerEscuelaId(user);
        if (escuelaIdQuery && escuelaIdQuery !== escuelaId) {
            return NextResponse.json({ error: "Acceso denegado a otra escuela" }, { status: 403 });
        }
    }

    if (!escuelaId) return NextResponse.json({ error: "No autorizado (escuela no encontrada)" }, { status: 401 });

    const [requisitos, planeaciones, escuela, personal, cargas, grupos] = await Promise.all([
        verificarRequisitos(escuelaId),
        prisma.planeacionDidactica.findMany({
            where: { escuelaId },
            orderBy: { fechaSubida: "desc" },
        }),
        prisma.escuela.findUnique({
            where: { id: escuelaId },
            select: { id: true, cct: true, nombre: true, gruposPrimerAno: true, gruposSegundoAno: true, gruposTercerAno: true, mapaCurricularCompletado: true }
        }),
        prisma.personal.findMany({
            where: { escuelaId },
            orderBy: [{ apellidoPaterno: "asc" }, { nombre: "asc" }],
            select: { id: true, nombre: true, apellidoPaterno: true, apellidoMaterno: true, rfc: true, cargo: true }
        }),
        prisma.horarioCargaDocente.findMany({
            where: { escuelaId },
            include: {
                personal: true,
                grupo: true,
                asignatura: true,
            }
        }),
        prisma.horarioGrupo.findMany({
            where: { escuelaId },
            orderBy: { nombre: "asc" }
        })
    ]);

    return NextResponse.json({
        requisitos: {
            puedeUsar: requisitos.puedeUsar,
            tieneApiKey: requisitos.tieneApiKey,
            tienePaecPec: requisitos.tienePaecPec,
            requierePaecPec: requisitos.requierePaecPec,
            requiereApiKey: requisitos.requiereApiKey,
            motivoBloqueo: requisitos.motivoBloqueo,
        },
        escuela,
        personal,
        cargas,
        grupos,
        planeaciones,
        estadisticas: {
            total: planeaciones.length,
            revisadas: planeaciones.filter((p: any) => p.estado === "REVISADO").length,
            pendientes: planeaciones.filter((p: any) => p.estado === "PENDIENTE").length,
            conError: planeaciones.filter((p: any) => p.estado === "ERROR").length,
            promedioZona: planeaciones.reduce((acc: number, p: any) => acc + (p.puntajeObtenido ?? 0), 0) /
                (planeaciones.filter((p: any) => p.puntajeObtenido !== null).length || 1),
        },
    });
}

// ── POST — Sube planeación y lanza revisión IA ────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const escuelaId = await obtenerEscuelaId(user);
    const cct = user.cct as string;
    if (!escuelaId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Verificar requisitos previos
    const requisitos = await verificarRequisitos(escuelaId);
    if (!requisitos.puedeUsar) {
        return NextResponse.json({ error: requisitos.motivoBloqueo }, { status: 403 });
    }

    const formData = await req.formData();
    const archivo = formData.get("archivo") as File | null;
    const docenteNombre = formData.get("docenteNombre") as string;
    const docenteRFC = formData.get("docenteRFC") as string | undefined;
    const grupoNombre = formData.get("grupoNombre") as string | undefined;
    const tipoSemestrePeriodo = (formData.get("tipoSemestrePeriodo") as string) || "SEMESTRE_A";
    const asignatura = formData.get("asignatura") as string;
    const semestreStr = formData.get("semestre") as string;
    const bloqueCorte = formData.get("bloqueCorte") as string | undefined;
    const tipoAsignatura = (formData.get("tipoAsignatura") as string) || "FUNDAMENTAL";

    if (!archivo || !docenteNombre || !asignatura || !semestreStr) {
        return NextResponse.json({ error: "Faltan campos obligatorios: archivo, docenteNombre, asignatura, semestre" }, { status: 400 });
    }

    const semestre = parseInt(semestreStr, 10);
    if (isNaN(semestre) || semestre < 1 || semestre > 6) {
        return NextResponse.json({ error: "El semestre debe ser un número del 1 al 6" }, { status: 400 });
    }

    // Subir archivo a Cloudinary
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const archivoTipo = archivo.name.toLowerCase().endsWith(".docx") ? "DOCX" : "PDF";
    const mimeType = archivoTipo === "DOCX" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf";

    let archivoUrl: string;
    let archivoNombre: string;
    try {
        const uploadResult = await uploadFileToCloudinary(
            buffer,
            archivo.name,
            mimeType,
            `planeaciones/${cct}/${new Date().getFullYear()}`,
            `${cct}_${asignatura.replace(/\s+/g, "_")}_sem${semestre}_${Date.now()}`
        );
        archivoUrl = uploadResult.url;
        archivoNombre = archivo.name;
    } catch (err: any) {
        return NextResponse.json({ error: "Error al subir el archivo: " + err.message }, { status: 500 });
    }

    // Crear registro inicial en BD
    const planeacion = await prisma.planeacionDidactica.create({
        data: {
            escuelaId,
            cct,
            docenteNombre,
            docenteRFC: docenteRFC || null,
            grupoNombre: grupoNombre || null,
            tipoSemestrePeriodo,
            asignatura,
            semestre,
            bloqueCorte: bloqueCorte || null,
            tipoAsignatura,
            archivoUrl,
            archivoNombre,
            archivoTipo,
            estado: "EN_REVISION",
        },
    });

    // Ejecutar la revisión IA de forma síncrona dentro del límite de 60s de Vercel
    await revisarPlaneacionEnBackground(planeacion.id, {
        archivoUrl,
        archivoTipo,
        docenteNombre,
        asignatura,
        semestre,
        tipoAsignatura,
        bloqueCorte,
        escuelaId,
        cct,
        entregaPaecPec: requisitos.entregaPaecPec,
    }).catch(err => console.error("[planeaciones] Error en revisión background:", err));

    return NextResponse.json({ ok: true, planeacionId: planeacion.id, estado: "REVISADO" });
}

// ── Revisión asíncrona en background ─────────────────────────────────────────

export async function revisarPlaneacionEnBackground(
    planeacionId: string,
    params: {
        archivoUrl: string;
        archivoTipo: string;
        docenteNombre: string;
        asignatura: string;
        semestre: number;
        tipoAsignatura: string;
        bloqueCorte?: string;
        escuelaId: string;
        cct: string;
        entregaPaecPec: any;
    }
) {
    try {
        // Descargar el archivo de planeación (PDF o DOCX) para pasarlo a la IA
        let pdfBuffer: Buffer | undefined;
        let textoPlanificacion = "";
        try {
            pdfBuffer = await downloadFile(params.archivoUrl);
        } catch {
            try {
                const dlRes = await fetch(params.archivoUrl);
                if (dlRes.ok) {
                    const arrBuf = await dlRes.arrayBuffer();
                    pdfBuffer = Buffer.from(arrBuf);
                }
            } catch (dlErr) {
                console.warn("[planeaciones] Error al descargar archivo para IA:", dlErr);
            }
        }

        // Extracción de texto digital previa según formato del archivo (ERROR 1 RESUELTO)
        if (pdfBuffer) {
            const isDocx = params.archivoTipo === "DOCX" || params.archivoUrl.toLowerCase().endsWith(".docx");
            if (isDocx) {
                try {
                    textoPlanificacion = await extractTextFromDocx(pdfBuffer);
                    console.log(`[planeaciones] Texto extraído exitosamente de DOCX (${textoPlanificacion.length} caracteres).`);
                } catch (docxErr) {
                    console.warn("[planeaciones] No se pudo extraer texto del DOCX:", docxErr);
                }
            } else {
                try {
                    const pdfRes = await extractTextFromPdf(pdfBuffer);
                    textoPlanificacion = pdfRes.text;
                    console.log(`[planeaciones] Texto extraído exitosamente de PDF (${textoPlanificacion.length} caracteres).`);
                } catch (pdfErr) {
                    console.warn("[planeaciones] No se pudo extraer texto del PDF:", pdfErr);
                }
            }
        }

        // Extraer texto del PAEC-PEC (si existe)
        let textoPaecPec = "No disponible — la escuela no ha subido su PAEC-PEC.";
        if (params.entregaPaecPec) {
            try {
                const archivos = await prisma.archivo.findMany({
                    where: { entregaId: params.entregaPaecPec.id },
                    select: { driveUrl: true },
                    take: 1,
                });
                if (archivos[0]?.driveUrl) {
                    try {
                        const paecBuffer = await downloadFile(archivos[0].driveUrl);
                        if (paecBuffer) {
                            const isDocx = archivos[0].driveUrl.toLowerCase().endsWith(".docx");
                            if (isDocx) {
                                textoPaecPec = await extractTextFromDocx(paecBuffer);
                            } else {
                                const pdfRes = await extractTextFromPdf(paecBuffer);
                                textoPaecPec = pdfRes.text;
                            }
                            console.log(`[planeaciones] Texto PAEC extraído exitosamente (${textoPaecPec.length} caracteres).`);
                        }
                    } catch (paecErr) {
                        console.warn("[planeaciones] No se pudo extraer texto del PAEC:", paecErr);
                        textoPaecPec = `[Archivo PAEC-PEC disponible en: ${archivos[0].driveUrl}]`;
                    }
                }
            } catch { /* usa el fallback */ }
        }

        // Determinar tipo de evaluación
        const tipoEvaluacion = determinarTipoEvaluacion(params.semestre, params.tipoAsignatura);

        // Llamar al evaluador con texto extraído y escuelaId propagado (ERROR 2 RESUELTO)
        const resultado = await evaluarPlaneacion({
            tipoEvaluacion,
            asignatura: params.asignatura,
            semestre: params.semestre,
            docenteNombre: params.docenteNombre,
            cct: params.cct,
            bloqueCorte: params.bloqueCorte,
            textoPlanificacion,
            textoPaecPec,
            pdfBuffer,
            escuelaId: params.escuelaId,
        });

        // Guardar resultados en BD
        await prisma.planeacionDidactica.update({
            where: { id: planeacionId },
            data: {
                estado: "REVISADO",
                puntajeObtenido: resultado.puntajeTotal,
                puntajeMaximo: resultado.puntajeMaximo,
                nivelCumplimiento: resultado.nivelCumplimiento,
                resultadoJson: {
                    rubricaUsada: resultado.rubricaUsada,
                    criterios: resultado.criterios,
                } as any,
                observacionesJson: {
                    puntosFuertes: resultado.puntosFuertes,
                    mejorasUrgentes: resultado.mejorasUrgentes,
                    observacionesExtendidas: resultado.observacionesExtendidas,
                    alineacionPaecPec: resultado.alineacionPaecPec,
                } as any,
                retroalimentacionDocente: resultado.retroalimentacionDocente,
                fechaRevision: new Date(),
                revisadoPor: "IA_GEMINI_3_5",
            },
        });
    } catch (err: any) {
        console.error("[planeaciones] Error en revisión IA:", err);
        await prisma.planeacionDidactica.update({
            where: { id: planeacionId },
            data: {
                estado: "ERROR",
                observacionesJson: { error: err.message } as any,
            },
        });
    }
}
