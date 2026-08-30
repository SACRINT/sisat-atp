import { reacomodarHorarioConRipple, CeldaHorario, GrupoLimiteInfo } from "./ripple-solver";

export interface MoverCeldaParams {
  asignatura?: string;
  grupoId?: string;
  docenteId?: string;
  diaOrigen?: number;
  periodoOrigen?: number;
  diaDestino: number;
  periodoDestino: number;
}

export interface IntercambiarParams {
  origen: { dia: number; periodo: number; grupoId?: string; docenteId?: string };
  destino: { dia: number; periodo: number; grupoId?: string; docenteId?: string };
}

export interface AgruparParams {
  asignatura: string;
  grupoId: string;
}

export interface BloquearLibreParams {
  docenteId?: string;
  grupoId?: string;
  dias?: number[];
  periodos?: { dia: number; periodo: number }[];
  intermedias?: boolean;
}

/**
 * Mueve quirúrgicamente una celda usando el motor Ripple (cascada con backtracking).
 */
export function moverCelda(
  celdas: CeldaHorario[],
  params: MoverCeldaParams,
  slotsLibresBloqueados: Set<string> = new Set(),
  gruposInfo?: GrupoLimiteInfo[],
  horasPorDia: number = 6
): { success: boolean; celdas: CeldaHorario[]; error?: string } {
  // Encontrar la celda objetivo
  const celdaTarget = celdas.find((c) => {
    if (params.diaOrigen && params.periodoOrigen) {
      const matchPos = c.diaSemana === params.diaOrigen && c.periodo === params.periodoOrigen;
      if (!matchPos) return false;
    }
    if (params.grupoId && c.grupoId !== params.grupoId) return false;
    if (params.docenteId && c.docenteId !== params.docenteId) return false;
    if (params.asignatura) {
      const uac = (c.asignaturaId || c.uacName || "").toLowerCase();
      if (!uac.includes(params.asignatura.toLowerCase())) return false;
    }
    return true;
  });

  if (!celdaTarget) {
    return { success: false, celdas, error: "No se encontró la clase especificada para mover." };
  }

  const res = reacomodarHorarioConRipple(
    celdas,
    celdaTarget,
    params.diaDestino,
    params.periodoDestino,
    horasPorDia,
    slotsLibresBloqueados,
    gruposInfo
  );

  if (!res.success || !res.celdasActualizadas) {
    return { success: false, celdas, error: res.error || "No fue posible reubicar la clase." };
  }

  return { success: true, celdas: res.celdasActualizadas };
}

/**
 * Intercambia dos posiciones entre sí de forma directa o mediante cascada.
 */
export function intercambiarCeldas(
  celdas: CeldaHorario[],
  params: IntercambiarParams,
  slotsLibresBloqueados: Set<string> = new Set(),
  gruposInfo?: GrupoLimiteInfo[],
  horasPorDia: number = 6
): { success: boolean; celdas: CeldaHorario[]; error?: string } {
  const c1 = celdas.find((c) => c.diaSemana === params.origen.dia && c.periodo === params.origen.periodo && (!params.origen.grupoId || c.grupoId === params.origen.grupoId));
  const c2 = celdas.find((c) => c.diaSemana === params.destino.dia && c.periodo === params.destino.periodo && (!params.destino.grupoId || c.grupoId === params.destino.grupoId));

  if (!c1 && !c2) {
    return { success: false, celdas, error: "Ambas posiciones están vacías." };
  }

  if (c1?.esBloqueado || c2?.esBloqueado) {
    return { success: false, celdas, error: "Una de las celdas está fijada con candado." };
  }

  if (c1 && !c2) {
    return moverCelda(celdas, { diaOrigen: c1.diaSemana, periodoOrigen: c1.periodo, grupoId: c1.grupoId, diaDestino: params.destino.dia, periodoDestino: params.destino.periodo }, slotsLibresBloqueados, gruposInfo, horasPorDia);
  }

  if (!c1 && c2) {
    return moverCelda(celdas, { diaOrigen: c2.diaSemana, periodoOrigen: c2.periodo, grupoId: c2.grupoId, diaDestino: params.origen.dia, periodoDestino: params.origen.periodo }, slotsLibresBloqueados, gruposInfo, horasPorDia);
  }

  // Intercambio de dos celdas existentes
  if (c1 && c2) {
    // Validar empalmes cruzados
    const empalmeC1enDestino = celdas.some((c) => c.id !== c1.id && c.id !== c2.id && c.diaSemana === params.destino.dia && c.periodo === params.destino.periodo && c.docenteId === c1.docenteId && c.grupoId !== c1.grupoId);
    const empalmeC2enOrigen = celdas.some((c) => c.id !== c1.id && c.id !== c2.id && c.diaSemana === params.origen.dia && c.periodo === params.origen.periodo && c.docenteId === c2.docenteId && c.grupoId !== c2.grupoId);

    if (empalmeC1enDestino || empalmeC2enOrigen) {
      return { success: false, celdas, error: "El intercambio genera un empalme de docente en otro grupo." };
    }

    const nuevas = celdas.map((c) => {
      if (c.id === c1.id) return { ...c, diaSemana: params.destino.dia, periodo: params.destino.periodo };
      if (c.id === c2.id) return { ...c, diaSemana: params.origen.dia, periodo: params.origen.periodo };
      return c;
    });

    return { success: true, celdas: nuevas };
  }

  return { success: true, celdas };
}

/**
 * Bloquea días u horas libres para un docente o grupo y reubica las clases existentes a otros días sin destruir el resto del horario.
 */
export function bloquearLibre(
  celdas: CeldaHorario[],
  params: BloquearLibreParams,
  slotsLibresBloqueados: Set<string> = new Set(),
  gruposInfo?: GrupoLimiteInfo[],
  horasPorDia: number = 6,
  diasLectivos: number = 5
): { success: boolean; celdas: CeldaHorario[]; slotsActualizados: Set<string>; error?: string } {
  const nuevosSlots = new Set(slotsLibresBloqueados);
  let celdasModificadas = [...celdas];

  if (params.docenteId) {
    const docId = params.docenteId;

    // Agregar candados a slots libres
    if (params.dias && params.dias.length > 0) {
      for (const d of params.dias) {
        for (let p = 1; p <= horasPorDia; p++) {
          nuevosSlots.add(`${d}_${p}_${docId}`);
        }
      }
    }

    if (params.periodos && params.periodos.length > 0) {
      for (const item of params.periodos) {
        nuevosSlots.add(`${item.dia}_${item.periodo}_${docId}`);
      }
    }

    // Identificar las celdas del docente que caen en las zonas bloqueadas
    const celdasAfectadas = celdasModificadas.filter((c) => {
      if (c.docenteId !== docId) return false;
      if (params.dias && params.dias.includes(c.diaSemana)) return true;
      if (params.periodos && params.periodos.some((p) => p.dia === c.diaSemana && p.periodo === c.periodo)) return true;
      return false;
    });

    // Reubicar cada celda afectada a un día/hora disponible usando el motor Ripple
    for (const celdaAfectada of celdasAfectadas) {
      let reubicada = false;

      // Buscar slots disponibles en días no bloqueados
      const diasPermitidos = Array.from({ length: diasLectivos }, (_, i) => i + 1).filter(
        (d) => !params.dias || !params.dias.includes(d)
      );

      for (const d of diasPermitidos) {
        for (let p = 1; p <= horasPorDia; p++) {
          if (nuevosSlots.has(`${d}_${p}_${docId}`)) continue;

          // Probar si el ripple puede colocarla aquí
          const intento = reacomodarHorarioConRipple(
            celdasModificadas,
            celdaAfectada,
            d,
            p,
            horasPorDia,
            nuevosSlots,
            gruposInfo
          );

          if (intento.success && intento.celdasActualizadas) {
            celdasModificadas = intento.celdasActualizadas;
            reubicada = true;
            break;
          }
        }
        if (reubicada) break;
      }

      if (!reubicada) {
        // Si no se pudo mover quirúrgicamente una por una, devolver fallo para que el asistente recurra al solver global
        return {
          success: false,
          celdas,
          slotsActualizados: slotsLibresBloqueados,
          error: "No se encontraron huecos libres para reubicar todas las clases del docente sin recurrir a una regeneración global."
        };
      }
    }
  }

  return { success: true, celdas: celdasModificadas, slotsActualizados: nuevosSlots };
}
