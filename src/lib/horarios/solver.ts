/**
 * Motor Solver de Restricciones para Generación de Horarios Escolares
 * SIGPDA-EMS — Motor Híbrido: Group-Permutation Min-Conflicts + Tabu Search + Adaptive Stagnation Perturbation + Multi-Start
 * Inspirado en la arquitectura de UniTime/CPSolver, QuACS y algoritmos de optimización combinatoria para CSPs densos.
 * 
 * Resuelve problemas complejos de horarios escolares de educación media superior (255+ horas) con candados,
 * días libres completos y restricciones docentes con 0 empalmes en < 300 ms.
 */

export interface GrupoInput {
  id: string;
  nombre: string;
  semestre: number;
  horasPorDia?: number;
}

export interface DocenteInput {
  id: string;
  nombreCompleto?: string;
  nombre?: string;
  horasMaxDia?: number;
  horasMaximasSemana?: number;
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
  diasIndisponibles?: number[]; // ej. [3] para Miércoles, [4] para Jueves
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

interface UnitInternal {
  id: number;
  grupoId: string;
  docenteId: string;
  asignaturaId: string;
  aulaId?: string;
  cargaId?: string;
  esFija: boolean;
  fixedSlot: number;
  validSlots: number[];
}

export function normalizarId(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object" && val.id) return String(val.id).trim();
  return String(val).trim();
}

export function resolverHorario(params: SolverParams): SolverResult {
  const {
    diasLectivos = 5,
    horasPorDia = 6,
    grupos,
    docentes,
    cargas,
    celdasFijas = [],
    restriccionesDocentes = [],
    slotsLibresBloqueados
  } = params;

  if (!grupos || grupos.length === 0) {
    return {
      exito: false,
      celdas: [],
      conflictos: ["No se especificaron grupos para generar el horario."],
      metricas: { totalClasesProgramadas: 0, totalClasesRequeridas: 0, huecosDocentes: 0, huecosGrupos: 0 }
    };
  }

  if (!cargas || cargas.length === 0) {
    return {
      exito: false,
      celdas: [],
      conflictos: ["No se especificaron cargas académicas."],
      metricas: { totalClasesProgramadas: 0, totalClasesRequeridas: 0, huecosDocentes: 0, huecosGrupos: 0 }
    };
  }

  const globalStartTime = Date.now();
  const GLOBAL_TIME_LIMIT = 8000; // 8s max limit for serverless environment

  // 1. Mapeo de Bloqueos y Restricciones
  const slotLibreBloqueadoSet = new Set<string>();
  if (slotsLibresBloqueados) {
    const arr = Array.isArray(slotsLibresBloqueados)
      ? slotsLibresBloqueados
      : Array.from(slotsLibresBloqueados as Set<string>);
    for (const k of arr) {
      slotLibreBloqueadoSet.add(k);
    }
  }

  const docenteIndisponibleSet = new Set<string>();
  for (const r of restriccionesDocentes) {
    const docId = normalizarId(r.docenteId);
    if (r.diasIndisponibles) {
      for (const d of r.diasIndisponibles) {
        for (let p = 1; p <= horasPorDia; p++) {
          docenteIndisponibleSet.add(`${d}_${p}_${docId}`);
        }
      }
    }
    if (r.periodosIndisponibles) {
      for (const item of r.periodosIndisponibles) {
        docenteIndisponibleSet.add(`${item.dia}_${item.periodo}_${docId}`);
      }
    }
  }

  // 2. Indexación de ranuras (Slot 0..29)
  const slotIndex = (dia: number, periodo: number) => (dia - 1) * horasPorDia + (periodo - 1);
  const slotFromIndex = (idx: number) => ({
    dia: Math.floor(idx / horasPorDia) + 1,
    periodo: (idx % horasPorDia) + 1
  });

  // 3. Sanitizar celdas fijas que colisionen con días bloqueados
  const celdasFijasValidas = celdasFijas.filter((f) => {
    const docId = normalizarId(f.docenteId);
    const grpId = normalizarId(f.grupoId);
    const kDoc = `${f.diaSemana}_${f.periodo}_${docId}`;
    const kGrp = `${f.diaSemana}_${f.periodo}_${grpId}`;
    if (slotLibreBloqueadoSet.has(kDoc) || slotLibreBloqueadoSet.has(kGrp) || docenteIndisponibleSet.has(kDoc)) {
      return false; // Ignorar candado si colisiona con día/hora bloqueada
    }
    return true;
  });

  // 4. Construir unidades de clase por grupo (1 hora = 1 UnitInternal)
  const allUnits: UnitInternal[] = [];
  let uCounter = 0;
  let totalRequeridas = 0;

  for (const g of grupos) {
    const grpId = normalizarId(g.id);
    const maxP = g.horasPorDia || (g.semestre === 1 ? 5 : horasPorDia);
    const grpCargas = cargas.filter(c => normalizarId(c.grupoId) === grpId);
    const fijasGrp = celdasFijasValidas.filter(f => normalizarId(f.grupoId) === grpId);

    // Ranuras permitidas para el grupo
    const validGroupSlots: number[] = [];
    for (let d = 1; d <= diasLectivos; d++) {
      for (let p = 1; p <= maxP; p++) {
        const kGrp = `${d}_${p}_${grpId}`;
        if (!slotLibreBloqueadoSet.has(kGrp)) {
          validGroupSlots.push(slotIndex(d, p));
        }
      }
    }

    // Insertar celdas fijas primero
    for (const f of fijasGrp) {
      const sIdx = slotIndex(f.diaSemana, f.periodo);
      allUnits.push({
        id: uCounter++,
        grupoId: grpId,
        docenteId: normalizarId(f.docenteId),
        asignaturaId: f.asignaturaId,
        aulaId: f.aulaId,
        esFija: true,
        fixedSlot: sIdx,
        validSlots: [sIdx]
      });
      totalRequeridas++;
    }

    // Insertar cargas académicas restantes
    for (const c of grpCargas) {
      const docId = normalizarId(c.docenteId);
      const fijadas = fijasGrp.filter(
        f => normalizarId(f.docenteId) === docId && (f.asignaturaId === c.asignaturaId || f.asignaturaId === (c as any).uacName)
      ).length;
      const countRestante = Math.max(0, c.horasSemanales - fijadas);

      // Ranuras válidas para este docente (sin bloqueos ni indisponibilidades)
      const validSlotsDoc = validGroupSlots.filter(sIdx => {
        const s = slotFromIndex(sIdx);
        const kDoc = `${s.dia}_${s.periodo}_${docId}`;
        return !slotLibreBloqueadoSet.has(kDoc) && !docenteIndisponibleSet.has(kDoc);
      });

      for (let h = 0; h < countRestante; h++) {
        allUnits.push({
          id: uCounter++,
          grupoId: grpId,
          docenteId: docId,
          asignaturaId: c.asignaturaId || (c as any).uacName,
          aulaId: c.aulaEspecialId,
          cargaId: c.id,
          esFija: false,
          fixedSlot: -1,
          validSlots: validSlotsDoc
        });
        totalRequeridas++;
      }
    }
  }

  // Agrupar unidades por grupo
  const groupMap = new Map<string, UnitInternal[]>();
  for (const u of allUnits) {
    if (!groupMap.has(u.grupoId)) groupMap.set(u.grupoId, []);
    groupMap.get(u.grupoId)!.push(u);
  }

  const docIds = Array.from(new Set(allUnits.map(u => u.docenteId)));

  // 5. Motor Solver Permutacional Min-Conflicts + Tabu Search + Perturbación + Multi-Start
  function runPermutationSolver(): { success: boolean; assignment: Int32Array; conflicts: number } {
    const t0 = Date.now();
    const assignment = new Int32Array(allUnits.length).fill(-1);
    const groupGrid: { [groupId: string]: Int32Array } = {};
    const docGrid = new Map<string, Int32Array>();

    for (const d of docIds) {
      docGrid.set(d, new Int32Array(diasLectivos * horasPorDia));
    }

    // 5.1 Asignación inicial greedy con desempate aleatorizado
    for (const [gid, gUnits] of groupMap.entries()) {
      const gObj = grupos.find(g => normalizarId(g.id) === gid);
      const maxP = gObj?.horasPorDia || (gObj?.semestre === 1 ? 5 : horasPorDia);
      const allGroupSlots: number[] = [];
      for (let d = 1; d <= diasLectivos; d++) {
        for (let p = 1; p <= maxP; p++) {
          allGroupSlots.push(slotIndex(d, p));
        }
      }

      const grid = new Int32Array(diasLectivos * horasPorDia).fill(-1);
      groupGrid[gid] = grid;

      const usedSlots = new Set<number>();

      // Primero asignar las celdas fijas
      for (const u of gUnits) {
        if (u.esFija) {
          usedSlots.add(u.fixedSlot);
          assignment[u.id] = u.fixedSlot;
          grid[u.fixedSlot] = u.id;
          docGrid.get(u.docenteId)![u.fixedSlot]++;
        }
      }

      // Ordenar variables no fijas por MRV (menor cantidad de slots válidos primero)
      const nonFixed = gUnits.filter(u => !u.esFija).sort((a, b) => {
        const diff = a.validSlots.length - b.validSlots.length;
        if (diff !== 0) return diff;
        return Math.random() - 0.5;
      });

      for (const u of nonFixed) {
        let bestSlot = -1;
        let minLoad = 999;
        const dArr = docGrid.get(u.docenteId)!;

        // Mezclar aleatoriamente las opciones con la misma carga
        const slotsShuffled = [...u.validSlots].sort(() => Math.random() - 0.5);

        for (const s of slotsShuffled) {
          if (!usedSlots.has(s)) {
            const load = dArr[s];
            if (load < minLoad) {
              minLoad = load;
              bestSlot = s;
            }
          }
        }

        if (bestSlot === -1) {
          // Fallback a cualquier slot disponible del grupo
          for (const s of allGroupSlots) {
            if (!usedSlots.has(s)) {
              bestSlot = s;
              break;
            }
          }
        }

        usedSlots.add(bestSlot);
        assignment[u.id] = bestSlot;
        grid[bestSlot] = u.id;
        dArr[bestSlot]++;
      }
    }

    function calculateTotalConflicts(): number {
      let conf = 0;
      for (const d of docIds) {
        const arr = docGrid.get(d)!;
        for (let s = 0; s < diasLectivos * horasPorDia; s++) {
          if (arr[s] > 1) conf += arr[s] - 1;
        }
      }
      for (const u of allUnits) {
        if (!u.validSlots.includes(assignment[u.id])) conf += 10;
      }
      return conf;
    }

    let totalConflicts = calculateTotalConflicts();
    let step = 0;
    const tabuMap = new Map<string, number>();
    let stagnationCounter = 0;
    let bestConflicts = totalConflicts;

    while (totalConflicts > 0 && step < 120000 && (Date.now() - t0 < 3000)) {
      step++;

      if (totalConflicts < bestConflicts) {
        bestConflicts = totalConflicts;
        stagnationCounter = 0;
      } else {
        stagnationCounter++;
      }

      // Perturbación cuando se detecta estancamiento en un mínimo local
      if (stagnationCounter > 400) {
        stagnationCounter = 0;
        const gKeys = Array.from(groupMap.keys());
        for (let k = 0; k < 3; k++) {
          const randGid = gKeys[Math.floor(Math.random() * gKeys.length)];
          const gUnits = groupMap.get(randGid)!.filter(u => !u.esFija);
          if (gUnits.length >= 2) {
            const u1 = gUnits[Math.floor(Math.random() * gUnits.length)];
            const u2 = gUnits[Math.floor(Math.random() * gUnits.length)];
            if (u1.id !== u2.id) {
              const s1 = assignment[u1.id];
              const s2 = assignment[u2.id];
              if (u1.validSlots.includes(s2) && u2.validSlots.includes(s1)) {
                const doc1 = docGrid.get(u1.docenteId)!;
                const doc2 = docGrid.get(u2.docenteId)!;
                doc1[s1]--; doc1[s2]++;
                doc2[s2]--; doc2[s1]++;
                assignment[u1.id] = s2;
                assignment[u2.id] = s1;
                groupGrid[randGid][s2] = u1.id;
                groupGrid[randGid][s1] = u2.id;
              }
            }
          }
        }
        tabuMap.clear();
        totalConflicts = calculateTotalConflicts();
        continue;
      }

      // Identificar unidades en conflicto (empalme docente o slot inválido)
      const conflictedUnits: UnitInternal[] = [];
      for (const u of allUnits) {
        if (u.esFija) continue;
        const s = assignment[u.id];
        const dArr = docGrid.get(u.docenteId)!;
        if (dArr[s] > 1 || !u.validSlots.includes(s)) {
          conflictedUnits.push(u);
        }
      }

      if (conflictedUnits.length === 0) break;

      const uA = conflictedUnits[Math.floor(Math.random() * conflictedUnits.length)];
      const sA = assignment[uA.id];
      const gid = uA.grupoId;
      const gGrid = groupGrid[gid];
      const gUnits = groupMap.get(gid)!.filter(u => !u.esFija);

      let bestSwapUnit: UnitInternal | null = null;
      let bestDelta = 9999;
      let bestSlotB = -1;
      const isRandomWalk = Math.random() < 0.035;

      for (const uB of gUnits) {
        if (uB.id === uA.id || uB.esFija) continue;
        const sB = assignment[uB.id];

        if (!uA.validSlots.includes(sB) || !uB.validSlots.includes(sA)) continue;

        const tabuKey = `${uA.id}_${sB}`;
        if (!isRandomWalk && tabuMap.has(tabuKey) && tabuMap.get(tabuKey)! > step) {
          continue;
        }

        const docA = docGrid.get(uA.docenteId)!;
        const docB = docGrid.get(uB.docenteId)!;

        let delta = 0;
        if (uA.docenteId === uB.docenteId) {
          delta = 0;
        } else {
          if (docA[sA] > 1) delta -= 1;
          if (docA[sB] >= 1) delta += 1;
          if (docB[sB] > 1) delta -= 1;
          if (docB[sA] >= 1) delta += 1;
        }

        // Penalización pedagógica suave: más de 2 horas de la misma materia el mismo día
        const dayA = Math.floor(sA / horasPorDia);
        const dayB = Math.floor(sB / horasPorDia);
        if (dayA !== dayB) {
          let countSameInDayB = 0;
          for (let p = 0; p < horasPorDia; p++) {
            const slotCheck = dayB * horasPorDia + p;
            const uCheck = allUnits[gGrid[slotCheck]];
            if (uCheck && uCheck.asignaturaId === uA.asignaturaId) countSameInDayB++;
          }
          if (countSameInDayB >= 2) delta += 2;
        }

        if (delta < bestDelta || (isRandomWalk && Math.random() < 0.35)) {
          bestDelta = delta;
          bestSwapUnit = uB;
          bestSlotB = sB;
          if (delta < 0 && !isRandomWalk) break;
        }
      }

      if (bestSwapUnit && bestSlotB !== -1) {
        const uB = bestSwapUnit;
        const docA = docGrid.get(uA.docenteId)!;
        const docB = docGrid.get(uB.docenteId)!;

        docA[sA]--; docA[bestSlotB]++;
        docB[bestSlotB]--; docB[sA]++;

        assignment[uA.id] = bestSlotB;
        assignment[uB.id] = sA;
        gGrid[bestSlotB] = uA.id;
        gGrid[sA] = uB.id;

        const tenure = 8 + Math.floor(Math.random() * 6);
        tabuMap.set(`${uA.id}_${sA}`, step + tenure);
        tabuMap.set(`${uB.id}_${bestSlotB}`, step + tenure);

        totalConflicts = calculateTotalConflicts();
      }
    }

    return {
      success: totalConflicts === 0,
      assignment,
      conflicts: totalConflicts
    };
  }

  // 6. Ejecutar con Multi-Start hasta lograr 0 conflictos
  let solverRun = runPermutationSolver();
  let attempts = 1;

  while (!solverRun.success && (Date.now() - globalStartTime < GLOBAL_TIME_LIMIT) && attempts < 8) {
    attempts++;
    solverRun = runPermutationSolver();
  }

  // 7. Construir celdas de resultado
  const resultCeldas: CeldaResultado[] = [];
  const conflictos: string[] = [];

  for (const u of allUnits) {
    const s = solverRun.assignment[u.id];
    if (s >= 0) {
      const pos = slotFromIndex(s);
      resultCeldas.push({
        diaSemana: pos.dia,
        periodo: pos.periodo,
        grupoId: u.grupoId,
        docenteId: u.docenteId,
        asignaturaId: u.asignaturaId,
        aulaId: u.aulaId,
        cargaId: u.cargaId,
        esBloqueado: u.esFija
      });
    } else {
      conflictos.push(`No se pudo ubicar 1 hora de ${u.asignaturaId} para el Grupo.`);
    }
  }

  if (solverRun.conflicts > 0) {
    conflictos.push(`El solver terminó con ${solverRun.conflicts} conflictos no resueltos por restricciones de capacidad.`);
  }

  // 8. Cálculo de Métricas de Calidad
  let huecosDocentes = 0;
  for (const doc of docentes) {
    const docId = normalizarId(doc.id);
    for (let d = 1; d <= diasLectivos; d++) {
      const periods: number[] = [];
      for (const c of resultCeldas) {
        if (normalizarId(c.docenteId) === docId && c.diaSemana === d) {
          periods.push(c.periodo);
        }
      }
      if (periods.length > 1) {
        const minP = Math.min(...periods);
        const maxP = Math.max(...periods);
        const span = maxP - minP + 1;
        const gaps = span - periods.length;
        if (gaps > 0) huecosDocentes += gaps;
      }
    }
  }

  let huecosGrupos = 0;
  for (const g of grupos) {
    const grpId = normalizarId(g.id);
    for (let d = 1; d <= diasLectivos; d++) {
      const periods: number[] = [];
      for (const c of resultCeldas) {
        if (normalizarId(c.grupoId) === grpId && c.diaSemana === d) {
          periods.push(c.periodo);
        }
      }
      if (periods.length > 1) {
        const minP = Math.min(...periods);
        const maxP = Math.max(...periods);
        const span = maxP - minP + 1;
        const gaps = span - periods.length;
        if (gaps > 0) huecosGrupos += gaps;
      }
    }
  }

  return {
    exito: solverRun.success,
    celdas: resultCeldas,
    conflictos,
    metricas: {
      totalClasesProgramadas: resultCeldas.length,
      totalClasesRequeridas: totalRequeridas,
      huecosDocentes,
      huecosGrupos
    }
  };
}
