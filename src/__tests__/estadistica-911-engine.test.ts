import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
    validarCruceSicep,
    validarAritmetica911,
    procesarFormato911Excel,
    calcularSha256,
    DatosFormato911,
    DetalleGradoInput
} from "../lib/estadistica-911-engine";

describe("Motor Estadístico 911 y Validador de Cruces SICEP", () => {
    describe("calcularSha256", () => {
        it("debe calcular un hash sha256 hexadecimal determinista", () => {
            const buf = Buffer.from("DATOS_TEST_911");
            const hash1 = calcularSha256(buf);
            const hash2 = calcularSha256(buf);
            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64);
        });
    });

    describe("validarCruceSicep", () => {
        it("debe retornar sin discrepancia cuando ambas matrículas son idénticas", () => {
            const resultado = validarCruceSicep(250, 250);
            expect(resultado.hayDiscrepancia).toBe(false);
            expect(resultado.diferencia).toBe(0);
            expect(resultado.porcentajeVariacion).toBe(0);
            expect(resultado.inconsistencia).toBeUndefined();
        });

        it("debe retornar sin discrepancia cuando la variación relativa es menor o igual al 10%", () => {
            // Diferencia de 10 sobre base 250 = 4%
            const resultado = validarCruceSicep(250, 260);
            expect(resultado.hayDiscrepancia).toBe(false);
            expect(resultado.diferencia).toBe(10);
            expect(resultado.porcentajeVariacion).toBeCloseTo(0.04, 2);
            expect(resultado.inconsistencia).toBeUndefined();
        });

        it("debe detectar discrepancia cuando la variación es exactamente mayor al 10% (ej. 10.4%)", () => {
            // Diferencia 104 sobre base 1000 = 10.4% > 10% (H-7 test)
            const resultado = validarCruceSicep(1000, 1104);
            expect(resultado.hayDiscrepancia).toBe(true);
            expect(resultado.diferencia).toBe(104);
            expect(resultado.porcentajeVariacion).toBeCloseTo(0.104, 3);
            expect(resultado.inconsistencia).toBeDefined();
            expect(resultado.inconsistencia?.tipo).toBe("DISCREPANCIA_SICEP");
            expect(resultado.inconsistencia?.severidad).toBe("ADVERTENCIA");
            expect(resultado.inconsistencia?.descripcion).toContain("excede la tolerancia");
        });

        it("debe detectar discrepancia cuando SICEP es inferior al 911 en más del 10%", () => {
            const resultado = validarCruceSicep(500, 400); // 100 / 500 = 20%
            expect(resultado.hayDiscrepancia).toBe(true);
            expect(resultado.diferencia).toBe(100);
            expect(resultado.porcentajeVariacion).toBeCloseTo(0.20, 2);
            expect(resultado.inconsistencia?.tipo).toBe("DISCREPANCIA_SICEP");
        });

        it("debe manejar correctamente matrícula 911 en 0 con SICEP mayor a 0", () => {
            const resultado = validarCruceSicep(0, 50);
            expect(resultado.hayDiscrepancia).toBe(true);
            expect(resultado.porcentajeVariacion).toBe(1.0);
            expect(resultado.inconsistencia?.tipo).toBe("DISCREPANCIA_SICEP");
        });

        it("debe respetar un umbral personalizado si se proporciona", () => {
            // 6% de diferencia: no pasa con umbral del 5%, pero sí con el 10%
            const resUmbral5 = validarCruceSicep(100, 106, 0.05);
            expect(resUmbral5.hayDiscrepancia).toBe(true);

            const resUmbral10 = validarCruceSicep(100, 106, 0.10);
            expect(resUmbral10.hayDiscrepancia).toBe(false);
        });
    });

    describe("validarAritmetica911 (Reglas 1 a 7)", () => {
        const createGradosValidos = (): DetalleGradoInput[] => [
            { semestreGrado: 1, hombres: 20, mujeres: 30, total: 50, grupos: 2 },
            { semestreGrado: 2, hombres: 18, mujeres: 28, total: 46, grupos: 2 },
            { semestreGrado: 3, hombres: 22, mujeres: 25, total: 47, grupos: 2 },
            { semestreGrado: 4, hombres: 19, mujeres: 24, total: 43, grupos: 2 },
            { semestreGrado: 5, hombres: 15, mujeres: 20, total: 35, grupos: 1 },
            { semestreGrado: 6, hombres: 14, mujeres: 19, total: 33, grupos: 1 }
        ];

        it("debe validar exitosamente un formato 911 perfectamente cuadrado", () => {
            const datos: DatosFormato911 = {
                cct: "21EBH0201W",
                nombreEscuela: "Bachillerato Héroes",
                totalDocentes: 8,
                grados: createGradosValidos()
            };

            const res = validarAritmetica911(datos, "hash-test");
            expect(res.esValido).toBe(true);
            expect(res.inconsistencias).toHaveLength(0);
            expect(res.totalAlumnos).toBe(254);
            expect(res.totalHombres).toBe(108);
            expect(res.totalMujeres).toBe(146);
            expect(res.totalGrupos).toBe(10);
            expect(res.totalDocentes).toBe(8);
        });

        it("Regla 1: debe detectar DESCUADRE_GENERO cuando hombres + mujeres !== total", () => {
            const grados = createGradosValidos();
            grados[0].total = 60; // 20 + 30 !== 60

            const datos: DatosFormato911 = {
                cct: "21EBH0201W",
                totalDocentes: 5,
                grados
            };

            const res = validarAritmetica911(datos);
            expect(res.esValido).toBe(false);
            const inc = res.inconsistencias.find(i => i.tipo === "DESCUADRE_GENERO");
            expect(inc).toBeDefined();
            expect(inc?.severidad).toBe("ERROR_CRITICO");
            expect(inc?.semestreGrado).toBe(1);
        });

        it("Regla 2: debe detectar DESCUADRE_EDADES cuando el desglose por edad no suma los totales", () => {
            const grados = createGradosValidos();
            grados[0].desgloseEdades = {
                "15": { h: 10, m: 15 },
                "16": { h: 5, m: 10 } // Suma H: 15 (falta 5), Suma M: 25 (falta 5)
            };

            const datos: DatosFormato911 = {
                cct: "21EBH0201W",
                totalDocentes: 5,
                grados
            };

            const res = validarAritmetica911(datos);
            expect(res.esValido).toBe(false);
            const inc = res.inconsistencias.find(i => i.tipo === "DESCUADRE_EDADES");
            expect(inc).toBeDefined();
            expect(inc?.severidad).toBe("ERROR_CRITICO");
            expect(inc?.semestreGrado).toBe(1);
        });

        it("Regla 3: debe detectar VALOR_INVALIDO si la matrícula total reportada es 0", () => {
            const grados = createGradosValidos().map(g => ({ ...g, hombres: 0, mujeres: 0, total: 0 }));

            const datos: DatosFormato911 = {
                cct: "21EBH0201W",
                totalDocentes: 5,
                grados
            };

            const res = validarAritmetica911(datos);
            expect(res.esValido).toBe(false);
            const inc = res.inconsistencias.find(i => i.tipo === "VALOR_INVALIDO");
            expect(inc).toBeDefined();
            expect(inc?.severidad).toBe("ERROR_CRITICO");
        });

        it("Regla 4: debe detectar FALTA_GRUPOS si hay matrícula pero grupos = 0", () => {
            const grados = createGradosValidos();
            grados[1].grupos = 0; // total es 46

            const datos: DatosFormato911 = {
                cct: "21EBH0201W",
                totalDocentes: 5,
                grados
            };

            const res = validarAritmetica911(datos);
            const inc = res.inconsistencias.find(i => i.tipo === "FALTA_GRUPOS");
            expect(inc).toBeDefined();
            expect(inc?.severidad).toBe("ADVERTENCIA");
            expect(inc?.semestreGrado).toBe(2);
        });

        it("Regla 5: debe emitir FALTA_DOCENTES como ADVERTENCIA si docentes es 0 y hay alumnos", () => {
            const datos: DatosFormato911 = {
                cct: "21EBH0201W",
                totalDocentes: 0,
                grados: createGradosValidos()
            };

            const res = validarAritmetica911(datos);
            // Advertencia no rompe validez si no hay críticos
            expect(res.esValido).toBe(true);
            const inc = res.inconsistencias.find(i => i.tipo === "FALTA_DOCENTES");
            expect(inc).toBeDefined();
            expect(inc?.severidad).toBe("ADVERTENCIA");
        });

        it("Regla 6: debe detectar DESCUADRE_TOTAL cuando totalAlumnos reportado no coincide con suma de grados (H-6)", () => {
            const datos: DatosFormato911 = {
                cct: "21EBH0201W",
                totalDocentes: 5,
                totalAlumnos: 300, // Suma calculada es 254
                grados: createGradosValidos()
            };

            const res = validarAritmetica911(datos);
            expect(res.esValido).toBe(false);
            const inc = res.inconsistencias.find(i => i.tipo === "DESCUADRE_TOTAL");
            expect(inc).toBeDefined();
            expect(inc?.severidad).toBe("ERROR_CRITICO");
            expect(inc?.detalles?.sumaCalculada).toBe(254);
            expect(inc?.detalles?.totalReportado).toBe(300);
        });

        it("Regla 7: debe emitir DISCREPANCIA_SICEP si matriculaSicep difiere de calcTotal en más de 10%", () => {
            const datos: DatosFormato911 = {
                cct: "21EBH0201W",
                totalDocentes: 5,
                matriculaSicep: 350, // 254 vs 350 > 30% diferencia
                grados: createGradosValidos()
            };

            const res = validarAritmetica911(datos);
            // DISCREPANCIA_SICEP es ADVERTENCIA
            const inc = res.inconsistencias.find(i => i.tipo === "DISCREPANCIA_SICEP");
            expect(inc).toBeDefined();
            expect(inc?.severidad).toBe("ADVERTENCIA");
        });
    });

    describe("procesarFormato911Excel (Lector y Parser con Total Global H-6)", () => {
        function crearMockExcel911(opciones: { totalReportado?: number; cct?: string; docentes?: number }): Buffer {
            const rows = [
                ["FORMATO 911.7 - ESTADÍSTICA DE INICIO DE CURSOS", "", "", "", ""],
                ["CLAVE CCT:", opciones.cct || "21EBH0201W", "", "", ""],
                ["PERSONAL DOCENTE:", opciones.docentes ?? 6, "", "", ""],
                ["", "", "", "", ""],
                ["SEMESTRE", "HOMBRES", "MUJERES", "TOTAL", "GRUPOS"],
                ["1° SEMESTRE", 25, 25, 50, 1],
                ["2DO SEMESTRE", 20, 20, 40, 1],
                ["3ER SEMESTRE", 15, 15, 30, 1],
                ["4TO SEMESTRE", 10, 10, 20, 1],
                ["5TO SEMESTRE", 10, 10, 20, 1],
                ["6TO SEMESTRE", 10, 10, 20, 1]
            ];

            // Fila de Total Global (H-6)
            if (opciones.totalReportado !== undefined) {
                rows.push(["TOTAL GENERAL", 90, 90, opciones.totalReportado, 6]);
            }

            const ws = XLSX.utils.aoa_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Estadistica911");
            return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
        }

        it("debe procesar un archivo Excel con total global cuadrado", () => {
            // Suma de semestres: 50+40+30+20+20+20 = 180
            const buffer = crearMockExcel911({ totalReportado: 180, cct: "21EBH0201W", docentes: 8 });
            const resultado = procesarFormato911Excel(buffer);

            expect(resultado.esValido).toBe(true);
            expect(resultado.totalAlumnos).toBe(180);
            expect(resultado.totalDocentes).toBe(8);
            expect(resultado.inconsistencias.filter(i => i.tipo === "DESCUADRE_TOTAL")).toHaveLength(0);
        });

        it("debe detectar DESCUADRE_TOTAL cuando la fila de total en el Excel no coincide con la suma (H-6)", () => {
            // Suma es 180 pero en la fila TOTAL reportaron 200
            const buffer = crearMockExcel911({ totalReportado: 200, cct: "21EBH0201W" });
            const resultado = procesarFormato911Excel(buffer);

            expect(resultado.esValido).toBe(false);
            const inc = resultado.inconsistencias.find(i => i.tipo === "DESCUADRE_TOTAL");
            expect(inc).toBeDefined();
            expect(inc?.severidad).toBe("ERROR_CRITICO");
            expect(inc?.detalles?.sumaCalculada).toBe(180);
            expect(inc?.detalles?.totalReportado).toBe(200);
        });
    });
});
