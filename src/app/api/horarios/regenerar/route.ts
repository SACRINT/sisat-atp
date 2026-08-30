import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolverHorario, SolverParams } from "@/lib/horarios/solver";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await req.json();
    const { escuelaId: reqEscuelaId, horarioId, slotsLibresBloqueados = [], celdas = [] } = body;

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

    // 1. Obtener ciclo escolar activo y configuración de la escuela
    const cicloActivo = await prisma.cicloEscolar.findFirst({
      where: { activo: true }
    });

    if (!cicloActivo) {
      return NextResponse.json({ error: "No hay un ciclo escolar activo configurado" }, { status: 400 });
    }

    const config = await prisma.horarioConfiguracion.findUnique({
      where: { escuelaId }
    });

    const horasPorDia = config?.horasPorDia || 6;
    const diasLectivos = config?.diasLectivos || 5;

    // 2. Cargar grupos, docentes, aulas y cargas de la escuela
    const grupos = await prisma.horarioGrupo.findMany({
      where: { escuelaId },
      orderBy: [{ semestre: "asc" }, { nombre: "asc" }]
    });

    const docentes = await prisma.personal.findMany({
      where: { escuelaId },
      orderBy: [{ apellidoPaterno: "asc" }, { nombre: "asc" }]
    });

    const aulas = await prisma.horarioAula.findMany({
      where: { escuelaId }
    });

    const cargas = await prisma.horarioCargaDocente.findMany({
      where: { escuelaId },
      include: { asignatura: true, personal: true, grupo: true }
    });

    if (grupos.length === 0 || cargas.length === 0) {
      return NextResponse.json({
        error: "Debe registrar al menos 1 grupo y 1 carga académica docente antes de generar el horario."
      }, { status: 400 });
    }

    // 3. Extraer celdas fijas con candado (excluyendo las que colisionen con bloqueos de horas libres recién fijados)
    const slotsBloqArr: string[] = Array.isArray(slotsLibresBloqueados) ? slotsLibresBloqueados : [];
    const slotsBloqSet = new Set<string>(slotsBloqArr);

    const celdasFijas = (Array.isArray(celdas) ? celdas : [])
      .filter((c: any) => {
        if (!c.esBloqueado) return false;
        const kDoc = `${c.diaSemana}_${c.periodo}_${c.docenteId}`;
        const kGrp = `${c.diaSemana}_${c.periodo}_${c.grupoId}`;
        if (slotsBloqSet.has(kDoc) || slotsBloqSet.has(kGrp)) return false;
        return true;
      })
      .map((c: any) => ({
        diaSemana: Number(c.diaSemana),
        periodo: Number(c.periodo),
        grupoId: String(c.grupoId),
        docenteId: String(c.docenteId),
        asignaturaId: String(c.asignaturaId || c.uacName || ""),
        aulaId: c.aulaId || undefined
      }));

    // 4. Validación Previa de Factibilidad Matemática (Capacidad vs Bloqueos)
    const conflictosInfactibles: string[] = [];

    for (const g of grupos) {
      const maxP = (g as any).horasPorDia || (g.semestre === 1 ? 5 : horasPorDia);
      const totalCapacidadTeorica = diasLectivos * maxP;
      const slotsBloqGrupo = slotsBloqArr.filter((k: string) => {
        const parts = k.split("_");
        return parts.length >= 3 && (parts[2] === g.id || parts[2] === g.nombre);
      }).length;

      const capacidadRealGrupo = totalCapacidadTeorica - slotsBloqGrupo;
      const hrsRequeridasGrupo = cargas
        .filter((c: any) => c.grupoId === g.id)
        .reduce((sum: number, c: any) => sum + (c.horasSemanales || 0), 0);

      if (hrsRequeridasGrupo > capacidadRealGrupo) {
        conflictosInfactibles.push(
          `El Grupo ${g.nombre} requiere ${hrsRequeridasGrupo} hrs de clase pero solo tiene ${capacidadRealGrupo} hrs disponibles por los bloqueos fijados (${slotsBloqGrupo} hrs bloqueadas).`
        );
      }
    }

    for (const d of docentes) {
      const totalCapacidadTeorica = diasLectivos * horasPorDia;
      const slotsBloqDoc = slotsBloqArr.filter((k: string) => {
        const parts = k.split("_");
        return parts.length >= 3 && parts[2] === d.id;
      }).length;

      const capacidadRealDoc = totalCapacidadTeorica - slotsBloqDoc;
      const hrsRequeridasDoc = cargas
        .filter((c: any) => c.personalId === d.id)
        .reduce((sum: number, c: any) => sum + (c.horasSemanales || 0), 0);

      if (hrsRequeridasDoc > capacidadRealDoc) {
        conflictosInfactibles.push(
          `El docente ${d.nombre} ${d.apellidoPaterno} tiene ${hrsRequeridasDoc} hrs asignadas pero solo tiene ${capacidadRealDoc} hrs disponibles en la semana por los bloqueos fijados (${slotsBloqDoc} hrs bloqueadas).`
        );
      }
    }

    if (conflictosInfactibles.length > 0) {
      return NextResponse.json({
        success: false,
        error: conflictosInfactibles.join(" | "),
        conflictos: conflictosInfactibles
      }, { status: 422 });
    }

    // 5. Preparar parámetros y ejecutar el Solver Global
    const params: SolverParams = {
      diasLectivos,
      horasPorDia,
      grupos: grupos.map(g => ({
        id: g.id,
        nombre: g.nombre,
        semestre: g.semestre,
        horasPorDia: (g as any).horasPorDia || (g.semestre === 1 ? 5 : horasPorDia)
      })),
      docentes: docentes.map(d => ({
        id: d.id,
        nombreCompleto: `${d.nombre} ${d.apellidoPaterno} ${d.apellidoMaterno || ""}`.trim(),
        horasMaxDia: horasPorDia
      })),
      aulas: aulas.length > 0 ? aulas.map(a => ({ id: a.id, nombre: a.nombre, tipo: a.tipo })) : [{ id: "aula-gen", nombre: "Aula General", tipo: "REGULAR" }],
      cargas: cargas.map(c => ({
        id: c.id,
        docenteId: c.personalId,
        grupoId: c.grupoId,
        asignaturaId: c.asignaturaId,
        horasSemanales: c.horasSemanales,
        esHoraDoblePermitida: c.esHoraDoblePermitida,
        requiereAulaEspecial: c.requiereAulaEspecial,
        aulaEspecialId: c.aulaEspecialId || undefined
      })),
      celdasFijas,
      slotsLibresBloqueados: slotsBloqArr
    };

    const resultado = resolverHorario(params);

    if (!resultado.exito) {
      const errorDetalle = resultado.conflictos && resultado.conflictos.length > 0
        ? resultado.conflictos.join(". ")
        : "No fue posible generar un horario válido con las restricciones y bloqueos actuales.";

      return NextResponse.json({
        success: false,
        error: errorDetalle,
        conflictos: resultado.conflictos || []
      }, { status: 422 });
    }

    // 6. Persistir en la base de datos relacional de SISAT-ATP
    let horarioGenerado = horarioId
      ? await prisma.horarioGenerado.findUnique({ where: { id: horarioId } })
      : await prisma.horarioGenerado.findFirst({
          where: { escuelaId, cicloEscolarId: cicloActivo.id },
          orderBy: { updatedAt: "desc" }
        });

    if (!horarioGenerado) {
      horarioGenerado = await prisma.horarioGenerado.create({
        data: {
          escuelaId,
          cicloEscolarId: cicloActivo.id,
          nombreVersion: `Horario ${new Date().toLocaleDateString("es-MX")}`,
          estado: "BORRADOR",
          scoreMetricas: {
            ...resultado.metricas,
            slotsLibresBloqueados: slotsBloqArr
          }
        }
      });
    } else {
      await prisma.horarioGenerado.update({
        where: { id: horarioGenerado.id },
        data: {
          scoreMetricas: {
            ...resultado.metricas,
            slotsLibresBloqueados: slotsBloqArr
          }
        }
      });
    }

    // Limpiar celdas previas y reinsertar las calculadas por el solver
    await prisma.horarioCelda.deleteMany({
      where: { horarioId: horarioGenerado.id }
    });

    if (resultado.celdas.length > 0) {
      await prisma.horarioCelda.createMany({
        data: resultado.celdas.map(c => ({
          horarioId: horarioGenerado!.id,
          diaSemana: c.diaSemana,
          periodo: c.periodo,
          grupoId: c.grupoId,
          docenteId: c.docenteId,
          asignaturaId: c.asignaturaId,
          aulaId: c.aulaId || null,
          cargaId: c.cargaId || null,
          esBloqueado: !!c.esBloqueado
        }))
      });
    }

    const horarioFinal = await prisma.horarioGenerado.findUnique({
      where: { id: horarioGenerado.id },
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
      horario: horarioFinal,
      metricas: resultado.metricas,
      conflictos: resultado.conflictos
    });

  } catch (error: any) {
    console.error("[api/horarios/regenerar] Error en POST:", error);
    return NextResponse.json({ error: error.message || "Error interno al reoptimizar horario" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(req.url);
    const reqEscuelaId = searchParams.get("escuelaId");

    let escuelaId: string;
    if (user.role === "admin" || user.role === "supervision") {
      escuelaId = reqEscuelaId || user.escuelaId || user.id;
    } else {
      escuelaId = user.escuelaId || user.id;
    }

    if (!escuelaId) {
      return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });
    }

    const horarioActual = await prisma.horarioGenerado.findFirst({
      where: { escuelaId },
      orderBy: { updatedAt: "desc" },
      include: { celdas: true }
    });

    if (!horarioActual) {
      return NextResponse.json({ success: true, message: "No hay horario para limpiar." });
    }

    // Preservar únicamente las celdas que tengan candado (esBloqueado === true)
    await prisma.horarioCelda.deleteMany({
      where: {
        horarioId: horarioActual.id,
        esBloqueado: false
      }
    });

    const celdasPreservadas = await prisma.horarioCelda.findMany({
      where: { horarioId: horarioActual.id },
      include: {
        grupo: true,
        docente: true,
        asignatura: true,
        aula: true
      }
    });

    const horarioLimpio = await prisma.horarioGenerado.update({
      where: { id: horarioActual.id },
      data: {
        scoreMetricas: {
          ...((horarioActual.scoreMetricas as any) || {}),
          totalClasesProgramadas: celdasPreservadas.length
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
      horario: horarioLimpio,
      mensaje: "Retícula limpiada exitosamente. Las celdas con candado se han preservado."
    });

  } catch (error: any) {
    console.error("[api/horarios/regenerar] Error en DELETE:", error);
    return NextResponse.json({ error: error.message || "Error interno al limpiar horario" }, { status: 500 });
  }
}
