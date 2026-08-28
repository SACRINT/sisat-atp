import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolverHorario } from "@/lib/horarios/solver";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await req.json();
    const { escuelaId: reqEscuelaId, nombreVersion } = body;

    let escuelaId: string;
    if (user.role === "admin" || user.role === "supervision") {
      escuelaId = reqEscuelaId || user.escuelaId || user.id;
    } else {
      escuelaId = user.escuelaId || user.id;
      if (reqEscuelaId && reqEscuelaId !== escuelaId) {
        return NextResponse.json({ error: "Acceso denegado a otra escuela" }, { status: 403 });
      }
    }

    if (!escuelaId) {
      return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });
    }

    // 1. Obtener ciclo escolar activo
    const cicloActivo = await prisma.cicloEscolar.findFirst({
      where: { activo: true }
    });

    if (!cicloActivo) {
      return NextResponse.json({ error: "No hay un ciclo escolar activo configurado" }, { status: 400 });
    }

    // 2. Obtener datos completos de la escuela
    const config = await prisma.horarioConfiguracion.findUnique({
      where: { escuelaId }
    });

    const grupos = await prisma.horarioGrupo.findMany({ where: { escuelaId } });
    const docentes = await prisma.personal.findMany({
      where: { escuelaId }
    });
    const aulas = await prisma.horarioAula.findMany({ where: { escuelaId } });
    const cargas = await prisma.horarioCargaDocente.findMany({ where: { escuelaId } });

    if (grupos.length === 0 || cargas.length === 0) {
      return NextResponse.json({
        error: "Debe registrar al menos 1 grupo y 1 carga académica docente antes de generar el horario."
      }, { status: 400 });
    }

    // ===== LOGS DE DIAGNÓSTICO =====
    const resumenCargas: Record<string, { nombre: string; horas: number; cargas: number }> = {};
    for (const c of cargas) {
      const d = docentes.find(d => d.id === c.personalId);
      const nombre = d ? `${d.nombre} ${d.apellidoPaterno}` : c.personalId;
      if (!resumenCargas[c.personalId]) resumenCargas[c.personalId] = { nombre, horas: 0, cargas: 0 };
      resumenCargas[c.personalId].horas += c.horasSemanales;
      resumenCargas[c.personalId].cargas += 1;
    }
    console.log(`[generar] TOTAL cargas en DB: ${cargas.length}`);
    Object.entries(resumenCargas).forEach(([id, info]) => {
      console.log(`[generar]  → ${info.nombre}: ${info.cargas} cargas = ${info.horas} horas/sem`);
    });
    // ================================

    // Obtener horaro previo para conservar slotsLibresBloqueados si existían
    const horarioExistente = await prisma.horarioGenerado.findFirst({
      where: { escuelaId },
      orderBy: { createdAt: "desc" }
    });
    const existingScore = (horarioExistente?.scoreMetricas as any) || {};
    const slotsLibresBloqueados: string[] = Array.isArray(existingScore.slotsLibresBloqueados)
      ? existingScore.slotsLibresBloqueados
      : [];

    // 3. Ejecutar Solver Estricto
    const resultadoSolver = resolverHorario({
      diasLectivos: config?.diasLectivos || 5,
      horasPorDia: config?.horasPorDia || 6,
      grupos: grupos.map(g => ({
        id: g.id,
        nombre: g.nombre,
        semestre: g.semestre,
        horasPorDia: (g as any).horasPorDia || (g.semestre === 1 ? 5 : config?.horasPorDia || 6)
      })),
      docentes: docentes.map(d => ({ id: d.id, nombreCompleto: `${d.nombre} ${d.apellidoPaterno}`.trim() })),
      aulas: aulas.map(a => ({ id: a.id, nombre: a.nombre, tipo: a.tipo })),
      cargas: cargas.map(c => ({
        id: c.id,
        docenteId: c.personalId,
        grupoId: c.grupoId,
        asignaturaId: c.asignaturaId,
        horasSemanales: c.horasSemanales,
        requiereAulaEspecial: c.requiereAulaEspecial,
        aulaEspecialId: c.aulaEspecialId || undefined
      })),
      slotsLibresBloqueados
    });

    console.log(`[generar] Solver generó: ${resultadoSolver.celdas.length} celdas. Conflictos: ${resultadoSolver.conflictos.length}`);

    // 4. Guardar Horario Generado en BD
    const horarioGenerado = await prisma.horarioGenerado.create({
      data: {
        escuelaId,
        cicloEscolarId: cicloActivo.id,
        nombreVersion: nombreVersion || `Borrador ${new Date().toLocaleDateString("es-MX")}`,
        estado: "BORRADOR",
        scoreMetricas: {
          ...resultadoSolver.metricas,
          slotsLibresBloqueados
        },
        celdas: {
          create: resultadoSolver.celdas.map(c => ({
            diaSemana: c.diaSemana,
            periodo: c.periodo,
            grupoId: c.grupoId,
            docenteId: c.docenteId,
            asignaturaId: c.asignaturaId,
            aulaId: c.aulaId || null,
            cargaId: c.cargaId || null,
            esBloqueado: !!c.esBloqueado
          }))
        }
      },
      include: {
        celdas: {
          include: {
            grupo: true,
            docente: true,
            asignatura: true,
            aula: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      exitoSolver: resultadoSolver.exito,
      metricas: resultadoSolver.metricas,
      conflictos: resultadoSolver.conflictos,
      horario: horarioGenerado
    });
  } catch (error: any) {
    console.error("[api/horarios/generar] Error en POST:", error);
    return NextResponse.json({ error: "Error al generar horario con IA" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const escuelaId = searchParams.get("escuelaId");

    if (!escuelaId) {
      return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });
    }

    await prisma.horarioGenerado.deleteMany({
      where: { escuelaId }
    });

    return NextResponse.json({ success: true, message: "Horario generado eliminado exitosamente." });
  } catch (error: any) {
    console.error("[api/horarios/generar] Error en DELETE:", error);
    return NextResponse.json({ error: "Error al eliminar el horario" }, { status: 500 });
  }
}
