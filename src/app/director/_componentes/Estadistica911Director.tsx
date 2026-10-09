"use client";

import { useState, useEffect, useRef } from "react";
import {
    BarChart3,
    Upload,
    CheckCircle2,
    AlertTriangle,
    Clock,
    FileSpreadsheet,
    FileText,
    RefreshCw,
    Info,
    Calendar,
    Users,
    Building,
    Check,
    Sparkles,
    TrendingUp,
    Layers
} from "lucide-react";
import ModuloCopilotDrawer, { AccionSugerida } from "@/components/copilot/ModuloCopilotDrawer";

interface Estadistica911DirectorProps {
    escuela: {
        id: string;
        cct: string;
        nombre: string;
        localidad: string;
        director?: string | null;
        municipio?: string | null;
        zonaEscolar?: string | null;
    };
}

interface PeriodoConfig {
    activo: boolean;
    periodoCorte: "INICIO_CURSOS" | "FIN_CURSOS";
    fechaLimiteInicio: string | null;
    fechaLimiteFin: string | null;
}

interface CruceSicepItem {
    id?: string;
    matriculaSicepTotal: number;
    matricula911Total: number;
    diferencia: number;
    discrepancias?: unknown;
    createdAt?: string;
}

interface RegistroEscuela {
    id: string;
    periodoCorte: "INICIO_CURSOS" | "FIN_CURSOS";
    estado: "PENDIENTE" | "CON_INCONSISTENCIAS" | "VALIDADO" | "ENTREGADO_A_CORDE";
    inconsistencias: Array<{ campo?: string; mensaje: string }>;
    totalAlumnos: number;
    totalHombres: number;
    totalMujeres: number;
    totalDocentes: number;
    totalGrupos: number;
    detallesGrado: Array<{ grado: number; hombres: number; mujeres: number; total: number; grupos: number }>;
    crucesSicep: CruceSicepItem[];
    archivoUrl: string | null;
    archivoNombre: string | null;
    observaciones: string | null;
    updatedAt: string;
}

interface RegistroApiInconsistencia {
    campo?: string;
    descripcion?: string;
    mensaje?: string;
    detalles?: { sumaCalculada?: number; totalReportado?: number };
}

interface RegistroApiDetalle {
    semestreGrado: number;
    hombres?: number;
    mujeres?: number;
    total?: number;
    grupos?: number;
}

interface RegistroApiItem {
    id: string;
    escuelaId?: string;
    escuelaCCT?: string;
    escuela?: { cct?: string; id?: string };
    tipoCorte?: string;
    estado: "PENDIENTE" | "CON_INCONSISTENCIAS" | "VALIDADO" | "ENTREGADO_A_CORDE";
    inconsistenciasJson?: RegistroApiInconsistencia[];
    totalAlumnos?: number;
    totalHombres?: number;
    totalMujeres?: number;
    totalDocentes?: number;
    totalGrupos?: number;
    detalles?: RegistroApiDetalle[];
    crucesSicep?: CruceSicepItem[];
    archivoUrl?: string | null;
    archivoNombre?: string | null;
    notasAtp?: string | null;
    updatedAt?: string;
}

interface ProyeccionPlantel {
    matriculaTotalEstimada?: number;
    capacidadInstaladaOptima?: number;
    intervaloConfianzaMin?: number;
    intervaloConfianzaMax?: number;
    densidadPromedioPorGrupo?: number;
    totalGruposAutorizados?: number;
    docentesEstimadosRequeridos?: number;
    semaforoRiesgo?: "EQUILIBRADO" | "RIESGO_SOBRECUPO" | "RIESGO_SUBUTILIZACION" | "RIESGO_DESERCION_CRITICA" | string;
    observacionOperativa?: string;
}

export default function Estadistica911Director({ escuela }: Estadistica911DirectorProps) {
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [config, setConfig] = useState<PeriodoConfig | null>(null);
    const [registro, setRegistro] = useState<RegistroEscuela | null>(null);
    const [mensaje, setMensaje] = useState<{ tipo: "success" | "error" | "info"; texto: string } | null>(null);
    const [copilotOpen, setCopilotOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estado predictivo para el plantel del director
    const [proyeccion, setProyeccion] = useState<ProyeccionPlantel | null>(null);
    const [loadingProyeccion, setLoadingProyeccion] = useState(false);
    const [corteProyeccion, setCorteProyeccion] = useState<"INICIO_DE_CURSOS" | "FIN_DE_CURSOS">("INICIO_DE_CURSOS");

    const ACCIONES_911: AccionSugerida[] = [
        {
            id: "auditar_plantel",
            etiqueta: "📊 Auditar Matrícula de mi Escuela",
            prompt: "Realiza una auditoría matemática sobre los datos estadísticos 911 cargados para mi plantel y verifica que no existan inconsistencias antes de la entrega oficial."
        },
        {
            id: "proyeccion_plantel",
            etiqueta: "🔮 Capacidad Áulica y Proyección de mi Escuela",
            prompt: "Evalúa la capacidad de las aulas y la proyección de matrícula de mi plantel para saber si estamos en sobrecupo o subutilización según la SEP."
        },
        {
            id: "comparar_cortes",
            etiqueta: "🔄 Comparar Inicio vs Fin de Cursos",
            prompt: "Compara los registros estadísticos 911 de inicio y fin de cursos de mi escuela y detalla variaciones de alumnos o grupos."
        },
        {
            id: "normas_grupos",
            etiqueta: "📋 Parámetros de Alumnos por Grupo SEP",
            prompt: "¿Cuál es el mínimo y máximo normativo de alumnos por grupo permitido por la SEP en secundarias técnicas?"
        }
    ];

    const cargarProyeccion = async (corte = corteProyeccion) => {
        setLoadingProyeccion(true);
        try {
            const res = await fetch(`/api/director/estadistica-911/predictivo?corte=${corte}`);
            if (res.ok) {
                const data = await res.json();
                setProyeccion(data.proyeccion);
            }
        } catch (err) {
            console.error("Error al cargar proyección del plantel:", err);
        } finally {
            setLoadingProyeccion(false);
        }
    };

    const cargarDatos = async () => {
        setLoading(true);
        try {
            // Cargar configuración
            const resConf = await fetch("/api/admin/estadistica-911/config");
            if (resConf.ok) {
                const confData = await resConf.json();
                setConfig(confData.config);
            }

            // Cargar registro de la escuela desde data.registros
            const resReg = await fetch("/api/admin/estadistica-911");
            if (resReg.ok) {
                const data = await resReg.json();
                const regEncontrado = (data.registros as RegistroApiItem[] | undefined)?.find(
                    (r: RegistroApiItem) => r.escuela?.cct === escuela.cct || r.escuelaCCT === escuela.cct || r.escuelaId === escuela.id
                );
                if (regEncontrado) {
                    setRegistro({
                        id: regEncontrado.id,
                        periodoCorte: regEncontrado.tipoCorte === "FIN_DE_CURSOS" ? "FIN_CURSOS" : "INICIO_CURSOS",
                        estado: regEncontrado.estado,
                        inconsistencias: Array.isArray(regEncontrado.inconsistenciasJson)
                            ? regEncontrado.inconsistenciasJson.map((inc: RegistroApiInconsistencia) => ({
                                campo: inc.campo || "Inconsistencia",
                                mensaje: inc.descripcion || inc.mensaje || "Discrepancia aritmética detectada"
                            }))
                            : [],
                        totalAlumnos: regEncontrado.totalAlumnos || 0,
                        totalHombres: regEncontrado.totalHombres || 0,
                        totalMujeres: regEncontrado.totalMujeres || 0,
                        totalDocentes: regEncontrado.totalDocentes || 0,
                        totalGrupos: regEncontrado.totalGrupos || 0,
                        detallesGrado: Array.isArray(regEncontrado.detalles)
                            ? regEncontrado.detalles.map((d: RegistroApiDetalle) => ({
                                grado: d.semestreGrado,
                                hombres: d.hombres || 0,
                                mujeres: d.mujeres || 0,
                                total: d.total || 0,
                                grupos: d.grupos || 0
                            }))
                            : [],
                        crucesSicep: Array.isArray(regEncontrado.crucesSicep) ? regEncontrado.crucesSicep : [],
                        archivoUrl: regEncontrado.archivoUrl || null,
                        archivoNombre: regEncontrado.archivoNombre || null,
                        observaciones: regEncontrado.notasAtp || null,
                        updatedAt: regEncontrado.updatedAt || new Date().toISOString()
                    });
                } else {
                    setRegistro(null);
                }
            }

            // Cargar proyección inicial
            await cargarProyeccion(corteProyeccion);
        } catch (err) {
            console.error("Error al cargar datos de Estadística 911:", err);
            setMensaje({ tipo: "error", texto: "No se pudieron cargar los datos de estadística." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, [escuela.id]);

    const handleSubirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setMensaje(null);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("escuelaId", escuela.id);
        formData.append("periodoCorte", config?.periodoCorte || "INICIO_CURSOS");

        try {
            const res = await fetch("/api/admin/estadistica-911/upload", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setMensaje({
                    tipo: data.estado === "VALIDADO" ? "success" : "info",
                    texto: `Formato procesado correctamente. Estado: ${data.estado === "VALIDADO" ? "✅ Validado sin inconsistencias" : "⚠️ Con inconsistencias aritméticas detectadas"}.`,
                });
                await cargarDatos();
            } else {
                setMensaje({ tipo: "error", texto: data.error || "Error al procesar el archivo 911." });
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Error al conectar con el servidor.";
            setMensaje({ tipo: "error", texto: errorMsg });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const getEstadoBadge = (estado?: string) => {
        switch (estado) {
            case "VALIDADO":
                return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.75rem", borderRadius: "9999px", background: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: "0.85rem" }}>
                        <CheckCircle2 size={16} /> Validado por Supervisión
                    </span>
                );
            case "CON_INCONSISTENCIAS":
                return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.75rem", borderRadius: "9999px", background: "#fef3c7", color: "#b45309", fontWeight: 700, fontSize: "0.85rem" }}>
                        <AlertTriangle size={16} /> Inconsistencias Aritméticas
                    </span>
                );
            case "ENTREGADO_A_CORDE":
                return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.75rem", borderRadius: "9999px", background: "#dbeafe", color: "#1d4ed8", fontWeight: 700, fontSize: "0.85rem" }}>
                        <Check size={16} /> Entregado a CORDE
                    </span>
                );
            default:
                return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.75rem", borderRadius: "9999px", background: "#f1f5f9", color: "#64748b", fontWeight: 700, fontSize: "0.85rem" }}>
                        <Clock size={16} /> Pendiente de Entrega
                    </span>
                );
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #065f46, #047857)", padding: "1.5rem 1.75rem", borderRadius: "16px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <BarChart3 size={24} />
                        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0 }}>
                            Auditoría y Validación Estadística 911 / SICEP
                        </h2>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.9 }}>
                        Formato Oficial 911 (911.7) — {config?.periodoCorte === "FIN_CURSOS" ? "Fin de Cursos" : "Inicio de Cursos"}
                    </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                        onClick={() => setCopilotOpen(true)}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            padding: "0.5rem 1rem",
                            borderRadius: "10px",
                            background: "linear-gradient(135deg, #4f46e5, #4338ca)",
                            color: "white",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            fontSize: "0.825rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)"
                        }}
                    >
                        <Sparkles size={15} />
                        <span>✨ Copiloto 911</span>
                    </button>
                    <div style={{ background: "rgba(255,255,255,0.15)", padding: "0.6rem 1rem", borderRadius: "12px", fontSize: "0.825rem", textAlign: "right" }}>
                        <div style={{ fontWeight: 700 }}>{escuela.cct}</div>
                        <div style={{ opacity: 0.9 }}>{escuela.nombre}</div>
                    </div>
                </div>
            </div>

            {/* Mensaje de alerta / feedback */}
            {mensaje && (
                <div style={{
                    padding: "0.875rem 1.25rem",
                    borderRadius: "10px",
                    background: mensaje.tipo === "success" ? "#dcfce7" : mensaje.tipo === "error" ? "#fee2e2" : "#eff6ff",
                    color: mensaje.tipo === "success" ? "#166534" : mensaje.tipo === "error" ? "#991b1b" : "#1e40af",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}>
                    <span>{mensaje.texto}</span>
                    <button onClick={() => setMensaje(null)} style={{ background: "transparent", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>
                </div>
            )}

            {loading ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                    <RefreshCw className="animate-spin" size={32} style={{ margin: "0 auto 1rem" }} />
                    <p>Cargando información de estadística 911...</p>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
                    {/* Tarjeta de Estado & Subida */}
                    <div className="card" style={{ background: "white", padding: "1.5rem", borderRadius: "14px", border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <FileSpreadsheet size={20} color="#059669" />
                                Estado de la Entrega
                            </h3>
                            {getEstadoBadge(registro?.estado)}
                        </div>

                        <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "1.25rem", fontSize: "0.85rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                <span style={{ color: "#64748b" }}>Periodo de Corte:</span>
                                <strong style={{ color: "#0f172a" }}>
                                    {config?.periodoCorte === "FIN_CURSOS" ? "Fin de Cursos" : "Inicio de Cursos"}
                                </strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                <span style={{ color: "#64748b" }}>Fecha Límite:</span>
                                <strong style={{ color: "#0f172a" }}>
                                    {config?.periodoCorte === "FIN_CURSOS"
                                        ? (config?.fechaLimiteFin ? new Date(config.fechaLimiteFin).toLocaleDateString("es-MX") : "Sin fecha")
                                        : (config?.fechaLimiteInicio ? new Date(config.fechaLimiteInicio).toLocaleDateString("es-MX") : "Sin fecha")}
                                </strong>
                            </div>
                            {registro?.updatedAt && (
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "#64748b" }}>Última Actualización:</span>
                                    <strong style={{ color: "#0f172a" }}>
                                        {new Date(registro.updatedAt).toLocaleString("es-MX")}
                                    </strong>
                                </div>
                            )}
                        </div>

                        {/* Botón de Carga */}
                        <div style={{ border: "2px dashed #cbd5e1", borderRadius: "12px", padding: "1.5rem", textAlign: "center", background: "#fcfdfe" }}>
                            <Upload size={28} color="#059669" style={{ margin: "0 auto 0.75rem" }} />
                            <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 700 }}>
                                {registro ? "Actualizar Formato 911" : "Subir Formato 911"}
                            </h4>
                            <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", color: "#64748b" }}>
                                Formato Excel (.xlsx, .xls) o PDF descargado del sistema oficial 911
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.pdf"
                                onChange={handleSubirArchivo}
                                style={{ display: "none" }}
                                id="archivo-911-input"
                                disabled={uploading}
                            />
                            <label
                                htmlFor="archivo-911-input"
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    padding: "0.6rem 1.25rem",
                                    borderRadius: "8px",
                                    background: uploading ? "#94a3b8" : "#059669",
                                    color: "white",
                                    fontWeight: 700,
                                    fontSize: "0.85rem",
                                    cursor: uploading ? "not-allowed" : "pointer",
                                }}
                            >
                                {uploading ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" /> Procesando y Validando...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={16} /> Seleccionar Archivo
                                    </>
                                )}
                            </label>
                        </div>

                        {/* Observaciones de Supervisión */}
                        {registro?.observaciones && (
                            <div style={{ marginTop: "1rem", padding: "0.875rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", fontSize: "0.825rem" }}>
                                <div style={{ fontWeight: 700, color: "#166534", marginBottom: "0.25rem" }}>
                                    Nota de Supervisión:
                                </div>
                                <div style={{ color: "#15803d" }}>{registro.observaciones}</div>
                            </div>
                        )}
                    </div>

                    {/* Tarjeta de Resumen & Inconsistencias */}
                    <div className="card" style={{ background: "white", padding: "1.5rem", borderRadius: "14px", border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Users size={20} color="#0284c7" />
                            Matrícula y Datos Validados
                        </h3>

                        {registro ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {/* Métricas clave */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", textAlign: "center" }}>
                                    <div style={{ background: "#f0fdf4", padding: "0.75rem", borderRadius: "8px", border: "1px solid #dcfce7" }}>
                                        <div style={{ fontSize: "0.7rem", color: "#166534", fontWeight: 600 }}>ALUMNOS TOTAL</div>
                                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#15803d" }}>{registro.totalAlumnos}</div>
                                        <div style={{ fontSize: "0.65rem", color: "#64748b" }}>
                                            {registro.totalHombres} H / {registro.totalMujeres} M
                                        </div>
                                    </div>
                                    <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                        <div style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600 }}>DOCENTES</div>
                                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>{registro.totalDocentes}</div>
                                        <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Frente a grupo</div>
                                    </div>
                                    <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                        <div style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600 }}>GRUPOS</div>
                                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>{registro.totalGrupos}</div>
                                        <div style={{ fontSize: "0.65rem", color: "#64748b" }}>1°, 2° y 3°</div>
                                    </div>
                                </div>

                                {/* Desglose por Grado */}
                                {registro.detallesGrado && registro.detallesGrado.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.5rem" }}>
                                            Desglose por Grado Escolar
                                        </div>
                                        <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                                            <table style={{ width: "100%", fontSize: "0.75rem", textAlign: "center", borderCollapse: "collapse" }}>
                                                <thead>
                                                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                                                        <th style={{ padding: "0.4rem" }}>Grado</th>
                                                        <th style={{ padding: "0.4rem" }}>Hombres</th>
                                                        <th style={{ padding: "0.4rem" }}>Mujeres</th>
                                                        <th style={{ padding: "0.4rem" }}>Total</th>
                                                        <th style={{ padding: "0.4rem" }}>Grupos</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {registro.detallesGrado.map((d, idx) => (
                                                        <tr key={idx} style={{ borderBottom: idx < registro.detallesGrado.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                                            <td style={{ padding: "0.4rem", fontWeight: 700 }}>{d.grado}°</td>
                                                            <td style={{ padding: "0.4rem" }}>{d.hombres}</td>
                                                            <td style={{ padding: "0.4rem" }}>{d.mujeres}</td>
                                                            <td style={{ padding: "0.4rem", fontWeight: 700, color: "#059669" }}>{d.total}</td>
                                                            <td style={{ padding: "0.4rem" }}>{d.grupos}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Reporte de Inconsistencias Aritméticas si existen */}
                                {registro.inconsistencias && registro.inconsistencias.length > 0 ? (
                                    <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "8px", padding: "0.875rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#b45309", fontWeight: 700, fontSize: "0.825rem", marginBottom: "0.5rem" }}>
                                            <AlertTriangle size={16} /> Inconsistencias Detectadas ({registro.inconsistencias.length})
                                        </div>
                                        <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.75rem", color: "#92400e", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                            {registro.inconsistencias.map((inc, i) => (
                                                <li key={i}>{inc.mensaje}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "#166534", fontSize: "0.8rem" }}>
                                        <CheckCircle2 size={16} />
                                        <span>Cuadre aritmético al 100%: Suma de géneros, edades y totales verificada.</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
                                <FileSpreadsheet size={36} style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} />
                                <p>Aún no se ha cargado el formato oficial 911 para este periodo.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════ PROYECCIÓN Y ANÁLISIS DE CAPACIDAD ÁULICA (DIRECTOR) ════════════ */}
            {proyeccion && (
                <div style={{
                    background: "#ffffff",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    padding: "1.5rem",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.25rem"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <TrendingUp size={22} color="#4f46e5" />
                            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "#1e293b" }}>
                                Proyección Predictiva y Capacidad Áulica del Plantel
                            </h3>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <button
                                onClick={() => {
                                    setCorteProyeccion("INICIO_DE_CURSOS");
                                    cargarProyeccion("INICIO_DE_CURSOS");
                                }}
                                style={{
                                    padding: "0.3rem 0.65rem",
                                    borderRadius: "6px",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    border: "none",
                                    cursor: "pointer",
                                    background: corteProyeccion === "INICIO_DE_CURSOS" ? "#059669" : "#f1f5f9",
                                    color: corteProyeccion === "INICIO_DE_CURSOS" ? "#ffffff" : "#64748b"
                                }}
                            >
                                911.7A Inicio
                            </button>
                            <button
                                onClick={() => {
                                    setCorteProyeccion("FIN_DE_CURSOS");
                                    cargarProyeccion("FIN_DE_CURSOS");
                                }}
                                style={{
                                    padding: "0.3rem 0.65rem",
                                    borderRadius: "6px",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    border: "none",
                                    cursor: "pointer",
                                    background: corteProyeccion === "FIN_DE_CURSOS" ? "#2563eb" : "#f1f5f9",
                                    color: corteProyeccion === "FIN_DE_CURSOS" ? "#ffffff" : "#64748b"
                                }}
                            >
                                911.7B Fin
                            </button>
                        </div>
                    </div>

                    {/* Banner de Advertencia */}
                    <div style={{
                        background: "#fffbeb",
                        border: "1px solid #fef3c7",
                        borderLeft: "4px solid #f59e0b",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        color: "#92400e"
                    }}>
                        <strong>⚠️ PROYECCIÓN ESTIMADA:</strong> Los valores son proyecciones deterministas calculadas con base en la estructura de grupos autorizados y estándares SEP. No sustituyen las cifras oficiales de captura.
                    </div>

                    {/* KPIs de la Proyección */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                        <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>MATRÍCULA PROYECTADA</div>
                            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#1e293b", marginTop: "0.2rem" }}>
                                {proyeccion.matriculaTotalEstimada}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#059669", marginTop: "0.2rem" }}>
                                Capacidad óptima: {proyeccion.capacidadInstaladaOptima}
                            </div>
                        </div>

                        <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>CAPACIDAD INSTALADA</div>
                            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#059669", marginTop: "0.2rem" }}>
                                {proyeccion.capacidadInstaladaOptima}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.2rem" }}>
                                Rango normativo: [{proyeccion.intervaloConfianzaMin} - {proyeccion.intervaloConfianzaMax}]
                            </div>
                        </div>

                        <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>DENSIDAD Y DOCENTES</div>
                            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#3b82f6", marginTop: "0.2rem" }}>
                                {proyeccion.densidadPromedioPorGrupo} <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Alumn/Grp</span>
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.2rem" }}>
                                {proyeccion.totalGruposAutorizados} grupos autorizados • {proyeccion.docentesEstimadosRequeridos} docentes req.
                            </div>
                        </div>

                        <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>DIAGNÓSTICO DE CAPACIDAD</div>
                            <div style={{ marginTop: "0.4rem" }}>
                                <span style={{
                                    padding: "0.25rem 0.65rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.75rem",
                                    fontWeight: 800,
                                    background: proyeccion.semaforoRiesgo === "RIESGO_SOBRECUPO" ? "#fee2e2" :
                                        proyeccion.semaforoRiesgo === "RIESGO_SUBUTILIZACION" ? "#fef3c7" :
                                            proyeccion.semaforoRiesgo === "RIESGO_DESERCION_CRITICA" ? "#f3e8ff" : "#dcfce7",
                                    color: proyeccion.semaforoRiesgo === "RIESGO_SOBRECUPO" ? "#991b1b" :
                                        proyeccion.semaforoRiesgo === "RIESGO_SUBUTILIZACION" ? "#92400e" :
                                            proyeccion.semaforoRiesgo === "RIESGO_DESERCION_CRITICA" ? "#6b21a8" : "#166534"
                                }}>
                                    {proyeccion.semaforoRiesgo === "RIESGO_SOBRECUPO" ? "⚠️ RIESGO SOBRECUPO" :
                                        proyeccion.semaforoRiesgo === "RIESGO_SUBUTILIZACION" ? "⚠️ SUBUTILIZACIÓN" :
                                            proyeccion.semaforoRiesgo === "RIESGO_DESERCION_CRITICA" ? "⚠️ ALERTA DESERCIÓN" : "✅ EQUILIBRADO"}
                                </span>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#334155", marginTop: "0.4rem", lineHeight: 1.3 }}>
                                {proyeccion.observacionOperativa}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════ COPILOTO IA DE ESTADÍSTICA 911 (DIRECTOR) ════════════ */}
            <ModuloCopilotDrawer
                modulo="estadistica_911"
                titulo="Copiloto de Estadística 911"
                subtitulo={`Auditoría de matrícula para ${escuela.nombre} (${escuela.cct})`}
                isOpen={copilotOpen}
                onClose={() => setCopilotOpen(false)}
                accionesSugeridas={ACCIONES_911}
            />
        </div>
    );
}
