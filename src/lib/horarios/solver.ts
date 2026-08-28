/**
 * Motor Solver de Restricciones para Generación de Horarios Escolares
 * SISAT-ATP - Algoritmo CSP Backtracking con Heurística MRV (Minimum Remaining Values),
 * Forward-Checking y Ordenación de Valor LCV
 */

export interface GrupoInput {
  id: string;
  nombre: string;
  semestre: number;
}

export interface DocenteInput {
  id: string;
  nombreCompleto: string;
  horasMaxDia?: number;
}

export interface AulaInput {
  id: string;
  nombre: string;
  tipo: string;
}

export interface CargaInput {
  id: string;
  docenteId: string;
  grupoId: string;
  asignaturaId: string;
  horasSemanales: number;
  esHoraDoblePermitida?: boolean;
  requiereAulaEspecial?: boolean;
  aulaEspecialId?: string;
}

export interface CeldaFijaInput {
  diaSemana: number; // 1 a 5
  periodo: number;   // 1 a N
  grupoId: string;
  docenteId: string;
  asignaturaId: string;
  aulaId?: string;
}

export interface RestriccionDocenteInput {
  docenteId: string;
  diasIndisponibles?: number[]; // ej. [5] para Viernes
  periodosIndisponibles?: { dia: number; periodo: number }[];
}

export interface SolverParams {
  diasLectivos: number;   // Def 5
  horasPorDia: number;    // Def 6 o 7
  restriccionMaxHrsDia?: number; // Def 2
  grupos: GrupoInput[];
  docentes: DocenteInput[];
  aulas: AulaInput[];
  cargas: CargaInput[];
  celdasFijas?: CeldaFijaInput[];
  restriccionesDocentes?: RestriccionDocenteInput[];
  slotsLibresBloqueados?: string[] | Set<string>;
}

export interface CeldaResultado {
  diaSemana: number;
  periodo: number;
  grupoId: string;
  docenteId: string;
  asignaturaId: string;
  aulaId?: string;
  cargaId?: string;
  esBloqueado?: boolean;
}

export interface SolverResult {
  exito: boolean;
  celdas: CeldaResultado[];
  conflictos: string[];
  metricas: {
    totalClasesProgramadas: number;
    totalClasesRequeridas: number;
    huecosDocentes: number;
    huecosGrupos: number;
  };
}

interface SubjectCargaInternal {
  id: string;
  grupoId: string;
  docenteId: string;
  asignaturaId: string;
  horasRestantes: number;
  totalHoras: number;
  requiereAulaEspecial: boolean;
  aulaEspecialId?: string;
}

interface SlotItem {
  grupoId: string;
  dia: number;
  periodo: number;
}

interface GridCell {
  docenteId: string;
  asignaturaId: string;
  aulaId?: string;
  cargaId?: string;
  esBloqueado: boolean;
}

export function resolverHorario(params: SolverParams): SolverResult {
  const {
    diasLectivos = 5,
    horasPorDia = 6,
    grupos,
    docentes,
    aulas = [],
    cargas,
    celdasFijas = [],
    restriccionesDocentes = [],
    slotsLibresBloqueados
  } = params;

  const conflictos: string[] = [];

  // 1. Estructura de Retícula por Grupo
  // grid[grupoId][dia][periodo] = GridCell | null
  const grid = new Map<string, (GridCell | null)[][]>();
  for (const g of grupos) {
    const days: (GridCell | null)[][] = [];
    for (let d = 0; d <= diasLectivos; d++) {
      days.push(new Array(horasPorDia + 1).fill(null));
    }
    grid.set(g.id, days);
  }

  // Conjuntos de Ocupación
  const docenteOcupado = new Set<string>(); // `${dia}_${periodo}_${docenteId}`
  const aulaOcupada = new Set<string>();    // `${dia}_${periodo}_${aulaId}`
  const dailySubjectCount = new Map<string, number>(); // `${grupoId}_${asignaturaId}_${dia}` -> count
  const dailyDocenteCount = new Map<string, number>(); // `${docenteId}_${dia}` -> count

  const docIds = new Set(docentes.map(d => d.id));
  const grpIds = new Set(grupos.map(g => g.id));
  const aulaIds = new Set(aulas.map(a => a.id));

  // 2. Procesar Slots Libres Bloqueados (Candados en horas vacías)
  if (slotsLibresBloqueados) {
    const slotsArr = Array.isArray(slotsLibresBloqueados)
      ? slotsLibresBloqueados
      : Array.from(slotsLibresBloqueados);

    for (const key of slotsArr) {
      const parts = key.split("_");
      if (parts.length >= 3) {
        const dia = parseInt(parts[0], 10);
        const periodo = parseInt(parts[1], 10);
        const filtroId = parts.slice(2).join("_");

        if (dia >= 1 && dia <= diasLectivos && periodo >= 1 && periodo <= horasPorDia) {
          if (docIds.has(filtroId)) {
            docenteOcupado.add(`${dia}_${periodo}_${filtroId}`);
          }
          if (grpIds.has(filtroId)) {
            const grpGrid = grid.get(filtroId);
            if (grpGrid && !grpGrid[dia][periodo]) {
              // Marcar slot de grupo como bloqueado para no asignar clase
              grpGrid[dia][periodo] = {
                docenteId: "__BLOQUEADO__",
                asignaturaId: "__BLOQUEADO__",
                esBloqueado: true
              };
            }
          }
          if (aulaIds.has(filtroId)) {
            aulaOcupada.add(`${dia}_${periodo}_${filtroId}`);
          }
        }
      }
    }
  }

  // 3. Procesar Restricciones de Disponibilidad de Docentes
  for (const restr of restriccionesDocentes) {
    if (restr.diasIndisponibles) {
      for (const d of restr.diasIndisponibles) {
        for (let p = 1; p <= horasPorDia; p++) {
          docenteOcupado.add(`${d}_${p}_${restr.docenteId}`);
        }
      }
    }
    if (restr.periodosIndisponibles) {
      for (const pi of restr.periodosIndisponibles) {
        docenteOcupado.add(`${pi.dia}_${pi.periodo}_${restr.docenteId}`);
      }
    }
  }

  // 4. Colocar Celdas Fijas
  const celdasResultado: CeldaResultado[] = [];
  for (const f of celdasFijas) {
    const kDoc = `${f.diaSemana}_${f.periodo}_${f.docenteId}`;
    const kGrp = grid.get(f.grupoId);

    if (docenteOcupado.has(kDoc)) {
      conflictos.push(`Conflicto con celda fija: El docente ya está ocupado el día ${f.diaSemana}, periodo ${f.periodo}`);
    }
    if (kGrp && kGrp[f.diaSemana][f.periodo] && kGrp[f.diaSemana][f.periodo]?.docenteId !== "__BLOQUEADO__") {
      conflictos.push(`Conflicto con celda fija: El grupo ya tiene clase asignada el día ${f.diaSemana}, periodo ${f.periodo}`);
    }

    if (kGrp) {
      kGrp[f.diaSemana][f.periodo] = {
        docenteId: f.docenteId,
        asignaturaId: f.asignaturaId,
        aulaId: f.aulaId,
        esBloqueado: true
      };
    }
    docenteOcupado.add(kDoc);
    if (f.aulaId) {
      aulaOcupada.add(`${f.diaSemana}_${f.periodo}_${f.aulaId}`);
    }

    const kMat = `${f.grupoId}_${f.asignaturaId}_${f.diaSemana}`;
    dailySubjectCount.set(kMat, (dailySubjectCount.get(kMat) || 0) + 1);

    const kDocDia = `${f.docenteId}_${f.diaSemana}`;
    dailyDocenteCount.set(kDocDia, (dailyDocenteCount.get(kDocDia) || 0) + 1);

    celdasResultado.push({
      diaSemana: f.diaSemana,
      periodo: f.periodo,
      grupoId: f.grupoId,
      docenteId: f.docenteId,
      asignaturaId: f.asignaturaId,
      aulaId: f.aulaId,
      esBloqueado: true
    });
  }

  // 5. Preparar Cargas Pendientes
  const subjectCargas: SubjectCargaInternal[] = [];
  let totalRequeridas = 0;

  for (const c of cargas) {
    totalRequeridas += c.horasSemanales;
    const fijadas = celdasFijas.filter(f => f.grupoId === c.grupoId && f.asignaturaId === c.asignaturaId).length;
    const restantes = Math.max(0, c.horasSemanales - fijadas);
    if (restantes > 0) {
      subjectCargas.push({
        id: c.id,
        grupoId: c.grupoId,
        docenteId: c.docenteId,
        asignaturaId: c.asignaturaId,
        horasRestantes: restantes,
        totalHoras: c.horasSemanales,
        requiereAulaEspecial: !!c.requiereAulaEspecial,
        aulaEspecialId: c.aulaEspecialId
      });
    }
  }

  // 6. Extraer todos los Slots a Asignar (únicamente para grupos con cargas o celdas fijas)
  const gruposConCarga = new Set([
    ...subjectCargas.map(c => c.grupoId),
    ...celdasFijas.map(f => f.grupoId)
  ]);

  const allSlots: SlotItem[] = [];
  for (const g of grupos) {
    if (!gruposConCarga.has(g.id)) continue;
    const grpGrid = grid.get(g.id);
    if (!grpGrid) continue;
    for (let d = 1; d <= diasLectivos; d++) {
      for (let p = 1; p <= horasPorDia; p++) {
        if (!grpGrid[d][p]) {
          allSlots.push({ grupoId: g.id, dia: d, periodo: p });
        }
      }
    }
  }

  // Función para obtener candidatos de un slot con restricciones duras y suaves
  function getCandidatesForSlot(slot: SlotItem, maxHrsPerDay: number): SubjectCargaInternal[] {
    const { grupoId, dia, periodo } = slot;
    const kDocPrefix = `${dia}_${periodo}_`;

    return subjectCargas.filter(c => {
      if (c.grupoId !== grupoId) return false;
      if (c.horasRestantes <= 0) return false;
      if (docenteOcupado.has(`${kDocPrefix}${c.docenteId}`)) return false;

      if (c.requiereAulaEspecial && c.aulaEspecialId) {
        if (aulaOcupada.has(`${dia}_${periodo}_${c.aulaEspecialId}`)) return false;
      }

      // Límite de horas por materia por día para el grupo
      const kMat = `${grupoId}_${c.asignaturaId}_${dia}`;
      const countToday = dailySubjectCount.get(kMat) || 0;
      if (countToday >= maxHrsPerDay) return false;

      return true;
    });
  }

  // 7. Backtracking con Heurística MRV (Minimum Remaining Values) y Forward-Checking
  let nodesExplored = 0;
  const MAX_NODES = 400000;

  function solveBacktracking(slotIndex: number, maxHrsPerDay: number): boolean {
    if (slotIndex >= allSlots.length) {
      return true;
    }

    nodesExplored++;
    if (nodesExplored > MAX_NODES) return false;

    // Encontrar dinámicamente el slot más restringido (MRV)
    let bestSlotIdx = slotIndex;
    let minCandidates = 9999;
    let bestCandidates: SubjectCargaInternal[] = [];

    for (let i = slotIndex; i < allSlots.length; i++) {
      const cand = getCandidatesForSlot(allSlots[i], maxHrsPerDay);
      if (cand.length === 0) {
        return false; // Forward checking detectó un slot sin opciones válidas
      }
      if (cand.length < minCandidates) {
        minCandidates = cand.length;
        bestSlotIdx = i;
        bestCandidates = cand;
        if (minCandidates === 1) break;
      }
    }

    // Intercambiar slot seleccionado con slotIndex actual
    const currentSlot = allSlots[bestSlotIdx];
    allSlots[bestSlotIdx] = allSlots[slotIndex];
    allSlots[slotIndex] = currentSlot;

    const { grupoId, dia, periodo } = currentSlot;
    const kDocPrefix = `${dia}_${periodo}_`;

    // Ordenar candidatos por LCV / Saturación docente (más horas restantes van primero)
    bestCandidates.sort((a, b) => b.horasRestantes - a.horasRestantes);

    const grpGrid = grid.get(grupoId)!;

    for (const carga of bestCandidates) {
      const kDoc = `${kDocPrefix}${carga.docenteId}`;
      const kMat = `${grupoId}_${carga.asignaturaId}_${dia}`;
      const kAula = (carga.requiereAulaEspecial && carga.aulaEspecialId)
        ? `${dia}_${periodo}_${carga.aulaEspecialId}`
        : null;

      // Asignar
      grpGrid[dia][periodo] = {
        docenteId: carga.docenteId,
        asignaturaId: carga.asignaturaId,
        aulaId: carga.aulaEspecialId,
        cargaId: carga.id,
        esBloqueado: false
      };
      docenteOcupado.add(kDoc);
      if (kAula) aulaOcupada.add(kAula);
      dailySubjectCount.set(kMat, (dailySubjectCount.get(kMat) || 0) + 1);
      carga.horasRestantes--;

      if (solveBacktracking(slotIndex + 1, maxHrsPerDay)) {
        return true;
      }

      // Deshacer asignación (Backtrack)
      grpGrid[dia][periodo] = null;
      docenteOcupado.delete(kDoc);
      if (kAula) aulaOcupada.delete(kAula);
      dailySubjectCount.set(kMat, (dailySubjectCount.get(kMat) || 0) - 1);
      carga.horasRestantes++;
    }

    // Restaurar orden de slots
    const temp = allSlots[slotIndex];
    allSlots[slotIndex] = allSlots[bestSlotIdx];
    allSlots[bestSlotIdx] = temp;

    return false;
  }

  // Ejecución en cascada con relajación controlada
  const limiteInicial = params.restriccionMaxHrsDia ?? 2;
  let exito = solveBacktracking(0, limiteInicial);

  if (!exito && limiteInicial <= 2) {
    // Relajación a 3 horas por día para materias de alta carga semanal
    nodesExplored = 0;
    exito = solveBacktracking(0, 3);
  }

  if (!exito && limiteInicial < 4) {
    // Relajación máxima a 4 horas por día en casos de extrema compresión semanal
    nodesExplored = 0;
    exito = solveBacktracking(0, 4);
  }

  // 8. Construir Resultado Final de Celdas
  const celdasFinales: CeldaResultado[] = [];

  for (const g of grupos) {
    const grpGrid = grid.get(g.id);
    if (!grpGrid) continue;

    for (let d = 1; d <= diasLectivos; d++) {
      for (let p = 1; p <= horasPorDia; p++) {
        const u = grpGrid[d][p];
        if (u && u.docenteId !== "__BLOQUEADO__") {
          celdasFinales.push({
            diaSemana: d,
            periodo: p,
            grupoId: g.id,
            docenteId: u.docenteId,
            asignaturaId: u.asignaturaId,
            aulaId: u.aulaId,
            cargaId: u.cargaId,
            esBloqueado: u.esBloqueado
          });
        }
      }
    }
  }

  // Reportar asignaturas faltantes si no hubo éxito total
  for (const sc of subjectCargas) {
    if (sc.horasRestantes > 0) {
      conflictos.push(`Faltaron ubicar ${sc.horasRestantes} hora(s) de la materia ID ${sc.asignaturaId} en el Grupo ID ${sc.grupoId}`);
    }
  }

  // 9. Métricas de Huecos
  let huecosDocentes = 0;
  let huecosGrupos = 0;

  for (const g of grupos) {
    for (let d = 1; d <= diasLectivos; d++) {
      const periodosOcupados = celdasFinales
        .filter(c => c.grupoId === g.id && c.diaSemana === d)
        .map(c => c.periodo)
        .sort((a, b) => a - b);

      if (periodosOcupados.length > 1) {
        const minP = periodosOcupados[0];
        const maxP = periodosOcupados[periodosOcupados.length - 1];
        const span = maxP - minP + 1;
        huecosGrupos += (span - periodosOcupados.length);
      }
    }
  }

  for (const doc of docentes) {
    for (let d = 1; d <= diasLectivos; d++) {
      const periodosDoc = celdasFinales
        .filter(c => c.docenteId === doc.id && c.diaSemana === d)
        .map(c => c.periodo)
        .sort((a, b) => a - b);

      if (periodosDoc.length > 1) {
        const minP = periodosDoc[0];
        const maxP = periodosDoc[periodosDoc.length - 1];
        const span = maxP - minP + 1;
        huecosDocentes += (span - periodosDoc.length);
      }
    }
  }

  return {
    exito: exito && celdasFinales.length >= totalRequeridas,
    celdas: celdasFinales,
    conflictos,
    metricas: {
      totalClasesProgramadas: celdasFinales.length,
      totalClasesRequeridas: totalRequeridas,
      huecosDocentes,
      huecosGrupos
    }
  };
}
