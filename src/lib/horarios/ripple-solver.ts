export interface CeldaHorario {
  id?: string;
  diaSemana: number; // 1..5
  periodo: number;   // 1..numHorasPorDia
  grupoId: string;
  docenteId: string;
  asignaturaId?: string;
  aulaId?: string;
  esBloqueado?: boolean;
  grupo?: any;
  docente?: any;
  asignatura?: any;
  aula?: any;
  [key: string]: any;
}

export interface GrupoLimiteInfo {
  id: string;
  semestre?: number;
  horasPorDia?: number;
  nombre?: string;
}

/**
 * Helper para verificar si un slot (día, periodo) está fijado como hora libre bloqueada
 * para el grupo, el docente o el aula.
 */
function isSlotLibreBloqueadoParaCelda(
  dia: number,
  periodo: number,
  celda: CeldaHorario,
  slotsLibresBloqueados: Set<string>
): boolean {
  if (!slotsLibresBloqueados || slotsLibresBloqueados.size === 0) return false;
  const keyGrp = `${dia}_${periodo}_${celda.grupoId}`;
  const keyDoc = `${dia}_${periodo}_${celda.docenteId}`;
  const keyAula = celda.aulaId ? `${dia}_${periodo}_${celda.aulaId}` : null;

  return (
    slotsLibresBloqueados.has(keyGrp) ||
    slotsLibresBloqueados.has(keyDoc) ||
    (keyAula !== null && slotsLibresBloqueados.has(keyAula))
  );
}

/**
 * Helper para obtener el número máximo de horas diarias de un grupo específico.
 * Por norma SEP Zona 004:
 * - 1.er semestre: máximo 5 horas al día (25 hrs/semana).
 * - 3.º y 5.º semestre: 6 horas al día (30 hrs/semana) o según horasPorDia.
 */
function getMaxPeriodosGrupo(
  grupoId: string,
  gruposInfo?: GrupoLimiteInfo[],
  celdasOriginales?: CeldaHorario[],
  fallbackHorasPorDia: number = 6
): number {
  if (gruposInfo && gruposInfo.length > 0) {
    const gInfo = gruposInfo.find((g) => g.id === grupoId);
    if (gInfo) {
      if (gInfo.horasPorDia) return gInfo.horasPorDia;
      if (gInfo.semestre === 1) return 5;
      if (gInfo.nombre && (gInfo.nombre.includes("1°") || gInfo.nombre.includes("1º"))) return 5;
      return fallbackHorasPorDia;
    }
  }

  // Si no está en gruposInfo, inspeccionar la celda
  if (celdasOriginales) {
    const c = celdasOriginales.find((item) => item.grupoId === grupoId);
    if (c?.grupo) {
      if (c.grupo.horasPorDia) return c.grupo.horasPorDia;
      if (c.grupo.semestre === 1) return 5;
      if (c.grupo.nombre && (c.grupo.nombre.includes("1°") || c.grupo.nombre.includes("1º"))) return 5;
    }
  }

  return fallbackHorasPorDia;
}

/**
 * Algoritmo de Reordenamiento Inteligente Ripple para Horarios.
 * 1. Valida límites de jornada diaria por grupo (e.g. 5 hrs para 1.er sem, 6 hrs para 3.º/5.º).
 * 2. Si el slot destino está ocupado por otra clase, intenta primero un INTERCAMBIO DIRECTO (Direct Swap).
 * 3. Si no es posible el intercambio directo, intenta un reacomodo en cascada (Ripple) respetando candados y horas libres.
 * 4. Si es imposible reacomodar sin generar empalmes, RECHAZA el movimiento con un aviso claro y NUNCA oculta asignaturas.
 */
export function reacomodarHorarioConRipple(
  celdasOriginales: CeldaHorario[],
  celdaAMover: CeldaHorario,
  targetDia: number,
  targetPeriodo: number,
  numHorasPorDia: number = 6,
  slotsLibresBloqueados: Set<string> = new Set(),
  gruposInfo?: GrupoLimiteInfo[]
): { success: boolean; celdasActualizadas?: CeldaHorario[]; numMovidas?: number; error?: string } {
  if (!celdaAMover) {
    return { success: false, error: "No se especificó la celda a mover." };
  }

  if (celdaAMover.esBloqueado) {
    return { success: false, error: "🔒 Esta celda está fijada con candado. Desbloquéela antes de moverla." };
  }

  const origDia = celdaAMover.diaSemana;
  const origPeriodo = celdaAMover.periodo;

  if (origDia === targetDia && origPeriodo === targetPeriodo) {
    return { success: true, celdasActualizadas: celdasOriginales, numMovidas: 0 };
  }

  // 1. Validar que el periodo destino no exceda la jornada del grupo de la celda a mover
  const maxPeriodosGrupoAMover = getMaxPeriodosGrupo(celdaAMover.grupoId, gruposInfo, celdasOriginales, numHorasPorDia);
  if (targetPeriodo > maxPeriodosGrupoAMover) {
    return {
      success: false,
      error: `⚠️ Este grupo tiene una jornada de ${maxPeriodosGrupoAMover} horas diarias. No se pueden colocar clases en la Hora ${targetPeriodo}.`
    };
  }

  // 2. Verificar si la casilla destino está fijada como hora libre bloqueada para el docente, grupo o aula
  if (isSlotLibreBloqueadoParaCelda(targetDia, targetPeriodo, celdaAMover, slotsLibresBloqueados)) {
    return { success: false, error: "🔒 La casilla destino está fijada como hora libre para este docente o grupo." };
  }

  // Clonar las celdas para trabajar de forma inmutable
  const celdasCopy: CeldaHorario[] = celdasOriginales.map((c) => ({ ...c }));

  // Encontrar el índice de la celda a mover
  const targetIndex = celdasCopy.findIndex(
    (c) =>
      (c.id && c.id === celdaAMover.id) ||
      (c.diaSemana === origDia &&
        c.periodo === origPeriodo &&
        c.grupoId === celdaAMover.grupoId &&
        c.docenteId === celdaAMover.docenteId)
  );

  if (targetIndex === -1) {
    return { success: false, error: "No se encontró la celda seleccionada en el horario." };
  }

  // 3. INTENTO DE INTERCAMBIO DIRECTO (DIRECT SWAP 1-A-1)
  // Si en la casilla destino del MISMO GRUPO hay otra clase, intentamos un swap limpio entre ambas clases
  const celdaEnDestinoMismoGrupoIdx = celdasCopy.findIndex(
    (c, idx) =>
      idx !== targetIndex &&
      c.diaSemana === targetDia &&
      c.periodo === targetPeriodo &&
      c.grupoId === celdaAMover.grupoId
  );

  if (celdaEnDestinoMismoGrupoIdx !== -1) {
    const celdaDestino = celdasCopy[celdaEnDestinoMismoGrupoIdx];

    // Si la celda destino está bloqueada con candado, no se puede hacer swap directo
    if (!celdaDestino.esBloqueado) {
      // Verificar si la celda destino puede moverse a (origDia, origPeriodo)
      const maxPDest = getMaxPeriodosGrupo(celdaDestino.grupoId, gruposInfo, celdasOriginales, numHorasPorDia);
      const cabeEnOrigen = origPeriodo <= maxPDest;
      const libreEnOrigen = !isSlotLibreBloqueadoParaCelda(origDia, origPeriodo, celdaDestino, slotsLibresBloqueados);

      // Verificar si el docente de celdaAMover está ocupado en (targetDia, targetPeriodo) con OTRO grupo
      const docenteAMoverOcupadoEnTarget = celdasCopy.some(
        (c, idx) =>
          idx !== targetIndex &&
          idx !== celdaEnDestinoMismoGrupoIdx &&
          c.docenteId === celdaAMover.docenteId &&
          c.diaSemana === targetDia &&
          c.periodo === targetPeriodo
      );

      // Verificar si el docente de celdaDestino está ocupado en (origDia, origPeriodo) con OTRO grupo
      const docenteDestOcupadoEnOrigen = celdasCopy.some(
        (c, idx) =>
          idx !== targetIndex &&
          idx !== celdaEnDestinoMismoGrupoIdx &&
          c.docenteId === celdaDestino.docenteId &&
          c.diaSemana === origDia &&
          c.periodo === origPeriodo
      );

      if (cabeEnOrigen && libreEnOrigen && !docenteAMoverOcupadoEnTarget && !docenteDestOcupadoEnOrigen) {
        // ¡Intercambio directo 100% válido y limpio!
        celdasCopy[targetIndex].diaSemana = targetDia;
        celdasCopy[targetIndex].periodo = targetPeriodo;
        celdasCopy[celdaEnDestinoMismoGrupoIdx].diaSemana = origDia;
        celdasCopy[celdaEnDestinoMismoGrupoIdx].periodo = origPeriodo;

        return {
          success: true,
          celdasActualizadas: celdasCopy,
          numMovidas: 2
        };
      }
    }
  }

  // 4. INTENTO DE MOVIMIENTO DIRECTO A CASILLA VACÍA
  // Si la casilla destino no tiene ninguna clase asignada en el grupo y el docente está libre
  const casillaDestinoOcupadaEnGrupo = celdasCopy.some(
    (c, idx) => idx !== targetIndex && c.grupoId === celdaAMover.grupoId && c.diaSemana === targetDia && c.periodo === targetPeriodo
  );
  const docenteOcupadoEnDestino = celdasCopy.some(
    (c, idx) => idx !== targetIndex && c.docenteId === celdaAMover.docenteId && c.diaSemana === targetDia && c.periodo === targetPeriodo
  );

  if (!casillaDestinoOcupadaEnGrupo && !docenteOcupadoEnDestino) {
    celdasCopy[targetIndex].diaSemana = targetDia;
    celdasCopy[targetIndex].periodo = targetPeriodo;
    return {
      success: true,
      celdasActualizadas: celdasCopy,
      numMovidas: 1
    };
  }

  // 5. MOTOR DE REUBICACIÓN EN CASCADA (RIPPLE CON BACKTRACKING CONTROLADO)
  // Fijar temporalmente la celda seleccionada en las coordenadas destino
  celdasCopy[targetIndex].diaSemana = targetDia;
  celdasCopy[targetIndex].periodo = targetPeriodo;

  // Identificar celdas fijas (las que tienen esBloqueado === true MÁS la celda recién movida)
  const isFixed = (idx: number) => idx === targetIndex || Boolean(celdasCopy[idx].esBloqueado);

  // Verificar que las celdas fijas no colisionen entre sí
  for (let i = 0; i < celdasCopy.length; i++) {
    if (!isFixed(i)) continue;
    const c1 = celdasCopy[i];

    if (isSlotLibreBloqueadoParaCelda(c1.diaSemana, c1.periodo, c1, slotsLibresBloqueados)) {
      return { success: false, error: "🔒 El movimiento colisiona con una hora libre bloqueada para el docente o grupo." };
    }

    for (let j = i + 1; j < celdasCopy.length; j++) {
      if (!isFixed(j)) continue;
      const c2 = celdasCopy[j];

      if (c1.diaSemana === c2.diaSemana && c1.periodo === c2.periodo) {
        if (c1.grupoId === c2.grupoId) {
          return { success: false, error: "🔒 Casilla ocupada por una clase fijada con candado en este grupo." };
        }
        if (c1.docenteId === c2.docenteId) {
          const docNombre = c1.docente?.nombre || "el docente";
          return { success: false, error: `🔒 El docente ${docNombre} tiene otra clase fijada con candado en esta hora.` };
        }
      }
    }
  }

  // Extraer los índices de las celdas no fijas que requieren reubicación
  const unfixedIndices: number[] = [];
  for (let i = 0; i < celdasCopy.length; i++) {
    if (!isFixed(i)) {
      unfixedIndices.push(i);
    }
  }

  if (unfixedIndices.length === 0) {
    return { success: true, celdasActualizadas: celdasCopy, numMovidas: 1 };
  }

  // Priorizar las celdas directamente afectadas por la colisión en destino o del mismo grupo/docente
  unfixedIndices.sort((a, b) => {
    const ca = celdasCopy[a];
    const cb = celdasCopy[b];

    const scoreA =
      (ca.grupoId === celdaAMover.grupoId ? 10 : 0) +
      (ca.docenteId === celdaAMover.docenteId ? 10 : 0) +
      (ca.diaSemana === targetDia && ca.periodo === targetPeriodo ? 25 : 0);

    const scoreB =
      (cb.grupoId === celdaAMover.grupoId ? 10 : 0) +
      (cb.docenteId === celdaAMover.docenteId ? 10 : 0) +
      (cb.diaSemana === targetDia && cb.periodo === targetPeriodo ? 25 : 0);

    return scoreB - scoreA;
  });

  // Generador de slots candidatos respetando estrictamente el límite de horas diarias de CADA grupo
  const obtenerSlotsOrdenadosParaCelda = (celda: CeldaHorario) => {
    const maxP = getMaxPeriodosGrupo(celda.grupoId, gruposInfo, celdasOriginales, numHorasPorDia);
    const slots: { dia: number; periodo: number }[] = [];

    for (let d = 1; d <= 5; d++) {
      for (let p = 1; p <= maxP; p++) {
        slots.push({ dia: d, periodo: p });
      }
    }

    return slots.sort((s1, s2) => {
      // Priorizar la posición donde estaba originalmente la celda
      if (s1.dia === celda.diaSemana && s1.periodo === celda.periodo) return -1;
      if (s2.dia === celda.diaSemana && s2.periodo === celda.periodo) return 1;

      // Priorizar el slot que dejó libre la celda arrastrada
      if (s1.dia === origDia && s1.periodo === origPeriodo) return -1;
      if (s2.dia === origDia && s2.periodo === origPeriodo) return 1;

      return 0;
    });
  };

  // Matriz de ocupación en O(1)
  const ocupadoGrupo = new Set<string>();
  const ocupadoDocente = new Set<string>();
  const ocupadoAula = new Set<string>();

  for (let i = 0; i < celdasCopy.length; i++) {
    if (isFixed(i)) {
      const c = celdasCopy[i];
      ocupadoGrupo.add(`${c.diaSemana}_${c.periodo}_${c.grupoId}`);
      ocupadoDocente.add(`${c.diaSemana}_${c.periodo}_${c.docenteId}`);
      if (c.aulaId) ocupadoAula.add(`${c.diaSemana}_${c.periodo}_${c.aulaId}`);
    }
  }

  let maxNodos = 40000;
  let nodosVisitados = 0;

  function resolverBacktracking(uIdx: number): boolean {
    if (uIdx >= unfixedIndices.length) {
      return true; // ¡Todas las celdas se asignaron respetando los límites!
    }

    nodosVisitados++;
    if (nodosVisitados > maxNodos) {
      return false;
    }

    const celdaIndex = unfixedIndices[uIdx];
    const celda = celdasCopy[celdaIndex];
    const candidateSlots = obtenerSlotsOrdenadosParaCelda(celda);

    for (const slot of candidateSlots) {
      const d = slot.dia;
      const p = slot.periodo;

      const keyGrp = `${d}_${p}_${celda.grupoId}`;
      const keyDoc = `${d}_${p}_${celda.docenteId}`;
      const keyAula = celda.aulaId ? `${d}_${p}_${celda.aulaId}` : null;

      if (isSlotLibreBloqueadoParaCelda(d, p, celda, slotsLibresBloqueados)) continue;
      if (ocupadoGrupo.has(keyGrp)) continue;
      if (ocupadoDocente.has(keyDoc)) continue;
      if (keyAula && ocupadoAula.has(keyAula)) continue;

      celdasCopy[celdaIndex].diaSemana = d;
      celdasCopy[celdaIndex].periodo = p;
      ocupadoGrupo.add(keyGrp);
      ocupadoDocente.add(keyDoc);
      if (keyAula) ocupadoAula.add(keyAula);

      if (resolverBacktracking(uIdx + 1)) {
        return true;
      }

      ocupadoGrupo.delete(keyGrp);
      ocupadoDocente.delete(keyDoc);
      if (keyAula) ocupadoAula.delete(keyAula);
    }

    return false;
  }

  const exito = resolverBacktracking(0);

  if (!exito) {
    // Construir mensaje de error explicativo para el usuario
    const docConflictivo = celdaAMover.docente?.nombre || "el docente";
    return {
      success: false,
      error: `⚠️ No es posible mover esta clase: generaría una colisión con el horario del docente ${docConflictivo} o con horas bloqueadas que no se pueden reubicar en los periodos lectivos permitidos.`
    };
  }

  // Contar cuántas celdas cambiaron de posición
  let numMovidas = 0;
  for (let i = 0; i < celdasOriginales.length; i++) {
    const orig = celdasOriginales[i];
    const act = celdasCopy.find(
      (c) =>
        (c.id && c.id === orig.id) ||
        (c.grupoId === orig.grupoId && c.docenteId === orig.docenteId && c.asignaturaId === orig.asignaturaId)
    );

    if (act && (act.diaSemana !== orig.diaSemana || act.periodo !== orig.periodo)) {
      numMovidas++;
    }
  }

  return {
    success: true,
    celdasActualizadas: celdasCopy,
    numMovidas: Math.max(numMovidas, 1)
  };
}
