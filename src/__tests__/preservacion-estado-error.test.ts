import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma antes de importar pre-revision
const mockFindUniqueEntrega = vi.fn();
const mockFindUniquePreRev = vi.fn();
const mockUpsertPreRev = vi.fn();
const mockFindFirstPlantilla = vi.fn();

vi.mock("../lib/db", () => ({
    prisma: {
        entrega: {
            findUnique: (...args: unknown[]) => mockFindUniqueEntrega(...args)
        },
        preRevision: {
            findUnique: (...args: unknown[]) => mockFindUniquePreRev(...args),
            upsert: (...args: unknown[]) => mockUpsertPreRev(...args)
        },
        plantillaEvaluacion: {
            findFirst: (...args: unknown[]) => mockFindFirstPlantilla(...args)
        }
    }
}));

// Mock cloudinary para evitar llamadas de red
vi.mock("cloudinary", () => ({
    v2: {
        config: vi.fn(),
        utils: {
            private_download_url: vi.fn().mockReturnValue("https://mock-signed.cloudinary.com/download")
        }
    }
}));

import { analizarEntregaConIA } from "../lib/pre-revision";

describe("Preservación de Estado de Pre-Revisión ante Fallos Críticos (P2-03)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("debe preservar el dictamen previo (resultadoPrevia) y marcar errorConexo: true cuando la descarga falla con status 401", async () => {
        const entregaId = "entrega-vicente-suarez-1";

        // Simular entrega de PMC existente
        mockFindUniqueEntrega.mockResolvedValue({
            id: entregaId,
            escuelaId: "escuela-cmufnzvnt",
            archivos: [
                {
                    id: "archivo-pmc-1",
                    tipo: "ENTREGA",
                    nombre: "PMC_Vicente_Suarez.docx",
                    driveUrl: "https://res.cloudinary.com/demo/raw/upload/v1234/PMC_Vicente_Suarez.docx"
                }
            ],
            periodoEntrega: {
                cicloEscolarId: "ciclo-2026",
                programa: {
                    nombre: "PMC - Programa de Mejora Continua"
                }
            },
            escuela: {
                nombre: "Vicente Suárez",
                cct: "21EBH0001X"
            }
        });

        // Simular que existía un resultado previo favorable en la base de datos
        const dictamenPrevio = {
            tipo: "PMC",
            aprobado: true,
            puntuacion: "95%",
            scoreNumerico: 95,
            totalPuntosBrutos: "105/110",
            overallStatus: "EXCELENTE",
            passedCriteria: 10,
            borradorCorreo: "Dictamen de aprobación..."
        };

        mockFindUniquePreRev.mockResolvedValue({
            entregaId,
            resultado: dictamenPrevio
        });

        mockFindFirstPlantilla.mockResolvedValue(null);

        // Mock fetch para simular un fallo 401 (recurso protegido / no firmado de Cloudinary)
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            statusText: "Unauthorized"
        });

        try {
            await analizarEntregaConIA(entregaId);
        } finally {
            globalThis.fetch = originalFetch;
        }

        // Verificar que preRevision.upsert fue invocado para guardar el estado de error
        expect(mockUpsertPreRev).toHaveBeenCalledTimes(1);

        const upsertCall = mockUpsertPreRev.mock.calls[0][0];
        expect(upsertCall.where.entregaId).toBe(entregaId);

        const savedResultado = upsertCall.update.resultado;

        // 1. Debe conservar el dictamen previo intacto en `resultadoPrevia`
        expect(savedResultado.resultadoPrevia).toBeDefined();
        expect(savedResultado.resultadoPrevia).toEqual(dictamenPrevio);
        expect(savedResultado.resultadoPrevia.puntuacion).toBe("95%");

        // 2. Debe marcar el error conexo para activar el badge de re-evaluación
        expect(savedResultado.errorConexo).toBe(true);
        expect(savedResultado.error).toBe("Error crítico al procesar la entrega con IA");
        expect(savedResultado.detalle).toContain("401");

        // 3. Debe preservar el tipo de programa
        expect(savedResultado.tipo).toBe("PMC");

        // 4. Debe incluir timestamp de actualización
        expect(savedResultado.actualizadoEn).toBeDefined();
    });
});
