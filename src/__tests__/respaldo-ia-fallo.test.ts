import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de prisma
const mockFindUniqueEntrega = vi.fn();
const mockFindUniquePreRev = vi.fn();
const mockUpsertPreRev = vi.fn();
const mockFindFirstPlantilla = vi.fn();

vi.mock("../lib/db", () => ({
    prisma: {
        entrega: {
            findUnique: (...args: unknown[]) => mockFindUniqueEntrega(...args),
        },
        preRevision: {
            findUnique: (...args: unknown[]) => mockFindUniquePreRev(...args),
            upsert: (...args: unknown[]) => mockUpsertPreRev(...args),
        },
        plantillaEvaluacion: {
            findFirst: (...args: unknown[]) => mockFindFirstPlantilla(...args),
        },
    },
}));

// Mock de Gemini: SIEMPRE falla con error simulado de red o indisponibilidad (Puerta 6)
vi.mock("../lib/gemini", () => ({
    callGemini: vi.fn().mockRejectedValue(new Error("503 Service Unavailable: Gemini API down")),
}));

// Mock de Cloudinary
vi.mock("cloudinary", () => ({
    v2: {
        config: vi.fn(),
        utils: {
            private_download_url: vi.fn().mockReturnValue("https://mock-signed.cloudinary.com/download"),
        },
    },
}));

import { analizarEntregaConIA } from "../lib/pre-revision";
import {
    createMockAcosoExcelBuffer,
    getReferenceAcosoPdfBuffer,
} from "./fixtures/acoso-excel-fixture";

describe("Puerta 6: Suplencia Determinista ante Fallo Crítico de IA", () => {
    const escuelaBase = {
        nombre: "BACHILLERATO HEROES DE LA REVOLUCION",
        cct: "21EBH0201W",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockFindUniquePreRev.mockResolvedValue(null);
        mockFindFirstPlantilla.mockResolvedValue(null);
    });

    it("Acoso Escolar (Excel): ante fallo de IA, debe emitir borrador formal determinista sin 'Error al redactar borrador'", async () => {
        const entregaId = "entrega-acoso-excel-fallo-ia";
        const excelBuffer = createMockAcosoExcelBuffer({
            meses: ["ENERO"],
            conIncidencias: true,
            escuela: escuelaBase.nombre,
            cct: escuelaBase.cct,
        });

        mockFindUniqueEntrega.mockResolvedValue({
            id: entregaId,
            escuelaId: "escuela-001",
            archivos: [
                {
                    id: "archivo-acoso-1",
                    tipo: "ENTREGA",
                    nombre: "Reporte_Acoso_Enero.xlsx",
                    driveUrl: "https://res.cloudinary.com/demo/raw/upload/v1234/Reporte_Acoso_Enero.xlsx",
                },
            ],
            periodoEntrega: {
                programa: {
                    nombre: "ACOSO ESCOLAR",
                },
            },
            escuela: escuelaBase,
        });

        // Mock fetch para devolver el buffer Excel
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers(),
            arrayBuffer: async () => excelBuffer.buffer.slice(excelBuffer.byteOffset, excelBuffer.byteOffset + excelBuffer.byteLength),
        } as unknown as Response);

        try {
            await analizarEntregaConIA(entregaId);
        } finally {
            globalThis.fetch = originalFetch;
        }

        expect(mockUpsertPreRev).toHaveBeenCalledTimes(1);
        const savedResultado = mockUpsertPreRev.mock.calls[0][0].update.resultado;

        expect(savedResultado.tipo).toBe("ACOSO_ESCOLAR");
        expect(savedResultado.tieneIncidencias).toBe(true);
        expect(savedResultado.incidenciasDetalle).toBeDefined();
        expect(savedResultado.incidenciasDetalle.length).toBeGreaterThan(0);
        expect(savedResultado.borradorCorreo).toBeDefined();
        // Criterio de aceptación explícito Puerta 6:
        expect(savedResultado.borradorCorreo).not.toContain("Error al redactar borrador");
        expect(savedResultado.borradorCorreo).toContain("ASUNTO: Notificación de Incidencias Registradas de Acoso Escolar");
        expect(savedResultado.borradorCorreo).toContain(escuelaBase.cct);
    });

    it("Acoso Escolar (PDF): ante fallo de IA de visión, debe emitir dictamen determinista de firmas y sellos sin error de análisis usando PDF real", async () => {
        const entregaId = "entrega-acoso-pdf-fallo-ia";
        const realPdf = getReferenceAcosoPdfBuffer();
        const pdfBuffer = realPdf || Buffer.from(`
            GOBIERNO DEL ESTADO DE PUEBLA - SECRETARÍA DE EDUCACIÓN PÚBLICA
            BACHILLERATO VICENTE SUAREZ FERRER - 21EBH0682T
            INFORME DE CERO CASOS DE ACOSO ESCOLAR
            ATENTAMENTE EL DIRECTOR DEL PLANTEL
            SELLO OFICIAL DE LA INSTITUCIÓN
        `, "utf-8");

        const escuelaPdf = realPdf
            ? { nombre: "VICENTE SUAREZ FERRER", cct: "21EBH0682T" }
            : escuelaBase;

        mockFindUniqueEntrega.mockResolvedValue({
            id: entregaId,
            escuelaId: "escuela-001",
            archivos: [
                {
                    id: "archivo-acoso-pdf-1",
                    tipo: "ENTREGA",
                    nombre: "Informe_Acoso_Cero_Casos.pdf",
                    driveUrl: "https://res.cloudinary.com/demo/raw/upload/v1234/Informe_Acoso_Cero_Casos.pdf",
                },
            ],
            periodoEntrega: {
                programa: {
                    nombre: "ACOSO ESCOLAR",
                },
            },
            escuela: escuelaPdf,
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers(),
            arrayBuffer: async () => pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength),
        } as unknown as Response);

        try {
            await analizarEntregaConIA(entregaId);
        } finally {
            globalThis.fetch = originalFetch;
        }

        expect(mockUpsertPreRev).toHaveBeenCalledTimes(1);
        const savedResultado = mockUpsertPreRev.mock.calls[0][0].update.resultado;

        expect(savedResultado.tipo).toBe("ACOSO_ESCOLAR");
        expect(savedResultado.tieneIncidencias).toBe(false);
        expect(savedResultado.firmado).toBe(true);
        expect(savedResultado.sellado).toBe(true);
        expect(savedResultado.aprobado).toBe(true);
        // Criterio de aceptación explícito:
        expect(savedResultado.explicacion).not.toContain("Error de análisis visual");
        expect(savedResultado.explicacion).toContain("validado deterministamente");
    });

    it("Día Naranja: ante fallo de IA de visión, debe suplir con evaluador determinista emitiendo scoreNumerico y estatusOficial", async () => {
        const entregaId = "entrega-dia-naranja-fallo-ia";
        const pdfContent = `
            BACHILLERATO HEROES DE LA REVOLUCION - 21EBH0201W
            DÍA NARANJA: 25 DE NOVIEMBRE - NO VIOLENCIA CONTRA MUJERES Y NIÑAS
            DIRECTOR DEL PLANTEL
            SELLO OFICIAL DEL PLANTEL
        `;
        const pdfBuffer = Buffer.from(pdfContent, "utf-8");

        mockFindUniqueEntrega.mockResolvedValue({
            id: entregaId,
            escuelaId: "escuela-001",
            archivos: [
                {
                    id: "archivo-naranja-1",
                    tipo: "ENTREGA",
                    nombre: "Dia_Naranja_Noviembre.pdf",
                    etiqueta: "Reporte Mensual",
                    driveUrl: "https://res.cloudinary.com/demo/raw/upload/v1234/Dia_Naranja_Noviembre.pdf",
                },
            ],
            periodoEntrega: {
                programa: {
                    nombre: "DÍA NARANJA",
                },
            },
            escuela: escuelaBase,
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers(),
            arrayBuffer: async () => pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength),
        } as unknown as Response);

        try {
            await analizarEntregaConIA(entregaId);
        } finally {
            globalThis.fetch = originalFetch;
        }

        expect(mockUpsertPreRev).toHaveBeenCalledTimes(1);
        const savedResultado = mockUpsertPreRev.mock.calls[0][0].update.resultado;

        expect(savedResultado.tipo).toBe("DIA_NARANJA");
        expect(savedResultado.aprobado).toBe(true);
        expect(savedResultado.scoreNumerico).toBe(100);
        expect(savedResultado.estatusOficial).toBe("APROBADO");
        expect(savedResultado.archivos[0].firmado).toBe(true);
        expect(savedResultado.archivos[0].sellado).toBe(true);
        // Criterio de aceptación explícito:
        expect(savedResultado.archivos[0].explicacion).not.toContain("Error de análisis");
        expect(savedResultado.archivos[0].explicacion).toContain("validado deterministamente");
    });

    it("PIPC: ante fallo de IA, debe emitir PreRevisionResult determinista con las 4 brigadas y sin mensaje de error genérico", async () => {
        const entregaId = "entrega-pipc-fallo-ia";
        const docxContent = `
            BACHILLERATO HEROES DE LA REVOLUCION - CCT: 21EBH0201W
            PROGRAMA INTERNO DE PROTECCIÓN CIVIL (PIPC)
            
            1. BRIGADAS OFICIALES:
            - Brigada de Primeros Auxilios (atención médica y botiquín).
            - Brigada de Prevención y Combate de Incendios (extintores y fuego).
            - Brigada de Evacuación de Inmuebles (rutas de repliegue y punto de reunión).
            - Brigada de Búsqueda y Rescate (salvamento de aulas).
            
            2. PLAN DE EVACUACIÓN Y CONTINGENCIA:
            Rutas de evacuación señalizadas hacia el punto de reunión.
            
            3. CROQUIS Y SEÑALIZACIÓN:
            Croquis general del edificio escolar.
            
            4. DIRECTORIO DE EMERGENCIAS:
            911, Cruz Roja y Bomberos del Estado.
            
            5. FORMALIDAD:
            DIRECTOR DEL PLANTEL Y SELLO OFICIAL.
        `;
        const buffer = Buffer.from(docxContent, "utf-8");

        mockFindUniqueEntrega.mockResolvedValue({
            id: entregaId,
            escuelaId: "escuela-001",
            archivos: [
                {
                    id: "archivo-pipc-1",
                    tipo: "ENTREGA",
                    nombre: "PIPC_2026.docx",
                    driveUrl: "https://res.cloudinary.com/demo/raw/upload/v1234/PIPC_2026.docx",
                },
            ],
            periodoEntrega: {
                programa: {
                    nombre: "PIPC - PROTECCIÓN CIVIL",
                },
            },
            escuela: escuelaBase,
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers(),
            arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        } as unknown as Response);

        try {
            await analizarEntregaConIA(entregaId, docxContent);
        } finally {
            globalThis.fetch = originalFetch;
        }

        expect(mockUpsertPreRev).toHaveBeenCalledTimes(1);
        const savedResultado = mockUpsertPreRev.mock.calls[0][0].update.resultado;

        expect(savedResultado.tipo).toBe("PIPC");
        expect(savedResultado.aprobado).toBe(true);
        expect(savedResultado.tieneBrigadas).toBe(true);
        expect(savedResultado.scoreNumerico).toBeGreaterThanOrEqual(70);
        expect(savedResultado.estatusOficial).toBe("APROBADO");
        expect(savedResultado.error).toBeUndefined();
        expect(savedResultado.explicacion).toContain("Evaluación determinista de PIPC");
    });
});
