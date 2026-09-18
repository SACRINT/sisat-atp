"use client";

import { useState, useEffect, useMemo } from "react";
import {
    FileText, Upload, ChevronDown, ChevronUp, AlertTriangle,
    CheckCircle, Clock, XCircle, Download, RefreshCw, Trash2,
    BookOpen, Star, AlertCircle, Lock, Users, Layers, Filter, Check, Plus, Edit2, Search, Sparkles
} from "lucide-react";
import { Packer, Document, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType } from "docx";
import toast from "react-hot-toast";
import {
    generarGruposPorEstructura,
    obtenerAsignaturasParaGrupo,
    resolverSocioemocionalGrupo,
    FORMACIONES_LABORALES,
    FFE_OPTATIVAS_CATALOGO,
    GrupoDefinicion,
    EscuelaEstructuraGrupos
} from "@/lib/escuela-grupos";
import ModalConfiguracionMapaCurricular from "@/components/ModalConfiguracionMapaCurricular";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Requisitos {
    puedeUsar: boolean;
    tieneApiKey: boolean;
    tienePaecPec: boolean;
    requierePaecPec?: boolean;
    requiereApiKey?: boolean;
    motivoBloqueo: string | null;
}

interface CriterioResultado {
    id: string;
    criterio: string;
    categoria: string;
    puntajeMax: number;
    puntajeObtenido: number;
    cumple: "SI" | "PARCIAL" | "NO";
    evidencia: string;
    observacion: string;
    recomendacion: string;
}

interface Planeacion {
    id: string;
    docenteNombre: string;
    grupoNombre?: string | null;
    tipoSemestrePeriodo?: string;
    asignatura: string;
    semestre: number;
    bloqueCorte?: string;
    tipoAsignatura: string;
    archivoNombre: string;
    archivoUrl: string;
    estado: string;
    puntajeObtenido?: number;
    puntajeMaximo?: number;
    nivelCumplimiento?: string;
    resultadoJson?: { rubricaUsada: string; criterios: CriterioResultado[] };
    observacionesJson?: {
        puntosFuertes: string[];
        mejorasUrgentes: string[];
        observacionesExtendidas: string;
        alineacionPaecPec: string;
    };
    retroalimentacionDocente?: string;
    fechaSubida: string;
    fechaRevision?: string;
}

interface PersonalDocente {
    id: string;
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    rfc?: string | null;
    cargo?: string | null;
}

interface CargaDocente {
    id: string;
    personalId: string;
    grupo: { nombre: string };
    asignatura: { uacName: string };
    personal: PersonalDocente;
}

interface Props {
    escuela: {
        id: string;
        cct: string;
        nombre: string;
        gruposPrimerAno?: number;
        gruposSegundoAno?: number;
        gruposTercerAno?: number;
        mapaCurricularCompletado?: boolean;
    };
    readOnly?: boolean;
    isAdmin?: boolean;
}

// ── Generador de Word ────────────────────────────────────────────────────────

async function generarWordRetroalimentacion(planeacion: Planeacion): Promise<void> {
    const criterios = planeacion.resultadoJson?.criterios ?? [];
    const obs = planeacion.observacionesJson;
    const pct = Math.round(((planeacion.puntajeObtenido ?? 0) / (planeacion.puntajeMaximo ?? 300)) * 100);
    const fecha = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });

    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "RETROALIMENTACIÓN DE PLANEACIÓN DIDÁCTICA", bold: true, size: 28 })] }),
                new Paragraph({ children: [new TextRun({ text: `Fecha: ${fecha}`, size: 22, color: "555555" })] }),
                new Paragraph({ children: [new TextRun("")] }),

                // Datos de Identificación
                new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "I. DATOS DE IDENTIFICACIÓN", bold: true })] }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Docente:", bold: true })] })] }), new TableCell({ children: [new Paragraph(planeacion.docenteNombre)] })] }),
                        new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Grupo:", bold: true })] })] }), new TableCell({ children: [new Paragraph(planeacion.grupoNombre || "No especificado")] })] }),
                        new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Asignatura / UAC:", bold: true })] })] }), new TableCell({ children: [new Paragraph(planeacion.asignatura)] })] }),
                        new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Semestre:", bold: true })] })] }), new TableCell({ children: [new Paragraph(`${planeacion.semestre}° Semestre`)] })] }),
                        new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bloque/Corte:", bold: true })] })] }), new TableCell({ children: [new Paragraph(planeacion.bloqueCorte ?? "No especificado")] })] }),
                        new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Puntaje Obtenido:", bold: true })] })] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${planeacion.puntajeObtenido ?? 0} / ${planeacion.puntajeMaximo ?? 300} pts (${pct}%)`, bold: true, color: pct >= 85 ? "16a34a" : pct >= 60 ? "d97706" : "dc2626" })] })] })] }),
                    ],
                }),

                new Paragraph({ children: [new TextRun("")] }),

                // Fortalezas
                ...(obs?.puntosFuertes?.length ? [
                    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "II. FORTALEZAS DESTACADAS", bold: true })] }),
                    ...obs.puntosFuertes.map(p => new Paragraph({ bullet: { level: 0 }, children: [new TextRun(p)] })),
                    new Paragraph({ children: [new TextRun("")] }),
                ] : []),

                // Mejoras urgentes
                ...(obs?.mejorasUrgentes?.length ? [
                    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "III. MEJORAS URGENTES", bold: true })] }),
                    ...obs.mejorasUrgentes.map(m => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: m, color: "dc2626" })] })),
                    new Paragraph({ children: [new TextRun("")] }),
                ] : []),

                // Tabla de criterios
                new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "IV. EVALUACIÓN POR CRITERIO (ANEXO 12 USICAMM)", bold: true })] }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            tableHeader: true,
                            children: ["Criterio", "Pts Máx", "Pts Obtenidos", "Cumple", "Observación"].map(h =>
                                new TableCell({ shading: { fill: "2E5F9A" }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 18 })] })] })
                            ),
                        }),
                        ...criterios.map((c, i) => new TableRow({
                            children: [
                                new TableCell({ shading: { fill: i % 2 === 0 ? "EFF5FB" : "FFFFFF" }, children: [new Paragraph({ children: [new TextRun({ text: c.criterio, size: 18 })] })] }),
                                new TableCell({ shading: { fill: i % 2 === 0 ? "EFF5FB" : "FFFFFF" }, children: [new Paragraph({ children: [new TextRun({ text: String(c.puntajeMax), size: 18 })] })] }),
                                new TableCell({ shading: { fill: i % 2 === 0 ? "EFF5FB" : "FFFFFF" }, children: [new Paragraph({ children: [new TextRun({ text: String(c.puntajeObtenido), bold: true, color: c.cumple === "SI" ? "16a34a" : c.cumple === "PARCIAL" ? "d97706" : "dc2626", size: 18 })] })] }),
                                new TableCell({ shading: { fill: i % 2 === 0 ? "EFF5FB" : "FFFFFF" }, children: [new Paragraph({ children: [new TextRun({ text: c.cumple === "SI" ? "✓ Sí" : c.cumple === "PARCIAL" ? "⚠ Parcial" : "✗ No", bold: true, color: c.cumple === "SI" ? "16a34a" : c.cumple === "PARCIAL" ? "d97706" : "dc2626", size: 18 })] })] }),
                                new TableCell({ shading: { fill: i % 2 === 0 ? "EFF5FB" : "FFFFFF" }, children: [new Paragraph({ children: [new TextRun({ text: c.observacion, size: 18 })] })] }),
                            ],
                        })),
                    ],
                }),
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Dictamen_Planeacion_${planeacion.docenteNombre.replace(/\s+/g, "_")}_${planeacion.asignatura.replace(/\s+/g, "_")}.docx`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// ── Componente Principal ─────────────────────────────────────────────────────

export default function GestionPlaneaciones({ escuela: inicialEscuela, readOnly = false, isAdmin = false }: Props) {

    const [escuelaData, setEscuelaData] = useState(inicialEscuela);
    const [requisitos, setRequisitos] = useState<Requisitos | null>(null);
    const [planeaciones, setPlaneaciones] = useState<Planeacion[]>([]);
    const [personalList, setPersonalList] = useState<PersonalDocente[]>([]);
    const [cargasList, setCargasList] = useState<CargaDocente[]>([]);
    const [gruposDB, setGruposDB] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);

    // Controles de Vista
    const [periodoSemestral, setPeriodoSemestral] = useState<"SEMESTRE_A" | "SEMESTRE_B">("SEMESTRE_A");
    const [vistaModo, setVistaModo] = useState<"GRUPOS" | "DOCENTES">("GRUPOS");
    const [grupoSeleccionadoId, setGrupoSeleccionadoId] = useState<string>("TODOS");
    const [busquedaDocente, setBusquedaDocente] = useState<string>("");

    // Modal Subida
    const [modalSubidaAbierto, setModalSubidaAbierto] = useState(false);
    const [formSubida, setFormSubida] = useState({
        docenteNombre: "",
        docenteId: "",
        grupoNombre: "",
        semestre: 1,
        asignatura: "",
        bloqueCorte: "Corte 1 - Bloque I",
        tipoAsignatura: "FUNDAMENTAL",
        archivo: null as File | null,
    });
    const [subiendo, setSubiendo] = useState(false);

    // Modal Detalle & Modal Mapa Curricular
    const [modalDetalle, setModalDetalle] = useState<Planeacion | null>(null);
    const [asignandoMap, setAsignandoMap] = useState<Record<string, boolean>>({});
    const [reintentandoIdMap, setReintentandoIdMap] = useState<Record<string, boolean>>({});
    const [mapaModalAbierto, setMapaModalAbierto] = useState(false);

    // Cargar datos al montar
    const cargarDatos = async () => {
        setCargando(true);
        try {
            const res = await fetch(`/api/director/planeaciones?escuelaId=${escuelaData.id}`);
            if (!res.ok) throw new Error("Error al consultar datos");
            const data = await res.json();
            
            if (data.escuela) {
                setEscuelaData(data.escuela);
                if (data.escuela.mapaCurricularCompletado === false) {
                    setMapaModalAbierto(true);
                }
            }
            setRequisitos(data.requisitos || { puedeUsar: true, tieneApiKey: true, tienePaecPec: true, motivoBloqueo: null });
            setPlaneaciones(data.planeaciones || []);
            setPersonalList(data.personal || []);
            setCargasList(data.cargas || []);
            setGruposDB(data.grupos || []);
        } catch (err: any) {
            toast.error("No se pudieron cargar las planeaciones de la escuela");
            setRequisitos({ puedeUsar: true, tieneApiKey: true, tienePaecPec: true, motivoBloqueo: null });
        } finally {
            setCargando(false);
        }
    };

    const handleGuardarConfigGrupo = async (grupoNombre: string, semestre: number, capacitacionNombre: string, ffeOptativas?: string[]) => {
        try {
            const res = await fetch(`/api/escuelas/${escuelaData.id}/grupos-config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ grupoNombre, semestre, capacitacionNombre, ffeOptativas })
            });
            if (!res.ok) throw new Error("Error al guardar");
            toast.success(`Capacitación ${capacitacionNombre} guardada para ${grupoNombre}`);
            setGruposDB(prev => {
                const idx = prev.findIndex((g: any) => g.nombre === grupoNombre);
                if (idx >= 0) {
                    const copia = [...prev];
                    copia[idx] = { ...copia[idx], capacitacionNombre, ffeOptativas };
                    return copia;
                }
                return [...prev, { nombre: grupoNombre, semestre, capacitacionNombre, ffeOptativas }];
            });
        } catch (err: any) {
            toast.error("Error al actualizar la capacitación del grupo");
        }
    };

    const handleReiniciarMapaCurricular = async () => {
        if (!confirm(`¿Estás SEGURO de reiniciar completamente el Mapa Curricular del plantel ${escuelaData.nombre}? Se eliminarán los grupos y configuraciones previas para poder llenar el formulario desde cero.`)) return;

        setCargando(true);
        try {
            const res = await fetch(`/api/escuelas/${escuelaData.id}/mapa-curricular`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Mapa curricular reiniciado exitosamente.");
                try {
                    localStorage.removeItem(`horarios_wizard_v4_${escuelaData.id}`);
                } catch (e) {}
                setEscuelaData(prev => ({ ...prev, mapaCurricularCompletado: false }));
                setMapaModalAbierto(true);
                cargarDatos();
            } else {
                toast.error(data.error || "Error al reiniciar el mapa curricular.");
            }
        } catch (err: any) {
            toast.error("Error de conexión al servidor.");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, [escuelaData.id]);


    // Generar la lista dinámica de grupos según la estructura de la escuela (ej. 2-1-1)
    const gruposGenerados = useMemo(() => {
        return generarGruposPorEstructura(escuelaData, periodoSemestral);
    }, [escuelaData, periodoSemestral]);

    // Personal filtrado que sí puede impartir clases (Docentes, Directores, Responsables de Plantel, ATPs, Administrativos)
    // Excluir exclusivamente Personal de Asistencia / Apoyo Administrativo
    const personalFiltradoParaClases = useMemo(() => {
        return personalList.filter(p => {
            if (!p.cargo) return true;
            const cargoUpper = p.cargo.toUpperCase();
            return (
                !cargoUpper.includes("ASISTENCIA") &&
                !cargoUpper.includes("APOYO") &&
                cargoUpper !== "PERSONAL_DE_ASISTENCIA" &&
                cargoUpper !== "APOYO_ADMINISTRATIVO"
            );
        });
    }, [personalList]);

    // Mapa de asignación de docentes por grupo y UAC
    const asignacionesDocentesMap = useMemo(() => {
        const map: Record<string, { personalId: string; docenteNombre: string }> = {};
        cargasList.forEach(c => {
            if (c.grupo?.nombre && c.asignatura?.uacName) {
                const key = `${c.grupo.nombre}__${c.asignatura.uacName}`;
                const nombreCompleto = `${c.personal.nombre} ${c.personal.apellidoPaterno} ${c.personal.apellidoMaterno || ""}`.trim();
                map[key] = { personalId: c.personalId, docenteNombre: nombreCompleto };
            }
        });
        return map;
    }, [cargasList]);

    // Mapa de planeaciones subidas por grupo y UAC
    const planeacionesSubidasMap = useMemo(() => {
        const map: Record<string, Planeacion> = {};
        planeaciones.forEach(p => {
            if (p.grupoNombre && p.asignatura) {
                const key = `${p.grupoNombre}__${p.asignatura}`;
                // Guardar la más reciente
                if (!map[key] || new Date(p.fechaSubida) > new Date(map[key].fechaSubida)) {
                    map[key] = p;
                }
            }
        });
        return map;
    }, [planeaciones]);

    // Guardar asignación de docente a una UAC de un grupo
    const handleAsignarDocente = async (grupoNombre: string, semestre: number, asignatura: string, personalId: string) => {
        const key = `${grupoNombre}__${asignatura}`;
        setAsignandoMap(prev => ({ ...prev, [key]: true }));

        try {
            const res = await fetch("/api/director/planeaciones/asignaciones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    escuelaId: escuelaData.id,
                    grupoNombre,
                    semestre,
                    asignatura,
                    personalId
                })
            });

            if (!res.ok) throw new Error("Error al asignar docente");

            const selectedDoc = personalList.find(p => p.id === personalId);
            const nombreDoc = selectedDoc ? `${selectedDoc.nombre} ${selectedDoc.apellidoPaterno}` : "";

            setCargasList(prev => {
                const filtradas = prev.filter(c => !(c.grupo?.nombre === grupoNombre && c.asignatura?.uacName === asignatura));
                if (selectedDoc) {
                    filtradas.push({
                        id: `temp-${Date.now()}`,
                        personalId,
                        grupo: { nombre: grupoNombre },
                        asignatura: { uacName: asignatura },
                        personal: selectedDoc
                    });
                }
                return filtradas;
            });

            toast.success(personalId === "SIN_ASIGNAR" ? `Asignación removida para ${asignatura}` : `Asignado a ${nombreDoc}`);
        } catch (err: any) {
            toast.error("Error al actualizar docente asignado");
        } finally {
            setAsignandoMap(prev => ({ ...prev, [key]: false }));
        }
    };

    // Total de planeaciones requeridas según la estructura curricular activa del plantel
    const totalPlaneacionesEsperadas = useMemo(() => {
        let total = 0;
        gruposGenerados.forEach(grupo => {
            const letraGrupo = grupo.nombre.split(" ")[1];
            const hGrupo3 = gruposDB.find((g: any) => g.nombre === `3° ${letraGrupo}` || g.nombre === `3º ${letraGrupo}`);
            const hGrupo5 = gruposDB.find((g: any) => g.nombre === `5° ${letraGrupo}` || g.nombre === `5º ${letraGrupo}`);
            const hGrupo = gruposDB.find((g: any) => g.nombre === grupo.nombre)
                || (grupo.semestre === 4 ? hGrupo3 : grupo.semestre === 6 ? hGrupo5 : undefined);

            const capNombre = hGrupo?.capacitacionNombre || hGrupo3?.capacitacionNombre || hGrupo5?.capacitacionNombre || "Administracion";
            const ffeOpts = (Array.isArray(hGrupo?.ffeOptativas) && hGrupo.ffeOptativas.length === 4)
                ? hGrupo.ffeOptativas
                : (Array.isArray(hGrupo5?.ffeOptativas) && hGrupo5.ffeOptativas.length === 4)
                    ? hGrupo5.ffeOptativas
                    : [];

            const socio3 = hGrupo3?.ffeoSocioemocional;
            const socio5 = hGrupo5?.ffeoSocioemocional || (grupo.semestre === 5 ? hGrupo?.ffeoSocioemocional : undefined);
            const socioObj = resolverSocioemocionalGrupo(socio3, socio5);
            const socioNombreGrupo = grupo.semestre === 3 ? socioObj.sem3 : grupo.semestre === 4 ? socioObj.sem4 : grupo.semestre === 5 ? socioObj.sem5 : socioObj.sem6;

            const asignaturasSemestre = obtenerAsignaturasParaGrupo(grupo.semestre, capNombre, ffeOpts, socioNombreGrupo);
            total += asignaturasSemestre.length;
        });
        if (total > 0) return total;
        // Fallback: calcular según estructura de la escuela
        const g1 = escuelaData.gruposPrimerAno || 1;
        const g2 = escuelaData.gruposSegundoAno || 1;
        const g3 = escuelaData.gruposTercerAno || 1;
        return (g1 * 8) + (g2 * 9) + (g3 * 10);
    }, [gruposGenerados, gruposDB, escuelaData]);

    // Promedio dinámico considerando puntaje base
    const promedioCalc = useMemo(() => {
        const revisadas = planeaciones.filter(p => p.puntajeObtenido !== undefined && p.puntajeObtenido !== null);
        if (revisadas.length === 0) return { promedio: 0, maxBase: 300, porcentaje: 0 };
        const suma = revisadas.reduce((acc, p) => acc + (p.puntajeObtenido ?? 0), 0);
        const maxBase = revisadas[0]?.puntajeMaximo || 300;
        const promedio = Math.round(suma / revisadas.length);
        const porcentaje = Math.round((promedio / maxBase) * 100);
        return { promedio, maxBase, porcentaje };
    }, [planeaciones]);

    // Abrir Modal para subir planeación pre-llenada por grupo y materia
    const abrirModalSubida = (grupoNombre: string, semestre: number, asignatura: string) => {
        const key = `${grupoNombre}__${asignatura}`;
        const asignado = asignacionesDocentesMap[key];

        setFormSubida({
            docenteNombre: asignado ? asignado.docenteNombre : "Docente Titular",
            docenteId: asignado ? asignado.personalId : "",
            grupoNombre,
            semestre,
            asignatura,
            bloqueCorte: "Corte 1 - Bloque I",
            tipoAsignatura: "FUNDAMENTAL",
            archivo: null
        });
        setModalSubidaAbierto(true);
    };

    // Subir archivo de planeación
    const handleSubirPlaneacion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formSubida.archivo) {
            toast.error("Debes seleccionar un archivo PDF o DOCX");
            return;
        }
        const docenteFinal = formSubida.docenteNombre.trim() || "Docente Titular";

        setSubiendo(true);
        try {
            const formData = new FormData();
            formData.append("archivo", formSubida.archivo);
            formData.append("docenteNombre", docenteFinal);
            formData.append("grupoNombre", formSubida.grupoNombre);
            formData.append("tipoSemestrePeriodo", periodoSemestral);
            formData.append("asignatura", formSubida.asignatura);
            formData.append("semestre", String(formSubida.semestre));
            formData.append("bloqueCorte", formSubida.bloqueCorte);
            formData.append("tipoAsignatura", formSubida.tipoAsignatura);

            const res = await fetch("/api/director/planeaciones", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al subir planeación");

            toast.success("¡Planeación enviada! Iniciando análisis con IA...");
            setModalSubidaAbierto(false);
            cargarDatos();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSubiendo(false);
        }
    };

    // Eliminar planeación
    const handleEliminarPlaneacion = async (id: string) => {
        if (!confirm("¿Eliminar esta planeación y su evaluación?")) return;
        try {
            const res = await fetch(`/api/director/planeaciones/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Planeación eliminada");
                setPlaneaciones(prev => prev.filter(p => p.id !== id));
            } else {
                toast.error("No se pudo eliminar");
            }
        } catch {
            toast.error("Error al eliminar planeación");
        }
    };

    // Reintentar / Forzar Dictamen IA Gemini
    const handleReintentarDictamen = async (id: string) => {
        setReintentandoIdMap(prev => ({ ...prev, [id]: true }));
        toast.loading("Re-ejecutando dictamen con IA Gemini...", { id: `dictamen-toast-${id}` });
        try {
            const res = await fetch(`/api/director/planeaciones/${id}`, { method: "POST" });
            const data = await res.json();
            if (res.ok && data.ok) {
                toast.success("¡Dictamen IA generado exitosamente!", { id: `dictamen-toast-${id}` });
                await cargarDatos();
            } else {
                toast.error(data.error || "No se pudo generar el dictamen", { id: `dictamen-toast-${id}` });
            }
        } catch {
            toast.error("Error de conexión al servidor", { id: `dictamen-toast-${id}` });
        } finally {
            setReintentandoIdMap(prev => ({ ...prev, [id]: false }));
        }
    };

    // Si está bloqueado por falta de PAEC-PEC o permisos (solo aplica a directores, NUNCA al administrador)
    if (!isAdmin && requisitos && !requisitos.puedeUsar) {
        return (
            <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
                    <Lock size={32} />
                </div>
                <h3 style={{ margin: "0 0 0.5rem", color: "var(--text)" }}>Módulo Bloqueado</h3>
                <p style={{ color: "var(--text-muted)", maxWidth: "500px", margin: "0 auto 1.5rem" }}>
                    {requisitos.motivoBloqueo || "No tienes acceso a este módulo en este momento."}
                </p>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Header & Controles Superiores */}
            <div className="card" style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", color: "white", padding: "1.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", padding: "0.25rem 0.65rem", borderRadius: "20px" }}>
                                MCCEMS 2025-2026
                            </span>
                            <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => setMapaModalAbierto(true)}
                                style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.25)", fontWeight: 700, fontSize: "0.75rem", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                            >
                                <Sparkles size={14} color="#60a5fa" /> ⚙️ Configurar Mapa Curricular
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm"
                                onClick={handleReiniciarMapaCurricular}
                                style={{ background: "rgba(239,68,68,0.25)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.4)", fontWeight: 700, fontSize: "0.75rem", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                                title="Reinicia la configuración del mapa curricular del plantel"
                            >
                                <RefreshCw size={13} /> 🔄 Reiniciar Configuración
                            </button>


                        </div>
                        <h2 style={{ margin: "0.5rem 0 0.25rem", fontSize: "1.5rem", fontWeight: 800 }}>
                            Control y Auditoría de Planeaciones Didácticas
                        </h2>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>
                            {escuelaData.nombre} • CCT: {escuelaData.cct}
                        </p>
                    </div>

                    {/* Selector de Periodo Semestral */}
                    <div style={{ display: "flex", gap: "0.5rem", background: "rgba(255,255,255,0.08)", padding: "0.35rem", borderRadius: "10px" }}>
                        <button
                            type="button"
                            onClick={() => setPeriodoSemestral("SEMESTRE_A")}
                            style={{
                                padding: "0.5rem 1rem",
                                borderRadius: "8px",
                                border: "none",
                                fontSize: "0.8rem",
                                fontWeight: 800,
                                cursor: "pointer",
                                background: periodoSemestral === "SEMESTRE_A" ? "#2563eb" : "transparent",
                                color: "white",
                                transition: "all 0.2s"
                            }}
                        >
                            📅 Semestre A (1º, 3º, 5º)
                        </button>
                        <button
                            type="button"
                            onClick={() => setPeriodoSemestral("SEMESTRE_B")}
                            style={{
                                padding: "0.5rem 1rem",
                                borderRadius: "8px",
                                border: "none",
                                fontSize: "0.8rem",
                                fontWeight: 800,
                                cursor: "pointer",
                                background: periodoSemestral === "SEMESTRE_B" ? "#2563eb" : "transparent",
                                color: "white",
                                transition: "all 0.2s"
                            }}
                        >
                            📅 Semestre B (2º, 4º, 6º)
                        </button>
                    </div>
                </div>

                {/* Badges y Estadísticas de Avance */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ background: "rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Estructura Plantel</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#60a5fa", marginTop: "0.2rem" }}>
                            {escuelaData.gruposPrimerAno ?? 1}-{escuelaData.gruposSegundoAno ?? 1}-{escuelaData.gruposTercerAno ?? 1} ({gruposGenerados.length} grupos)
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Planeaciones Subidas</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#38bdf8", marginTop: "0.2rem" }}>
                            {planeaciones.length} / {totalPlaneacionesEsperadas} ({Math.min(100, Math.round((planeaciones.length / (totalPlaneacionesEsperadas || 1)) * 100))}%)
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Revisadas con IA</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#4ade80", marginTop: "0.2rem" }}>
                            {planeaciones.filter(p => p.estado === "REVISADO").length} Con Dictamen
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Promedio de Cumplimiento</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#facc15", marginTop: "0.2rem" }}>
                            {promedioCalc.promedio} / {promedioCalc.maxBase} pts ({promedioCalc.porcentaje}%)
                        </div>
                    </div>
                </div>

                {/* Barra de Progreso Global del Plantel */}
                <div style={{ marginTop: "1.25rem", background: "rgba(255,255,255,0.06)", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "white" }}>
                                📊 Avance Global de Carga de Planes de Clase:
                            </span>
                            <span style={{ fontSize: "0.95rem", fontWeight: 800, color: planeaciones.length >= totalPlaneacionesEsperadas ? "#4ade80" : "#60a5fa" }}>
                                {planeaciones.length} / {totalPlaneacionesEsperadas} Planeaciones Cargadas
                            </span>
                        </div>
                        <span style={{ fontSize: "0.85rem", fontWeight: 800, color: planeaciones.length >= totalPlaneacionesEsperadas ? "#4ade80" : "#94a3b8" }}>
                            {Math.min(100, Math.round((planeaciones.length / (totalPlaneacionesEsperadas || 1)) * 100))}% Completado
                        </span>
                    </div>
                    <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                            style={{
                                width: `${Math.min(100, Math.round((planeaciones.length / (totalPlaneacionesEsperadas || 1)) * 100))}%`,
                                height: "100%",
                                background: planeaciones.length >= totalPlaneacionesEsperadas ? "#22c55e" : "linear-gradient(90deg, #3b82f6, #60a5fa)",
                                borderRadius: "4px",
                                transition: "width 0.4s ease-in-out"
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Barra de Navegación entre Vistas */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                        className={`btn ${vistaModo === "GRUPOS" ? "btn-primary" : "btn-outline"}`}
                        onClick={() => setVistaModo("GRUPOS")}
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontWeight: 700 }}
                    >
                        <Layers size={16} /> Avance por Grupos del Plantel
                    </button>
                    <button
                        className={`btn ${vistaModo === "DOCENTES" ? "btn-primary" : "btn-outline"}`}
                        onClick={() => setVistaModo("DOCENTES")}
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontWeight: 700 }}
                    >
                        <Users size={16} /> Vista por Docente
                    </button>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    {vistaModo === "GRUPOS" && (
                        <select
                            className="form-control"
                            value={grupoSeleccionadoId}
                            onChange={(e) => setGrupoSeleccionadoId(e.target.value)}
                            style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem", fontWeight: 700 }}
                        >
                            <option value="TODOS">Ver todos los grupos ({gruposGenerados.length})</option>
                            {gruposGenerados.map(g => (
                                <option key={g.id} value={g.nombre}>Grupo {g.nombre}</option>
                            ))}
                        </select>
                    )}

                    {vistaModo === "DOCENTES" && (
                        <div style={{ position: "relative" }}>
                            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Buscar docente..."
                                value={busquedaDocente}
                                onChange={(e) => setBusquedaDocente(e.target.value)}
                                style={{ paddingLeft: "2rem", paddingRight: "0.75rem", fontSize: "0.85rem" }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* VISTA 1: AVANCE POR GRUPOS DEL PLANTEL */}
            {vistaModo === "GRUPOS" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {gruposGenerados
                        .filter(g => grupoSeleccionadoId === "TODOS" || g.nombre === grupoSeleccionadoId)
                        .map(grupo => {
                            const letraGrupo = grupo.nombre.split(" ")[1];
                            const hGrupo3 = gruposDB.find((g: any) => g.nombre === `3° ${letraGrupo}` || g.nombre === `3º ${letraGrupo}`);
                            const hGrupo5 = gruposDB.find((g: any) => g.nombre === `5° ${letraGrupo}` || g.nombre === `5º ${letraGrupo}`);

                            // Buscar hGrupo exacto o por herencia de Semestre A (4º hereda de 3º, 6º hereda de 5º)
                            const hGrupo = gruposDB.find((g: any) => g.nombre === grupo.nombre)
                                || (grupo.semestre === 4 ? hGrupo3 : grupo.semestre === 6 ? hGrupo5 : undefined);

                            const capNombre = hGrupo?.capacitacionNombre || hGrupo3?.capacitacionNombre || hGrupo5?.capacitacionNombre || "Administracion";
                            const ffeOpts = (Array.isArray(hGrupo?.ffeOptativas) && hGrupo.ffeOptativas.length === 4)
                                ? hGrupo.ffeOptativas
                                : (Array.isArray(hGrupo5?.ffeOptativas) && hGrupo5.ffeOptativas.length === 4)
                                    ? hGrupo5.ffeOptativas
                                    : [];

                            const socio3 = hGrupo3?.ffeoSocioemocional;
                            const socio5 = hGrupo5?.ffeoSocioemocional || (grupo.semestre === 5 ? hGrupo?.ffeoSocioemocional : undefined);
                            const socioObj = resolverSocioemocionalGrupo(socio3, socio5);
                            const socioNombreGrupo = grupo.semestre === 3 ? socioObj.sem3 : grupo.semestre === 4 ? socioObj.sem4 : grupo.semestre === 5 ? socioObj.sem5 : socioObj.sem6;

                            const asignaturasSemestre = obtenerAsignaturasParaGrupo(grupo.semestre, capNombre, ffeOpts, socioNombreGrupo);
                            
                            // Conteo de planeaciones en este grupo
                            const planeacionesDelGrupo = asignaturasSemestre.filter(uac => {
                                const key = `${grupo.nombre}__${uac.nombre}`;
                                return !!planeacionesSubidasMap[key];
                            });

                            return (
                                <div key={grupo.id} className="card fade-in" style={{ padding: "0", overflow: "hidden", border: "1px solid var(--border)" }}>
                                    
                                    {/* Encabezado del Grupo */}
                                    <div style={{
                                        background: "var(--bg-secondary)",
                                        padding: "1rem 1.25rem",
                                        borderBottom: "1px solid var(--border)",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: "0.75rem"
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                                            <div style={{
                                                width: "38px",
                                                height: "38px",
                                                borderRadius: "10px",
                                                background: "#2563eb",
                                                color: "white",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: 800,
                                                fontSize: "1rem"
                                            }}>
                                                {grupo.nombre.split(" ")[0]}
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>
                                                    Grupo {grupo.nombre}
                                                </h3>
                                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                                    {grupo.semestre}° Semestre ({grupo.semestre <= 4 ? "Propósitos Formativos" : "Progresiones de Aprendizaje"})
                                                </span>
                                            </div>

                                            {/* Selector de Capacitación Laboral para 3º y 5º Semestre */}
                                            {grupo.semestre >= 3 && (
                                                <div style={{ marginLeft: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>Formación Laboral:</span>
                                                    <select
                                                        className="form-control"
                                                        value={capNombre}
                                                        onChange={(e) => handleGuardarConfigGrupo(grupo.nombre, grupo.semestre, e.target.value, ffeOpts)}
                                                        style={{ fontSize: "0.8rem", fontWeight: 700, padding: "0.25rem 0.5rem", borderRadius: "6px" }}
                                                    >
                                                        {FORMACIONES_LABORALES.map(cap => (
                                                            <option key={cap} value={cap}>{cap}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                                                Avance: <span style={{ color: planeacionesDelGrupo.length === asignaturasSemestre.length ? "#16a34a" : "#2563eb" }}>
                                                    {planeacionesDelGrupo.length} / {asignaturasSemestre.length} subidas
                                                </span>
                                            </div>

                                            <span style={{
                                                padding: "0.25rem 0.65rem",
                                                borderRadius: "20px",
                                                fontSize: "0.725rem",
                                                fontWeight: 800,
                                                background: planeacionesDelGrupo.length === asignaturasSemestre.length ? "#dcfce7" : "#eff6ff",
                                                color: planeacionesDelGrupo.length === asignaturasSemestre.length ? "#15803d" : "#1d4ed8"
                                            }}>
                                                {Math.round((planeacionesDelGrupo.length / (asignaturasSemestre.length || 1)) * 100)}% Completado
                                            </span>
                                        </div>
                                    </div>

                                    {/* Tabla de Asignaturas del Grupo */}
                                    <div style={{ overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                            <thead>
                                                <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                                                    <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text-secondary)" }}>Asignatura / UAC</th>
                                                    <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text-secondary)", width: "30%" }}>Docente Asignado</th>
                                                    <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text-secondary)", textAlign: "center", width: "160px" }}>Estado Entrega</th>
                                                    <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text-secondary)", textAlign: "right", width: "200px" }}>Acción / Dictamen</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {asignaturasSemestre.map(uac => {
                                                    const key = `${grupo.nombre}__${uac.nombre}`;
                                                    const asignado = asignacionesDocentesMap[key];
                                                    const planeacion = planeacionesSubidasMap[key];
                                                    const asignando = asignandoMap[key];

                                                    return (
                                                        <tr key={uac.nombre} style={{ borderBottom: "1px solid var(--border)" }}>
                                                            
                                                            {/* Materia */}
                                                            <td style={{ padding: "0.75rem 1rem" }}>
                                                                <div style={{ fontWeight: 700, color: "var(--text)" }}>{uac.nombre}</div>
                                                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                                                    {uac.horas}h semanales • Componente {uac.tipo}
                                                                </div>
                                                            </td>

                                                            {/* Selector Docente */}
                                                            <td style={{ padding: "0.75rem 1rem" }}>
                                                                <select
                                                                    className="form-control"
                                                                    disabled={asignando}
                                                                    value={asignado?.personalId || "SIN_ASIGNAR"}
                                                                    onChange={(e) => handleAsignarDocente(grupo.nombre, grupo.semestre, uac.nombre, e.target.value)}
                                                                    style={{
                                                                        padding: "0.4rem 0.6rem",
                                                                        fontSize: "0.8rem",
                                                                        fontWeight: asignado ? 700 : 400,
                                                                        color: asignado ? "var(--text)" : "var(--text-muted)",
                                                                        border: asignado ? "1px solid var(--primary)" : "1px solid var(--border)"
                                                                    }}
                                                                >
                                                                    <option value="SIN_ASIGNAR">-- Seleccionar Docente --</option>
                                                                    {personalFiltradoParaClases.map(p => (
                                                                        <option key={p.id} value={p.id}>
                                                                            {p.nombre} {p.apellidoPaterno} {p.apellidoMaterno} ({p.cargo || "Docente"})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>

                                                            {/* Estado Entrega */}
                                                            <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                                                                {planeacion ? (
                                                                    <span style={{
                                                                        display: "inline-flex",
                                                                        alignItems: "center",
                                                                        gap: "0.35rem",
                                                                        padding: "0.3rem 0.65rem",
                                                                        borderRadius: "20px",
                                                                        fontSize: "0.725rem",
                                                                        fontWeight: 800,
                                                                        background: planeacion.estado === "REVISADO" ? "#f0fdf4" : planeacion.estado === "EN_REVISION" ? "#eff6ff" : "#fef2f2",
                                                                        color: planeacion.estado === "REVISADO" ? "#15803d" : planeacion.estado === "EN_REVISION" ? "#1d4ed8" : "#b91c1c",
                                                                        border: "1px solid " + (planeacion.estado === "REVISADO" ? "#bbf7d0" : planeacion.estado === "EN_REVISION" ? "#bfdbfe" : "#fecaca")
                                                                    }}>
                                                                        {planeacion.estado === "REVISADO" ? "🟢 Revisado IA" : planeacion.estado === "EN_REVISION" ? "⏳ Analizando..." : "🔴 Error"}
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ fontSize: "0.725rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                                                        ⚪ Sin Subir
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* Acciones */}
                                                            <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                                                                {planeacion ? (
                                                                    <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end" }}>
                                                                        <button
                                                                             type="button"
                                                                             className="btn btn-outline"
                                                                             disabled={!!reintentandoIdMap[planeacion.id]}
                                                                             onClick={() => handleReintentarDictamen(planeacion.id)}
                                                                             style={{
                                                                                 padding: "0.3rem 0.6rem",
                                                                                 fontSize: "0.75rem",
                                                                                 fontWeight: 700,
                                                                                 color: reintentandoIdMap[planeacion.id] ? "#94a3b8" : "#16a34a",
                                                                                 borderColor: reintentandoIdMap[planeacion.id] ? "#cbd5e1" : "#bbf7d0",
                                                                                 opacity: reintentandoIdMap[planeacion.id] ? 0.7 : 1,
                                                                                 cursor: reintentandoIdMap[planeacion.id] ? "wait" : "pointer",
                                                                                 display: "inline-flex",
                                                                                 alignItems: "center",
                                                                                 gap: "0.35rem"
                                                                             }}
                                                                             title="Volver a ejecutar el dictamen con IA Gemini"
                                                                         >
                                                                             <RefreshCw size={14} style={{ animation: reintentandoIdMap[planeacion.id] ? "spin 1s linear infinite" : "none" }} />
                                                                             {reintentandoIdMap[planeacion.id] ? "Revisando..." : "Reintentar IA"}
                                                                         </button>

                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-outline"
                                                                            onClick={() => setModalDetalle(planeacion)}
                                                                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", fontWeight: 700 }}
                                                                            title="Ver dictamen detallado de IA"
                                                                        >
                                                                            <FileText size={14} /> Dictamen
                                                                        </button>

                                                                        {planeacion.resultadoJson && (
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-outline"
                                                                                onClick={() => generarWordRetroalimentacion(planeacion)}
                                                                                style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", fontWeight: 700, color: "#2563eb" }}
                                                                                title="Descargar dictamen Word (.docx)"
                                                                            >
                                                                                <Download size={14} /> Word
                                                                            </button>
                                                                        )}

                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-outline"
                                                                            onClick={() => handleEliminarPlaneacion(planeacion.id)}
                                                                            style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem", color: "var(--danger)" }}
                                                                            title="Eliminar esta entrega"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-primary"
                                                                        onClick={() => abrirModalSubida(grupo.nombre, grupo.semestre, uac.nombre)}
                                                                        style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 800 }}
                                                                    >
                                                                        <Upload size={14} /> Subir Planeación
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}

            {/* VISTA 2: VISTA POR DOCENTE */}
            {vistaModo === "DOCENTES" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
                    {personalList
                        .filter(p => `${p.nombre} ${p.apellidoPaterno} ${p.apellidoMaterno}`.toLowerCase().includes(busquedaDocente.toLowerCase()))
                        .map(docente => {
                            const nombreDoc = `${docente.nombre} ${docente.apellidoPaterno} ${docente.apellidoMaterno || ""}`.trim();
                            
                            // Buscar UACs asignadas a este docente
                            const cargasDelDocente = cargasList.filter(c => c.personalId === docente.id);
                            // Planeaciones subidas por este docente
                            const planeacionesDelDocente = planeaciones.filter(p => p.docenteNombre.toLowerCase().includes(docente.apellidoPaterno.toLowerCase()));

                            return (
                                <div key={docente.id} className="card fade-in" style={{ padding: "1.25rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                                        <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                                            {docente.nombre[0]}{docente.apellidoPaterno[0]}
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text)" }}>
                                                {nombreDoc}
                                            </h4>
                                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                                {cargasDelDocente.length} Asignaturas Asignadas
                                            </span>
                                        </div>
                                    </div>

                                    {/* Lista de Cargas/UACs del Docente */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                        {cargasDelDocente.length > 0 ? (
                                            cargasDelDocente.map(c => {
                                                const key = `${c.grupo?.nombre}__${c.asignatura?.uacName}`;
                                                const plan = planeacionesSubidasMap[key];

                                                return (
                                                    <div key={c.id} style={{
                                                        padding: "0.6rem 0.75rem",
                                                        background: "var(--bg-secondary)",
                                                        borderRadius: "8px",
                                                        border: "1px solid var(--border)",
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center"
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)" }}>
                                                                {c.asignatura?.uacName}
                                                            </div>
                                                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                                                Grupo {c.grupo?.nombre}
                                                            </span>
                                                        </div>

                                                        {plan ? (
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline"
                                                                onClick={() => setModalDetalle(plan)}
                                                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem", color: "#16a34a", borderColor: "#bbf7d0", background: "#f0fdf4" }}
                                                            >
                                                                🟢 {plan.puntajeObtenido ? `${plan.puntajeObtenido} pts` : "Revisado"}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="btn btn-primary"
                                                                onClick={() => abrirModalSubida(c.grupo?.nombre, 1, c.asignatura?.uacName)}
                                                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem" }}
                                                            >
                                                                Subir
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", margin: "0.5rem 0" }}>
                                                Sin UACs asignadas en la matriz por grupos aún.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}

            {/* MODAL DE SUBIDA DE PLANEACIÓN */}
            {modalSubidaAbierto && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
                    <div className="card fade-in" style={{ maxWidth: "550px", width: "100%", padding: "1.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Upload size={18} style={{ color: "var(--primary)" }} /> Subir Planeación Didáctica
                            </h3>
                            <button className="btn btn-outline" onClick={() => setModalSubidaAbierto(false)} style={{ padding: "0.25rem 0.5rem" }}>✕</button>
                        </div>

                        <form onSubmit={handleSubirPlaneacion} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                                    Grupo & Semestre
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={`Grupo ${formSubida.grupoNombre} (${formSubida.semestre}° Semestre)`}
                                    disabled
                                    style={{ background: "var(--bg)", fontWeight: 700 }}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                                    Asignatura / UAC *
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={formSubida.asignatura}
                                    onChange={(e) => setFormSubida({ ...formSubida, asignatura: e.target.value })}
                                    required
                                    style={{ fontWeight: 700 }}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                                    Nombre del Docente Responsable *
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Nombre completo del profesor"
                                    value={formSubida.docenteNombre}
                                    onChange={(e) => setFormSubida({ ...formSubida, docenteNombre: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                                    Bloque / Corte
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={formSubida.bloqueCorte}
                                    onChange={(e) => setFormSubida({ ...formSubida, bloqueCorte: e.target.value })}
                                    placeholder="Ej. Corte 1 - Bloque I"
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                                    Archivo de Planeación (PDF o DOCX) *
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf,.docx"
                                    className="form-control"
                                    onChange={(e) => setFormSubida({ ...formSubida, archivo: e.target.files?.[0] || null })}
                                    required
                                />
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                                <button type="button" className="btn btn-outline" onClick={() => setModalSubidaAbierto(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={subiendo} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                                    {subiendo ? (
                                        <>
                                            <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Subiendo y Analizando con IA...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={14} /> Enviar a Revisión IA
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DETALLE DICTAMEN IA */}
            {modalDetalle && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
                    <div className="card fade-in" style={{ maxWidth: "750px", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "1.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text)" }}>
                                    Dictamen de Revisión IA
                                </h3>
                                <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                    {modalDetalle.docenteNombre} • {modalDetalle.asignatura} ({modalDetalle.grupoNombre || `${modalDetalle.semestre}° Semestre`})
                                </p>
                            </div>
                            <button className="btn btn-outline" onClick={() => setModalDetalle(null)}>✕</button>
                        </div>

                        {/* Puntuación */}
                        <div style={{ background: "var(--bg-secondary)", padding: "1.25rem", borderRadius: "12px", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Resultado de Evaluación</div>
                                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: (modalDetalle.puntajeObtenido ?? 0) >= 240 ? "#16a34a" : "#d97706" }}>
                                    {modalDetalle.puntajeObtenido ?? 0} / {modalDetalle.puntajeMaximo ?? 300} pts
                                </div>
                            </div>
                            {modalDetalle.resultadoJson && (
                                <button className="btn btn-primary" onClick={() => generarWordRetroalimentacion(modalDetalle)}>
                                    <Download size={16} /> Descargar Informe Word (.docx)
                                </button>
                            )}
                        </div>

                        {/* Criterios */}
                        {modalDetalle.resultadoJson?.criterios && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text)" }}>Criterios de Evaluación</h4>
                                {modalDetalle.resultadoJson.criterios.map((c, i) => (
                                    <div key={i} style={{ padding: "0.75rem 1rem", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--bg)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                                            <span>{c.criterio}</span>
                                            <span style={{ color: c.cumple === "SI" ? "#16a34a" : "#dc2626" }}>{c.puntajeObtenido} / {c.puntajeMax} pts</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>{c.observacion}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Configuración de Mapa Curricular */}
            <ModalConfiguracionMapaCurricular
                escuela={escuelaData}
                gruposIniciales={gruposDB}
                isOpen={mapaModalAbierto}
                onClose={() => setMapaModalAbierto(false)}
                onSaved={cargarDatos}
                forceObligatorio={!isAdmin && escuelaData.mapaCurricularCompletado === false}
                isAdmin={isAdmin}
            />

        </div>
    );
}
