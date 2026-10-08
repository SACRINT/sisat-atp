import * as XLSX from "xlsx";
import crypto from "crypto";

export interface DesgloseEdad {
    h: number;
    m: number;
}

export interface DetalleGradoInput {
    semestreGrado: number; // 1 a 6
    hombres: number;
    mujeres: number;
    total: number;
    grupos: number;
    desgloseEdades?: Record<string, DesgloseEdad>;
}

export interface Inconsistencia911 {
    tipo: "DESCUADRE_GENERO" | "DESCUADRE_EDADES" | "DESCUADRE_TOTAL" | "FALTA_GRUPOS" | "FALTA_DOCENTES" | "VALOR_INVALIDO" | "DISCREPANCIA_SICEP";
    severidad: "INFO" | "ADVERTENCIA" | "ERROR_CRITICO";
    semestreGrado?: number;
    campo: string;
    descripcion: string;
    detalles?: Record<string, unknown>;
}

export interface ResultadoCruceSicep {
    matricula911Total: number;
    matriculaSicepTotal: number;
    diferencia: number;
    porcentajeVariacion: number;
    hayDiscrepancia: boolean;
    inconsistencia?: Inconsistencia911;
}

export interface DatosFormato911 {
    cct?: string;
    nombreEscuela?: string;
    tipoCorte?: "INICIO_DE_CURSOS" | "FIN_DE_CURSOS";
    totalAlumnos?: number;
    matriculaSicep?: number;
    totalDocentes?: number;
    totalAprobados?: number;
    totalReprobados?: number;
    totalEgresados?: number;
    totalDesercion?: number;
    grados: DetalleGradoInput[];
}

export interface ResultadoValidacion911 {
    totalHombres: number;
    totalMujeres: number;
    totalAlumnos: number;
    totalGrupos: number;
    totalDocentes: number;
    totalAprobados: number;
    totalReprobados: number;
    totalEgresados: number;
    totalDesercion: number;
    inconsistencias: Inconsistencia911[];
    detallesGrados: DetalleGradoInput[];
    esValido: boolean;
    sha256Hash: string;
}

/**
 * Calcula el hash SHA-256 de un buffer para trazabilidad
 */
export function calcularSha256(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Valida la consistencia entre la matrícula reportada en el formato 911 y el padrón de SICEP.
 * Emite una inconsistencia tipo DISCREPANCIA_SICEP si la variación relativa supera el umbral (10% por defecto).
 */
export function validarCruceSicep(
    matricula911Total: number,
    matriculaSicepTotal: number,
    toleranciaPorcentaje = 0.10
): ResultadoCruceSicep {
    const diff = Math.abs(matriculaSicepTotal - matricula911Total);
    const variacion = matricula911Total > 0 ? (diff / matricula911Total) : (matriculaSicepTotal > 0 ? 1 : 0);
    const hayDiscrepancia = variacion > toleranciaPorcentaje;

    let inconsistencia: Inconsistencia911 | undefined;
    if (hayDiscrepancia) {
        inconsistencia = {
            tipo: "DISCREPANCIA_SICEP",
            severidad: "ADVERTENCIA",
            campo: "Matrícula SICEP vs 911",
            descripcion: `Variación del ${Math.round(variacion * 100)}% entre matrícula 911 (${matricula911Total}) y SICEP (${matriculaSicepTotal}) excede la tolerancia del ${Math.round(toleranciaPorcentaje * 100)}%.`,
            detalles: {
                matricula911Total,
                matriculaSicepTotal,
                diferencia: diff,
                porcentajeVariacion: Math.round(variacion * 100)
            }
        };
    }

    return {
        matricula911Total,
        matriculaSicepTotal,
        diferencia: diff,
        porcentajeVariacion: variacion,
        hayDiscrepancia,
        inconsistencia
    };
}

/**
 * Valida aritméticamente los datos de un formato 911
 */
export function validarAritmetica911(datos: DatosFormato911, sha256 = ""): ResultadoValidacion911 {
    const inconsistencias: Inconsistencia911[] = [];
    let calcHombres = 0;
    let calcMujeres = 0;
    let calcTotal = 0;
    let calcGrupos = 0;

    const normalizadosGrados: DetalleGradoInput[] = [];

    // Validar cada grado/semestre
    for (const g of datos.grados) {
        const h = Math.max(0, Number(g.hombres) || 0);
        const m = Math.max(0, Number(g.mujeres) || 0);
        const t = Math.max(0, Number(g.total) || 0);
        const gr = Math.max(0, Number(g.grupos) || 0);

        // Regla 1: Hombres + Mujeres = Total
        if (h + m !== t) {
            inconsistencias.push({
                tipo: "DESCUADRE_GENERO",
                severidad: "ERROR_CRITICO",
                semestreGrado: g.semestreGrado,
                campo: `Semestre ${g.semestreGrado} - Matrícula`,
                descripcion: `Descuadre de género en ${g.semestreGrado}° Semestre: Hombres (${h}) + Mujeres (${m}) = ${h + m}, pero se reportó un total de ${t}.`,
                detalles: { hombres: h, mujeres: m, sumaCalculada: h + m, totalReportado: t }
            });
        }

        // Regla 2: Suma de edades = Total del grado
        if (g.desgloseEdades && Object.keys(g.desgloseEdades).length > 0) {
            let sumaEdadesH = 0;
            let sumaEdadesM = 0;
            for (const edad in g.desgloseEdades) {
                sumaEdadesH += Number(g.desgloseEdades[edad].h) || 0;
                sumaEdadesM += Number(g.desgloseEdades[edad].m) || 0;
            }
            const sumaEdadesTotal = sumaEdadesH + sumaEdadesM;

            if (sumaEdadesTotal !== t) {
                inconsistencias.push({
                    tipo: "DESCUADRE_EDADES",
                    severidad: "ERROR_CRITICO",
                    semestreGrado: g.semestreGrado,
                    campo: `Semestre ${g.semestreGrado} - Edades`,
                    descripcion: `Descuadre por edades en ${g.semestreGrado}° Semestre: La suma de alumnos por edad (${sumaEdadesTotal}) no coincide con el total reportado (${t}).`,
                    detalles: { sumaEdadesH, sumaEdadesM, sumaEdadesTotal, totalReportado: t }
                });
            }
        }

        // Regla 3: Si hay alumnos, debe haber al menos un grupo
        if (t > 0 && gr === 0) {
            inconsistencias.push({
                tipo: "FALTA_GRUPOS",
                severidad: "ADVERTENCIA",
                semestreGrado: g.semestreGrado,
                campo: `Semestre ${g.semestreGrado} - Grupos`,
                descripcion: `En ${g.semestreGrado}° Semestre se reportan ${t} alumnos pero 0 grupos asignados.`,
                detalles: { totalAlumnos: t, grupos: gr }
            });
        }

        calcHombres += h;
        calcMujeres += m;
        calcTotal += t;
        calcGrupos += gr;

        normalizadosGrados.push({
            semestreGrado: g.semestreGrado,
            hombres: h,
            mujeres: m,
            total: t,
            grupos: gr,
            desgloseEdades: g.desgloseEdades
        });
    }

    // Regla 4: Matrícula total mayor a cero
    if (calcTotal === 0) {
        inconsistencias.push({
            tipo: "VALOR_INVALIDO",
            severidad: "ERROR_CRITICO",
            campo: "Matrícula Total",
            descripcion: "La matrícula total del plantel reportada es 0.",
        });
    }

    // Regla 5: Docentes
    const doc = Math.max(0, Number(datos.totalDocentes) || 0);
    if (calcTotal > 0 && doc === 0) {
        inconsistencias.push({
            tipo: "FALTA_DOCENTES",
            severidad: "ADVERTENCIA",
            campo: "Docentes",
            descripcion: "No se reportaron docentes frente a grupo para el plantel.",
            detalles: { docentes: doc }
        });
    }

    // Regla 6: Descuadre Total Global
    if (typeof datos.totalAlumnos === "number" && datos.totalAlumnos !== calcTotal) {
        inconsistencias.push({
            tipo: "DESCUADRE_TOTAL",
            severidad: "ERROR_CRITICO",
            campo: "Matrícula Total Global",
            descripcion: `Descuadre global: la suma de grados (${calcTotal}) no coincide con la matrícula total reportada (${datos.totalAlumnos}).`,
            detalles: { sumaCalculada: calcTotal, totalReportado: datos.totalAlumnos }
        });
    }

    // Regla 7: Cruce con SICEP si se provee matrícula de control
    if (typeof datos.matriculaSicep === "number") {
        const cruce = validarCruceSicep(calcTotal, datos.matriculaSicep);
        if (cruce.inconsistencia) {
            inconsistencias.push(cruce.inconsistencia);
        }
    }

    const tieneCriticos = inconsistencias.some(i => i.severidad === "ERROR_CRITICO");

    return {
        totalHombres: calcHombres,
        totalMujeres: calcMujeres,
        totalAlumnos: calcTotal,
        totalGrupos: calcGrupos,
        totalDocentes: doc,
        totalAprobados: Number(datos.totalAprobados) || 0,
        totalReprobados: Number(datos.totalReprobados) || 0,
        totalEgresados: Number(datos.totalEgresados) || 0,
        totalDesercion: Number(datos.totalDesercion) || 0,
        inconsistencias,
        detallesGrados: normalizadosGrados,
        esValido: !tieneCriticos,
        sha256Hash: sha256
    };
}

/**
 * Lee y procesa un archivo Excel de formato 911 oficial
 */
export function procesarFormato911Excel(buffer: Buffer): ResultadoValidacion911 {
    const sha256 = calcularSha256(buffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    let cct = "";
    const nombreEscuela = "";
    let totalDocentes = 0;
    const grados: DetalleGradoInput[] = [];

    // Inicializar los 6 semestres de bachillerato
    const semestresMap: Record<number, DetalleGradoInput> = {
        1: { semestreGrado: 1, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
        2: { semestreGrado: 2, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
        3: { semestreGrado: 3, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
        4: { semestreGrado: 4, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
        5: { semestreGrado: 5, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
        6: { semestreGrado: 6, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
    };

    // Recorrer filas buscando encabezados y valores numéricos
    for (let r = 0; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row || row.length === 0) continue;

        const rowText = row.map(c => String(c ?? "").toUpperCase()).join(" ");

        // Detección de CCT
        const matchCct = rowText.match(/21[A-Z0-9]{8}/);
        if (matchCct && !cct) {
            cct = matchCct[0];
        }

        // Detección de Docentes
        if (rowText.includes("DOCENTE") || rowText.includes("PROFESOR") || rowText.includes("PERSONAL DOCENTE")) {
            for (const cell of row) {
                const n = Number(cell);
                if (!isNaN(n) && n > 0 && n < 200 && totalDocentes === 0) {
                    totalDocentes = n;
                    break;
                }
            }
        }

        // Búsqueda por semestres (1° a 6° o 1er a 6to)
        for (let s = 1; s <= 6; s++) {
            const semStr1 = `${s}°`;
            const semStr2 = `${s}ER`;
            const semStr3 = `${s}DO`;
            const semStr4 = `${s}TO`;
            const semStr5 = `SEMESTRE ${s}`;

            if (rowText.includes(semStr1) || rowText.includes(semStr2) || rowText.includes(semStr3) || rowText.includes(semStr4) || rowText.includes(semStr5)) {
                // Extraer números de la fila
                const nums = row.map(c => Number(c)).filter(n => !isNaN(n) && n >= 0);
                if (nums.length >= 3) {
                    // Convención típica 911: [Hombres, Mujeres, Total, Grupos...]
                    semestresMap[s].hombres = nums[0];
                    semestresMap[s].mujeres = nums[1];
                    semestresMap[s].total = nums[2];
                    if (nums.length >= 4) {
                        semestresMap[s].grupos = nums[3];
                    } else {
                        semestresMap[s].grupos = 1;
                    }
                }
            }
        }
    }

    // Convertir mapa a lista
    for (let s = 1; s <= 6; s++) {
        grados.push(semestresMap[s]);
    }

    const datos: DatosFormato911 = {
        cct,
        nombreEscuela,
        totalDocentes,
        grados
    };

    return validarAritmetica911(datos, sha256);
}

/**
 * Genera el archivo Excel del Concentrado Zonal Oficial 911
 */
export function generarConcentradoZonal911Excel(registros: {
    escuelaCCT: string;
    escuelaNombre: string;
    localidad?: string | null;
    totalHombres: number;
    totalMujeres: number;
    totalAlumnos: number;
    totalGrupos: number;
    totalDocentes: number;
    estado: string;
    sha256Hash?: string | null;
    detalles?: DetalleGradoInput[];
}[], nombreSupervision?: string): Buffer {
    const rows: (string | number)[][] = [];

    // Encabezado Oficial
    rows.push(["SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO DE PUEBLA"]);
    rows.push(["SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA - DIRECCIÓN GENERAL DE BACHILLERATOS"]);
    rows.push([nombreSupervision || (process.env.ZONA_ESCOLAR ? `SUPERVISIÓN ESCOLAR DE BACHILLERATOS GENERALES - ZONA ${process.env.ZONA_ESCOLAR}` : "SUPERVISIÓN ESCOLAR DE BACHILLERATOS GENERALES")]);
    rows.push(["CONCENTRADO ZONAL DE ESTADÍSTICA OFICIAL 911.8"]);
    rows.push([`FECHA DE GENERACIÓN: ${new Date().toLocaleDateString("es-MX", { dateStyle: "long" })}`]);
    rows.push([]); // Espacio

    // Tabla de Columnas
    rows.push([
        "No.",
        "CCT",
        "Nombre de la Escuela",
        "Localidad / Municipio",
        "1er Año (H)",
        "1er Año (M)",
        "1er Año (Tot)",
        "2do Año (H)",
        "2do Año (M)",
        "2do Año (Tot)",
        "3er Año (H)",
        "3er Año (M)",
        "3er Año (Tot)",
        "Total Hombres",
        "Total Mujeres",
        "Matrícula Total",
        "Total Grupos",
        "Total Docentes",
        "Estado Validación",
        "Integridad Hash (SHA-256)"
    ]);

    let sumHombres = 0;
    let sumMujeres = 0;
    let sumTotal = 0;
    let sumGrupos = 0;
    let sumDocentes = 0;

    registros.forEach((reg, idx) => {
        let a1H = 0, a1M = 0, a1T = 0;
        let a2H = 0, a2M = 0, a2T = 0;
        let a3H = 0, a3M = 0, a3T = 0;

        if (reg.detalles && reg.detalles.length > 0) {
            reg.detalles.forEach(d => {
                if (d.semestreGrado === 1 || d.semestreGrado === 2) {
                    a1H += d.hombres;
                    a1M += d.mujeres;
                    a1T += d.total;
                } else if (d.semestreGrado === 3 || d.semestreGrado === 4) {
                    a2H += d.hombres;
                    a2M += d.mujeres;
                    a2T += d.total;
                } else if (d.semestreGrado === 5 || d.semestreGrado === 6) {
                    a3H += d.hombres;
                    a3M += d.mujeres;
                    a3T += d.total;
                }
            });
        }

        sumHombres += reg.totalHombres;
        sumMujeres += reg.totalMujeres;
        sumTotal += reg.totalAlumnos;
        sumGrupos += reg.totalGrupos;
        sumDocentes += reg.totalDocentes;

        rows.push([
            idx + 1,
            reg.escuelaCCT,
            reg.escuelaNombre,
            reg.localidad || "N/A",
            a1H,
            a1M,
            a1T,
            a2H,
            a2M,
            a2T,
            a3H,
            a3M,
            a3T,
            reg.totalHombres,
            reg.totalMujeres,
            reg.totalAlumnos,
            reg.totalGrupos,
            reg.totalDocentes,
            reg.estado,
            reg.sha256Hash ? reg.sha256Hash.substring(0, 16) + "..." : "SIN HASH"
        ]);
    });

    // Fila de Totales
    rows.push([]);
    rows.push([
        "TOTALES",
        "",
        "CONSOLIDADO GENERAL DE ZONA",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        sumHombres,
        sumMujeres,
        sumTotal,
        sumGrupos,
        sumDocentes,
        `${registros.length} Escuelas`,
        ""
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    worksheet["!cols"] = [
        { wch: 5 },
        { wch: 14 },
        { wch: 38 },
        { wch: 22 },
        { wch: 11 },
        { wch: 11 },
        { wch: 13 },
        { wch: 11 },
        { wch: 11 },
        { wch: 13 },
        { wch: 11 },
        { wch: 11 },
        { wch: 13 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 12 },
        { wch: 14 },
        { wch: 22 },
        { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Concentrado 911 Zonal");

    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
