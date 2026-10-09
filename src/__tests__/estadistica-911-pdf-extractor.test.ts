import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { extraerDatos911 } from "../lib/estadistica-911-pdf-extractor";

// Mock de callGemini
const mockCallGemini = vi.fn();

vi.mock("../lib/gemini", () => ({
    callGemini: (...args: unknown[]) => mockCallGemini(...args)
}));

describe("Servicio de Extracción 911 (PDF e Imágenes)", () => {
    const realTecomateInicioPath = "C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\documentos_referencia\\[02]PMC\\911 y F11\\Tecomate\\Estadística de inicio 26-27  Tecomate.pdf";
    const realTecomateFinPath = "C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\documentos_referencia\\[02]PMC\\911 y F11\\Tecomate\\Estadística de fin 25-26 Tecomate.pdf";

    const hasRealTecomateInicio = fs.existsSync(realTecomateInicioPath);
    const hasRealTecomateFin = fs.existsSync(realTecomateFinPath);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Extracción vía OCR / IA Multimodal (Imágenes y Escaneados)", () => {
        it("debe extraer CCT, docentes y los 6 semestres cuando callGemini devuelve un JSON 911 válido", async () => {
            const fakeJson = JSON.stringify({
                cct: "21EBH0465E",
                nombreEscuela: "BACHILLERATO GENERAL MOISES SAENZ",
                totalDocentes: 4,
                totalAlumnos: 75,
                tipoCorte: "INICIO_DE_CURSOS",
                semestres: [
                    { semestre: 1, hombres: 9, mujeres: 15, total: 24, grupos: 1 },
                    { semestre: 2, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
                    { semestre: 3, hombres: 10, mujeres: 13, total: 23, grupos: 1 },
                    { semestre: 4, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
                    { semestre: 5, hombres: 16, mujeres: 12, total: 28, grupos: 1 },
                    { semestre: 6, hombres: 0, mujeres: 0, total: 0, grupos: 0 }
                ]
            });

            mockCallGemini.mockResolvedValueOnce(fakeJson);

            const mockImageBuffer = Buffer.from("fake-image-bytes-header-mock");
            const resultado = await extraerDatos911(mockImageBuffer, "image/png");

            expect(resultado).not.toBeNull();
            expect(resultado?.cct).toBe("21EBH0465E");
            expect(resultado?.nombreEscuela).toBe("BACHILLERATO GENERAL MOISES SAENZ");
            expect(resultado?.totalDocentes).toBe(4);
            expect(resultado?.totalAlumnos).toBe(75);
            expect(resultado?.grados).toHaveLength(6);

            const sumaTotalSemestres = (resultado?.grados || []).reduce((acc, g) => acc + g.total, 0);
            expect(sumaTotalSemestres).toBe(75);

            const s1 = resultado?.grados.find(g => g.semestreGrado === 1);
            expect(s1).toEqual({ semestreGrado: 1, hombres: 9, mujeres: 15, total: 24, grupos: 1 });

            const s5 = resultado?.grados.find(g => g.semestreGrado === 5);
            expect(s5).toEqual({ semestreGrado: 5, hombres: 16, mujeres: 12, total: 28, grupos: 1 });
        });

        it("debe limpiar bloques markdown ```json cuando Gemini los incluye", async () => {
            const wrappedJson = "```json\n" + JSON.stringify({
                cct: "21EBH9999X",
                nombreEscuela: "PLANTEL PRUEBA",
                totalAlumnos: 30,
                semestres: [
                    { semestre: 1, hombres: 10, mujeres: 20, total: 30, grupos: 1 }
                ]
            }) + "\n```";

            mockCallGemini.mockResolvedValueOnce(wrappedJson);

            const mockBuffer = Buffer.from("fake-scan");
            const resultado = await extraerDatos911(mockBuffer, "image/jpeg");

            expect(resultado).not.toBeNull();
            expect(resultado?.cct).toBe("21EBH9999X");
            expect(resultado?.grados.find(g => g.semestreGrado === 1)?.total).toBe(30);
        });

        it("debe devolver null defensivamente si callGemini rechaza con error (red/timeout/quota)", async () => {
            mockCallGemini.mockRejectedValueOnce(new Error("503 Service Unavailable: Gemini API down"));

            const mockBuffer = Buffer.from("fake-scan");
            const resultado = await extraerDatos911(mockBuffer, "image/png");

            expect(resultado).toBeNull();
        });

        it("debe devolver null por sanidad si Gemini devuelve semestres vacíos o sin matrícula", async () => {
            const jsonInvalido = JSON.stringify({
                cct: "21EBH0465E",
                totalAlumnos: 100,
                semestres: [] // Sin semestres válidos
            });

            mockCallGemini.mockResolvedValueOnce(jsonInvalido);

            const mockBuffer = Buffer.from("fake-scan");
            const resultado = await extraerDatos911(mockBuffer, "image/png");

            expect(resultado).toBeNull();
        });
    });

    describe("Pruebas con Fixtures Reales de Disco", () => {
        it.skipIf(!hasRealTecomateInicio)("debe procesar el PDF real digital de inicio de Tecomate", async () => {
            // El PDF de Tecomate tiene texto digital sin semestres tabulares en una sola línea, por lo que cae a OCR
            const fakeOcrResponse = JSON.stringify({
                cct: "21EBH0465E",
                nombreEscuela: "MOISES SAENZ GARSA",
                totalDocentes: 0,
                totalAlumnos: 75,
                tipoCorte: "INICIO_DE_CURSOS",
                semestres: [
                    { semestre: 1, hombres: 9, mujeres: 15, total: 24, grupos: 1 },
                    { semestre: 2, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
                    { semestre: 3, hombres: 10, mujeres: 13, total: 23, grupos: 1 },
                    { semestre: 4, hombres: 0, mujeres: 0, total: 0, grupos: 0 },
                    { semestre: 5, hombres: 16, mujeres: 12, total: 28, grupos: 1 },
                    { semestre: 6, hombres: 0, mujeres: 0, total: 0, grupos: 0 }
                ]
            });

            mockCallGemini.mockResolvedValueOnce(fakeOcrResponse);

            const realBuffer = fs.readFileSync(realTecomateInicioPath);
            const resultado = await extraerDatos911(realBuffer, "application/pdf");

            expect(resultado).not.toBeNull();
            expect(resultado?.cct).toBe("21EBH0465E");
            expect(resultado?.totalAlumnos).toBe(75);
            expect(resultado?.grados).toHaveLength(6);
        });

        it.skipIf(!hasRealTecomateFin)("debe detectar el PDF escaneado (<80 caracteres) y enviarlo a OCR", async () => {
            const fakeFinResponse = JSON.stringify({
                cct: "21EBH0465E",
                nombreEscuela: "MOISES SAENZ GARSA",
                tipoCorte: "FIN_DE_CURSOS",
                totalAlumnos: 70,
                semestres: [
                    { semestre: 2, hombres: 8, mujeres: 14, total: 22, grupos: 1 },
                    { semestre: 4, hombres: 10, mujeres: 12, total: 22, grupos: 1 },
                    { semestre: 6, hombres: 15, mujeres: 11, total: 26, grupos: 1 }
                ]
            });

            mockCallGemini.mockResolvedValueOnce(fakeFinResponse);

            const realScannedBuffer = fs.readFileSync(realTecomateFinPath);
            const resultado = await extraerDatos911(realScannedBuffer, "application/pdf");

            expect(resultado).not.toBeNull();
            expect(resultado?.tipoCorte).toBe("FIN_DE_CURSOS");
            expect(mockCallGemini).toHaveBeenCalledTimes(1);
        });
    });
});
