"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
    Upload,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Eye,
    FileText,
    Download,
    Trash2,
    ChevronDown,
    ChevronUp,
    MessageSquare,
    Sparkles,
    Brain,
    RefreshCw,
    Loader2,
    X as XIcon,
    Send,
} from "lucide-react";
import { ProgramaGroup, EntregaDirector } from "@/types/director";
import { getDownloadUrl } from "@/lib/download-url";
import PdfViewerModal from "@/app/_componentes/PdfViewerModal";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const ESTADO_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    PENDIENTE: { color: "var(--success)", icon: <CheckCircle2 size={14} />, label: "Entregado" },
    EN_REVISION: { color: "var(--primary)", icon: <Eye size={14} />, label: "En Revisión" },
    REQUIERE_CORRECCION: { color: "#e67e22", icon: <AlertTriangle size={14} />, label: "Requiere Corrección" },
    APROBADO: { color: "var(--success)", icon: <CheckCircle2 size={14} />, label: "Aprobado" },
    NO_APROBADO: { color: "var(--danger)", icon: <XCircle size={14} />, label: "No Aprobado" },
    NO_ENTREGADO: { color: "var(--text-muted)", icon: <XCircle size={14} />, label: "No Entregado" },
};

import { getNombrePeriodo } from "@/lib/constants";

function getPeriodoLabel(ent: EntregaDirector): string {
    return getNombrePeriodo(ent.periodoEntrega, ent.periodoEntrega.programa?.nombre);
}

export default function EntregasListado({
    programas,
    onSetMessage,
    readOnly = false,
}: {
    programas: ProgramaGroup[];
    onSetMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
    readOnly?: boolean;
}) {
    const [uploading, setUploading] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    // Auto-expand all single-period (annual) programs; start with first multi-period expanded
    const [expandedProg, setExpandedProg] = useState<string | null>(programas[0]?.programa.id ?? null);
    const [expandedCorrecciones, setExpandedCorrecciones] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedEntrega, setSelectedEntrega] = useState<string | null>(null);
    const [selectedEtiqueta, setSelectedEtiqueta] = useState<string | null>(null);
    const [viewingPdf, setViewingPdf] = useState<{ url: string; title: string; downloadUrl?: string; fileName?: string } | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    async function handleUpload(entregaId: string, etiqueta?: string) {
        setSelectedEntrega(entregaId);
        setSelectedEtiqueta(etiqueta || null);
        fileInputRef.current?.click();
    }

    async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !selectedEntrega) return;

        setUploading(selectedEntrega + (selectedEtiqueta || ""));
        onSetMessage(null);

        try {
            // 1. Obtener firma
            const signRes = await fetch("/api/sign-cloudinary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entregaId: selectedEntrega,
                    originalFilename: file.name,
                    etiqueta: selectedEtiqueta
                })
            });

            if (!signRes.ok) {
                const err = await signRes.json();
                throw new Error(err.error || "No se pudo iniciar la subida");
            }

            const { signature, timestamp, folder, publicId, apiKey, cloudName } = await signRes.json();

            // 2. Subir
            const formData = new FormData();
            formData.append("file", file);
            formData.append("api_key", apiKey);
            formData.append("timestamp", timestamp.toString());
            formData.append("signature", signature);
            formData.append("folder", folder);
            if (publicId) formData.append("public_id", publicId);

            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                method: "POST",
                body: formData
            });

            if (!uploadRes.ok) {
                const errData = await uploadRes.json();
                throw new Error(errData.error?.message || "Error al subir a la nube");
            }

            const uploadData = await uploadRes.json();

            // 3. Confirmar
            const confirmRes = await fetch("/api/upload/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entregaId: selectedEntrega,
                    etiqueta: selectedEtiqueta,
                    fileData: {
                        name: file.name,
                        type: file.type,
                        url: uploadData.secure_url,
                        publicId: uploadData.public_id
                    }
                })
            });

            if (confirmRes.ok) {
                onSetMessage({ type: "success", text: `✅ "${file.name}" subido correctamente` });
                router.refresh();
            } else {
                const data = await confirmRes.json();
                onSetMessage({ type: "error", text: data.error || "Error al guardar el archivo" });
            }
        } catch (error: any) {
            onSetMessage({ type: "error", text: error.message || "Error de conexión. Intenta de nuevo." });
        } finally {
            setUploading(null);
            setSelectedEntrega(null);
            setSelectedEtiqueta(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleDeleteFile(archivoId: string) {
        if (!confirm("¿Estás seguro de eliminar este archivo?")) return;
        setDeleting(archivoId);

        try {
            const res = await fetch(`/api/archivos/${archivoId}`, { method: "DELETE" });
            if (res.ok) {
                onSetMessage({ type: "success", text: "Archivo eliminado" });
                router.refresh();
            } else {
                const data = await res.json();
                onSetMessage({ type: "error", text: data.error || "Error al eliminar" });
            }
        } catch {
            onSetMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setDeleting(null);
        }
    }

    const canUpload = (estado: string) => !readOnly && estado !== "APROBADO";

    if (!isMounted) return null;

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                accept="*/*"
                onChange={handleFileSelected}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {programas.map((group) => {
                    const isSinglePeriod = group.entregas.length === 1;
                    // Single-period programs (annual) are always expanded
                    const isExpanded = isSinglePeriod || expandedProg === group.programa.id;
                    const aprobProg = group.entregas.filter((e) => e.estado === "APROBADO").length;
                    const totalProg = group.entregas.length;
                    const pct = totalProg > 0 ? Math.round((aprobProg / totalProg) * 100) : 0;

                    // Border color by status
                    const pendientesProg = group.entregas.filter(e =>
                        e.estado === "REQUIERE_CORRECCION" || e.estado === "NO_APROBADO"
                    ).length;
                    const borderColor = aprobProg === totalProg
                        ? "var(--success)"
                        : pendientesProg > 0
                            ? "var(--warning)"
                            : "var(--border)";

                    return (
                        <div key={group.programa.id} className="card" style={{ padding: 0, overflow: "hidden", borderLeft: `4px solid ${borderColor}` }}>
                            {/* Programa header */}
                            <div
                                onClick={() => !isSinglePeriod && setExpandedProg(isExpanded ? null : group.programa.id)}
                                style={{
                                    padding: "0.875rem 1rem",
                                    cursor: isSinglePeriod ? "default" : "pointer",
                                    userSelect: "none",
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{group.programa.nombre}</div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.125rem" }}>
                                            {group.programa.tipo === "MENSUAL" ? "Mensual" : group.programa.tipo === "SEMESTRAL" ? "Semestral" : "Anual"}
                                            {group.programa.numArchivos > 1 && ` · ${group.programa.numArchivos} archivos por entrega`}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{
                                            fontSize: "0.75rem", fontWeight: 700,
                                            color: aprobProg === totalProg ? "var(--success)" : "var(--text-muted)"
                                        }}>
                                            {aprobProg}/{totalProg}
                                        </span>
                                        {!isSinglePeriod && (
                                            isExpanded ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
                                        )}
                                    </div>
                                </div>
                                {/* Mini progress bar */}
                                <div style={{ height: "3px", background: "var(--bg-secondary)", borderRadius: "2px" }}>
                                    <div style={{
                                        height: "100%", width: `${pct}%`,
                                        background: borderColor,
                                        borderRadius: "2px", transition: "width 0.4s ease",
                                    }} />
                                </div>
                            </div>

                            {/* Entregas list per period */}
                            {isExpanded && (
                                <div style={{ borderTop: "1px solid var(--border)" }}>
                                    {group.entregas.map((ent) => {
                                        const estadoConf = ESTADO_CONFIG[ent.estado] || ESTADO_CONFIG.PENDIENTE;
                                        const entregaArchivos = ent.archivos.filter((a) => a.tipo === "ENTREGA");
                                        const hasCorrecciones = ent.correcciones.length > 0;
                                        const showCorrecciones = expandedCorrecciones === ent.id;

                                        return (
                                            <div key={ent.id} style={{ padding: "1rem", borderBottom: "1px solid var(--border)" }}>
                                                {/* Period label + status */}
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                                        <span style={{ fontWeight: 600 }}>{getPeriodoLabel(ent)}</span>
                                                        {ent.periodoEntrega.fechaLimite ? (
                                                            <span style={{ fontSize: "0.75rem", color: "var(--danger)", padding: "0.1rem 0.4rem", background: "var(--danger-light, #fee2e2)", borderRadius: "12px", fontWeight: 500 }}>
                                                                Vence: {new Date(ent.periodoEntrega.fechaLimite).toLocaleDateString("es-MX", { day: '2-digit', month: 'long', year: 'numeric' })}
                                                            </span>
                                                        ) : (
                                                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "0.1rem 0.4rem", background: "#f1f5f9", borderRadius: "12px", fontWeight: 500 }}>
                                                                Sin fecha límite
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span
                                                        style={{
                                                            display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                                            padding: "0.25rem 0.5rem", borderRadius: "6px",
                                                            fontSize: "0.75rem", fontWeight: 600,
                                                            background: `${estadoConf.color}20`, color: estadoConf.color,
                                                        }}
                                                    >
                                                        {estadoConf.icon}
                                                        {estadoConf.label}
                                                    </span>
                                                </div>

                                                {/* Uploaded files */}
                                                {entregaArchivos.length > 0 && (
                                                    <div style={{ marginBottom: "0.5rem" }}>
                                                        {entregaArchivos.map((arch) => (
                                                            <div key={arch.id} style={{
                                                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                                                padding: "0.375rem 0.5rem", background: "var(--bg-secondary)",
                                                                borderRadius: "6px", marginBottom: "0.25rem", fontSize: "0.8125rem",
                                                            }}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", minWidth: 0, flex: 1 }}>
                                                                    <FileText size={14} style={{ flexShrink: 0 }} />
                                                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                        {arch.etiqueta && <strong>{arch.etiqueta}: </strong>}
                                                                        {arch.nombre}
                                                                    </span>
                                                                    {arch.createdAt && (
                                                                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "auto", flexShrink: 0, paddingRight: "0.5rem" }}>
                                                                            {new Date(arch.createdAt).toLocaleDateString("es-MX", { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                                                                    {/* Ver documento */}
                                                                    {arch.driveUrl && (
                                                                        <button
                                                                            onClick={() => setViewingPdf({
                                                                                url: arch.driveUrl!,
                                                                                title: `${group.programa.nombre}${arch.etiqueta ? ` — ${arch.etiqueta}` : ""} — ${arch.nombre}`,
                                                                                downloadUrl: getDownloadUrl(arch.driveUrl, arch.nombre, arch.driveId),
                                                                                fileName: arch.nombre,
                                                                            })}
                                                                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "0.25rem", display: "inline-flex", alignItems: "center" }}
                                                                            title="Ver documento"
                                                                        >
                                                                            <Eye size={15} />
                                                                        </button>
                                                                    )}
                                                                    {/* Eliminar */}
                                                                    {canUpload(ent.estado) && (
                                                                        <button
                                                                            onClick={() => handleDeleteFile(arch.id)}
                                                                            disabled={deleting === arch.id}
                                                                            style={{
                                                                                background: "none", border: "none", cursor: "pointer",
                                                                                color: "var(--danger)", padding: "0.25rem", flexShrink: 0,
                                                                            }}
                                                                            title="Eliminar archivo"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* ATP observations */}
                                                {ent.observacionesATP && (
                                                    <div style={{
                                                        padding: "0.5rem", background: "#fff3cd", borderRadius: "6px",
                                                        fontSize: "0.8125rem", marginBottom: "0.5rem", color: "#856404",
                                                    }}>
                                                        <strong>Observaciones ATP:</strong> {ent.observacionesATP}
                                                    </div>
                                                )}

                                                {/* IA Pre-revision section for Director */}
                                                <PreRevisionDirector
                                                    entregaId={ent.id}
                                                    onSetMessage={onSetMessage}
                                                    entregaEstado={ent.estado}
                                                    hasUploadedFiles={entregaArchivos.length > 0}
                                                    programaNombre={group.programa.nombre}
                                                 />

                                                {/* Corrections toggle */}
                                                {hasCorrecciones && (
                                                    <div style={{ marginBottom: "0.5rem" }}>
                                                        <button
                                                            onClick={() => setExpandedCorrecciones(showCorrecciones ? null : ent.id)}
                                                            style={{
                                                                background: "#e67e2220", border: "1px solid #e67e22",
                                                                borderRadius: "6px", padding: "0.375rem 0.75rem",
                                                                cursor: "pointer", fontSize: "0.8125rem", color: "#e67e22",
                                                                fontWeight: 600, display: "flex", alignItems: "center", gap: "0.375rem",
                                                                width: "100%",
                                                            }}
                                                        >
                                                            <MessageSquare size={14} />
                                                            {ent.correcciones.length} corrección(es) del ATP
                                                            {showCorrecciones ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </button>

                                                        {showCorrecciones && (
                                                            <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                                                {ent.correcciones.map((corr) => (
                                                                    <div key={corr.id} style={{
                                                                        padding: "0.5rem", background: "#fef2e6", borderRadius: "6px",
                                                                        borderLeft: "3px solid #e67e22", fontSize: "0.8125rem",
                                                                    }}>
                                                                        <div style={{ fontWeight: 600, marginBottom: "0.25rem", color: "#e67e22" }}>
                                                                            {corr.admin.nombre} — {new Date(corr.createdAt).toLocaleDateString("es-MX")}
                                                                        </div>
                                                                        {corr.archivo && (
                                                                            <a
                                                                                href={getDownloadUrl(corr.archivo.driveUrl, corr.archivo.nombre, corr.archivo.driveId) || "#"}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--primary)", textDecoration: "none", fontWeight: 600, marginTop: "0.25rem" }}
                                                                            >
                                                                                <Download size={12} />
                                                                                <span>Descargar archivo: {corr.archivo.nombre}</span>
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Upload buttons */}
                                                {canUpload(ent.estado) && (
                                                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", width: "100%" }}>
                                                        {Array.from({ length: group.programa.numArchivos }).map((_, i) => {
                                                            // Use dynamic labels from admin config, fallback to generic
                                                            const etiquetas = group.programa.etiquetasArchivos || [];
                                                            let defaultLabel = etiquetas[i] && etiquetas[i].trim() !== "" ? etiquetas[i] : `Archivo ${i + 1}`;

                                                            // Si solo es 1 archivo general, lo usualmente no usa etiqueta en la UI original
                                                            if (group.programa.numArchivos === 1) defaultLabel = "";

                                                            const hasFileAlready = defaultLabel !== "" ? entregaArchivos.some(a => a.etiqueta === defaultLabel) : entregaArchivos.length > 0;

                                                            if (hasFileAlready) return null;

                                                            return (
                                                                <button
                                                                    key={i}
                                                                    className="btn btn-success"
                                                                    onClick={() => handleUpload(ent.id, defaultLabel !== "" ? defaultLabel : undefined)}
                                                                    disabled={uploading === ent.id + defaultLabel}
                                                                    style={{ flex: 1, fontSize: "0.8125rem", minWidth: "120px" }}
                                                                >
                                                                    {uploading === ent.id + defaultLabel ? "Subiendo..." : (
                                                                        <><Upload size={16} /> Subir {defaultLabel || "Archivo"}</>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Approved message */}
                                                {ent.estado === "APROBADO" && (
                                                    <div style={{ textAlign: "center", fontSize: "0.8125rem", color: "var(--success)", fontWeight: 600 }}>
                                                        <div>✅ Entrega aprobada</div>
                                                        {ent.cvd && (
                                                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem", fontWeight: 500 }}>
                                                                CVD: <a href={`/validar-documento?cvd=${ent.cvd}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "monospace", color: "var(--primary)", textDecoration: "none", fontWeight: 700 }} title="Verificar autenticidad digital">{ent.cvd}</a>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Visor de documentos ── */}
            {viewingPdf && (
                <PdfViewerModal
                    isOpen={true}
                    onClose={() => setViewingPdf(null)}
                    url={viewingPdf.url}
                    title={viewingPdf.title}
                    downloadUrl={viewingPdf.downloadUrl}
                    fileName={viewingPdf.fileName}
                />
            )}
        </>
    );
}

// ─── Custom Markdown Renderer for IA Observations ──────────────────────────

function renderMarkdown(text: string) {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, i) => {
        const cleanLine = line.trim();
        
        // Headers
        if (cleanLine.startsWith("### ")) {
            return <h5 key={i} style={{ fontSize: "0.875rem", fontWeight: 700, margin: "0.75rem 0 0.25rem", color: "#1e293b" }}>{parseBoldText(cleanLine.slice(4))}</h5>;
        }
        if (cleanLine.startsWith("## ")) {
            return <h4 key={i} style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "1rem 0 0.5rem", color: "#0f172a" }}>{parseBoldText(cleanLine.slice(3))}</h4>;
        }
        if (cleanLine.startsWith("# ")) {
            return <h3 key={i} style={{ fontSize: "1rem", fontWeight: 700, margin: "1.25rem 0 0.75rem", color: "#0f172a" }}>{parseBoldText(cleanLine.slice(2))}</h3>;
        }
        
        // Bullet points
        if (cleanLine.startsWith("* ") || cleanLine.startsWith("- ")) {
            return (
                <li key={i} style={{ marginLeft: "1.25rem", listStyleType: "disc", marginBottom: "0.35rem", fontSize: "0.8125rem", color: "#334155" }}>
                    {parseBoldText(cleanLine.slice(2))}
                </li>
            );
        }
        
        // HR
        if (cleanLine === "---") {
            return <hr key={i} style={{ border: "0", borderTop: "1px solid var(--border)", margin: "0.75rem 0" }} />;
        }

        // Empty line
        if (!cleanLine) {
            return <div key={i} style={{ height: "0.4rem" }} />;
        }

        // Regular line
        return <p key={i} style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", color: "#334155", lineHeight: 1.4 }}>{parseBoldText(cleanLine)}</p>;
    });
}

function parseBoldText(text: string) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
        if (i % 2 === 1) {
            return <strong key={i} style={{ fontWeight: 700, color: "#0f172a" }}>{part}</strong>;
        }
        return part;
    });
}

// ─── Sub-Component for IA Pre-revision ──────────────────────────────────────

interface PreRevisionDirectorProps {
    entregaId: string;
    onSetMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
    entregaEstado: string;
    hasUploadedFiles: boolean;
    programaNombre: string;
}

function PreRevisionDirector({ entregaId, onSetMessage, entregaEstado, hasUploadedFiles, programaNombre }: PreRevisionDirectorProps) {
    const [data, setData] = useState<{
        resultado: any;
        intentosUsados: number;
        limiteIntentos: number;
        activoDirectores: boolean;
        evaluacionActual?: boolean;
        updatedAt?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [evaluating, setEvaluating] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [showDetails, setShowDetails] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const fetchConfig = useCallback(async () => {
        try {
            const res = await fetch(`/api/entregas/${entregaId}/pre-revision`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (err) {
            console.error("Error al cargar pre-revisión:", err);
        } finally {
            setLoading(false);
        }
    }, [entregaId]);

    useEffect(() => {
        if (hasUploadedFiles) {
            fetchConfig();
        } else {
            setLoading(false);
        }
    }, [hasUploadedFiles, fetchConfig]);
    async function handleReEvaluate() {
        setEvaluating(true);
        setStatusText("Obteniendo información del archivo...");
        onSetMessage(null);
        try {
            const infoRes = await fetch(`/api/entregas/${entregaId}/pre-revision?action=info`);
            if (!infoRes.ok) {
                const errData = await infoRes.json().catch(() => ({}));
                throw new Error(errData.error || "Error al obtener información del archivo");
            }
            const info = await infoRes.json();
            
            let textoCompleto = "";
            if (info.format === "pdf" && info.totalPages > 0) {
                const totalPages = info.totalPages;
                const chunkSize = 15;
                
                for (let start = 1; start <= totalPages; start += chunkSize) {
                    const end = Math.min(start + chunkSize - 1, totalPages);
                    setStatusText(`Leyendo y extrayendo texto del documento... (Páginas ${start} a ${end} de ${totalPages})`);
                    
                    const extractRes = await fetch(
                        `/api/entregas/${entregaId}/pre-revision?action=extract&start=${start}&end=${end}`
                    );
                    if (!extractRes.ok) throw new Error(`Error al extraer texto de las páginas ${start}-${end}`);
                    const extractData = await extractRes.json();
                    textoCompleto += (extractData.text || "") + "\n";
                }
            }
            
            setStatusText("Analizando el documento preliminarmente...");
            const res = await fetch(`/api/entregas/${entregaId}/pre-revision`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ textoCompleto })
            });
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Error al generar autoevaluación");
            }
            
            const resJson = await res.json();
            
            // Iniciar Polling (esperar a que la evaluación en segundo plano se complete)
            if (resJson.success) {
                let attempts = 0;
                const maxAttempts = 30; // 30 intentos * 3 segundos = 90 segundos máximo
                while (attempts < maxAttempts) {
                    attempts++;
                    setStatusText(`Analizando el documento preliminarmente con IA... Por favor espera (reintento ${attempts}/${maxAttempts})`);
                    
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    const pollRes = await fetch(`/api/entregas/${entregaId}/pre-revision`);
                    if (!pollRes.ok) continue;
                    
                    const pollData = await pollRes.json();
                    if (pollData.evaluacionActual && pollData.resultado && pollData.resultado.tipo) {
                        setData({
                            resultado: pollData.resultado,
                            intentosUsados: pollData.intentosUsados,
                            limiteIntentos: pollData.limiteIntentos,
                            activoDirectores: pollData.activoDirectores,
                            evaluacionActual: true,
                            updatedAt: pollData.updatedAt
                        });
                        setEvaluating(false);
                        onSetMessage({ type: "success", text: "✅ Autoevaluación preliminar generada con éxito." });
                        return; // Salir de la función con éxito
                    }
                }
                throw new Error("El análisis de la IA está tomando más tiempo de lo esperado. Por favor, refresca la página en unos momentos.");
            } else {
                throw new Error("No se pudo iniciar el análisis de la IA");
            }
        } catch (error: any) {
            onSetMessage({ type: "error", text: error.message || "Error al conectar con el servidor" });
        } finally {
            setEvaluating(false);
            setStatusText("");
        }
    }

    if (loading || !hasUploadedFiles || !data || !data.activoDirectores) {
        return null;
    }

    const { resultado, intentosUsados, limiteIntentos } = data;
    const isApproved = resultado?.aprobado;
    const score = resultado?.puntuacion || "N/A";
    const observations = resultado?.borradorCorreo || "Sin observaciones específicas.";
    const hasRemainingAttempts = intentosUsados < limiteIntentos;

    return (
        <div style={{
            marginTop: "0.75rem",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: `1px solid ${isApproved ? "#86efac" : "#fca5a5"}`,
            background: isApproved ? "rgba(240, 253, 244, 0.7)" : "rgba(254, 242, 242, 0.7)",
            fontSize: "0.8125rem",
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Brain size={16} style={{ color: "var(--primary)" }} />
                    <span style={{ fontWeight: 700, color: "#1e293b" }}>Asistente de Autoevaluación</span>
                </div>
                
                {resultado && resultado.tipo && (
                    <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        fontSize: "0.725rem",
                        fontWeight: 700,
                        background: isApproved ? "#dcfce7" : "#fee2e2",
                        color: isApproved ? "#15803d" : "#b91c1c",
                        border: `1px solid ${isApproved ? "#bbf7d0" : "#fecaca"}`
                    }}>
                        <Sparkles size={10} />
                        Puntuación: {score} · {isApproved ? "Aprobado" : "Requiere Ajustes"}
                    </span>
                )}
            </div>

            {/* Observations */}
            {resultado && resultado.tipo ? (
                <div style={{ marginBottom: "0.75rem" }}>
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        style={{
                            background: "none",
                            border: "none",
                            color: "var(--primary)",
                            padding: 0,
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            textDecoration: "underline",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem"
                        }}
                    >
                        {showDetails ? "Ocultar observaciones preliminares" : "Ver observaciones preliminares"}
                        {data?.updatedAt && ` (${new Date(data.updatedAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })})`}
                    </button>

                    {showDetails && (
                        <div style={{
                            marginTop: "0.5rem",
                            padding: "0.75rem",
                            background: "white",
                            borderRadius: "6px",
                            border: "1px solid var(--border)",
                            maxHeight: "350px",
                            overflowY: "auto"
                        }}>
                            {renderMarkdown(observations)}
                        </div>
                    )}
                </div>
            ) : (
                <p style={{ margin: "0 0 0.5rem", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                    Esta entrega aún no cuenta con una autoevaluación preliminar.
                </p>
            )}

            {/* Actions & Attempts */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", borderTop: "1px dashed var(--border)", paddingTop: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.725rem", color: "var(--text-muted)", marginRight: "0.5rem" }}>
                        Autoevaluaciones realizadas: <strong>{intentosUsados} de {limiteIntentos}</strong>
                    </span>
                    {resultado && resultado.tipo && (
                        <button
                            onClick={() => setShowChat(true)}
                            type="button"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.375rem",
                                padding: "0.35rem 0.65rem",
                                fontSize: "0.725rem",
                                fontWeight: 600,
                                borderRadius: "4px",
                                background: "var(--bg-secondary)",
                                border: "1px solid var(--border)",
                                color: "var(--text-secondary)",
                                cursor: "pointer"
                            }}
                        >
                            <MessageSquare size={11} />
                            Preguntar al Asistente (Chat)
                        </button>
                    )}
                </div>

                {evaluating ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.725rem", color: "var(--primary)", fontWeight: 600 }}>
                        <Loader2 size={12} className="spin" /> {statusText}
                    </span>
                ) : (
                    entregaEstado === "PENDIENTE" && (
                        data?.evaluacionActual ? (
                            <span style={{ fontSize: "0.725rem", color: "var(--success)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                ✓ Entrega autoevaluada
                            </span>
                        ) : hasRemainingAttempts ? (
                            <button
                                onClick={handleReEvaluate}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.375rem",
                                    padding: "0.35rem 0.65rem",
                                    fontSize: "0.725rem",
                                    fontWeight: 600,
                                    borderRadius: "4px",
                                    background: "var(--primary)",
                                    color: "white",
                                    border: "none",
                                    cursor: "pointer"
                                }}
                            >
                                <RefreshCw size={11} />
                                {intentosUsados > 0 ? "Volver a autoevaluar" : "Pre-evaluar entrega"}
                            </button>
                        ) : (
                            <span style={{ fontSize: "0.725rem", color: "var(--danger)", fontWeight: 600 }}>
                                ⚠️ Límite de autoevaluaciones agotado.
                            </span>
                        )
                    )
                )}
            </div>
            {showChat && isMounted && createPortal(
                <PreRevisionChat
                    entregaId={entregaId}
                    programaNombre={programaNombre}
                    onClose={() => setShowChat(false)}
                />,
                document.body
            )}
        </div>
    );
}


// ─── PreRevisionChat Component (AI Copilot Chat) ──────────────────────────

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
}

function PreRevisionChat({
    entregaId,
    programaNombre,
    onClose
}: {
    entregaId: string;
    programaNombre: string;
    onClose: () => void;
}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const fetchChat = async () => {
        try {
            const res = await fetch(`/api/entregas/${entregaId}/chat`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (e) {
            console.error("Error fetching chat:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChat();
    }, [entregaId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || sending) return;

        const userMsgText = input.trim();
        setInput("");
        setSending(true);

        const tempId = `temp-${Date.now()}`;
        setMessages(prev => [
            ...prev,
            { id: tempId, role: "user", content: userMsgText, createdAt: new Date().toISOString() }
        ]);

        try {
            const res = await fetch(`/api/entregas/${entregaId}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMsgText }),
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(prev =>
                    prev.filter(m => m.id !== tempId).concat([data.userMessage, data.aiMessage])
                );
            } else {
                alert("Error al enviar mensaje");
            }
        } catch (e) {
            console.error("Error sending chat:", e);
            alert("Error de conexión");
        } finally {
            setSending(false);
        }
    };

    const handleClearChat = async () => {
        if (!confirm("¿Estás seguro de que deseas borrar toda la conversación e iniciar una nueva desde cero?")) {
            return;
        }

        try {
            const res = await fetch(`/api/entregas/${entregaId}/chat`, {
                method: "DELETE"
            });
            if (res.ok) {
                setMessages([]);
            } else {
                alert("Error al borrar la conversación");
            }
        } catch (e) {
            console.error("Error clearing chat:", e);
            alert("Error de conexión");
        }
    };

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
        }}>
            <div style={{
                width: "100%",
                maxWidth: "460px",
                height: "100%",
                background: "white",
                boxShadow: "-4px 0 15px rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column",
            }}>
                {/* Header */}
                <div style={{
                    padding: "1rem",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "var(--bg-secondary)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Brain size={18} style={{ color: "var(--primary)" }} />
                        <div>
                            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Asistente de Correcciones</h3>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{programaNombre}</span>
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {messages.length > 0 && (
                            <button
                                onClick={handleClearChat}
                                type="button"
                                title="Reiniciar chat (Borrar conversación)"
                                style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--danger)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: "4px"
                                }}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            type="button"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}
                        >
                            <XIcon size={20} />
                        </button>
                    </div>
                </div>

                {/* Messages Body */}
                <div style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    background: "var(--bg-secondary)",
                }}>
                    <div style={{
                        background: "white",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        padding: "0.75rem",
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.4,
                        marginBottom: "0.5rem"
                    }}>
                        👋 <strong>¡Hola!</strong> Soy tu asistente virtual de correcciones de SISAT-ATP. Puedes preguntarme dudas sobre cómo resolver las observaciones de tu <strong>{programaNombre}</strong>. Por ejemplo: <em>"¿Cómo redacto mejor mi meta del ámbito 1?"</em> o <em>"Dame ideas para justificar la subcategoría A"</em>.
                    </div>

                    {loading ? (
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100px", color: "var(--text-muted)" }}>
                            <Loader2 size={20} className="spin" />
                            <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem" }}>Cargando conversación...</span>
                        </div>
                    ) : (
                        messages.map(msg => {
                            const isUser = msg.role === "user";
                            return (
                                <div key={msg.id} style={{
                                    display: "flex",
                                    justifyContent: isUser ? "flex-end" : "flex-start",
                                    width: "100%",
                                }}>
                                    <div style={{
                                        maxWidth: "85%",
                                        padding: "0.625rem 0.875rem",
                                        borderRadius: "12px",
                                        borderTopRightRadius: isUser ? "2px" : "12px",
                                        borderTopLeftRadius: !isUser ? "2px" : "12px",
                                        background: isUser ? "var(--primary)" : "white",
                                        color: isUser ? "white" : "var(--text-primary)",
                                        fontSize: "0.8rem",
                                        lineHeight: 1.45,
                                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                        border: isUser ? "none" : "1px solid var(--border)",
                                    }}>
                                        {isUser ? (
                                            msg.content
                                        ) : (
                                            renderMarkdown(msg.content)
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Form Footer */}
                <form onSubmit={handleSend} style={{
                    padding: "0.75rem",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    gap: "0.5rem",
                    background: "white",
                }}>
                    <input
                        type="text"
                        placeholder="Escribe tu duda sobre las observaciones..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={sending}
                        style={{
                            flex: 1,
                            padding: "0.5rem 0.75rem",
                            borderRadius: "6px",
                            border: "1px solid var(--border)",
                            fontSize: "0.8rem",
                            outline: "none",
                        }}
                    />
                    <button
                        type="submit"
                        disabled={sending || !input.trim()}
                        style={{
                            background: "var(--primary)",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            padding: "0.5rem 0.75rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                    </button>
                </form>
            </div>
        </div>
    );
}
