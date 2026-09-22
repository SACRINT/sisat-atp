"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Sparkles, Check, School, Layers, AlertCircle, BookOpen, ChevronRight, RefreshCw, Save } from "lucide-react";
import toast from "react-hot-toast";
import {
  FORMACIONES_LABORALES,
  FFE_OPTATIVAS_CATALOGO,
  FFE_RECURSOS_SOCIOCOGNITIVOS,
  FFE_AREAS_CONOCIMIENTO,
  FORMACIONES_SOCIOEMOCIONALES,
  resolverSocioemocionalGrupo,
  generarGruposPorEstructura,
  obtenerAsignaturasParaGrupo,
  GrupoDefinicion
} from "@/lib/escuela-grupos";

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
  gruposIniciales?: any[];
  isOpen: boolean;
  onClose?: () => void;
  onSaved?: () => void;
  forceObligatorio?: boolean;
  isAdmin?: boolean;
}

export default function ModalConfiguracionMapaCurricular({
  escuela,
  gruposIniciales = [],
  isOpen,
  onClose,
  onSaved,
  forceObligatorio = false,
  isAdmin = false,
}: Props) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [guardando, setGuardando] = useState(false);

  // Paso 1: Estructura de Grupos
  const [g1, setG1] = useState<number>(escuela.gruposPrimerAno || 1);
  const [g2, setG2] = useState<number>(escuela.gruposSegundoAno || 1);
  const [g3, setG3] = useState<number>(escuela.gruposTercerAno || 1);

  // Config por Grupo (nombre -> { capacitacionNombre, ffeOptativas, ffeoSocioemocional })
  const [mapaConfig, setMapaConfig] = useState<Record<string, { capacitacionNombre: string; ffeOptativas: string[]; ffeoSocioemocional: string }>>({});

  const [initialized, setInitialized] = useState(false);

  // Reset y sincronización al abrir el modal (solo una vez por apertura)
  useEffect(() => {
    if (isOpen && !initialized) {
      setG1(Math.max(1, escuela?.gruposPrimerAno || 1));
      setG2(Math.max(1, escuela?.gruposSegundoAno || 1));
      setG3(Math.max(1, escuela?.gruposTercerAno || 1));

      const initialMap: Record<string, { capacitacionNombre: string; ffeOptativas: string[]; ffeoSocioemocional: string }> = {};
      if (Array.isArray(gruposIniciales)) {
        gruposIniciales.forEach(g => {
          let opts = g.ffeOptativas;
          if (typeof opts === "string") {
            try { opts = JSON.parse(opts); } catch { opts = []; }
          }

          const parsedOpts = Array.isArray(opts) && opts.length === 4 ? opts : [
            FFE_RECURSOS_SOCIOCOGNITIVOS[0],
            FFE_RECURSOS_SOCIOCOGNITIVOS[1],
            FFE_AREAS_CONOCIMIENTO[0],
            FFE_AREAS_CONOCIMIENTO[1]
          ];

          const itemData = {
            capacitacionNombre: g.capacitacionNombre || "Administracion",
            ffeOptativas: parsedOpts,
            ffeoSocioemocional: g.ffeoSocioemocional || (g.semestre === 3 ? FORMACIONES_SOCIOEMOCIONALES[0] : FORMACIONES_SOCIOEMOCIONALES[1])
          };

          if (g.nombre) {
            initialMap[g.nombre] = itemData;
            initialMap[g.nombre.replace("º", "°")] = itemData;
            initialMap[g.nombre.replace("°", "º")] = itemData;
          }
        });
      }
      setMapaConfig(initialMap);
      setPaso(1);
      setInitialized(true);
    } else if (!isOpen && initialized) {
      setInitialized(false);
    }
  }, [isOpen, initialized, escuela, gruposIniciales]);

  // Generar lista dinámica de grupos según la estructura actual de los inputs
  const gruposGenerados = useMemo(() => {
    return generarGruposPorEstructura({ gruposPrimerAno: g1, gruposSegundoAno: g2, gruposTercerAno: g3 }, "SEMESTRE_A");
  }, [g1, g2, g3]);

  if (!isOpen) return null;

  const normalizarNombreGrupo = (n: string) => (n || "").replace(/º/g, "°");

  const handleUpdateGrupoConfig = (grupoNombre: string, field: string, value: any) => {
    const nNorm = normalizarNombreGrupo(grupoNombre);
    const nAlt = grupoNombre.includes("°") ? grupoNombre.replace("°", "º") : grupoNombre.replace("º", "°");

    setMapaConfig(prev => {
      const actual = prev[nNorm] || prev[grupoNombre] || prev[nAlt] || {
        capacitacionNombre: "Administracion",
        ffeOptativas: [
          FFE_RECURSOS_SOCIOCOGNITIVOS[0],
          FFE_RECURSOS_SOCIOCOGNITIVOS[1],
          FFE_AREAS_CONOCIMIENTO[0],
          FFE_AREAS_CONOCIMIENTO[1]
        ],
        ffeoSocioemocional: FORMACIONES_SOCIOEMOCIONALES[0]
      };

      const updatedConfig = {
        ...actual,
        [field]: value
      };

      const nuevoMapa = {
        ...prev,
        [nNorm]: updatedConfig,
        [grupoNombre]: updatedConfig,
        [nAlt]: updatedConfig
      };

      // Auto-swap inteligente bidireccional entre 3.er y 5.º Semestre (evita colisiones)
      if (field === "ffeoSocioemocional") {
        const letra = grupoNombre.split(" ")[1];
        if (grupoNombre.startsWith("3º") || grupoNombre.startsWith("3°")) {
          const key5Norm = normalizarNombreGrupo(`5° ${letra}`);
          const key5Alt = `5º ${letra}`;
          const config5 = prev[key5Norm] || prev[key5Alt] || {
            capacitacionNombre: "Administracion",
            ffeOptativas: [FFE_RECURSOS_SOCIOCOGNITIVOS[0], FFE_RECURSOS_SOCIOCOGNITIVOS[1], FFE_AREAS_CONOCIMIENTO[0], FFE_AREAS_CONOCIMIENTO[1]],
            ffeoSocioemocional: FORMACIONES_SOCIOEMOCIONALES[1]
          };
          if (config5.ffeoSocioemocional === value) {
            const opcionDisponible = FORMACIONES_SOCIOEMOCIONALES.find(soc => soc !== value) || FORMACIONES_SOCIOEMOCIONALES[1];
            const updated5 = { ...config5, ffeoSocioemocional: opcionDisponible };
            nuevoMapa[key5Norm] = updated5;
            nuevoMapa[key5Alt] = updated5;
          }
        } else if (grupoNombre.startsWith("5º") || grupoNombre.startsWith("5°")) {
          const key3Norm = normalizarNombreGrupo(`3° ${letra}`);
          const key3Alt = `3º ${letra}`;
          const config3 = prev[key3Norm] || prev[key3Alt] || {
            capacitacionNombre: "Administracion",
            ffeOptativas: [
              FFE_RECURSOS_SOCIOCOGNITIVOS[0],
              FFE_RECURSOS_SOCIOCOGNITIVOS[1],
              FFE_AREAS_CONOCIMIENTO[0],
              FFE_AREAS_CONOCIMIENTO[1]
            ],
            ffeoSocioemocional: FORMACIONES_SOCIOEMOCIONALES[0]
          };
          if (config3.ffeoSocioemocional === value) {
            const opcionDisponible = FORMACIONES_SOCIOEMOCIONALES.find(soc => soc !== value) || FORMACIONES_SOCIOEMOCIONALES[0];
            const updated3 = { ...config3, ffeoSocioemocional: opcionDisponible };
            nuevoMapa[key3Norm] = updated3;
            nuevoMapa[key3Alt] = updated3;
          }
        }
      }

      return nuevoMapa;
    });
  };


  const handleSave = async () => {
    setGuardando(true);
    try {
      // Pre-calcular resolución de FFEO para cada track de letras
      const letrasUnicas = Array.from(new Set(gruposGenerados.map(g => (g.nombre || "").split(" ")[1]).filter(Boolean)));
      const tracksResueltos: Record<string, { sem3: string; sem4: string; sem5: string; sem6: string }> = {};
      for (const letra of letrasUnicas) {
        const cfg3 = mapaConfig[normalizarNombreGrupo(`3° ${letra}`)] || mapaConfig[`3° ${letra}`] || mapaConfig[`3º ${letra}`];
        const cfg5 = mapaConfig[normalizarNombreGrupo(`5° ${letra}`)] || mapaConfig[`5° ${letra}`] || mapaConfig[`5º ${letra}`];
        tracksResueltos[letra] = resolverSocioemocionalGrupo(cfg3?.ffeoSocioemocional, cfg5?.ffeoSocioemocional);
      }

      // Construir array de gruposConfig
      const gruposConfig = gruposGenerados.map(g => {
        const letra = (g.nombre || "").split(" ")[1] || "A";
        const trackRes = tracksResueltos[letra];
        const defaultSocio = g.semestre === 3
          ? (trackRes?.sem3 || FORMACIONES_SOCIOEMOCIONALES[0])
          : (trackRes?.sem5 || FORMACIONES_SOCIOEMOCIONALES[1]);

        const cfg = mapaConfig[g.nombre] || mapaConfig[g.nombre.replace("º", "°")] || mapaConfig[g.nombre.replace("°", "º")] || {
          capacitacionNombre: "Administracion",
          ffeOptativas: [
            "Análisis de Fenómenos y Procesos Biológicos",
            "Pensamiento Matemático Aplicado a las Finanzas I",
            "Fundamentos de Administración I",
            "Lógica y Pensamiento Crítico"
          ],
          ffeoSocioemocional: defaultSocio
        };

        const socioFinal = g.semestre === 3
          ? (trackRes?.sem3 || cfg.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[0])
          : (trackRes?.sem5 || cfg.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[1]);

        return {
          grupoNombre: g.nombre,
          semestre: g.semestre,
          capacitacionNombre: cfg.capacitacionNombre,
          ffeOptativas: cfg.ffeOptativas,
          ffeoSocioemocional: socioFinal,
        };
      });

      const res = await fetch(`/api/escuelas/${escuela.id}/mapa-curricular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gruposPrimerAno: g1,
          gruposSegundoAno: g2,
          gruposTercerAno: g3,
          gruposConfig
        })
      });

      if (!res.ok) throw new Error("Error al guardar mapa curricular");

      try {
        localStorage.removeItem(`horarios_wizard_config_v4_${escuela.id}`);
        localStorage.removeItem(`horarios_wizard_config_${escuela.id}`);
      } catch (e) {
        console.warn("No se pudo limpiar localStorage", e);
      }

      toast.success("¡Mapa curricular y estructura del plantel guardados exitosamente!");
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err: any) {
      toast.error(err.message || "No se pudo guardar la configuración");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      background: "rgba(15, 23, 42, 0.75)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1rem"
    }}>
      <div style={{
        background: "var(--bg)",
        width: "100%",
        maxWidth: "850px",
        maxHeight: "90vh",
        borderRadius: "16px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: "1px solid var(--border)"
      }}>
        {/* Header */}
        <div style={{
          padding: "1.25rem 1.5rem",
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.9 }}>
              {escuela.cct} • {escuela.nombre}
            </div>
            <h3 style={{ margin: "0.2rem 0 0", fontSize: "1.15rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Sparkles size={18} /> Mapa Curricular y Estructura del Plantel (1.º a 6.º Semestre)
            </h3>
          </div>
          {(!forceObligatorio || isAdmin) && onClose && (
            <button
              onClick={onClose}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Cerrar ventana"
            >
              <X size={18} />
            </button>
          )}


        </div>

        {/* Stepper Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setPaso(1); }}
            style={{
              flex: 1,
              padding: "0.85rem",
              border: "none",
              background: paso === 1 ? "var(--bg)" : "transparent",
              color: paso === 1 ? "#2563eb" : "var(--text-muted)",
              fontWeight: 800,
              fontSize: "0.875rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              borderBottom: paso === 1 ? "3px solid #2563eb" : "none"
            }}
          >
            <Layers size={16} /> 1. Estructura de Grupos ({g1 + g2 + g3} grupos)
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setPaso(2); }}
            style={{
              flex: 1,
              padding: "0.85rem",
              border: "none",
              background: paso === 2 ? "var(--bg)" : "transparent",
              color: paso === 2 ? "#2563eb" : "var(--text-muted)",
              fontWeight: 800,
              fontSize: "0.875rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              borderBottom: paso === 2 ? "3px solid #2563eb" : "none"
            }}
          >
            <BookOpen size={16} /> 2. Formaciones Laborales & Optativas FFE
          </button>
        </div>

        {/* Body scrollable */}
        <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>

          {/* PASO 1: Estructura de Grupos por Año */}
          {paso === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "1rem", borderRadius: "12px", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <AlertCircle size={24} color="#2563eb" />
                <div style={{ fontSize: "0.85rem", color: "#1e3a8a", lineHeight: 1.4 }}>
                  <strong>Paso 1: Confirme los grupos activos en su plantel.</strong><br />
                  Escriba la cantidad de grupos activos por grado/año. Esta información se usará para construir automáticamente las listas en Horarios IA y Planeaciones Didácticas.
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
                <div className="card" style={{ padding: "1.25rem", border: "1px solid var(--border)", textAlign: "center" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                    1.er Año (1.º y 2.º Semestre)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={g1}
                    onChange={(e) => setG1(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: "100%", fontSize: "1.5rem", fontWeight: 800, textAlign: "center", padding: "0.5rem", borderRadius: "8px", border: "2px solid #2563eb" }}
                  />
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                    Genera: 1º A {g1 > 1 ? `hasta 1º ${String.fromCharCode(64 + g1)}` : ""}
                  </div>
                </div>

                <div className="card" style={{ padding: "1.25rem", border: "1px solid var(--border)", textAlign: "center" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                    2.º Año (3.er y 4.º Semestre)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={g2}
                    onChange={(e) => setG2(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: "100%", fontSize: "1.5rem", fontWeight: 800, textAlign: "center", padding: "0.5rem", borderRadius: "8px", border: "2px solid #2563eb" }}
                  />
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                    Genera: 3º A {g2 > 1 ? `hasta 3º ${String.fromCharCode(64 + g2)}` : ""}
                  </div>
                </div>

                <div className="card" style={{ padding: "1.25rem", border: "1px solid var(--border)", textAlign: "center" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                    3.er Año (5.º y 6.º Semestre)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={g3}
                    onChange={(e) => setG3(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: "100%", fontSize: "1.5rem", fontWeight: 800, textAlign: "center", padding: "0.5rem", borderRadius: "8px", border: "2px solid #2563eb" }}
                  />
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                    Genera: 5º A {g3 > 1 ? `hasta 5º ${String.fromCharCode(64 + g3)}` : ""}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={(e) => { e.preventDefault(); setPaso(2); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, padding: "0.6rem 1.25rem" }}
                >
                  Continuar al Mapa Curricular por Grupo <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* PASO 2: Asignación por Grupo */}
          {paso === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ background: "#f8fafc", border: "1px solid var(--border)", padding: "0.85rem 1rem", borderRadius: "10px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <strong>Paso 2: Configure la Formación Laboral, Optativas FFE y Socioemocional por Grupo.</strong><br />
                Para cada grupo de 3.º y 5.º semestre, seleccione las asignaturas correspondientes a su oferta educativa.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {gruposGenerados.map(g => {
                  const rawCfg = mapaConfig[g.nombre] || mapaConfig[g.nombre.replace("º", "°")] || mapaConfig[g.nombre.replace("°", "º")];
                  const cfg = {
                    capacitacionNombre: rawCfg?.capacitacionNombre || "Administracion",
                    ffeOptativas: Array.isArray(rawCfg?.ffeOptativas) && rawCfg.ffeOptativas.length === 4 ? rawCfg.ffeOptativas : [
                      FFE_RECURSOS_SOCIOCOGNITIVOS[0],
                      FFE_RECURSOS_SOCIOCOGNITIVOS[1],
                      FFE_AREAS_CONOCIMIENTO[0],
                      FFE_AREAS_CONOCIMIENTO[1]
                    ],
                    ffeoSocioemocional: rawCfg?.ffeoSocioemocional || (g.semestre === 3 ? FORMACIONES_SOCIOEMOCIONALES[0] : FORMACIONES_SOCIOEMOCIONALES[1])
                  };


                  return (
                    <div key={g.id} className="card" style={{ padding: "1.25rem", border: "1px solid var(--border)", background: "var(--bg)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ width: "28px", height: "28px", borderRadius: "6px", background: "#2563eb", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.85rem" }}>
                            {g.nombre.split(" ")[0]}
                          </span>
                          <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text)" }}>
                            Grupo {g.nombre} ({g.semestre}° Semestre)
                          </span>
                        </div>

                        <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "12px", background: "#eff6ff", color: "#1d4ed8" }}>
                          {g.semestre === 1 ? "100% Fundamental Universal" : g.semestre === 3 ? "Laboral (9 UACs)" : "Laboral + FFE (10 UACs)"}
                        </span>
                      </div>

                      {/* Grupos de 1º Semestre */}
                      {g.semestre === 1 && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                          ✓ Asignaturas del Currículum Fundamental MCCEMS 100% universales (Ciencias Naturales, Experimentales y Tecnología I, Pensamiento Matemático I, Humanidades I, Lenguaje y Comunicación I, etc.).
                        </div>
                      )}

                      {/* Grupos de 3º Semestre */}
                      {g.semestre === 3 && (() => {
                        const letra = g.nombre.split(" ")[1];
                        const config5 = mapaConfig[normalizarNombreGrupo(`5° ${letra}`)] || mapaConfig[`5° ${letra}`] || mapaConfig[`5º ${letra}`];
                        const socio5 = config5?.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[1];
                        const socio4y6 = FORMACIONES_SOCIOEMOCIONALES.find(soc => soc !== cfg.ffeoSocioemocional && soc !== socio5) || FORMACIONES_SOCIOEMOCIONALES[2];

                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                              <div>
                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                                  Formación Laboral (Capacitación del Grupo):
                                </label>
                                <select
                                  className="form-control"
                                  value={cfg.capacitacionNombre}
                                  onChange={(e) => handleUpdateGrupoConfig(g.nombre, "capacitacionNombre", e.target.value)}
                                  style={{ fontSize: "0.85rem", fontWeight: 700 }}
                                >
                                  {FORMACIONES_LABORALES.map(cap => (
                                    <option key={cap} value={cap}>{cap}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                                  Formación Socioemocional (Opción 1 - 3.er Semestre):
                                </label>
                                <select
                                  className="form-control"
                                  value={cfg.ffeoSocioemocional}
                                  onChange={(e) => handleUpdateGrupoConfig(g.nombre, "ffeoSocioemocional", e.target.value)}
                                  style={{ fontSize: "0.85rem", fontWeight: 700 }}
                                >
                                  {FORMACIONES_SOCIOEMOCIONALES.map(soc => (
                                    <option key={soc} value={soc}>{soc}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* 📗 Bloque informativo: Semestre B (4.º Semestre automático) */}
                            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.75rem 1rem", borderRadius: "10px" }}>
                              <div style={{ fontSize: "0.78125rem", fontWeight: 800, color: "#15803d", marginBottom: "0.3rem" }}>
                                📗 Semestre B Correspondiente (4.º Semestre - Grupo 4° {letra})
                              </div>
                              <div style={{ fontSize: "0.725rem", color: "#166534", lineHeight: 1.4 }}>
                                • <strong>Laboral:</strong> Submódulos 3 y 4 de <em>{cfg.capacitacionNombre}</em> (Automático)<br />
                                • <strong>Socioemocional:</strong> <em>{socio4y6}</em> (Automático)
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Grupos de 5º Semestre */}
                      {g.semestre === 5 && (() => {
                        const letra = g.nombre.split(" ")[1];
                        const config3 = mapaConfig[normalizarNombreGrupo(`3° ${letra}`)] || mapaConfig[`3° ${letra}`] || mapaConfig[`3º ${letra}`];
                        const socio3 = config3?.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[0];
                        const opcionesSocio5 = FORMACIONES_SOCIOEMOCIONALES.filter(soc => soc !== socio3);
                        const socio5Actual = opcionesSocio5.includes(cfg.ffeoSocioemocional) ? cfg.ffeoSocioemocional : opcionesSocio5[0];
                        const socio4y6 = FORMACIONES_SOCIOEMOCIONALES.find(soc => soc !== socio3 && soc !== socio5Actual) || FORMACIONES_SOCIOEMOCIONALES[2];
                        const ffeOpts = cfg.ffeOptativas || [
                          FFE_OPTATIVAS_CATALOGO[0],
                          FFE_OPTATIVAS_CATALOGO[1],
                          FFE_OPTATIVAS_CATALOGO[7],
                          FFE_OPTATIVAS_CATALOGO[8]
                        ];

                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                              <div>
                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                                  Formación Laboral (Capacitación):
                                </label>
                                <select
                                  className="form-control"
                                  value={cfg.capacitacionNombre}
                                  onChange={(e) => handleUpdateGrupoConfig(g.nombre, "capacitacionNombre", e.target.value)}
                                  style={{ fontSize: "0.85rem", fontWeight: 700 }}
                                >
                                  {FORMACIONES_LABORALES.map(cap => (
                                    <option key={cap} value={cap}>{cap}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                                  Formación Socioemocional (Opción 2 - 5.º Semestre):
                                </label>
                                <select
                                  className="form-control"
                                  value={socio5Actual}
                                  onChange={(e) => handleUpdateGrupoConfig(g.nombre, "ffeoSocioemocional", e.target.value)}
                                  style={{ fontSize: "0.85rem", fontWeight: 700 }}
                                >
                                  {opcionesSocio5.map(soc => (
                                    <option key={soc} value={soc}>{soc}</option>
                                  ))}
                                </select>
                                <div style={{ fontSize: "0.725rem", color: "#15803d", marginTop: "0.3rem", fontWeight: 700, background: "#f0fdf4", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                                  ⚡ Opción de 3.er semestre: <strong>{socio3}</strong><br />
                                  ℹ️ 4.º y 6.º Semestre llevarán automáticamente: <strong>{socio4y6}</strong>
                                </div>
                              </div>
                            </div>

                            {/* Optativas FFE - Selección Libre */}
                            <div style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border)" }}>
                              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 800, color: "var(--primary)", marginBottom: "0.75rem" }}>
                                Optativas FFE (Selección libre de 4 asignaturas del catálogo oficial MCCEMS):
                              </label>

                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
                                {[0, 1, 2, 3].map((optIdx) => {
                                  const valorActual = ffeOpts[optIdx] || FFE_OPTATIVAS_CATALOGO[optIdx] || FFE_OPTATIVAS_CATALOGO[0];
                                  const otrasSeleccionadas = ffeOpts.filter((_: any, i: number) => i !== optIdx);

                                  return (
                                    <div key={optIdx} style={{ background: "var(--card-bg, #fff)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                                        Optativa FFE {optIdx + 1}:
                                      </div>
                                      <select
                                        className="form-control"
                                        value={valorActual}
                                        onChange={(e) => {
                                          const copia = [...ffeOpts];
                                          copia[optIdx] = e.target.value;
                                          handleUpdateGrupoConfig(g.nombre, "ffeOptativas", copia);
                                        }}
                                        style={{ fontSize: "0.75rem", width: "100%" }}
                                      >
                                        <optgroup label="Recursos Sociocognitivos">
                                          {FFE_RECURSOS_SOCIOCOGNITIVOS.map(opt => (
                                            <option key={opt} value={opt} disabled={otrasSeleccionadas.includes(opt)}>
                                              {opt} {otrasSeleccionadas.includes(opt) ? "(Ya elegida)" : ""}
                                            </option>
                                          ))}
                                        </optgroup>
                                        <optgroup label="Áreas de Conocimiento">
                                          {FFE_AREAS_CONOCIMIENTO.map(opt => (
                                            <option key={opt} value={opt} disabled={otrasSeleccionadas.includes(opt)}>
                                              {opt} {otrasSeleccionadas.includes(opt) ? "(Ya elegida)" : ""}
                                            </option>
                                          ))}
                                        </optgroup>
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 📗 Bloque informativo: Semestre B (6.º Semestre automático) */}
                            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.75rem 1rem", borderRadius: "10px" }}>
                              <div style={{ fontSize: "0.78125rem", fontWeight: 800, color: "#15803d", marginBottom: "0.3rem" }}>
                                📗 Semestre B Correspondiente (6.º Semestre - Grupo 6° {letra})
                              </div>
                              <div style={{ fontSize: "0.725rem", color: "#166534", lineHeight: 1.4 }}>
                                • <strong>Laboral:</strong> Submódulos 5 y 6 de <em>{cfg.capacitacionNombre}</em> (Automático)<br />
                                • <strong>Socioemocional:</strong> <em>{socio4y6}</em> (Automático)<br />
                                • <strong>Optativas FFE:</strong> Mantiene las 4 optativas FFE de 5.º Semestre (Automático)
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: "1rem 1.5rem",
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Total de grupos a registrar: <strong>{g1 + g2 + g3} grupos</strong>
          </span>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            {paso === 2 && (
              <button
                className="btn btn-outline"
                onClick={() => setPaso(1)}
                disabled={guardando}
                style={{ fontSize: "0.85rem", fontWeight: 700 }}
              >
                Regresar a Grupos
              </button>
            )}

            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={guardando}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 700, background: "#16a34a", borderColor: "#16a34a" }}
            >
              {guardando ? (
                <>
                  <RefreshCw size={16} className="spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save size={16} /> Guardar Mapa Curricular del Plantel
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
