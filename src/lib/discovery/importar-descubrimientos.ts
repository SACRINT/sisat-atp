import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";

export interface ResultadoImportacionDescubrimientos {
    success: boolean;
    tenantId: string;
    directorioResultados: string;
    procesosImportados: number;
    tareasImportadas: number;
    gapItemsImportados: number;
    modulosImportados: number;
    detalles: {
        procesos: string[];
        tareas: number;
        gapItems: number;
        modulos: string[];
    };
    error?: string;
}

export async function importarDescubrimientos({
    tenantId,
    directorioCorpus,
}: {
    tenantId: string;
    directorioCorpus?: string;
}): Promise<ResultadoImportacionDescubrimientos> {
    if (!tenantId) {
        throw new Error("tenantId es obligatorio para importar descubrimientos.");
    }

    const baseDir = directorioCorpus || process.env.CORPUS_BASE_DIR;
    if (!baseDir) {
        throw new Error(
            "CORPUS_BASE_DIR no está configurado. Define la variable de entorno CORPUS_BASE_DIR o pasa directorioCorpus."
        );
    }
    const resultadosDir = path.join(baseDir, "Resultados");

    if (!fs.existsSync(resultadosDir)) {
        throw new Error(`No se encontró la carpeta de Resultados en: ${resultadosDir}`);
    }

    console.log(`[DESCUBRIMIENTO] Iniciando importación para tenant [${tenantId}] desde ${resultadosDir}`);

    // ── 1. PROCESOS (catalogo_procesos.json) ───────────────────────────────────
    const procesosPath = path.join(resultadosDir, "catalogo_procesos.json");
    if (!fs.existsSync(procesosPath)) {
        throw new Error(`Archivo no encontrado: ${procesosPath}`);
    }

    const procesosRaw = JSON.parse(fs.readFileSync(procesosPath, "utf-8"));
    const procesosImportados: string[] = [];

    for (const p of procesosRaw) {
        const procId = p.id;
        const horasMinCiclo = Number(p.horas_min_ciclo || 0);
        const horasMaxCiclo = Number(p.horas_max_ciclo || 0);
        const ahorroHoras = Number(p.ahorro_anual_estimado?.horas_min_ano || (horasMinCiclo * (p.ciclos_anuales || 1)));

        await prisma.process.upsert({
            where: { id: procId },
            update: {
                tenantId,
                nombre: p.nombre,
                descripcion: p.descripcion || "",
                origenPrincipal: p.origen || "SEP / CORDE / Dirección General",
                frecuenciaEstimada: p.frecuencia || "Semanal",
                participantes: p.participantes || [],
                entradas: p.entradas || [],
                salidas: p.salidas || [],
                documentosRelacionados: p.evidencia?.muestra_adjuntos_nombres || [],
                nivelRepeticion: p.automatizabilidad_desc || "Frecuente",
                tiempoEstimadoMinHoras: horasMinCiclo,
                tiempoEstimadoMaxHoras: horasMaxCiclo,
                ahorroEstimadoHoras: ahorroHoras,
                automatizabilidad: Number(p.nivel_automatizabilidad || 1),
                prioridadScore: Number(p.prioridad || 50),
                nivelPrioridad: p.prioridad >= 80 ? "ALTA" : p.prioridad >= 60 ? "MEDIA" : "BAJA",
                riesgoOperativo: (p.impacto_operativo || 50) >= 80 ? "ALTO" : "MEDIO",
                confianzaScore: Number(p.confianza || 90),
                razonDeteccion: p.confianza_razon || "Análisis automatizado de correos y documentos",
            },
            create: {
                id: procId,
                tenantId,
                nombre: p.nombre,
                descripcion: p.descripcion || "",
                origenPrincipal: p.origen || "SEP / CORDE / Dirección General",
                frecuenciaEstimada: p.frecuencia || "Semanal",
                participantes: p.participantes || [],
                entradas: p.entradas || [],
                salidas: p.salidas || [],
                documentosRelacionados: p.evidencia?.muestra_adjuntos_nombres || [],
                nivelRepeticion: p.automatizabilidad_desc || "Frecuente",
                tiempoEstimadoMinHoras: horasMinCiclo,
                tiempoEstimadoMaxHoras: horasMaxCiclo,
                ahorroEstimadoHoras: ahorroHoras,
                automatizabilidad: Number(p.nivel_automatizabilidad || 1),
                prioridadScore: Number(p.prioridad || 50),
                nivelPrioridad: p.prioridad >= 80 ? "ALTA" : p.prioridad >= 60 ? "MEDIA" : "BAJA",
                riesgoOperativo: (p.impacto_operativo || 50) >= 80 ? "ALTO" : "MEDIO",
                confianzaScore: Number(p.confianza || 90),
                razonDeteccion: p.confianza_razon || "Análisis automatizado de correos y documentos",
                estado: "PROPUESTO",
            },
        });

        procesosImportados.push(procId);
    }

    // ── 2. MICRO-TAREAS (catalogo_tareas_repetitivas.json) ─────────────────────
    const tareasPath = path.join(resultadosDir, "catalogo_tareas_repetitivas.json");
    let tareasCount = 0;

    if (fs.existsSync(tareasPath)) {
        const tareasRaw = JSON.parse(fs.readFileSync(tareasPath, "utf-8"));
        for (const t of tareasRaw) {
            const taskId = t.id;
            await prisma.task.upsert({
                where: { id: taskId },
                update: {
                    tenantId,
                    procesoId: t.proceso_id,
                    nombre: t.nombre,
                    descripcion: t.descripcion || null,
                    responsableActual: "ATP / Personal de Supervisión",
                    responsablePropuesto: "Plataforma SISAT-ATP",
                    automatizabilidad: Number(t.nivel_automatizabilidad || 1),
                    automatizabilidadDesc: t.automatizabilidad_desc || null,
                    automatizacionPropuesta: t.automatizacion_propuesta || null,
                    frecuencia: `${t.frecuencia_anual || 0} veces al año`,
                    frecuenciaAnual: Number(t.frecuencia_anual || 0),
                    tiempoMinUnitario: Number(t.tiempo_min_unitario || 0),
                    tiempoMaxUnitario: Number(t.tiempo_max_unitario || 0),
                    horasMinAno: Number(t.horas_min_ano || 0),
                    horasMaxAno: Number(t.horas_max_ano || 0),
                    duracionMinutosMin: Number(t.tiempo_min_unitario || 15),
                    duracionMinutosMax: Number(t.tiempo_max_unitario || 60),
                    herramientasUsadas: t.herramienta_actual ? [t.herramienta_actual] : [],
                    actividadManualTipo: t.herramienta_actual || null,
                },
                create: {
                    id: taskId,
                    tenantId,
                    procesoId: t.proceso_id,
                    nombre: t.nombre,
                    descripcion: t.descripcion || null,
                    responsableActual: "ATP / Personal de Supervisión",
                    responsablePropuesto: "Plataforma SISAT-ATP",
                    automatizabilidad: Number(t.nivel_automatizabilidad || 1),
                    automatizabilidadDesc: t.automatizabilidad_desc || null,
                    automatizacionPropuesta: t.automatizacion_propuesta || null,
                    frecuencia: `${t.frecuencia_anual || 0} veces al año`,
                    frecuenciaAnual: Number(t.frecuencia_anual || 0),
                    tiempoMinUnitario: Number(t.tiempo_min_unitario || 0),
                    tiempoMaxUnitario: Number(t.tiempo_max_unitario || 0),
                    horasMinAno: Number(t.horas_min_ano || 0),
                    horasMaxAno: Number(t.horas_max_ano || 0),
                    duracionMinutosMin: Number(t.tiempo_min_unitario || 15),
                    duracionMinutosMax: Number(t.tiempo_max_unitario || 60),
                    herramientasUsadas: t.herramienta_actual ? [t.herramienta_actual] : [],
                    actividadManualTipo: t.herramienta_actual || null,
                    estado: "IDENTIFICADO",
                },
            });
            tareasCount++;
        }
    }

    // ── 3. MATRIZ GAP (matriz_gap.json) ───────────────────────────────────────
    const gapPath = path.join(resultadosDir, "matriz_gap.json");
    let gapCount = 0;

    if (fs.existsSync(gapPath)) {
        const gapRaw = JSON.parse(fs.readFileSync(gapPath, "utf-8"));
        for (const g of gapRaw) {
            const gapId = `GAP-${g.id_proceso}`;
            const modulosRel = Array.isArray(g.modulos_existentes_relacionados)
                ? g.modulos_existentes_relacionados.join(", ")
                : (g.modulos_existentes_relacionados || "Ninguno");

            await prisma.gapItem.upsert({
                where: { id: gapId },
                update: {
                    tenantId,
                    procesoId: g.id_proceso,
                    nombreProceso: g.nombre_proceso || "",
                    plataformaActual: modulosRel,
                    estadoCobertura: g.estado_cobertura || "NO CUBIERTO",
                    funcionalidadFaltante: g.brecha_funcional || g.analisis_codigo || "",
                    solucionPropuesta: g.modulo_propuesto || "",
                    prioridad: String(g.prioridad || "MEDIA"),
                },
                create: {
                    id: gapId,
                    tenantId,
                    procesoId: g.id_proceso,
                    nombreProceso: g.nombre_proceso || "",
                    plataformaActual: modulosRel,
                    estadoCobertura: g.estado_cobertura || "NO CUBIERTO",
                    funcionalidadFaltante: g.brecha_funcional || g.analisis_codigo || "",
                    solucionPropuesta: g.modulo_propuesto || "",
                    prioridad: String(g.prioridad || "MEDIA"),
                },
            });
            gapCount++;
        }
    }

    // ── 4. PLAN MAESTRO Y MÓDULOS (plan_maestro.md + especificaciones/*.md) ──
    const especificacionesDir = path.join(resultadosDir, "especificaciones");
    const modulosDefiniciones = [
        {
            id: "ATP-MOD-01",
            file: "modulo_gestion_oficios_plazos.md",
            nombreModulo: "Gestión Central de Oficios, Circulares y Plazos Urgentes",
            faseRoadmap: 1,
            procesoOrigenId: "ATP-PROC-008",
            prioridad: "ALTA",
            complejidad: "MEDIA",
            objetivo: "Bandeja de circulares y semáforo de plazos fatales (<24h, <72h) con extracción OCR de fechas límite por IA y recolección de acuses.",
            problemaQueResuelve: "Llegada constante de requerimientos institucionales con plazos estrictos y riesgo de incumplimiento por oficios traspapelados.",
            beneficioCualitativo: "Eliminación de rezagos de entrega y multas administrativas por oficios extemporáneos.",
            ahorroHorasAnualMin: 180,
            ahorroHorasAnualMax: 360,
        },
        {
            id: "ATP-MOD-02",
            file: "modulo_plantillas_sparh_census.md",
            nombreModulo: "Validador y Consolidador de Plantillas SPARH / CENSUS",
            faseRoadmap: 2,
            procesoOrigenId: "ATP-PROC-001",
            prioridad: "ALTA",
            complejidad: "ALTA",
            objetivo: "Ingesta y validación matemática de archivos Excel de plantillas docentes con detección de sobrecupos y cruce de compatibilidad horaria.",
            problemaQueResuelve: "Cotejo manual en hojas de cálculo extensas con riesgo de inconsistencias de nómina o dobles plazas incompatibles.",
            beneficioCualitativo: "Certeza jurídica en auditorías de nómina y conciliación presupuestal inmediata.",
            ahorroHorasAnualMin: 144,
            ahorroHorasAnualMax: 288,
        },
        {
            id: "ATP-MOD-03",
            file: "modulo_estadistica_911_sicep.md",
            nombreModulo: "Auditoría y Validación de Estadística 911 / SICEP",
            faseRoadmap: 2,
            procesoOrigenId: "ATP-PROC-004",
            prioridad: "MEDIA",
            complejidad: "MEDIA",
            objetivo: "Validador aritmético de formatos oficiales 911 (911.7 / .G / .I) y cruce contra matrícula SICEP con generador de indicadores zonales.",
            problemaQueResuelve: "Discrepancias aritméticas entre matrícula inicial, altas/bajas, repetidores y egreso efectivo.",
            beneficioCualitativo: "Indicadores zonales de reprobación y eficiencia terminal calculados al instante.",
            ahorroHorasAnualMin: 72,
            ahorroHorasAnualMax: 144,
        },
        {
            id: "ATP-MOD-04",
            file: "modulo_dictaminador_convocatorias_usicamm.md",
            nombreModulo: "Mesa de Dictaminación y Validación USICAMM",
            faseRoadmap: 3,
            procesoOrigenId: "ATP-PROC-002",
            prioridad: "MEDIA",
            complejidad: "MEDIA",
            objetivo: "Mesa de dictamen USICAMM con verificación OCR de constancias docentes contra catálogo nacional de cursos válidos.",
            problemaQueResuelve: "Revisión manual de cientos de constancias de formación docente para procesos de promoción horizontal y vertical.",
            beneficioCualitativo: "Transparencia absoluta en dictámenes con validez oficial sin duplicidad de esfuerzo.",
            ahorroHorasAnualMin: 60,
            ahorroHorasAnualMax: 120,
        },
        {
            id: "ATP-MOD-05",
            file: "modulo_becas_benito_juarez.md",
            nombreModulo: "Dispersión y Seguimiento de Becas Benito Juárez",
            faseRoadmap: 3,
            procesoOrigenId: "ATP-PROC-006",
            prioridad: "MEDIA",
            complejidad: "BAJA",
            objetivo: "Segmentación de padrones masivos de becarios por CCT, calendario de bancarización y captura estructurada de incidencias.",
            problemaQueResuelve: "Desorganización en operativos de entrega de tarjetas y dudas recurrentes de directores y padres de familia.",
            beneficioCualitativo: "Acompañamiento efectivo a directores y estudiantes beneficiarios.",
            ahorroHorasAnualMin: 48,
            ahorroHorasAnualMax: 96,
        },
        {
            id: "ATP-MOD-06",
            file: "modulo_acompanamiento_cte.md",
            nombreModulo: "Acompañamiento y Repositorio de Consejos Técnicos Escolares (CTE)",
            faseRoadmap: 4,
            procesoOrigenId: "ATP-PROC-007",
            prioridad: "MEDIA",
            complejidad: "BAJA",
            objetivo: "Repositorio estructurado por sesión de CTE con recolección de productos y síntesis analítica de compromisos con IA.",
            problemaQueResuelve: "Falta de seguimiento sistemático a los compromisos y metas planteadas en cada sesión de CTE de los planteles.",
            beneficioCualitativo: "Tablero analítico zonal de acuerdos y mejoras pedagógicas continuas.",
            ahorroHorasAnualMin: 50,
            ahorroHorasAnualMax: 100,
        },
        {
            id: "ATP-MOD-07",
            file: "modulo_comites_convivencia_seguridad.md",
            nombreModulo: "Gestión de Comités de Convivencia y Seguridad Escolar",
            faseRoadmap: 3,
            procesoOrigenId: "ATP-PROC-005",
            prioridad: "MEDIA",
            complejidad: "MEDIA",
            objetivo: "Buzón de actas de comités de convivencia, protección civil y salud con verificación de firmas y galería de evidencias.",
            problemaQueResuelve: "Dispersión de evidencias y formatos de comités requeridos periódicamente por diversas instancias gubernamentales.",
            beneficioCualitativo: "Cumplimiento normativo y protocolos de prevención activos en los 25 bachilleratos.",
            ahorroHorasAnualMin: 40,
            ahorroHorasAnualMax: 80,
        },
    ];

    const modulosImportados: string[] = [];

    for (const m of modulosDefiniciones) {
        let specMd = "";
        const filePath = path.join(especificacionesDir, m.file);
        if (fs.existsSync(filePath)) {
            specMd = fs.readFileSync(filePath, "utf-8");
        }

        // Mantener el estado de decisión si ya existía
        const existing = await prisma.modulePlan.findUnique({
            where: { id: m.id },
        });

        await prisma.modulePlan.upsert({
            where: { id: m.id },
            update: {
                tenantId,
                nombreModulo: m.nombreModulo,
                faseRoadmap: m.faseRoadmap,
                procesoOrigenId: m.procesoOrigenId,
                objetivo: m.objetivo,
                problemaQueResuelve: m.problemaQueResuelve,
                especificacionJson: {
                    archivoSpec: m.file,
                    faseRoadmap: m.faseRoadmap,
                    ahorroMin: m.ahorroHorasAnualMin,
                    ahorroMax: m.ahorroHorasAnualMax,
                },
                especificacionMd: specMd || m.objetivo,
                prioridad: m.prioridad,
                complejidad: m.complejidad,
                beneficioCualitativo: m.beneficioCualitativo,
                ahorroHorasAnualMin: m.ahorroHorasAnualMin,
                ahorroHorasAnualMax: m.ahorroHorasAnualMax,
                // No sobreescribir estado si ya fue decidido
                estado: existing?.estado || "PENDIENTE",
            },
            create: {
                id: m.id,
                tenantId,
                nombreModulo: m.nombreModulo,
                faseRoadmap: m.faseRoadmap,
                procesoOrigenId: m.procesoOrigenId,
                objetivo: m.objetivo,
                problemaQueResuelve: m.problemaQueResuelve,
                especificacionJson: {
                    archivoSpec: m.file,
                    faseRoadmap: m.faseRoadmap,
                    ahorroMin: m.ahorroHorasAnualMin,
                    ahorroMax: m.ahorroHorasAnualMax,
                },
                especificacionMd: specMd || m.objetivo,
                prioridad: m.prioridad,
                complejidad: m.complejidad,
                beneficioCualitativo: m.beneficioCualitativo,
                ahorroHorasAnualMin: m.ahorroHorasAnualMin,
                ahorroHorasAnualMax: m.ahorroHorasAnualMax,
                estado: "PENDIENTE",
            },
        });

        modulosImportados.push(m.id);
    }

    return {
        success: true,
        tenantId,
        directorioResultados: resultadosDir,
        procesosImportados: procesosImportados.length,
        tareasImportadas: tareasCount,
        gapItemsImportados: gapCount,
        modulosImportados: modulosImportados.length,
        detalles: {
            procesos: procesosImportados,
            tareas: tareasCount,
            gapItems: gapCount,
            modulos: modulosImportados,
        },
    };
}
