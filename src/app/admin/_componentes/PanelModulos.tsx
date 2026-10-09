"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Trophy, FileText, GraduationCap, Lightbulb, BookMarked,
    Users, ToggleLeft, ToggleRight, Loader2, RefreshCw,
    Calendar, CheckCircle2, Clock, Eye, EyeOff, Settings2,
    AlertCircle, BarChart3,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ─── Types ──────────────────────────────────────────────────────────────

interface ModuloInfo {
    key: string;
    nombre: string;
    descripcion: string;
    icon: React.ReactNode;
    color: string;
    configEndpoint: string;    // GET/POST endpoint for activo + fechaLimite
    configPath?: string;       // Ruta (dot) del flag activo dentro de la respuesta GET (configEndpoint)
    configModule?: string;     // Discriminador enviado en el POST (cuando el endpoint es compartido)
    allowFecha?: boolean;      // false oculta la sección de fecha límite (default true)
    showSidebarChip?: boolean; // false oculta el chip de visibilidad en menú (default true)
    dataEndpoint?: string;     // Optional: GET for count of inscriptions/entries
    countLabel?: string;       // Label shown with count
    configMethod?: "POST" | "PATCH"; // Method for toggle/save endpoints
}

interface SidebarConfig {
    showEventos: boolean;
    showCircular05: boolean;
    showOlimpiada: boolean;
    showPAEC: boolean;
    showCapems: boolean;
    showExpedientes: boolean;
    showRecursos: boolean;
    showEstadistica911?: boolean;
}

interface ModuloState {
    activo: boolean;
    fechaLimite: string | null;
    count: number | null;
    toggling: boolean;
    savingFecha: boolean;
    fechaInput: string;
    error: string | null;
}

// ─── Module Definitions ─────────────────────────────────────────────────

const MODULOS: ModuloInfo[] = [
    {
        key: "showEventos",
        nombre: "Eventos Culturales",
        descripcion: "Inscripciones a disciplinas artísticas y culturales por escuela.",
        icon: <Trophy size={22} />,
        color: "#f59e0b",
        configEndpoint: "/api/admin/eventos-config",
        configMethod: "PATCH",
        dataEndpoint: "/api/admin/eventos-config",
        countLabel: "escuelas inscritas",
    },
    {
        key: "showCircular05",
        nombre: "Proyecto Circular 03",
        descripcion: "Generación y seguimiento de cartas de proyecto por escuela.",
        icon: <FileText size={22} />,
        color: "#6366f1",
        configEndpoint: "/api/circular05/config",
        configMethod: "PATCH",
        dataEndpoint: "/api/circular05/descargas",
        countLabel: "descargas realizadas",
    },
    {
        key: "showOlimpiada",
        nombre: "Olimpiada de Matemáticas",
        descripcion: "Inscripción de alumnos representantes por grado.",
        icon: <GraduationCap size={22} />,
        color: "#10b981",
        configEndpoint: "/api/admin/olimpiada-config",
        dataEndpoint: "/api/admin/olimpiada-inscripciones",
        countLabel: "escuelas participantes",
    },
    {
        key: "showPAEC",
        nombre: "Encuentro PAEC",
        descripcion: "Registro de proyectos y alumnos para el encuentro PAEC.",
        icon: <Lightbulb size={22} />,
        color: "#ec4899",
        configEndpoint: "/api/admin/encuentro-paec-config",
        dataEndpoint: "/api/admin/encuentro-paec-inscripciones",
        countLabel: "proyectos registrados",
    },
    {
        key: "showCapems",
        nombre: "Fichas CAPEMS",
        descripcion: "Captura y descarga de fichas de datos de escuelas.",
        icon: <BookMarked size={22} />,
        color: "#14b8a6",
        configEndpoint: "/api/capems/config",
        dataEndpoint: "/api/capems/registros",
        countLabel: "fichas capturadas",
    },
    {
        key: "showExpedientes",
        nombre: "Expedientes de Personal",
        descripcion: "Gestión de documentos del personal docente y administrativo.",
        icon: <Users size={22} />,
        color: "#3b82f6",
        configEndpoint: "/api/expedientes/config",
        configMethod: "PATCH",
        dataEndpoint: "/api/expedientes/personal",
        countLabel: "personas registradas",
    },
    {
        key: "showOficios",
        nombre: "Oficios",
        descripcion: "Generación de oficios de gestión interna del ATP (Oficio D01).",
        icon: <FileText size={22} />,
        color: "#8b5cf6",
        configEndpoint: "/api/admin/modulos-activacion",
        configPath: "oficiosConfig.activo",
        configModule: "oficios",
        allowFecha: false,
        showSidebarChip: false,
    },
    {
        key: "showSparh",
        nombre: "Plantillas SPARH",
        descripcion: "Corte de plantillas SPARH por disciplina académica.",
        icon: <GraduationCap size={22} />,
        color: "#06b6d4",
        configEndpoint: "/api/admin/modulos-activacion",
        configPath: "sparhConfig.activo",
        configModule: "sparh",
        allowFecha: false,
        showSidebarChip: false,
    },
    {
        key: "showBecas",
        nombre: "Becas (Convocatorias)",
        descripcion: "Publicación de convocatorias de becas para las escuelas.",
        icon: <BookMarked size={22} />,
        color: "#f97316",
        configEndpoint: "/api/admin/modulos-activacion",
        configPath: "sidebarConfig.showBecas",
        configModule: "becas",
        allowFecha: false,
        showSidebarChip: false,
    },
    {
        key: "showEstadistica911",
        nombre: "Estadística 911 / SICEP",
        descripcion: "Auditoría y validación aritmética de formatos oficiales 911 (911.7 / .G / .I) de inicio y fin de cursos.",
        icon: <BarChart3 size={22} />,
        color: "#059669",
        configEndpoint: "/api/admin/modulos-activacion",
        configPath: "estadistica911Config.activo",
        configModule: "estadistica911",
        allowFecha: false,
        showSidebarChip: false,
    },
    {
        key: "showCte",
        nombre: "Consejos Académicos (CAPEMS)",
        descripcion: "Repositorio de sesiones CAPEMS: presentaciones, temas y acuerdos.",
        icon: <GraduationCap size={22} />,
        color: "#3b82f6",
        configEndpoint: "/api/admin/modulos-activacion",
        configPath: "sidebarConfig.showCte",
        configModule: "cte",
        allowFecha: false,
        showSidebarChip: false,
    },
    {
        key: "showUsicamm",
        nombre: "Convocatorias USICAMM",
        descripcion: "Difusión de convocatorias de oposición, promoción y actualización docente.",
        icon: <Trophy size={22} />,
        color: "#f59e0b",
        configEndpoint: "/api/admin/modulos-activacion",
        configPath: "sidebarConfig.showUsicamm",
        configModule: "usicamm",
        allowFecha: false,
        showSidebarChip: false,
    },
    {
        key: "showComites",
        nombre: "Comités de Convivencia",
        descripcion: "Gestión de actas y directorio zonal de comités escolares de seguridad.",
        icon: <Users size={22} />,
        color: "#10b981",
        configEndpoint: "/api/admin/modulos-activacion",
        configPath: "sidebarConfig.showComites",
        configModule: "comites",
        allowFecha: false,
        showSidebarChip: false,
    },
];

// ─── Helper ─────────────────────────────────────────────────────────────

function getPath(obj: Record<string, unknown> | undefined, path: string): unknown {
    if (!obj) return undefined;
    return path.split(".").reduce<unknown>((acc, key) => {
        if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
            return (acc as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj);
}

function toInputDate(iso: string | null): string {
    if (!iso) return "";
    try {
        return new Date(iso).toISOString().slice(0, 16);
    } catch {
        return "";
    }
}

function formatFechaLimite(iso: string | null): string {
    if (!iso) return "Sin fecha límite";
    try {
        return new Date(iso).toLocaleString("es-MX", {
            day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

// ─── Component ──────────────────────────────────────────────────────────

export default function PanelModulos({ sidebarConfig, readOnly = false }: { sidebarConfig: SidebarConfig, readOnly?: boolean }) {
    const router = useRouter();

    const [states, setStates] = useState<Record<string, ModuloState>>(() => {
        const initial: Record<string, ModuloState> = {};
        for (const m of MODULOS) {
            initial[m.key] = {
                activo: false, fechaLimite: null, count: null,
                toggling: false, savingFecha: false,
                fechaInput: "", error: null,
            };
        }
        return initial;
    });
    const [loading, setLoading] = useState(true);
    const [savingSidebar, setSavingSidebar] = useState<string | null>(null);
    const [localSidebar, setLocalSidebar] = useState<Record<string, boolean>>(sidebarConfig as unknown as Record<string, boolean>);
    const [globalMessage, setGlobalMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // ─── Load all module configs ────────────────────────────────────────

    const loadAll = useCallback(async () => {
        setLoading(true);
        const updates: Record<string, Partial<ModuloState>> = {};

        await Promise.all(MODULOS.map(async (m) => {
            try {
                const res = await fetch(m.configEndpoint);
                if (res.ok) {
                    const data = await res.json();
                    const activoVal = m.configPath ? getPath(data, m.configPath) : data.activo;
                    updates[m.key] = {
                        activo: typeof activoVal === "boolean" ? activoVal : false,
                        fechaLimite: data.fechaLimite ?? null,
                        fechaInput: toInputDate(data.fechaLimite ?? null),
                    };
                }
            } catch {
                updates[m.key] = { error: "No se pudo cargar" };
            }

            if (m.dataEndpoint) {
                try {
                    const res = await fetch(m.dataEndpoint);
                    if (res.ok) {
                        const data = await res.json();
                        const count = Array.isArray(data) ? data.length : (data.total ?? data.totalInscripciones ?? null);
                        updates[m.key] = { ...(updates[m.key] || {}), count };
                    }
                } catch { /* count stays null */ }
            }
        }));

        setStates(prev => {
            const next = { ...prev };
            for (const key in updates) {
                next[key] = { ...next[key], ...updates[key] };
            }
            return next;
        });
        setLoading(false);
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    // ─── Toggle activo ──────────────────────────────────────────────────

    async function handleToggle(modulo: ModuloInfo) {
        const current = states[modulo.key];
        setStates(prev => ({ ...prev, [modulo.key]: { ...prev[modulo.key], toggling: true, error: null } }));

        try {
            const method = modulo.configMethod || "POST";
            const res = await fetch(modulo.configEndpoint, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    activo: !current.activo,
                    ...(modulo.configModule ? { modulo: modulo.configModule } : {}),
                }),
            });
            if (res.ok) {
                setStates(prev => ({
                    ...prev,
                    [modulo.key]: { ...prev[modulo.key], activo: !current.activo },
                }));
                setGlobalMessage({ type: "success", text: `${modulo.nombre} ${!current.activo ? "activado" : "desactivado"}` });
            } else {
                throw new Error("Error al cambiar estado");
            }
        } catch {
            setStates(prev => ({
                ...prev,
                [modulo.key]: { ...prev[modulo.key], error: "No se pudo cambiar el estado" },
            }));
        } finally {
            setStates(prev => ({ ...prev, [modulo.key]: { ...prev[modulo.key], toggling: false } }));
        }
    }

    // ─── Save fecha límite ──────────────────────────────────────────────

    async function handleSaveFecha(modulo: ModuloInfo) {
        if (modulo.allowFecha === false) return;
        const fechaInput = states[modulo.key].fechaInput;
        setStates(prev => ({ ...prev, [modulo.key]: { ...prev[modulo.key], savingFecha: true, error: null } }));

        try {
            const method = modulo.configMethod || "POST";
            const res = await fetch(modulo.configEndpoint, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fechaLimite: fechaInput ? new Date(fechaInput).toISOString() : null,
                }),
            });
            if (res.ok) {
                setStates(prev => ({
                    ...prev,
                    [modulo.key]: {
                        ...prev[modulo.key],
                        fechaLimite: fechaInput ? new Date(fechaInput).toISOString() : null,
                    },
                }));
                setGlobalMessage({ type: "success", text: `Fecha límite guardada para ${modulo.nombre}` });
            } else {
                throw new Error("Error al guardar fecha");
            }
        } catch {
            setStates(prev => ({
                ...prev,
                [modulo.key]: { ...prev[modulo.key], error: "No se pudo guardar la fecha" },
            }));
        } finally {
            setStates(prev => ({ ...prev, [modulo.key]: { ...prev[modulo.key], savingFecha: false } }));
        }
    }

    async function handleToggleSidebar(key: string) {
        setSavingSidebar(key);
        const newVal = !localSidebar[key];
        try {
            const res = await fetch("/api/admin/sidebar-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [key]: newVal }),
            });
            if (res.ok) {
                setLocalSidebar(prev => ({ ...prev, [key]: newVal }));
                setGlobalMessage({ type: "success", text: `Visibilidad en menú actualizada` });
                router.refresh();
            }
        } catch {
            setGlobalMessage({ type: "error", text: "Error al actualizar visibilidad" });
        } finally {
            setSavingSidebar(null);
        }
    }

    // ─── Render ─────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
                <Loader2 size={32} className="spin" style={{ color: "var(--primary)" }} />
            </div>
        );
    }

    const activeCount = MODULOS.filter(m => states[m.key]?.activo).length;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Header */}
            <div className="card" style={{
                background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
                border: "none", color: "white",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Settings2 size={24} /> Panel de Módulos Especiales
                        </h2>
                        <p style={{ margin: "0.375rem 0 0", opacity: 0.85, fontSize: "0.875rem" }}>
                            Activa, desactiva y configura fechas límite de todos los módulos desde aquí.
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <div style={{
                            background: "rgba(255,255,255,0.15)", borderRadius: "9999px",
                            padding: "0.375rem 1rem", fontSize: "0.875rem", fontWeight: 700,
                        }}>
                            {activeCount} / {MODULOS.length} activos
                        </div>
                        <button
                            onClick={loadAll}
                            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", cursor: "pointer", padding: "0.5rem", color: "white" }}
                            title="Recargar"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Global message */}
            {globalMessage && (
                <div className={`alert ${globalMessage.type === "success" ? "alert-success" : "alert-error"}`}>
                    {globalMessage.text}
                    <button onClick={() => setGlobalMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* Module grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
                {MODULOS.map(modulo => {
                    const state = states[modulo.key];
                    const sidebarVisible = localSidebar[modulo.key];
                    const isSavingSidebar = savingSidebar === modulo.key;

                    return (
                        <div
                            key={modulo.key}
                            className="card"
                            style={{
                                padding: 0, overflow: "hidden",
                                borderLeft: `4px solid ${state.activo ? modulo.color : "var(--border)"}`,
                                opacity: state.activo ? 1 : 0.75,
                                transition: "opacity 0.2s ease, border-color 0.2s ease",
                            }}
                        >
                            {/* Card header */}
                            <div style={{ padding: "1rem", borderBottom: "1px solid var(--border)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                        {/* Icon */}
                                        <div style={{
                                            width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
                                            background: state.activo ? `${modulo.color}20` : "var(--bg-secondary)",
                                            color: state.activo ? modulo.color : "var(--text-muted)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            transition: "background 0.2s, color 0.2s",
                                        }}>
                                            {modulo.icon}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{modulo.nombre}</div>
                                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.125rem" }}>
                                                {modulo.descripcion}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Toggle activo */}
                                    <button
                                        onClick={() => handleToggle(modulo)}
                                        disabled={readOnly || state.toggling}
                                        style={{ background: "none", border: "none", cursor: readOnly ? "default" : "pointer", flexShrink: 0, padding: "4px" }}
                                        title={state.activo ? "Desactivar módulo" : "Activar módulo"}
                                    >
                                        {state.toggling
                                            ? <Loader2 size={30} className="spin" style={{ color: "var(--text-muted)" }} />
                                            : state.activo
                                                ? <ToggleRight size={34} style={{ color: modulo.color }} />
                                                : <ToggleLeft size={34} style={{ color: "var(--text-muted)" }} />
                                        }
                                    </button>
                                </div>

                                {/* Status chips */}
                                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                                    <span style={{
                                        display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                        fontSize: "0.7rem", fontWeight: 700, padding: "0.125rem 0.5rem",
                                        borderRadius: "9999px",
                                        background: state.activo ? `${modulo.color}18` : "var(--bg-secondary)",
                                        color: state.activo ? modulo.color : "var(--text-muted)",
                                    }}>
                                        {state.activo ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                                        {state.activo ? "Activo" : "Inactivo"}
                                    </span>

                                    {state.count !== null && (
                                        <span style={{
                                            display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                            fontSize: "0.7rem", padding: "0.125rem 0.5rem",
                                            borderRadius: "9999px", background: "var(--bg-secondary)",
                                            color: "var(--text-muted)", fontWeight: 600,
                                        }}>
                                            {state.count} {modulo.countLabel}
                                        </span>
                                    )}

                                    {/* Sidebar visibility chip */}
                                    {modulo.showSidebarChip !== false && (
                                        <button
                                        onClick={() => handleToggleSidebar(modulo.key)}
                                        disabled={readOnly || isSavingSidebar}
                                        style={{
                                            display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                            fontSize: "0.7rem", padding: "0.125rem 0.5rem",
                                            borderRadius: "9999px", cursor: readOnly ? "default" : "pointer",
                                            background: sidebarVisible ? "#dbeafe" : "var(--bg-secondary)",
                                            color: sidebarVisible ? "#1d4ed8" : "var(--text-muted)",
                                            border: "none", fontWeight: 600,
                                        }}
                                        title={sidebarVisible ? "Ocultar del menú lateral" : "Mostrar en menú lateral"}
                                    >
                                        {isSavingSidebar
                                            ? <Loader2 size={10} className="spin" />
                                            : sidebarVisible ? <Eye size={10} /> : <EyeOff size={10} />}
                                        {sidebarVisible ? "Visible en menú" : "Oculto en menú"}
                                        </button>
                                    )}
                                </div>

                                {/* Error */}
                                {state.error && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--danger)" }}>
                                        <AlertCircle size={13} /> {state.error}
                                    </div>
                                )}
                            </div>

                            {/* Fecha límite section */}
                            {modulo.allowFecha !== false && (
                            <div style={{ padding: "0.75rem 1rem", background: "var(--bg-secondary)" }}>
                                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                    <Calendar size={12} /> Fecha Límite
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                                    {formatFechaLimite(state.fechaLimite)}
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <input
                                        type="datetime-local"
                                        className="form-control"
                                        value={state.fechaInput}
                                        disabled={readOnly}
                                        onChange={e => setStates(prev => ({
                                            ...prev,
                                            [modulo.key]: { ...prev[modulo.key], fechaInput: e.target.value },
                                        }))}
                                        style={{ flex: 1, fontSize: "0.8rem", padding: "0.375rem 0.5rem" }}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleSaveFecha(modulo)}
                                        disabled={readOnly || state.savingFecha}
                                        style={{ minHeight: "auto", padding: "0.375rem 0.75rem", fontSize: "0.8rem", flexShrink: 0 }}
                                    >
                                        {state.savingFecha ? <Loader2 size={14} className="spin" /> : "Guardar"}
                                    </button>
                                </div>
                            </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
