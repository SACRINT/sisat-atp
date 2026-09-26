"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Medal, AlertCircle, Download, Loader2, RotateCw, ToggleLeft, ToggleRight } from "lucide-react";
import {
    Document, Packer, Paragraph, TextRun,
    Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle
} from "docx";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface RankingItem {
    id: string;
    cct: string;
    nombre: string;
    zona: string | null;
    totalRequeridas: number;
    aprobadas: number;
    entregadas: number;
    cumplimiento: number;
    entregadasPorcentaje: number;
    medalla: "ORO" | "PLATA" | "BRONCE" | "NINGUNA";
    docsConCorreccionesPendientes: number; // TIPO A: entregó pero no corrigió
    docsNoEntregados: number;              // TIPO B: nunca entregó (más grave)
}

interface Props {
    cicloNombre: string;
    cicloId?: string;
    isDirector?: boolean;
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function RankingEscuelas({ cicloNombre, cicloId, isDirector = false }: Props) {
    const [ranking, setRanking] = useState<RankingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatingReport, setGeneratingReport] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const [evaluarSoloActivos, setEvaluarSoloActivos] = useState(false);
    const [togglingModo, setTogglingModo] = useState(false);

    const fetchRanking = useCallback((isManual = false) => {
        if (isManual) setRefreshing(true);
        const queryParams = new URLSearchParams();
        if (cicloId) queryParams.set("cicloId", cicloId);
        queryParams.set("t", Date.now().toString());

        fetch(`/api/admin/ranking?${queryParams.toString()}`, { cache: "no-store" })
            .then(r => r.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                if (data.ranking) {
                    setRanking(data.ranking);
                    setEvaluarSoloActivos(!!data.evaluarSoloActivosRanking);
                } else {
                    setRanking(data);
                }
                setLoading(false);
                setRefreshing(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
                setRefreshing(false);
            });
    }, [cicloId]);

    const handleToggleModoActivos = async () => {
        setTogglingModo(true);
        try {
            const res = await fetch("/api/admin/ranking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cicloId, evaluarSoloActivosRanking: !evaluarSoloActivos }),
            });
            const data = await res.json();
            if (data.ok) {
                setEvaluarSoloActivos(data.evaluarSoloActivosRanking);
                fetchRanking(true);
            }
        } catch (err) {
            console.error("Error al cambiar filtro inteligente de ranking:", err);
        } finally {
            setTogglingModo(false);
        }
    };

    useEffect(() => {
        fetchRanking();
        // Polling cada 60 s (antes: 15 s) — reduce consumo de CU-hours en Neon ~75 %
        const interval = setInterval(() => {
            if (document.visibilityState !== "hidden") fetchRanking();
        }, 60_000);

        const handleVisibility = () => {
            if (document.visibilityState === "visible") fetchRanking();
        };
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [fetchRanking]);

    const getMedalIcon = (medalla: string) => {
        switch (medalla) {
            case "ORO":    return <Trophy size={20} color="#fbbf24" style={{ filter: "drop-shadow(0 2px 2px rgba(251,191,36,0.4))" }} />;
            case "PLATA":  return <Medal size={20} color="#94a3b8" />;
            case "BRONCE": return <Medal size={20} color="#b45309" />;
            default:       return null;
        }
    };

    const getMedalLabel = (medalla: string) => {
        switch (medalla) {
            case "ORO":    return "Oro (100% a tiempo)";
            case "PLATA":  return "Plata (100% entregado)";
            case "BRONCE": return "Bronce (≥ 80%)";
            default:       return "Sin medalla";
        }
    };

    // ── Descarga el reporte con IA ────────────────────────────────────────────
    const handleDownloadEnhancedReport = async () => {
        setGeneratingReport(true);
        setReportError(null);
        try {
            const res = await fetch("/api/admin/reporte-cumplimiento", { cache: "no-store" });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Error ${res.status} al generar el reporte`);
            }
            const data = await res.json();
            const blob = await buildWordReport(data);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Informe_Cumplimiento_Detallado_${(data.cicloNombre || cicloNombre).replace(/\//g, "-")}.docx`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
        } catch (err: any) {
            console.error("[ranking] Error al generar reporte:", err);
            setReportError(err.message || "No se pudo generar el reporte. Intenta de nuevo.");
        } finally {
            setGeneratingReport(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    if (loading) return (
        <div style={{ padding: "2rem", display: "flex", justifyContent: "center" }}>
            <Loader2 size={32} className="spin text-primary" />
        </div>
    );
    if (error) return (
        <div style={{ padding: "2rem", color: "var(--danger)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertCircle size={20} /> {error}
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* Cabecera */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Trophy size={24} color="#fbbf24" />
                        Ranking de Cumplimiento
                    </h2>
                    <p style={{ color: "var(--text-muted)", margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                        Monitorea el desempeño de las escuelas. Las medallas se otorgan por cumplimiento y puntualidad.
                    </p>
                    <p style={{ color: "var(--text-muted)", margin: "0.15rem 0 0", fontSize: "0.78rem" }}>
                        🟠 = Entregó pero <strong>no atendió correcciones</strong> (menor gravedad)
                        &nbsp;|&nbsp;
                        🔴 = <strong>Nunca entregó</strong> (mayor gravedad — penalización)
                    </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {!isDirector && (
                        <button
                            onClick={handleToggleModoActivos}
                            disabled={togglingModo}
                            title="Modo Inteligente: Si se activa, solo evalúa programas con fecha límite o entregas registradas en la zona"
                            style={{
                                padding: "0.5rem 1rem",
                                background: evaluarSoloActivos ? "rgba(16, 185, 129, 0.15)" : "var(--bg-secondary)",
                                color: evaluarSoloActivos ? "#10b981" : "var(--text-muted)",
                                border: `1px solid ${evaluarSoloActivos ? "#10b981" : "var(--border)"}`,
                                borderRadius: "8px",
                                fontWeight: 600,
                                cursor: togglingModo ? "wait" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                fontSize: "0.8125rem"
                            }}
                        >
                            {togglingModo ? <Loader2 size={16} className="spin" /> : (evaluarSoloActivos ? <ToggleRight size={20} color="#10b981" /> : <ToggleLeft size={20} />)}
                            {evaluarSoloActivos ? "Solo Requeridos (Activos)" : "Evaluar Todos los Programas"}
                        </button>
                    )}

                    <button
                        onClick={() => fetchRanking(true)}
                        disabled={refreshing}
                        style={{
                            padding: "0.5rem 1rem",
                            background: "var(--bg-secondary)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            fontWeight: 600,
                            cursor: refreshing ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem"
                        }}
                    >
                        <RotateCw size={16} className={refreshing ? "spin" : ""} />
                        {refreshing ? "Actualizando..." : "Actualizar"}
                    </button>

                    {!isDirector && (
                        <button
                            onClick={handleDownloadEnhancedReport}
                            disabled={generatingReport}
                            style={{
                                padding: "0.5rem 1.25rem",
                                background: generatingReport ? "#8898aa" : "var(--primary)",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                fontWeight: 600,
                                cursor: generatingReport ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                minWidth: "230px",
                                justifyContent: "center"
                            }}
                            title="Genera un informe detallado con análisis de IA distinguiendo tipos de incumplimiento"
                        >
                            {generatingReport
                                ? <><Loader2 size={16} className="spin" /> Generando con IA...</>
                                : <><Download size={18} /> Descargar Reporte Final (Word)</>
                            }
                        </button>
                    )}
                </div>
            </div>

            {/* Mensaje de error del reporte */}
            {reportError && (
                <div style={{
                    padding: "0.75rem 1rem",
                    background: "#fdecea",
                    color: "#c0392b",
                    borderRadius: "8px",
                    border: "1px solid #e57373",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.875rem"
                }}>
                    <AlertCircle size={16} />
                    <span><strong>Error al generar el reporte:</strong> {reportError}</span>
                </div>
            )}

            {/* Tabla del ranking */}
            <div className="card" style={{ padding: "0" }}>
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th style={{ width: "40px" }}>#</th>
                                <th>Escuela</th>
                                <th style={{ textAlign: "center" }}>Requeridas</th>
                                <th style={{ textAlign: "center" }}>Aprobadas</th>
                                <th style={{ minWidth: "160px" }}>Cumplimiento</th>
                                <th style={{ minWidth: "200px" }}>Estado de Entrega</th>
                                <th>Medalla</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ranking.map((r, index) => (
                                <tr key={r.id}>
                                    <td style={{ fontWeight: 700, color: "var(--text-muted)" }}>{index + 1}</td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{r.nombre}</div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>CCT: {r.cct}</div>
                                    </td>
                                    <td style={{ textAlign: "center" }}>{r.totalRequeridas}</td>
                                    <td style={{ textAlign: "center" }}>{r.aprobadas}</td>
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <div style={{ flex: 1, background: "var(--border)", height: "6px", borderRadius: "3px", overflow: "hidden", minWidth: "80px" }}>
                                                <div style={{
                                                    width: `${r.cumplimiento}%`,
                                                    background: r.cumplimiento === 100 ? "var(--success, #22c55e)"
                                                        : r.cumplimiento >= 80 ? "var(--warning, #f59e0b)"
                                                            : "var(--danger, #ef4444)",
                                                    height: "100%",
                                                    borderRadius: "3px"
                                                }} />
                                            </div>
                                            <span style={{ fontSize: "0.875rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                                                {r.cumplimiento.toFixed(0)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        {/* Indicadores diferenciados TIPO A vs TIPO B */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem" }}>
                                            {r.docsNoEntregados > 0 && (
                                                <span style={{
                                                    background: "#fdecea",
                                                    color: "#b91c1c",
                                                    padding: "2px 8px",
                                                    borderRadius: "4px",
                                                    fontWeight: 700,
                                                    display: "inline-block",
                                                    border: "1px solid #fca5a5"
                                                }}>
                                                    🔴 {r.docsNoEntregados} {r.docsNoEntregados === 1 ? "doc" : "docs"} nunca entregado{r.docsNoEntregados !== 1 ? "s" : ""}
                                                </span>
                                            )}
                                            {r.docsConCorreccionesPendientes > 0 && (
                                                <span style={{
                                                    background: "#fffbeb",
                                                    color: "#92400e",
                                                    padding: "2px 8px",
                                                    borderRadius: "4px",
                                                    fontWeight: 700,
                                                    display: "inline-block",
                                                    border: "1px solid #fcd34d"
                                                }}>
                                                    🟠 {r.docsConCorreccionesPendientes} {r.docsConCorreccionesPendientes === 1 ? "doc" : "docs"} sin corregir
                                                </span>
                                            )}
                                            {r.docsNoEntregados === 0 && r.docsConCorreccionesPendientes === 0 && (
                                                <span style={{ color: "#15803d", fontWeight: 600 }}>✅ Completo</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 500, whiteSpace: "nowrap" }}>
                                            {getMedalIcon(r.medalla)}
                                            {getMedalLabel(r.medalla)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── Generador del Word con IA ─────────────────────────────────────────────────
async function buildWordReport(data: any): Promise<Blob> {
    const {
        cicloNombre, fechaGeneracion, supervisor, atpNombre,
        escuelas, narrativaPorEscuela, observacionesGenerales, conclusion, resumen,
        institucion
    } = data;

    const zonaStr = institucion?.zona || "004";
    const cctStr = institucion?.cct || "21FMS0020X";
    const muniStr = institucion?.municipio || "Venustiano Carranza";
    const entidadStr = institucion?.entidad || "Puebla";
    const nombreSupervisionStr = institucion?.nombreSupervision || `Zona ${zonaStr} de Bachilleratos Generales Estatales`;

    // Mapa de narrativas por CCT
    const narrativaMap: Record<string, string> = {};
    for (const n of (narrativaPorEscuela || [])) {
        narrativaMap[n.cct] = n.narrativa;
    }

    const fecha = new Date(fechaGeneracion).toLocaleDateString("es-MX", {
        day: "2-digit", month: "long", year: "numeric"
    });

    // ── Helpers de construcción ───────────────────────────────────────────────

    const p = (text: string, opts: {
        bold?: boolean; size?: number; color?: string;
        center?: boolean; justify?: boolean;
        spBefore?: number; spAfter?: number; indent?: boolean;
    } = {}) =>
        new Paragraph({
            alignment: opts.center ? AlignmentType.CENTER : opts.justify ? AlignmentType.BOTH : AlignmentType.LEFT,
            spacing: { before: (opts.spBefore ?? 0) * 20, after: (opts.spAfter ?? 6) * 20 },
            indent: opts.indent ? { firstLine: 720 } : undefined,
            children: [new TextRun({
                text,
                bold: opts.bold ?? false,
                size: (opts.size ?? 11) * 2,
                color: opts.color ?? "000000",
                font: "Times New Roman"
            })]
        });

    const heading = (text: string, size = 12, color = "1F3A5F") =>
        new Paragraph({
            spacing: { before: 240, after: 80 },
            children: [new TextRun({ text, bold: true, size: size * 2, color, font: "Times New Roman" })]
        });

    const spacer = () =>
        new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [new TextRun({ text: " ", size: 20 })]
        });

    const hCell = (text: string, bgColor: string, txtColor = "FFFFFF") =>
        new TableCell({
            shading: { type: "clear" as any, fill: bgColor, color: "auto" },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text, bold: true, size: 18, color: txtColor, font: "Times New Roman" })]
            })]
        });

    const dCell = (text: string, bgColor: string) =>
        new TableCell({
            shading: { type: "clear" as any, fill: bgColor, color: "auto" },
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            children: [new Paragraph({
                children: [new TextRun({ text, size: 17, font: "Times New Roman" })]
            })]
        });

    const mkTable = (
        headers: string[], rows: string[][],
        hColor: string, evenColor: string, oddColor: string
    ) =>
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top:               { style: BorderStyle.SINGLE, size: 4, color: hColor },
                bottom:            { style: BorderStyle.SINGLE, size: 4, color: hColor },
                left:              { style: BorderStyle.SINGLE, size: 4, color: hColor },
                right:             { style: BorderStyle.SINGLE, size: 4, color: hColor },
                insideHorizontal:  { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
                insideVertical:    { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
            },
            rows: [
                ...(headers.length > 0
                    ? [new TableRow({ tableHeader: true, children: headers.map(h => hCell(h, hColor)) })]
                    : []),
                ...rows.map((row, ri) =>
                    new TableRow({
                        children: row.map(cell => dCell(cell, ri % 2 === 0 ? evenColor : oddColor))
                    })
                )
            ]
        });

    const nb = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

    // ── Construir el documento ────────────────────────────────────────────────
    const children: (Paragraph | Table)[] = [];

    // --- Encabezado institucional ---
    children.push(p("SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA", { bold: true, size: 9, color: "1F3A5F", center: true, spAfter: 2 }));
    children.push(p("DIRECCIÓN GENERAL DE EDUCACIÓN BÁSICA SEGUNDO NIVEL", { size: 9, color: "1F3A5F", center: true, spAfter: 2 }));
    children.push(p("DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA", { size: 9, color: "1F3A5F", center: true, spAfter: 2 }));
    children.push(p(`${nombreSupervisionStr.toUpperCase()}  —  CCT: ${cctStr}`, { bold: true, size: 9, color: "2E5F9A", center: true, spAfter: 10 }));

    // --- Título ---
    children.push(p("INFORME DE CUMPLIMIENTO DE ENTREGA DE DOCUMENTACIÓN", { bold: true, size: 16, color: "1F3A5F", center: true, spBefore: 10, spAfter: 4 }));
    children.push(p(`FIN DE CICLO ESCOLAR ${cicloNombre}`, { bold: true, size: 14, color: "2E5F9A", center: true, spAfter: 4 }));
    children.push(p(`${nombreSupervisionStr}  |  ${muniStr}, ${entidadStr}`, { size: 10, color: "555555", center: true, spAfter: 16 }));
    children.push(spacer());

    // --- Sección I: Identificación ---
    children.push(heading("I.  DATOS DE IDENTIFICACIÓN"));
    children.push(mkTable([], [
        ["Fecha de elaboración:", fecha],
        ["Ciclo escolar:", cicloNombre],
        ["Supervisión:", nombreSupervisionStr],
        ["CCT de la supervisión:", cctStr],
        ["Supervisor escolar:", supervisor || "ALEJANDRO ESCAMILLA MARTÍNEZ"],
        ["Elaboró (ATP):", atpNombre || "ASESOR TÉCNICO PEDAGÓGICO"],
        ["Centros de trabajo evaluados:", `${resumen?.total ?? escuelas.length} bachilleratos`],
        ["Documentos requeridos por plantel:", "16 documentos oficiales"],
    ], "1F3A5F", "D6E4F0", "FFFFFF"));
    children.push(spacer());

    // --- Sección II: Antecedentes ---
    children.push(heading("II.  ANTECEDENTES Y CONTEXTO"));
    children.push(p(
        `En el marco del cierre del ciclo escolar ${cicloNombre}, la ${nombreSupervisionStr}, con sede en el municipio de ${muniStr}, ${entidadStr}, llevó a cabo el proceso de recopilación, revisión y validación de la documentación de fin de ciclo correspondiente a los ${resumen?.total ?? escuelas.length} centros de trabajo adscritos a la zona.`,
        { size: 11, justify: true, indent: true, spAfter: 6 }
    ));
    children.push(p(
        "El presente informe distingue con claridad dos tipos de incumplimiento de distinta gravedad: (A) escuelas que entregaron la documentación pero no atendieron las correcciones señaladas por el ATP — situación de gravedad moderada, dado que el director sí cumplió con la entrega —; y (B) escuelas que no presentaron el documento en ningún momento ante la supervisión escolar — incumplimiento total de mayor gravedad que conlleva penalización administrativa, ya que el director no realizó entrega alguna.",
        { size: 11, justify: true, indent: true, spAfter: 6 }
    ));
    children.push(spacer());

    // --- Sección III: Resumen ejecutivo ---
    children.push(heading("III.  RESUMEN EJECUTIVO"));
    children.push(mkTable(["INDICADOR", "VALOR"], [
        ["Total de escuelas evaluadas",                          `${resumen?.total ?? escuelas.length}`],
        ["Escuelas con Medalla ORO (100% en tiempo)",            `${resumen?.conOro ?? 0}`],
        ["Escuelas con Medalla PLATA (100% fuera de plazo)",     `${resumen?.conPlata ?? 0}`],
        ["Escuelas con Medalla BRONCE (≥ 80%)",                  `${resumen?.conBronce ?? 0}`],
        ["Escuelas sin medalla (< 80%)",                         `${resumen?.sinMedalla ?? 0}`],
        ["TIPO A — Entregaron pero no atendieron correcciones",  `${resumen?.conCorreccionesPendientes ?? 0}`],
        ["TIPO B — Con documentos NUNCA entregados (grave)",     `${resumen?.conDocsNoEntregados ?? 0}`],
        ["Promedio de cumplimiento de la zona",                  `${resumen?.promedioZona ?? "—"}%`],
    ], "1F3A5F", "D6E4F0", "FFFFFF"));
    children.push(spacer());

    // --- Sección IV: Análisis por categoría ---
    children.push(heading("IV.  ANÁLISIS DETALLADO POR CATEGORÍA"));

    const oroList   = escuelas.filter((e: any) => e.medalla === "ORO");
    const plataList = escuelas.filter((e: any) => e.medalla === "PLATA");
    const tipoAList = escuelas.filter((e: any) => (e.totalCorreccionesPendientes || 0) > 0);
    const tipoBList = escuelas.filter((e: any) => (e.totalNoEntregados || 0) > 0);

    if (oroList.length > 0) {
        children.push(heading("4.1  Medalla ORO — Cumplimiento Total en Tiempo y Forma", 11, "B7860D"));
        children.push(mkTable(
            ["CCT", "Plantel", "Director(a)", "Docs entregados", "%"],
            oroList.map((e: any) => [e.cct, e.nombre, e.director || "—", `${e.totalAprobadas}/${e.totalRequeridas}`, "100%"]),
            "B7860D", "FEF9C3", "FFFFF0"
        ));
        children.push(spacer());
    }

    if (plataList.length > 0) {
        children.push(heading("4.2  Medalla PLATA — Entrega Completa Fuera del Plazo Oficial", 11, "2E5F9A"));
        children.push(mkTable(
            ["CCT", "Plantel", "Director(a)", "Docs entregados", "%"],
            plataList.map((e: any) => [e.cct, e.nombre, e.director || "—", `${e.totalAprobadas}/${e.totalRequeridas}`, "100%"]),
            "2E5F9A", "D6E4F0", "EFF5FB"
        ));
        children.push(spacer());
    }

    if (tipoAList.length > 0) {
        children.push(heading("4.3  TIPO A — Entregaron pero NO Atendieron Correcciones (Gravedad Moderada)", 11, "C57B21"));
        children.push(p(
            "Estas escuelas SÍ realizaron la entrega del documento ante la supervisión; sin embargo, el director o directora no atendió las correcciones señaladas por el ATP. Su situación es irregular pero de MENOR gravedad que no haber entregado, dado que cumplió con el acto de entrega.",
            { size: 10, justify: true, indent: true, spAfter: 4 }
        ));
        children.push(mkTable(
            ["CCT", "Plantel", "Director(a)", "Documentos sin corregir", "% Cumpl."],
            tipoAList.map((e: any) => [
                e.cct,
                e.nombre,
                e.director || "—",
                Array.isArray(e.docsConCorreccionesPendientes)
                    ? e.docsConCorreccionesPendientes.map((d: any) => d.programa || String(d)).join(", ")
                    : `${e.totalCorreccionesPendientes} doc(s)`,
                `${e.cumplimiento}%`
            ]),
            "C57B21", "FEF3E2", "FFFBF5"
        ));
        children.push(spacer());
    }

    if (tipoBList.length > 0) {
        children.push(heading("4.4  TIPO B — NUNCA Entregaron Documentos (Incumplimiento Total — Gravedad GRAVE)", 11, "8B1A1A"));
        children.push(p(
            "Las siguientes escuelas tienen documentos que NUNCA fueron presentados ante la supervisión escolar. Esta situación constituye un incumplimiento total y es de MAYOR GRAVEDAD que la falta de correcciones, ya que el director no realizó entrega alguna del documento referido. Se penaliza explícitamente en el presente informe.",
            { size: 10, justify: true, indent: true, spAfter: 4 }
        ));
        children.push(mkTable(
            ["CCT", "Plantel", "Director(a)", "Documentos NUNCA entregados", "% Cumpl."],
            tipoBList.map((e: any) => [
                e.cct,
                e.nombre,
                e.director || "—",
                Array.isArray(e.docsNoEntregados)
                    ? e.docsNoEntregados.map((d: any) => d.programa || String(d)).join(", ")
                    : `${e.totalNoEntregados} doc(s)`,
                `${e.cumplimiento}%`
            ]),
            "8B1A1A", "FDECEA", "FFF5F5"
        ));
        children.push(spacer());
    }

    // --- Sección V: Análisis narrativo (IA) ---
    children.push(heading("V.  ANÁLISIS NARRATIVO INDIVIDUAL POR PLANTEL"));
    children.push(p(
        "El siguiente análisis individualizado fue generado por el Sistema Inteligente SISAT-ATP con base en los datos oficiales de entrega de cada centro de trabajo:",
        { size: 11, justify: true, indent: true, spAfter: 8 }
    ));

    const completas   = escuelas.filter((e: any) => ["ORO", "PLATA"].includes(e.medalla));
    const incompletas = escuelas.filter((e: any) => !["ORO", "PLATA"].includes(e.medalla));

    if (completas.length > 0) {
        children.push(heading("A.  Planteles con Cumplimiento Completo", 11, "1A5F2E"));
        for (const esc of completas) {
            children.push(new Paragraph({
                spacing: { before: 160, after: 40 },
                children: [new TextRun({
                    text: `${esc.cct}  —  ${esc.nombre}   |   Dir. ${esc.director || "—"}`,
                    bold: true, size: 20, color: "1F3A5F", font: "Times New Roman"
                })]
            }));
            const narrativa = narrativaMap[esc.cct]
                || `El plantel cumplió con la entrega de los ${esc.totalAprobadas} documentos requeridos para el cierre del ciclo escolar ${cicloNombre}.`;
            children.push(p(narrativa, { size: 10, justify: true, indent: true, spAfter: 10 }));
        }
        children.push(spacer());
    }

    if (incompletas.length > 0) {
        children.push(heading("B.  Planteles con Incumplimiento Documentario", 11, "8B1A1A"));
        for (const esc of incompletas) {
            const noEntrego   = (esc.totalNoEntregados || 0) > 0;
            const sinCorregir = (esc.totalCorreccionesPendientes || 0) > 0;
            const titleColor  = noEntrego ? "8B1A1A" : "C57B21";
            const badge       = noEntrego
                ? "  [NUNCA ENTREGÓ — INCUMPLIMIENTO GRAVE]"
                : sinCorregir ? "  [ENTREGÓ SIN CORREGIR]" : "";

            children.push(new Paragraph({
                spacing: { before: 160, after: 40 },
                children: [
                    new TextRun({
                        text: `${esc.cct}  —  ${esc.nombre}   |   Dir. ${esc.director || "—"}`,
                        bold: true, size: 20, color: titleColor, font: "Times New Roman"
                    }),
                    new TextRun({
                        text: badge, bold: true, size: 18, color: titleColor, font: "Times New Roman"
                    }),
                ]
            }));

            const narrativa = narrativaMap[esc.cct]
                || `El plantel presentó ${esc.totalAprobadas} de ${esc.totalRequeridas} documentos (${esc.cumplimiento}%). Su situación documentaria requiere atención inmediata por parte de la supervisión escolar.`;
            children.push(p(narrativa, { size: 10, justify: true, indent: true, spAfter: 10 }));
        }
        children.push(spacer());
    }

    // --- Sección VI: Observaciones ---
    children.push(heading("VI.  OBSERVACIONES Y RECOMENDACIONES"));
    children.push(p(
        observacionesGenerales || "Se exhorta a todos los directivos con adeudo documentario a regularizar su situación a la brevedad posible, a fin de dar cumplimiento a los lineamientos de la supervisión escolar.",
        { size: 11, justify: true, indent: true, spAfter: 8 }
    ));
    children.push(spacer());

    // --- Sección VII: Conclusión ---
    children.push(heading("VII.  CONCLUSIÓN"));
    children.push(p(
        conclusion || `Al cierre del ciclo escolar ${cicloNombre}, la Zona 004 requiere seguimiento puntual de la supervisión escolar sobre los centros de trabajo con adeudo documentario.`,
        { size: 11, justify: true, indent: true, spAfter: 8 }
    ));
    children.push(spacer());
    children.push(spacer());

    // --- Sección VIII: Firmas ---
    children.push(heading("VIII.  FIRMAS DE VALIDACIÓN"));
    children.push(spacer());
    children.push(spacer());

    children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: nb, bottom: nb, left: nb, right: nb, insideHorizontal: nb, insideVertical: nb },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        borders: { top: nb, bottom: nb, left: nb, right: nb },
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: "_________________________________", size: 22, font: "Times New Roman" })]
                        })]
                    }),
                    new TableCell({
                        borders: { top: nb, bottom: nb, left: nb, right: nb },
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: "_________________________________", size: 22, font: "Times New Roman" })]
                        })]
                    }),
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({
                        borders: { top: nb, bottom: nb, left: nb, right: nb },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: atpNombre || "ASESOR TÉCNICO PEDAGÓGICO", bold: true, size: 20, font: "Times New Roman" })]
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: zonaStr ? `Zona ${zonaStr}` : "Supervisión Escolar", size: 18, font: "Times New Roman" })]
                            })
                        ]
                    }),
                    new TableCell({
                        borders: { top: nb, bottom: nb, left: nb, right: nb },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: supervisor || "SUPERVISOR ESCOLAR", bold: true, size: 20, font: "Times New Roman" })]
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: zonaStr ? `Supervisor Escolar — Zona ${zonaStr}` : "Supervisor Escolar", size: 18, font: "Times New Roman" })]
                            })
                        ]
                    }),
                ]
            }),
        ]
    }));

    // --- Generar blob ---
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 1134, right: 1134, bottom: 1134, left: 1701 }
                }
            },
            children
        }]
    });

    return await Packer.toBlob(doc);
}
