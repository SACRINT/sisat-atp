import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
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
      if (reqEscuelaId && reqEscuelaId !== escuelaId) {
        return NextResponse.json({ error: "Acceso denegado a otra escuela" }, { status: 403 });
      }
    }

    if (!escuelaId) {
      return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });
    }

    // Configuración de la escuela
    let config = await prisma.horarioConfiguracion.findUnique({
      where: { escuelaId }
    });

    if (!config) {
      config = await prisma.horarioConfiguracion.create({
        data: {
          escuelaId,
          diasLectivos: 5,
          horasPorDia: 6,
          horaInicio: "08:00",
          duracionMinutos: 50,
          recesoTrasPeriodo: 3,
          duracionReceso: 20
        }
      });
    }

    // Grupos
    const grupos = await prisma.horarioGrupo.findMany({
      where: { escuelaId },
      orderBy: { nombre: "asc" }
    });

    // Aulas
    const aulas = await prisma.horarioAula.findMany({
      where: { escuelaId },
      orderBy: { nombre: "asc" }
    });

    // Todo el personal de la escuela (Docentes, Responsables, Administrativos, Apoyo)
    const docentes = await prisma.personal.findMany({
      where: { escuelaId },
      orderBy: [{ apellidoPaterno: "asc" }, { nombre: "asc" }]
    });

    // Cargas docentes asignadas
    const cargas = await prisma.horarioCargaDocente.findMany({
      where: { escuelaId },
      include: {
        personal: true,
        grupo: true,
        asignatura: true
      }
    });

    // Cargar último horario generado si existe
    const ultimoHorario = await prisma.horarioGenerado.findFirst({
      where: { escuelaId },
      orderBy: { createdAt: "desc" },
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

    const escuela = await prisma.escuela.findUnique({
      where: { id: escuelaId },
      select: { id: true, cct: true, nombre: true, gruposPrimerAno: true, gruposSegundoAno: true, gruposTercerAno: true, mapaCurricularCompletado: true }
    });

    return NextResponse.json({
      escuela,
      config,
      grupos,
      aulas,
      docentes,
      cargas,
      horario: ultimoHorario
    });
  } catch (error: any) {
    console.error("[api/horarios/configuracion] Error en GET:", error);
    return NextResponse.json({ error: "Error al cargar configuración de horario" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await req.json();
    const { escuelaId: reqEscuelaId, config, grupos, aulas, cargas } = body;

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

    // 1. Guardar Configuración General
    if (config) {
      await prisma.horarioConfiguracion.upsert({
        where: { escuelaId },
        update: {
          diasLectivos: Number(config.diasLectivos) || 5,
          horasPorDia: Number(config.horasPorDia) || 6,
          horaInicio: config.horaInicio || "08:00",
          duracionMinutos: Number(config.duracionMinutos) || 50,
          recesoTrasPeriodo: Number(config.recesoTrasPeriodo) || 3,
          duracionReceso: Number(config.duracionReceso) || 20
        },
        create: {
          escuelaId,
          diasLectivos: Number(config.diasLectivos) || 5,
          horasPorDia: Number(config.horasPorDia) || 6,
          horaInicio: config.horaInicio || "08:00",
          duracionMinutos: Number(config.duracionMinutos) || 50,
          recesoTrasPeriodo: Number(config.recesoTrasPeriodo) || 3,
          duracionReceso: Number(config.duracionReceso) || 20
        }
      });
    }

    // Mapa para asociar IDs temporales o nombres con IDs reales de DB
    const mapaGrupoIds: Record<string, string> = {};

    // Sanitizar FFEO para evitar duplicados estrictos entre 3° y 5°
    if (Array.isArray(grupos)) {
      const FORMACIONES_SOCIOEMOCIONALES = [
        "Educación para la Salud",
        "Educación Integral en Sexualidad y Género",
        "Práctica y Colaboración Ciudadana"
      ];
      const letras = Array.from(new Set(grupos.map((g: any) => (g.nombre || "").split(" ")[1]).filter(Boolean)));
      for (const letra of letras) {
        const g3 = grupos.find((g: any) => Number(g.semestre) === 3 && (g.nombre || "").trim().endsWith(letra));
        const g5 = grupos.find((g: any) => Number(g.semestre) === 5 && (g.nombre || "").trim().endsWith(letra));
        if (g3 && g5) {
          const s3 = g3.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[0];
          let s5 = g5.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[1];
          if (s5 === s3) {
            s5 = FORMACIONES_SOCIOEMOCIONALES.find(s => s !== s3) || FORMACIONES_SOCIOEMOCIONALES[1];
          }
          g3.ffeoSocioemocional = s3;
          g5.ffeoSocioemocional = s5;

          const restante = FORMACIONES_SOCIOEMOCIONALES.find(s => s !== s3 && s !== s5) || FORMACIONES_SOCIOEMOCIONALES[2];
          const g4 = grupos.find((g: any) => Number(g.semestre) === 4 && (g.nombre || "").trim().endsWith(letra));
          const g6 = grupos.find((g: any) => Number(g.semestre) === 6 && (g.nombre || "").trim().endsWith(letra));
          if (g4) g4.ffeoSocioemocional = restante;
          if (g6) g6.ffeoSocioemocional = restante;
        }
      }
    }

    // 2. Guardar/Sincronizar Grupos usando la restricción única (escuelaId, nombre)
    if (Array.isArray(grupos)) {
      for (const g of grupos) {
        const grupoDB = await prisma.horarioGrupo.upsert({
          where: {
            escuelaId_nombre: {
              escuelaId,
              nombre: g.nombre
            }
          },
          update: {
            semestre: Number(g.semestre),
            capacitacionNombre: g.capacitacionNombre || null,
            ffeOptativas: g.ffeOptativas || null,
            ffeoSocioemocional: g.ffeoSocioemocional || null
          },
          create: {
            escuelaId,
            nombre: g.nombre,
            semestre: Number(g.semestre),
            capacitacionNombre: g.capacitacionNombre || null,
            ffeOptativas: g.ffeOptativas || null,
            ffeoSocioemocional: g.ffeoSocioemocional || null
          }
        });

        if (g.id) mapaGrupoIds[g.id] = grupoDB.id;
        mapaGrupoIds[g.nombre] = grupoDB.id;
      }
    }

    // 3. Guardar/Sincronizar Aulas
    if (Array.isArray(aulas)) {
      for (const a of aulas) {
        if (a.id && !a.id.startsWith("temp_")) {
          await prisma.horarioAula.upsert({
            where: { id: a.id },
            update: { nombre: a.nombre, tipo: a.tipo || "REGULAR" },
            create: { escuelaId, nombre: a.nombre, tipo: a.tipo || "REGULAR" }
          });
        } else {
          await prisma.horarioAula.create({
            data: { escuelaId, nombre: a.nombre, tipo: a.tipo || "REGULAR" }
          });
        }
      }
    }

    // 4. Guardar Cargas Docentes
    if (Array.isArray(cargas)) {
      // Limpiar cargas anteriores de esta escuela para recrear la estructura limpia
      await prisma.horarioCargaDocente.deleteMany({
        where: { escuelaId }
      });

      // También limpiar horarios generados previos (quedan obsoletos con nueva configuración)
      const horariosViejos = await prisma.horarioGenerado.findMany({
        where: { escuelaId },
        select: { id: true }
      });
      for (const h of horariosViejos) {
        await prisma.horarioCelda.deleteMany({ where: { horarioId: h.id } });
      }
      await prisma.horarioGenerado.deleteMany({ where: { escuelaId } });

      for (const c of cargas) {
        if (c.personalId && c.grupoId) {
          const grupoRealId = mapaGrupoIds[c.grupoId] || c.grupoId;

          const grupoExiste = await prisma.horarioGrupo.findUnique({
            where: { id: grupoRealId }
          });

          if (!grupoExiste) {
            console.warn(`[api/horarios/configuracion] Grupo ID ${grupoRealId} no existe, omitiendo.`);
            continue;
          }

          const semestreGrupo = grupoExiste.semestre;
          const uacNombreBusqueda = c.uacName || c.asignaturaNombre || "Asignatura UAC";
          const horasSemanalesCarga = Number(c.horasSemanales) || 3;

          // Buscar asignatura por nombre Y semestre para evitar confundir materias del mismo nombre en distinto semestre
          let asignaturaDB = await prisma.horarioAsignaturaCatalogo.findFirst({
            where: {
              uacName: { equals: uacNombreBusqueda, mode: "insensitive" },
              semester: semestreGrupo
            }
          });

          if (!asignaturaDB) {
            asignaturaDB = await prisma.horarioAsignaturaCatalogo.create({
              data: {
                escuelaId: null,
                uacName: uacNombreBusqueda,
                semester: semestreGrupo,
                component: c.tipo || "fundamental",
                horasSemanales: horasSemanalesCarga
              }
            });
          }

          console.log(`[configuracion] Creando carga: docente=${c.personalId} grupo=${grupoRealId}(${grupoExiste.nombre}) uac=${uacNombreBusqueda} horas=${horasSemanalesCarga}`);

          await prisma.horarioCargaDocente.create({
            data: {
              escuelaId,
              personalId: c.personalId,
              grupoId: grupoRealId,
              asignaturaId: asignaturaDB.id,
              horasSemanales: horasSemanalesCarga,
              requiereAulaEspecial: !!c.requiereAulaEspecial,
              aulaEspecialId: c.aulaEspecialId || null
            }
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: "Configuración guardada correctamente" });
  } catch (error: any) {
    console.error("[api/horarios/configuracion] Error en POST:", error);
    return NextResponse.json({ error: "Error al guardar configuración de horario" }, { status: 500 });
  }
}

// DELETE: Limpiar todos los datos de horarios de la escuela (cargas + horarios generados)
// Esto permite al director empezar de cero sin datos fantasma de configuraciones anteriores
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
      if (reqEscuelaId && reqEscuelaId !== escuelaId) {
        return NextResponse.json({ error: "Acceso denegado a otra escuela" }, { status: 403 });
      }
    }

    if (!escuelaId) {
      return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });
    }

    // 1. Eliminar celdas de horarios generados (por cascade deben borrarse, pero por si acaso)
    const horariosExistentes = await prisma.horarioGenerado.findMany({
      where: { escuelaId },
      select: { id: true }
    });
    for (const h of horariosExistentes) {
      await prisma.horarioCelda.deleteMany({ where: { horarioId: h.id } });
    }

    // 2. Eliminar horarios generados
    await prisma.horarioGenerado.deleteMany({ where: { escuelaId } });

    // 3. Eliminar cargas docentes (datos fantasma)
    const cargasEliminadas = await prisma.horarioCargaDocente.deleteMany({ where: { escuelaId } });

    console.log(`[DELETE /api/horarios/configuracion] Limpieza escuela=${escuelaId}: ${horariosExistentes.length} horarios + ${cargasEliminadas.count} cargas eliminadas`);

    return NextResponse.json({
      success: true,
      message: `Datos de horario limpiados: ${horariosExistentes.length} horario(s) y ${cargasEliminadas.count} carga(s) eliminada(s)`
    });
  } catch (error: any) {
    console.error("[api/horarios/configuracion] Error en DELETE:", error);
    return NextResponse.json({ error: "Error al limpiar datos de horario" }, { status: 500 });
  }
}
