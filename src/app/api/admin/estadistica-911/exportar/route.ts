import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarError } from "@/lib/error-log";
import { obtenerCicloActual } from "@/lib/ciclo";
import { generarConcentradoZonal911Excel } from "@/lib/estadistica-911-engine";

export const dynamic = "force-dynamic";

export async function GET() {
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

        const config = await prisma.estadisticaPeriodoConfig.findUnique({
            where: { tenantId }
        });
        const tipoCorte = config?.tipoCorte || "INICIO_DE_CURSOS";

        const escuelas = await prisma.escuela.findMany({
            where: { esSupervision: false },
            orderBy: { nombre: "asc" },
            include: {
                estadistica911Registros: {
                    where: {
                        tenantId,
                        cicloEscolarId: ciclo.id,
                        tipoCorte
                    },
                    include: {
                        detalles: true
                    }
                }
            }
        });

        const filasParaExcel = escuelas.map(esc => {
            const reg = esc.estadistica911Registros[0];
            return {
                escuelaCCT: esc.cct,
                escuelaNombre: esc.nombre,
                localidad: esc.localidad,
                totalHombres: reg ? reg.totalHombres : 0,
                totalMujeres: reg ? reg.totalMujeres : 0,
                totalAlumnos: reg ? reg.totalAlumnos : 0,
                totalGrupos: reg ? reg.totalGrupos : 0,
                totalDocentes: reg ? reg.totalDocentes : 0,
                estado: reg ? reg.estado : "PENDIENTE",
                sha256Hash: reg ? reg.sha256Hash : null,
                detalles: reg ? reg.detalles.map(d => ({
                    semestreGrado: d.semestreGrado,
                    hombres: d.hombres,
                    mujeres: d.mujeres,
                    total: d.total,
                    grupos: d.grupos,
                    desgloseEdades: (d.desgloseEdades as Record<string, { h: number; m: number }>) || undefined
                })) : []
            };
        });

        const excelBuffer = generarConcentradoZonal911Excel(filasParaExcel);
        const corteLabel = tipoCorte === "INICIO_DE_CURSOS" ? "Inicio_Cursos" : "Fin_Cursos";
        const filename = `Concentrado_Zonal_911_${corteLabel}_${ciclo.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;

        return new NextResponse(new Uint8Array(excelBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${filename}"`
            }
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al exportar concentrado de estadística 911";
        await registrarError("global", {
            mensaje: msg,
            ruta: "/api/admin/estadistica-911/exportar",
            metodo: "GET",
            stack: err instanceof Error ? err.stack : undefined
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
