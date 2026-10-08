import type { PreRevisionResult } from "../pre-revision";

export interface PipcEscuelaInfo {
    nombre?: string;
    escuelaNombre?: string;
    cct?: string;
    escuelaCct?: string;
}

export interface PipcAuditoriaDetalle {
    tieneBrigadaPrimerosAuxilios: boolean;
    tieneBrigadaIncendios: boolean;
    tieneBrigadaEvacuacion: boolean;
    tieneBrigadaBusquedaRescate: boolean;
    todasLasBrigadas: boolean;
    tienePlanEvacuacion: boolean;
    tieneCroquisSenaletica: boolean;
    tieneDirectorioEmergencias: boolean;
    tieneFirmasSellos: boolean;
    scoreNumerico: number;
    aprobado: boolean;
    estatusOficial: string;
    explicacion: string;
}

/**
 * Auditor determinista para el Programa Interno de Protección Civil (PIPC).
 * Evalúa componentes obligatorios del marco normativo de Protección Civil Escolar.
 * 
 * Regla vinculante:
 * Aprobado = scoreNumerico >= 70 && tieneBrigadas === true (las 4 brigadas oficiales presentes).
 */
export function auditarPipcDeterminista(
    texto: string,
    escuela?: PipcEscuelaInfo
): PreRevisionResult {
    const tLower = (texto || "").toLowerCase();

    // 1. Evaluación de las 4 Brigadas Oficiales Indispensables
    const tieneBrigadaPrimerosAuxilios = /primeros\s+auxilios|atenci[oó]n\s+m[eé]dica|botiqu[ií]n/i.test(tLower);
    const tieneBrigadaIncendios = /prevenci[oó]n\s+y\s+combate\s+de\s+incendios|incendio[s]?|extintor[es]?|fuego/i.test(tLower);
    const tieneBrigadaEvacuacion = /evacuaci[oó]n|repliegue|punto[s]?\s+de\s+reuni[oó]n/i.test(tLower);
    const tieneBrigadaBusquedaRescate = /b[uú]squeda\s+y\s+rescate|salvamento/i.test(tLower);

    const brigadasDetectadas = [
        tieneBrigadaPrimerosAuxilios,
        tieneBrigadaIncendios,
        tieneBrigadaEvacuacion,
        tieneBrigadaBusquedaRescate
    ].filter(Boolean).length;

    const tieneBrigadas = brigadasDetectadas === 4;

    // 2. Diagnóstico y Análisis de Riesgos Internos y Externos (Comp 2: 20 pts)
    const tieneDiagnosticoRiesgos = /diagn[oó]stico|an[aá]lisis\s+de\s+riesgos?|riesgos?\s+(?:internos?|externos?)|vulnerabilidad|amenaza|instalaciones|sismicidad/i.test(tLower);

    // 3. Plan de Evacuación y Protocolos de Contingencia (Comp 3: 20 pts)
    const tienePlanEvacuacion = /plan\s+de\s+evacuaci[oó]n|ruta[s]?\s+de\s+evacuaci[oó]n|protocolo|contingencia|simulacro|repliegue/i.test(tLower);

    // 4. Directorio de Emergencias y Croquis de Evacuación (Comp 4: 20 pts = 10 + 10)
    const tieneDirectorioEmergencias = /directorio|n[uú]meros\s+de\s+emergencia|911|cruz\s+roja|bomberos|protecci[oó]n\s+civil|seguridad\s+p[uú]blica/i.test(tLower);
    const tieneCroquisSenaletica = /croquis|plano|se[ñn]al[eé]tica|se[ñn]alizaci[oó]n|distribuci[oó]n\s+del\s+inmueble/i.test(tLower);

    // 5. Formalidad de Firmas y Acreditación Institucional (Comp 5: 15 pts)
    const tieneFirmasSellos = /director|directora|responsable|titular|firma|sello|comit[eé]|unidad\s+interna/i.test(tLower);

    // Ponderación cuantitativa oficial conforme a plan §3.3 (Total: 100 pts)
    // Comp 1: Brigadas (25 pts no lineales: 4 brigadas = 25 pts, 2-3 brigadas = 15 pts, 1 brigada = 5 pts)
    let ptsBrigadas = 0;
    if (brigadasDetectadas === 4) ptsBrigadas = 25;
    else if (brigadasDetectadas >= 2) ptsBrigadas = 15;
    else if (brigadasDetectadas === 1) ptsBrigadas = 5;

    // Comp 2: Diagnóstico de Riesgos (20 pts)
    const ptsDiagnostico = tieneDiagnosticoRiesgos ? 20 : 0;

    // Comp 3: Plan de Evacuación y Contingencia (20 pts)
    const ptsPlan = tienePlanEvacuacion ? 20 : 0;

    // Comp 4: Directorio (10 pts) + Croquis (10 pts) = 20 pts
    let ptsDirectorioCroquis = 0;
    if (tieneDirectorioEmergencias) ptsDirectorioCroquis += 10;
    if (tieneCroquisSenaletica) ptsDirectorioCroquis += 10;

    // Comp 5: Formalidad y Firmas (15 pts)
    const ptsFormalidad = tieneFirmasSellos ? 15 : 0;

    const scoreNumerico = Math.min(100, Math.max(0, ptsBrigadas + ptsDiagnostico + ptsPlan + ptsDirectorioCroquis + ptsFormalidad));

    // Regla de aprobación vinculante
    const aprobado = scoreNumerico >= 70 && tieneBrigadas;
    const estatusOficial = aprobado ? "APROBADO" : "REQUIERE_CORRECCION";

    // Construcción de la explicación técnica
    const escuelaNombre = escuela?.nombre || escuela?.escuelaNombre || "Plantel Educativo";
    const explicacionPartes: string[] = [];

    explicacionPartes.push(`Evaluación determinista de PIPC para ${escuelaNombre}. Puntuación obtenida: ${scoreNumerico}/100.`);

    if (aprobado) {
        explicacionPartes.push("El documento cumple satisfactoriamente con los requisitos normativos: se identificaron las 4 brigadas escolares (Primeros Auxilios, Incendios, Evacuación, Búsqueda y Rescate), el plan de contingencia, el directorio de emergencias y la formalidad institucional requerida.");
    } else {
        const omisiones: string[] = [];
        if (!tieneBrigadas) {
            const faltantesBrigadas: string[] = [];
            if (!tieneBrigadaPrimerosAuxilios) faltantesBrigadas.push("Primeros Auxilios");
            if (!tieneBrigadaIncendios) faltantesBrigadas.push("Prevención de Incendios");
            if (!tieneBrigadaEvacuacion) faltantesBrigadas.push("Evacuación");
            if (!tieneBrigadaBusquedaRescate) faltantesBrigadas.push("Búsqueda y Rescate");
            omisiones.push(`Integración incompleta de brigadas (${brigadasDetectadas}/4 identificadas; faltan: ${faltantesBrigadas.join(", ")})`);
        }
        if (!tieneDiagnosticoRiesgos) omisiones.push("Diagnóstico y análisis de riesgos internos y externos");
        if (!tienePlanEvacuacion) omisiones.push("Plan formal de evacuación y contingencias");
        if (!tieneDirectorioEmergencias) omisiones.push("Directorio telefónico de emergencias (911 / Bomberos / Cruz Roja)");
        if (!tieneCroquisSenaletica) omisiones.push("Croquis o señalamientos de protección civil");
        if (!tieneFirmasSellos) omisiones.push("Firmas y sellos de acreditación de la unidad interna");

        explicacionPartes.push(`No alcanza el dictamen aprobatorio debido a: ${omisiones.join("; ")}.`);
    }

    return {
        tipo: "PIPC",
        aprobado,
        scoreNumerico,
        puntuacion: `${scoreNumerico}%`,
        estatusOficial,
        tieneBrigadas,
        tieneDiagnosticoRiesgos,
        tienePlanEvacuacion,
        tieneCroquisSenaletica,
        tieneDirectorioEmergencias,
        tieneFirmasSellos,
        tieneIncidencias: !aprobado,
        explicacion: explicacionPartes.join(" ")
    };
}
