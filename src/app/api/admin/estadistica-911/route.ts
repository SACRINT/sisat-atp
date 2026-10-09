import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarError } from "@/lib/error-log";
import { obtenerCicloActual } from "@/lib/ciclo";

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

        const ciclo = await obtenerCicloActual();
        if (!ciclo) {
            return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 400 });
        }

        // 1. Obtener configuración
        let config = await prisma.estadisticaPeriodoConfig.findUnique({
            where: { tenantId }
        });

        if (!config) {
            config = await prisma.estadisticaPeriodoConfig.create({
                data: {
                    tenantId,
                    cicloEscolarId: ciclo.id,
                    tipoCorte: "INICIO_DE_CURSOS",
                    activo: true,
                    visibleEnDirector: true
                }
            });
        }

        // 2. Obtener escuelas
        const escuelas = await prisma.escuela.findMany({
            where: { esSupervision: false },
            orderBy: { nombre: "asc" },
            select: {
                id: true,
                cct: true,
                nombre: true,
                localidad: true,
                municipio: true,
                zonaEscolar: true
            }
        });

        // 3. Obtener registros de Estadística 911 para el ciclo y corte actual
        const registros = await prisma.estadistica911Registro.findMany({
            where: {
                tenantId,
                cicloEscolarId: ciclo.id,
                tipoCorte: config.tipoCorte
            },
            include: {
                detalles: {
                    orderBy: { semestreGrado: "asc" }
                },
                crucesSicep: {
                    orderBy: { createdAt: "desc" }
                },
                escuela: {
                    select: {
                        id: true,
                        cct: true,
                        nombre: true,
                        localidad: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // 4. Calcular KPIs Zonales
        let sumHombres = 0;
        let sumMujeres = 0;
        let sumAlumnos = 0;
        let sumGrupos = 0;
        let sumDocentes = 0;
        let validadosCount = 0;
        let conInconsistenciasCount = 0;
        const pendientesCount = escuelas.length - registros.length;

        registros.forEach(r => {
            sumHombres += r.totalHombres;
            sumMujeres += r.totalMujeres;
            sumAlumnos += r.totalAlumnos;
            sumGrupos += r.totalGrupos;
            sumDocentes += r.totalDocentes;

            if (r.estado === "VALIDADO" || r.estado === "ENTREGADO_A_CORDE") {
                validadosCount++;
            } else if (r.estado === "CON_INCONSISTENCIAS") {
                conInconsistenciasCount++;
            }
        });

        const kpis = {
            totalEscuelas: escuelas.length,
            entregadas: registros.length,
            validados: validadosCount,
            conInconsistencias: conInconsistenciasCount,
            pendientes: Math.max(0, pendientesCount),
            matriculaZonal: sumAlumnos,
            hombresZonal: sumHombres,
            mujeresZonal: sumMujeres,
            gruposZonal: sumGrupos,
            docentesZonal: sumDocentes
        };

        return NextResponse.json({
            success: true,
            ciclo: { id: ciclo.id, nombre: ciclo.nombre, activo: ciclo.activo },
            config,
            escuelas,
            registros,
            kpis
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al obtener datos de estadística 911";
        await registrarError("global", {
            mensaje: msg,
            ruta: "/api/admin/estadistica-911",
            metodo: "GET",
            stack: err instanceof Error ? err.stack : undefined
        });
        return NextResponse.json({ error: "Error al obtener datos de estadística 911" }, { status: 500 });
    }
}
