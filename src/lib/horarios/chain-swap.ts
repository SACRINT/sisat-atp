import { CeldaHorario, GrupoLimiteInfo } from "./ripple-solver";

export interface SwapMove {
  cellFromIndex: number;
  targetDia: number;
  targetPeriodo: number;
}

export interface ChainResult {
  success: boolean;
  moves: SwapMove[];
  celdasResult: CeldaHorario[];
  profundidad: number;
  error?: string;
}

export const normalizarId = (val: any): string => {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object" && val.id) return String(val.id).trim();
  return String(val).trim();
};

// Ocupación global O(1) para validaciones instantáneas
function buildOccupancy(celdas: CeldaHorario[]) {
  const grupo = new Set<string>();
  const docente = new Set<string>();
  const aula = new Set<string>();
  for (const c of celdas) {
    if (c.diaSemana > 0 && c.periodo > 0) {
      grupo.add(`${c.diaSemana}_${c.periodo}_${normalizarId(c.grupoId)}`);
      docente.add(`${c.diaSemana}_${c.periodo}_${normalizarId(c.docenteId)}`);
      if (c.aulaId) aula.add(`${c.diaSemana}_${c.periodo}_${normalizarId(c.aulaId)}`);
    }
  }
  return { grupo, docente, aula };
}

function slotValido(
  d: number,
  p: number,
  celda: CeldaHorario,
  occ: { grupo: Set<string>; docente: Set<string>; aula: Set<string> },
  slotsBloqueados: Set<string>,
  gruposInfo?: GrupoLimiteInfo[],
  numHorasPorDia: number = 6
): boolean {
  const gid = normalizarId(celda.grupoId);
  const docId = normalizarId(celda.docenteId);

  // Jornada del grupo
  const maxP =
    gruposInfo?.find((g) => normalizarId(g.id) === gid)?.horasPorDia ??
    (gruposInfo?.find((g) => normalizarId(g.id) === gid)?.semestre === 1 ? 5 : numHorasPorDia);
  if (p > maxP) return false;

  // Bloqueado con candado de hora libre
  const keyGrp = `${d}_${p}_${gid}`;
  const keyDoc = `${d}_${p}_${docId}`;
  if (slotsBloqueados.has(keyGrp) || slotsBloqueados.has(keyDoc)) return false;

  // Ocupado
  if (occ.grupo.has(keyGrp)) return false;
  if (occ.docente.has(keyDoc)) return false;
  if (celda.aulaId && occ.aula.has(`${d}_${p}_${normalizarId(celda.aulaId)}`)) return false;

  return true;
}

/**
 * Algoritmo BFS/DFS de Búsqueda de Cadena de Swaps (Cadena de Reubicación Multi-Paso).
 * Analiza combinaciones de movimientos en cascada para reubicar clases en el horario escolar
 * sin generar empalmes y respetando candados y horas libres.
 */
export function buscarCadenaSwap(
  celdasOriginales: CeldaHorario[],
  celdaDesplazada: CeldaHorario,
  slotOrigenOriginal: { dia: number; periodo: number },
  slotsLibresBloqueados: Set<string> = new Set(),
  gruposInfo?: GrupoLimiteInfo[],
  numHorasPorDia: number = 6,
  maxDepth: number = 8
): ChainResult {
  const celdasBase: CeldaHorario[] = celdasOriginales.map((c) => ({ ...c }));

  const targetGid = normalizarId(celdaDesplazada.grupoId);
  const targetDocId = normalizarId(celdaDesplazada.docenteId);

  const idxDesplazada = celdasBase.findIndex(
    (c) =>
      (c.id && celdaDesplazada.id && c.id === celdaDesplazada.id) ||
      (normalizarId(c.grupoId) === targetGid &&
        normalizarId(c.docenteId) === targetDocId &&
        c.diaSemana === slotOrigenOriginal.dia &&
        c.periodo === slotOrigenOriginal.periodo)
  );

  if (idxDesplazada === -1) {
    return { success: false, moves: [], celdasResult: celdasBase, profundidad: 0, error: "No se encontró la celda objetivo." };
  }

  // Paso 1: Intentar movimiento directo a slot vacío
  const occ = buildOccupancy(celdasBase);
  // Remover temporalmente la celda desplazada de la ocupación
  occ.grupo.delete(`${slotOrigenOriginal.dia}_${slotOrigenOriginal.periodo}_${targetGid}`);
  occ.docente.delete(`${slotOrigenOriginal.dia}_${slotOrigenOriginal.periodo}_${targetDocId}`);

  for (let d = 1; d <= 5; d++) {
    const maxP =
      gruposInfo?.find((g) => normalizarId(g.id) === targetGid)?.horasPorDia ??
      (gruposInfo?.find((g) => normalizarId(g.id) === targetGid)?.semestre === 1 ? 5 : numHorasPorDia);
    for (let p = 1; p <= maxP; p++) {
      if (slotValido(d, p, celdaDesplazada, occ, slotsLibresBloqueados, gruposInfo, numHorasPorDia)) {
        const celdasR = celdasBase.map((c) => ({ ...c }));
        celdasR[idxDesplazada].diaSemana = d;
        celdasR[idxDesplazada].periodo = p;
        return {
          success: true,
          moves: [{ cellFromIndex: idxDesplazada, targetDia: d, targetPeriodo: p }],
          celdasResult: celdasR,
          profundidad: 1
        };
      }
    }
  }

  // Paso 2: Búsqueda DFS de cadena de swaps con profundidad de 2 a maxDepth
  function dfsChain(
    celdasActuales: CeldaHorario[],
    currDisplacedIdx: number,
    depth: number,
    visited: Set<string>
  ): SwapMove[] | null {
    if (depth > maxDepth) return null;

    const disp = celdasActuales[currDisplacedIdx];
    const occCur = buildOccupancy(celdasActuales);
    occCur.grupo.delete(`${disp.diaSemana}_${disp.periodo}_${normalizarId(disp.grupoId)}`);
    occCur.docente.delete(`${disp.diaSemana}_${disp.periodo}_${normalizarId(disp.docenteId)}`);

    // Intentar slot vacío directo
    for (let d = 1; d <= 5; d++) {
      const maxP =
        gruposInfo?.find((g) => normalizarId(g.id) === normalizarId(disp.grupoId))?.horasPorDia ??
        (gruposInfo?.find((g) => normalizarId(g.id) === normalizarId(disp.grupoId))?.semestre === 1 ? 5 : numHorasPorDia);
      for (let p = 1; p <= maxP; p++) {
        if (slotValido(d, p, disp, occCur, slotsLibresBloqueados, gruposInfo, numHorasPorDia)) {
          return [{ cellFromIndex: currDisplacedIdx, targetDia: d, targetPeriodo: p }];
        }
      }
    }

    // Probar swaps con otras celdas que no tengan candado
    for (let j = 0; j < celdasActuales.length; j++) {
      if (j === currDisplacedIdx) continue;
      const otra = celdasActuales[j];
      if (otra.esBloqueado) continue;

      // Restringir a swaps que tengan sentido (mismo grupo o mismo docente cross-group)
      const esMismoGrupo = normalizarId(otra.grupoId) === normalizarId(disp.grupoId);
      const esMismoDocente = normalizarId(otra.docenteId) === normalizarId(disp.docenteId);
      if (!esMismoGrupo && !esMismoDocente) continue;

      const sig = `${currDisplacedIdx}->${j}@${otra.diaSemana}_${otra.periodo}`;
      if (visited.has(sig)) continue;

      // ¿La celda desplazada cabe en el slot de 'otra'?
      if (!slotValido(otra.diaSemana, otra.periodo, disp, occCur, slotsLibresBloqueados, gruposInfo, numHorasPorDia)) continue;

      // Si es cross-group (distinto grupo), verificar que el slot también esté libre para el GRUPO de la celda desplazada
      if (!esMismoGrupo) {
        const keyGrpDisp = `${otra.diaSemana}_${otra.periodo}_${normalizarId(disp.grupoId)}`;
        if (occCur.grupo.has(keyGrpDisp)) continue;
      }

      // Simular swap
      const celdasTmp = celdasActuales.map((c) => ({ ...c }));
      const origD = disp.diaSemana;
      const origP = disp.periodo;

      celdasTmp[currDisplacedIdx].diaSemana = otra.diaSemana;
      celdasTmp[currDisplacedIdx].periodo = otra.periodo;

      // Ahora 'otra' queda desplazada de su posición original
      const occTmp = buildOccupancy(celdasTmp);
      occTmp.grupo.delete(`${otra.diaSemana}_${otra.periodo}_${normalizarId(otra.grupoId)}`);
      occTmp.docente.delete(`${otra.diaSemana}_${otra.periodo}_${normalizarId(otra.docenteId)}`);

      // Caso A: Swap directo perfecto (otra va al slot original de disp)
      if (slotValido(origD, origP, otra, occTmp, slotsLibresBloqueados, gruposInfo, numHorasPorDia)) {
        celdasTmp[j].diaSemana = origD;
        celdasTmp[j].periodo = origP;
        return [
          { cellFromIndex: currDisplacedIdx, targetDia: otra.diaSemana, targetPeriodo: otra.periodo },
          { cellFromIndex: j, targetDia: origD, targetPeriodo: origP }
        ];
      }

      // Caso B: Continuar la cadena recursivamente
      visited.add(sig);
      const subMoves = dfsChain(celdasTmp, j, depth + 1, visited);
      visited.delete(sig);

      if (subMoves) {
        return [
          { cellFromIndex: currDisplacedIdx, targetDia: otra.diaSemana, targetPeriodo: otra.periodo },
          ...subMoves
        ];
      }
    }

    return null;
  }

  const visited = new Set<string>();
  const chainMoves = dfsChain(celdasBase, idxDesplazada, 1, visited);

  if (chainMoves && chainMoves.length > 0) {
    const celdasR = celdasBase.map((c) => ({ ...c }));
    for (const move of chainMoves) {
      celdasR[move.cellFromIndex].diaSemana = move.targetDia;
      celdasR[move.cellFromIndex].periodo = move.targetPeriodo;
    }
    return {
      success: true,
      moves: chainMoves,
      celdasResult: celdasR,
      profundidad: chainMoves.length
    };
  }

  return { success: false, moves: [], celdasResult: celdasBase, profundidad: 0, error: "No se encontró una cadena de reubicación válida." };
}
