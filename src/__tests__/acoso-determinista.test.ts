import { describe, it, expect } from "vitest";
import {
    extraerIncidenciasAcosoExcel,
    generarBorradorOficioAcosoDeterminista,
    auditarAcosoDeterministaExcel,
    auditarAcosoDeterministaPdf,
} from "../lib/quality-gates/acoso-evaluator";
import {
    createMockAcosoExcelBuffer,
    getReferenceAcosoExcelBuffer,
    getReferenceAcosoPdfBuffer,
} from "./fixtures/acoso-excel-fixture";
import { extractTextFromPdf } from "../lib/pre-revision";

describe("Motor Determinista de Acoso Escolar (Excel y PDF)", () => {
    const escuelaInfo = {
        nombre: "BACHILLERATO HEROES DE LA REVOLUCION",
        cct: "21EBH0201W",
        zonaEscolar: "013",
    };

    describe("Auditoría de Excel con Incidencias", () => {
        it("debe extraer incidencias mapeando correctamente el mes desde el nombre de la pestaña", () => {
            const buffer = createMockAcosoExcelBuffer({
                meses: ["ENERO", "FEBRERO"],
                conIncidencias: true,
                escuela: escuelaInfo.nombre,
                cct: escuelaInfo.cct,
            });

            const incidencias = extraerIncidenciasAcosoExcel(buffer);
            expect(incidencias.length).toBeGreaterThanOrEqual(1);

            const primera = incidencias[0];
            expect(primera.mes).toBe("ENERO");
            expect(primera.violencia).toContain("Agresión Física");
            expect(primera.escuela).toBe(escuelaInfo.nombre);
            expect(primera.cct).toBe(escuelaInfo.cct);
        });

        it("debe generar borrador determinista formal sin cadenas de error cuando hay incidencias", () => {
            const buffer = createMockAcosoExcelBuffer({
                meses: ["ENERO"],
                conIncidencias: true,
                escuela: escuelaInfo.nombre,
                cct: escuelaInfo.cct,
            });

            const resultado = auditarAcosoDeterministaExcel(buffer, escuelaInfo);
            expect(resultado.tipo).toBe("ACOSO_ESCOLAR");
            expect(resultado.tieneIncidencias).toBe(true);
            expect(resultado.aprobado).toBe(true);
            expect(resultado.incidenciasDetalle).toBeDefined();
            expect(resultado.incidenciasDetalle!.length).toBeGreaterThan(0);
            expect(resultado.borradorCorreo).toBeDefined();
            expect(resultado.borradorCorreo).not.toContain("Error al redactar borrador");
            expect(resultado.borradorCorreo).toContain("ASUNTO: Notificación de Incidencias Registradas de Acoso Escolar");
            expect(resultado.borradorCorreo).toContain(escuelaInfo.cct);
            expect(resultado.borradorCorreo).toContain("ENERO");
        });

        it("debe generar borrador determinista autónomo con la función generarBorradorOficioAcosoDeterminista", () => {
            const borrador = generarBorradorOficioAcosoDeterminista({
                escuelaNombre: escuelaInfo.nombre,
                escuelaCct: escuelaInfo.cct,
                incidencias: [
                    {
                        mes: "MARZO",
                        categoria: "ADOLESCENTES",
                        edad: "16",
                        violencia: ["Hostigamiento"],
                        escuela: escuelaInfo.nombre,
                        cct: escuelaInfo.cct,
                        localidad: "Puebla",
                    },
                ],
                zonaEscolar: "013",
            });

            expect(borrador).toContain("Supervisión Técnica Pedagógica - Zona Escolar: 013");
            expect(borrador).toContain("MARZO");
            expect(borrador).toContain("Hostigamiento");
            expect(borrador).toContain("DGB");
        });
    });

    describe("Auditoría de Excel sin Incidencias", () => {
        it("debe catalogar reporte limpio como aprobado: true y sin incidencias", () => {
            const buffer = createMockAcosoExcelBuffer({
                meses: ["ENERO", "FEBRERO"],
                conIncidencias: false,
                escuela: escuelaInfo.nombre,
                cct: escuelaInfo.cct,
            });

            const resultado = auditarAcosoDeterministaExcel(buffer, escuelaInfo);
            expect(resultado.tipo).toBe("ACOSO_ESCOLAR");
            expect(resultado.tieneIncidencias).toBe(false);
            expect(resultado.aprobado).toBe(true);
            expect(resultado.incidenciasDetalle).toEqual([]);
            expect(resultado.explicacion).toContain("sin incidencias");
        });
    });

    describe("Fixture Oficial de Referencia (si existe en disco)", () => {
        it("debe procesar el archivo Excel oficial sin lanzar excepciones", () => {
            const refBuffer = getReferenceAcosoExcelBuffer();
            expect(refBuffer).not.toBeNull();
            const incidencias = extraerIncidenciasAcosoExcel(refBuffer!);
            expect(Array.isArray(incidencias)).toBe(true);
            const res = auditarAcosoDeterministaExcel(refBuffer!, escuelaInfo);
            expect(res.tipo).toBe("ACOSO_ESCOLAR");
        });
    });

    describe("Auditoría Determinista de PDF (Cero Casos)", () => {
        it("debe validar un oficio formal con firma autógrafa y sello oficial (aprobado: true)", () => {
            const oficioTexto = `
                GOBIERNO DEL ESTADO DE PUEBLA
                SECRETARÍA DE EDUCACIÓN PÚBLICA
                DIRECCIÓN GENERAL DE BACHILLERATOS
                BACHILLERATO HEROES DE LA REVOLUCION - CLAVE C.T. 21EBH0201W
                
                ASUNTO: INFORME MENSUAL DE CERO CASOS DE ACOSO ESCOLAR
                
                Por medio del presente manifiesto que durante el mes correspondiente no se
                registraron incidencias de violencia ni acoso escolar en nuestro plantel.
                
                ATENTAMENTE
                SELLO OFICIAL DEL PLANTEL
                MTRO. JUAN PÉREZ - DIRECTOR DEL PLANTEL
            `;

            const res = auditarAcosoDeterministaPdf(oficioTexto, escuelaInfo);
            expect(res.firmado).toBe(true);
            expect(res.sellado).toBe(true);
            expect(res.aprobado).toBe(true);
            expect(res.explicacion).toContain("validado deterministamente");
        });

        it("debe rechazar un oficio que carece de firma de la dirección (aprobado: false)", () => {
            const textoIncompleto = "Reporte mensual sin firma ni datos de dirección.";
            const res = auditarAcosoDeterministaPdf(textoIncompleto, { nombre: "OTRA", cct: "00000000" });
            expect(res.aprobado).toBe(false);
            expect(res.firmado).toBe(false);
            expect(res.explicacion).toContain("carece de elementos formales");
        });

        it("debe validar exitosamente un PDF real con compresión FlateDecode extrayendo su texto con extractTextFromPdf", async () => {
            const realPdfBuffer = getReferenceAcosoPdfBuffer();
            expect(realPdfBuffer).not.toBeNull();
            const { text } = await extractTextFromPdf(realPdfBuffer!);
            expect(text.length).toBeGreaterThan(100);
            const res = auditarAcosoDeterministaPdf(text, {
                nombre: "VICENTE SUAREZ FERRER",
                cct: "21EBH0682T",
            });
            expect(res.firmado).toBe(true);
            expect(res.sellado).toBe(true);
            expect(res.aprobado).toBe(true);
            expect(res.explicacion).toContain("validado deterministamente");
        });
    });
});
