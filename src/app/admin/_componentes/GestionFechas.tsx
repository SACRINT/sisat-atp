"use client";

import { useState, useEffect } from "react";
import { Calendar, PlusCircle, Save, X, RefreshCw, Trophy, ToggleLeft, ToggleRight, Check, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { ordenarPeriodosEscolares, getNombrePeriodo } from "@/lib/constants";

export default function GestionFechas({
    programas,
    readOnly = false,
    cicloNombre,
}: {
    programas: any[];
    readOnly?: boolean;
    cicloNombre?: string;
}) {
    const router = useRouter();
    const [fechas, setFechas] = useState<Record<string, string>>({});
    const [savingPeriodoId, setSavingPeriodoId] = useState<string | null>(null);
    const [togglingPeriodoId, setTogglingPeriodoId] = useState<string | null>(null);
    const [bulkBusyProgId, setBulkBusyProgId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Estado local para los periodos activos
    const [periodosActivos, setPeriodosActivos] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        programas.forEach(prog => {
            if (Array.isArray(prog.periodos)) {
                prog.periodos.forEach((p: any) => {
                    init[p.id] = p.activo !== false;
                });
            }
        });
        return init;
    });

    useEffect(() => {
        const next: Record<string, boolean> = {};
        programas.forEach(prog => {
            if (Array.isArray(prog.periodos)) {
                prog.periodos.forEach((p: any) => {
                    next[p.id] = p.activo !== false;
                });
            }
        });
        setPeriodosActivos(next);
    }, [programas]);

    // Modal state for extraordinary task
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTaskName, setNewTaskName] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newTaskDate, setNewTaskDate] = useState("");
    const [newTaskFiles, setNewTaskFiles] = useState(1);
    const [creatingTask, setCreatingTask] = useState(false);

    // Special modules (Eventos, Olimpiada, PAEC)
    type ModuloFecha = { id: string; nombre: string; fechaLimite: string | null };
    const [modulos, setModulos] = useState<ModuloFecha[]>([]);
    const [moduloFechas, setModuloFechas] = useState<Record<string, string>>({});
    const [savingModulo, setSavingModulo] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/admin/modulos-fechas")
            .then(r => r.json())
            .then(data => { if (data.modulos) setModulos(data.modulos); })
            .catch(() => { });
    }, []);

    const handleDateChange = (periodoId: string, dateStr: string) => {
        setFechas((prev) => ({ ...prev, [periodoId]: dateStr }));
    };

    const handleSaveDate = async (periodoId: string) => {
        const fecha = fechas[periodoId];
        if (!fecha) return;

        setSavingPeriodoId(periodoId);
        setMessage(null);

        try {
            const res = await fetch(`/api/periodos/${periodoId}/fecha`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fechaLimite: fecha }),
            });

            if (!res.ok) throw new Error("No se pudo guardar la fecha");

            setMessage({ type: "success", text: "Fecha límite actualizada guardada" });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setSavingPeriodoId(null);
        }
    };

    const handleTogglePeriodoActivo = async (periodoId: string, currentActivo: boolean, periodoLabel: string) => {
        if (readOnly) return;
        const nuevoActivo = !currentActivo;
        setTogglingPeriodoId(periodoId);
        setMessage(null);

        // Optimistic update
        setPeriodosActivos(prev => ({ ...prev, [periodoId]: nuevoActivo }));

        try {
            const res = await fetch(`/api/periodos/${periodoId}/activar`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: nuevoActivo }),
            });

            if (!res.ok) throw new Error("No se pudo actualizar el estado del periodo");

            setMessage({
                type: "success",
                text: `${periodoLabel}: ${nuevoActivo ? "ACTIVADO (Visible para directores)" : "DESACTIVADO (Oculto para directores)"}`
            });
            setTimeout(() => setMessage(null), 3500);
            router.refresh();
        } catch (error: any) {
            // Rollback
            setPeriodosActivos(prev => ({ ...prev, [periodoId]: currentActivo }));
            setMessage({ type: "error", text: error.message });
        } finally {
            setTogglingPeriodoId(null);
        }
    };

    const handleBulkActivarPeriodos = async (prog: any, mode: "SOLO_ACTUAL" | "TODOS" | "NINGUNO") => {
        if (readOnly || !Array.isArray(prog.periodos) || prog.periodos.length === 0) return;
        
        // Mes actual: 1 = Enero ... 12 = Diciembre
        const currentMonth = new Date().getMonth() + 1;
        setBulkBusyProgId(prog.id);
        setMessage(null);

        try {
            const updates = prog.periodos.map(async (p: any) => {
                let targetActivo = false;
                if (mode === "TODOS") targetActivo = true;
                else if (mode === "NINGUNO") targetActivo = false;
                else if (mode === "SOLO_ACTUAL") targetActivo = p.mes === currentMonth;

                await fetch(`/api/periodos/${p.id}/activar`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ activo: targetActivo }),
                });

                return { id: p.id, activo: targetActivo };
            });

            const results = await Promise.all(updates);
            setPeriodosActivos(prev => {
                const next = { ...prev };
                results.forEach(r => { next[r.id] = r.activo; });
                return next;
            });

            const mesesNombres = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            setMessage({
                type: "success",
                text: mode === "SOLO_ACTUAL"
                    ? `Mes de ${mesesNombres[currentMonth]} activado exclusivamente para "${prog.nombre}". Demás meses desactivados.`
                    : mode === "TODOS"
                    ? `Todos los periodos activados para "${prog.nombre}".`
                    : `Todos los periodos desactivados para "${prog.nombre}".`
            });
            setTimeout(() => setMessage(null), 4000);
            router.refresh();
        } catch {
            setMessage({ type: "error", text: "Error al actualizar periodos masivamente" });
        } finally {
            setBulkBusyProgId(null);
        }
    };

    const handleCreateTask = async () => {
        if (!newTaskName.trim()) {
            setMessage({ type: "error", text: "El nombre es obligatorio" });
            return;
        }

        setCreatingTask(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/programas/extraordinarios`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: newTaskName,
                    descripcion: newTaskDesc,
                    fechaLimite: newTaskDate || null,
                    numArchivos: newTaskFiles
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "No se pudo crear la tarea");
            }

            setMessage({ type: "success", text: "Nueva comisión extraordinaria creada. Actualiza la página para verla." });
            setIsModalOpen(false);
            setNewTaskName("");
            setNewTaskDesc("");
            setNewTaskDate("");
            setNewTaskFiles(1);

            // Reload page to fetch updated db
            setTimeout(() => window.location.reload(), 2000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setCreatingTask(false);
        }
    };

    const getPeriodoLabel = (prog: any, periodo: any) => {
        return getNombrePeriodo(periodo, prog?.nombre);
    };

    // Format date for inputs (YYYY-MM-DD)
    const formatDateForInput = (isoDate: string | null) => {
        if (!isoDate) return "";
        return new Date(isoDate).toISOString().split('T')[0];
    };

    const handleSaveModuloFecha = async (moduloId: string) => {
        const fecha = moduloFechas[moduloId];
        if (fecha === undefined) return;
        setSavingModulo(moduloId);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/modulos-fechas", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ modulo: moduloId, fechaLimite: fecha || null }),
            });
            if (!res.ok) throw new Error("No se pudo guardar");
            // Update local state
            setModulos(prev => prev.map(m => m.id === moduloId ? { ...m, fechaLimite: fecha || null } : m));
            setModuloFechas(prev => { const n = { ...prev }; delete n[moduloId]; return n; });
            setMessage({ type: "success", text: "Fecha límite de inscripción actualizada" });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setSavingModulo(null);
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1>Fechas y Entregas</h1>
                    <p style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        Configura los días límite de entrega y crea comisiones extraordinarias.
                        {cicloNombre && (
                            <span style={{
                                display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)",
                                color: "#1d4ed8", borderRadius: "9999px",
                                fontSize: "0.7rem", fontWeight: 700, padding: "0.1rem 0.55rem",
                            }}>
                                📅 {cicloNombre}
                            </span>
                        )}
                    </p>
                </div>
                {!readOnly && (
                    <button
                        className="btn btn-primary"
                        onClick={() => setIsModalOpen(true)}
                        style={{ whiteSpace: "nowrap" }}
                    >
                        <PlusCircle size={18} /> Crear Tarea Extraordinaria
                    </button>
                )}
            </div>

            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1.5rem" }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {programas.map((prog) => {
                    const isMensual = prog.tipo === "MENSUAL";
                    const isBusyBulk = bulkBusyProgId === prog.id;

                    return (
                        <div key={prog.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                            {/* Cabecera del Programa */}
                            <div style={{
                                padding: "1rem 1.25rem",
                                fontWeight: 700,
                                borderBottom: "1px solid var(--border)",
                                background: "var(--bg)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: "0.75rem"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "1rem", color: "var(--text)" }}>{prog.nombre}</span>
                                    <span style={{
                                        fontSize: "0.725rem",
                                        color: "var(--text-muted)",
                                        fontWeight: 600,
                                        background: "var(--bg-secondary, #f1f5f9)",
                                        padding: "2px 10px",
                                        borderRadius: "12px",
                                        border: "1px solid var(--border)"
                                    }}>
                                        {prog.tipo}
                                    </span>
                                </div>

                                {/* Acciones rápidas para programas mensuales o periódicos */}
                                {prog.periodos.length > 1 && !readOnly && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                        {isMensual && (
                                            <button
                                                type="button"
                                                disabled={isBusyBulk}
                                                onClick={() => handleBulkActivarPeriodos(prog, "SOLO_ACTUAL")}
                                                className="btn btn-sm"
                                                style={{
                                                    fontSize: "0.725rem",
                                                    padding: "0.25rem 0.6rem",
                                                    borderRadius: "6px",
                                                    background: "#ecfdf5",
                                                    color: "#047857",
                                                    border: "1px solid #a7f3d0",
                                                    fontWeight: 700,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.3rem"
                                                }}
                                                title="Desactiva los demás meses y activa únicamente el mes en curso para directores"
                                            >
                                                <Zap size={13} /> Activar solo mes en curso
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            disabled={isBusyBulk}
                                            onClick={() => handleBulkActivarPeriodos(prog, "TODOS")}
                                            className="btn btn-sm"
                                            style={{
                                                fontSize: "0.725rem",
                                                padding: "0.25rem 0.55rem",
                                                borderRadius: "6px",
                                                background: "var(--bg-secondary, #f1f5f9)",
                                                color: "var(--text)",
                                                border: "1px solid var(--border)",
                                                fontWeight: 600
                                            }}
                                            title="Activa todos los periodos/meses para directores"
                                        >
                                            Activar todos
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isBusyBulk}
                                            onClick={() => handleBulkActivarPeriodos(prog, "NINGUNO")}
                                            className="btn btn-sm"
                                            style={{
                                                fontSize: "0.725rem",
                                                padding: "0.25rem 0.55rem",
                                                borderRadius: "6px",
                                                background: "#fef2f2",
                                                color: "#b91c1c",
                                                border: "1px solid #fecaca",
                                                fontWeight: 600
                                            }}
                                            title="Desactiva todos los periodos/meses para directores"
                                        >
                                            Desactivar todos
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Listado de Periodos / Meses */}
                            <div>
                                {ordenarPeriodosEscolares(prog.periodos).map((periodo: any) => {
                                    const initialVal = formatDateForInput(periodo.fechaLimite);
                                    const currentVal = fechas[periodo.id] !== undefined ? fechas[periodo.id] : initialVal;
                                    const isDirty = currentVal !== initialVal;
                                    const isActivo = periodosActivos[periodo.id] !== false;
                                    const isToggling = togglingPeriodoId === periodo.id;
                                    const label = getPeriodoLabel(prog, periodo);

                                    return (
                                        <div key={periodo.id} style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "0.85rem 1.25rem",
                                            borderBottom: "1px solid var(--border)",
                                            flexWrap: "wrap",
                                            gap: "1rem",
                                            background: isActivo ? "transparent" : "rgba(239, 68, 68, 0.03)"
                                        }}>
                                            {/* Nombre del Periodo y Toggle Activo */}
                                            <div style={{ minWidth: "220px", display: "flex", alignItems: "center", gap: "0.85rem" }}>
                                                <button
                                                    type="button"
                                                    disabled={readOnly || isToggling}
                                                    onClick={() => handleTogglePeriodoActivo(periodo.id, isActivo, label)}
                                                    style={{
                                                        padding: "0.25rem 0.65rem",
                                                        borderRadius: "20px",
                                                        fontSize: "0.725rem",
                                                        fontWeight: 800,
                                                        border: "none",
                                                        cursor: (readOnly || isToggling) ? "not-allowed" : "pointer",
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: "0.35rem",
                                                        background: isActivo ? "#dcfce7" : "#fee2e2",
                                                        color: isActivo ? "#15803d" : "#b91c1c",
                                                        transition: "all 0.15s ease",
                                                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                                                    }}
                                                    title={isActivo ? `Clic para DESACTIVAR ${label} para directores` : `Clic para ACTIVAR ${label} para directores`}
                                                >
                                                    {isToggling ? (
                                                        <RefreshCw size={13} className="spin" />
                                                    ) : isActivo ? (
                                                        <>
                                                            <ToggleRight size={15} color="#16a34a" />
                                                            <span>Activo</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ToggleLeft size={15} color="#dc2626" />
                                                            <span>Inactivo</span>
                                                        </>
                                                    )}
                                                </button>

                                                <div>
                                                    <span style={{
                                                        fontWeight: 600,
                                                        display: "block",
                                                        color: isActivo ? "var(--text)" : "var(--text-muted)",
                                                        textDecoration: isActivo ? "none" : "line-through"
                                                    }}>
                                                        {label}
                                                    </span>
                                                    <span style={{ fontSize: "0.725rem", color: isActivo ? "var(--text-muted)" : "#ef4444" }}>
                                                        {isActivo
                                                            ? (periodo.fechaLimite ? `Límite: ${new Date(periodo.fechaLimite).toLocaleDateString()}` : "Sin fecha límite")
                                                            : "Oculto para directores"
                                                        }
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Selector de Fecha Límite */}
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <Calendar size={15} color="var(--text-muted)" />
                                                <input
                                                    type="date"
                                                    className="form-control"
                                                    style={{ width: "150px", fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
                                                    value={currentVal}
                                                    onChange={(e) => handleDateChange(periodo.id, e.target.value)}
                                                    disabled={readOnly}
                                                />
                                                {isDirty && (
                                                    <button
                                                        className="btn btn-primary"
                                                        style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem" }}
                                                        onClick={() => handleSaveDate(periodo.id)}
                                                        disabled={savingPeriodoId === periodo.id}
                                                    >
                                                        {savingPeriodoId === periodo.id ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {prog.periodos.length === 0 && (
                                    <div style={{ padding: "1.25rem", color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic", textAlign: "center" }}>
                                        Este programa no tiene periodos asignados en este ciclo escolar.
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ─── Módulos especiales: Eventos, Olimpiada, PAEC ─── */}
            {modulos.length > 0 && (
                <>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "1.5rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Trophy size={20} /> Módulos de Inscripción
                    </h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                        Configura las fechas límite de inscripción para eventos y competencias.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        {modulos.map(mod => {
                            const initialVal = formatDateForInput(mod.fechaLimite);
                            const currentVal = moduloFechas[mod.id] !== undefined ? moduloFechas[mod.id] : initialVal;
                            const isDirty = currentVal !== initialVal;
                            return (
                                <div key={mod.id} className="card" style={{ padding: 0 }}>
                                    <div style={{ padding: "1rem", fontWeight: 700, borderBottom: "1px solid var(--border)", background: "var(--bg)", display: "flex", justifyContent: "space-between" }}>
                                        <span>{mod.nombre}</span>
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "normal", background: "white", padding: "2px 8px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                                            INSCRIPCIÓN
                                        </span>
                                    </div>
                                    <div style={{
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                        padding: "1rem", flexWrap: "wrap", gap: "1rem"
                                    }}>
                                        <div style={{ minWidth: "200px" }}>
                                            <span style={{ fontWeight: 500, display: "block" }}>Fecha Límite de Inscripción</span>
                                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                {mod.fechaLimite ? `Fijada: ${new Date(mod.fechaLimite).toLocaleDateString()}` : "Sin fecha límite"}
                                            </span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <Calendar size={16} color="var(--text-muted)" />
                                            <input
                                                type="date"
                                                className="form-control"
                                                style={{ width: "150px" }}
                                                value={currentVal}
                                                onChange={(e) => setModuloFechas(prev => ({ ...prev, [mod.id]: e.target.value }))}
                                                disabled={readOnly}
                                            />
                                            {isDirty && (
                                                <button
                                                    className="btn btn-primary"
                                                    style={{ padding: "0.5rem 0.75rem" }}
                                                    onClick={() => handleSaveModuloFecha(mod.id)}
                                                    disabled={savingModulo === mod.id}
                                                >
                                                    {savingModulo === mod.id ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Modal Crear Tarea */}
            {isModalOpen && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "1rem", zIndex: 1000,
                }}>
                    <div className="card fade-in" style={{ maxWidth: "500px", width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h3 style={{ margin: 0 }}>Nueva Tarea Extraordinaria</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                            Esto creará un nuevo programa de entrega única que aparecerá inmediatamente en el portal de todos los directores.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Nombre de la Tarea</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ej: Registro de Jóvenes Talentosos"
                                    value={newTaskName}
                                    onChange={(e) => setNewTaskName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Descripción o Instrucciones breves</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Del archivo Excel enviado por SEV..."
                                    value={newTaskDesc}
                                    onChange={(e) => setNewTaskDesc(e.target.value)}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Fecha Límite</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={newTaskDate}
                                        onChange={(e) => setNewTaskDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Archivos requeridos</label>
                                    <select
                                        className="form-control"
                                        value={newTaskFiles}
                                        onChange={(e) => setNewTaskFiles(parseInt(e.target.value))}
                                    >
                                        <option value={1}>1 archivo</option>
                                        <option value={2}>2 archivos</option>
                                        <option value={3}>3 archivos</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "2rem" }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setIsModalOpen(false)}
                                disabled={creatingTask}
                                style={{ flex: 1 }}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateTask}
                                disabled={creatingTask || !newTaskName.trim()}
                                style={{ flex: 1 }}
                            >
                                {creatingTask ? "Creando..." : "Crear y Publicar Tarea"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
