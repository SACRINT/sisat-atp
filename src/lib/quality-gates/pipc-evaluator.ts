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

    // 2. Plan de Evacuación y Contingencia
    const tienePlanEvacuacion = /plan\s+de\s+evacuaci[oó]n|ruta[s]?\s+de\s+evacuaci[oó]n|protocolo\s+de\s+actuaci[oó]n|procedimiento\s+de\s+emergencia|simulacro/i.test(tLower);

    // 3. Croquis y Señalética
    const tieneCroquisSenaletica = /croquis|plano|se[ñn]al[eé]tica|se[ñn]alizaci[oó]n|distribuci[oó]n\s+del\s+inmueble/i.test(tLower);

    // 4. Directorio de Emergencias
    const tieneDirectorioEmergencias = /directorio|n[uú]meros\s+de\s+emergencia|911|cruz\s+roja|bomberos|protecci[oó]n\s+civil|seguridad\s+p[uú]blica/i.test(tLower);

    // 5. Formalidad de Firmas y Sellos
    const tieneFirmasSellos = /director|directora|responsable|titular|firma|sello|comit[eé]|unidad\s+interna/i.test(tLower);

    // Ponderación cuantitativa determinista (Total: 100 pts)
    // Brigadas: 40 pts (10 por brigada)
    // Plan de Evacuación: 20 pts
    // Directorio de Emergencias: 15 pts
    // Croquis y Señalética: 15 pts
    // Formalidad y Acreditación: 10 pts
    let score = 0;
    score += brigadasDetectadas * 10;
    if (tienePlanEvacuacion) score += 20;
    if (tieneDirectorioEmergencias) score += 15;
    if (tieneCroquisSenaletica) score += 15;
    if (tieneFirmasSellos) score += 10;

    const scoreNumerico = Math.min(100, Math.max(0, score));

    // Regla de aprobación vinculante
    const aprobado = scoreNumerico >= 70 && tieneBrigadas;
    const estatusOficial = aprobado ? "APROBADO" : "REQUIERE_AJUSTES";

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
        tienePlanEvacuacion,
        tieneCroquisSenaletica,
        tieneDirectorioEmergencias,
        tieneFirmasSellos,
        tieneIncidencias: !aprobado,
        explicacion: explicacionPartes.join(" ")
    };
}
