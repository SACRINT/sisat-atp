import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarError } from "@/lib/error-log";
import { obtenerCicloActual } from "@/lib/ciclo";
import { procesarFormato911Excel, validarAritmetica911, calcularSha256, DatosFormato911 } from "@/lib/estadistica-911-engine";
import { extraerDatos911 } from "@/lib/estadistica-911-pdf-extractor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const user = session.user as { role?: string; organizacionId?: string; tenantId?: string; id?: string; escuelaId?: string } | undefined;
        if (!user || !["admin", "supervision", "director"].includes(user.role || "")) {
            return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
        }

        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
        }

        const ciclo = await obtenerCicloActual();
        if (!ciclo) {
            return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 400 });
        }

        // 1. Obtener configuración activa
        let config = await prisma.estadisticaPeriodoConfig.findUnique({
            where: { tenantId }
        });
        if (!config) {
            config = await prisma.estadisticaPeriodoConfig.create({
                data: { tenantId, cicloEscolarId: ciclo.id, tipoCorte: "INICIO_DE_CURSOS" }
            });
        }

        const contentType = req.headers.get("content-type") || "";

        let escuelaId = "";
        let archivoNombre = "";
        let tamanoBytes = 0;
        let resultado;

        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            const file = formData.get("file") as File | null;
            const escIdForm = formData.get("escuelaId") as string | null;

            if (user.role === "director") {
                const userEscuelaId = user.escuelaId || user.id;
                if (escIdForm && escIdForm !== userEscuelaId) {
                    return NextResponse.json({ error: "Acceso denegado a otra escuela" }, { status: 403 });
                }
                escuelaId = userEscuelaId || "";
            } else {
                escuelaId = escIdForm || "";
            }

            if (!escuelaId) {
                return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });
            }

            if (!file) {
                return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
            }

            archivoNombre = file.name;
            tamanoBytes = file.size;
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Validar extensión
            const ext = file.name.split(".").pop()?.toLowerCase() || "";
            const extensionesPermitidas = ["xlsx", "xls", "pdf", "jpg", "jpeg", "png", "webp"];
            if (!extensionesPermitidas.includes(ext)) {
                return NextResponse.json({
                    error: "Formato no permitido. Solo se aceptan archivos Excel (.xlsx, .xls), PDF (.pdf) o imágenes (.jpg, .jpeg, .png, .webp)."
                }, { status: 400 });
            }

            if (ext === "xlsx" || ext === "xls") {
                resultado = procesarFormato911Excel(buffer);
            } else {
                // PDF o imagen: calcular hash y extraer datos
                const sha = calcularSha256(buffer);
                const mimeType = file.type || (
                    ext === "pdf" ? "application/pdf" :
                    ext === "png" ? "image/png" :
                    ext === "webp" ? "image/webp" :
                    "image/jpeg"
                );

                const datosExtraidos = await extraerDatos911(buffer, mimeType);
                if (datosExtraidos) {
                    resultado = validarAritmetica911(datosExtraidos, sha);
                    resultado.inconsistencias.push({
                        tipo: "INFO",
                        severidad: "INFO",
                        campo: "Extracción Automática",
                        descripcion: "Datos extraídos automáticamente desde PDF/imagen — verifique los totales contra el documento original."
                    });
                } else {
                    resultado = {
                        totalHombres: 0,
                        totalMujeres: 0,
                        totalAlumnos: 0,
                        totalGrupos: 0,
                        totalDocentes: 0,
                        totalAprobados: 0,
                        totalReprobados: 0,
                        totalEgresados: 0,
                        totalDesercion: 0,
                        inconsistencias: [{
                            tipo: "INFO",
                            severidad: "INFO",
                            campo: "Formato PDF/Imagen",
                            descripcion: "Archivo PDF o imagen recibido. La captura numérica detallada se puede ingresar o verificar manualmente."
                        }],
                        detallesGrados: [],
                        esValido: true,
                        sha256Hash: sha
                    };
                }
            }
        } else {
            // Payload JSON directo (captura manual)
            const body = await req.json();
            escuelaId = body.escuelaId || (user?.role === "director" ? user.id : "");
            const datos: DatosFormato911 = body.datos;

            if (!datos || !datos.grados) {
                return NextResponse.json({ error: "Estructura de datos inválida" }, { status: 400 });
            }

            resultado = validarAritmetica911(datos, "MANUAL-" + Date.now());
            archivoNombre = "Captura_Manual_911.json";
        }

        if (!escuelaId) {
            return NextResponse.json({ error: "Debe especificar la escuela para el registro" }, { status: 400 });
        }

        // Obtener CCT de la escuela
        const escuela = await prisma.escuela.findUnique({
            where: { id: escuelaId }
        });

        if (!escuela) {
            return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
        }

        const estadoFinal = resultado.esValido ? "VALIDADO" : "CON_INCONSISTENCIAS";

        // 2. Upsert del registro 911
        const registro = await prisma.estadistica911Registro.upsert({
            where: {
                tenantId_cicloEscolarId_escuelaId_tipoCorte: {
                    tenantId,
                    cicloEscolarId: ciclo.id,
                    escuelaId: escuela.id,
                    tipoCorte: config.tipoCorte
                }
            },
            update: {
                escuelaCCT: escuela.cct,
                archivoNombre,
                tamanoBytes,
                sha256Hash: resultado.sha256Hash,
                totalHombres: resultado.totalHombres,
                totalMujeres: resultado.totalMujeres,
                totalAlumnos: resultado.totalAlumnos,
                totalGrupos: resultado.totalGrupos,
                totalDocentes: resultado.totalDocentes,
                totalAprobados: resultado.totalAprobados,
                totalReprobados: resultado.totalReprobados,
                totalEgresados: resultado.totalEgresados,
                totalDesercion: resultado.totalDesercion,
                estado: estadoFinal,
                inconsistenciasJson: resultado.inconsistencias as unknown as Prisma.InputJsonValue
            },
            create: {
                tenantId,
                cicloEscolarId: ciclo.id,
                escuelaId: escuela.id,
                escuelaCCT: escuela.cct,
                tipoCorte: config.tipoCorte,
                archivoNombre,
                tamanoBytes,
                sha256Hash: resultado.sha256Hash,
                totalHombres: resultado.totalHombres,
                totalMujeres: resultado.totalMujeres,
                totalAlumnos: resultado.totalAlumnos,
                totalGrupos: resultado.totalGrupos,
                totalDocentes: resultado.totalDocentes,
                totalAprobados: resultado.totalAprobados,
                totalReprobados: resultado.totalReprobados,
                totalEgresados: resultado.totalEgresados,
                totalDesercion: resultado.totalDesercion,
                estado: estadoFinal,
                inconsistenciasJson: resultado.inconsistencias as unknown as Prisma.InputJsonValue
            }
        });

        // 3. Recrear detalles por grado si vienen presentes
        if (resultado.detallesGrados && resultado.detallesGrados.length > 0) {
            await prisma.estadisticaDetalleGrado.deleteMany({
                where: { registroId: registro.id }
            });

            await prisma.estadisticaDetalleGrado.createMany({
                data: resultado.detallesGrados.map(d => ({
                    tenantId,
                    registroId: registro.id,
                    semestreGrado: d.semestreGrado,
                    hombres: d.hombres,
                    mujeres: d.mujeres,
                    total: d.total,
                    grupos: d.grupos,
                    desgloseEdades: (d.desgloseEdades || {}) as unknown as Prisma.InputJsonValue
                }))
            });
        }

        return NextResponse.json({
            success: true,
            registroId: registro.id,
            estado: estadoFinal,
            resultado,
            message: resultado.esValido
                ? `Formato 911 de ${escuela.nombre} validado correctamente con ${resultado.totalAlumnos} alumnos.`
                : `Formato 911 recibido con ${resultado.inconsistencias.length} inconsistencias detectadas.`
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al procesar el archivo 911";
        await registrarError("global", {
            mensaje: msg,
            ruta: "/api/admin/estadistica-911/upload",
            metodo: "POST",
            stack: err instanceof Error ? err.stack : undefined
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
