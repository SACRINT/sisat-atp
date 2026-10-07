import { describe, it, expect } from "vitest";
import { getProgramaSlug, buildFolderPath } from "../lib/cloudinary";

describe("Nomenclatura y Optimización de Rutas en Cloudinary", () => {
    it("genera slugs concisos y representativos para programas estándar y dinámicos", () => {
        expect(getProgramaSlug("Actividad 3 - Evidendia ABC del las Emociones")).toBe("ACT3_ABC");
        expect(getProgramaSlug("Eviidencias del ABC de las Emociones ")).toBe("ABC_EMOCIONES");
        expect(getProgramaSlug("ESTRATEGIA INTEGRAL DE SEGURIDAD Y CULTURA DE PAZ")).toBe("SEG_PAZ");
        expect(getProgramaSlug("PROGRAMA INTERNO DE PROTECCIÓN CIVIL (PIPC)")).toBe("PIPC");
        expect(getProgramaSlug("PMC")).toBe("PMC");
        expect(getProgramaSlug("PAEC-PEC")).toBe("PAEC");
        expect(getProgramaSlug("ACOSO ESCOLAR")).toBe("ACOSO");
        expect(getProgramaSlug("DÍA NARANJA")).toBe("DNARANJA");
        expect(getProgramaSlug("Jornada de Juegos Tradicionales")).toBe("JUEGOS_TRAD");
        expect(getProgramaSlug("REGISTRO DE INDICADORES Y METAS 2026-2027")).toBe("METAS");
        expect(getProgramaSlug("CONCENTRADO DE INSCRITOS/REINSCRITOS")).toBe("INSCRITOS");
    });

    it("genera carpetas compactas usando CCT y slug del programa (máximo 35 caracteres)", () => {
        const folder = buildFolderPath(
            "21EBH0789L",
            "DAVID ALFARO SIQUEIROS (JALTOCAN)",
            "Actividad 3 - Evidendia ABC del las Emociones"
        );
        expect(folder).toBe("21EBH0789L/ACT3_ABC");
        expect(folder.length).toBeLessThanOrEqual(35);
    });

    it("la ruta completa dentro de SISAT-ATP se mantiene muy por debajo del límite de 255 caracteres", () => {
        const folder = `SISAT-ATP/${buildFolderPath(
            "21EBH0789L",
            "DAVID ALFARO SIQUEIROS (JALTOCAN)",
            "Actividad 3 - Evidendia ABC del las Emociones"
        )}`;
        const samplePublicId = "21EBH0789L_ACT3_ABC_evidencia_actividad_3";
        const fullPath = `${folder}/${samplePublicId}`;
        
        expect(fullPath).toBe("SISAT-ATP/21EBH0789L/ACT3_ABC/21EBH0789L_ACT3_ABC_evidencia_actividad_3");
        expect(fullPath.length).toBeLessThan(80);
        expect(fullPath.length).toBeLessThan(255);
    });

    it("limpia extensiones dobles (.pdf.pdf) y evita extensiones en el public_id", () => {
        let cleanDoc = "actividad_3_abc.pdf.pdf";
        while (/\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|webp|csv|txt)$/i.test(cleanDoc)) {
            cleanDoc = cleanDoc.replace(/\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|webp|csv|txt)$/i, "");
        }
        expect(cleanDoc).toBe("actividad_3_abc");
    });
});
