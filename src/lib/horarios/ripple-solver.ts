/**
 * Motor de Reordenamiento Inteligente para Horarios Escolares.
 *
 * Estrategia de resolución con 3 niveles:
 *   Nivel 1 — Movimiento directo a slot vacío (1 celda).
 *   Nivel 2 — Intercambio directo entre 2 celdas (swap 1-a-1).
 *   Nivel 3 — Reacomodo en cascada con backtracking (máx 5 saltos).
 *
 * Reglas duras (las ÚNICAS que bloquean un movimiento):
 *   1. Celda con candado (esBloqueado) → inmovible.
 *   2. Slot destino dentro de slotsLibresBloqueados → prohibido.
 *   3. Jornada del grupo excedida → prohibido.
 *   4. Empalme real entre docentes DISTINTOS → rechazado o resuelto por cascada.
 *
 * Intercambios entre el MISMO docente o del MISMO grupo → SIEMPRE permitidos.
 */

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

// ─── Helpers ────────────────────────────────────────────────────────────────

function normId(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object" && val.id) return String(val.id).trim();
  return String(val).trim();
}

function getMaxPeriodosGrupo(
  grupoId: string,
  gruposInfo?: GrupoLimiteInfo[],
  celdasOriginales?: CeldaHorario[],
  fallback: number = 6
): number {
  const gid = normId(grupoId);
  if (gruposInfo) {
    const g = gruposInfo.find((x) => normId(x.id) === gid);
    if (g) {
      if (g.horasPorDia) return g.horasPorDia;
      if (g.semestre === 1) return 5;
      return fallback;
    }
  }
  if (celdasOriginales) {
    const c = celdasOriginales.find((x) => normId(x.grupoId) === gid);
    if (c?.grupo) {
      if (c.grupo.horasPorDia) return c.grupo.horasPorDia;
      if (c.grupo.semestre === 1) return 5;
    }
  }
  return fallback;
}

function isSlotBloqueado(
  dia: number,
  periodo: number,
  celda: CeldaHorario,
  slotsLibresBloqueados: Set<string>
): boolean {
  if (!slotsLibresBloqueados || slotsLibresBloqueados.size === 0) return false;
  const kGrp = `${dia}_${periodo}_${normId(celda.grupoId)}`;
  const kDoc = `${dia}_${periodo}_${normId(celda.docenteId)}`;
  return slotsLibresBloqueados.has(kGrp) || slotsLibresBloqueados.has(kDoc);
}

/** Verifica si un docente tiene clase en (dia, periodo) con cualquier grupo excepto el dado. */
function docenteOcupadoEn(
  celdas: CeldaHorario[],
  docenteId: string,
  dia: number,
  periodo: number,
  excluirGrupoId: string,
  excluirIdx: number = -1
): boolean {
  const did = normId(docenteId);
  const gid = normId(excluirGrupoId);
  return celdas.some(
    (c, i) =>
      i !== excluirIdx &&
      normId(c.docenteId) === did &&
      c.diaSemana === dia &&
      c.periodo === periodo &&
      normId(c.grupoId) !== gid
  );
}

/** Verifica si un grupo tiene clase en (dia, periodo). */
function grupoOcupadoEn(
  celdas: CeldaHorario[],
  grupoId: string,
  dia: number,
  periodo: number,
  excluirIdx: number = -1
): boolean {
  const gid = normId(grupoId);
  return celdas.some(
    (c, i) =>
      i !== excluirIdx &&
      normId(c.grupoId) === gid &&
      c.diaSemana === dia &&
      c.periodo === periodo
  );
}

// ─── Resultado ──────────────────────────────────────────────────────────────

export interface RippleResult {
  success: boolean;
  celdasActualizadas?: CeldaHorario[];
  numMovidas?: number;
  error?: string;
}

// ─── Función Principal ──────────────────────────────────────────────────────

export function reacomodarHorarioConRipple(
  celdasOriginales: CeldaHorario[],
  celdaAMover: CeldaHorario,
  targetDia: number,
  targetPeriodo: number,
  numHorasPorDia: number = 6,
  slotsLibresBloqueados: Set<string> = new Set(),
  gruposInfo?: GrupoLimiteInfo[]
): RippleResult {
  if (!celdaAMover) {
    return { success: false, error: "No se especificó la celda a mover." };
  }

  if (celdaAMover.esBloqueado) {
    return { success: false, error: "🔒 Esta celda está fijada con candado. Desbloquéela antes de moverla." };
  }

  const origDia = celdaAMover.diaSemana;
  const origPeriodo = celdaAMover.periodo;

  // Misma posición → no-op
  if (origDia === targetDia && origPeriodo === targetPeriodo) {
    return { success: true, celdasActualizadas: celdasOriginales, numMovidas: 0 };
  }

  // ── Validación de jornada ──
  const maxPeriodos = getMaxPeriodosGrupo(celdaAMover.grupoId, gruposInfo, celdasOriginales, numHorasPorDia);
  if (targetPeriodo > maxPeriodos) {
    return {
      success: false,
      error: `⚠️ Este grupo tiene jornada de ${maxPeriodos} horas. No se puede colocar en la Hora ${targetPeriodo}.`
    };
  }

  // ── Validación de hora libre bloqueada ──
  if (isSlotBloqueado(targetDia, targetPeriodo, celdaAMover, slotsLibresBloqueados)) {
    return { success: false, error: "🔒 La casilla destino está fijada como hora libre para este docente o grupo." };
  }

  // Clonar para trabajo inmutable
  const cells: CeldaHorario[] = celdasOriginales.map((c) => ({ ...c }));

  // Encontrar índice de la celda a mover
  const srcIdx = cells.findIndex(
    (c) =>
      (c.id && celdaAMover.id && c.id === celdaAMover.id) ||
      (c.diaSemana === origDia &&
        c.periodo === origPeriodo &&
        normId(c.grupoId) === normId(celdaAMover.grupoId) &&
        normId(c.docenteId) === normId(celdaAMover.docenteId))
  );

  if (srcIdx === -1) {
    return { success: false, error: "No se encontró la celda seleccionada en el horario." };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NIVEL 1 — Slot destino VACÍO para el grupo → movimiento directo
  // ══════════════════════════════════════════════════════════════════════════
  const destinoLibreGrupo = !cells.some(
    (c, i) => i !== srcIdx && normId(c.grupoId) === normId(celdaAMover.grupoId) && c.diaSemana === targetDia && c.periodo === targetPeriodo
  );

  if (destinoLibreGrupo) {
    // Verificar que el docente no esté ocupado con OTRO grupo en el destino
    if (!docenteOcupadoEn(cells, celdaAMover.docenteId, targetDia, targetPeriodo, celdaAMover.grupoId, srcIdx)) {
      cells[srcIdx] = { ...cells[srcIdx], diaSemana: targetDia, periodo: targetPeriodo };
      return { success: true, celdasActualizadas: cells, numMovidas: 1 };
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NIVEL 2 — Intercambio directo 1-a-1 (MISMO grupo o MISMO docente)
  // ══════════════════════════════════════════════════════════════════════════
  const dstIdx = cells.findIndex(
    (c, i) =>
      i !== srcIdx &&
      c.diaSemana === targetDia &&
      c.periodo === targetPeriodo &&
      normId(c.grupoId) === normId(celdaAMover.grupoId)
  );

  if (dstIdx !== -1 && !cells[dstIdx].esBloqueado) {
    const mismoGrupo = true; // ya filtrado arriba
    const mismoDocente = normId(cells[dstIdx].docenteId) === normId(celdaAMover.docenteId);

    if (mismoGrupo || mismoDocente) {
      // Verificar que el swap no cree empalme con terceros
      const srcDoc = normId(celdaAMover.docenteId);
      const dstDoc = normId(cells[dstIdx].docenteId);

      const srcEnTargetOcupado = cells.some(
        (c, i) => i !== srcIdx && i !== dstIdx && normId(c.docenteId) === srcDoc && c.diaSemana === targetDia && c.periodo === targetPeriodo
      );
      const dstEnOrigenOcupado = cells.some(
        (c, i) => i !== srcIdx && i !== dstIdx && normId(c.docenteId) === dstDoc && c.diaSemana === origDia && c.periodo === origPeriodo
      );

      // Verificar bloqueos
      const srcBloqueadoEnTarget = isSlotBloqueado(targetDia, targetPeriodo, cells[dstIdx], slotsLibresBloqueados);
      const dstBloqueadoEnOrigen = isSlotBloqueado(origDia, origPeriodo, celdaAMover, slotsLibresBloqueados);

      if (!srcEnTargetOcupado && !dstEnOrigenOcupado && !srcBloqueadoEnTarget && !dstBloqueadoEnOrigen) {
        // Swap directo limpio
        const tmpD = cells[srcIdx].diaSemana;
        const tmpP = cells[srcIdx].periodo;
        cells[srcIdx] = { ...cells[srcIdx], diaSemana: cells[dstIdx].diaSemana, periodo: cells[dstIdx].periodo };
        cells[dstIdx] = { ...cells[dstIdx], diaSemana: tmpD, periodo: tmpP };
        return { success: true, celdasActualizadas: cells, numMovidas: 2 };
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NIVEL 2b — Swap con celda de OTRO grupo (docente Distinto)
  // ══════════════════════════════════════════════════════════════════════════
  if (dstIdx !== -1 && !cells[dstIdx].esBloqueado) {
    const srcDoc = normId(celdaAMover.docenteId);
    const dstDoc = normId(cells[dstIdx].docenteId);
    const srcGrp = normId(celdaAMover.grupoId);
    const dstGrp = normId(cells[dstIdx].grupoId);

    // ¿El docente origen puede ir al slot destino? (no tiene otra clase ahí con otro grupo)
    const srcConflictTarget = cells.some(
      (c, i) => i !== srcIdx && i !== dstIdx && normId(c.docenteId) === srcDoc && c.diaSemana === targetDia && c.periodo === targetPeriodo
    );
    // ¿El docente destino puede ir al slot origen? (no tiene otra clase ahí con otro grupo)
    const dstConflictOrigin = cells.some(
      (c, i) => i !== srcIdx && i !== dstIdx && normId(c.docenteId) === dstDoc && c.diaSemana === origDia && c.periodo === origPeriodo
    );
    // ¿Hay bloqueos?
    const srcBloq = isSlotBloqueado(targetDia, targetPeriodo, cells[dstIdx], slotsLibresBloqueados);
    const dstBloq = isSlotBloqueado(origDia, origPeriodo, celdaAMover, slotsLibresBloqueados);
    // ¿El docente destino cabe en la jornada del grupo origen?
    const dstMaxP = getMaxPeriodosGrupo(celdaAMover.grupoId, gruposInfo, celdasOriginales, numHorasPorDia);
    const dstCabeEnOrigen = origPeriodo <= dstMaxP;

    if (!srcConflictTarget && !dstConflictOrigin && !srcBloq && !dstBloq && dstCabeEnOrigen) {
      const tmpD = cells[srcIdx].diaSemana;
      const tmpP = cells[srcIdx].periodo;
      cells[srcIdx] = { ...cells[srcIdx], diaSemana: targetDia, periodo: targetPeriodo };
      cells[dstIdx] = { ...cells[dstIdx], diaSemana: tmpD, periodo: tmpP };
      return { success: true, celdasActualizadas: cells, numMovidas: 2 };
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NIVEL 3 — Reacomodo en cascada (backtracking controlado, máx 5 saltos)
  // ══════════════════════════════════════════════════════════════════════════
  return resolverCascada(cells, srcIdx, targetDia, targetPeriodo, origDia, origPeriodo, numHorasPorDia, slotsLibresBloqueados, gruposInfo);
}

// ─── Cascada con Backtracking ───────────────────────────────────────────────

function resolverCascada(
  cells: CeldaHorario[],
  srcIdx: number,
  targetDia: number,
  targetPeriodo: number,
  origDia: number,
  origPeriodo: number,
  numHorasPorDia: number,
  slotsLibresBloqueados: Set<string>,
  gruposInfo?: GrupoLimiteInfo[],
  maxDepth: number = 8
): RippleResult {
  const work = cells.map((c) => ({ ...c }));
  const srcDoc = normId(work[srcIdx].docenteId);
  const srcGrp = normId(work[srcIdx].grupoId);

  // Marcar celdas fijadas (candado + la que estamos moviendo)
  const fixed = new Set<number>();
  fixed.add(srcIdx);
  for (let i = 0; i < work.length; i++) {
    if (work[i].esBloqueado) fixed.add(i);
  }

  // Colocar la celda fuente en el destino temporalmente
  work[srcIdx] = { ...work[srcIdx], diaSemana: targetDia, periodo: targetPeriodo };

  // Verificar que las celdas fijas no colisionen entre sí
  const fixedArr = Array.from(fixed);
  for (let a = 0; a < fixedArr.length; a++) {
    for (let b = a + 1; b < fixedArr.length; b++) {
      const c1 = work[fixedArr[a]];
      const c2 = work[fixedArr[b]];
      if (c1.diaSemana === c2.diaSemana && c1.periodo === c2.periodo) {
        if (normId(c1.grupoId) === normId(c2.grupoId)) {
          return { success: false, error: "🔒 Casilla ocupada por una clase fijada con candado en este grupo." };
        }
        if (normId(c1.docenteId) === normId(c2.docenteId)) {
          return { success: false, error: `🔒 El docente tiene otra clase fijada con candado en esta hora.` };
        }
      }
    }
  }

  // Índices de celdas no fijas que necesitan reubicación
  const unfixed: number[] = [];
  for (let i = 0; i < work.length; i++) {
    if (!fixed.has(i)) unfixed.push(i);
  }

  if (unfixed.length === 0) {
    return { success: true, celdasActualizadas: work, numMovidas: 1 };
  }

  // Priorizar celdas del mismo grupo o mismo docente
  unfixed.sort((a, b) => {
    const ca = work[a];
    const cb = work[b];
    const scoreA =
      (normId(ca.grupoId) === srcGrp ? 10 : 0) +
      (normId(ca.docenteId) === srcDoc ? 10 : 0) +
      (ca.diaSemana === targetDia && ca.periodo === targetPeriodo ? 25 : 0);
    const scoreB =
      (normId(cb.grupoId) === srcGrp ? 10 : 0) +
      (normId(cb.docenteId) === srcDoc ? 10 : 0) +
      (cb.diaSemana === targetDia && cb.periodo === targetPeriodo ? 25 : 0);
    return scoreB - scoreA;
  });

  // Matrices de ocupación O(1)
  const occGrp = new Set<string>();
  const occDoc = new Set<string>();
  for (const fi of fixed) {
    const c = work[fi];
    occGrp.add(`${c.diaSemana}_${c.periodo}_${normId(c.grupoId)}`);
    occDoc.add(`${c.diaSemana}_${c.periodo}_${normId(c.docenteId)}`);
  }

  let nodos = 0;
  const MAX_NODOS = 200000;

  function bt(ui: number): boolean {
    if (ui >= unfixed.length) return true;
    if (++nodos > MAX_NODOS) return false;

    const ci = unfixed[ui];
    const celda = work[ci];
    const gid = normId(celda.grupoId);
    const did = normId(celda.docenteId);
    const maxP = getMaxPeriodosGrupo(celda.grupoId, gruposInfo, undefined, numHorasPorDia);

    for (let d = 1; d <= 5; d++) {
      for (let p = 1; p <= maxP; p++) {
        const kg = `${d}_${p}_${gid}`;
        const kd = `${d}_${p}_${did}`;

        if (occGrp.has(kg)) continue;
        if (occDoc.has(kd)) continue;
        if (isSlotBloqueado(d, p, celda, slotsLibresBloqueados)) continue;

        work[ci] = { ...work[ci], diaSemana: d, periodo: p };
        occGrp.add(kg);
        occDoc.add(kd);

        if (bt(ui + 1)) return true;

        occGrp.delete(kg);
        occDoc.delete(kd);
      }
    }
    return false;
  }

  const exito = bt(0);

  if (!exito) {
    const docNombre = work[srcIdx].docente?.nombre || "el docente";
    return {
      success: false,
      error: `⚠️ No es posible reubicar esta clase: generaría colisión con el horario del docente ${docNombre} o con horas bloqueadas.`
    };
  }

  // Contar movidas
  let numMovidas = 0;
  for (let i = 0; i < cells.length; i++) {
    if (work[i].diaSemana !== cells[i].diaSemana || work[i].periodo !== cells[i].periodo) {
      numMovidas++;
    }
  }

  return { success: true, celdasActualizadas: work, numMovidas: Math.max(numMovidas, 1) };
}
