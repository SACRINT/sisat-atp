import { describe, it, expect } from "vitest";
import {
    evaluarArchivoDiaNaranjaDeterminista,
    auditarDiaNaranjaDeterminista,
} from "../lib/quality-gates/dia-naranja-evaluator";

describe("Motor Determinista de Día Naranja", () => {
    const escuelaInfo = {
        nombre: "BACHILLERATO HEROES DE LA REVOLUCION",
        cct: "21EBH0201W",
    };

    describe("Evaluación individual de archivos", () => {
        it("debe validar un archivo formal con firma, sello y temática conmemorativa (firmado: true, sellado: true)", () => {
            const contenido = `
                GOBIERNO DEL ESTADO DE PUEBLA
                SECRETARÍA DE EDUCACIÓN PÚBLICA
                BACHILLERATO HEROES DE LA REVOLUCION - 21EBH0201W
                
                INFORME DE ACTIVIDADES CONMEMORATIVAS - 25 DE NOVIEMBRE
                DÍA NARANJA: DÍA INTERNACIONAL DE LA NO VIOLENCIA CONTRA MUJERES Y NIÑAS
                
                Se realizaron talleres de concientización y carteles de igualdad de género
                con la participación activa de la comunidad escolar.
                
                ATENTAMENTE
                SELLO OFICIAL DEL PLANTEL
                MTRO. CARLOS SÁNCHEZ - DIRECTOR DEL PLANTEL
            `;

            const res = evaluarArchivoDiaNaranjaDeterminista(contenido, {
                nombre: "Dia_Naranja_Noviembre.pdf",
                etiqueta: "Reporte Mensual",
                escuelaNombre: escuelaInfo.nombre,
                escuelaCct: escuelaInfo.cct,
            });

            expect(res.firmado).toBe(true);
            expect(res.sellado).toBe(true);
            expect(res.explicacion).toContain("validado deterministamente");
            expect(res.nombre).toBe("Dia_Naranja_Noviembre.pdf");
        });

        it("debe detectar la carencia de firma autógrafa y sello oficial", () => {
            const contenidoIncompleto = "Resumen sin firmas ni acreditación institucional.";
            const res = evaluarArchivoDiaNaranjaDeterminista(contenidoIncompleto, {
                nombre: "Evidencia_Incompleta.pdf",
                escuelaNombre: escuelaInfo.nombre,
                escuelaCct: escuelaInfo.cct,
            });

            expect(res.firmado).toBe(false);
            expect(res.sellado).toBe(false);
            expect(res.explicacion).toContain("carece de firma autógrafa");
        });

        it("debe manejar buffers vacíos o nulos de forma segura", () => {
            const res = evaluarArchivoDiaNaranjaDeterminista(null, {
                nombre: "vacio.pdf",
            });
            expect(res.firmado).toBe(false);
            expect(res.sellado).toBe(false);
            expect(res.explicacion).toContain("No se proporcionó contenido");
        });
    });

    describe("Auditoría integral de la entrega de Día Naranja", () => {
        it("debe aprobar la entrega cuando todos los archivos cumplen formalidad (aprobado: true, scoreNumerico: 100)", () => {
            const archivoValido1 = `
                BACHILLERATO HEROES DE LA REVOLUCION 21EBH0201W
                DÍA NARANJA - ACTIVIDADES COMUNITARIAS
                DIRECTOR: MTRO. CARLOS SÁNCHEZ
                SELLO DEL PLANTEL
            `;
            const archivoValido2 = `
                EVIDENCIA FOTOGRÁFICA 25 DE CADA MES
                CLAVE C.T. 21EBH0201W
                ATENTAMENTE LA DIRECCIÓN DEL PLANTEL
                SELLO OFICIAL
            `;

            const res = auditarDiaNaranjaDeterminista(
                [
                    { nombre: "Actividades.pdf", texto: archivoValido1 },
                    { nombre: "Evidencias.pdf", texto: archivoValido2 },
                ],
                escuelaInfo
            );

            expect(res.tipo).toBe("DIA_NARANJA");
            expect(res.aprobado).toBe(true);
            expect(res.scoreNumerico).toBe(100);
            expect(res.estatusOficial).toBe("APROBADO");
            expect(res.archivos?.length).toBe(2);
        });

        it("debe rechazar la entrega si al menos un archivo carece de firma o sello (scoreNumerico < 100)", () => {
            const archivoValido = `
                BACHILLERATO HEROES DE LA REVOLUCION 21EBH0201W
                DÍA NARANJA - DIRECTOR MTRO. CARLOS SÁNCHEZ - SELLO OFICIAL
            `;
            const archivoIncompleto = "Texto suelto sin firmas";

            const res = auditarDiaNaranjaDeterminista(
                [
                    { nombre: "Doc1.pdf", texto: archivoValido },
                    { nombre: "Doc2.pdf", texto: archivoIncompleto },
                ],
                escuelaInfo
            );

            expect(res.aprobado).toBe(false);
            expect(res.scoreNumerico).toBe(50);
            expect(res.estatusOficial).toBe("REQUIERE_CORRECCION");
        });
    });
});
