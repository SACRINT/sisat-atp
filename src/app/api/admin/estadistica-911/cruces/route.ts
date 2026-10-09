import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarError } from "@/lib/error-log";
import { validarCruceSicep } from "@/lib/estadistica-911-engine";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const user = session.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const registroId = searchParams.get("registroId");

        const whereClause: { tenantId: string; registroId?: string } = { tenantId };
        if (registroId) {
            whereClause.registroId = registroId;
        }

        const cruces = await prisma.estadisticaCruceSicep.findMany({
            where: whereClause,
            include: {
                registro: {
                    select: {
                        id: true,
                        escuelaCCT: true,
                        tipoCorte: true,
                        totalAlumnos: true,
                        escuela: {
                            select: { id: true, nombre: true, cct: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ success: true, cruces });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al obtener cruces SICEP";
        await registrarError("global", {
            mensaje: msg,
            ruta: "/api/admin/estadistica-911/cruces",
            metodo: "GET",
            stack: err instanceof Error ? err.stack : undefined
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const user = session.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
        }

        const body = await req.json();
        const { registroId, matriculaSicepTotal, discrepancias } = body;

        if (!registroId || typeof registroId !== "string") {
            return NextResponse.json({ error: "El registroId es obligatorio" }, { status: 400 });
        }

        const sicepNum = Number(matriculaSicepTotal);
        if (!Number.isInteger(sicepNum) || sicepNum < 0) {
            return NextResponse.json({ error: "La matrícula SICEP debe ser un número entero mayor o igual a 0" }, { status: 400 });
        }

        if (discrepancias !== undefined && !Array.isArray(discrepancias)) {
            return NextResponse.json({ error: "El campo discrepancias debe ser un arreglo" }, { status: 400 });
        }

        // 1. Verificar existencia del registro 911 dentro del tenant
        const registro = await prisma.estadistica911Registro.findFirst({
            where: { id: registroId, tenantId },
            include: { escuela: true }
        });

        if (!registro) {
            return NextResponse.json({ error: "Registro de Estadística 911 no encontrado" }, { status: 404 });
        }

        const matricula911Total = registro.totalAlumnos;
        const evaluacionCruce = validarCruceSicep(matricula911Total, sicepNum);
        const diferencia = evaluacionCruce.diferencia;

        // Discrepancias formateadas para almacenamiento
        const payloadDiscrepancias: Prisma.InputJsonValue = (Array.isArray(discrepancias) ? discrepancias : (
            evaluacionCruce.inconsistencia ? [evaluacionCruce.inconsistencia] : []
        )) as Prisma.InputJsonValue;

        // 2. Crear el cruce SICEP
        const cruceCreado = await prisma.estadisticaCruceSicep.create({
            data: {
                tenantId,
                registroId: registro.id,
                matriculaSicepTotal: sicepNum,
                matricula911Total,
                diferencia,
                discrepancias: payloadDiscrepancias
            }
        });

        // 3. Actualizar inconsistenciasJson y estado del registro 911
        // Filtrar cualquier DISCREPANCIA_SICEP previa para reemplazar en lugar de apilar (H-5)
        const rawInconsistencias = registro.inconsistenciasJson;
        const inconsistenciasActuales = Array.isArray(rawInconsistencias) ? (rawInconsistencias as Array<Record<string, unknown>>) : [];
        const otrasInconsistencias = inconsistenciasActuales.filter(
            (inc) => typeof inc === "object" && inc !== null && (inc as { tipo?: string }).tipo !== "DISCREPANCIA_SICEP"
        );

        let nuevasInconsistencias: Array<Record<string, unknown>>;
        let nuevoEstado = registro.estado;

        if (evaluacionCruce.hayDiscrepancia && evaluacionCruce.inconsistencia) {
            nuevasInconsistencias = [...otrasInconsistencias, evaluacionCruce.inconsistencia as unknown as Record<string, unknown>];
            nuevoEstado = "CON_INCONSISTENCIAS";
        } else {
            nuevasInconsistencias = otrasInconsistencias;
            // Si ya no hay discrepancia SICEP y no hay errores críticos, restaurar a VALIDADO (o mantener ENTREGADO_A_CORDE)
            const tieneCriticos = nuevasInconsistencias.some((i) => i.severidad === "ERROR_CRITICO");
            if (!tieneCriticos && nuevoEstado !== "ENTREGADO_A_CORDE") {
                nuevoEstado = "VALIDADO";
            }
        }

        await prisma.estadistica911Registro.update({
            where: { id: registro.id },
            data: {
                inconsistenciasJson: nuevasInconsistencias as Prisma.InputJsonValue,
                estado: nuevoEstado
            }
        });

        return NextResponse.json({
            success: true,
            cruce: cruceCreado,
            evaluacion: evaluacionCruce
        }, { status: 201 });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al procesar cruce SICEP";
        await registrarError("global", {
            mensaje: msg,
            ruta: "/api/admin/estadistica-911/cruces",
            metodo: "POST",
            stack: err instanceof Error ? err.stack : undefined
        });
        return NextResponse.json({ error: "Error interno al procesar cruce SICEP" }, { status: 500 });
    }
}
