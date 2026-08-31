export const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Orden oficial del ciclo escolar mexicano: Agosto (8) a Julio (7) */
export const MESES_CICLO_ESCOLAR = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];

/** Devuelve la posición ordinal del mes en el ciclo escolar (Agosto=0, Septiembre=1 ... Julio=11) */
export function getMesOrdenEscolar(mes?: number | null): number {
    if (!mes || mes < 1 || mes > 12) return 999;
    return mes >= 8 ? mes - 8 : mes + 4;
}

/** Ordena periodos respetando el ciclo escolar: Agosto a Julio y Semestre 1 a 2 */
export function ordenarPeriodosEscolares<T extends { mes?: number | null; semestre?: number | null }>(periodos: T[]): T[] {
    return [...periodos].sort((a, b) => {
        if (a.semestre != null && b.semestre != null) {
            return a.semestre - b.semestre;
        }
        if (a.mes != null && b.mes != null) {
            return getMesOrdenEscolar(a.mes) - getMesOrdenEscolar(b.mes);
        }
        return 0;
    });
}

export const ACTIVIDADES_CULTURA_PAZ: Record<number, string> = {
    1: "Día Internacional de la Paz",
    2: "Actividades colectivas del ABC de las emociones",
    3: "Día Internacional de la No Violencia",
    4: "Día de la Resistencia Indígena",
    5: "Conformación de Comité de Paz",
    6: "Vive Saludable, Vive Feliz",
    7: "Día de los Derechos Humanos",
    8: "Prevención de Adicciones (El Fentanilo te Mata)",
};

/** Devuelve el nombre amigable de un periodo según el programa (mes, semestre o actividad de Cultura de Paz) */
export function getNombrePeriodo(
    periodo: { mes?: number | null; semestre?: number | null },
    programaNombre?: string | null
): string {
    const pNom = (programaNombre || "").toUpperCase();
    if (pNom.includes("CULTURA DE PAZ") || pNom.includes("SEGURIDAD")) {
        if (periodo.mes && ACTIVIDADES_CULTURA_PAZ[periodo.mes]) {
            return ACTIVIDADES_CULTURA_PAZ[periodo.mes];
        }
    }
    if (periodo.mes) return MESES[periodo.mes] || `Mes ${periodo.mes}`;
    if (periodo.semestre) return `Semestre ${periodo.semestre}`;
    return "Entrega Única / Anual";
}

export const ESTADOS = ["PENDIENTE", "EN_REVISION", "REQUIERE_CORRECCION", "APROBADO", "NO_APROBADO", "NO_ENTREGADO", "EXENTO", "ENTREGADO_FISICO"];

export const ESTADO_LABELS: Record<string, string> = {
    PENDIENTE: "Entregado",
    EN_REVISION: "En Revisión",
    REQUIERE_CORRECCION: "Req. Corrección",
    APROBADO: "Aprobado",
    NO_APROBADO: "No Aprobado",
    NO_ENTREGADO: "No Entregado",
    EXENTO: "No Aplica",
    ENTREGADO_FISICO: "Entregado por otro medio",
};

export const ESTADO_COLORS: Record<string, string> = {
    PENDIENTE: "var(--warning)",
    EN_REVISION: "var(--primary)",
    REQUIERE_CORRECCION: "#e67e22",
    APROBADO: "var(--success)",
    NO_APROBADO: "var(--danger)",
    NO_ENTREGADO: "var(--text-muted)",
    EXENTO: "#94a3b8",
    ENTREGADO_FISICO: "var(--success)",
};

// ─── Expedientes de Personal ──────────────────────────

export const DOCUMENTOS_PREDETERMINADOS = [
    { tipo: "TITULO", label: "Título", multiple: true },
    { tipo: "CEDULA", label: "Cédula", multiple: true },
    { tipo: "ACTA_NACIMIENTO", label: "Acta de Nacimiento", multiple: false },
    { tipo: "CURP_DOC", label: "CURP", multiple: false },
    { tipo: "ORDEN_ADSCRIPCION", label: "Orden de Adscripción", multiple: true },
    { tipo: "MOVIMIENTO_PERSONAL", label: "Movimiento de Personal", multiple: true },
    { tipo: "COMPROBANTE_PAGO", label: "Comprobante de Pago", multiple: false },
    { tipo: "COMPROBANTE_FISCAL", label: "Comprobante Fiscal", multiple: false },
    { tipo: "INE", label: "INE", multiple: false },
    { tipo: "COMPROBANTE_DOMICILIO", label: "Comprobante de Domicilio", multiple: false },
] as const;

export const CARGOS_PERSONAL = [
    { value: "SUPERVISOR", label: "Supervisor de Zona" },
    { value: "ATP", label: "Apoyo Técnico Pedagógico (ATP)" },
    { value: "RESPONSABLE", label: "Responsable del Plantel" },
    { value: "DOCENTE", label: "Docente" },
    { value: "ADMINISTRATIVO", label: "Administrativo" },
    { value: "APOYO", label: "Personal de Apoyo" },
] as const;

export const GRADOS_ACADEMICOS = [
    { value: "BACHILLERATO", label: "Bachillerato" },
    { value: "LICENCIATURA", label: "Licenciatura" },
    { value: "MAESTRIA", label: "Maestría" },
    { value: "DOCTORADO", label: "Doctorado" },
    { value: "OTRO", label: "Otro" },
] as const;

export const SEXOS = [
    { value: "MASCULINO", label: "Masculino" },
    { value: "FEMENINO", label: "Femenino" },
] as const;

export const SECCIONES_PERMISOS = [
    // Monitoreo
    { key: "general", label: "Vista General" },
    { 
        key: "avances", 
        label: "Avance de Entregas",
        sub: [
            { key: "avances_programa", label: "Avance por Programa" },
            { key: "avances_escuela", label: "Avance por Escuela" },
            { key: "avances_capems", label: "Fichas CAPEMS" }
        ]
    },
    { key: "reportesNivel", label: "Reportes al Nivel" },
    // Configuración
    { key: "escuelas", label: "Escuelas" },
    { key: "programas", label: "Programas y Módulos" },
    { key: "fechas", label: "Periodos y Tareas" },
    { key: "ciclos", label: "Ciclos Escolares" },
    { key: "formatos", label: "Formatos y Plantillas" },
    { 
        key: "capems", 
        label: "Configuración CAPEMS",
        sub: [
            { key: "capems_fichas", label: "Gestión de Fichas" },
            { key: "capems_capems", label: "Gestión de CAPEMS" }
        ]
    },
    { key: "seguridad", label: "Accesos y Seguridad" },
    { key: "rubricas", label: "Herramientas de IA" },
    // Módulos Activos
    { key: "eventos", label: "Eventos Culturales" },
    { key: "circular05", label: "Circular 03" },
    { key: "olimpiada", label: "Olimpiada Matemáticas" },
    { key: "paec", label: "Encuentro PAEC" },
    { 
        key: "expedientes", 
        label: "Expedientes Personal",
        sub: [
            { key: "expedientes_documentos", label: "Documentos y Avances" },
            { key: "expedientes_personal", label: "Gestión de Personal" }
        ]
    },
    { 
        key: "documentos", 
        label: "Documentos Admin",
        sub: [
            { key: "documentos_generar", label: "Generar Documento" },
            { key: "documentos_plantillas", label: "Gestión de Plantillas" },
            { key: "documentos_autoridades", label: "Autoridades Educativas" }
        ]
    },
    {
        key: "auditoria_atp",
        label: "Auditoría Inteligente ATP",
        sub: [
            { key: "auditoria_cuenta", label: "Fuente & Configuración" },
            { key: "auditoria_ingesta", label: "Importar Evidencia" },
            { key: "auditoria_explorador", label: "Explorador de Comunicaciones" },
            { key: "auditoria_procesos", label: "Procesos Descubiertos" },
            { key: "auditoria_plan", label: "Plan Maestro de Automatización" },
            { key: "auditoria_gap", label: "Matriz GAP" }
        ]
    },
    { key: "cedulas_supervision", label: "Cédulas de Supervisión (Voz & Campo)" },
];

export const DEFAULT_PERMISOS: Record<string, string> = {
    general: "LECTURA",
    avances: "LECTURA",
    avances_programa: "LECTURA",
    avances_escuela: "LECTURA",
    avances_capems: "LECTURA",
    reportesNivel: "NINGUNO",
    escuelas: "NINGUNO",
    programas: "NINGUNO",
    fechas: "NINGUNO",
    ciclos: "NINGUNO",
    formatos: "LECTURA",
    capems: "NINGUNO",
    capems_fichas: "NINGUNO",
    capems_capems: "NINGUNO",
    seguridad: "NINGUNO",
    rubricas: "NINGUNO",
    eventos: "LECTURA",
    circular05: "LECTURA",
    olimpiada: "LECTURA",
    paec: "LECTURA",
    expedientes: "NINGUNO",
    expedientes_documentos: "NINGUNO",
    expedientes_personal: "NINGUNO",
    documentos: "NINGUNO",
    documentos_generar: "NINGUNO",
    documentos_plantillas: "NINGUNO",
    documentos_autoridades: "NINGUNO",
    auditoria_atp: "NINGUNO",
    auditoria_cuenta: "NINGUNO",
    auditoria_ingesta: "NINGUNO",
    auditoria_explorador: "NINGUNO",
    auditoria_procesos: "NINGUNO",
    auditoria_plan: "NINGUNO",
    auditoria_gap: "NINGUNO",
    cedulas_supervision: "ESCRITURA",
};

