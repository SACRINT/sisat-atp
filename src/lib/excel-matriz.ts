import * as XLSX from 'xlsx';

export interface CargaImportada {
  semestre: number;
  grupoId: string;
  grupoNombre: string;
  uacName: string;
  horasSemanales: number;
  docenteTextoExcel: string;
  personalId?: string;
  docenteNombreMatch?: string;
  confianza: 'EXACTA' | 'MEDIA' | 'NO_ENCONTRADO' | 'VACIO';
  valido: boolean;
}

export interface ResultadoParseoMatriz {
  cargas: CargaImportada[];
  resumen: {
    totalAsignaciones: number;
    asignadasConExito: number;
    requierenRevision: number;
    vacios: number;
  };
  gruposDetectados: string[];
}

function limpiarTexto(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .trim()
    .toUpperCase();
}

/**
 * Normaliza nombres de grupos como "1A", "1° A", "1-A", "GRUPO 1 A" a una forma canónica: "1° A"
 */
function normalizarNombreGrupo(raw: string): string {
  const t = limpiarTexto(raw).replace(/\s+/g, ' ');
  // Capturar números 1 a 6 y letra A a J
  const match = t.match(/([1-6])[\s°º\-_]*([A-J])/i);
  if (match) {
    return `${match[1]}° ${match[2].toUpperCase()}`;
  }
  return t;
}

/**
 * Coincidencia difusa de materias
 */
function coincideMateria(textoExcel: string, uacNombreOficial: string, uacTipo?: string): boolean {
  const normExcel = limpiarTexto(textoExcel);
  const normOficial = limpiarTexto(uacNombreOficial);

  if (normExcel === normOficial) return true;

  // Atajos comunes y abreviaturas
  if (normExcel.includes('CNEYT') && normOficial.includes('CIENCIAS NATURALES')) {
    if (normExcel.includes('III') && normOficial.includes('III')) return true;
    if (normExcel.includes('IV') && normOficial.includes('IV')) return true;
    if (normExcel.includes('II') && normOficial.includes('II')) return true;
    if (normExcel.includes('I') && !normExcel.includes('II') && !normExcel.includes('III') && !normOficial.includes('II') && !normOficial.includes('III')) return true;
    if (!normExcel.includes('II') && !normExcel.includes('III') && !normExcel.includes('IV')) return true;
  }

  if (normExcel.includes('PFYH') && normOficial.includes('HUMANIDADES')) {
    if (normExcel.includes('III') && normOficial.includes('III')) return true;
    if (normExcel.includes('IV') && normOficial.includes('IV')) return true;
    if (normExcel.includes('II') && normOficial.includes('II')) return true;
    if (normExcel.includes('1') || normExcel.includes('I')) return true;
  }

  if (normExcel.includes('PENSAMIENTO MATEMATICO') && normOficial.includes('PENSAMIENTO MATEMATICO')) {
    if (normExcel.includes('III') && normOficial.includes('III')) return true;
    if (normExcel.includes('IV') && normOficial.includes('IV')) return true;
    if (normExcel.includes('II') && normOficial.includes('II')) return true;
    if (normExcel.includes('I') && !normExcel.includes('II') && !normExcel.includes('III') && !normOficial.includes('II') && !normOficial.includes('III')) return true;
  }

  if ((normExcel.includes('LENGUAJE Y COMUNICACION') || normExcel.includes('LENGUA Y COMUNICACION')) &&
      (normOficial.includes('LENGUAJE Y COMUNICACION') || normOficial.includes('LENGUA Y COMUNICACION'))) {
    if (normExcel.includes('III') && normOficial.includes('III')) return true;
    if (normExcel.includes('IV') && normOficial.includes('IV')) return true;
    if (normExcel.includes('II') && normOficial.includes('II')) return true;
    if (normExcel.includes('I') && !normExcel.includes('II') && !normExcel.includes('III')) return true;
  }

  if (normExcel.includes('INGLES') && normOficial.includes('INGLES')) {
    if (normExcel.includes('III') && normOficial.includes('III')) return true;
    if (normExcel.includes('IV') && normOficial.includes('IV')) return true;
    if (normExcel.includes('II') && normOficial.includes('II')) return true;
    if (normExcel.includes('I') && !normExcel.includes('II') && !normExcel.includes('III')) return true;
  }

  if (normExcel.includes('CULTURA DIGITAL') && normOficial.includes('CULTURA DIGITAL')) {
    if (normExcel.includes('II') && normOficial.includes('II')) return true;
    if (!normExcel.includes('II')) return true;
  }

  if (normExcel.includes('CIENCIAS SOCIALES') && normOficial.includes('CIENCIAS SOCIALES')) {
    if (normExcel.includes('II') && normOficial.includes('II')) return true;
    if (!normExcel.includes('II')) return true;
  }

  if (normExcel.includes('ACTIVIDADES FISICAS') && normOficial.includes('ACTIVIDADES FISICAS')) return true;
  if (normExcel.includes('ENERGIA EN LOS PROCESOS') && normOficial.includes('ENERGIA')) return true;
  if (normExcel.includes('CONCIENCIA HISTORICA') && normOficial.includes('CONCIENCIA HISTORICA')) return true;
  if (normExcel.includes('HABILIDADES DEL PENSAMIENTO') && normOficial.includes('HABILIDADES DEL PENSAMIENTO')) return true;
  if (normExcel.includes('TALLER DE CIENCIAS') && normOficial.includes('TALLER DE CIENCIAS')) return true;
  if (normExcel.includes('EDUCACION PARA LA SALUD') && normOficial.includes('SALUD')) return true;
  if (normExcel.includes('PRACTICA Y COLABORACION') && normOficial.includes('PRACTICA')) return true;

  // Formación Laboral
  if (normExcel.includes('LABORAL') && uacTipo?.includes('LABORAL')) {
    if (normExcel.includes('"A"') || normExcel.includes(' A') || normExcel.endsWith('A') || normExcel.includes('LABORAL A') || normExcel.includes('LABORAL 1') || normExcel.includes('1')) {
      if (uacTipo === 'LABORAL_A') return true;
    }
    if (normExcel.includes('"B"') || normExcel.includes(' B') || normExcel.endsWith('B') || normExcel.includes('LABORAL B') || normExcel.includes('LABORAL 2') || normExcel.includes('2')) {
      if (uacTipo === 'LABORAL_B') return true;
    }
    return true;
  }

  // FFE Optativas
  if (normExcel.includes('OPTATIVA') || normExcel.includes('EXTENDIDA') || normExcel.includes('FFE')) {
    if (normExcel.includes('1') || (normExcel.includes(' I') && !normExcel.includes('II') && !normExcel.includes('III') && !normExcel.includes('IV'))) {
      if (uacTipo === 'FFE_1') return true;
    }
    if (normExcel.includes('2') || (normExcel.includes(' II') && !normExcel.includes('III'))) {
      if (uacTipo === 'FFE_2') return true;
    }
    if (normExcel.includes('3') || normExcel.includes(' III')) {
      if (uacTipo === 'FFE_3') return true;
    }
    if (normExcel.includes('4') || normExcel.includes(' IV')) {
      if (uacTipo === 'FFE_4') return true;
    }
    if (uacTipo?.includes('FFE')) return true;
  }

  // Comparación por contención de palabras clave
  const palabrasExcel = normExcel.split(/\s+/).filter(p => p.length > 3);
  const palabrasOficial = normOficial.split(/\s+/).filter(p => p.length > 3);
  const coincidencias = palabrasExcel.filter(p => palabrasOficial.includes(p));

  if (palabrasOficial.length > 0 && coincidencias.length / palabrasOficial.length >= 0.4) {
    return true;
  }

  return false;
}

/**
 * Busca al docente más coincidente en el catálogo de personal
 */
function buscarDocenteCoincidente(
  textoDocente: string,
  docentesDisponibles: any[]
): { personalId?: string; docenteNombreMatch?: string; confianza: 'EXACTA' | 'MEDIA' | 'NO_ENCONTRADO' | 'VACIO' } {
  const t = limpiarTexto(textoDocente);
  if (!t || t === '- SIN ASIGNAR -' || t === 'SIN ASIGNAR' || t === '-' || t === 'VACANTE' || t === 'POR ASIGNAR') {
    return { confianza: 'VACIO' };
  }

  // 1. Coincidencia exacta de nombre completo
  for (const d of docentesDisponibles) {
    const nomCompleto = limpiarTexto(`${d.nombre || ''} ${d.apellidoPaterno || ''} ${d.apellidoMaterno || ''}`);
    const nomInvertido = limpiarTexto(`${d.apellidoPaterno || ''} ${d.apellidoMaterno || ''} ${d.nombre || ''}`);
    if (t === nomCompleto || t === nomInvertido) {
      return {
        personalId: d.id,
        docenteNombreMatch: `${d.nombre} ${d.apellidoPaterno} ${d.apellidoMaterno || ''}`.trim(),
        confianza: 'EXACTA',
      };
    }
  }

  // 2. Coincidencia de nombre de pila exacto (ej. "JOSE ALAIN", "ROSELIA", "HUMBERTA")
  for (const d of docentesDisponibles) {
    const nomPila = limpiarTexto(d.nombre || '');
    if (nomPila && (t === nomPila || nomPila === t)) {
      return {
        personalId: d.id,
        docenteNombreMatch: `${d.nombre} ${d.apellidoPaterno} ${d.apellidoMaterno || ''}`.trim(),
        confianza: 'EXACTA',
      };
    }
  }

  // 3. Coincidencia por apellidos (ej. "HERNANDEZ CRUZ", "MARTINEZ LUNA")
  for (const d of docentesDisponibles) {
    const aps = limpiarTexto(`${d.apellidoPaterno || ''} ${d.apellidoMaterno || ''}`);
    if (aps && t === aps) {
      return {
        personalId: d.id,
        docenteNombreMatch: `${d.nombre} ${d.apellidoPaterno} ${d.apellidoMaterno || ''}`.trim(),
        confianza: 'EXACTA',
      };
    }
  }

  // 4. Coincidencia parcial o por palabras clave (ej: "ADRIAN" dentro de "HERNANDEZ CRUZ ADRIAN" o "FLORES HUMBERTA")
  const palabrasTexto = t.split(/\s+/).filter(p => p.length > 2);
  let mejorCandidato: any = null;
  let maxPuntos = 0;

  for (const d of docentesDisponibles) {
    const textoDocenteDB = limpiarTexto(`${d.nombre || ''} ${d.apellidoPaterno || ''} ${d.apellidoMaterno || ''}`);
    let puntos = 0;
    for (const pal of palabrasTexto) {
      if (textoDocenteDB.includes(pal)) {
        puntos += 1;
      }
    }
    if (puntos > maxPuntos) {
      maxPuntos = puntos;
      mejorCandidato = d;
    }
  }

  if (mejorCandidato && maxPuntos >= 1) {
    return {
      personalId: mejorCandidato.id,
      docenteNombreMatch: `${mejorCandidato.nombre} ${mejorCandidato.apellidoPaterno} ${mejorCandidato.apellidoMaterno || ''}`.trim(),
      confianza: maxPuntos >= 2 ? 'EXACTA' : 'MEDIA',
    };
  }

  return {
    confianza: 'NO_ENCONTRADO',
  };
}

/**
 * Parsea un archivo Excel / CSV con formato de Matriz por Semestre
 */
export async function parsearExcelMatriz(
  file: File,
  gruposActivos: any[],
  getUACsGrupoFn: (grupo: any) => any[],
  personalDocente: any[]
): Promise<ResultadoParseoMatriz> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const cargasResultado: CargaImportada[] = [];
  const gruposDetectadosSet = new Set<string>();

  // Recorrer todas las hojas de cálculo del libro
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convertir hoja a matriz 2D
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!data || data.length === 0) continue;

    // Buscar filas de encabezado con columnas de grupos (ej. "1° A", "1A", "2A", "3A", etc.)
    for (let r = 0; r < data.length; r++) {
      const fila = data[r];
      if (!fila || fila.length === 0) continue;

      // Buscar si esta fila es un encabezado de grupos
      const columnasGrupos: { colIdx: number; grupo: any }[] = [];

      for (let c = 0; c < fila.length; c++) {
        const celda = String(fila[c] || '').trim();
        if (!celda) continue;

        const grupoNormalizado = normalizarNombreGrupo(celda);
        const grupoEncontrado = gruposActivos.find(
          g => normalizarNombreGrupo(g.nombre) === grupoNormalizado ||
               limpiarTexto(g.nombre) === limpiarTexto(celda) ||
               g.nombre.replace(/\s+/g, '').toUpperCase() === celda.replace(/\s+/g, '').toUpperCase()
        );

        if (grupoEncontrado) {
          columnasGrupos.push({ colIdx: c, grupo: grupoEncontrado });
          gruposDetectadosSet.add(grupoEncontrado.nombre);
        }
      }

      // Si encontramos columnas de grupos en esta fila, procesar las filas de materias siguientes
      if (columnasGrupos.length > 0) {
        const sem = columnasGrupos[0].grupo.semestre;
        const gruposSem = gruposActivos.filter(g => g.semestre === sem);
        const uacsBase = gruposSem.length > 0 ? getUACsGrupoFn(gruposSem[0]) : [];
        let materiaFilaIdx = 0;

        for (let mRow = r + 1; mRow < data.length; mRow++) {
          const filaMateria = data[mRow];
          if (!filaMateria || filaMateria.length === 0) continue;

          // Si nos topamos con un título de otro semestre o encabezado explícito, detener este bloque
          const celda0 = String(filaMateria[0] || '').trim();
          const esSeparadorSemestre = celda0.includes('---') || celda0.toUpperCase().includes('SEMESTRE');
          if (esSeparadorSemestre) {
            break;
          }

          const textoMateria = String(filaMateria[0] || filaMateria[1] || '').trim();
          if (!textoMateria || textoMateria.toUpperCase().includes('MATERIA') || textoMateria.toUpperCase().includes('UAC')) {
            continue;
          }

          const uacBaseFila = uacsBase[materiaFilaIdx];

          // Para cada grupo detectado en este bloque
          for (const { colIdx, grupo } of columnasGrupos) {
            const uacsGrupo = getUACsGrupoFn(grupo);

            // 1. Encontrar qué UAC corresponde a esta fila por nombre o tipo directo
            let uacMatch = uacsGrupo.find(u => coincideMateria(textoMateria, u.uacName, u.tipo));

            // 2. Si no coincide por nombre (por ser una UAC específica de Formación Laboral o FFE de otro grupo):
            if (!uacMatch && uacBaseFila) {
              if (uacBaseFila.tipo) {
                uacMatch = uacsGrupo.find(u => u.tipo === uacBaseFila.tipo);
              }
              if (!uacMatch && uacsGrupo[materiaFilaIdx]) {
                uacMatch = uacsGrupo[materiaFilaIdx];
              }
            }

            const textoDocente = String(filaMateria[colIdx] || '').trim();
            if (!textoDocente) continue;

            const uacFinalName = uacMatch ? uacMatch.uacName : textoMateria;
            const horasSemanales = uacMatch ? Number(uacMatch.horasSemanales || 3) : 3;

            const resultadoMatch = buscarDocenteCoincidente(textoDocente, personalDocente);

            cargasResultado.push({
              semestre: grupo.semestre,
              grupoId: grupo.id,
              grupoNombre: grupo.nombre,
              uacName: uacFinalName,
              horasSemanales,
              docenteTextoExcel: textoDocente,
              personalId: resultadoMatch.personalId,
              docenteNombreMatch: resultadoMatch.docenteNombreMatch,
              confianza: resultadoMatch.confianza,
              valido: resultadoMatch.confianza === 'EXACTA' || resultadoMatch.confianza === 'MEDIA',
            });
          }

          materiaFilaIdx++;
        }
      }
    }
  }

  // Si no encontró por estructura de tabla por columnas, intentar formato plano de lista
  if (cargasResultado.length === 0) {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

    for (const row of rows) {
      const gNombreRaw = row['Grupo'] || row['GRUPO'] || row['grupo'] || '';
      const uacRaw = row['Materia'] || row['MATERIA'] || row['Asignatura'] || row['UAC'] || '';
      const docRaw = row['Docente'] || row['DOCENTE'] || row['Maestro'] || row['Profesor'] || '';

      if (!gNombreRaw || !uacRaw) continue;

      const grupoNormalizado = normalizarNombreGrupo(gNombreRaw);
      const grupo = gruposActivos.find(g => normalizarNombreGrupo(g.nombre) === grupoNormalizado);
      if (!grupo) continue;

      gruposDetectadosSet.add(grupo.nombre);
      const uacsGrupo = getUACsGrupoFn(grupo);
      const uacMatch = uacsGrupo.find(u => coincideMateria(uacRaw, u.uacName, u.tipo));

      const uacFinalName = uacMatch ? uacMatch.uacName : uacRaw;
      const horasSemanales = uacMatch ? Number(uacMatch.horasSemanales || 3) : 3;
      const resultadoMatch = buscarDocenteCoincidente(docRaw, personalDocente);

      cargasResultado.push({
        semestre: grupo.semestre,
        grupoId: grupo.id,
        grupoNombre: grupo.nombre,
        uacName: uacFinalName,
        horasSemanales,
        docenteTextoExcel: docRaw,
        personalId: resultadoMatch.personalId,
        docenteNombreMatch: resultadoMatch.docenteNombreMatch,
        confianza: resultadoMatch.confianza,
        valido: resultadoMatch.confianza === 'EXACTA' || resultadoMatch.confianza === 'MEDIA',
      });
    }
  }

  // Deduplicar cargas por clave única grupoId + uacName
  const cargasMap = new Map<string, CargaImportada>();
  for (const c of cargasResultado) {
    const key = `${c.grupoId}___${c.uacName}`;
    cargasMap.set(key, c);
  }
  const cargasDeduplicadas = Array.from(cargasMap.values());

  const asignadasConExito = cargasDeduplicadas.filter(c => c.confianza === 'EXACTA' || c.confianza === 'MEDIA').length;
  const requierenRevision = cargasDeduplicadas.filter(c => c.confianza === 'NO_ENCONTRADO').length;
  const vacios = cargasDeduplicadas.filter(c => c.confianza === 'VACIO').length;

  return {
    cargas: cargasDeduplicadas,
    resumen: {
      totalAsignaciones: cargasDeduplicadas.length,
      asignadasConExito,
      requierenRevision,
      vacios,
    },
    gruposDetectados: Array.from(gruposDetectadosSet),
  };
}

export interface ResultadoLibroIntegral {
  docentes: DocenteImportado[];
  matriz: ResultadoParseoMatriz;
  tienePersonal: boolean;
  tieneMatriz: boolean;
}

import { DocenteImportado, normalizarCargo } from './excel-plantilla';

function buscarValorColumnaFila(row: Record<string, any>, palabrasClave: string[]): any {
  const keys = Object.keys(row);
  for (const k of keys) {
    const kNorm = k.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const kw of palabrasClave) {
      if (kNorm === kw || kNorm.includes(kw)) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return row[k];
        }
      }
    }
  }
  return undefined;
}

function separarNombre(nombreCompleto: string) {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length === 1) return { nombre: partes[0], apellidoPaterno: '.', apellidoMaterno: '' };
  if (partes.length === 2) return { nombre: partes[0], apellidoPaterno: partes[1], apellidoMaterno: '' };
  if (partes.length === 3) return { nombre: partes[0], apellidoPaterno: partes[1], apellidoMaterno: partes[2] };
  if (partes.length === 4) return { nombre: `${partes[0]} ${partes[1]}`, apellidoPaterno: partes[2], apellidoMaterno: partes[3] };
  const apellidoMaterno = partes[partes.length - 1];
  const apellidoPaterno = partes[partes.length - 2];
  const nombre = partes.slice(0, partes.length - 2).join(' ');
  return { nombre, apellidoPaterno, apellidoMaterno };
}

/**
 * Parsea un Libro de Excel Integral (que puede contener Hoja 1: Personal y Hoja 2: Matriz Horaria)
 */
export async function parsearLibroIntegralExcel(
  file: File,
  gruposActivos: any[],
  getUACsGrupoFn: (grupo: any) => any[],
  personalExistente: any[] = []
): Promise<ResultadoLibroIntegral> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  let docentesImportados: DocenteImportado[] = [];
  let tienePersonal = false;

  // 1. Buscar y parsear Hoja de Personal
  const sheetPersonalName = workbook.SheetNames.find(name => {
    const n = limpiarTexto(name);
    return n.includes('PERSONAL') || n.includes('DOCENTE') || n.includes('PLANTILLA') || n.includes('PROFESOR');
  });

  // Si encontramos una hoja explícita de personal o la primera hoja contiene columnas de personal
  const sheetPersonalTarget = sheetPersonalName ? workbook.Sheets[sheetPersonalName] : (workbook.SheetNames.length === 1 ? workbook.Sheets[workbook.SheetNames[0]] : null);

  if (sheetPersonalTarget) {
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheetPersonalTarget, { defval: '' });
    for (const row of rawRows) {
      const nombreDirecto = buscarValorColumnaFila(row, ['nombre(s)', 'nombres', 'nombre', 'first name']);
      const paternoDirecto = buscarValorColumnaFila(row, ['apellido paterno', 'primer apellido', 'paterno', 'last name', 'apellido 1']);
      const maternoDirecto = buscarValorColumnaFila(row, ['apellido materno', 'segundo apellido', 'materno', 'apellido 2']);
      const nombreCompleto = buscarValorColumnaFila(row, ['nombre completo', 'docente', 'profesor', 'personal', 'maestro', 'empleado']);
      const cargoRaw = buscarValorColumnaFila(row, ['cargo', 'rol', 'puesto', 'funcion', 'tipo']);
      const horasRaw = buscarValorColumnaFila(row, ['horas base', 'horas contratadas', 'horas asignadas', 'horas frente a grupo', 'horas semana', 'horas', 'hrs']);
      const emailRaw = buscarValorColumnaFila(row, ['correo electronico', 'correo', 'email', 'e-mail']);

      let nombre = '';
      let apellidoPaterno = '';
      let apellidoMaterno = '';

      if (nombreDirecto && paternoDirecto) {
        nombre = String(nombreDirecto).trim();
        apellidoPaterno = String(paternoDirecto).trim();
        apellidoMaterno = maternoDirecto ? String(maternoDirecto).trim() : '';
      } else if (nombreDirecto && !paternoDirecto) {
        const sep = separarNombre(String(nombreDirecto));
        nombre = sep.nombre;
        apellidoPaterno = sep.apellidoPaterno;
        apellidoMaterno = maternoDirecto ? String(maternoDirecto).trim() : sep.apellidoMaterno;
      } else if (nombreCompleto) {
        const sep = separarNombre(String(nombreCompleto));
        nombre = sep.nombre;
        apellidoPaterno = sep.apellidoPaterno;
        apellidoMaterno = sep.apellidoMaterno;
      }

      if (nombre || apellidoPaterno) {
        const cargo = normalizarCargo(cargoRaw);
        let horas = Number(horasRaw);
        if (isNaN(horas) || horas < 0) horas = cargo === 'DOCENTE' ? 20 : 0;
        if (horas > 50) horas = 50;

        const valido = Boolean(nombre && apellidoPaterno && apellidoPaterno !== '.');
        docentesImportados.push({
          nombre,
          apellidoPaterno,
          apellidoMaterno,
          cargo,
          horasBase: horas,
          email: emailRaw ? String(emailRaw).trim() : '',
          valido,
          motivoInvalido: !valido ? (!nombre ? 'Falta el nombre' : 'Falta el apellido paterno') : undefined,
        });
      }
    }

    if (docentesImportados.length > 0) {
      tienePersonal = true;
    }
  }

  // 2. Combinar personal existente + nuevos del Excel para la resolución de la Matriz
  const personalCombinado = [...personalExistente];
  docentesImportados.filter(d => d.valido).forEach((d, idx) => {
    const yaExiste = personalCombinado.some(
      pe => limpiarTexto(`${pe.nombre} ${pe.apellidoPaterno}`) === limpiarTexto(`${d.nombre} ${d.apellidoPaterno}`)
    );
    if (!yaExiste) {
      personalCombinado.push({
        id: `temp_excel_${idx}_${Date.now()}`,
        nombre: d.nombre,
        apellidoPaterno: d.apellidoPaterno,
        apellidoMaterno: d.apellidoMaterno,
        cargo: d.cargo,
        horas_base: d.horasBase,
        horasAsignadas: d.horasBase,
      });
    }
  });

  // 3. Parsear Matriz Horaria
  const matriz = await parsearExcelMatriz(file, gruposActivos, getUACsGrupoFn, personalCombinado);
  const tieneMatriz = matriz.cargas.length > 0;

  return {
    docentes: docentesImportados,
    matriz,
    tienePersonal,
    tieneMatriz,
  };
}

/**
 * Genera y descarga un Libro de Excel Integral (Personal + Matriz por Grupos + Instrucciones)
 * personalizado con los grupos, materias y docentes del plantel
 */
export function descargarPlantillaIntegralHorarios(
  grupos: any[],
  periodoActivo: 'A' | 'B',
  getUACsGrupoFn: (grupo: any) => any[],
  docentesDisponibles: any[] = []
) {
  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // HOJA 1: PLANTILLA DE PERSONAL (Docentes, Directivos, Administrativos)
  // -------------------------------------------------------------
  const filasPersonal: any[][] = [
    ['Nombre(s)', 'Apellido Paterno', 'Apellido Materno', 'Cargo / Rol', 'Horas Base', 'Correo Electrónico'],
  ];

  if (docentesDisponibles.length > 0) {
    docentesDisponibles.forEach(d => {
      filasPersonal.push([
        d.nombre || '',
        d.apellidoPaterno || d.apellido_paterno || '',
        d.apellidoMaterno || d.apellido_materno || '',
        d.cargo || 'Docente',
        d.horasAsignadas ?? d.horas_base ?? (d.cargo === 'DIRECTIVO' || d.cargo === 'ADMINISTRATIVO' ? 0 : 20),
        d.email || '',
      ]);
    });
  }

  const wsPersonal = XLSX.utils.aoa_to_sheet(filasPersonal);
  wsPersonal['!cols'] = [
    { wch: 22 }, // Nombre
    { wch: 18 }, // Paterno
    { wch: 18 }, // Materno
    { wch: 16 }, // Cargo
    { wch: 14 }, // Horas
    { wch: 30 }, // Correo
  ];
  XLSX.utils.book_append_sheet(wb, wsPersonal, '1_Plantilla_Personal');

  // -------------------------------------------------------------
  // HOJA 2: MATRIZ DE HORARIOS (Configurada según los grupos del Paso 1)
  // -------------------------------------------------------------
  const semestres = periodoActivo === 'A' ? [1, 3, 5] : [2, 4, 6];
  const filasMatriz: any[][] = [];

  filasMatriz.push([`MATRIZ DE ASIGNACIÓN DOCENTE POR GRUPO - PERÍODO ${periodoActivo === 'A' ? 'A (1º, 3º, 5º)' : 'B (2º, 4º, 6º)'}`]);
  filasMatriz.push(['Instrucciones: En cada columna de grupo, escriba el nombre o apellidos del docente que impartirá la materia.']);
  filasMatriz.push([]);

  for (const sem of semestres) {
    const gruposSem = grupos.filter(g => g.semestre === sem);
    if (gruposSem.length === 0) continue;

    const headerFila = ['Materia (UAC)', 'Horas'];
    gruposSem.forEach(g => {
      headerFila.push(g.nombre);
    });

    filasMatriz.push([`--- ${sem}° SEMESTRE ---`]);
    filasMatriz.push(headerFila);

    const uacsBase = getUACsGrupoFn(gruposSem[0]);

    uacsBase.forEach((uac) => {
      let nombreUacMostrar = uac.uacName;
      if (uac.tipo === 'LABORAL_A') {
        const caps = Array.from(new Set(gruposSem.map(g => g.capacitacionNombre).filter(Boolean)));
        if (caps.length > 1) {
          nombreUacMostrar = `Formación Laboral "A"`;
        }
      } else if (uac.tipo === 'LABORAL_B') {
        const caps = Array.from(new Set(gruposSem.map(g => g.capacitacionNombre).filter(Boolean)));
        if (caps.length > 1) {
          nombreUacMostrar = `Formación Laboral "B"`;
        }
      } else if (uac.tipo === 'FFE_1') {
        nombreUacMostrar = `Formación Fundamental Extendida (Optativa FFE 1)`;
      } else if (uac.tipo === 'FFE_2') {
        nombreUacMostrar = `Formación Fundamental Extendida (Optativa FFE 2)`;
      } else if (uac.tipo === 'FFE_3') {
        nombreUacMostrar = `Formación Fundamental Extendida (Optativa FFE 3)`;
      } else if (uac.tipo === 'FFE_4') {
        nombreUacMostrar = `Formación Fundamental Extendida (Optativa FFE 4)`;
      }

      const filaMateria: any[] = [nombreUacMostrar, `${uac.horasSemanales || 3}h`];
      gruposSem.forEach(() => {
        filaMateria.push('');
      });
      filasMatriz.push(filaMateria);
    });

    filasMatriz.push([]);
  }

  const wsMatriz = XLSX.utils.aoa_to_sheet(filasMatriz);
  wsMatriz['!cols'] = [
    { wch: 45 },
    { wch: 8 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMatriz, '2_Matriz_Horarios');

  // -------------------------------------------------------------
  // HOJA 3: INSTRUCCIONES RÁPIDAS
  // -------------------------------------------------------------
  const filasInstrucciones: any[][] = [
    ['GUÍA DE USO DE LA PLANTILLA INTEGRAL DE HORARIOS'],
    [],
    ['1. HOJA "1_Plantilla_Personal":'],
    ['   - Registre o actualice los nombres y horas de su plantilla docente y directiva.'],
    ['   - El sistema los guardará automáticamente en el catálogo de su escuela.'],
    [],
    ['2. HOJA "2_Matriz_Horarios":'],
    ['   - Asigne las materias escribiendo el nombre o apellido del docente en la columna de cada grupo.'],
    ['   - Los nombres pueden escribirse en mayúsculas, minúsculas o abreviados (ej. "JOSE ALAIN", "ROSELIA", "HERNANDEZ PEREZ").'],
    [],
    ['3. CARGA EN LA PLATAFORMA:'],
    ['   - Suba este mismo archivo en el Paso 2 o en el Paso 3 del Generador de Horarios.'],
    ['   - ¡La plataforma importará el personal y llenará la matriz en un solo paso!'],
  ];

  const wsInstrucciones = XLSX.utils.aoa_to_sheet(filasInstrucciones);
  wsInstrucciones['!cols'] = [{ wch: 85 }];
  XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');

  // Descargar archivo
  XLSX.writeFile(wb, `Plantilla_Integral_Horarios_${periodoActivo}.xlsx`);
}

/**
 * Alias retrocompatible
 */
export const descargarPlantillaMatrizDocente = descargarPlantillaIntegralHorarios;

