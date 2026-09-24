"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, MessageSquare, Download, Eye, Loader2, FileCheck2, FilePlus2, Trash2, Upload, RefreshCw, CheckCircle2, Clock, Activity } from "lucide-react";
import JSZip from "jszip";
import { ESTADOS, ESTADO_LABELS, getNombrePeriodo } from "@/lib/constants";
import { ProgramaAdmin } from "@/types";
import { getDownloadUrl } from "@/lib/download-url";
import PdfViewerModal from "@/app/_componentes/PdfViewerModal";
import { mergePdfsAndDownload, MergeProgress } from "@/lib/merge-pdfs";

/** Prefijo por defecto para los archivos unificados */
const DEFAULT_PREFIX = "CONCENTRADO_ZONAL";

export interface BotonUnificacion {
    tipo: string;
    label: string;
    etiquetaMatch: string | null;
}

/**
 * Determina dinámicamente los botones de unificación para cualquier programa.
 * Universal: funciona para programas de 1 archivo (El ABC de las Emociones),
 * de 2 archivos (Día Naranja), o de N archivos de programas nuevos creados en Gestión de Programas.
 */
export function obtenerBotonesUnificacion(prog: ProgramaAdmin): BotonUnificacion[] {
    const num = prog.numArchivos || 1;
    const etiquetas = (prog.etiquetasArchivos || []).filter(Boolean);

    // Caso 1: 1 solo archivo requerido (ej. El ABC de las Emociones, PMC, PAEC, etc.)
    if (num <= 1) {
        return [
            { tipo: "EVIDENCIAS", label: "Unificar Evidencias", etiquetaMatch: null }
        ];
    }

    // Caso 2: 2 o más archivos con etiquetas definidas
    if (etiquetas.length >= num) {
        return etiquetas.slice(0, num).map((etiq, idx) => {
            const lower = etiq.toLowerCase();
            let label = `Unificar ${etiq}`;
            let tipo = `DOC_${idx + 1}`;

            if (lower.includes("registro")) {
                label = "Unificar Registros";
                tipo = "REGISTROS";
            } else if (lower.includes("evidencia")) {
                label = "Unificar Evidencias";
                tipo = "EVIDENCIAS";
            } else {
                const corta = etiq.length > 20 ? `${etiq.slice(0, 18)}...` : etiq;
                label = `Unificar ${corta}`;
                tipo = etiq.toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 15) || `DOC_${idx + 1}`;
            }

            return {
                tipo,
                label,
                etiquetaMatch: lower
            };
        });
    }

    // Caso 3: Fallback si numArchivos > 1 pero sin etiquetas configuradas
    const botones: BotonUnificacion[] = [];
    for (let i = 0; i < num; i++) {
        botones.push({
            tipo: `ARCHIVO_${i + 1}`,
            label: `Unificar Archivo ${i + 1}`,
            etiquetaMatch: `archivo ${i + 1}`
        });
    }
    return botones;
}

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

    // ── Estado para la unificación universal de PDFs por CCT ──
    const [mergePrefix, setMergePrefix]                 = useState(DEFAULT_PREFIX);
    const [mergingKeys, setMergingKeys]                 = useState<Record<string, boolean>>({});
    const [mergeProgressByProg, setMergeProgressByProg] = useState<Record<string, MergeProgress>>({});
    const [showPrefixProgId, setShowPrefixProgId]       = useState<string | null>(null);

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
     * Une todos los PDFs de un tipo o documento de todas las escuelas
     * que subieron ese documento, ordenadas alfabéticamente por CCT.
     *
     * Universal: funciona para cualquier programa (El ABC de las Emociones, Día Naranja, etc.)
     * y permite unificar tanto periodos activos como un periodo específico (mes o semestre).
     */
    async function handleMergePdfs(
        prog: ProgramaAdmin,
        config: BotonUnificacion,
        periodoId?: string
    ) {
        const mergeKey = `${prog.id}_${periodoId || "ALL"}_${config.tipo}`;
        if (mergingKeys[mergeKey]) return; // ya hay una unificación en curso para este botón específico

        // Determinar qué periodos procesar
        let periodosAProcesar = prog.periodos;
        let periodoLabel = "";

        if (periodoId) {
            const pEncontrado = prog.periodos.find(per => per.id === periodoId);
            if (pEncontrado) {
                periodosAProcesar = [pEncontrado];
                periodoLabel = getPeriodoLabel(pEncontrado, prog.nombre);
            }
        } else {
            const periodosActivos = prog.periodos.filter(per => per.activo);
            // Si hay periodos activos, usar esos; si todos están inactivos (ej. Concluidos), procesar todos
            periodosAProcesar = periodosActivos.length > 0 ? periodosActivos : prog.periodos;
        }

        // Recopilar todos los archivos del tipo solicitado
        // Mapear por CCT para evitar duplicados y luego ordenar alfabéticamente.
        const porCct = new Map<string, { cct: string; proxyUrl: string; etiqueta: string }>();

        for (const p of periodosAProcesar) {
            for (const ent of p.entregas) {
                if (!ent.archivos || ent.archivos.length === 0) continue;
                const cct = ent.escuela.cct;
                if (porCct.has(cct)) continue; // 1 archivo por bachillerato en el concentrado

                // Filtrar solo archivos con URL y formato PDF
                const pdfsEntrega = ent.archivos.filter(
                    arch => arch.driveUrl && arch.nombre.toLowerCase().endsWith(".pdf")
                );
                if (pdfsEntrega.length === 0) continue;

                let archivoSeleccionado = null;

                if (config.etiquetaMatch === null) {
                    // Para programas de 1 archivo (como El ABC de las Emociones),
                    // tomamos el primer PDF de la entrega sin importar la etiqueta (incluso null)
                    archivoSeleccionado = pdfsEntrega[0];
                } else {
                    // Buscar coincidencia exacta o parcial en la etiqueta
                    archivoSeleccionado = pdfsEntrega.find(arch => {
                        const etiq = (arch.etiqueta || "").toLowerCase();
                        return etiq.includes(config.etiquetaMatch!);
                    });

                    // Fallback: si la etiqueta fue null o genérica, buscar en el nombre del archivo
                    if (!archivoSeleccionado) {
                        archivoSeleccionado = pdfsEntrega.find(arch => {
                            const nom = arch.nombre.toLowerCase();
                            return nom.includes(config.etiquetaMatch!);
                        });
                    }

                    // Fallback 2: si solo hay 1 PDF en la entrega y el programa requiere 1 archivo
                    if (!archivoSeleccionado && pdfsEntrega.length === 1 && (prog.numArchivos || 1) <= 1) {
                        archivoSeleccionado = pdfsEntrega[0];
                    }
                }

                if (archivoSeleccionado && archivoSeleccionado.driveUrl) {
                    const proxyUrl = getDownloadUrl(archivoSeleccionado.driveUrl, archivoSeleccionado.nombre, archivoSeleccionado.driveId) || archivoSeleccionado.driveUrl;
                    const inlineUrl = proxyUrl.includes("?")
                        ? `${proxyUrl}&inline=1`
                        : `${proxyUrl}?inline=1`;
                    porCct.set(cct, {
                        cct,
                        proxyUrl: inlineUrl,
                        etiqueta: archivoSeleccionado.etiqueta || config.tipo
                    });
                }
            }
        }

        // Ordenar por CCT alfabéticamente
        const items = [...porCct.values()].sort((a, b) => a.cct.localeCompare(b.cct));

        if (items.length === 0) {
            onSetMessage({ type: "error", text: `No se encontraron PDFs de "${config.label}" subidos por los bachilleratos.` });
            return;
        }

        const progNombreLimpio = prog.nombre.trim().toUpperCase().replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
        const periodoSuffix = periodoLabel ? `_${periodoLabel.toUpperCase().replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_')}` : "";
        const fileName = `${mergePrefix.toUpperCase()}_${progNombreLimpio}${periodoSuffix}_${config.tipo}.PDF`;

        setMergingKeys(prev => ({ ...prev, [mergeKey]: true }));
        setMergeProgressByProg(prev => ({
            ...prev,
            [prog.id]: { total: items.length, done: 0, failed: 0, failedCcts: [], stage: "downloading" }
        }));
        onSetMessage({ type: "success", text: `Unificando ${items.length} PDF${items.length > 1 ? "s" : ""} de ${config.label}...` });

        try {
            const { mergedCount } = await mergePdfsAndDownload(
                items,
                fileName,
                (p) => setMergeProgressByProg(prev => ({ ...prev, [prog.id]: p }))
            );
            onSetMessage({
                type: "success",
                text: `✅ ${fileName} listo: ${mergedCount} bachillerato${mergedCount > 1 ? "s" : ""} unidos en orden de CCT.`,
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            onSetMessage({ type: "error", text: `❌ ${msg || "Error al unificar los PDFs."}` });
        } finally {
            setMergingKeys(prev => {
                const next = { ...prev };
                delete next[mergeKey];
                return next;
            });
            setMergeProgressByProg(prev => {
                const next = { ...prev };
                delete next[prog.id];
                return next;
            });
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

    // ── Clasificación de programas en Activos, Concluidos y Posteriores ──
    const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "ACTIVOS" | "CONCLUIDOS" | "POSTERIORES">("TODOS");
    const [seccionesColapsadas, setSeccionesColapsadas] = useState<Record<string, boolean>>({
        activos: false,
        concluidos: false,
        posteriores: false,
    });

    const toggleSeccion = (secKey: string) => {
        setSeccionesColapsadas(prev => ({ ...prev, [secKey]: !prev[secKey] }));
    };

    const programasCategorizados = useMemo(() => {
        const activos: ProgramaAdmin[] = [];
        const concluidos: ProgramaAdmin[] = [];
        const posteriores: ProgramaAdmin[] = [];

        programas.forEach(prog => {
            const allEntregas = prog.periodos.flatMap((p) => p.entregas);
            const statEntregas = allEntregas.filter(e => !e.escuela.esDePrueba && !e.escuela.esSupervision);
            const entregadosProg = statEntregas.filter(e => ["APROBADO", "ENTREGADO_FISICO", "EN_REVISION", "REQUIERE_CORRECCION"].includes(e.estado)).length;
            const periodosActivos = prog.periodos.filter((p) => p.activo).length;

            if (periodosActivos > 0) {
                activos.push(prog);
            } else if (entregadosProg > 0) {
                concluidos.push(prog);
            } else {
                posteriores.push(prog);
            }
        });

        return { activos, concluidos, posteriores };
    }, [programas]);

    const listaFiltrada = useMemo(() => {
        if (filtroEstado === "ACTIVOS") return programasCategorizados.activos;
        if (filtroEstado === "CONCLUIDOS") return programasCategorizados.concluidos;
        if (filtroEstado === "POSTERIORES") return programasCategorizados.posteriores;
        return programas;
    }, [filtroEstado, programasCategorizados, programas]);

    const renderProgramaCard = (prog: ProgramaAdmin) => {
        const allEntregas = prog.periodos.flatMap((p) => p.entregas);
        const statEntregas = allEntregas.filter(e => !e.escuela.esDePrueba && !e.escuela.esSupervision);
        const entregasRequeridas = statEntregas.filter((e) => e.estado !== "EXENTO");
        const totalProg = entregasRequeridas.length;
        const entregadosProg = statEntregas.filter(e => ["APROBADO", "ENTREGADO_FISICO", "EN_REVISION", "REQUIERE_CORRECCION"].includes(e.estado)).length;
        const aprobadasProg = entregasRequeridas.filter((e) => ["APROBADO", "ENTREGADO_FISICO"].includes(e.estado)).length;
        const porc = totalProg > 0 ? Math.round((aprobadasProg / totalProg) * 100) : 100;
        const isExpanded = expanded === prog.id;
        const periodosActivos = prog.periodos.filter((p) => p.activo).length;

        let progressColor = "var(--danger)";
        let cardBgGradient = "linear-gradient(to right, var(--danger-bg) 0%, var(--surface) 150px)";
        if (porc === 100) {
            progressColor = "var(--success)";
            cardBgGradient = "linear-gradient(to right, var(--success-bg) 0%, var(--surface) 150px)";
        } else if (porc > 0) {
            progressColor = "var(--primary)";
            cardBgGradient = "linear-gradient(to right, var(--primary-bg) 0%, var(--surface) 150px)";
        }

        // Botones de unificación universal calculados dinámicamente
        const botonesUnificacion = obtenerBotonesUnificacion(prog);
        const hasPdfsProg = prog.periodos.some(p =>
            p.entregas.some(e =>
                e.archivos && e.archivos.some(a => a.driveUrl && a.nombre.toLowerCase().endsWith(".pdf"))
            )
        );

        return (
            <div key={prog.id} className="card" style={{ padding: 0, borderLeft: `5px solid ${progressColor}`, background: cardBgGradient }}>
                {/* ── Cabecera del programa ── */}
                <button
                    onClick={() => setExpanded(isExpanded ? null : prog.id)}
                    style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "1rem", textAlign: "left" }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                                <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{prog.nombre}</span>
                                {periodosActivos > 0 ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "#dcfce7", color: "#15803d", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontSize: "0.6875rem", fontWeight: 800, border: "1px solid #bbf7d0" }}>
                                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                                        Activo
                                    </span>
                                ) : entregadosProg > 0 ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "#e0f2fe", color: "#0369a1", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontSize: "0.6875rem", fontWeight: 800, border: "1px solid #bae6fd" }}>
                                        ✓ Concluido
                                    </span>
                                ) : (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "#fef3c7", color: "#92400e", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontSize: "0.6875rem", fontWeight: 800, border: "1px solid #fde68a" }}>
                                        ⏳ Fecha Posterior
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                                {entregadosProg}/{totalProg} recibidas • {periodosActivos} activo(s) / {prog.periodos.length} periodo(s)
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontWeight: 700, color: progressColor }}>{porc}%</span>

                                    {/* ── Botones de unificación PDF Universal (por CCT) ── */}
                                    {hasPdfsProg && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                                            {botonesUnificacion.map((btn) => {
                                                const btnKey = `${prog.id}_ALL_${btn.tipo}`;
                                                const isThisMerging = Boolean(mergingKeys[btnKey]);
                                                const esEvidencia = btn.tipo === "EVIDENCIAS";
                                                const borderCol = esEvidencia ? "#059669" : "var(--primary)";
                                                const textCol = esEvidencia ? "#059669" : "var(--primary)";
                                                const Icon = esEvidencia ? FilePlus2 : FileCheck2;

                                                return (
                                                    <button
                                                        key={btn.tipo}
                                                        onClick={() => handleMergePdfs(prog, btn)}
                                                        disabled={isThisMerging}
                                                        title={`Unificar todos los PDFs de ${btn.label} en un solo archivo (ordenados por CCT)`}
                                                        style={{
                                                            display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                                            background: isThisMerging ? "var(--primary-bg)" : "white",
                                                            border: `1px solid ${borderCol}`, borderRadius: "5px",
                                                            color: textCol, padding: "0.2rem 0.45rem",
                                                            fontSize: "0.7rem", fontWeight: 700, cursor: isThisMerging ? "not-allowed" : "pointer",
                                                            opacity: isThisMerging ? 0.7 : 1,
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {isThisMerging
                                                            ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Uniendo...</>
                                                            : <><Icon size={11} /> {btn.label}</>
                                                        }
                                                    </button>
                                                );
                                            })}

                                            {/* Engranaje para editar prefijo */}
                                            <button
                                                onClick={() => setShowPrefixProgId(curr => curr === prog.id ? null : prog.id)}
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

                            {/* ── Editor de prefijo inline ── */}
                            {showPrefixProgId === prog.id && (
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
                                        → <strong>{mergePrefix.toUpperCase() || "PREFIX"}_{prog.nombre.trim().toUpperCase().replace(/[/\\?%*:|"<>]/g, '_').slice(0, 20)}_{botonesUnificacion[0]?.tipo || "UNIFICADO"}.PDF</strong>
                                    </span>
                                </div>
                            )}

                            {/* ── Barra de progreso del merge ── */}
                            {mergeProgressByProg[prog.id] && (() => {
                                const pProg = mergeProgressByProg[prog.id];
                                return (
                                    <div
                                        style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div style={{ flex: 1, height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                                            <div style={{
                                                height: "100%", background: "var(--primary)", borderRadius: "2px",
                                                width: pProg.total > 0
                                                    ? `${Math.round(((pProg.done + pProg.failed) / pProg.total) * 100)}%`
                                                    : "0%",
                                                transition: "width 0.3s ease",
                                            }} />
                                        </div>
                                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                            {pProg.stage === "merging"
                                                ? "Uniendo PDFs..."
                                                : `${pProg.done + pProg.failed} / ${pProg.total}`
                                            }
                                            {pProg.failed > 0 && ` (${pProg.failed} omitidos)`}
                                        </span>
                                    </div>
                                );
                            })()}

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
                                                    {!readOnly && (() => {
                                                        const hasPdfsPeriodo = periodo.entregas.some(e => e.archivos && e.archivos.some(a => a.driveUrl && a.nombre.toLowerCase().endsWith(".pdf")));
                                                        return (
                                                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                                                {hasPdfsPeriodo && (
                                                                    <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                                                                        {botonesUnificacion.map((btn) => {
                                                                            const btnKey = `${prog.id}_${periodo.id}_${btn.tipo}`;
                                                                            const isThisMerging = Boolean(mergingKeys[btnKey]);
                                                                            const btnText = btn.tipo === "REGISTROS" ? "Unificar Registros"
                                                                                : btn.tipo === "EVIDENCIAS" ? "Unificar Evidencias"
                                                                                : btn.label;

                                                                            return (
                                                                                <button
                                                                                    key={btn.tipo}
                                                                                    onClick={() => handleMergePdfs(prog, btn, periodo.id)}
                                                                                    disabled={isThisMerging}
                                                                                    title={`Unificar PDFs de ${btn.label} para ${getPeriodoLabel(periodo, prog.nombre)} ordenados por CCT`}
                                                                                    style={{
                                                                                        padding: "0.15rem 0.45rem",
                                                                                        fontSize: "0.7rem",
                                                                                        borderRadius: "4px",
                                                                                        background: isThisMerging ? "var(--primary-bg)" : "#ffffff",
                                                                                        border: "1px solid var(--primary)",
                                                                                        color: "var(--primary)",
                                                                                        cursor: isThisMerging ? "not-allowed" : "pointer",
                                                                                        display: "inline-flex",
                                                                                        alignItems: "center",
                                                                                        gap: "0.25rem",
                                                                                        fontWeight: 700,
                                                                                        opacity: isThisMerging ? 0.7 : 1,
                                                                                        whiteSpace: "nowrap"
                                                                                    }}
                                                                                >
                                                                                    {isThisMerging ? (
                                                                                        <><Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> Uniendo...</>
                                                                                    ) : (
                                                                                        <><FileCheck2 size={10} /> {btnText}</>
                                                                                    )}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
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
                                                        );
                                                    })()}
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
            };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={handleFileSelected}
            />

            {/* ── BARRA DE PESTAÑAS / FILTROS DE ESTADO ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                <button
                    onClick={() => setFiltroEstado("TODOS")}
                    type="button"
                    style={{
                        display: "inline-flex", alignItems: "center", gap: "0.4rem",
                        padding: "0.45rem 0.85rem", borderRadius: "8px", fontSize: "0.8125rem", fontWeight: 700,
                        cursor: "pointer", transition: "all 0.15s ease",
                        background: filtroEstado === "TODOS" ? "var(--primary, #2563eb)" : "white",
                        color: filtroEstado === "TODOS" ? "#ffffff" : "var(--text, #334155)",
                        border: filtroEstado === "TODOS" ? "1px solid var(--primary, #2563eb)" : "1px solid var(--border, #cbd5e1)",
                        boxShadow: filtroEstado === "TODOS" ? "0 2px 6px rgba(37,99,235,0.25)" : "0 1px 2px rgba(0,0,0,0.03)"
                    }}
                >
                    <span>📋 Todos</span>
                    <span style={{ fontSize: "0.6875rem", padding: "0.1rem 0.4rem", borderRadius: "10px", background: filtroEstado === "TODOS" ? "rgba(255,255,255,0.25)" : "#f1f5f9", color: filtroEstado === "TODOS" ? "#ffffff" : "#64748b" }}>
                        {programas.length}
                    </span>
                </button>

                <button
                    onClick={() => setFiltroEstado("ACTIVOS")}
                    type="button"
                    style={{
                        display: "inline-flex", alignItems: "center", gap: "0.4rem",
                        padding: "0.45rem 0.85rem", borderRadius: "8px", fontSize: "0.8125rem", fontWeight: 700,
                        cursor: "pointer", transition: "all 0.15s ease",
                        background: filtroEstado === "ACTIVOS" ? "#059669" : "white",
                        color: filtroEstado === "ACTIVOS" ? "#ffffff" : "#059669",
                        border: filtroEstado === "ACTIVOS" ? "1px solid #059669" : "1px solid #a7f3d0",
                        boxShadow: filtroEstado === "ACTIVOS" ? "0 2px 6px rgba(5,150,105,0.25)" : "0 1px 2px rgba(0,0,0,0.03)"
                    }}
                >
                    <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: filtroEstado === "ACTIVOS" ? "#ffffff" : "#10b981" }} />
                    <span>Activos en Curso</span>
                    <span style={{ fontSize: "0.6875rem", padding: "0.1rem 0.4rem", borderRadius: "10px", background: filtroEstado === "ACTIVOS" ? "rgba(255,255,255,0.25)" : "#d1fae5", color: filtroEstado === "ACTIVOS" ? "#ffffff" : "#065f46" }}>
                        {programasCategorizados.activos.length}
                    </span>
                </button>

                <button
                    onClick={() => setFiltroEstado("CONCLUIDOS")}
                    type="button"
                    style={{
                        display: "inline-flex", alignItems: "center", gap: "0.4rem",
                        padding: "0.45rem 0.85rem", borderRadius: "8px", fontSize: "0.8125rem", fontWeight: 700,
                        cursor: "pointer", transition: "all 0.15s ease",
                        background: filtroEstado === "CONCLUIDOS" ? "#0284c7" : "white",
                        color: filtroEstado === "CONCLUIDOS" ? "#ffffff" : "#0284c7",
                        border: filtroEstado === "CONCLUIDOS" ? "1px solid #0284c7" : "1px solid #bae6fd",
                        boxShadow: filtroEstado === "CONCLUIDOS" ? "0 2px 6px rgba(2,132,199,0.25)" : "0 1px 2px rgba(0,0,0,0.03)"
                    }}
                >
                    <span>✅ Concluidos / Ya Entregados</span>
                    <span style={{ fontSize: "0.6875rem", padding: "0.1rem 0.4rem", borderRadius: "10px", background: filtroEstado === "CONCLUIDOS" ? "rgba(255,255,255,0.25)" : "#e0f2fe", color: filtroEstado === "CONCLUIDOS" ? "#ffffff" : "#0369a1" }}>
                        {programasCategorizados.concluidos.length}
                    </span>
                </button>

                <button
                    onClick={() => setFiltroEstado("POSTERIORES")}
                    type="button"
                    style={{
                        display: "inline-flex", alignItems: "center", gap: "0.4rem",
                        padding: "0.45rem 0.85rem", borderRadius: "8px", fontSize: "0.8125rem", fontWeight: 700,
                        cursor: "pointer", transition: "all 0.15s ease",
                        background: filtroEstado === "POSTERIORES" ? "#d97706" : "white",
                        color: filtroEstado === "POSTERIORES" ? "#ffffff" : "#d97706",
                        border: filtroEstado === "POSTERIORES" ? "1px solid #d97706" : "1px solid #fde68a",
                        boxShadow: filtroEstado === "POSTERIORES" ? "0 2px 6px rgba(217,119,6,0.25)" : "0 1px 2px rgba(0,0,0,0.03)"
                    }}
                >
                    <span>⏳ Fechas Posteriores / Pendientes</span>
                    <span style={{ fontSize: "0.6875rem", padding: "0.1rem 0.4rem", borderRadius: "10px", background: filtroEstado === "POSTERIORES" ? "rgba(255,255,255,0.25)" : "#fef3c7", color: filtroEstado === "POSTERIORES" ? "#ffffff" : "#92400e" }}>
                        {programasCategorizados.posteriores.length}
                    </span>
                </button>
            </div>

            {/* ── CONTENIDO AGRUPADO (TODOS) O FILTRADO ESPECÍFICO ── */}
            {filtroEstado === "TODOS" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
                    {/* SECCIÓN 1: ACTIVOS */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div 
                            onClick={() => toggleSeccion("activos")}
                            style={{ 
                                display: "flex", alignItems: "center", justifyContent: "space-between", 
                                background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", 
                                borderRadius: "10px", padding: "0.65rem 1rem", cursor: "pointer", userSelect: "none",
                                transition: "all 0.2s"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "50%", background: "#10b981", color: "white" }}>
                                    <Activity size={15} />
                                </span>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ fontWeight: 800, fontSize: "0.875rem", color: "#065f46" }}>
                                            PROGRAMAS ACTIVOS EN CURSO
                                        </span>
                                        <span style={{ fontSize: "0.72rem", fontWeight: 700, background: "#d1fae5", color: "#065f46", padding: "0.15rem 0.45rem", borderRadius: "10px" }}>
                                            {programasCategorizados.activos.length}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "#047857", marginTop: "0.1rem" }}>
                                        Periodos abiertos actualmente para recepción de archivos de directores
                                    </div>
                                </div>
                            </div>
                            <div style={{ color: "#059669" }}>
                                {seccionesColapsadas.activos ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                            </div>
                        </div>

                        {!seccionesColapsadas.activos && (
                            programasCategorizados.activos.length > 0 ? (
                                programasCategorizados.activos.map(renderProgramaCard)
                            ) : (
                                <div style={{ padding: "1.25rem", textAlign: "center", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1", color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                                    No hay programas con periodos activos en este momento.
                                </div>
                            )
                        )}
                    </div>

                    {/* SECCIÓN 2: CONCLUIDOS */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div 
                            onClick={() => toggleSeccion("concluidos")}
                            style={{ 
                                display: "flex", alignItems: "center", justifyContent: "space-between", 
                                background: "rgba(2, 132, 199, 0.08)", border: "1px solid rgba(2, 132, 199, 0.3)", 
                                borderRadius: "10px", padding: "0.65rem 1rem", cursor: "pointer", userSelect: "none",
                                transition: "all 0.2s"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "50%", background: "#0284c7", color: "white" }}>
                                    <CheckCircle2 size={15} />
                                </span>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ fontWeight: 800, fontSize: "0.875rem", color: "#075985" }}>
                                            PROGRAMAS CONCLUIDOS / YA ENTREGADOS
                                        </span>
                                        <span style={{ fontSize: "0.72rem", fontWeight: 700, background: "#e0f2fe", color: "#0369a1", padding: "0.15rem 0.45rem", borderRadius: "10px" }}>
                                            {programasCategorizados.concluidos.length}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "#0284c7", marginTop: "0.1rem" }}>
                                        Programas concluidos que ya fueron enviados a supervisión y desactivados para directores
                                    </div>
                                </div>
                            </div>
                            <div style={{ color: "#0284c7" }}>
                                {seccionesColapsadas.concluidos ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                            </div>
                        </div>

                        {!seccionesColapsadas.concluidos && (
                            programasCategorizados.concluidos.length > 0 ? (
                                programasCategorizados.concluidos.map(renderProgramaCard)
                            ) : (
                                <div style={{ padding: "1.25rem", textAlign: "center", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1", color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                                    No hay programas concluidos desactivados.
                                </div>
                            )
                        )}
                    </div>

                    {/* SECCIÓN 3: FECHAS POSTERIORES */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div 
                            onClick={() => toggleSeccion("posteriores")}
                            style={{ 
                                display: "flex", alignItems: "center", justifyContent: "space-between", 
                                background: "rgba(217, 119, 6, 0.08)", border: "1px solid rgba(217, 119, 6, 0.3)", 
                                borderRadius: "10px", padding: "0.65rem 1rem", cursor: "pointer", userSelect: "none",
                                transition: "all 0.2s"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "50%", background: "#d97706", color: "white" }}>
                                    <Clock size={15} />
                                </span>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ fontWeight: 800, fontSize: "0.875rem", color: "#92400e" }}>
                                            PROGRAMAS INACTIVOS (FECHAS POSTERIORES / PENDIENTES)
                                        </span>
                                        <span style={{ fontSize: "0.72rem", fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "0.15rem 0.45rem", borderRadius: "10px" }}>
                                            {programasCategorizados.posteriores.length}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "#b45309", marginTop: "0.1rem" }}>
                                        Programas para bimestres o meses posteriores del ciclo escolar (aún no inician entregas)
                                    </div>
                                </div>
                            </div>
                            <div style={{ color: "#d97706" }}>
                                {seccionesColapsadas.posteriores ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                            </div>
                        </div>

                        {!seccionesColapsadas.posteriores && (
                            programasCategorizados.posteriores.length > 0 ? (
                                programasCategorizados.posteriores.map(renderProgramaCard)
                            ) : (
                                <div style={{ padding: "1.25rem", textAlign: "center", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1", color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                                    No hay programas pendientes para fechas posteriores.
                                </div>
                            )
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {listaFiltrada.length > 0 ? (
                        listaFiltrada.map(renderProgramaCard)
                    ) : (
                        <div style={{ padding: "2.5rem", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1", color: "var(--text-muted)" }}>
                            <p style={{ fontWeight: 700, fontSize: "0.875rem", margin: 0 }}>No se encontraron programas en esta categoría.</p>
                        </div>
                    )}
                </div>
            )}
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
