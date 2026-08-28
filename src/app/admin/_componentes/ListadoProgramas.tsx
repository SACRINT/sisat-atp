"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, MessageSquare, Download, Eye, Loader2, FileCheck2, FilePlus2, Trash2, Upload, RefreshCw } from "lucide-react";
import JSZip from "jszip";
import { MESES, ESTADOS, ESTADO_LABELS, getNombrePeriodo } from "@/lib/constants";
import { ProgramaAdmin } from "@/types";
import { getDownloadUrl } from "@/lib/download-url";
import PdfViewerModal from "@/app/_componentes/PdfViewerModal";
import { mergePdfsAndDownload, MergeProgress } from "@/lib/merge-pdfs";

/** Nombre del programa que activa los botones de unificación */
const DIA_NARANJA_NOMBRE = "DÍA NARANJA";

/** Prefijo por defecto para los archivos unificados */
const DEFAULT_PREFIX = "CONCENTRADO_ZONAL";

interface ListadoProgramasProps {
    programas: ProgramaAdmin[];
    onSetMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
    onSetCorreccionModal: (modal: { entregaId: string; escuelaNombre: string; history?: any[]; preRevision?: any; archivos?: any[] } | null) => void;
    readOnly?: boolean;
}

function getEstadoStyles(estado: string) {
    switch (estado) {
        case "APROBADO":
            return { color: "var(--success)", background: "var(--success-bg)", borderColor: "#bbf7d0" };
        case "PENDIENTE":
            return { color: "var(--warning)", background: "var(--warning-bg)", borderColor: "#fef08a" };
        case "REQUIERE_CORRECCION":
            return { color: "#e67e22", background: "#fff7ed", borderColor: "#ffedd5" };
        case "EN_REVISION":
            return { color: "var(--primary)", background: "var(--primary-bg)", borderColor: "#bfdbfe" };
        case "NO_APROBADO":
            return { color: "var(--danger)", background: "var(--danger-bg)", borderColor: "#fecaca" };
        case "NO_ENTREGADO":
        default:
            return { color: "var(--text-secondary)", background: "#f1f5f9", borderColor: "#cbd5e1" };
    }
}

export default function ListadoProgramas({ programas, onSetMessage, onSetCorreccionModal, readOnly = false }: ListadoProgramasProps) {
    const router = useRouter();
    const [expanded, setExpanded]               = useState<string | null>(null);
    const [expandedPeriodo, setExpandedPeriodo] = useState<string | null>(null);
    const [updatingEstado, setUpdatingEstado]   = useState<string | null>(null);
    const [downloadingZip, setDownloadingZip]   = useState<string | null>(null);
    const [viewingPdf, setViewingPdf]           = useState<{ url: string; title: string; downloadUrl?: string; fileName?: string } | null>(null);
    const [reEvaluatingId, setReEvaluatingId]   = useState<string | null>(null);

    async function handleReEvaluate(entregaId: string) {
        setReEvaluatingId(entregaId);
        onSetMessage(null);
        try {
            // 1. Obtener información de páginas
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
                    const extractRes = await fetch(
                        `/api/entregas/${entregaId}/pre-revision?action=extract&start=${start}&end=${end}`
                    );
                    if (!extractRes.ok) throw new Error(`Error al extraer texto de páginas ${start}-${end}`);
                    const extractData = await extractRes.json();
                    textoCompleto += (extractData.text || "") + "\n";
                }
            }

            // 2. Ejecutar POST
            const res = await fetch(`/api/entregas/${entregaId}/pre-revision`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ textoCompleto })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Error al re-evaluar la entrega");
            }

            onSetMessage({ type: "success", text: "✅ Pre-evaluación completada con éxito." });
            router.refresh();
        } catch (err: any) {
            console.error(err);
            onSetMessage({ type: "error", text: err.message || "Error al conectar con el servidor" });
        } finally {
            setReEvaluatingId(null);
        }
    }

    // ── Estado para la unificación de PDFs (Día Naranja) ──
    const [mergePrefix, setMergePrefix]           = useState(DEFAULT_PREFIX);
    const [mergingType, setMergingType]           = useState<"REGISTRO" | "EVIDENCIAS" | null>(null);
    const [mergeProgress, setMergeProgress]       = useState<MergeProgress | null>(null);
    const [showPrefixInput, setShowPrefixInput]   = useState(false);

    // ── Estado para la subida/eliminación administrativa de archivos ──
    const [deleting, setDeleting] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);
    const [selectedEntrega, setSelectedEntrega] = useState<string | null>(null);
    const [selectedEtiqueta, setSelectedEtiqueta] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function handleDeleteFile(archivoId: string) {
        if (!confirm("¿Estás seguro de eliminar este archivo?")) return;
        setDeleting(archivoId);
        onSetMessage(null);

        try {
            const res = await fetch(`/api/archivos/${archivoId}`, { method: "DELETE" });
            if (res.ok) {
                onSetMessage({ type: "success", text: "✅ Archivo de entrega eliminado." });
                router.refresh();
            } else {
                const data = await res.json();
                onSetMessage({ type: "error", text: data.error || "Error al eliminar el archivo." });
            }
        } catch {
            onSetMessage({ type: "error", text: "Error de conexión." });
        } finally {
            setDeleting(null);
        }
    }

    const [updatingPeriodo, setUpdatingPeriodo] = useState<string | null>(null);

    async function handleBulkEstadoPeriodo(periodoId: string, nuevoEstado: string, nombrePeriodo: string) {
        if (!confirm(`¿Estás seguro de marcar TODAS las escuelas en "${nombrePeriodo}" como "${ESTADO_LABELS[nuevoEstado] || nuevoEstado}"?`)) return;
        setUpdatingPeriodo(periodoId);
        try {
            const res = await fetch(`/api/periodos/${periodoId}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: nuevoEstado }),
            });
            if (res.ok) {
                onSetMessage({ type: "success", text: `✅ Entregas de ${nombrePeriodo} actualizadas.` });
                router.refresh();
            } else {
                const data = await res.json();
                onSetMessage({ type: "error", text: data.error || "Error" });
            }
        } catch {
            onSetMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setUpdatingPeriodo(null);
        }
    }

    function handleUploadClick(entregaId: string, etiqueta?: string) {
        setSelectedEntrega(entregaId);
        setSelectedEtiqueta(etiqueta || null);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }

    async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !selectedEntrega) return;

        const uploadKey = selectedEntrega + (selectedEtiqueta || "");
        setUploading(uploadKey);
        onSetMessage(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("entregaId", selectedEntrega);
            if (selectedEtiqueta) {
                formData.append("etiqueta", selectedEtiqueta);
            }

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                onSetMessage({ type: "success", text: `✅ "${file.name}" subido en representación de la escuela.` });
                router.refresh();
            } else {
                const errData = await res.json();
                onSetMessage({ type: "error", text: errData.error || "Error al subir el archivo." });
            }
        } catch (error: any) {
            onSetMessage({ type: "error", text: error.message || "Error al conectar con el servidor." });
        } finally {
            setUploading(null);
            setSelectedEntrega(null);
            setSelectedEtiqueta(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleDownloadZip(prog: ProgramaAdmin) {
        setDownloadingZip(prog.id);
        onSetMessage({ type: "success", text: "Preparando descarga masiva, por favor espera..." });
        try {
            const zip = new JSZip();
            let fileCount = 0;

            for (const p of prog.periodos.filter(per => per.activo)) {
                const periodLabel = getPeriodoLabel(p, prog.nombre).replace(/[/\\?%*:|"<>]/g, '-');
                for (const ent of p.entregas) {
                    if (ent.archivos && ent.archivos.length > 0) {
                        const cct = ent.escuela.cct;
                        for (let i = 0; i < ent.archivos.length; i++) {
                            const arch = ent.archivos[i];
                            if (arch.driveUrl) {
                                try {
                                    const downloadUrl = getDownloadUrl(arch.driveUrl, arch.nombre, arch.driveId) || arch.driveUrl;
                                    const response = await fetch(downloadUrl);
                                    if (!response.ok) throw new Error("HTTP error");
                                    const blob = await response.blob();
                                    const ext = arch.nombre.split('.').pop() || 'pdf';
                                    const etiquetaLimpia = (arch.etiqueta || `Archivo_${i + 1}`).replace(/[/\\?%*:|"<>]/g, '-');
                                    const fileName = `${cct}_${etiquetaLimpia}.${ext}`;
                                    zip.file(`${periodLabel}/${fileName}`, blob);
                                    fileCount++;
                                } catch (e) {
                                    console.error(`Error descargando ${arch.nombre}`, e);
                                }
                            }
                        }
                    }
                }
            }

            if (fileCount === 0) throw new Error("No se encontraron archivos válidos para descargar.");

            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${prog.nombre.replace(/[/\\?%*:|"<>]/g, '-')}.zip`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 0);
            onSetMessage({ type: "success", text: "Descarga completada." });
        } catch (e: any) {
            onSetMessage({ type: "error", text: e.message });
        } finally {
            setDownloadingZip(null);
        }
    }

    /**
     * Une todos los PDFs de un tipo (Registro / Evidencias) de todas las escuelas
     * que subieron ese documento, ordenadas alfabéticamente por CCT.
     *
     * Solo para el programa DÍA NARANJA.
     */
    async function handleMergePdfs(prog: ProgramaAdmin, tipo: "REGISTRO" | "EVIDENCIAS") {
        if (mergingType) return; // ya hay una en curso

        // Recopilar todos los archivos del tipo solicitado, de todos los periodos activos.
        // Mapear por CCT para evitar duplicados y luego ordenar alfabéticamente.
        const porCct = new Map<string, { cct: string; proxyUrl: string; etiqueta: string }>();

        for (const p of prog.periodos.filter(per => per.activo)) {
            for (const ent of p.entregas) {
                if (!ent.archivos || ent.archivos.length === 0) continue;
                const cct = ent.escuela.cct;
                for (const arch of ent.archivos) {
                    if (!arch.driveUrl) continue;
                    // Detectar el tipo por etiqueta (insensible a mayúsculas/minúsculas)
                    const etiq = (arch.etiqueta || "").toLowerCase();
                    const esRegistro   = etiq.includes("registro");
                    const esEvidencias = etiq.includes("evidencia");
                    if (tipo === "REGISTRO"    && !esRegistro)   continue;
                    if (tipo === "EVIDENCIAS"  && !esEvidencias) continue;
                    // Solo PDFs
                    if (!arch.nombre.toLowerCase().endsWith(".pdf")) continue;

                    // Tomar solo uno por escuela (el primero que coincida)
                    if (!porCct.has(cct)) {
                        const proxyUrl = getDownloadUrl(arch.driveUrl, arch.nombre, arch.driveId) || arch.driveUrl;
                        // Agregar inline=1 para que el proxy sirva con Content-Disposition: inline
                        const inlineUrl = proxyUrl.includes("?")
                            ? `${proxyUrl}&inline=1`
                            : `${proxyUrl}?inline=1`;
                        porCct.set(cct, { cct, proxyUrl: inlineUrl, etiqueta: arch.etiqueta || tipo });
                    }
                }
            }
        }

        // Ordenar por CCT alfabéticamente
        const items = [...porCct.values()].sort((a, b) => a.cct.localeCompare(b.cct));

        if (items.length === 0) {
            onSetMessage({ type: "error", text: `No se encontraron PDFs de "${tipo}" subidos por los bachilleratos.` });
            return;
        }

        const tipoLabel = tipo === "REGISTRO" ? "REGISTROS" : "EVIDENCIAS";
        const fileName  = `${mergePrefix.toUpperCase()}_${tipoLabel}.PDF`;

        setMergingType(tipo);
        setMergeProgress({ total: items.length, done: 0, failed: 0, failedCcts: [], stage: "downloading" });
        onSetMessage({ type: "success", text: `Unificando ${items.length} PDF${items.length > 1 ? "s" : ""} de ${tipoLabel}...` });

        try {
            const { mergedCount } = await mergePdfsAndDownload(
                items,
                fileName,
                (p) => setMergeProgress(p)
            );
            onSetMessage({
                type: "success",
                text: `✅ ${fileName} listo: ${mergedCount} bachillerato${mergedCount > 1 ? "s" : ""} unidos en orden de CCT.`,
            });
        } catch (e: any) {
            // merge-pdfs lanza un Error detallado con los CCTs que fallaron
            onSetMessage({ type: "error", text: `❌ ${e.message || "Error al unificar los PDFs."}` });
        } finally {
            setMergingType(null);
            setMergeProgress(null);
        }
    }

    async function handleEstadoChange(entregaId: string, nuevoEstado: string) {
        setUpdatingEstado(entregaId);
        try {
            const res = await fetch(`/api/entregas/${entregaId}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: nuevoEstado }),
            });
            if (res.ok) {
                router.refresh();
            } else {
                const data = await res.json();
                onSetMessage({ type: "error", text: data.error || "Error" });
            }
        } catch {
            onSetMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setUpdatingEstado(null);
        }
    }

    function getPeriodoLabel(periodo: { mes: number | null; semestre: number | null }, programaNombre?: string | null): string {
        return getNombrePeriodo(periodo, programaNombre);
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={handleFileSelected}
            />
            {programas.map((prog) => {
                const allEntregas = prog.periodos.flatMap((p) => p.entregas);
                const statEntregas = allEntregas.filter(e => !e.escuela.esDePrueba && !e.escuela.esSupervision);
                const entregasRequeridas = statEntregas.filter((e) => e.estado !== "EXENTO");
                const totalProg = entregasRequeridas.length;
                const entregadosProg = statEntregas.filter(e => ["APROBADO", "ENTREGADO_FISICO", "EN_REVISION", "REQUIERE_CORRECCION"].includes(e.estado)).length;
                const aprobadasProg = entregasRequeridas.filter((e) => ["APROBADO", "ENTREGADO_FISICO"].includes(e.estado)).length;
                const porc = totalProg > 0 ? Math.round((aprobadasProg / totalProg) * 100) : 100;
                const isExpanded = expanded === prog.id;

                let progressColor = "var(--danger)";
                let cardBgGradient = "linear-gradient(to right, var(--danger-bg) 0%, var(--surface) 150px)";
                if (porc === 100) {
                    progressColor = "var(--success)";
                    cardBgGradient = "linear-gradient(to right, var(--success-bg) 0%, var(--surface) 150px)";
                } else if (porc > 0) {
                    progressColor = "var(--primary)";
                    cardBgGradient = "linear-gradient(to right, var(--primary-bg) 0%, var(--surface) 150px)";
                }

                // ¿Es DÍA NARANJA?
                const isDiaNaranja = prog.nombre.toUpperCase().includes(DIA_NARANJA_NOMBRE);

                return (
                    <div key={prog.id} className="card" style={{ padding: 0, borderLeft: `5px solid ${progressColor}`, background: cardBgGradient }}>
                        {/* ── Cabecera del programa ── */}
                        <button
                            onClick={() => setExpanded(isExpanded ? null : prog.id)}
                            style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "1rem", textAlign: "left" }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{prog.nombre}</div>
                                    <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                                        {entregadosProg}/{totalProg} recibidas • {prog.periodos.filter((p) => p.activo).length} activo(s) / {prog.periodos.length} periodo(s)
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span style={{ fontWeight: 700, color: progressColor }}>{porc}%</span>

                                    {/* ── Botones de unificación PDF (solo Día Naranja) ── */}
                                    {isDiaNaranja && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }} onClick={(e) => e.stopPropagation()}>
                                            {/* Botón Registros */}
                                            <button
                                                onClick={() => handleMergePdfs(prog, "REGISTRO")}
                                                disabled={mergingType !== null}
                                                title="Unificar todos los PDFs de Registro en un solo archivo (ordenados por CCT)"
                                                style={{
                                                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                                    background: mergingType === "REGISTRO" ? "var(--primary-bg)" : "white",
                                                    border: "1px solid var(--primary)", borderRadius: "5px",
                                                    color: "var(--primary)", padding: "0.2rem 0.45rem",
                                                    fontSize: "0.7rem", fontWeight: 700, cursor: mergingType ? "not-allowed" : "pointer",
                                                    opacity: mergingType && mergingType !== "REGISTRO" ? 0.45 : 1,
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {mergingType === "REGISTRO"
                                                    ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Descargando...</>
                                                    : <><FileCheck2 size={11} /> Unificar Registros</>
                                                }
                                            </button>

                                            {/* Botón Evidencias */}
                                            <button
                                                onClick={() => handleMergePdfs(prog, "EVIDENCIAS")}
                                                disabled={mergingType !== null}
                                                title="Unificar todos los PDFs de Evidencias en un solo archivo (ordenados por CCT)"
                                                style={{
                                                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                                    background: mergingType === "EVIDENCIAS" ? "var(--primary-bg)" : "white",
                                                    border: "1px solid #059669", borderRadius: "5px",
                                                    color: "#059669", padding: "0.2rem 0.45rem",
                                                    fontSize: "0.7rem", fontWeight: 700, cursor: mergingType ? "not-allowed" : "pointer",
                                                    opacity: mergingType && mergingType !== "EVIDENCIAS" ? 0.45 : 1,
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {mergingType === "EVIDENCIAS"
                                                    ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Descargando...</>
                                                    : <><FilePlus2 size={11} /> Unificar Evidencias</>
                                                }
                                            </button>

                                            {/* Engranaje para editar prefijo */}
                                            <button
                                                onClick={() => setShowPrefixInput(v => !v)}
                                                title="Cambiar prefijo del nombre del archivo"
                                                style={{
                                                    background: "none", border: "1px solid var(--border)", borderRadius: "5px",
                                                    color: "var(--text-muted)", padding: "0.2rem 0.3rem",
                                                    cursor: "pointer", fontSize: "0.7rem", display: "inline-flex", alignItems: "center",
                                                }}
                                            >
                                                ✎
                                            </button>
                                        </div>
                                    )}

                                    {/* ZIP download (todos los programas) */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDownloadZip(prog); }}
                                        disabled={downloadingZip === prog.id}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "0.25rem", display: "flex", alignItems: "center", opacity: downloadingZip === prog.id ? 0.5 : 1 }}
                                        title="Descargar todos los archivos en formato ZIP"
                                    >
                                        <Download size={18} />
                                    </button>
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                            </div>

                            {/* ── Editor de prefijo (solo Día Naranja, inline) ── */}
                            {isDiaNaranja && showPrefixInput && (
                                <div
                                    style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Prefijo:</span>
                                    <input
                                        type="text"
                                        value={mergePrefix}
                                        onChange={(e) => setMergePrefix(e.target.value.toUpperCase())}
                                        placeholder="CONCENTRADO_ZONAL"
                                        style={{
                                            fontSize: "0.75rem", padding: "0.15rem 0.4rem",
                                            border: "1px solid var(--border)", borderRadius: "4px",
                                            background: "white", color: "var(--text)",
                                            textTransform: "uppercase", fontFamily: "monospace", letterSpacing: "0.05em",
                                            width: "180px",
                                        }}
                                    />
                                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                        → <strong>{mergePrefix.toUpperCase() || "PREFIX"}_REGISTROS.PDF</strong>
                                    </span>
                                </div>
                            )}

                            {/* ── Barra de progreso del merge ── */}
                            {isDiaNaranja && mergeProgress && (
                                <div
                                    style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div style={{ flex: 1, height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                                        <div style={{
                                            height: "100%", background: "var(--primary)", borderRadius: "2px",
                                            width: mergeProgress.total > 0
                                                ? `${Math.round(((mergeProgress.done + mergeProgress.failed) / mergeProgress.total) * 100)}%`
                                                : "0%",
                                            transition: "width 0.3s ease",
                                        }} />
                                    </div>
                                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                        {mergeProgress.stage === "merging"
                                            ? "Uniendo PDFs..."
                                            : `${mergeProgress.done + mergeProgress.failed} / ${mergeProgress.total}`
                                        }
                                        {mergeProgress.failed > 0 && ` (${mergeProgress.failed} omitidos)`}
                                    </span>
                                </div>
                            )}

                            <div className="progress-bar" style={{ marginTop: "0.5rem", height: "6px" }}>
                                <div className="progress-fill" style={{ width: `${porc}%`, background: progressColor }} />
                            </div>
                        </button>

                        {/* ── Detalle expandido ── */}
                        {isExpanded && (
                            <div style={{ borderTop: "1px solid var(--border)" }}>
                                {[...prog.periodos].sort((a, b) => {
                                    const SEP_MONTH_ORDER = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
                                    const getSepMonthOrder = (m: number | null) => m ? (SEP_MONTH_ORDER.indexOf(m) === -1 ? 99 : SEP_MONTH_ORDER.indexOf(m)) : 99;
                                    const orderA = getSepMonthOrder(a.mes);
                                    const orderB = getSepMonthOrder(b.mes);
                                    if (orderA !== orderB) return orderA - orderB;
                                    return (a.semestre ?? 99) - (b.semestre ?? 99);
                                }).map((periodo) => (
                                    <div key={periodo.id}>
                                        {prog.tipo !== "ANUAL" && (() => {
                                            const statPerEntregas = periodo.entregas.filter(e => !e.escuela.esDePrueba && !e.escuela.esSupervision);
                                            return (
                                                <div
                                                    style={{ padding: "0.5rem 1rem", background: periodo.activo ? "var(--bg-secondary)" : "#f8f8f8", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}
                                                    onClick={() => setExpandedPeriodo(expandedPeriodo === periodo.id ? null : periodo.id)}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                        {getPeriodoLabel(periodo, prog.nombre)} ({statPerEntregas.filter((e) => e.estado !== "NO_ENTREGADO").length}/{statPerEntregas.length} recibidas)
                                                        {!periodo.activo && (
                                                            <span style={{ fontSize: "0.7rem", background: "#e2e8f0", color: "#64748b", padding: "0.1rem 0.4rem", borderRadius: "4px", fontWeight: 500 }}>Inactivo</span>
                                                        )}
                                                    </div>
                                                    {!readOnly && (
                                                        <div style={{ display: "flex", gap: "0.5rem" }}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleBulkEstadoPeriodo(periodo.id, "EXENTO", getPeriodoLabel(periodo, prog.nombre)); }}
                                                                disabled={updatingPeriodo === periodo.id}
                                                                style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem", borderRadius: "4px", background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}
                                                                title="Marcar mes como No Aplica para todas las escuelas"
                                                            >
                                                                {updatingPeriodo === periodo.id ? <Loader2 size={10} className="spin" /> : <span>🚫</span>}
                                                                Marcar "No Aplica"
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {(prog.tipo === "ANUAL" || expandedPeriodo === periodo.id) && (
                                            <div style={{ padding: "0 1rem 0.5rem" }}>
                                                {[...periodo.entregas].sort((a, b) => {
                                                    if (a.escuela.esDePrueba && !b.escuela.esDePrueba) return 1;
                                                    if (!a.escuela.esDePrueba && b.escuela.esDePrueba) return -1;
                                                    return a.escuela.nombre.localeCompare(b.escuela.nombre);
                                                }).map((ent) => {
                                                    const styles = getEstadoStyles(ent.estado);
                                                    return (
                                                        <div key={ent.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)", gap: "0.5rem", flexWrap: "wrap" }}>
                                                            <div style={{ fontSize: "0.875rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                                <div style={{ fontWeight: 500 }}>{ent.escuela.nombre}</div>
                                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                                    <span>{ent.escuela.cct}</span>
                                                                    {(ent as any).preRevision && (
                                                                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                                                            <span style={{
                                                                                fontSize: "0.68rem",
                                                                                padding: "0.05rem 0.3rem",
                                                                                borderRadius: "4px",
                                                                                fontWeight: 700,
                                                                                background: (() => {
                                                                                    const r = (ent as any).preRevision.resultado;
                                                                                    if (!r || !r.tipo) return '#f8fafc';
                                                                                    const isAiType = r.tipo === 'PMC' || r.tipo === 'PAEC' || r.tipo === 'INFORME_FINAL';
                                                                                    const isError = isAiType && !r.borradorCorreo;
                                                                                    return (r.tieneIncidencias || r.aprobado === false || isError) ? '#fdf2f2' : '#f0fdf4';
                                                                                })(),
                                                                                color: (() => {
                                                                                    const r = (ent as any).preRevision.resultado;
                                                                                    if (!r || !r.tipo) return '#64748b';
                                                                                    const isAiType = r.tipo === 'PMC' || r.tipo === 'PAEC' || r.tipo === 'INFORME_FINAL';
                                                                                    const isError = isAiType && !r.borradorCorreo;
                                                                                    return (r.tieneIncidencias || r.aprobado === false || isError) ? '#dc2626' : '#16a34a';
                                                                                })(),
                                                                                border: (() => {
                                                                                    const r = (ent as any).preRevision.resultado;
                                                                                    if (!r || !r.tipo) return '1px solid #cbd5e1';
                                                                                    const isAiType = r.tipo === 'PMC' || r.tipo === 'PAEC' || r.tipo === 'INFORME_FINAL';
                                                                                    const isError = isAiType && !r.borradorCorreo;
                                                                                    return `1px solid ${(r.tieneIncidencias || r.aprobado === false || isError) ? '#f87171' : '#86efac'}`;
                                                                                })()
                                                                            }}>
                                                                                🔍 Pre-dictamen: {
                                                                                    (() => {
                                                                                        const r = (ent as any).preRevision.resultado;
                                                                                        if (!r || !r.tipo) return 'Pendiente';
                                                                                        const isAiType = r.tipo === 'PMC' || r.tipo === 'PAEC' || r.tipo === 'INFORME_FINAL' || r.tipo === 'PIPS';
                                                                                        if (isAiType && !r.borradorCorreo) return '⚠️ Error (Re-evaluar)';
                                                                                        if (r.tieneIncidencias) return '⚠️ Con Incidencias';
                                                                                        if (r.aprobado === false) return '⚠️ Firma/Sello Faltante';
                                                                                        return '✓ Correcto';
                                                                                    })()
                                                                                }
                                                                            </span>
                                                                            {!readOnly && (
                                                                                <button
                                                                                    onClick={(e) => { e.preventDefault(); handleReEvaluate(ent.id); }}
                                                                                    disabled={reEvaluatingId === ent.id}
                                                                                    style={{
                                                                                        background: "white", border: "1px solid var(--border)", borderRadius: "4px",
                                                                                        padding: "2px 4px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                                                        cursor: reEvaluatingId === ent.id ? "not-allowed" : "pointer", color: "var(--primary)"
                                                                                    }}
                                                                                    title="Re-evaluar esta entrega individualmente"
                                                                                >
                                                                                    {reEvaluatingId === ent.id ? (
                                                                                        <Loader2 size={10} className="spin" />
                                                                                    ) : (
                                                                                        <RefreshCw size={10} />
                                                                                    )}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {ent.archivos.length > 0 && (
                                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                                                                        {ent.archivos.map((arch, index) => {
                                                                            const fileUrl = getDownloadUrl(arch.driveUrl, arch.nombre, arch.driveId);
                                                                            const label = arch.etiqueta || `Archivo ${index + 1}`;
                                                                            return (
                                                                                <span key={arch.id} style={{ display: "inline-flex", alignItems: "center", gap: "0.15rem" }}>
                                                                                    {/* Eye: opens viewer */}
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            if (fileUrl) {
                                                                                                setViewingPdf({
                                                                                                    url: arch.driveUrl || "",
                                                                                                    title: `${ent.escuela.cct} — ${prog.nombre} — ${label}`,
                                                                                                    downloadUrl: fileUrl,
                                                                                                    fileName: arch.nombre,
                                                                                                });
                                                                                            }
                                                                                        }}
                                                                                        style={{ background: "none", border: "1px solid var(--border)", borderRadius: "4px 0 0 4px", cursor: "pointer", padding: "0.15rem 0.35rem", color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: "0.2rem", fontSize: "0.75rem" }}
                                                                                        title={`Ver ${arch.nombre}`}
                                                                                    >
                                                                                        <Eye size={12} /> {label}
                                                                                    </button>
                                                                                    {/* Download */}
                                                                                    <a
                                                                                        href={fileUrl || "#"}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        style={{ 
                                                                                            background: "none", 
                                                                                            border: "1px solid var(--border)", 
                                                                                            borderLeft: "none", 
                                                                                            borderRadius: ent.estado !== "APROBADO" ? "0" : "0 4px 4px 0", 
                                                                                            padding: "0.15rem 0.35rem", 
                                                                                            color: "var(--text-secondary)", 
                                                                                            display: "inline-flex", 
                                                                                            alignItems: "center" 
                                                                                        }}
                                                                                        title={`Descargar ${arch.nombre}`}
                                                                                    >
                                                                                        <Download size={12} />
                                                                                    </a>
                                                                                    {/* Delete */}
                                                                                    {ent.estado !== "APROBADO" && !readOnly && (
                                                                                        <button
                                                                                            onClick={() => handleDeleteFile(arch.id)}
                                                                                            disabled={deleting === arch.id}
                                                                                            style={{
                                                                                                background: "none",
                                                                                                border: "1px solid var(--border)",
                                                                                                borderLeft: "none",
                                                                                                borderRadius: "0 4px 4px 0",
                                                                                                padding: "0.15rem 0.35rem",
                                                                                                color: "var(--danger)",
                                                                                                display: "inline-flex",
                                                                                                alignItems: "center",
                                                                                                cursor: "pointer"
                                                                                            }}
                                                                                            title="Eliminar archivo"
                                                                                        >
                                                                                            {deleting === arch.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                                                                                        </button>
                                                                                    )}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "flex", alignItems: "center" }}>
                                                                            • Subido: {new Date(ent.archivos[0].createdAt!).toLocaleDateString("es-MX")}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {/* Administrative Upload Buttons */}
                                                                {ent.estado !== "APROBADO" && !readOnly && (
                                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.35rem" }}>
                                                                        {Array.from({ length: prog.numArchivos || 1 }).map((_, i) => {
                                                                            const etiquetas = prog.etiquetasArchivos || [];
                                                                            const defaultLabel = etiquetas[i] && etiquetas[i].trim() !== "" ? etiquetas[i] : `Archivo ${i + 1}`;
                                                                            const displayLabel = (prog.numArchivos || 1) === 1 ? "" : defaultLabel;
                                                                            const hasFileAlready = displayLabel !== ""
                                                                                ? ent.archivos.some(a => a.etiqueta === displayLabel)
                                                                                : ent.archivos.length > 0;

                                                                            if (hasFileAlready) return null;

                                                                            const uploadKey = ent.id + displayLabel;

                                                                            return (
                                                                                <button
                                                                                    key={i}
                                                                                    onClick={() => handleUploadClick(ent.id, displayLabel || undefined)}
                                                                                    disabled={uploading === uploadKey}
                                                                                    style={{
                                                                                        padding: "0.15rem 0.4rem",
                                                                                        fontSize: "0.7rem",
                                                                                        borderRadius: "4px",
                                                                                        background: "var(--bg-secondary)",
                                                                                        border: "1px dashed var(--border)",
                                                                                        color: "var(--text-secondary)",
                                                                                        cursor: "pointer",
                                                                                        display: "inline-flex",
                                                                                        alignItems: "center",
                                                                                        gap: "0.25rem",
                                                                                        transition: "all 0.15s ease",
                                                                                    }}
                                                                                    title={`Subir ${defaultLabel}`}
                                                                                >
                                                                                    {uploading === uploadKey ? (
                                                                                        <Loader2 size={10} className="spin" />
                                                                                    ) : (
                                                                                        <Upload size={10} />
                                                                                    )}
                                                                                    <span>Subir {defaultLabel}</span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                                {ent.estado === "APROBADO" && ent.cvd && (
                                                                    <a 
                                                                        href={`/validar-documento?cvd=${ent.cvd}`} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer" 
                                                                        style={{ 
                                                                            fontSize: "0.68rem", 
                                                                            background: "#f0fdf4", 
                                                                            border: "1px solid #86efac", 
                                                                            color: "#16a34a", 
                                                                            padding: "0.15rem 0.35rem", 
                                                                            borderRadius: "4px", 
                                                                            textDecoration: "none", 
                                                                            fontFamily: "monospace",
                                                                            fontWeight: 700 
                                                                        }}
                                                                        title="Verificar firma digital del dictamen"
                                                                    >
                                                                        🛡️ {ent.cvd}
                                                                    </a>
                                                                )}
                                                                <select
                                                                    value={ent.estado}
                                                                    onChange={(e) => handleEstadoChange(ent.id, e.target.value)}
                                                                    disabled={updatingEstado === ent.id || readOnly}
                                                                    style={{
                                                                        padding: "0.25rem 0.5rem", borderRadius: "6px",
                                                                        border: `1px solid ${styles.borderColor}`, background: styles.background,
                                                                        color: styles.color, fontWeight: 600, fontSize: "0.75rem", cursor: "pointer",
                                                                        outline: "none", transition: "all 0.2s ease",
                                                                    }}
                                                                >
                                                                    {ESTADOS.map((e) => (
                                                                        <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
                                                                    ))}
                                                                </select>
                                                                <button
                                                                    onClick={() => onSetCorreccionModal({ entregaId: ent.id, escuelaNombre: ent.escuela.nombre, history: ent.correcciones, preRevision: (ent as any).preRevision, archivos: ent.archivos })}
                                                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#e67e22", padding: "0.25rem" }}
                                                                    title="Enviar corrección / Ver historial"
                                                                >
                                                                    <MessageSquare size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
            <PdfViewerModal
                isOpen={!!viewingPdf}
                onClose={() => setViewingPdf(null)}
                url={viewingPdf?.url || ""}
                title={viewingPdf?.title || ""}
                downloadUrl={viewingPdf?.downloadUrl}
                fileName={viewingPdf?.fileName}
            />
        </div>
    );
}
