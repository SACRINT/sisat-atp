import * as XLSX from "xlsx";

export interface InconsistenciaConcentrado {
  tipo: "NIA_DUPLICADO" | "CURP_INVALIDA" | "CAMPO_VACIO" | "TOTAL_NO_CUADRA" | "CURP_DUPLICADA";
  severidad: "INFO" | "ADVERTENCIA" | "ERROR_CRITICO";
  filaNumero: number;
  columnaCampo: string;
  valorEncontrado: string;
  descripcion: string;
}

export interface ResultadoValidacionConcentrado {
  totalRegistros: number;
  totalHombres: number;
  totalMujeres: number;
  totalGeneral: number;
  inconsistencias: InconsistenciaConcentrado[];
}

function curpValida(curp: string): boolean {
  return /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(curp);
}

export function validarConcentrado(buffer: Buffer): ResultadoValidacionConcentrado {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("El archivo no contiene hojas de cálculo");

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const inconsistencias: InconsistenciaConcentrado[] = [];
  let totalHombres = 0;
  let totalMujeres = 0;
  const niasVistos = new Set<string>();
  const curpsVistas = new Set<string>();

  // Saltar fila 0 (encabezado)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rowNumber = i + 1; // 1-indexed para el usuario
    const nia = String(row[0] || "").trim();
    const curp = String(row[1] || "").trim().toUpperCase();
    const nombre = String(row[2] || "").trim();
    // col 3 = grado (no es crítico)
    const sexo = String(row[4] || "").trim().toUpperCase();

    // Validar campos vacíos
    if (!nia) {
      inconsistencias.push({
        tipo: "CAMPO_VACIO",
        severidad: "ERROR_CRITICO",
        filaNumero: rowNumber,
        columnaCampo: "NIA",
        valorEncontrado: "",
        descripcion: `Fila ${rowNumber}: NIA vacío`,
      });
    }
    if (!curp) {
      inconsistencias.push({
        tipo: "CAMPO_VACIO",
        severidad: "ERROR_CRITICO",
        filaNumero: rowNumber,
        columnaCampo: "CURP",
        valorEncontrado: "",
        descripcion: `Fila ${rowNumber}: CURP vacía`,
      });
    }
    if (!nombre) {
      inconsistencias.push({
        tipo: "CAMPO_VACIO",
        severidad: "ADVERTENCIA",
        filaNumero: rowNumber,
        columnaCampo: "NOMBRE",
        valorEncontrado: "",
        descripcion: `Fila ${rowNumber}: Nombre vacío`,
      });
    }

    // Validar CURP formato
    if (curp && !curpValida(curp)) {
      inconsistencias.push({
        tipo: "CURP_INVALIDA",
        severidad: "ADVERTENCIA",
        filaNumero: rowNumber,
        columnaCampo: "CURP",
        valorEncontrado: curp,
        descripcion: `Fila ${rowNumber}: CURP no tiene formato válido (18 caracteres)`,
      });
    }

    // Validar NIA duplicado
    if (nia) {
      if (niasVistos.has(nia)) {
        inconsistencias.push({
          tipo: "NIA_DUPLICADO",
          severidad: "ERROR_CRITICO",
          filaNumero: rowNumber,
          columnaCampo: "NIA",
          valorEncontrado: nia,
          descripcion: `NIA ${nia} duplicado en fila ${rowNumber}`,
        });
      }
      niasVistos.add(nia);
    }

    // Validar CURP duplicada
    if (curp) {
      if (curpsVistas.has(curp)) {
        inconsistencias.push({
          tipo: "CURP_DUPLICADA",
          severidad: "ERROR_CRITICO",
          filaNumero: rowNumber,
          columnaCampo: "CURP",
          valorEncontrado: curp,
          descripcion: `CURP ${curp} duplicada en fila ${rowNumber}`,
        });
      }
      curpsVistas.add(curp);
    }

    // Contar sexo
    if (sexo === "H") totalHombres++;
    else if (sexo === "M") totalMujeres++;
  }

  return {
    totalRegistros: niasVistos.size,
    totalHombres,
    totalMujeres,
    totalGeneral: totalHombres + totalMujeres,
    inconsistencias,
  };
}
