import * as XLSX from 'xlsx';

export interface DocenteImportado {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  cargo: string;
  horasBase: number;
  email: string;
  valido: boolean;
  motivoInvalido?: string;
}

export function normalizarCargo(cargoRaw: any): string {
  if (!cargoRaw) return 'DOCENTE';
  const str = String(cargoRaw).trim().toUpperCase();
  if (str.includes('DOC') || str.includes('PROF') || str.includes('MAESTR') || str.includes('CATEDRATICO')) return 'DOCENTE';
  if (str.includes('DIR') || str.includes('RECT') || str.includes('SUBDIR') || str.includes('COORDINAD')) return 'DIRECTIVO';
  if (str.includes('PREF') || str.includes('DISCIPLIN')) return 'PREFECTO';
  if (str.includes('ORIENT') || str.includes('TUTOR') || str.includes('PSICO') || str.includes('TRABAJO')) return 'ORIENTADOR';
  if (str.includes('ADMIN') || str.includes('SECRET') || str.includes('OFICIN') || str.includes('CONTAB') || str.includes('ASISTEN') || str.includes('APOYO')) return 'ADMINISTRATIVO';
  return 'OTRO';
}

function buscarValorColumna(row: Record<string, any>, palabrasClave: string[]): any {
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

function separarNombreCompleto(nombreCompleto: string) {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length === 1) {
    return { nombre: partes[0], apellidoPaterno: '.', apellidoMaterno: '' };
  }
  if (partes.length === 2) {
    return { nombre: partes[0], apellidoPaterno: partes[1], apellidoMaterno: '' };
  }
  if (partes.length === 3) {
    return { nombre: partes[0], apellidoPaterno: partes[1], apellidoMaterno: partes[2] };
  }
  if (partes.length === 4) {
    // Ej: Juan Carlos Perez Gomez
    return { nombre: `${partes[0]} ${partes[1]}`, apellidoPaterno: partes[2], apellidoMaterno: partes[3] };
  }
  // Mas de 4 palabras
  const apellidoMaterno = partes[partes.length - 1];
  const apellidoPaterno = partes[partes.length - 2];
  const nombre = partes.slice(0, partes.length - 2).join(' ');
  return { nombre, apellidoPaterno, apellidoMaterno };
}

export async function parsearExcelPersonal(file: File): Promise<DocenteImportado[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const resultados: DocenteImportado[] = [];

  for (const row of rawRows) {
    // Palabras clave para cada columna
    const nombreDirecto = buscarValorColumna(row, ['nombre(s)', 'nombres', 'nombre', 'first name']);
    const paternoDirecto = buscarValorColumna(row, ['apellido paterno', 'primer apellido', 'paterno', 'last name', 'apellido 1']);
    const maternoDirecto = buscarValorColumna(row, ['apellido materno', 'segundo apellido', 'materno', 'apellido 2']);
    const nombreCompleto = buscarValorColumna(row, ['nombre completo', 'docente', 'profesor', 'personal', 'maestro', 'empleado']);
    const cargoRaw = buscarValorColumna(row, ['cargo', 'rol', 'puesto', 'funcion', 'tipo']);
    const horasRaw = buscarValorColumna(row, ['horas base', 'horas contratadas', 'horas asignadas', 'horas frente a grupo', 'horas semana', 'horas', 'hrs']);
    const emailRaw = buscarValorColumna(row, ['correo electronico', 'correo', 'email', 'e-mail']);

    let nombre = '';
    let apellidoPaterno = '';
    let apellidoMaterno = '';

    if (nombreDirecto && paternoDirecto) {
      nombre = String(nombreDirecto).trim();
      apellidoPaterno = String(paternoDirecto).trim();
      apellidoMaterno = maternoDirecto ? String(maternoDirecto).trim() : '';
    } else if (nombreDirecto && !paternoDirecto) {
      // Si solo hay campo 'nombre', vemos si contiene apellidos
      const sep = separarNombreCompleto(String(nombreDirecto));
      nombre = sep.nombre;
      apellidoPaterno = sep.apellidoPaterno;
      apellidoMaterno = maternoDirecto ? String(maternoDirecto).trim() : sep.apellidoMaterno;
    } else if (nombreCompleto) {
      const sep = separarNombreCompleto(String(nombreCompleto));
      nombre = sep.nombre;
      apellidoPaterno = sep.apellidoPaterno;
      apellidoMaterno = sep.apellidoMaterno;
    }

    const cargo = normalizarCargo(cargoRaw);
    let horas = Number(horasRaw);
    if (isNaN(horas) || horas < 0) {
      horas = cargo === 'DOCENTE' ? 20 : 0;
    }
    if (horas > 50) horas = 50;

    const email = emailRaw ? String(emailRaw).trim() : '';

    const valido = Boolean(nombre && apellidoPaterno && apellidoPaterno !== '.');
    const motivoInvalido = !valido
      ? !nombre
        ? 'Falta el nombre'
        : 'Falta el apellido paterno'
      : undefined;

    // Solo agregar si la fila tiene al menos algún dato
    if (nombre || apellidoPaterno || email || cargoRaw || horasRaw) {
      resultados.push({
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        cargo,
        horasBase: horas,
        email,
        valido,
        motivoInvalido,
      });
    }
  }

  return resultados;
}

export function descargarPlantillaExcelDocentes() {
  const encabezados = [
    ['Nombre(s)', 'Apellido Paterno', 'Apellido Materno', 'Cargo / Rol', 'Horas Base', 'Correo Electrónico'],
    ['Juan Carlos', 'Pérez', 'González', 'Docente', 20, 'juan.perez@escuela.edu.mx'],
    ['María Elena', 'Hernández', 'López', 'Docente', 30, 'maria.hernandez@escuela.edu.mx'],
    ['Carlos Alberto', 'Rodríguez', 'Sánchez', 'Docente', 15, 'carlos.rodriguez@escuela.edu.mx'],
    ['Rosa María', 'Martínez', 'Torres', 'Directivo', 0, 'directora@escuela.edu.mx'],
    ['Fernando', 'Gómez', 'Ramírez', 'Administrativo', 0, 'admin@escuela.edu.mx'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(encabezados);

  // Ancho de columnas optimizado
  ws['!cols'] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Personal');
  XLSX.writeFile(wb, 'Plantilla_Personal_Docente.xlsx');
}
