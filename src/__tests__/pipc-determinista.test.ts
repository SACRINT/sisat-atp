import { describe, it, expect } from "vitest";
import { auditarPipcDeterminista } from "../lib/quality-gates/pipc-evaluator";

describe("Motor Determinista de PIPC y Enforcement Vinculante", () => {
    const escuelaInfo = {
        nombre: "BACHILLERATO HEROES DE LA REVOLUCION",
        cct: "21EBH0201W",
    };

    const pipcCompletoTexto = `
        GOBIERNO DEL ESTADO DE PUEBLA
        SECRETARÍA DE EDUCACIÓN PÚBLICA
        BACHILLERATO HEROES DE LA REVOLUCION - CCT: 21EBH0201W
        
        PROGRAMA INTERNO DE PROTECCIÓN CIVIL (PIPC)
        CICLO ESCOLAR 2025 - 2026
        
        1. ACTA CONSTITUTIVA DE LA UNIDAD INTERNA Y BRIGADAS ESCOLARES:
        - Brigada de Primeros Auxilios: Responsable Mtra. Ana Gómez (Atención médica y botiquín).
        - Brigada de Prevención y Combate de Incendios: Responsable Ing. Roberto Flores (Manejo de extintores y combate de fuego).
        - Brigada de Evacuación de Inmuebles: Responsable Prof. Luis Méndez (Repliegue y zonas de menor riesgo).
        - Brigada de Búsqueda y Rescate: Responsable Lic. Mario Rojas (Salvamento y verificación de aulas).
        
        2. PLAN DE CONTINGENCIA Y PROTOCOLOS DE EVACUACIÓN:
        Rutas de evacuación señalizadas hacia el punto de reunión central en la plaza cívica.
        Tiempos estimados de repliegue de 90 segundos para los simulacros programados.
        
        3. CROQUIS Y SEÑALIZACIÓN:
        Distribución del inmueble con croquis detallado de extintores, rutas y zonas de seguridad.
        
        4. DIRECTORIO TELEFÓNICO DE EMERGENCIAS:
        - Número Nacional de Emergencias: 911
        - Cruz Roja Mexicana: 222-234-5678
        - H. Cuerpo de Bomberos del Estado: 222-245-1234
        - Protección Civil Municipal: 222-309-4500
        
        5. DIAGNÓSTICO Y ANÁLISIS DE RIESGOS:
        Identificación de riesgos internos (instalaciones de gas, eléctricas) y riesgos externos perimetrales con evaluación de sismicidad.

        6. FORMALIDAD Y ACREDITACIÓN:
        MTRO. CARLOS SÁNCHEZ - DIRECTOR DEL PLANTEL Y RESPONSABLE DEL COMITÉ
        SELLO OFICIAL DEL PLANTEL EDUCATIVO
    `;

    it("debe aprobar un documento completo con las 4 brigadas y todos los componentes (aprobado: true)", () => {
        const res = auditarPipcDeterminista(pipcCompletoTexto, escuelaInfo);

        expect(res.tipo).toBe("PIPC");
        expect(res.aprobado).toBe(true);
        expect(res.scoreNumerico).toBeGreaterThanOrEqual(70);
        expect(res.estatusOficial).toBe("APROBADO");
        expect(res.tieneBrigadas).toBe(true);
        expect(res.tienePlanEvacuacion).toBe(true);
        expect(res.tieneCroquisSenaletica).toBe(true);
        expect(res.tieneDirectorioEmergencias).toBe(true);
        expect(res.tieneFirmasSellos).toBe(true);
        expect(res.tieneIncidencias).toBe(false);
        expect(res.explicacion).toContain("cumple satisfactoriamente");
    });

    it("debe rechazar el documento si faltan brigadas obligatorias aunque tenga plan y directorio (enforcement vinculante F-4B-4)", () => {
        // Documento con Primeros Auxilios e Incendios, pero sin Evacuación ni Búsqueda y Rescate
        const pipcIncompletoBrigadas = `
            BACHILLERATO HEROES DE LA REVOLUCION 21EBH0201W
            PROGRAMA INTERNO DE PROTECCIÓN CIVIL
            
            BRIGADAS:
            - Brigada de Primeros Auxilios con botiquín escolar.
            - Brigada de Prevención de Incendios con extintores vigentes.
            
            DIAGNÓSTICO DE RIESGOS:
            Análisis de riesgos internos del inmueble.

            PLAN DE EVACUACIÓN Y CONTINGENCIA:
            Rutas de evacuación hacia la plaza cívica.
            
            CROQUIS Y SEÑALÉTICA:
            Plano del edificio escolar.
            
            DIRECTORIO DE EMERGENCIAS:
            911 y Bomberos.
            
            DIRECTOR DEL PLANTEL Y SELLO OFICIAL.
        `;

        const res = auditarPipcDeterminista(pipcIncompletoBrigadas, escuelaInfo);

        expect(res.tieneBrigadas).toBe(false);
        // Debe ser desaprobado por regla vinculante: aprobado = score >= 70 && tieneBrigadas
        expect(res.aprobado).toBe(false);
        expect(res.estatusOficial).toBe("REQUIERE_CORRECCION");
        expect(res.tieneIncidencias).toBe(true);
        expect(res.explicacion).toContain("Integración incompleta de brigadas");
    });

    it("debe rechazar un documento severamente incompleto", () => {
        const textoVacio = "Reglamento interno de disciplina escolar.";
        const res = auditarPipcDeterminista(textoVacio, escuelaInfo);

        expect(res.aprobado).toBe(false);
        expect(res.scoreNumerico).toBeLessThan(70);
        expect(res.tieneBrigadas).toBe(false);
        expect(res.estatusOficial).toBe("REQUIERE_CORRECCION");
    });
});
