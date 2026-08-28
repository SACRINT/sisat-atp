import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { procesarComandoIA } from "@/lib/horarios/ai-assistant";
import { resolverHorario } from "@/lib/horarios/solver";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { horarioId, mensaje, slotsLibresBloqueados: clientSlots, celdas: clientCeldas } = body;

    if (!horarioId || !mensaje) {
      return NextResponse.json({ error: "horarioId y mensaje son requeridos" }, { status: 400 });
    }

    // 1. Cargar horario actual y sus relaciones completas
    const horario = await prisma.horarioGenerado.findUnique({
      where: { id: horarioId },
      include: {
        escuela: true,
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

    if (!horario) {
      return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });
    }

    const user = session.user as any;
    if (user.role !== "admin" && user.role !== "supervision") {
      const userEscuelaId = user.escuelaId || user.id;
      if (horario.escuelaId !== userEscuelaId) {
        return NextResponse.json({ error: "Acceso denegado a este horario" }, { status: 403 });
      }
    }

    const escuelaId = horario.escuelaId;

    // Extraer y combinar slotsLibresBloqueados desde scoreMetricas y desde el cliente
    const scoreMetricas = (horario.scoreMetricas as any) || {};
    const dbSlots: string[] = Array.isArray(scoreMetricas.slotsLibresBloqueados)
      ? scoreMetricas.slotsLibresBloqueados
      : [];
    const clientSlotsArr: string[] = Array.isArray(clientSlots)
      ? clientSlots
      : [];
    let slotsLibresBloqueados: string[] = Array.from(new Set([...dbSlots, ...clientSlotsArr]));

    // Cargar datos de la escuela y cargas actuales
    const config = await prisma.horarioConfiguracion.findUnique({ where: { escuelaId } });
    const grupos = await prisma.horarioGrupo.findMany({ where: { escuelaId } });
    const docentes = await prisma.personal.findMany({ where: { escuelaId } });
    const materias = await prisma.horarioAsignaturaCatalogo.findMany({
      where: { OR: [{ escuelaId: null }, { escuelaId }] }
    });
    const cargas = await prisma.horarioCargaDocente.findMany({ where: { escuelaId } });

    // Calcular horas asignadas reales a cada docente para la validación de factibilidad
    const celdasParaCalculo = (Array.isArray(clientCeldas) && clientCeldas.length > 0)
      ? clientCeldas
      : horario.celdas;

    const docentesConHoras = docentes.map((d) => {
      const hrsAsignadas = celdasParaCalculo
        .filter((c: any) => c.docenteId === d.id)
        .length; // cada celda es 1 hora lectiva
      return {
        id: d.id,
        nombreCompleto: `${d.nombre} ${d.apellidoPaterno}`.trim(),
        horasAsignadas: hrsAsignadas
      };
    });

    const mensajesAnteriores = await prisma.horarioChatMensaje.findMany({
      where: { horarioId },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    // Voltear para que estén en orden cronológico
    const historialConversacion = mensajesAnteriores.reverse().map(m => ({
      role: m.role,
      content: m.content
    }));

    // 2. Procesar comando con Gemini AI Assistant (incluyendo validación matemática de factibilidad)
    const respuestaIA = await procesarComandoIA(
      mensaje,
      {
        nombreEscuela: horario.escuela.nombre,
        horasPorDia: config?.horasPorDia || 6,
        diasLectivos: config?.diasLectivos || 5,
        grupos: grupos.map(g => ({ id: g.id, nombre: g.nombre })),
        docentes: docentesConHoras,
        materias: materias.map(m => ({ id: m.id, nombre: m.uacName })),
        celdasActuales: celdasParaCalculo,
        slotsLibresBloqueados,
        historialConversacion
      },
      escuelaId
    );

    // 3. Guardar mensaje del usuario
    await prisma.horarioChatMensaje.create({
      data: {
        horarioId,
        role: "user",
        content: mensaje
      }
    });

    // ─── CONTADOR ACUMULATIVO (nunca se decrementa al limpiar el chat) ───
    await prisma.horarioStats.upsert({
      where: { escuelaId },
      create: {
        escuelaId,
        totalUsos: 0,
        totalMensajesChat: 1,
        ultimoUso: new Date()
      },
      update: {
        totalMensajesChat: { increment: 1 },
        ultimoUso: new Date()
      }
    });

    // 4. Si la petición NO es factible, responder de inmediato con la explicación matemática
    if (!respuestaIA.factible) {
      await prisma.horarioChatMensaje.create({
        data: {
          horarioId,
          role: "assistant",
          content: respuestaIA.explicacion,
          accionAplicada: (respuestaIA.acciones as any) || undefined
        }
      });

      const horarioActualizado = await prisma.horarioGenerado.findUnique({
        where: { id: horarioId },
        include: {
          celdas: {
            include: {
              grupo: true,
              docente: true,
              asignatura: true,
              aula: true
            }
          },
          mensajesChat: {
            orderBy: { createdAt: "asc" }
          }
        }
      });

      return NextResponse.json({
        success: true,
        respuestaIA,
        horario: horarioActualizado
      });
    }

    const aulas = await prisma.horarioAula.findMany({ where: { escuelaId } });

    // 5. Si es factible y requiere re-optimización mediante Solver
    let huboReGeneracion = false;

    if (respuestaIA.acciones && respuestaIA.acciones.length > 0) {
      for (const accion of respuestaIA.acciones) {
        if (accion.tipo === "REGENERAR_CON_RESTRICCIONES") {
          const celdasFijasExistentes = celdasParaCalculo
            .filter((c: any) => c.esBloqueado)
            .map((c: any) => ({
              diaSemana: c.diaSemana,
              periodo: c.periodo,
              grupoId: c.grupoId,
              docenteId: c.docenteId,
              asignaturaId: c.asignaturaId,
              aulaId: c.aulaId || undefined
            }));

          const restriccionMaxHrsDia = accion.restriccionDistribucion === "MAX_1_HR_DIA" ? 1 : 2;

          // Si la IA generó bloqueos específicos a docentes, acumularlos en slotsLibresBloqueados
          const horasDiaConfig = config?.horasPorDia || 6;
          if (accion.bloqueosDocentes && Array.isArray(accion.bloqueosDocentes)) {
            for (const bd of accion.bloqueosDocentes) {
              if (bd.diasIndisponibles && Array.isArray(bd.diasIndisponibles)) {
                for (const d of bd.diasIndisponibles) {
                  for (let p = 1; p <= horasDiaConfig; p++) {
                    slotsLibresBloqueados.push(`${d}_${p}_${bd.docenteId}`);
                  }
                }
              }
              if (bd.periodosIndisponibles && Array.isArray(bd.periodosIndisponibles)) {
                for (const pi of bd.periodosIndisponibles) {
                  slotsLibresBloqueados.push(`${pi.dia}_${pi.periodo}_${bd.docenteId}`);
                }
              }
            }
          }

          // Si la IA generó bloqueos específicos a grupos, acumularlos en slotsLibresBloqueados
          if (accion.bloqueosGrupos && Array.isArray(accion.bloqueosGrupos)) {
            for (const bg of accion.bloqueosGrupos) {
              if (bg.diasIndisponibles && Array.isArray(bg.diasIndisponibles)) {
                for (const d of bg.diasIndisponibles) {
                  for (let p = 1; p <= horasDiaConfig; p++) {
                    slotsLibresBloqueados.push(`${d}_${p}_${bg.grupoId}`);
                  }
                }
              }
              if (bg.periodosIndisponibles && Array.isArray(bg.periodosIndisponibles)) {
                for (const pi of bg.periodosIndisponibles) {
                  slotsLibresBloqueados.push(`${pi.dia}_${pi.periodo}_${bg.grupoId}`);
                }
              }
            }
          }

          slotsLibresBloqueados = Array.from(new Set(slotsLibresBloqueados));

          const resultadoSolver = resolverHorario({
            diasLectivos: config?.diasLectivos || 5,
            horasPorDia: config?.horasPorDia || 6,
            restriccionMaxHrsDia,
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
            celdasFijas: celdasFijasExistentes,
            restriccionesDocentes: accion.bloqueosDocentes || [],
            slotsLibresBloqueados
          });

          if (resultadoSolver.exito && resultadoSolver.celdas && resultadoSolver.celdas.length > 0) {
            await prisma.horarioCelda.deleteMany({ where: { horarioId } });
            await prisma.horarioCelda.createMany({
              data: resultadoSolver.celdas.map(c => ({
                horarioId,
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
            await prisma.horarioGenerado.update({
              where: { id: horarioId },
              data: {
                scoreMetricas: {
                  ...resultadoSolver.metricas,
                  slotsLibresBloqueados
                }
              }
            });
            huboReGeneracion = true;
          } else {
            console.warn(`[api/horarios/chat] Solver reportó no-éxito (${resultadoSolver.celdas?.length || 0} celdas generadas de ${resultadoSolver.metricas?.totalClasesRequeridas || 0} requeridas). Se mantiene el horario previo.`);
          }
        }
      }
    }

    // 6. Guardar respuesta del asistente
    await prisma.horarioChatMensaje.create({
      data: {
        horarioId,
        role: "assistant",
        content: respuestaIA.explicacion,
        accionAplicada: (respuestaIA.acciones as any) || undefined
      }
    });

    // 7. Retornar el horario completamente actualizado en tiempo real
    const horarioActualizado = await prisma.horarioGenerado.findUnique({
      where: { id: horarioId },
      include: {
        celdas: {
          include: {
            grupo: true,
            docente: true,
            asignatura: true,
            aula: true
          }
        },
        mensajesChat: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    return NextResponse.json({
      success: true,
      respuestaIA,
      horario: horarioActualizado
    });
  } catch (error: any) {
    console.error("[api/horarios/chat] Error en POST:", error);
    return NextResponse.json({ error: "Error al procesar mensaje en el chat IA" }, { status: 500 });
  }
}

// ─── DELETE: Limpiar historial de chat (acción del Director) ───
// Elimina solo los mensajes. El contador acumulativo en HorarioStats NO se modifica.
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const horarioId = searchParams.get("horarioId");

    if (!horarioId) {
      return NextResponse.json({ error: "horarioId es requerido" }, { status: 400 });
    }

    // Verificar que el horario existe
    const horario = await prisma.horarioGenerado.findUnique({
      where: { id: horarioId },
      select: { escuelaId: true }
    });

    if (!horario) {
      return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });
    }

    // Borrar SOLO los mensajes del historial (el contador NO se toca)
    const resultado = await prisma.horarioChatMensaje.deleteMany({
      where: { horarioId }
    });

    return NextResponse.json({
      success: true,
      mensaje: `Historial limpiado: ${resultado.count} mensajes eliminados. El contador de uso se mantiene.`
    });
  } catch (error: any) {
    console.error("[api/horarios/chat] Error en DELETE:", error);
    return NextResponse.json({ error: "Error al limpiar el historial del chat" }, { status: 500 });
  }
}
