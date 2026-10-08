import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

/**
 * Obtiene el buffer del archivo Excel oficial de referencia si existe en disco.
 */
export function getReferenceAcosoExcelBuffer(): Buffer | null {
    const refPath = path.resolve(__dirname, "../../../../documentos_referencia/reportes_escuelas/21EBH0201W-TEMAS_ACOSO_ESCOLAR_2026_-_Escuelas.xlsx");
    if (fs.existsSync(refPath)) {
        return fs.readFileSync(refPath);
    }
    return null;
}

/**
 * Genera en memoria un buffer de Excel de Acoso Escolar con la estructura oficial de pestañas mensuales.
 */
export function createMockAcosoExcelBuffer(options: {
    meses?: string[];
    conIncidencias?: boolean;
    escuela?: string;
    cct?: string;
}): Buffer {
    const wb = XLSX.utils.book_new();
    const meses = options.meses || ["ENERO", "FEBRERO"];

    for (const mes of meses) {
        const rows: unknown[][] = [];
        // Filas 0 a 6: encabezados informativos
        for (let i = 0; i < 7; i++) {
            rows.push([`Encabezado ${i + 1}`, "", "", "", "", "", "", "", "", ""]);
        }

        if (options.conIncidencias && mes === "ENERO") {
            // Fila 7: Niñas / Agresión Física en fila
            rows.push(["NIÑAS", "15", "X", "", "", "", "", options.escuela || "BACHILLERATO HEROES", options.cct || "21EBH0001X", "Puebla"]);
            // Fila 8: Adolescentes / Hostigamiento
            rows.push(["ADOLESCENTES", "16", "", "X", "", "", "", options.escuela || "BACHILLERATO HEROES", options.cct || "21EBH0001X", "Puebla"]);
        } else {
            // Fila 7: Sin marcas de casos (vacío)
            rows.push(["NIÑAS", "", "", "", "", "", "", options.escuela || "BACHILLERATO HEROES", options.cct || "21EBH0001X", "Puebla"]);
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, mes);
    }

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
