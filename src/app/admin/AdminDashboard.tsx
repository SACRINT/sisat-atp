"use client";

import { signOut } from "next-auth/react";
import {
    BarChart3,
    CheckCircle2,
    Clock,
    XCircle,
    AlertTriangle,
    Eye,
    LogOut,
    School,
    FileText,
    ChevronDown,
    ChevronUp,
    MessageSquare,
    Send,
    Upload,
    ToggleLeft,
    ToggleRight,
    Calendar,
    Download,
    Layers,
    Search,
    UserCog,
    Trophy,
    Users,
    BookMarked,
    GraduationCap,
    Lightbulb,
    FolderOpen,
    ShieldCheck,
    ListChecks,
    Settings2,
    Menu,
    X as XIcon,
    Loader2,
    RefreshCw,
    Sparkles,
    Mail,
    Trash2,
    Database,
} from "lucide-react";
import { useState, useEffect } from "react";
import BuscadorGlobal from "@/app/_componentes/BuscadorGlobal";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import GestionEscuelas from "./_componentes/GestionEscuelas";
import GestionFechas from "./_componentes/GestionFechas";
import GestionRecursos from "./_componentes/GestionRecursos";
import GestionProgramas from "./_componentes/GestionProgramas";
import GestionATPs from "./_componentes/GestionATPs";
import VistaGeneral from "./_componentes/VistaGeneral";
import ListadoEscuelas from "./_componentes/ListadoEscuelas";
import ListadoProgramas from "./_componentes/ListadoProgramas";
import GestionEventos from "./_componentes/GestionEventos";
import GestionOlimpiada from "./_componentes/GestionOlimpiada";
import GestionEncuentroPAEC from "./_componentes/GestionEncuentroPAEC";
import GestionCircular05 from "./_componentes/GestionCircular05";
import GestionCapems from "./_componentes/GestionCapems";
import GestionExpedientes from "./_componentes/GestionExpedientes";
import DocumentosAdmin from "./documentos/page";
import PanelModulos from "./_componentes/PanelModulos";
import GestionCiclos from "./_componentes/GestionCiclos";
import GestionPrompts from "./_componentes/GestionPrompts";
import GestionLlavesIA from "./_componentes/GestionLlavesIA";
import ReportesNivel from "./_componentes/ReportesNivel";
import RankingEscuelas from "./_componentes/RankingEscuelas";
import PlaneacionesAdminPanel from "./_componentes/PlaneacionesAdminPanel";
import ProgramasModulosPorEscuela from "./_componentes/ProgramasModulosPorEscuela";
import AlertaBadge from "@/components/vigilancia/AlertaBadge";
import PermisosHerramientasIA from "./_componentes/PermisosHerramientasIA";
import GestionNormativas from "./_componentes/GestionNormativas";
import AuditoriaInteligentePanel from "./_componentes/AuditoriaInteligentePanel";
import OficiosPanel from "./_componentes/OficiosPanel";
import ErroresServidorPanel from "./_componentes/ErroresServidorPanel";
import PlantillasSparhPanel from "./_componentes/PlantillasSparhPanel";
import Estadistica911Panel from "./_componentes/Estadistica911Panel";
import CteSesionesPanel from "./_componentes/CteSesionesPanel";
import UsicammPanel from "./_componentes/UsicammPanel";
import ComitesPanel from "./_componentes/ComitesPanel";
import BecasPanel from "./_componentes/BecasPanel";
import CedulasSupervisionPanel from "./_componentes/CedulasSupervisionPanel";
import { FileSpreadsheet, Award, Mic } from "lucide-react";

// Componentes exclusivos para Supervisor
import EntregasListado from "../director/_componentes/EntregasListado";
import AjustesApiPanel from "../director/_componentes/AjustesApiPanel";
import ExpedientesPanel from "../director/_componentes/ExpedientesPanel";

import { ProgramaAdmin, EscuelaAdmin, Stats, ZonaStat } from "@/types";

import { MESES, ESTADOS, ESTADO_LABELS, ESTADO_COLORS } from "@/lib/constants";
import { getDownloadUrl } from "@/lib/download-url";

export default function AdminDashboard({
    programas,
    escuelas,
    recursos,
    stats,
    zonaStats,
    ciclo,
    cicloId,
    cicloObj,
    todosCiclos = [],
    anuncioGlobal,
    userName,
    dbRole,
    permisos,
    sidebarConfig,
    supervisionEscuela,
    programasSupervision = [],
}: {
    programas: ProgramaAdmin[];
    escuelas: EscuelaAdmin[];
    recursos: Record<string, unknown>[];
    stats: Stats;
    zonaStats: ZonaStat[];
    ciclo: string;
    userName: string;
    dbRole: string;
    permisos: any;
    supervisionEscuela?: any;
    programasSupervision?: any[];
    cicloId: string;
    cicloObj: { id: string; nombre: string; activo: boolean; anuncioGlobal: string | null };
    todosCiclos: { id: string; nombre: string; activo: boolean; inicio: string; fin: string }[];
    anuncioGlobal: string | null;
    sidebarConfig: {
        showRecursos: boolean;
        showEventos: boolean;
        showCircular05: boolean;
        showOlimpiada: boolean;
        showPAEC: boolean;
        showCapems: boolean;
        showExpedientes: boolean;
        showEstadistica911?: boolean;
    };
}) {
    const [vista, setVista] = useState<"general" | "avances" | "ranking" | "escuelas" | "programas" | "gestion-escuelas" | "gestion-programas" | "gestion-fechas" | "recursos" | "gestion-atps" | "eventos" | "circular05" | "olimpiada" | "paec" | "capems" | "expedientes" | "documentos" | "normativas" | "gestion-ciclos" | "herramientas-ia" | "reportes-nivel" | "mis-entregas" | "ajustes-api" | "mis-expedientes" | "planeaciones-ia" | "auditoria-inteligente" | "oficios" | "plantillas-sparh" | "estadistica-911" | "errores" | "cte" | "usicamm" | "comites" | "becas" | "cedulas-supervision">(dbRole === "SUPERVISION" && supervisionEscuela ? "mis-entregas" : "general");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({
        monitoreo: true,
        auditoria: true,
        config: false,
        modulos: true,
    });
    const [programasTab, setProgramasTab] = useState<"programas" | "matriz-escuelas" | "permisos-ia">("programas");
    const [iaTab, setIaTab] = useState<"rubricas" | "orquestador" | "llaves">("rubricas");

    const getSectionKey = (v: typeof vista): string => {
        switch (v) {
            case "general": return "general";
            case "avances": return "avances";
            case "ranking": return "avances"; // Using "avances" permission for ranking
            case "cedulas-supervision": return "cedulas_supervision";
            case "reportes-nivel": return "reportesNivel";
            case "auditoria-inteligente": return "auditoria_atp";
            case "oficios": return "auditoria_atp";
            case "plantillas-sparh": return "auditoria_atp";
            case "estadistica-911": return "auditoria_atp";
            case "cte": return "auditoria_atp";
            case "usicamm": return "auditoria_atp";
            case "comites": return "auditoria_atp";
            case "becas": return "auditoria_atp";
            case "gestion-escuelas": return "escuelas";
            case "gestion-programas": return "programas";
            case "gestion-fechas": return "periodos";
            case "gestion-ciclos": return "ciclos";
            case "recursos": return "formatos";
            case "herramientas-ia": return "rubricas";
            case "eventos": return "eventos";
            case "circular05": return "circular05";
            case "olimpiada": return "olimpiada";
            case "paec": return "paec";
            case "capems": return "capems";
            case "expedientes": return "expedientes";
            case "documentos": return "documentos";
            case "normativas": return "documentos";
            case "planeaciones-ia": return "planeaciones";
            case "gestion-atps": return "seguridad";
            case "mis-entregas": return "supervision_entregas";
            case "ajustes-api": return "supervision_api";
            case "mis-expedientes": return "supervision_expedientes";
            case "errores": return "seguridad";
            default: return "general";
        }
    };

    const hasAccess = (seccion: string, tipo: "read" | "write" = "read"): boolean => {
        if (dbRole === "SUPER_ADMIN") return true;
        
        // Vistas exclusivas de supervisión
        if (["supervision_entregas", "supervision_api", "supervision_expedientes"].includes(seccion)) {
            return dbRole === "SUPERVISION";
        }

        // Supervisor normal sin accesos adicionales por defecto solo entra a lo suyo
        if (dbRole === "SUPERVISION" && !permisos) {
            return false;
        }

        if (seccion === "seguridad") return false; // Solo Super Admin accede a seguridad

        if (!permisos) {
            // Retrocompatibilidad para usuarios antiguos sin permisos guardados
            const isMonitoringOrModule = [
                "general", "avances", "reportesNivel", 
                "eventos", "circular05", "olimpiada", "paec", "capems", "expedientes", "documentos", "formatos"
            ].includes(seccion);
            
            if (dbRole === "ATP_EDITOR") {
                if (isMonitoringOrModule) return true;
                return tipo === "read";
            }
            if (isMonitoringOrModule) return tipo === "read";
            return false;
        }

        const userPermiso = permisos[seccion] || "NINGUNO";
        if (userPermiso === "ESCRITURA") return true;
        if (userPermiso === "LECTURA") return tipo === "read";
        return false;
    };

    useEffect(() => {
        const secKey = getSectionKey(vista);
        if (!hasAccess(secKey, "read")) {
            const possibleViews: (typeof vista)[] = [
                "general", "avances", "reportes-nivel",
                "gestion-escuelas", "gestion-programas", "gestion-fechas", "gestion-ciclos", "recursos", "capems", "herramientas-ia",
                "eventos", "circular05", "olimpiada", "paec", "expedientes", "documentos"
            ];
            const firstAccess = possibleViews.find(v => hasAccess(getSectionKey(v), "read"));
            if (firstAccess) {
                setVista(firstAccess);
            }
        }
    }, [vista, permisos, dbRole]);

    const toggleGroup = (key: string) =>
        setGroupOpen(prev => ({ ...prev, [key]: !prev[key] }));

    const navigate = (v: typeof vista) => {
        if (hasAccess(getSectionKey(v), "read")) {
            setVista(v);
            setSidebarOpen(false);
        }
    };
    const [avanceTab, setAvanceTab] = useState<"programas" | "escuelas" | "capems">("programas");
    
    // Auto-select the first available tab if the current one is not accessible
    useEffect(() => {
        if (avanceTab === "programas" && !hasAccess("avances_programa", "read")) {
            if (hasAccess("avances_escuela", "read")) setAvanceTab("escuelas");
            else if (hasAccess("avances_capems", "read")) setAvanceTab("capems");
        } else if (avanceTab === "escuelas" && !hasAccess("avances_escuela", "read")) {
            if (hasAccess("avances_programa", "read")) setAvanceTab("programas");
            else if (hasAccess("avances_capems", "read")) setAvanceTab("capems");
        } else if (avanceTab === "capems" && !hasAccess("avances_capems", "read")) {
            if (hasAccess("avances_programa", "read")) setAvanceTab("programas");
            else if (hasAccess("avances_escuela", "read")) setAvanceTab("escuelas");
        }
    }, [avanceTab, hasAccess]);
    const [filterType, setFilterType] = useState<"escuelas" | "supervision">("escuelas");
    const [searchTermAvance, setSearchTermAvance] = useState("");
    // Modal state for evaluation (Admin)
    const [correccionModal, setCorreccionModal] = useState<{ entregaId: string; escuelaNombre: string; history?: any[]; preRevision?: any; archivos?: any[] } | null>(null);
    const [correccionTexto, setCorreccionTexto] = useState("");
    const [correccionFile, setCorreccionFile] = useState<File | null>(null);

    const handleSetCorreccionModal = (modalData: { entregaId: string; escuelaNombre: string; history?: any[]; preRevision?: any; archivos?: any[] } | null) => {
        setCorreccionModal(modalData);
        if (modalData?.preRevision?.resultado) {
            const res = modalData.preRevision.resultado;
            if (res.borradorCorreo) {
                setCorreccionTexto(res.borradorCorreo);
            } else if (res.tipo === "OTROS" && res.error) {
                setCorreccionTexto(`Error detectado por IA: ${res.error}\n\nDetalle:\n${res.detalle || ""}`);
            } else {
                setCorreccionTexto("");
            }
        } else {
            setCorreccionTexto("");
        }
    };

    const [sendingCorreccion, setSendingCorreccion] = useState(false);
    const [reEvaluating, setReEvaluating] = useState(false);
    const [resettingAttempts, setResettingAttempts] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [expedientesHighlightId, setExpedientesHighlightId] = useState<string>("");

    // Estados para el Oficio de Dictamen individual
    const [oficioModal, setOficioModal] = useState<{
        entregaId: string;
        escuelaNombre: string;
        programaNombre: string;
    } | null>(null);
    const [oficioNumInput, setOficioNumInput] = useState("0");
    const [oficioLugarFechaInput, setOficioLugarFechaInput] = useState("");
    const [oficioTextoAdicional, setOficioTextoAdicional] = useState("");
    const [generatingOficio, setGeneratingOficio] = useState(false);

    // Estados para la gestión de archivos por el admin (Propuesta 8)
    const [uploadingAdminFile, setUploadingAdminFile] = useState(false);
    const [deletingAdminFileId, setDeletingAdminFileId] = useState<string | null>(null);

    async function handleDeleteUploadedFile(archivoId: string) {
        if (!confirm("¿Estás seguro de eliminar este archivo en representación del director? Esta acción es irreversible.")) return;
        setDeletingAdminFileId(archivoId);
        setMessage(null);
        try {
            const res = await fetch(`/api/archivos/${archivoId}`, { method: "DELETE" });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Error al eliminar el archivo");
            }
            // Update local state files list
            setCorreccionModal(prev => prev ? { ...prev, archivos: prev.archivos?.filter(a => a.id !== archivoId) } : null);
            setMessage({ type: "success", text: "Archivo eliminado exitosamente." });
            router.refresh();
        } catch (err: any) {
            console.error(err);
            setMessage({ type: "error", text: err.message || "Error al eliminar archivo" });
        } finally {
            setDeletingAdminFileId(null);
        }
    }

    async function handleAdminUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0 || !correccionModal) return;
        setUploadingAdminFile(true);
        setMessage(null);
        try {
            const file = files[0];

            // 0. Validar tamaño (máximo 25 MB) y tipo de archivo
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
                    entregaId: correccionModal.entregaId,
                    originalFilename: file.name,
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
                    entregaId: correccionModal.entregaId,
                    etiqueta: null,
                    fileData: {
                        name: file.name,
                        type: file.type,
                        url: uploadData.secure_url,
                        publicId: uploadData.public_id,
                    },
                }),
            });

            if (!confirmRes.ok) {
                const errData = await confirmRes.json().catch(() => ({}));
                throw new Error(errData.error || "Error al guardar el archivo");
            }

            const conf = await confirmRes.json();

            // Actualizar lista local de archivos (confirm devuelve `archivo` singular)
            setCorreccionModal(prev => prev ? { ...prev, archivos: [...(prev.archivos || []), conf.archivo] } : null);
            setMessage({ type: "success", text: "Archivo subido exitosamente. Iniciando pre-revisión..." });

            // /api/upload/confirm ya dispara la IA en segundo plano para ATP/Admin
            router.refresh();
        } catch (err: any) {
            console.error(err);
            setMessage({ type: "error", text: err.message || "Error al subir archivo" });
        } finally {
            setUploadingAdminFile(false);
            if (e.target) e.target.value = "";
        }
    }

    async function handleDownloadOficio() {
        if (!oficioModal) return;
        setGeneratingOficio(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/oficio-dictamen", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entregaId: oficioModal.entregaId,
                    numeroOficio: oficioNumInput,
                    lugarFecha: oficioLugarFechaInput,
                    textoAdicional: oficioTextoAdicional
                })
            });

            if (!res.ok) throw new Error("Error al generar el Oficio.");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "DICTAMEN_" + oficioModal.programaNombre.toUpperCase() + "_ZONA004_" + oficioModal.escuelaNombre.replace(/[^a-zA-Z0-9]/g, "_") + ".docx";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            setMessage({ type: "success", text: "Oficio de Dictamen generado y descargado." });
            setOficioModal(null);
        } catch (err: any) {
            console.error(err);
            setMessage({ type: "error", text: err.message || "Error al generar el Oficio" });
        } finally {
            setGeneratingOficio(false);
        }
    }
    const router = useRouter();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "k") {
                e.preventDefault();
                setSearchOpen(prev => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    async function handleSaveAnuncio(nuevoAnuncio: string) {
        try {
            const res = await fetch("/api/ciclos/anuncio", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ anuncioGlobal: nuevoAnuncio }),
            });
            if (res.ok) {
                setMessage({ type: "success", text: "Anuncio global actualizado" });
                router.refresh();
                return true;
            } else {
                setMessage({ type: "error", text: "Error al actualizar anuncio" });
                return false;
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
            return false;
        }
    }

    const entregadas = stats.totalEntregas - stats.noEntregadas;
    const porcentaje = stats.totalEntregas > 0 ? Math.round((entregadas / stats.totalEntregas) * 100) : 0;

    const exportToExcel = () => {
        try {
            const rows: any[] = [];
            escuelas.forEach(esc => {
                esc.entregas.forEach(ent => {
                    const programa = ent.periodoEntrega?.programa?.nombre || "N/A";
                    let periodoName = "Anual";
                    if (ent.periodoEntrega?.mes) periodoName = MESES[ent.periodoEntrega.mes];
                    else if (ent.periodoEntrega?.semestre) periodoName = `Semestre ${ent.periodoEntrega.semestre}`;

                    rows.push({
                        "CCT": esc.cct,
                        "Escuela": esc.nombre,
                        "Programa": programa,
                        "Periodo": periodoName,
                        "Estado": ESTADO_LABELS[ent.estado] || ent.estado,
                        "Archivos Subidos": ent.archivos.length,
                    });
                });
            });

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Avance Global");
            XLSX.writeFile(workbook, `Reporte_SISAT_${new Date().toISOString().split("T")[0]}.xlsx`);
            setMessage({ type: "success", text: "Reporte Excel generado exitosamente." });
        } catch (error) {
            console.error("Error exporting to excel:", error);
            setMessage({ type: "error", text: "Hubo un error al generar el archivo Excel." });
        }
    };

    async function handleSendCorreccion() {
        if (!correccionModal || (!correccionTexto.trim() && !correccionFile)) return;
        setSendingCorreccion(true);

        try {
            let uploadedFileData = null;

            if (correccionFile) {
                // 1. Get signature for subfolder _correcciones
                const signRes = await fetch("/api/sign-cloudinary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        entregaId: correccionModal.entregaId,
                        subfolder: "_correcciones",
                        originalFilename: correccionFile.name
                    })
                });

                if (!signRes.ok) throw new Error("Error obteniendo firma para subir archivo");
                const { signature, timestamp, folder, apiKey, cloudName, publicId } = await signRes.json();

                // 2. Direct upload to Cloudinary
                const formData = new FormData();
                formData.append("file", correccionFile);
                formData.append("api_key", apiKey);
                formData.append("timestamp", timestamp.toString());
                formData.append("signature", signature);
                formData.append("folder", folder);
                if (publicId) formData.append("public_id", publicId);

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                    method: "POST",
                    body: formData
                });

                if (!uploadRes.ok) throw new Error("Error subiendo el archivo de corrección a la nube");
                const uploadData = await uploadRes.json();

                uploadedFileData = {
                    name: correccionFile.name,
                    url: uploadData.secure_url,
                    publicId: uploadData.public_id
                };
            }

            // 3. Confirm with backend
            const res = await fetch(`/api/entregas/${correccionModal.entregaId}/correcciones`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    texto: correccionTexto.trim() || null,
                    fileData: uploadedFileData
                }),
            });

            if (res.ok) {
                setMessage({ type: "success", text: "Corrección enviada" });
                setCorreccionModal(null);
                setCorreccionTexto("");
                setCorreccionFile(null);
                router.refresh();
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Error al guardar corrección" });
            }
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Error de conexión" });
        } finally {
            setSendingCorreccion(false);
        }
    }
    async function handleReEvaluate() {
        if (!correccionModal) return;
        setReEvaluating(true);
        setMessage(null);
        try {
            setMessage({ type: "success", text: "Obteniendo información del archivo..." });
            const infoRes = await fetch(`/api/entregas/${correccionModal.entregaId}/pre-revision?action=info`);
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
                    setMessage({ 
                        type: "success", 
                        text: `Leyendo y extrayendo texto del documento... (Páginas ${start} a ${end} de ${totalPages})` 
                    });
                    
                    const extractRes = await fetch(
                        `/api/entregas/${correccionModal.entregaId}/pre-revision?action=extract&start=${start}&end=${end}`
                    );
                    if (!extractRes.ok) throw new Error(`Error al extraer texto de las páginas ${start}-${end}`);
                    const extractData = await extractRes.json();
                    textoCompleto += (extractData.text || "") + "\n";
                }
            }
            
            setMessage({ type: "success", text: "Iniciando la pre-evaluación automática de la entrega..." });
            const res = await fetch(`/api/entregas/${correccionModal.entregaId}/pre-revision`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ textoCompleto })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Error al realizar la pre-evaluación");
            }
            const data = await res.json();
            
            // Iniciar Polling (esperar a que la evaluación en segundo plano se complete)
            if (data.success) {
                let attempts = 0;
                const maxAttempts = 30; // 30 intentos * 3 segundos = 90 segundos máximo
                while (attempts < maxAttempts) {
                    attempts++;
                    setMessage({ 
                        type: "success", 
                        text: `Analizando el documento con IA... Por favor espera (reintento ${attempts}/${maxAttempts})` 
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    const pollRes = await fetch(`/api/entregas/${correccionModal.entregaId}/pre-revision`);
                    if (!pollRes.ok) continue;
                    
                    const pollData = await pollRes.json();
                    if (pollData.evaluacionActual && pollData.resultado && pollData.resultado.tipo) {
                        setCorreccionModal(prev => prev ? { ...prev, preRevision: { resultado: pollData.resultado, intentosUsados: pollData.intentosUsados, updatedAt: pollData.updatedAt } } : null);
                        if (pollData.resultado.borradorCorreo) {
                            setCorreccionTexto(pollData.resultado.borradorCorreo);
                        } else if (pollData.resultado.tipo === "OTROS" && pollData.resultado.error) {
                            setCorreccionTexto(`Error detectado por IA: ${pollData.resultado.error}\n\nDetalle:\n${pollData.resultado.detalle || ""}`);
                        }
                        setMessage({ type: "success", text: "✅ Pre-dictamen generado exitosamente por la IA" });
                        router.refresh();
                        return; // Salir de la función con éxito
                    }
                }
                throw new Error("El análisis de la IA está tomando más tiempo de lo esperado. Por favor, refresca la página en unos momentos.");
            } else {
                throw new Error("No se pudo iniciar el análisis de la IA");
            }
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Error al conectar con el servidor" });
        } finally {
            setReEvaluating(false);
        }
    }

    async function handleResetAttempts() {
        if (!correccionModal) return;
        setResettingAttempts(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/entregas/${correccionModal.entregaId}/pre-revision?action=reset`, {
                method: "POST"
            });
            if (!res.ok) throw new Error("Error al reiniciar los intentos");
            const data = await res.json();
            if (data.success) {
                setCorreccionModal(prev => prev ? { ...prev, preRevision: { ...prev.preRevision, intentosUsados: 0 } } : null);
                setMessage({ type: "success", text: "El contador de intentos del director ha sido reiniciado a 0" });
                router.refresh();
            }
        } catch (err: any) {
            console.error("Error resetting attempts:", err);
            setMessage({ type: "error", text: err.message || "Error al reiniciar intentos" });
        } finally {
            setResettingAttempts(false);
        }
    }


    // Check if configuration group has any visible items
    const hasConfigGroupAccess = dbRole === "SUPER_ADMIN" || [
        hasAccess("escuelas", "read"),
        hasAccess("programas", "read"),
        hasAccess("periodos", "read"),
        hasAccess("ciclos", "read"),
        (sidebarConfig.showRecursos && hasAccess("formatos", "read")),
        (sidebarConfig.showCapems && hasAccess("capems", "read")),
        hasAccess("rubricas", "read"),
    ].some(Boolean);

    // Count active special modules for badge that user has access to
    const activeModulesCount = [
        sidebarConfig.showEventos && hasAccess("eventos", "read"),
        sidebarConfig.showCircular05 && hasAccess("circular05", "read"),
        sidebarConfig.showOlimpiada && hasAccess("olimpiada", "read"),
        sidebarConfig.showPAEC && hasAccess("paec", "read"),
        sidebarConfig.showExpedientes && hasAccess("expedientes", "read"),
        hasAccess("documentos", "read"),
        true, // Planeaciones IA siempre visible para el admin
    ].filter(Boolean).length;

    const modulosVistaActiva = ["eventos", "circular05", "olimpiada", "paec", "expedientes", "documentos", "planeaciones-ia"].includes(vista);
    const configVistaActiva = ["gestion-escuelas", "gestion-programas", "gestion-periodos", "gestion-fechas", "recursos", "gestion-atps", "modulos-control", "gestion-ciclos", "gestion-prompts", "orquestador-ia", "capems"].includes(vista);

    const hasMonitoreoGroupAccess = [
        hasAccess("general", "read"),
        hasAccess("avances", "read"),
        hasAccess("reportesNivel", "read")
    ].some(Boolean);

    return (
        <div className="admin-layout">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Mobile hamburger */}
            <button
                className="sidebar-hamburger"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menú"
            >
                <Menu size={22} />
            </button>

            {/* Sidebar */}
            <aside className={`admin-sidebar ${sidebarOpen ? "sidebar-mobile-open" : ""}`}>
                {/* Sidebar Header */}
                <div className="admin-sidebar-header" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0.5rem", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                            <div style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", borderRadius: "10px", padding: "6px", display: "flex" }}>
                                <BarChart3 size={20} color="white" />
                            </div>
                            <div>
                                <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--text)", lineHeight: 1.1 }}>SISAT-ATP</div>
                                <div style={{ fontSize: "0.52rem", color: "var(--text-muted)", lineHeight: 1.25, maxWidth: "180px", whiteSpace: "normal" }}>Sistema Inteligente de Supervisión Administrativa Tecnológica y Automatización Técnica Pedagógica</div>
                            </div>
                        </div>
                        <button
                            className="sidebar-close-btn"
                            onClick={() => setSidebarOpen(false)}
                            aria-label="Cerrar menú"
                        >
                            <XIcon size={18} />
                        </button>
                    </div>
                    {/* Ciclo dropdown */}
                    <div style={{ marginTop: "0.75rem", position: "relative", width: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                            <Calendar size={13} />
                            <span>Ciclo Escolar:</span>
                            {cicloObj && !cicloObj.activo && (
                                <span style={{ background: "var(--danger-bg, #fee2e2)", color: "var(--danger, #ef4444)", padding: "1px 6px", borderRadius: "4px", fontSize: "0.6rem", fontWeight: 700 }}>
                                    Lector
                                </span>
                            )}
                        </div>
                        <select
                            value={cicloId}
                            onChange={async (e) => {
                                const selectedId = e.target.value;
                                try {
                                    const res = await fetch("/api/ciclos/seleccionar", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ cicloId: selectedId }),
                                    });
                                    if (res.ok) {
                                        window.location.reload();
                                    } else {
                                        console.error("Error al seleccionar ciclo");
                                    }
                                } catch (err) {
                                    console.error(err);
                                }
                            }}
                            style={{
                                width: "100%",
                                padding: "0.375rem 0.5rem",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                background: "var(--bg-secondary, #f1f5f9)",
                                color: "var(--text)",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                outline: "none",
                            }}
                        >
                            {todosCiclos.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.nombre} {c.activo ? "(Activo)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    {/* Search Trigger Button & Alert Badge */}
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center" }}>
                        <button
                            onClick={() => setSearchOpen(true)}
                            style={{
                                flex: 1,
                                padding: "0.5rem 0.75rem",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                background: "var(--bg-secondary, #f1f5f9)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                fontSize: "0.75rem",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                                outline: "none",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Search size={14} />
                                <span>Buscar...</span>
                            </div>
                            <kbd style={{ border: "1px solid var(--border)", borderRadius: "3px", padding: "0 4px", fontSize: "0.65rem", background: "white", boxShadow: "0 1px 0 rgba(0,0,0,0.05)" }}>Ctrl K</kbd>
                        </button>
                        <AlertaBadge />
                    </div>
                </div>

                <div className="admin-sidebar-nav">

                    {/* ── GRUPO: MONITOREO ── */}
                    {hasMonitoreoGroupAccess && (
                        <div className="sidebar-group">
                        <button
                            className="sidebar-group-header"
                            onClick={() => toggleGroup("monitoreo")}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <BarChart3 size={14} />
                                <span>Monitoreo</span>
                            </div>
                            {groupOpen.monitoreo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {groupOpen.monitoreo && (
                            <div className="sidebar-group-items">
                                {hasAccess("general", "read") && (
                                    <button className={`sidebar-link ${vista === "general" ? "active" : ""}`} onClick={() => navigate("general")}>
                                        <BarChart3 size={17} />
                                        <span>Vista General</span>
                                    </button>
                                )}
                                {hasAccess("avances", "read") && (
                                    <button className={`sidebar-link ${vista === "avances" ? "active" : ""}`} onClick={() => navigate("avances")}>
                                        <ListChecks size={17} />
                                        <span>Avance de Entregas</span>
                                    </button>
                                )}
                                {hasAccess("avances", "read") && (
                                    <button className={`sidebar-link ${vista === "ranking" ? "active" : ""}`} onClick={() => navigate("ranking")}>
                                        <Trophy size={17} />
                                        <span>Ranking de Cumplimiento</span>
                                    </button>
                                )}
                                <a href="/admin/horarios" className="sidebar-link" style={{ textDecoration: 'none' }}>
                                    <Calendar size={17} />
                                    <span>Generador Horarios IA</span>
                                    <span className="sidebar-badge" style={{ marginLeft: "auto", background: "linear-gradient(135deg, #7c3aed, #2563eb)", color: "white", fontSize: "0.6rem" }}>
                                        NUEVO
                                    </span>
                                </a>
                                {hasAccess("cedulas_supervision", "read") && (
                                    <button className={`sidebar-link ${vista === "cedulas-supervision" ? "active" : ""}`} onClick={() => navigate("cedulas-supervision")}>
                                        <Mic size={17} />
                                        <span>Cédulas en Campo</span>
                                        <span className="sidebar-badge" style={{ marginLeft: "auto", background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white", fontSize: "0.6rem" }}>
                                            VOZ IA
                                        </span>
                                    </button>
                                )}
                                {hasAccess("reportesNivel", "read") && (
                                    <button className={`sidebar-link ${vista === "reportes-nivel" ? "active" : ""}`} onClick={() => navigate("reportes-nivel")}>
                                        <Mail size={17} />
                                        <span>Reportes al Nivel</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    )}

                    {/* ── GRUPO: AUDITORÍA INTELIGENTE ATP ── */}
                    {hasAccess("auditoria_atp", "read") && (
                        <div className="sidebar-group">
                            <button
                                className={`sidebar-group-header ${vista === "auditoria-inteligente" ? "sidebar-group-header-active" : ""}`}
                                onClick={() => toggleGroup("auditoria")}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <Database size={14} />
                                    <span>Auditoría & Corpus</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                    <span className="sidebar-badge" style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "white", fontSize: "0.6rem" }}>
                                        5,272
                                    </span>
                                    {groupOpen.auditoria ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </div>
                            </button>
                            {groupOpen.auditoria && (
                                <div className="sidebar-group-items">
                                    <button className={`sidebar-link ${vista === "auditoria-inteligente" ? "active" : ""}`} onClick={() => navigate("auditoria-inteligente")}>
                                        <Database size={17} />
                                        <span>Auditoría Inteligente</span>
                                    </button>
                                    <button className={`sidebar-link ${vista === "oficios" ? "active" : ""}`} onClick={() => navigate("oficios")}>
                                        <FileText size={17} />
                                        <span>Oficios y Plazos</span>
                                    </button>
                                    <button className={`sidebar-link ${vista === "plantillas-sparh" ? "active" : ""}`} onClick={() => navigate("plantillas-sparh")}>
                                        <FileSpreadsheet size={17} />
                                        <span>Plantillas SPARH</span>
                                    </button>
                                    <button className={`sidebar-link ${vista === "estadistica-911" ? "active" : ""}`} onClick={() => navigate("estadistica-911")}>
                                        <BarChart3 size={17} />
                                        <span>Estadística 911</span>
                                    </button>
                                    <button className={`sidebar-link ${vista === "cte" ? "active" : ""}`} onClick={() => navigate("cte")}>
                                        <GraduationCap size={17} />
                                        <span>Consejos Académicos (CAPEMS)</span>
                                    </button>
                                    <button className={`sidebar-link ${vista === "usicamm" ? "active" : ""}`} onClick={() => navigate("usicamm")}>
                                        <Award size={17} />
                                        <span>Convocatorias USICAMM</span>
                                    </button>
                                    <button className={`sidebar-link ${vista === "comites" ? "active" : ""}`} onClick={() => navigate("comites")}>
                                        <ShieldCheck size={17} />
                                        <span>Comités Escolares</span>
                                    </button>
                                    <button className={`sidebar-link ${vista === "becas" ? "active" : ""}`} onClick={() => navigate("becas")}>
                                        <BookMarked size={17} />
                                        <span>Difusión de Becas</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── GRUPO: MI INSTITUCIÓN (SUPERVISOR) ── */}
                    {dbRole === "SUPERVISION" && supervisionEscuela && (
                        <div className="sidebar-group">
                            <button
                                className="sidebar-group-header"
                                onClick={() => toggleGroup("mi_institucion")}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <School size={14} />
                                    <span>Mi Institución</span>
                                </div>
                                {groupOpen.mi_institucion ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {groupOpen.mi_institucion && (
                                <div className="sidebar-group-items">
                                    <button className={`sidebar-link ${vista === "mis-entregas" ? "active" : ""}`} onClick={() => navigate("mis-entregas")}>
                                        <FolderOpen size={17} />
                                        <span>Mis Entregas</span>
                                    </button>
                                    <button className={`sidebar-link ${vista === "ajustes-api" ? "active" : ""}`} onClick={() => navigate("ajustes-api")}>
                                        <Settings2 size={17} />
                                        <span>Ajustes de API</span>
                                    </button>
                                    <button className={`sidebar-link ${vista === "mis-expedientes" ? "active" : ""}`} onClick={() => navigate("mis-expedientes")}>
                                        <Users size={17} />
                                        <span>Mis Expedientes</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── GRUPO: CONFIGURACIÓN ── */}
                    {hasConfigGroupAccess && (
                        <div className="sidebar-group">
                        <button
                            className={`sidebar-group-header ${configVistaActiva ? "sidebar-group-header-active" : ""}`}
                            onClick={() => toggleGroup("config")}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Settings2 size={14} />
                                <span>Configuración</span>
                            </div>
                            {groupOpen.config ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {groupOpen.config && (
                            <div className="sidebar-group-items">
                                {hasAccess("escuelas", "read") && (
                                    <button className={`sidebar-link ${vista === "gestion-escuelas" ? "active" : ""}`} onClick={() => navigate("gestion-escuelas")}>
                                        <School size={17} />
                                        <span>Escuelas</span>
                                    </button>
                                )}
                                {hasAccess("programas", "read") && (
                                    <button className={`sidebar-link ${vista === "gestion-programas" ? "active" : ""}`} onClick={() => navigate("gestion-programas")}>
                                        <Layers size={17} />
                                        <span>Programas y Módulos</span>
                                    </button>
                                )}
                                {hasAccess("periodos", "read") && (
                                    <button className={`sidebar-link ${vista === "gestion-fechas" ? "active" : ""}`} onClick={() => navigate("gestion-fechas")}>
                                        <Calendar size={17} />
                                        <span>Fechas y Entregas de Programas</span>
                                    </button>
                                )}
                                {hasAccess("ciclos", "read") && (
                                    <button className={`sidebar-link ${vista === "gestion-ciclos" ? "active" : ""}`} onClick={() => navigate("gestion-ciclos")}>
                                        <Calendar size={17} />
                                        <span>Ciclos Escolares</span>
                                    </button>
                                )}
                                {sidebarConfig.showRecursos && hasAccess("formatos", "read") && (
                                    <button className={`sidebar-link ${vista === "recursos" ? "active" : ""}`} onClick={() => navigate("recursos")}>
                                        <BookMarked size={17} />
                                        <span>Formatos y Plantillas</span>
                                    </button>
                                )}
                                {sidebarConfig.showCapems && hasAccess("capems", "read") && (
                                    <button className={`sidebar-link ${vista === "capems" ? "active" : ""}`} onClick={() => navigate("capems")}>
                                        <Settings2 size={17} />
                                        <span>Configuración CAPEMS</span>
                                    </button>
                                )}
                                {dbRole === "SUPER_ADMIN" && (
                                    <>
                                        <button className={`sidebar-link ${vista === "gestion-atps" ? "active" : ""}`} onClick={() => navigate("gestion-atps")}>
                                            <ShieldCheck size={17} />
                                            <span>Accesos y Seguridad</span>
                                        </button>
                                        <button className={`sidebar-link ${vista === "errores" ? "active" : ""}`} onClick={() => navigate("errores")}>
                                            <AlertTriangle size={17} />
                                            <span>Errores del Servidor</span>
                                        </button>
                                    </>
                                )}
                                {hasAccess("rubricas", "read") && (
                                    <button className={`sidebar-link ${vista === "herramientas-ia" ? "active" : ""}`} onClick={() => navigate("herramientas-ia")}>
                                        <Sparkles size={17} />
                                        <span>Herramientas de IA</span>
                                    </button>
                                )}
                                {hasAccess("documentos", "read") && (
                                    <button className={`sidebar-link ${vista === "normativas" ? "active" : ""}`} onClick={() => navigate("normativas")}>
                                        <BookMarked size={17} />
                                        <span>Biblioteca de Normativas SEP</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    )}

                    {/* ── GRUPO: MÓDULOS ACTIVOS ── */}
                    {activeModulesCount > 0 && (
                        <div className="sidebar-group">
                            <button
                                className={`sidebar-group-header ${modulosVistaActiva ? "sidebar-group-header-active" : ""}`}
                                onClick={() => toggleGroup("modulos")}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <FolderOpen size={14} />
                                    <span>Módulos Activos</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                    <span className="sidebar-badge">{activeModulesCount}</span>
                                    {groupOpen.modulos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </div>
                            </button>
                            {groupOpen.modulos && (
                                <div className="sidebar-group-items">
                                    {sidebarConfig.showEventos && hasAccess("eventos", "read") && (
                                        <button className={`sidebar-link ${vista === "eventos" ? "active" : ""}`} onClick={() => navigate("eventos")}>
                                            <Trophy size={17} />
                                            <span>Eventos Culturales</span>
                                        </button>
                                    )}
                                    {sidebarConfig.showCircular05 && hasAccess("circular05", "read") && (
                                        <button className={`sidebar-link ${vista === "circular05" ? "active" : ""}`} onClick={() => navigate("circular05")}>
                                            <FileText size={17} />
                                            <span>Circular 03</span>
                                        </button>
                                    )}
                                    {sidebarConfig.showOlimpiada && hasAccess("olimpiada", "read") && (
                                        <button className={`sidebar-link ${vista === "olimpiada" ? "active" : ""}`} onClick={() => navigate("olimpiada")}>
                                            <GraduationCap size={17} />
                                            <span>Olimpiada Matemáticas</span>
                                        </button>
                                    )}
                                    {sidebarConfig.showPAEC && hasAccess("paec", "read") && (
                                        <button className={`sidebar-link ${vista === "paec" ? "active" : ""}`} onClick={() => navigate("paec")}>
                                            <Lightbulb size={17} />
                                            <span>Encuentro PAEC</span>
                                        </button>
                                    )}

                                    {sidebarConfig.showExpedientes && hasAccess("expedientes", "read") && (
                                        <button className={`sidebar-link ${vista === "expedientes" ? "active" : ""}`} onClick={() => navigate("expedientes")}>
                                            <Users size={17} />
                                            <span>Expedientes Personal</span>
                                        </button>
                                    )}
                                    {hasAccess("documentos", "read") && (
                                        <button className={`sidebar-link ${vista === "documentos" ? "active" : ""}`} onClick={() => navigate("documentos")}>
                                            <FileText size={17} />
                                            <span>Documentos Admin</span>
                                        </button>
                                    )}
                                    {/* Planeaciones Didácticas IA — siempre visible para el admin */}
                                    <button className={`sidebar-link ${vista === "planeaciones-ia" ? "active" : ""}`} onClick={() => navigate("planeaciones-ia")}>
                                        <GraduationCap size={17} />
                                        <span>Planeaciones Didácticas</span>
                                        <span className="sidebar-badge" style={{ marginLeft: "auto", background: "linear-gradient(135deg, #7c3aed, #2563eb)", color: "white", fontSize: "0.6rem" }}>
                                            IA
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar Footer */}
                <div className="admin-sidebar-footer">
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-avatar">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ overflow: "hidden" }}>
                            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{dbRole === "SUPER_ADMIN" ? "Super Admin" : "ATP Revisor"}</div>
                        </div>
                    </div>
                    <button
                        className="btn btn-outline btn-block"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        style={{ fontSize: "0.8125rem", padding: "0.5rem", minHeight: "auto", marginTop: "0.75rem" }}
                    >
                        <LogOut size={16} /> Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="admin-content fade-in">
                {message && (
                    <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1rem" }}>
                        {message.text}
                        <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                    </div>
                )}

                {/* ========= VISTA: VISTA GENERAL ========= */}
                {vista === "general" && (() => {
                    const filteredEsc = escuelas.filter(e => 
                        filterType === "escuelas" 
                            ? (!e.esSupervision)
                            : (e.esSupervision)
                    ).sort((a, b) => {
                        if (a.esDePrueba && !b.esDePrueba) return 1;
                        if (!a.esDePrueba && b.esDePrueba) return -1;
                        return a.nombre.localeCompare(b.nombre);
                    });
                    return (
                    <VistaGeneral
                        rawEscuelas={filteredEsc}
                        stats={{
                            ...stats,
                            escuelas: filteredEsc.map(e => ({
                                id: e.id,
                                cct: e.cct,
                                nombre: e.nombre,
                                pendientes: e.entregas.filter(en => en.estado === "PENDIENTE").length,
                                requiereCorreccion: e.entregas.filter(en => en.estado === "REQUIERE_CORRECCION").length,
                                noEntregadas: e.entregas.filter(en => en.estado === "NO_ENTREGADO").length,
                                aprobadas: e.entregas.filter(en => en.estado === "APROBADO").length,
                                total: e.entregas.length,
                            }))
                        }}
                        zonaStats={zonaStats}
                        ciclo={ciclo}
                        totalEscuelas={filteredEsc.length}
                        anuncioGlobal={anuncioGlobal}
                        onSaveAnuncio={handleSaveAnuncio}
                        onExportExcel={exportToExcel}
                        onNavigateEscuelas={() => { navigate("avances"); setAvanceTab("escuelas"); }}
                    />
                    );
                })()}


                {/* ========= VISTA: AVANCES (CON PESTAÑAS) ========= */}
                {vista === "avances" && (() => {
                    const filteredEscuelas = escuelas.filter(e => 
                        filterType === "escuelas" 
                            ? (!e.esSupervision)
                            : (e.esSupervision)
                    ).map(e => ({
                        ...e,
                        entregas: e.entregas.filter(en => 
                            filterType === "escuelas"
                                ? (!en.periodoEntrega.programa.esParaSupervision)
                                : (en.periodoEntrega.programa.esParaSupervision)
                        )
                    })).sort((a, b) => {
                        if (a.esDePrueba && !b.esDePrueba) return 1;
                        if (!a.esDePrueba && b.esDePrueba) return -1;
                        return a.nombre.localeCompare(b.nombre);
                    });
                    const filteredProgramas = programas.filter(p =>
                        filterType === "escuelas"
                            ? !p.esParaSupervision
                            : p.esParaSupervision
                    ).map(p => ({
                        ...p,
                        periodos: p.periodos.map(per => ({
                            ...per,
                            entregas: per.entregas.filter(en => 
                                filterType === "escuelas"
                                    ? (!en.escuela.esSupervision)
                                    : (en.escuela.esSupervision)
                            )
                        }))
                    }));

                    return (
                    <div>
                        <div className="tab-list">
                            {hasAccess("avances_programa", "read") && (
                                <button
                                    onClick={() => setAvanceTab("programas")}
                                    className={`tab-item ${avanceTab === "programas" ? "active" : ""}`}
                                >
                                    <ListChecks size={15} />
                                    Avance por Programa
                                </button>
                            )}
                            {hasAccess("avances_escuela", "read") && (
                                <button
                                    onClick={() => setAvanceTab("escuelas")}
                                    className={`tab-item ${avanceTab === "escuelas" ? "active" : ""}`}
                                >
                                    <School size={15} />
                                    Avance por Escuela
                                </button>
                            )}
                            {sidebarConfig.showCapems && hasAccess("avances_capems", "read") && (
                                <button
                                    onClick={() => {
                                        setAvanceTab("capems");
                                        setFilterType("escuelas"); // Resetear para que no se quede pegado "supervision"
                                    }}
                                    className={`tab-item ${avanceTab === "capems" ? "active" : ""}`}
                                >
                                    <BookMarked size={15} />
                                    Fichas CAPEMS
                                </button>
                            )}
                        </div>

                        {/* SUB-TABS ESCUELAS VS SUPERVISION (Oculto para CAPEMS) */}
                        {avanceTab !== "capems" && (
                            <div className="tab-list">
                                <button
                                    onClick={() => setFilterType("escuelas")}
                                    className={`tab-item ${filterType === "escuelas" ? "active" : ""}`}
                                >
                                    Escuelas Regulares
                                </button>
                                <button
                                    onClick={() => setFilterType("supervision")}
                                    className={`tab-item ${filterType === "supervision" ? "active" : ""}`}
                                >
                                    Supervisión
                                </button>
                            </div>
                        )}
 
                        <div style={{ marginBottom: "1.25rem", position: "relative" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "white", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border)", maxWidth: "350px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                                <Search size={15} style={{ color: "var(--text-muted, #94a3b8)" }} />
                                <input
                                    type="text"
                                    placeholder={avanceTab === "programas" ? "Buscar por programa..." : "Buscar por escuela o CCT..."}
                                    value={searchTermAvance}
                                    onChange={(e) => setSearchTermAvance(e.target.value)}
                                    style={{ border: "none", outline: "none", width: "100%", fontSize: "0.8125rem", color: "var(--text)" }}
                                />
                                {searchTermAvance && (
                                    <button 
                                        onClick={() => setSearchTermAvance("")} 
                                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.75rem", padding: "0 2px" }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {avanceTab === "programas" && (
                            <ListadoProgramas
                                programas={filteredProgramas.filter(p => p.nombre.toLowerCase().includes(searchTermAvance.toLowerCase()))}
                                onSetMessage={setMessage}
                                onSetCorreccionModal={handleSetCorreccionModal}
                                readOnly={!hasAccess("avances_programa", "write")}
                            />
                        )}
                        {avanceTab === "escuelas" && (
                            <ListadoEscuelas
                                escuelas={filteredEscuelas.filter(e => 
                                    e.nombre.toLowerCase().includes(searchTermAvance.toLowerCase()) ||
                                    e.cct.toLowerCase().includes(searchTermAvance.toLowerCase())
                                )}
                                onSetMessage={setMessage}
                                onSetCorreccionModal={handleSetCorreccionModal}
                                readOnly={!hasAccess("avances_escuela", "write")}
                            />
                        )}
                        {avanceTab === "capems" && (
                            <GestionCapems viewMode="resumen" readOnly={!hasAccess("avances_capems", "write")} hasAccess={hasAccess} />
                        )}
                    </div>
                    );
                })()}

                {/* ========= VISTA: RANKING ========= */}
                {vista === "ranking" && (
                    <RankingEscuelas cicloNombre={cicloObj.nombre} cicloId={cicloId} />
                )}

                {/* ========= VISTA: FECHAS DE CORTE ========= */}
                {vista === "gestion-fechas" && (
                    <GestionFechas 
                        programas={programas} 
                        readOnly={!hasAccess("fechas", "write")}
                        cicloNombre={cicloObj?.nombre}
                    />
                )}
                {/* ========= VISTA: GESTIÓN DE CICLOS ESCOLARES ========= */}
                {vista === "gestion-ciclos" && (
                    <GestionCiclos 
                        todosCiclos={todosCiclos} 
                        onSetMessage={setMessage} 
                        readOnly={!hasAccess("ciclos", "write")}
                    />
                )}
                {/* ========= VISTA: GESTIÓN DE ESCUELAS ========= */}
                {
                    vista === "gestion-escuelas" && (
                        <GestionEscuelas
                            programas={programas}
                            inicialEscuelas={escuelas.map(e => ({
                                id: e.id,
                                cct: e.cct,
                                nombre: e.nombre,
                                localidad: e.localidad,
                                municipio: e.municipio,
                                zonaEscolar: e.zonaEscolar,
                                director: e.director ?? null,
                                email: e.email ?? null,
                                ultimoIngreso: e.ultimoIngreso ?? null,
                                directorExpediente: e.directorExpediente ?? null,
                                esDePrueba: e.esDePrueba ?? false,
                                esSupervision: e.esSupervision ?? false,
                                usaApiPropia: e.usaApiPropia ?? false,
                                permisos: e.permisos ?? null,
                                personal: e.personal ?? [],
                            }))}
                            readOnly={!hasAccess("escuelas", "write")}
                        />
                    )
                }

                {/* ========= VISTA: GESTIÓN DE PROGRAMAS Y MÓDULOS ========= */}
                {vista === "gestion-programas" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        <div className="tab-list">
                            <button
                                onClick={() => setProgramasTab("programas")}
                                className={`tab-item ${programasTab === "programas" ? "active" : ""}`}
                            >
                                Programas y Módulos
                            </button>
                            <button
                                onClick={() => setProgramasTab("matriz-escuelas")}
                                className={`tab-item ${programasTab === "matriz-escuelas" ? "active" : ""}`}
                            >
                                ⚙️ Programas y Módulos por Escuela
                            </button>
                            <button
                                onClick={() => setProgramasTab("permisos-ia")}
                                className={`tab-item ${programasTab === "permisos-ia" ? "active" : ""}`}
                            >
                                🤖 Permisos de Herramientas de IA
                            </button>
                        </div>
                        {programasTab === "programas" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                                <GestionProgramas 
                                    inicialProgramas={programas} 
                                    cicloId={cicloId}
                                    cicloNombre={ciclo}
                                    readOnly={!hasAccess("programas", "write")}
                                    onGoToPermisosIA={() => setProgramasTab("permisos-ia")}
                                />
                                <hr style={{ border: "0", borderTop: "1px solid var(--border)" }} />
                                <PanelModulos 
                                    sidebarConfig={sidebarConfig} 
                                    readOnly={!hasAccess("modulosControl", "write")}
                                />
                            </div>
                        )}
                        {programasTab === "matriz-escuelas" && (
                            <ProgramasModulosPorEscuela 
                                escuelas={escuelas.map(e => ({
                                    id: e.id,
                                    cct: e.cct,
                                    nombre: e.nombre,
                                    localidad: e.localidad,
                                    esSupervision: e.esSupervision,
                                    permisos: e.permisos
                                }))}
                                programas={programas}
                                cicloId={cicloId}
                                readOnly={!hasAccess("escuelas", "write")}
                            />
                        )}
                        {programasTab === "permisos-ia" && (
                            <PermisosHerramientasIA 
                                escuelas={escuelas.map(e => ({
                                    id: e.id,
                                    cct: e.cct,
                                    nombre: e.nombre,
                                    esSupervision: e.esSupervision,
                                    permisos: e.permisos
                                }))}
                                readOnly={!hasAccess("rubricas", "write")}
                            />
                        )}
                    </div>
                )}

                {/* ========= VISTA: RECURSOS Y FORMATOS ========= */}
                {
                    vista === "recursos" && (
                        <GestionRecursos 
                            recursos={recursos} 
                            programas={programas} 
                            readOnly={!hasAccess("formatos", "write")}
                        />
                    )
                }

                {/* ========= VISTA: USUARIOS ATP (ACCESOS Y SEGURIDAD) ========= */}
                {
                    vista === "gestion-atps" && (
                        <GestionATPs />
                    )
                }




                {
                    vista === "eventos" && (
                        <GestionEventos readOnly={!hasAccess("eventos", "write")} />
                    )
                }

                {/* ========= VISTA: CONFIGURACIÓN CAPEMS ========= */}
                {
                    vista === "capems" && (
                        <GestionCapems readOnly={!hasAccess("capems", "write")} hasAccess={hasAccess} />
                    )
                }

                {/* ========= VISTA: CIRCULAR 05 ========= */}
                {
                    vista === "circular05" && (
                        <GestionCircular05 readOnly={!hasAccess("circular05", "write")} />
                    )
                }

                {/* ========= VISTA: OLIMPIADA MATEMÁTICAS ========= */}
                {
                    vista === "olimpiada" && (
                        <GestionOlimpiada readOnly={!hasAccess("olimpiada", "write")} />
                    )
                }

                {/* ========= VISTA: ENCUENTRO PAEC ========= */}
                {
                    vista === "paec" && (
                        <GestionEncuentroPAEC readOnly={!hasAccess("paec", "write")} />
                    )
                }



                {/* ========= VISTA: DOCUMENTOS ADMINISTRATIVOS ========= */}
                {
                    vista === "documentos" && (
                        <DocumentosAdmin hasAccess={hasAccess} />
                    )
                }

                {/* ========= VISTA: BIBLIOTECA DE NORMATIVAS SEP (RAG) ========= */}
                {
                    vista === "normativas" && (
                        <GestionNormativas />
                    )
                }

                {/* ========= VISTA: EXPEDIENTES DE PERSONAL ========= */}
                {
                    vista === "expedientes" && (
                        <GestionExpedientes 
                            highlightId={expedientesHighlightId} 
                            documentosReadOnly={!hasAccess("expedientes_documentos", "write")} 
                            personalReadOnly={!hasAccess("expedientes_personal", "write")} 
                        />
                    )

                }

                {
                    vista === "reportes-nivel" && (
                        <ReportesNivel />
                    )
                }

                {/* ========= VISTAS DE SUPERVISIÓN ========= */}
                {dbRole === "SUPERVISION" && supervisionEscuela && (
                    <>
                        {vista === "mis-entregas" && (
                            <EntregasListado programas={programasSupervision} onSetMessage={() => {}} />
                        )}
                        {vista === "ajustes-api" && (
                            <AjustesApiPanel escuela={supervisionEscuela} />
                        )}
                        {vista === "mis-expedientes" && (
                            <ExpedientesPanel escuela={{ id: supervisionEscuela.id, cct: supervisionEscuela.cct, nombre: supervisionEscuela.nombre }} />
                        )}
                    </>
                )}

                {/* ========= VISTA: HERRAMIENTAS DE IA ========= */}
                {vista === "herramientas-ia" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        <div style={{ display: "flex", gap: "1rem", borderBottom: "1px solid var(--border)" }}>
                            <button
                                onClick={() => setIaTab("rubricas")}
                                style={{
                                    padding: "0.5rem 1rem", background: "none", border: "none",
                                    borderBottom: iaTab === "rubricas" ? "2px solid var(--primary)" : "2px solid transparent",
                                    color: iaTab === "rubricas" ? "var(--primary)" : "var(--text-muted)",
                                    fontWeight: iaTab === "rubricas" ? 600 : 400, cursor: "pointer", fontSize: "0.875rem",
                                }}
                            >
                                Rúbricas y Prompts
                            </button>
                            <button
                                onClick={() => setIaTab("orquestador")}
                                style={{
                                    padding: "0.5rem 1rem", background: "none", border: "none",
                                    borderBottom: iaTab === "orquestador" ? "2px solid var(--primary)" : "2px solid transparent",
                                    color: iaTab === "orquestador" ? "var(--primary)" : "var(--text-muted)",
                                    fontWeight: iaTab === "orquestador" ? 600 : 400, cursor: "pointer", fontSize: "0.875rem",
                                }}
                            >
                                Orquestador de IA
                            </button>
                        </div>
                        {iaTab === "rubricas" && (
                            <GestionPrompts readOnly={!hasAccess("rubricas", "write")} />
                        )}
                        {iaTab === "orquestador" && (
                            <GestionLlavesIA 
                                onSetMessage={setMessage} 
                                readOnly={!hasAccess("orquestador", "write")}
                            />
                        )}
                    </div>
                )}

                {/* ========= VISTA: PLANEACIONES DIDÁCTICAS IA ========= */}
                {vista === "planeaciones-ia" && (
                    <PlaneacionesAdminPanel />
                )}

                {/* ========= VISTA: AUDITORÍA INTELIGENTE & DESCUBRIMIENTO ATP ========= */}
                {vista === "auditoria-inteligente" && (
                    <AuditoriaInteligentePanel 
                        readOnly={!hasAccess("auditoria_atp", "write")}
                    />
                )}

                {/* ========= VISTA: OFICIOS Y PLAZOS (ATP-MOD-01) ========= */}
                {vista === "oficios" && (
                    <OficiosPanel />
                )}

                {/* ========= VISTA: PLANTILLAS SPARH / CENSUS (ATP-MOD-02) ========= */}
                {vista === "plantillas-sparh" && (
                    <PlantillasSparhPanel readOnly={!hasAccess("auditoria_atp", "write")} />
                )}

                {/* ========= VISTA: ESTADÍSTICA 911 / SICEP (ATP-MOD-03) ========= */}
                {vista === "estadistica-911" && (
                    <Estadistica911Panel readOnly={!hasAccess("auditoria_atp", "write")} />
                )}

                {/* ========= VISTA: ACOMPAÑAMIENTO CTE (ATP-MOD-04) ========= */}
                {vista === "cte" && (
                    <CteSesionesPanel readOnly={!hasAccess("auditoria_atp", "write")} />
                )}

                {/* ========= VISTA: CONVOCATORIAS USICAMM (ATP-MOD-06) ========= */}
                {vista === "usicamm" && (
                    <UsicammPanel readOnly={!hasAccess("auditoria_atp", "write")} />
                )}

                {/* ========= VISTA: COMITÉS ESCOLARES (ATP-MOD-07) ========= */}
                {vista === "comites" && (
                    <ComitesPanel readOnly={!hasAccess("auditoria_atp", "write")} />
                )}

                {/* ========= VISTA: DIFUSIÓN DE BECAS (ATP-MOD-05) ========= */}
                {vista === "becas" && (
                    <BecasPanel readOnly={!hasAccess("auditoria_atp", "write")} />
                )}

                {/* ========= VISTA: ERRORES DEL SERVIDOR (P4) ========= */}
                {vista === "errores" && (
                    <ErroresServidorPanel />
                )}

                {/* ========= VISTA: CÉDULAS DE SUPERVISIÓN EN CAMPO (FASE 7B) ========= */}
                {vista === "cedulas-supervision" && (
                    <CedulasSupervisionPanel escuelas={escuelas} userEmail={userName} />
                )}
            </main >

            {/* Correction Modal */}
            {
                correccionModal && (
                    <div style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "1rem", zIndex: 1000,
                    }}>
                        <div className="card" style={{ maxWidth: "720px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
                            <h3 style={{ marginBottom: "0.5rem" }}>
                                <MessageSquare size={20} /> Enviar Corrección
                            </h3>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                                Para: <strong>{correccionModal.escuelaNombre}</strong>
                            </p>

                            {message && (
                                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1rem", padding: "0.5rem 0.75rem", fontSize: "0.8125rem", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                    <span style={{ flex: 1, color: "inherit" }}>{message.text}</span>
                                    <button onClick={() => setMessage(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", color: "inherit", paddingLeft: "0.5rem" }}>×</button>
                                </div>
                            )}

                            {/* 🔍 Observaciones Preliminares de la Supervisión (IA) */}
                            {(!correccionModal.preRevision || !correccionModal.preRevision.resultado || !correccionModal.preRevision.resultado.tipo) ? (
                                <div style={{
                                    marginBottom: "1rem", padding: "0.75rem", borderRadius: "8px",
                                    border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "0.8125rem"
                                }}>
                                    <h4 style={{ margin: "0 0 0.5rem", color: "#475569", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                        <Sparkles size={14} style={{ color: "var(--primary)" }} /> Pre-dictamen con IA no generado
                                    </h4>
                                    <p style={{ margin: "0 0 0.5rem", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                        Este documento se subió antes de activar la IA o no ha sido analizado.
                                    </p>
                                    {hasAccess("avances", "write") && (
                                        <button
                                            onClick={(e) => { e.preventDefault(); handleReEvaluate(); }}
                                            disabled={reEvaluating}
                                            style={{
                                                display: "inline-flex", alignItems: "center", gap: "0.375rem",
                                                padding: "0.25rem 0.5rem", fontSize: "0.75rem", borderRadius: "4px",
                                                background: reEvaluating ? "#60a5fa" : "var(--primary)", color: "white", border: "none",
                                                cursor: reEvaluating ? "not-allowed" : "pointer"
                                            }}
                                        >
                                            {reEvaluating ? (
                                                <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Analizando...</>
                                            ) : (
                                                <><RefreshCw size={12} /> Generar Pre-dictamen con IA</>
                                            )}
                                        </button>
                                    )}
                                </div>
                            ) : (() => {
                                const res = correccionModal.preRevision.resultado;
                                if (res.tipo === "DIA_NARANJA") {
                                    return (
                                        <div style={{
                                            marginBottom: "1rem", padding: "0.75rem", borderRadius: "8px",
                                            border: "1px solid #bfdbfe", background: "#eff6ff", fontSize: "0.8125rem"
                                        }}>
                                            <h4 style={{ margin: "0 0 0.5rem", color: "#1e40af", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                🔍 Observaciones de la Supervisión (Día Naranja)
                                            </h4>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                                {res.archivos?.map((file: any, i: number) => (
                                                    <div key={i} style={{ borderBottom: i < res.archivos.length - 1 ? "1px dashed #dbeafe" : "none", paddingBottom: "0.4rem" }}>
                                                        <div style={{ fontWeight: 600, color: "#1e3a8a" }}>{file.etiqueta || file.nombre}</div>
                                                        <div style={{ display: "flex", gap: "0.75rem", margin: "0.2rem 0" }}>
                                                            <span>Firma: {file.firmado ? "✅ Sí" : "❌ No"}</span>
                                                            <span>Sello: {file.sellado ? "✅ Sí" : "❌ No"}</span>
                                                        </div>
                                                        <div style={{ color: "#4b5563", fontSize: "0.75rem" }}>{file.explicacion}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }

                                if (res.tipo === "ACOSO_ESCOLAR") {
                                    return (
                                        <div style={{
                                            marginBottom: "1rem", padding: "0.75rem", borderRadius: "8px",
                                            border: res.tieneIncidencias ? "1px solid #fecaca" : "1px solid #bfdbfe",
                                            background: res.tieneIncidencias ? "#fdf2f2" : "#eff6ff", fontSize: "0.8125rem"
                                        }}>
                                            <h4 style={{
                                                margin: "0 0 0.5rem",
                                                color: res.tieneIncidencias ? "#991b1b" : "#1e40af",
                                                fontWeight: 700
                                            }}>
                                                🔍 Observaciones de la Supervisión (Acoso Escolar)
                                            </h4>

                                            {res.tieneIncidencias ? (
                                                <div>
                                                    <div style={{ fontWeight: 700, color: "#b91c1c", marginBottom: "0.5rem" }}>
                                                        ⚠️ Se detectaron incidencias reportadas (Archivo Excel)
                                                    </div>
                                                    <div style={{
                                                        maxHeight: "100px", overflowY: "auto", background: "white",
                                                        padding: "0.5rem", borderRadius: "6px", border: "1px solid #fca5a5",
                                                        marginBottom: "0.5rem"
                                                    }}>
                                                        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#374151" }}>
                                                            {res.incidenciasDetalle?.map((inc: any, idx: number) => (
                                                                <li key={idx} style={{ marginBottom: "0.25rem" }}>
                                                                    <strong>{inc.mes} ({inc.categoria}, {inc.edad} años)</strong>: {inc.tiposViolencia ? inc.tiposViolencia.join(", ") : inc.violencia?.join(", ") || "Acoso"} en {inc.escuela} ({inc.cct})
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    
                                                    {/* Borrador del correo */}
                                                    <div style={{ marginTop: "0.5rem" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                                            <span style={{ fontWeight: 600, color: "#7f1d1d" }}>📧 Borrador de Correo para Dirección General:</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    navigator.clipboard.writeText(res.borradorCorreo || "");
                                                                    const btn = e.currentTarget;
                                                                    const oldText = btn.innerText;
                                                                    btn.innerText = "✓ Copiado";
                                                                    setTimeout(() => { btn.innerText = oldText; }, 1500);
                                                                }}
                                                                style={{
                                                                    fontSize: "0.68rem", padding: "0.15rem 0.4rem", borderRadius: "4px",
                                                                    background: "#b91c1c", color: "white", border: "none", cursor: "pointer"
                                                                }}
                                                            >
                                                                Copiar Borrador
                                                            </button>
                                                        </div>
                                                        <pre style={{
                                                            margin: 0, padding: "0.5rem", background: "white",
                                                            border: "1px solid #fca5a5", borderRadius: "6px",
                                                            whiteSpace: "pre-wrap", maxHeight: "120px", overflowY: "auto",
                                                            fontSize: "0.75rem", fontFamily: "monospace", color: "#1f2937"
                                                        }}>
                                                            {res.borradorCorreo}
                                                        </pre>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div style={{ fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3rem" }}>
                                                        ✓ Reporte de Cero Incidencias (PDF)
                                                    </div>
                                                    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.3rem" }}>
                                                        <span>Firma: {res.firmado ? "✅ Sí" : "❌ No"}</span>
                                                        <span>Sello: {res.sellado ? "✅ Sí" : "❌ No"}</span>
                                                    </div>
                                                    <div style={{ color: "#4b5563", fontSize: "0.75rem" }}>{res.explicacion}</div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                if (res.tipo === "PMC" || res.tipo === "PAEC" || res.tipo === "INFORME_FINAL" || res.tipo === "PIPS") {
                                    const hasError = res.explicacion?.includes("Failed to download") || !res.borradorCorreo;
                                    return (
                                        <div style={{
                                            marginBottom: "1rem", padding: "0.75rem", borderRadius: "8px",
                                            border: res.tieneIncidencias || hasError ? "1px solid #fecaca" : "1px solid #bfdbfe",
                                            background: res.tieneIncidencias || hasError ? "#fdf2f2" : "#eff6ff", fontSize: "0.8125rem"
                                        }}>
                                            <h4 style={{
                                                margin: "0 0 0.5rem",
                                                color: res.tieneIncidencias || hasError ? "#991b1b" : "#1e40af",
                                                fontWeight: 700
                                            }}>
                                                🔍 Observaciones de la Supervisión ({res.tipo})
                                            </h4>
                                            {hasError ? (
                                                <div style={{ padding: "0.5rem", background: "white", border: "1px solid #fecaca", borderRadius: "6px", color: "#b91c1c" }}>
                                                    <p style={{ margin: 0, fontWeight: 600 }}>⚠️ La pre-revisión automática falló o está incompleta:</p>
                                                    <p style={{ margin: "0.25rem 0 0.5rem", fontSize: "0.75rem", color: "#4b5563" }}>{res.explicacion}</p>
                                                    {hasAccess("avances", "write") && (
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); handleReEvaluate(); }}
                                                            disabled={reEvaluating}
                                                            style={{
                                                                display: "inline-flex", alignItems: "center", gap: "0.375rem",
                                                                padding: "0.25rem 0.5rem", fontSize: "0.75rem", borderRadius: "4px",
                                                                background: reEvaluating ? "#ef4444" : "#dc2626", color: "white", border: "none",
                                                                cursor: reEvaluating ? "not-allowed" : "pointer",
                                                                opacity: reEvaluating ? 0.7 : 1
                                                            }}
                                                        >
                                                            {reEvaluating ? (
                                                                <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Re-evaluando...</>
                                                            ) : (
                                                                <><RefreshCw size={12} /> Re-intentar pre-evaluación automática</>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                                        <span style={{ fontWeight: 600, color: "var(--text)" }}>
                                                            Resultado sugerido: <span style={{ color: res.tieneIncidencias ? "#dc2626" : "#16a34a", fontWeight: 700 }}>
                                                                {res.tieneIncidencias ? "⚠️ Requiere Correcciones" : "✓ Aprobación"}
                                                            </span>
                                                        </span>
                                                        <span style={{ fontWeight: 700, background: "white", padding: "0.15rem 0.4rem", borderRadius: "4px", border: "1px solid var(--border)", color: "var(--text)" }}>
                                                            {res.explicacion?.match(/Puntuación obtenida: (.*?)\./)?.[1] || "Evaluado"}
                                                        </span>
                                                    </div>
                                                    
                                                    <div style={{ marginTop: "0.5rem" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                                            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                                                                📝 Retroalimentación Generada
                                                                {correccionModal.preRevision?.updatedAt && ` (${new Date(correccionModal.preRevision.updatedAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })})`}:
                                                            </span>
                                                            <div style={{ display: "flex", gap: "0.375rem" }}>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        navigator.clipboard.writeText(res.borradorCorreo || "");
                                                                        const btn = e.currentTarget;
                                                                        const oldText = btn.innerText;
                                                                        btn.innerText = "✓ Copiado";
                                                                        setTimeout(() => { btn.innerText = oldText; }, 1500);
                                                                    }}
                                                                    style={{
                                                                        fontSize: "0.68rem", padding: "0.15rem 0.4rem", borderRadius: "4px",
                                                                        background: "var(--primary)", color: "white", border: "none", cursor: "pointer"
                                                                    }}
                                                                >
                                                                    Copiar
                                                                </button>
                                                                <a
                                                                    href={`/api/admin/entregas/${correccionModal.entregaId}/exportar-revision`}
                                                                    download
                                                                    style={{
                                                                        textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                                                        fontSize: "0.68rem", padding: "0.15rem 0.4rem", borderRadius: "4px",
                                                                        background: "#0f766e", color: "white", fontWeight: 600, border: "none", cursor: "pointer"
                                                                    }}
                                                                >
                                                                    <Download size={11} /> Descargar Reporte (.docx)
                                                                </a>
                                                                {hasAccess("avances", "write") && (
                                                                    <>
                                                                        <button
                                                                            onClick={(e) => { e.preventDefault(); handleReEvaluate(); }}
                                                                            disabled={reEvaluating}
                                                                            style={{
                                                                                fontSize: "0.68rem", padding: "0.15rem 0.4rem", borderRadius: "4px",
                                                                                background: reEvaluating ? "#dbeafe" : "#e2e8f0",
                                                                                color: reEvaluating ? "#1e40af" : "#1e293b",
                                                                                border: reEvaluating ? "1px solid #bfdbfe" : "1px solid #cbd5e1",
                                                                                cursor: reEvaluating ? "not-allowed" : "pointer",
                                                                                display: "inline-flex", alignItems: "center", gap: "0.25rem"
                                                                            }}
                                                                        >
                                                                            {reEvaluating ? (
                                                                                <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Re-evaluando...</>
                                                                            ) : (
                                                                                <><RefreshCw size={11} /> Re-evaluar</>
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.preventDefault(); handleResetAttempts(); }}
                                                                            disabled={resettingAttempts}
                                                                            style={{
                                                                                fontSize: "0.68rem", padding: "0.15rem 0.4rem", borderRadius: "4px",
                                                                                background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", cursor: "pointer",
                                                                                display: "inline-flex", alignItems: "center", gap: "0.25rem"
                                                                            }}
                                                                            title="Reiniciar contador de autoevaluaciones realizadas por el director"
                                                                        >
                                                                            {resettingAttempts ? (
                                                                                <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Reiniciando...</>
                                                                            ) : (
                                                                                <><RefreshCw size={11} /> Reiniciar Intentos ({correccionModal.preRevision?.intentosUsados ?? 0})</>
                                                                            )}
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div style={{
                                                            margin: 0, padding: "0.5rem 0.75rem", background: "white",
                                                            border: "1px solid var(--border)", borderRadius: "6px",
                                                            maxHeight: "400px", overflowY: "auto",
                                                            fontSize: "0.78rem", color: "var(--text)", lineHeight: "1.5"
                                                        }}>
                                                            <div className="markdown-feedback" style={{ whiteSpace: "pre-wrap" }}>
                                                                {res.borradorCorreo}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                }

                                if (res.tipo === "CULTURA_PAZ") {
                                    return (
                                        <div style={{
                                            marginBottom: "1rem", padding: "0.75rem", borderRadius: "8px",
                                            border: res.tieneIncidencias || res.aprobado === false ? "1px solid #fecaca" : "1px solid #bbf7d0",
                                            background: res.tieneIncidencias || res.aprobado === false ? "#fdf2f2" : "#f0fdf4", fontSize: "0.8125rem"
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                                <h4 style={{ margin: 0, color: "#15803d", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                    🕊️ Pre-Revisión: Cultura de Paz (Semestre &quot;A&quot;)
                                                </h4>
                                                <span style={{ fontWeight: 700, background: "white", padding: "0.15rem 0.4rem", borderRadius: "4px", border: "1px solid #86efac", color: "#166534" }}>
                                                    {res.puntuacion || "Evaluado"}
                                                </span>
                                            </div>

                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                                <div style={{ background: "white", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #dcfce7" }}>
                                                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", display: "block" }}>Evidencia Gráfica/Fotos</span>
                                                    <strong style={{ color: res.tieneEvidenciaFotografica ? "#16a34a" : "#dc2626" }}>
                                                        {res.tieneEvidenciaFotografica ? "✅ Detectadas" : "❌ No detectadas"}
                                                    </strong>
                                                </div>
                                                <div style={{ background: "white", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #dcfce7" }}>
                                                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", display: "block" }}>Firmas y Sellos</span>
                                                    <strong style={{ color: res.tieneFirmasSellos ? "#16a34a" : "#dc2626" }}>
                                                        {res.tieneFirmasSellos ? "✅ Cumple" : "❌ Incompleto"}
                                                    </strong>
                                                </div>
                                                <div style={{ background: "white", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #dcfce7" }}>
                                                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", display: "block" }}>Participantes</span>
                                                    <strong style={{ color: "#1e3a8a" }}>{res.participantesEstimados || "N/D"}</strong>
                                                </div>
                                            </div>

                                            {res.resumenActividad && (
                                                <div style={{ marginTop: "0.5rem", background: "white", padding: "0.5rem", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                                        <strong style={{ color: "#166534", fontSize: "0.75rem" }}>📋 Resumen Ejecutivo de la Actividad (para Formulario de Zona):</strong>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                navigator.clipboard.writeText(res.resumenActividad || "");
                                                                const btn = e.currentTarget;
                                                                const oldText = btn.innerText;
                                                                btn.innerText = "✓ Copiado";
                                                                setTimeout(() => { btn.innerText = oldText; }, 1500);
                                                            }}
                                                            style={{
                                                                fontSize: "0.68rem", padding: "0.15rem 0.4rem", borderRadius: "4px",
                                                                background: "#16a34a", color: "white", border: "none", cursor: "pointer"
                                                            }}
                                                        >
                                                            Copiar Resumen
                                                        </button>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#374151", lineHeight: "1.4" }}>
                                                        {res.resumenActividad}
                                                    </p>
                                                </div>
                                            )}

                                            {res.explicacion && (
                                                <div style={{ marginTop: "0.5rem", color: "#4b5563", fontSize: "0.75rem" }}>
                                                    <strong>Observaciones del modelo:</strong> {res.explicacion}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                if (res.tipo === "PIPC") {
                                    return (
                                        <div style={{
                                            marginBottom: "1rem", padding: "0.75rem", borderRadius: "8px",
                                            border: res.tieneIncidencias || res.aprobado === false ? "1px solid #fecaca" : "1px solid #fed7aa",
                                            background: res.tieneIncidencias || res.aprobado === false ? "#fdf2f2" : "#fff7ed", fontSize: "0.8125rem"
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                                <h4 style={{ margin: 0, color: "#c2410c", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                    🦺 Pre-Revisión: Programa Interno de Protección Civil (PIPC)
                                                </h4>
                                                <span style={{ fontWeight: 700, background: "white", padding: "0.15rem 0.4rem", borderRadius: "4px", border: "1px solid #fdba74", color: "#9a3412" }}>
                                                    {res.puntuacion || "Evaluado"}
                                                </span>
                                            </div>

                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                                <div style={{ background: "white", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #fed7aa" }}>
                                                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", display: "block" }}>Acta de Brigadas</span>
                                                    <strong style={{ color: res.tieneBrigadas ? "#16a34a" : "#dc2626" }}>
                                                        {res.tieneBrigadas ? "✅ Presente" : "❌ No detectada"}
                                                    </strong>
                                                </div>
                                                <div style={{ background: "white", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #fed7aa" }}>
                                                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", display: "block" }}>Plan de Evacuación</span>
                                                    <strong style={{ color: res.tienePlanEvacuacion ? "#16a34a" : "#dc2626" }}>
                                                        {res.tienePlanEvacuacion ? "✅ Presente" : "❌ No detectado"}
                                                    </strong>
                                                </div>
                                                <div style={{ background: "white", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #fed7aa" }}>
                                                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", display: "block" }}>Croquis / Señalética</span>
                                                    <strong style={{ color: res.tieneCroquisSenaletica ? "#16a34a" : "#dc2626" }}>
                                                        {res.tieneCroquisSenaletica ? "✅ Presente" : "❌ No detectado"}
                                                    </strong>
                                                </div>
                                                <div style={{ background: "white", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #fed7aa" }}>
                                                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", display: "block" }}>Directorio Emergencias</span>
                                                    <strong style={{ color: res.tieneDirectorioEmergencias ? "#16a34a" : "#dc2626" }}>
                                                        {res.tieneDirectorioEmergencias ? "✅ Presente" : "❌ No detectado"}
                                                    </strong>
                                                </div>
                                            </div>

                                            {res.explicacion && (
                                                <div style={{ marginTop: "0.5rem", color: "#4b5563", fontSize: "0.75rem" }}>
                                                    <strong>Observaciones:</strong> {res.explicacion}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                if (res.tipo === "SEGUROS") {
                                    return (
                                        <div style={{
                                            marginBottom: "1rem", padding: "0.75rem", borderRadius: "8px",
                                            border: res.tieneIncidencias || res.aprobado === false ? "1px solid #fecaca" : "1px solid #e9d5ff",
                                            background: res.tieneIncidencias || res.aprobado === false ? "#fdf2f2" : "#faf5ff", fontSize: "0.8125rem"
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                                <h4 style={{ margin: 0, color: "#7e22ce", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                    🛡️ Pre-Revisión: Seguros y Reporte de Siniestros
                                                </h4>
                                                <span style={{ fontWeight: 700, background: "white", padding: "0.15rem 0.4rem", borderRadius: "4px", border: "1px solid #d8b4fe", color: "#6b21a8" }}>
                                                    {res.puntuacion || "Evaluado"}
                                                </span>
                                            </div>

                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                                <div style={{ background: "white", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #f3e8ff" }}>
                                                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", display: "block" }}>Tipo de Siniestro</span>
                                                    <strong style={{ color: "#6b21a8" }}>{res.tipoSiniestroReportado || "Cero siniestros / Informativo"}</strong>
                                                </div>
                                                <div style={{ background: "white", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #f3e8ff" }}>
                                                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", display: "block" }}>Póliza Referenciada</span>
                                                    <strong style={{ color: res.tienePolizaReferenciada ? "#16a34a" : "#dc2626" }}>
                                                        {res.tienePolizaReferenciada ? "✅ Sí" : "❌ No"}
                                                    </strong>
                                                </div>
                                                <div style={{ background: "white", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #f3e8ff" }}>
                                                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", display: "block" }}>Evidencia de Soporte</span>
                                                    <strong style={{ color: res.tieneEvidenciaSoporte ? "#16a34a" : "#dc2626" }}>
                                                        {res.tieneEvidenciaSoporte ? "✅ Sí" : "❌ No"}
                                                    </strong>
                                                </div>
                                            </div>

                                            {res.explicacion && (
                                                <div style={{ marginTop: "0.5rem", color: "#4b5563", fontSize: "0.75rem" }}>
                                                    <strong>Observaciones:</strong> {res.explicacion}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                if (res.explicacion) {
                                    return (
                                        <div style={{
                                            marginBottom: "1rem", padding: "0.75rem", borderRadius: "8px",
                                            border: res.tieneIncidencias || res.aprobado === false ? "1px solid #fecaca" : "1px solid #bfdbfe",
                                            background: res.tieneIncidencias || res.aprobado === false ? "#fdf2f2" : "#eff6ff", fontSize: "0.8125rem"
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                                                <h4 style={{ margin: 0, color: "#1e40af", fontWeight: 700 }}>
                                                    🔍 Observaciones de la Supervisión ({res.tipo})
                                                </h4>
                                                {res.puntuacion && (
                                                    <span style={{ fontWeight: 700, background: "white", padding: "0.15rem 0.4rem", borderRadius: "4px", border: "1px solid var(--border)" }}>
                                                        {res.puntuacion}
                                                    </span>
                                                )}
                                            </div>
                                            <p style={{ margin: 0, color: "#374151" }}>{res.explicacion}</p>
                                        </div>
                                    );
                                }

                                return null;
                            })()}

                            {correccionModal.history && correccionModal.history.length > 0 && (
                                <div style={{
                                    maxHeight: "200px", overflowY: "auto", marginBottom: "1rem",
                                    padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border)",
                                }}>
                                    <h4 style={{ fontSize: "0.8125rem", margin: "0 0 0.5rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        Historial de Correcciones
                                    </h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                        {correccionModal.history.map((hist) => (
                                            <div key={hist.id} style={{ fontSize: "0.8125rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                                                    <strong>{hist.admin?.nombre || "ATP"}</strong>
                                                    <span>{new Date(hist.createdAt).toLocaleDateString()} {new Date(hist.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                </div>
                                                <div style={{ color: "var(--text)" }}>{hist.texto || <em style={{ color: "var(--text-muted)" }}>[Sin texto, solo adjunto]</em>}</div>
                                                {hist.archivo && hist.archivo.driveUrl && (
                                                    <a
                                                        href={getDownloadUrl(hist.archivo.driveUrl, hist.archivo.nombre, hist.archivo.driveId) || "#"}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginTop: "0.25rem", color: "var(--primary)", textDecoration: "none", fontWeight: 500 }}
                                                    >
                                                        <FileText size={12} /> {hist.archivo.nombre}
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {hasAccess("avances", "write") ? (
                                <>
                                    <textarea
                                        value={correccionTexto}
                                        onChange={(e) => setCorreccionTexto(e.target.value)}
                                        placeholder="Escribe las correcciones necesarias..."
                                        style={{
                                            width: "100%", minHeight: "120px", padding: "0.75rem",
                                            borderRadius: "8px", border: "1px solid var(--border)",
                                            fontFamily: "inherit", fontSize: "0.875rem", resize: "vertical",
                                        }}
                                    />

                                    <div style={{ marginTop: "1rem" }}>
                                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                                            Adjuntar Archivo de Corrección (Opcional)
                                        </label>
                                        <input
                                            type="file"
                                            className="form-control"
                                            onChange={(e) => setCorreccionFile(e.target.files ? e.target.files[0] : null)}
                                            style={{ padding: "0.5rem", fontSize: "0.875rem" }}
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.png"
                                        />
                                    </div>

                                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                                        <button
                                            className="btn btn-outline"
                                            onClick={() => { setCorreccionModal(null); setCorreccionTexto(""); setCorreccionFile(null); }}
                                            style={{ flex: 1 }}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleSendCorreccion}
                                            disabled={sendingCorreccion || (!correccionTexto.trim() && !correccionFile)}
                                            style={{ flex: 1 }}
                                        >
                                            {sendingCorreccion ? "Enviando..." : (
                                                <><Send size={16} /> Enviar</>
                                            )}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div style={{ display: "flex", marginTop: "1rem" }}>
                                    <button
                                        className="btn btn-outline"
                                        onClick={() => { setCorreccionModal(null); setCorreccionTexto(""); setCorreccionFile(null); }}
                                        style={{ flex: 1 }}
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
            {/* Modal de Personalización de Oficio de Dictamen */}
            {oficioModal && (
                <div className="modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="modal-card" style={{ maxWidth: "500px" }}>
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <FileText size={20} style={{ color: "var(--primary)" }} />
                                Emitir Oficio de Dictamen
                            </h3>
                            <button
                                className="modal-close"
                                onClick={() => setOficioModal(null)}
                            >
                                <XIcon size={18} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", margin: 0 }}>
                                Rellena los datos institucionales para el oficio membretado dirigido a la dirección de la escuela <strong>{oficioModal.escuelaNombre}</strong>.
                            </p>

                            <div>
                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                                    Número correlativo de Oficio
                                </label>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{`SEP-${(new Date().getMonth() + 1 >= 8 || new Date().getMonth() + 1 === 1) ? "A" : "B"}/ZONA004/`}</span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={oficioNumInput}
                                        onChange={(e) => setOficioNumInput(e.target.value)}
                                        placeholder="089/2026"
                                        style={{ width: "100px" }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                                    Lugar y Fecha del Oficio
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={oficioLugarFechaInput}
                                    onChange={(e) => setOficioLugarFechaInput(e.target.value)}
                                    style={{ width: "100%" }}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                                    Observaciones / Texto Adicional (Opcional)
                                </label>
                                <textarea
                                    className="form-control"
                                    value={oficioTextoAdicional}
                                    onChange={(e) => setOficioTextoAdicional(e.target.value)}
                                    placeholder="Agrega comentarios o felicitaciones particulares que se incluirán en el cuerpo del oficio..."
                                    style={{ width: "100%", height: "100px", fontSize: "0.8125rem" }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer" style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setOficioModal(null)}
                                style={{ flex: 1 }}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleDownloadOficio}
                                disabled={generatingOficio}
                                style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}
                            >
                                {generatingOficio ? (
                                    <Loader2 size={16} className="spin" />
                                ) : (
                                    <Download size={16} />
                                )}
                                Descargar (.docx)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BuscadorGlobal
                isOpen={searchOpen}
                onClose={() => setSearchOpen(false)}
                onNavigate={(view, targetId) => {
                    setVista(view as any);
                    if (view === "expedientes" && targetId) {
                        setExpedientesHighlightId(targetId);
                    }
                }}
                role="admin"
            />
        </div >
    );
}
