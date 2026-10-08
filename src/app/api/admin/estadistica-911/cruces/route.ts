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
        if (isNaN(sicepNum) || sicepNum < 0) {
            return NextResponse.json({ error: "La matrícula SICEP debe ser un número entero mayor o igual a 0" }, { status: 400 });
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
        const payloadDiscrepancias: Prisma.InputJsonValue = (discrepancias ?? (
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

        // 3. Si hay inconsistencia y el registro estaba VALIDADO, agregar la advertencia al registro
        if (evaluacionCruce.hayDiscrepancia && evaluacionCruce.inconsistencia) {
            const rawInconsistencias = registro.inconsistenciasJson;
            const inconsistenciasActuales = Array.isArray(rawInconsistencias) ? rawInconsistencias : [];
            const yaExisteDiscrepancia = inconsistenciasActuales.some(
                (inc: unknown) => typeof inc === "object" && inc !== null && "tipo" in inc && (inc as { tipo: string }).tipo === "DISCREPANCIA_SICEP"
            );

            if (!yaExisteDiscrepancia) {
                const nuevasInconsistencias = [...inconsistenciasActuales, evaluacionCruce.inconsistencia];
                await prisma.estadistica911Registro.update({
                    where: { id: registro.id },
                    data: {
                        inconsistenciasJson: nuevasInconsistencias as Prisma.InputJsonValue,
                        estado: "CON_INCONSISTENCIAS"
                    }
                });
            }
        }

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
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
