"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    ToggleLeft,
    ToggleRight,
    Eye,
    EyeOff,
    AlertTriangle,
    CheckCircle2,
    Ghost,
    ChevronDown,
    ChevronUp,
    ZapOff,
    Zap,
} from "lucide-react";
import { MESES, getNombrePeriodo } from "@/lib/constants";
import { ProgramaAdmin } from "@/types";

interface SidebarConfig {
    showRecursos: boolean;
    showEventos: boolean;
    showCircular05: boolean;
    showOlimpiada: boolean;
    showPAEC: boolean;
    showCapems: boolean;
    showExpedientes: boolean;
}

interface GestionPeriodosProps {
    programas: ProgramaAdmin[];
    sidebarConfig: SidebarConfig;
    readOnly?: boolean;
}

export default function GestionPeriodos({ programas, sidebarConfig, readOnly = false }: { programas: ProgramaAdmin[], sidebarConfig: SidebarConfig, readOnly?: boolean }) {
    const router = useRouter();
    const [togglingPeriodo, setTogglingPeriodo] = useState<string | null>(null);
    const [sidebarState, setSidebarState] = useState<SidebarConfig>(sidebarConfig);
    const [togglingVisibility, setTogglingVisibility] = useState<string | null>(null);
    const [bulkBusy, setBulkBusy] = useState<string | null>(null);
    const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const visibilityItems = [
        { key: "showRecursos", label: "Formatos y Plantillas" },
        { key: "showEventos", label: "Eventos Culturales" },
        { key: "showCircular05", label: "Circular 03" },
        { key: "showOlimpiada", label: "Olimpiada Matemáticas" },
        { key: "showPAEC", label: "Encuentro PAEC" },
        { key: "showCapems", label: "Fichas CAPEMS" },
        { key: "showExpedientes", label: "Expedientes de Personal" },
    ] as const;

    // ─── Classify each periodo ───────────────────────────
    function clasificarPeriodo(periodo: ProgramaAdmin["periodos"][0], entregasValidas: any[]) {
        const total = entregasValidas.length;
        const conActividad = entregasValidas.filter(
            e => e.estado !== "NO_ENTREGADO"
        ).length;

        if (!periodo.activo) return "inactivo";
        if (total === 0 || conActividad === 0) return "fantasma";
        return "activo";
    }

    // Stats per program
    const programStats = useMemo(() => {
        return programas.map(prog => {
            const clasificados = prog.periodos.map(p => {
                const entregasValidas = p.entregas.filter(e => !e.escuela.esDePrueba && !e.escuela.esSupervision);
                return {
                    ...p,
                    entregasValidas,
                    clase: clasificarPeriodo(p, entregasValidas),
                    conActividad: entregasValidas.filter(e => e.estado !== "NO_ENTREGADO").length,
                };
            });
            const fantasmas = clasificados.filter(p => p.clase === "fantasma");
            const activos = clasificados.filter(p => p.clase === "activo");
            const inactivos = clasificados.filter(p => p.clase === "inactivo");
            return { prog, clasificados, fantasmas, activos, inactivos };
        });
    }, [programas]);

    const totalFantasmas = programStats.reduce((sum, p) => sum + p.fantasmas.length, 0);

    // ─── Toggle single periodo ───────────────────────────
    async function handleTogglePeriodo(periodoId: string, activo: boolean) {
        setTogglingPeriodo(periodoId);
        try {
            const res = await fetch(`/api/periodos/${periodoId}/activar`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo }),
            });
            if (res.ok) {
                router.refresh();
            } else {
                setMessage({ type: "error", text: "Error al actualizar el periodo" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setTogglingPeriodo(null);
        }
    }

    // ─── Bulk: disable all ghost periods in a program ───
    async function handleDesactivarFantasmas(progId: string, ids: string[]) {
        setBulkBusy(progId);
        try {
            const results = await Promise.all(
                ids.map(id =>
                    fetch(`/api/periodos/${id}/activar`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ activo: false }),
                    })
                )
            );
            const allOk = results.every(r => r.ok);
            if (allOk) {
                setMessage({ type: "success", text: `${ids.length} periodo(s) fantasma desactivados correctamente` });
                router.refresh();
            } else {
                setMessage({ type: "error", text: "Algunos periodos no pudieron desactivarse" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setBulkBusy(null);
        }
    }

    // ─── Bulk: disable ALL ghost periods across all programs ───
    async function handleDesactivarTodosFantasmas() {
        const allFantasmaIds = programStats.flatMap(p => p.fantasmas.map(f => f.id));
        if (allFantasmaIds.length === 0) return;
        setBulkBusy("all");
        try {
            const results = await Promise.all(
                allFantasmaIds.map(id =>
                    fetch(`/api/periodos/${id}/activar`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ activo: false }),
                    })
                )
            );
            const allOk = results.every(r => r.ok);
            if (allOk) {
                setMessage({ type: "success", text: `¡Listo! ${allFantasmaIds.length} periodo(s) fantasma desactivados en todos los programas` });
                router.refresh();
            } else {
                setMessage({ type: "error", text: "Algunos periodos no pudieron desactivarse" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setBulkBusy(null);
        }
    }

    // ─── Toggle sidebar visibility ───────────────────────
    async function handleToggleVisibility(field: string, value: boolean) {
        setTogglingVisibility(field);
        try {
            const res = await fetch("/api/admin/sidebar-config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: value }),
            });
            if (res.ok) {
                setSidebarState(prev => ({ ...prev, [field]: value }));
                router.refresh();
            }
        } catch {
            console.error("Error al actualizar visibilidad");
        } finally {
            setTogglingVisibility(null);
        }
    }

    function getPeriodoLabel(periodo: { mes: number | null; semestre: number | null }, programaNombre?: string | null): string {
        return getNombrePeriodo(periodo, programaNombre);
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* ─── Message ─── */}
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* ─── Ghost Alert Banner ─── */}
            {totalFantasmas > 0 && (
                <div className="card" style={{ background: "#fef3c7", border: "1px solid #fcd34d", padding: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                            <Ghost size={22} style={{ color: "#92400e", flexShrink: 0, marginTop: "2px" }} />
                            <div>
                                <div style={{ fontWeight: 700, color: "#92400e", marginBottom: "0.25rem" }}>
                                    {totalFantasmas} periodo{totalFantasmas !== 1 ? "s" : ""} fantasma detectado{totalFantasmas !== 1 ? "s" : ""}
                                </div>
                                <p style={{ margin: 0, fontSize: "0.8125rem", color: "#78350f" }}>
                                    Son periodos activos con <strong>0 entregas reales</strong> — ningún director ha subido nada en ellos.
                                    Seguramente son meses/semestres que ya no aplican porque el programa cambió a anual.
                                    Desactivarlos limpiará el portal del director y las estadísticas.
                                </p>
                            </div>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={handleDesactivarTodosFantasmas}
                            disabled={readOnly || bulkBusy !== null}
                            style={{ whiteSpace: "nowrap", background: "#d97706", border: "none", minHeight: "auto", padding: "0.5rem 1rem" }}
                        >
                            <ZapOff size={15} />
                            {bulkBusy === "all" ? "Desactivando..." : `Limpiar todos (${totalFantasmas})`}
                        </button>
                    </div>
                </div>
            )}

            {totalFantasmas === 0 && (
                <div className="card" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.875rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <CheckCircle2 size={18} style={{ color: "#16a34a" }} />
                    <span style={{ fontSize: "0.875rem", color: "#14532d", fontWeight: 600 }}>
                        Sin periodos fantasma — todos los periodos activos tienen actividad real.
                    </span>
                </div>
            )}

            {/* ─── Periodos por Programa ─── */}
            <div>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text)" }}>
                    Periodos de Entrega por Programa
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {programStats.map(({ prog, clasificados, fantasmas, activos, inactivos }) => {
                        const isExpanded = expandedProgram === prog.id;
                        const hasPhantoms = fantasmas.length > 0;

                        return (
                            <div key={prog.id} className="card" style={{ padding: 0, border: hasPhantoms ? "1px solid #fcd34d" : "1px solid var(--border)" }}>
                                {/* Program Header */}
                                <button
                                    onClick={() => setExpandedProgram(isExpanded ? null : prog.id)}
                                    style={{
                                        width: "100%", background: "none", border: "none", cursor: "pointer",
                                        padding: "0.875rem 1rem", textAlign: "left",
                                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text)" }}>
                                            {prog.nombre}
                                        </div>
                                        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                                            {activos.length > 0 && (
                                                <span style={{ fontSize: "0.6875rem", fontWeight: 700, padding: "0.125rem 0.5rem", borderRadius: "12px", background: "#dcfce7", color: "#15803d" }}>
                                                    {activos.length} activo{activos.length !== 1 ? "s" : ""}
                                                </span>
                                            )}
                                            {hasPhantoms && (
                                                <span style={{ fontSize: "0.6875rem", fontWeight: 700, padding: "0.125rem 0.5rem", borderRadius: "12px", background: "#fef3c7", color: "#92400e", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                    <Ghost size={10} /> {fantasmas.length} fantasma{fantasmas.length !== 1 ? "s" : ""}
                                                </span>
                                            )}
                                            {inactivos.length > 0 && (
                                                <span style={{ fontSize: "0.6875rem", fontWeight: 700, padding: "0.125rem 0.5rem", borderRadius: "12px", background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                                                    {inactivos.length} inactivo{inactivos.length !== 1 ? "s" : ""}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexShrink: 0 }}>
                                        {hasPhantoms && (
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    handleDesactivarFantasmas(prog.id, fantasmas.map(f => f.id));
                                                }}
                                                disabled={bulkBusy === prog.id}
                                                style={{
                                                    background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e",
                                                    borderRadius: "6px", padding: "0.25rem 0.625rem", cursor: "pointer",
                                                    fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.25rem",
                                                }}
                                                title="Desactivar periodos fantasma de este programa"
                                            >
                                                <ZapOff size={13} />
                                                {bulkBusy === prog.id ? "..." : `Limpiar ${fantasmas.length}`}
                                            </button>
                                        )}
                                        {isExpanded ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
                                    </div>
                                </button>

                                {/* Periodo List */}
                                {isExpanded && (
                                    <div style={{ borderTop: "1px solid var(--border)" }}>
                                        {clasificados.length === 0 ? (
                                            <p style={{ padding: "1rem", color: "var(--text-muted)", margin: 0, fontSize: "0.875rem" }}>
                                                Sin periodos en el ciclo activo
                                            </p>
                                        ) : (
                                            clasificados.map(periodo => {
                                                const isFantasma = periodo.clase === "fantasma";
                                                const isInactivo = periodo.clase === "inactivo";
                                                const pct = periodo.entregasValidas.length > 0
                                                    ? Math.round((periodo.conActividad / periodo.entregasValidas.length) * 100)
                                                    : 0;

                                                let rowBg = "transparent";
                                                if (isFantasma) rowBg = "#fffbeb";
                                                if (isInactivo) rowBg = "var(--bg-secondary)";

                                                return (
                                                    <div
                                                        key={periodo.id}
                                                        style={{
                                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                                            padding: "0.625rem 1rem", borderBottom: "1px solid var(--border)",
                                                            background: rowBg, gap: "0.75rem", flexWrap: "wrap",
                                                            opacity: isInactivo ? 0.6 : 1,
                                                        }}
                                                    >
                                                        {/* Left: label + badges */}
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: "160px" }}>
                                                            {isFantasma && <Ghost size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />}
                                                            {!isFantasma && !isInactivo && <CheckCircle2 size={14} style={{ color: "var(--success)", flexShrink: 0 }} />}
                                                            {isInactivo && <AlertTriangle size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                                                            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                                                                {getPeriodoLabel(periodo, prog.nombre)}
                                                            </span>
                                                            {isFantasma && (
                                                                <span style={{ fontSize: "0.6875rem", background: "#fef3c7", color: "#92400e", padding: "0.125rem 0.4rem", borderRadius: "4px", fontWeight: 700 }}>
                                                                    FANTASMA
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Center: stats + mini bar */}
                                                        <div style={{ flex: 1, minWidth: "120px", maxWidth: "220px" }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                                                                <span>{periodo.conActividad} de {periodo.entregasValidas.length} escuelas entregaron</span>
                                                                <span style={{ fontWeight: 700 }}>{pct}%</span>
                                                            </div>
                                                            <div style={{ height: "4px", background: "var(--bg)", borderRadius: "2px" }}>
                                                                <div style={{
                                                                    height: "100%",
                                                                    width: `${pct}%`,
                                                                    background: pct === 0 ? "#d1d5db" : pct === 100 ? "#22c55e" : "#3b82f6",
                                                                    borderRadius: "2px",
                                                                    transition: "width 0.3s ease",
                                                                }} />
                                                            </div>
                                                        </div>

                                                        {/* Right: toggle */}
                                                        <button
                                                            onClick={() => handleTogglePeriodo(periodo.id, !periodo.activo)}
                                                            disabled={readOnly || togglingPeriodo === periodo.id}
                                                            style={{
                                                                background: "none", border: "none", cursor: "pointer",
                                                                color: periodo.activo
                                                                    ? isFantasma ? "#f59e0b" : "var(--success)"
                                                                    : "var(--text-muted)",
                                                                display: "flex", alignItems: "center",
                                                            }}
                                                            title={periodo.activo
                                                                ? isFantasma ? "Desactivar (recomendado — sin actividad)" : "Desactivar periodo"
                                                                : "Reactivar periodo"
                                                            }
                                                        >
                                                            {periodo.activo
                                                                ? <ToggleRight size={28} />
                                                                : <ToggleLeft size={28} />
                                                            }
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── Visibilidad del Menú ─── */}
            <div>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text)" }}>
                    Visibilidad de Módulos
                </h3>
                <div className="card" style={{ padding: "0.625rem 0.875rem", marginBottom: "0.625rem", background: "#fef9e7", border: "1px solid #f9e79f", fontSize: "0.8125rem", color: "#7d6608" }}>
                    Oculta o muestra módulos en tu barra lateral. <strong>No afecta la visibilidad para los directores.</strong>
                </div>
                <div className="card" style={{ padding: 0 }}>
                    {visibilityItems.map((item, i) => {
                        const isVisible = sidebarState[item.key];
                        return (
                            <div
                                key={item.key}
                                style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "0.625rem 1rem",
                                    borderBottom: i < visibilityItems.length - 1 ? "1px solid var(--border)" : "none",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    {isVisible
                                        ? <Eye size={15} style={{ color: "var(--primary)" }} />
                                        : <EyeOff size={15} style={{ color: "var(--text-muted)" }} />
                                    }
                                    <span style={{ fontWeight: 500, fontSize: "0.875rem", opacity: isVisible ? 1 : 0.5 }}>
                                        {item.label}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleToggleVisibility(item.key, !isVisible)}
                                    disabled={readOnly || togglingVisibility === item.key}
                                    style={{
                                        background: "none", border: "none", cursor: "pointer",
                                        color: isVisible ? "var(--success)" : "var(--text-muted)",
                                    }}
                                    title={isVisible ? "Ocultar del menú" : "Mostrar en menú"}
                                >
                                    {isVisible ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
