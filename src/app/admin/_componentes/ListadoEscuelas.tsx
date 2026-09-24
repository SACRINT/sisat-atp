"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Search, FileText, ChevronUp, ChevronDown, MessageSquare, Download, Mail, Eye, Upload, Trash2, Loader2, RefreshCw } from "lucide-react";
import { MESES, ESTADOS, ESTADO_LABELS, getNombrePeriodo } from "@/lib/constants";
import { EscuelaAdmin } from "@/types";
import { getEntregaDownloadUrl } from "@/lib/download-url";
import PdfViewerModal from "@/app/_componentes/PdfViewerModal";

interface ListadoEscuelasProps {
    escuelas: EscuelaAdmin[];
    onSetMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
    onSetCorreccionModal: (modal: { entregaId: string; escuelaNombre: string; history?: any[]; preRevision?: any; archivos?: any[] } | null) => void;
    readOnly?: boolean;
}

function getEstadoStyles(estado: string) {
    switch (estado) {
        case "APROBADO":
            return {
                color: "var(--success)",
                background: "var(--success-bg)",
                borderColor: "#bbf7d0"
            };
        case "PENDIENTE":
            return {
                color: "var(--warning)",
                background: "var(--warning-bg)",
                borderColor: "#fef08a"
            };
        case "REQUIERE_CORRECCION":
            return {
                color: "#e67e22",
                background: "#fff7ed",
                borderColor: "#ffedd5"
            };
        case "EN_REVISION":
            return {
                color: "var(--primary)",
                background: "var(--primary-bg)",
                borderColor: "#bfdbfe"
            };
        case "NO_APROBADO":
            return {
                color: "var(--danger)",
                background: "var(--danger-bg)",
                borderColor: "#fecaca"
            };
        case "NO_ENTREGADO":
        default:
            return {
                color: "var(--text-secondary)",
                background: "#f1f5f9",
                borderColor: "#cbd5e1"
            };
    }
}

export default function ListadoEscuelas({ escuelas, onSetMessage, onSetCorreccionModal, readOnly = false }: ListadoEscuelasProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("TODOS");
    const [expanded, setExpanded] = useState<string | null>(null);
    const [updatingEstado, setUpdatingEstado] = useState<string | null>(null);
    const [sendingReminder, setSendingReminder] = useState<string | null>(null);
    const [viewingPdf, setViewingPdf] = useState<{ url: string; title: string; downloadUrl?: string; fileName?: string } | null>(null);
    const [reEvaluatingId, setReEvaluatingId] = useState<string | null>(null);

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

    // Estados para subida/eliminación directa (Propuesta 8)
    const [uploading, setUploading] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
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

    function handleUploadClick(e: React.MouseEvent, entregaId: string, etiqueta?: string) {
        e.stopPropagation();
        e.preventDefault();
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
            // 0. Validación de tamaño (máximo 25 MB) y tipo de archivo
            if (file.size > 25 * 1024 * 1024) {
                throw new Error(`"${file.name}" es muy grande. Máximo 25 MB.`);
            }
            const allowedTypes = [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-powerpoint",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "image/jpeg",
                "image/png",
            ];
            if (!allowedTypes.includes(file.type)) {
                throw new Error(`"${file.name}" no es un tipo permitido. Use PDF, Word, Excel, PowerPoint o imagen.`);
            }

            // 1. Obtener firma Cloudinary
            const signRes = await fetch("/api/sign-cloudinary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entregaId: selectedEntrega,
                    originalFilename: file.name,
                    etiqueta: selectedEtiqueta,
                }),
            });

            if (!signRes.ok) {
                const errData = await signRes.json().catch(() => ({}));
                throw new Error(errData.error || "No se pudo iniciar la subida");
            }

            const { signature, timestamp, folder, publicId, apiKey, cloudName } = await signRes.json();

            // 2. Subida directa a Cloudinary (bypassa el límite de 4.5MB de Vercel)
            const formData = new FormData();
            formData.append("file", file);
            formData.append("api_key", apiKey);
            formData.append("timestamp", timestamp.toString());
            formData.append("signature", signature);
            formData.append("folder", folder);
            if (publicId) formData.append("public_id", publicId);

            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                method: "POST",
                body: formData,
            });

            if (!uploadRes.ok) {
                const errData = await uploadRes.json().catch(() => ({}));
                throw new Error(errData.error?.message || "Error al subir a la nube");
            }

            const uploadData = await uploadRes.json();

            // 3. Confirmar en base de datos
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
                        publicId: uploadData.public_id,
                    },
                }),
            });

            if (confirmRes.ok) {
                onSetMessage({ type: "success", text: `✅ "${file.name}" subido en representación de la escuela.` });
                router.refresh();
            } else {
                const errData = await confirmRes.json().catch(() => ({}));
                onSetMessage({ type: "error", text: errData.error || "Error al guardar el archivo." });
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

    async function handleSendReminder(entregaId: string, escuelaNombre: string) {
        if (!confirm(`¿Seguro que deseas enviar un recordatorio por correo a ${escuelaNombre} para esta entrega?`)) return;
        setSendingReminder(entregaId);
        try {
            const res = await fetch(`/api/recordatorios/individual`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entregaId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al enviar");
            onSetMessage({ type: "success", text: data.message });
        } catch (e: any) {
            onSetMessage({ type: "error", text: e.message });
        } finally {
            setSendingReminder(null);
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

    const exportEscuelaPDF = (esc: EscuelaAdmin) => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text("Acuse de Recepción SISAT", 14, 20);

            doc.setFontSize(11);
            doc.text(`CCT: ${esc.cct}`, 14, 30);
            doc.text(`Escuela: ${esc.nombre}`, 14, 36);
            doc.text(`Director: ${esc.director || "No especificado"}`, 14, 42);
            doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString("es-MX")}`, 14, 48);

            const tableData = esc.entregas.map(ent => {
                const progName = ent.periodoEntrega?.programa?.nombre || "N/A";
                let perName = "Anual";
                if (ent.periodoEntrega?.mes) perName = MESES[ent.periodoEntrega.mes];
                else if (ent.periodoEntrega?.semestre) perName = `Semestre ${ent.periodoEntrega.semestre}`;

                return [
                    progName,
                    perName,
                    ESTADO_LABELS[ent.estado] || ent.estado,
                    ent.archivos.length.toString(),
                    ent.archivos?.[0]?.createdAt ? new Date(ent.archivos[0].createdAt).toLocaleDateString("es-MX") : "N/A"
                ];
            });

            autoTable(doc, {
                startY: 55,
                head: [['Programa', 'Periodo', 'Estado', 'Archivos', 'Fecha Subida']],
                body: tableData,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [12, 90, 142] }
            });

            const finalY = (doc as any).lastAutoTable.finalY || 60;
            doc.text("___________________________", 14, finalY + 30);
            doc.text("Sello / Firma Supervisión", 14, finalY + 36);

            doc.save(`Acuse_${esc.cct}_${new Date().toISOString().split("T")[0]}.pdf`);
            onSetMessage({ type: "success", text: "Acuse PDF generado exitosamente." });
        } catch (error) {
            console.error("Error generating PDF:", error);
            onSetMessage({ type: "error", text: "Error al generar el PDF." });
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ marginBottom: "0.5rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: "250px", position: "relative" }}>
                    <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                    <input
                        type="text"
                        placeholder="Buscar por CCT o nombre de escuela..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-control"
                        style={{ paddingLeft: "2.5rem" }}
                    />
                </div>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {["TODOS", ...ESTADOS].map((st) => {
                        const styles = st === "TODOS" 
                            ? { color: "var(--text-secondary)", background: "#f1f5f9", borderColor: "var(--border)" }
                            : getEstadoStyles(st);
                        const isActive = statusFilter === st;
                        return (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                style={{
                                    padding: "0.4rem 0.75rem",
                                    borderRadius: "20px",
                                    border: `1px solid ${isActive ? styles.color : styles.borderColor}`,
                                    background: isActive ? styles.background : "transparent",
                                    color: isActive ? styles.color : "var(--text-secondary)",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    boxShadow: isActive ? "inset 0 0 0 1px " + styles.color : "none"
                                }}
                            >
                                {st === "TODOS" ? "Mostrar Todos" : ESTADO_LABELS[st]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {escuelas.filter(esc => {
                const matchesSearch = esc.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || esc.cct.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesStatus = statusFilter === "TODOS" || esc.entregas.some(ent => ent.estado === statusFilter);
                return matchesSearch && matchesStatus;
            }).map((esc) => {
                const entregasRequeridas = esc.entregas.filter((e) => e.estado !== "EXENTO");
                const totalEsc = entregasRequeridas.length;
                const aprobadasEsc = entregasRequeridas.filter((e) => ["APROBADO", "ENTREGADO_FISICO"].includes(e.estado)).length;
                const porcEsc = totalEsc > 0 ? Math.round((aprobadasEsc / totalEsc) * 100) : 100;
                const isExpanded = expanded === esc.id;

                let progressColor = "var(--danger)";
                let cardBgGradient = "linear-gradient(to right, var(--danger-bg) 0%, var(--surface) 150px)";
                if (porcEsc === 100) {
                    progressColor = "var(--success)";
                    cardBgGradient = "linear-gradient(to right, var(--success-bg) 0%, var(--surface) 150px)";
                } else if (porcEsc > 0) {
                    progressColor = "var(--warning)";
                    cardBgGradient = "linear-gradient(to right, var(--warning-bg) 0%, var(--surface) 150px)";
                }

                return (
                    <div key={esc.id} className="card" style={{ borderLeft: `5px solid ${progressColor}`, background: cardBgGradient, padding: 0 }}>
                        <button onClick={() => setExpanded(isExpanded ? null : esc.id)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "1rem", textAlign: "left" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                                        {esc.nombre}
                                        {esc.usaApiPropia && (
                                            <span style={{ marginLeft: "0.5rem", fontSize: "0.65rem", padding: "2px 6px", background: "var(--primary-bg)", color: "var(--primary)", borderRadius: "10px", fontWeight: 600 }}>
                                                API Propia
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        {esc.cct} • {esc.localidad} • {esc.total} alumnos
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <span style={{ fontWeight: 700, color: progressColor }}>{porcEsc}%</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); exportEscuelaPDF(esc); }}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "0.25rem", display: "flex", alignItems: "center" }}
                                        title="Descargar Acuse PDF"
                                    >
                                        <FileText size={18} />
                                    </button>
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                            </div>
                            <div className="progress-bar" style={{ marginTop: "0.5rem", height: "6px" }}>
                                <div className="progress-fill" style={{ width: `${porcEsc}%`, background: progressColor }} />
                            </div>
                        </button>

                        {isExpanded && (
                            <div style={{ padding: "0 1rem 1rem", borderTop: "1px solid var(--border)" }}>
                                {[...esc.entregas].sort((a, b) => {
                                    const progA = a.periodoEntrega.programa.nombre || "";
                                    const progB = b.periodoEntrega.programa.nombre || "";
                                    const compProg = progA.localeCompare(progB);
                                    if (compProg !== 0) return compProg;
                                    
                                    const SEP_MONTH_ORDER = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
                                    const getSepMonthOrder = (m: number | null) => m ? (SEP_MONTH_ORDER.indexOf(m) === -1 ? 99 : SEP_MONTH_ORDER.indexOf(m)) : 99;
                                    const orderMesA = getSepMonthOrder(a.periodoEntrega.mes);
                                    const orderMesB = getSepMonthOrder(b.periodoEntrega.mes);
                                    if (orderMesA !== orderMesB) return orderMesA - orderMesB;
                                    
                                    const semA = a.periodoEntrega.semestre ?? 99;
                                    const semB = b.periodoEntrega.semestre ?? 99;
                                    return semA - semB;
                                }).map((ent) => {
                                    const styles = getEstadoStyles(ent.estado);
                                    const periodoLabel = getNombrePeriodo(ent.periodoEntrega, ent.periodoEntrega.programa.nombre);

                                    return (
                                        <div key={ent.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)", gap: "0.5rem", flexWrap: "wrap" }}>
                                            <div style={{ fontSize: "0.875rem", minWidth: "140px", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                 <div>
                                                     <span style={{ fontWeight: 500 }}>{ent.periodoEntrega.programa.nombre}</span>
                                                     {periodoLabel && <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}> ({periodoLabel})</span>}
                                                     {(ent as any).preRevision && (
                                                         <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginLeft: "0.5rem" }}>
                                                             <span style={{
                                                                 fontSize: "0.68rem",
                                                                 padding: "0.05rem 0.3rem",
                                                                 borderRadius: "4px",
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
                                                {/* Administrative Upload Buttons */}
                                                {ent.estado !== "APROBADO" && !readOnly && (
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.35rem", marginBottom: "0.35rem" }}>
                                                        {Array.from({ length: (ent.periodoEntrega.programa as any).numArchivos || 1 }).map((_, i) => {
                                                            const etiquetas = (ent.periodoEntrega.programa as any).etiquetasArchivos || [];
                                                            const defaultLabel = etiquetas[i] && etiquetas[i].trim() !== "" ? etiquetas[i] : `Archivo ${i + 1}`;
                                                            const displayLabel = ((ent.periodoEntrega.programa as any).numArchivos || 1) === 1 ? "" : defaultLabel;
                                                            const hasFileAlready = displayLabel !== ""
                                                                ? ent.archivos.some(a => a.etiqueta === displayLabel)
                                                                : ent.archivos.length > 0;

                                                            if (hasFileAlready) return null;

                                                            const uploadKey = ent.id + displayLabel;

                                                            return (
                                                                <button
                                                                    key={i}
                                                                    onClick={(e) => handleUploadClick(e, ent.id, displayLabel || undefined)}
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

                                                {ent.archivos.length > 0 && (
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                                                        {ent.archivos.map((arch, index) => {
                                                            const fileUrl = getEntregaDownloadUrl({
                                                                url: arch.driveUrl,
                                                                publicId: arch.driveId,
                                                                cct: esc.cct,
                                                                programa: ent.periodoEntrega.programa.nombre,
                                                                periodo: ent.periodoEntrega.mes
                                                                    ? (MESES[ent.periodoEntrega.mes] ?? "")
                                                                    : ent.periodoEntrega.semestre
                                                                        ? `Semestre_${ent.periodoEntrega.semestre}`
                                                                        : "Anual",
                                                                etiqueta: arch.etiqueta,
                                                                nombreOriginal: arch.nombre,
                                                            });

                                                            const archLabel = arch.etiqueta || `Archivo ${index + 1}`;
                                                            const archTitle = `${esc.cct} — ${ent.periodoEntrega.programa.nombre} — ${archLabel}`;
                                                            return (
                                                                <span key={arch.id} style={{ display: "inline-flex", alignItems: "center", gap: "0.125rem", background: "var(--bg)", border: "1px solid var(--border)", padding: "0.15rem 0.35rem", borderRadius: "4px", fontSize: "0.75rem" }}>
                                                                    <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }} title={archLabel}>{archLabel}</span>
                                                                    {/* Eye: open viewer */}
                                                                    {arch.driveUrl && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                                setViewingPdf({
                                                                                    url: arch.driveUrl!,
                                                                                    title: archTitle,
                                                                                    downloadUrl: fileUrl || undefined,
                                                                                    fileName: arch.nombre || undefined,
                                                                                });
                                                                            }}
                                                                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "1px", display: "inline-flex", alignItems: "center" }}
                                                                            title={`Ver ${archLabel}`}
                                                                        >
                                                                            <Eye size={12} />
                                                                        </button>
                                                                    )}
                                                                    {/* Download */}
                                                                    <a
                                                                        href={fileUrl || "#"}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        style={{ color: "var(--text-muted)", display: "inline-flex", alignItems: "center", padding: "1px", marginRight: "0.25rem" }}
                                                                        title={`Descargar ${archLabel}`}
                                                                    >
                                                                        <Download size={12} />
                                                                    </a>
                                                                    {/* Delete */}
                                                                    {ent.estado !== "APROBADO" && !readOnly && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteFile(arch.id); }}
                                                                            disabled={deleting === arch.id}
                                                                            style={{
                                                                                background: "none",
                                                                                border: "none",
                                                                                cursor: "pointer",
                                                                                color: "var(--danger)",
                                                                                padding: "1px",
                                                                                display: "inline-flex",
                                                                                alignItems: "center"
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
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                {ent.estado !== "APROBADO" && !readOnly && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleSendReminder(ent.id, esc.nombre); }}
                                                        disabled={sendingReminder === ent.id}
                                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "0.25rem", opacity: sendingReminder === ent.id ? 0.5 : 1 }}
                                                        title="Enviar Recordatorio Individual"
                                                    >
                                                        <Mail size={16} />
                                                    </button>
                                                )}
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
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={updatingEstado === ent.id || readOnly}
                                                    style={{
                                                        padding: "0.25rem 0.5rem", borderRadius: "6px",
                                                        border: `1px solid ${styles.borderColor}`, background: styles.background,
                                                        color: styles.color, fontWeight: 600, fontSize: "0.75rem", cursor: "pointer",
                                                        outline: "none", transition: "all 0.2s ease"
                                                    }}
                                                >
                                                    {ESTADOS.map((e) => (
                                                        <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
                                                    ))}
                                                </select>
                                                 <button
                                                     onClick={(e) => { e.stopPropagation(); e.preventDefault(); onSetCorreccionModal({ entregaId: ent.id, escuelaNombre: esc.nombre, history: ent.correcciones, preRevision: (ent as any).preRevision, archivos: ent.archivos }); }}
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
                );
            })}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelected}
                style={{ display: "none" }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.png"
            />

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
