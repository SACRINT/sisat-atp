"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Users, BookOpen, Clock, AlertCircle, ShieldCheck, UserCheck, Plus, Trash2, CheckCircle2, UserPlus, Layers, Search, Save, AlertTriangle, FileSpreadsheet, Download, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { parsearExcelPersonal, descargarPlantillaExcelDocentes, DocenteImportado } from "@/lib/excel-plantilla";
import { parsearExcelMatriz, parsearLibroIntegralExcel, descargarPlantillaIntegralHorarios, descargarPlantillaMatrizDocente, ResultadoParseoMatriz, ResultadoLibroIntegral } from "@/lib/excel-matriz";

interface Props {
  escuelaId: string;
  configInicial: any;
  gruposIniciales: any[];
  aulasIniciales: any[];
  docentesIniciales: any[];
  cargasIniciales: any[];
  onGenerarClick: (params?: any) => void;
  pasoInicial?: number;
  onStepChange?: (paso: number) => void;
}

import {
  FORMACIONES_LABORALES,
  FORMACIONES_SOCIOEMOCIONALES,
  FORMACIONES_SOCIOEMOCIONALES as CURRICULUM_AMPLIADO_FFEO,
  FFE_RECURSOS_SOCIOCOGNITIVOS as FFE_RECURSO_SOCIOCOGNITIVO,
  FFE_AREAS_CONOCIMIENTO as FFE_AREA_CONOCIMIENTO,
  FFE_OPTATIVAS_CATALOGO,
  obtenerFfeSemestre6,
  resolverSocioemocionalGrupo,
  UACS_LABORALES_MAPA
} from "@/lib/escuela-grupos";

export default function WizardConfiguracion({
  escuelaId,
  configInicial,
  gruposIniciales,
  aulasIniciales,
  docentesIniciales,
  cargasIniciales,
  onGenerarClick,
  pasoInicial = 1,
  onStepChange
}: Props) {
  const STORAGE_KEY = `horarios_wizard_v4_${escuelaId}`;

  const [paso, setPasoState] = useState<number>(pasoInicial);

  const setPaso = (nuevoPaso: number) => {
    setPasoState(nuevoPaso);
    if (onStepChange) onStepChange(nuevoPaso);
  };

  useEffect(() => {
    if (pasoInicial && pasoInicial >= 1 && pasoInicial <= 3 && pasoInicial !== paso) {
      setPasoState(pasoInicial);
    }
  }, [pasoInicial]);

  // Período Semestral: A = semestres impares (1°,3°,5°), B = semestres pares (2°,4°,6°)
  const [periodoActivo, setPeriodoActivo] = useState<"A" | "B">("A");
  const [loading, setLoading] = useState<boolean>(false);

  // Jornada Escolar predeterminada estrictamente a 6 Horas Diarias (30 hrs semanales)
  const [numPeriodos, setNumPeriodos] = useState<number>(6);
  const [horaInicio, setHoraInicio] = useState<string>("08:00");

  // Flag: true = ya se cargaron grupos desde BD, NO regenerar automáticamente
  const [inicializadoDesdeBD, setInicializadoDesdeBD] = useState<boolean>(false);
  // Flag: true = el usuario cambió manualmente el número de grupos, SÍ regenerar
  const [usuarioCambioGrupos, setUsuarioCambioGrupos] = useState<boolean>(false);

  // Número de grupos por grado independiente (1º, 3º, 5º)
  const [g1, setG1] = useState<number>(() => {
    if (configInicial?.escuela?.gruposPrimerAno) return Number(configInicial.escuela.gruposPrimerAno);
    const g1Count = Math.max(
      (gruposIniciales || []).filter(g => g.semestre === 1).length,
      (gruposIniciales || []).filter(g => g.semestre === 2).length
    );
    return g1Count > 0 ? g1Count : 3;
  });
  const [g2, setG2] = useState<number>(() => {
    if (configInicial?.escuela?.gruposSegundoAno) return Number(configInicial.escuela.gruposSegundoAno);
    const g2Count = Math.max(
      (gruposIniciales || []).filter(g => g.semestre === 3).length,
      (gruposIniciales || []).filter(g => g.semestre === 4).length
    );
    return g2Count > 0 ? g2Count : 3;
  });
  const [g3, setG3] = useState<number>(() => {
    if (configInicial?.escuela?.gruposTercerAno) return Number(configInicial.escuela.gruposTercerAno);
    const g3Count = Math.max(
      (gruposIniciales || []).filter(g => g.semestre === 5).length,
      (gruposIniciales || []).filter(g => g.semestre === 6).length
    );
    return g3Count > 0 ? g3Count : 3;
  });

  // Datos del Plantel y Supervisión Escolar dinámicos
  const [nombreEscuela, setNombreEscuela] = useState<string>(() => configInicial?.escuela?.nombre || configInicial?.escuela?.school_name || "Mi Plantel");
  const [cctEscuela, setCctEscuela] = useState<string>(() => configInicial?.escuela?.cct || "");
  const [zonaEscolar, setZonaEscolar] = useState<string>(() => configInicial?.escuela?.zonaEscolar || configInicial?.escuela?.zona || "086");

  const [inicializadoConfig, setInicializadoConfig] = useState(false);

  // Sincronizar g1, g2, g3 y datos de escuela cuando cambia configInicial o escuelaId
  useEffect(() => {
    if (inicializadoConfig) return;

    if (configInicial?.escuela) {
      if (configInicial.escuela.gruposPrimerAno) setG1(Number(configInicial.escuela.gruposPrimerAno));
      if (configInicial.escuela.gruposSegundoAno) setG2(Number(configInicial.escuela.gruposSegundoAno));
      if (configInicial.escuela.gruposTercerAno) setG3(Number(configInicial.escuela.gruposTercerAno));
      if (configInicial.escuela.nombre) setNombreEscuela(configInicial.escuela.nombre);
      if (configInicial.escuela.cct) setCctEscuela(configInicial.escuela.cct);
      if (configInicial.escuela.zonaEscolar || configInicial.escuela.zona) {
        setZonaEscolar(configInicial.escuela.zonaEscolar || configInicial.escuela.zona);
      }
      setInicializadoConfig(true);
    } else if (gruposIniciales && gruposIniciales.length > 0) {
      const c1 = Math.max(
        gruposIniciales.filter(g => g.semestre === 1).length,
        gruposIniciales.filter(g => g.semestre === 2).length
      );
      const c2 = Math.max(
        gruposIniciales.filter(g => g.semestre === 3).length,
        gruposIniciales.filter(g => g.semestre === 4).length
      );
      const c3 = Math.max(
        gruposIniciales.filter(g => g.semestre === 5).length,
        gruposIniciales.filter(g => g.semestre === 6).length
      );
      if (c1 > 0) setG1(c1);
      if (c2 > 0) setG2(c2);
      if (c3 > 0) setG3(c3);
      setInicializadoConfig(true);
    }
  }, [configInicial, escuelaId, gruposIniciales, inicializadoConfig]);

  // ─── PRIORIDAD ABSOLUTA BD: Los grupos de la BD recargan y generan los grupos completos ───
  useEffect(() => {
    if (gruposIniciales && gruposIniciales.length > 0) {
      generarGruposSegunEstructura(g1, g2, g3);
      setInicializadoDesdeBD(true);
    }
  }, [gruposIniciales, escuelaId, g1, g2, g3]);

  // Modo de Configuración: Semiautomático (SEP General) vs Manual Libre (Tecnológicos)
  const [modoConfiguracion, setModoConfiguracion] = useState<"SEMIAUTOMATICO" | "MANUAL_TECNOLOGICO">("SEMIAUTOMATICO");

  // Tab activa en editor manual (letra del grupo: "A", "B", "C"...)
  const [grupoActivoManual, setGrupoActivoManual] = useState<string>("A");

  // Currículo manual por grupo: clave = "semestre_letra" (ej: "1_A", "3_B", "5_C")
  const [curriculoManualPorGrupo, setCurriculoManualPorGrupo] = useState<Record<string, any[]>>({});

  // Estado de Grupos
  const [grupos, setGrupos] = useState<any[]>([]);

  // Docentes activos en la plantilla del horario
  const [docentes, setDocentes] = useState<any[]>(docentesIniciales || []);
  const [horasDocentes, setHorasDocentes] = useState<Record<string, number>>({});

  // Filtrado de personal apto para dar clases (excluir Apoyo / Asistencia)
  const docentesAptosParaHorario = React.useMemo(() => {
    return docentes.filter((d) => {
      if (!d.cargo) return true;
      const cargoUpper = String(d.cargo).toUpperCase();
      return (
        !cargoUpper.includes("ASISTENCIA") &&
        !cargoUpper.includes("APOYO") &&
        cargoUpper !== "PERSONAL_DE_ASISTENCIA" &&
        cargoUpper !== "APOYO_ADMINISTRATIVO"
      );
    });
  }, [docentes]);

  // Cargas Docente-Materia-Grupo (Paso 3)
  const normalizarCargas = (cargasRaw: any[]) => {
    if (!cargasRaw || cargasRaw.length === 0) return [];
    const mapa = new Map<string, any>();
    for (const c of cargasRaw) {
      const uacNameReal = c.uacName || c.asignatura?.uacName || c.asignaturaNombre;
      if (!c.uacName && uacNameReal) {
        c.uacName = uacNameReal;
      }
      const key = `${c.grupoId}__${c.uacName || c.asignaturaId}`;
      mapa.set(key, c);
    }
    return Array.from(mapa.values());
  };
  const [cargas, setCargas] = useState<any[]>(() => normalizarCargas(cargasIniciales || []));

  // Modal para agregar nuevo docente
  const [mostrarModalDocente, setMostrarModalDocente] = useState<boolean>(false);
  const [tabModalDocente, setTabModalDocente] = useState<"PLATAFORMA" | "MANUAL" | "EXCEL">("PLATAFORMA");
  const [personalPlataforma, setPersonalPlataforma] = useState<any[]>([]);
  const [busquedaPersonal, setBusquedaPersonal] = useState<string>("");

  const [nuevoDocenteNombre, setNuevoDocenteNombre] = useState<string>("");
  const [nuevoDocentePaterno, setNuevoDocentePaterno] = useState<string>("");
  const [nuevoDocenteMaterno, setNuevoDocenteMaterno] = useState<string>("");
  const [nuevoDocenteCargo, setNuevoDocenteCargo] = useState<string>("DOCENTE");
  const [nuevoDocenteEmail, setNuevoDocenteEmail] = useState<string>("");
  const [nuevoDocenteHoras, setNuevoDocenteHoras] = useState<number>(20);

  // Estados para Importación Masiva Excel de Personal (Paso 2)
  const [archivoExcelHorarios, setArchivoExcelHorarios] = useState<File | null>(null);
  const [docentesParseadosHorarios, setDocentesParseadosHorarios] = useState<DocenteImportado[]>([]);
  const [cargandoExcelHorarios, setCargandoExcelHorarios] = useState<boolean>(false);
  const fileInputHorariosRef = useRef<HTMLInputElement>(null);

  // Estados para Importación Masiva de Matriz Horaria Excel (Paso 3)
  const [mostrarModalMatrizExcel, setMostrarModalMatrizExcel] = useState<boolean>(false);
  const [archivoMatrizExcel, setArchivoMatrizExcel] = useState<File | null>(null);
  const [resultadoParseoMatriz, setResultadoParseoMatriz] = useState<ResultadoParseoMatriz | null>(null);
  const [cargandoMatrizExcel, setCargandoMatrizExcel] = useState<boolean>(false);
  const fileInputMatrizRef = useRef<HTMLInputElement>(null);

  // Cargar estado guardado previamente desde localStorage
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        // NOTA: NO sobreescribir 'paso', 'g1', 'g2', 'g3' desde localStorage para respetar la base de datos y la navegación directa del usuario
        if (parsed.numPeriodos) setNumPeriodos(parsed.numPeriodos);
        if ((!gruposIniciales || gruposIniciales.length === 0) && parsed.grupos && parsed.grupos.length > 0) {
          setGrupos(parsed.grupos);
        }
        if (parsed.horasDocentes) setHorasDocentes(parsed.horasDocentes);
        if (parsed.curriculoManualPorGrupo) setCurriculoManualPorGrupo(parsed.curriculoManualPorGrupo);
        if (parsed.grupoActivoManual) setGrupoActivoManual(parsed.grupoActivoManual);
        if (parsed.cargas && parsed.cargas.length > 0) setCargas(parsed.cargas);
        if (parsed.periodoActivo === "A" || parsed.periodoActivo === "B") setPeriodoActivo(parsed.periodoActivo);
        if (parsed.zonaEscolar) setZonaEscolar(parsed.zonaEscolar);
        if (parsed.nombreEscuela) setNombreEscuela(parsed.nombreEscuela);
        if (parsed.cctEscuela) setCctEscuela(parsed.cctEscuela);
      }
    } catch (e) {
      console.warn("No se pudo cargar estado local previo", e);
    }
  }, [escuelaId, gruposIniciales]);

  // Autoguardado continuo en localStorage
  const guardarProgresoLocal = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          paso,
          g1,
          g2,
          g3,
          numPeriodos,
          grupos,
          horasDocentes,
          curriculoManualPorGrupo,
          grupoActivoManual,
          cargas,
          periodoActivo,
          zonaEscolar,
          nombreEscuela,
          cctEscuela
        })
      );
    } catch (e) {
      console.warn("Error al guardar en localStorage", e);
    }
  };

  useEffect(() => {
    guardarProgresoLocal();
  }, [paso, g1, g2, g3, numPeriodos, grupos, horasDocentes, cargas, curriculoManualPorGrupo, grupoActivoManual, periodoActivo, zonaEscolar, nombreEscuela, cctEscuela]);

  useEffect(() => {
    cargarPersonalCompleto();
  }, [escuelaId]);

  useEffect(() => {
    if (docentesIniciales && docentesIniciales.length > 0 && docentes.length === 0) {
      setDocentes(docentesIniciales);
    }
  }, [docentesIniciales]);

  // Normaliza nombre de grupo: convierte tanto "3º A" como "3° A" a "3° A" (símbolo grado)
  const normalizarNombreGrupo = (nombre: string) =>
    nombre.replace(/º/g, "°");

  const generarGruposSegunEstructura = (n1: number, n2: number, n3: number) => {
    const letras = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const nuevosGrupos: any[] = [];
    const semestresActivos = [1, 2, 3, 4, 5, 6];
    const counts: Record<number, number> = {
      1: n1, 2: n1,
      3: n2, 4: n2,
      5: n3, 6: n3
    };

    const gruposActuales = grupos;

    for (let sem of semestresActivos) {
      const countSem = counts[sem] || 1;
      for (let i = 0; i < countSem; i++) {
        const letra = letras[i] || `G${i + 1}`;
        const nombreGrupo = `${sem}° ${letra}`;

        const grupoDbOficial = (gruposIniciales || []).find(
          (g: any) => normalizarNombreGrupo(g.nombre) === nombreGrupo
        );

        let grupoExistente = grupoDbOficial || gruposActuales.find(
          (g) => normalizarNombreGrupo(g.nombre) === nombreGrupo
        );

        const semBaseTrack = sem === 4 ? 3 : sem === 6 ? 5 : sem;
        const nombreBaseTrack = `${semBaseTrack}° ${letra}`;
        const grupoBaseTrack = (gruposIniciales || []).find(
          (g: any) => normalizarNombreGrupo(g.nombre) === nombreBaseTrack
        ) || gruposActuales.find(
          (g: any) => normalizarNombreGrupo(g.nombre) === nombreBaseTrack
        );

        let ffeOpts = grupoDbOficial?.ffeOptativas || grupoExistente?.ffeOptativas || grupoBaseTrack?.ffeOptativas;
        if (typeof ffeOpts === "string") {
          try { ffeOpts = JSON.parse(ffeOpts); } catch { ffeOpts = null; }
        }

        const g3Socio = (gruposIniciales || []).find((g: any) => normalizarNombreGrupo(g.nombre) === `3° ${letra}`)?.ffeoSocioemocional
          || gruposActuales.find(g => normalizarNombreGrupo(g.nombre) === `3° ${letra}`)?.ffeoSocioemocional;
        const g5Socio = (gruposIniciales || []).find((g: any) => normalizarNombreGrupo(g.nombre) === `5° ${letra}`)?.ffeoSocioemocional
          || gruposActuales.find(g => normalizarNombreGrupo(g.nombre) === `5° ${letra}`)?.ffeoSocioemocional;
        const resolvedSocio = resolverSocioemocionalGrupo(g3Socio, g5Socio);

        let socioCalculado: string;
        if (sem === 3) {
          socioCalculado = grupoDbOficial?.ffeoSocioemocional || resolvedSocio.sem3;
        } else if (sem === 4) {
          socioCalculado = resolvedSocio.sem4;
        } else if (sem === 5) {
          socioCalculado = grupoDbOficial?.ffeoSocioemocional || resolvedSocio.sem5;
        } else if (sem === 6) {
          socioCalculado = resolvedSocio.sem6;
        } else {
          socioCalculado = FORMACIONES_SOCIOEMOCIONALES[0];
        }

        const tieneLaboral = sem >= 3;
        const capFinal = grupoDbOficial?.capacitacionNombre || grupoExistente?.capacitacionNombre || grupoBaseTrack?.capacitacionNombre || FORMACIONES_LABORALES[i % FORMACIONES_LABORALES.length];

        nuevosGrupos.push({
          id: grupoDbOficial?.id || grupoExistente?.id || `temp_${sem}_${letra}`,
          nombre: nombreGrupo,
          semestre: sem,
          horasPorDia: (grupoDbOficial as any)?.horasPorDia || (grupoExistente as any)?.horasPorDia || (sem === 1 ? 5 : 6),
          capacitacionNombre: tieneLaboral ? capFinal : undefined,
          ffeoSocioemocional: tieneLaboral ? socioCalculado : undefined,
          ffeOptativas: (Array.isArray(ffeOpts) && ffeOpts.length > 0) ? ffeOpts : [
            FFE_OPTATIVAS_CATALOGO[0],
            FFE_OPTATIVAS_CATALOGO[1],
            FFE_OPTATIVAS_CATALOGO[7],
            FFE_OPTATIVAS_CATALOGO[8]
          ]
        });
      }
    }
    setGrupos(nuevosGrupos);

    setCurriculoManualPorGrupo(prev => {
      const nuevoMapa = { ...prev };
      const semestresActivos2 = periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6];
      const counts2: Record<number, number> = periodoActivo === "A"
        ? { 1: n1, 3: n2, 5: n3 }
        : { 2: n1, 4: n2, 6: n3 };
      for (const sem of semestresActivos2) {
        const countSem = counts2[sem] || 1;
        for (let i = 0; i < countSem; i++) {
          const letra = letras[i] || `G${i + 1}`;
          const key = `${sem}_${letra}`;
          if (!nuevoMapa[key]) {
            nuevoMapa[key] = getDefaultMateriasSem(sem, letra);
          }
        }
      }
      return nuevoMapa;
    });

    const maxGrupos = Math.max(n1, n2, n3);
    const letrasActivas = letras.slice(0, maxGrupos);
    setGrupoActivoManual(prev => letrasActivas.includes(prev) ? prev : "A");
  };

  useEffect(() => {
    if (usuarioCambioGrupos) {
      generarGruposSegunEstructura(g1, g2, g3);
      setUsuarioCambioGrupos(false);
    }
  }, [g1, g2, g3, usuarioCambioGrupos]);

  const getDefaultMateriasSem = (sem: number, letra: string): any[] => {
    if (sem === 1) return [
      { id: `man_1_1_${letra}`, uacName: "Matemáticas Tecnológicas I", horasSemanales: 5 },
      { id: `man_1_2_${letra}`, uacName: "Química I", horasSemanales: 4 },
      { id: `man_1_3_${letra}`, uacName: "Lengua y Comunicación I", horasSemanales: 4 },
      { id: `man_1_4_${letra}`, uacName: "Inglés I", horasSemanales: 3 },
      { id: `man_1_5_${letra}`, uacName: "Tecnologías de la Información", horasSemanales: 4 }
    ];
    if (sem === 2) return [
      { id: `man_2_1_${letra}`, uacName: "Matemáticas Tecnológicas II", horasSemanales: 5 },
      { id: `man_2_2_${letra}`, uacName: "Química II", horasSemanales: 4 },
      { id: `man_2_3_${letra}`, uacName: "Lengua y Comunicación II", horasSemanales: 4 },
      { id: `man_2_4_${letra}`, uacName: "Inglés II", horasSemanales: 3 },
      { id: `man_2_5_${letra}`, uacName: "Tecnologías de la Información II", horasSemanales: 4 }
    ];
    if (sem === 3) return [
      { id: `man_3_1_${letra}`, uacName: "Física I", horasSemanales: 4 },
      { id: `man_3_2_${letra}`, uacName: "Cálculo Diferencial", horasSemanales: 5 },
      { id: `man_3_3_${letra}`, uacName: "Módulo Profesional I (Especialidad)", horasSemanales: 12 },
      { id: `man_3_4_${letra}`, uacName: "Inglés III", horasSemanales: 3 }
    ];
    if (sem === 4) return [
      { id: `man_4_1_${letra}`, uacName: "Física II", horasSemanales: 4 },
      { id: `man_4_2_${letra}`, uacName: "Cálculo Integral", horasSemanales: 5 },
      { id: `man_4_3_${letra}`, uacName: "Módulo Profesional I B (Especialidad)", horasSemanales: 12 },
      { id: `man_4_4_${letra}`, uacName: "Inglés IV", horasSemanales: 3 }
    ];
    if (sem === 5) return [
      { id: `man_5_1_${letra}`, uacName: "Cálculo Integral", horasSemanales: 5 },
      { id: `man_5_2_${letra}`, uacName: "Módulo Profesional II (Especialidad)", horasSemanales: 12 },
      { id: `man_5_3_${letra}`, uacName: "Ciencia, Tecnología y Sociedad", horasSemanales: 4 },
      { id: `man_5_4_${letra}`, uacName: "Inglés V", horasSemanales: 3 }
    ];
    if (sem === 6) return [
      { id: `man_6_1_${letra}`, uacName: "Estadística y Probabilidad", horasSemanales: 4 },
      { id: `man_6_2_${letra}`, uacName: "Módulo Profesional II B (Especialidad)", horasSemanales: 12 },
      { id: `man_6_3_${letra}`, uacName: "Ciencia, Tecnología y Sociedad II", horasSemanales: 4 },
      { id: `man_6_4_${letra}`, uacName: "Inglés VI", horasSemanales: 3 }
    ];
    return [];
  };

  const handleAgregarMateriaManual = (semestre: number, letra: string) => {
    const key = `${semestre}_${letra}`;
    const nuevaMateria = {
      id: `man_${semestre}_${letra}_${Date.now()}`,
      uacName: `Nueva Asignatura ${semestre}° Semestre`,
      horasSemanales: 4
    };
    setCurriculoManualPorGrupo(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), nuevaMateria]
    }));
    toast.success(`Asignatura agregada al Grupo ${letra} – ${semestre}° Semestre`);
  };

  const handleActualizarMateriaManual = (semestre: number, letra: string, index: number, field: string, value: any) => {
    const key = `${semestre}_${letra}`;
    setCurriculoManualPorGrupo(prev => {
      const copia = [...(prev[key] || [])];
      copia[index] = { ...copia[index], [field]: value };
      return { ...prev, [key]: copia };
    });
  };

  const handleEliminarMateriaManual = (semestre: number, letra: string, index: number) => {
    const key = `${semestre}_${letra}`;
    setCurriculoManualPorGrupo(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter((_: any, i: number) => i !== index)
    }));
    toast.success("Asignatura removida");
  };

  // Inicializar horas por docente (0 hrs para Administrativos/Apoyo/Responsable, 20 hrs para Docentes)
  useEffect(() => {
    if (docentes.length > 0) {
      const mapaHoras: Record<string, number> = { ...horasDocentes };
      docentes.forEach((d) => {
        if (mapaHoras[d.id] === undefined) {
          const esDocentePuro = d.cargo === "DOCENTE";
          mapaHoras[d.id] = d.horasAsignadas !== undefined ? d.horasAsignadas : (d.horasOficiales !== undefined ? d.horasOficiales : (esDocentePuro ? 20 : 0));
        }
      });
      setHorasDocentes(mapaHoras);
    }
  }, [docentes]);

  const cargarPersonalCompleto = async () => {
    try {
      const res = await fetch(`/api/horarios/catalogos`);
      const data = await res.json();
      const arrayPersonal = data.docentes || (Array.isArray(data) ? data : []);
      setPersonalPlataforma(arrayPersonal);
    } catch (e) {
      console.error("Error al cargar personal de la escuela:", e);
    }
  };

  const handleActualizarConfigGrupo = (index: number, field: string, value: any) => {
    const copia = [...grupos];
    copia[index][field] = value;

    if (field === "ffeoSocioemocional") {
      const sem = copia[index].semestre;
      const letraGrupo = copia[index].nombre.split(" ")[1];

      if (sem === 3 || sem === 5) {
        const g3 = copia.find((g) => g.semestre === 3 && g.nombre.endsWith(letraGrupo));
        const g5 = copia.find((g) => g.semestre === 5 && g.nombre.endsWith(letraGrupo));

        const socio3 = g3?.ffeoSocioemocional;
        const socio5 = g5?.ffeoSocioemocional;
        const resolved = resolverSocioemocionalGrupo(socio3, socio5);

        if (g3) g3.ffeoSocioemocional = resolved.sem3;
        if (g5) g5.ffeoSocioemocional = resolved.sem5;

        const g4 = copia.find((g) => g.semestre === 4 && g.nombre.endsWith(letraGrupo));
        if (g4) g4.ffeoSocioemocional = resolved.sem4;

        const g6 = copia.find((g) => g.semestre === 6 && g.nombre.endsWith(letraGrupo));
        if (g6) g6.ffeoSocioemocional = resolved.sem6;
      }
    }

    setGrupos(copia);
  };

  const handleActualizarOptativaGrupo = (grupoIdx: number, optativaIdx: number, value: string) => {
    const copia = [...grupos];
    const optativas = [...(copia[grupoIdx].ffeOptativas || [])];
    optativas[optativaIdx] = value;
    copia[grupoIdx].ffeOptativas = optativas;
    setGrupos(copia);
  };

  const handleEliminarDocentePlantilla = (docenteId: string) => {
    setDocentes(docentes.filter((d) => d.id !== docenteId));
    const copiaHoras = { ...horasDocentes };
    delete copiaHoras[docenteId];
    setHorasDocentes(copiaHoras);
    setCargas(cargas.filter((c) => c.personalId !== docenteId));
    toast.success("Docente removido de la plantilla activa.");
  };

  const handleAgregarPersonalExistente = (persona: any) => {
    if (docentes.some((d) => d.id === persona.id)) {
      toast.error("El personal ya está en la plantilla.");
      return;
    }
    setDocentes([...docentes, persona]);
    const esDocentePuro = persona.cargo === "DOCENTE";
    setHorasDocentes({ ...horasDocentes, [persona.id]: esDocentePuro ? 20 : 0 });
    toast.success(`${persona.nombre} ${persona.apellidoPaterno} agregado a la plantilla.`);
    setMostrarModalDocente(false);
  };

  const handleCrearNuevoDocenteManual = async () => {
    if (!nuevoDocenteNombre.trim() || !nuevoDocentePaterno.trim()) {
      toast.error("El nombre y apellido paterno son obligatorios.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/horarios/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "CREAR_DOCENTE",
          escuelaId,
          nombre: nuevoDocenteNombre.trim(),
          apellidoPaterno: nuevoDocentePaterno.trim(),
          apellidoMaterno: nuevoDocenteMaterno.trim(),
          cargo: nuevoDocenteCargo,
          email: nuevoDocenteEmail.trim(),
          horasBase: nuevoDocenteHoras,
        })
      });
      const data = await res.json();
      if (data.success && data.docente) {
        toast.success(`${nuevoDocenteCargo === "DOCENTE" ? "Docente" : "Personal"} ${data.docente.nombre} ${data.docente.apellidoPaterno} registrado y agregado.`);
        setDocentes([...docentes, data.docente]);
        setHorasDocentes({ ...horasDocentes, [data.docente.id]: nuevoDocenteHoras });
        setNuevoDocenteNombre("");
        setNuevoDocentePaterno("");
        setNuevoDocenteMaterno("");
        setNuevoDocenteEmail("");
        setNuevoDocenteCargo("DOCENTE");
        setNuevoDocenteHoras(20);
        setMostrarModalDocente(false);
        cargarPersonalCompleto();
      } else {
        toast.error(data.error || "Error al registrar docente.");
      }
    } catch (e) {
      toast.error("Error de conexión al agregar docente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCargarArchivoExcelHorarios = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoExcelHorarios(file);
    setCargandoExcelHorarios(true);
    try {
      const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
      const resIntegral = await parsearLibroIntegralExcel(file, gruposDelPeriodoActual, getUACsIndividualesGrupo, personalPlataforma);

      setDocentesParseadosHorarios(resIntegral.docentes);
      if (resIntegral.tieneMatriz) {
        setResultadoParseoMatriz(resIntegral.matriz);
      }

      if (resIntegral.docentes.length === 0 && !resIntegral.tieneMatriz) {
        toast.error("No se encontraron datos válidos de personal ni horarios en el archivo.");
      } else if (resIntegral.tienePersonal && resIntegral.tieneMatriz) {
        toast.success(`¡Libro Integral detectado! ${resIntegral.docentes.filter(d => d.valido).length} docentes y ${resIntegral.matriz.resumen.asignadasConExito} materias.`);
      } else if (resIntegral.tienePersonal) {
        toast.success(`Se encontraron ${resIntegral.docentes.filter(d => d.valido).length} registros de personal.`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Error al procesar el archivo Excel / CSV.");
    } finally {
      setCargandoExcelHorarios(false);
    }
  };

  const handleImportarExcelEnHorarios = async () => {
    const validos = docentesParseadosHorarios.filter(d => d.valido);
    setLoading(true);
    try {
      let arrayPersonal = [...personalPlataforma];

      if (validos.length > 0) {
        const res = await fetch("/api/escuela-personal/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personal: validos }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast.error(data.error || "Error al importar personal.");
          return;
        }

        arrayPersonal = data.docentes || [];
        if (!arrayPersonal || arrayPersonal.length === 0) {
          const resCat = await fetch(`/api/horarios/catalogos`);
          const dataCat = await resCat.json();
          arrayPersonal = dataCat.docentes || (Array.isArray(dataCat) ? dataCat : []);
        }

        setPersonalPlataforma(arrayPersonal);

        const mapaHorasActualizado = { ...horasDocentes };
        arrayPersonal.forEach((p: any) => {
          const esDocentePuro = p.cargo === "DOCENTE";
          const hrs = p.horasAsignadas !== undefined ? p.horasAsignadas : (p.horas_base !== undefined ? p.horas_base : (esDocentePuro ? 20 : 0));
          mapaHorasActualizado[p.id] = hrs;
        });

        setDocentes(arrayPersonal);
        setHorasDocentes(mapaHorasActualizado);
      }

      // Si el archivo también incluía la Hoja de Matriz Horaria, aplicarla
      if (resultadoParseoMatriz && resultadoParseoMatriz.cargas.length > 0) {
        const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
        // Reparsear la matriz con los IDs de docentes actualizados de la base de datos
        if (archivoExcelHorarios) {
          const reparseado = await parsearExcelMatriz(archivoExcelHorarios, gruposDelPeriodoActual, getUACsIndividualesGrupo, arrayPersonal);
          const cargasValidas = reparseado.cargas.filter(c => c.valido && c.personalId);
          if (cargasValidas.length > 0) {
            const mapaCargas = new Map<string, any>();
            cargas.forEach(c => mapaCargas.set(`${c.grupoId}___${c.uacName || c.asignaturaId}`, c));
            cargasValidas.forEach(c => {
              mapaCargas.set(`${c.grupoId}___${c.uacName}`, {
                grupoId: c.grupoId,
                asignaturaId: c.uacName,
                uacName: c.uacName,
                personalId: c.personalId,
                horasSemanales: c.horasSemanales,
                requiereAulaEspecial: false,
              });
            });
            setCargas(Array.from(mapaCargas.values()));
          }
        }
      }

      toast.success(
        resultadoParseoMatriz && resultadoParseoMatriz.cargas.length > 0
          ? "¡Plantilla de personal y matriz horaria importadas con éxito!"
          : "¡Plantilla de personal importada con éxito!"
      );

      // Limpiar estados de Excel y cerrar modal
      setArchivoExcelHorarios(null);
      setDocentesParseadosHorarios([]);
      if (fileInputHorariosRef.current) fileInputHorariosRef.current.value = "";
      setMostrarModalDocente(false);
    } catch (e) {
      toast.error("Error de conexión al importar plantilla.");
    } finally {
      setLoading(false);
    }
  };

  const handleCargarArchivoMatrizExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoMatrizExcel(file);
    setCargandoMatrizExcel(true);
    try {
      const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
      const resIntegral = await parsearLibroIntegralExcel(file, gruposDelPeriodoActual, getUACsIndividualesGrupo, docentes);

      setResultadoParseoMatriz(resIntegral.matriz);
      if (resIntegral.tienePersonal) {
        setDocentesParseadosHorarios(resIntegral.docentes);
      }

      if (resIntegral.matriz.cargas.length === 0 && resIntegral.docentes.length === 0) {
        toast.error("No se encontraron materias ni grupos válidos en el archivo.");
      } else if (resIntegral.tienePersonal && resIntegral.tieneMatriz) {
        toast.success(`¡Libro Integral detectado! ${resIntegral.docentes.filter(d => d.valido).length} docentes y ${resIntegral.matriz.resumen.asignadasConExito} asignaciones.`);
      } else if (resIntegral.matriz.resumen.asignadasConExito > 0) {
        toast.success(`Se detectaron ${resIntegral.matriz.resumen.asignadasConExito} asignaciones para ${resIntegral.matriz.gruposDetectados.length} grupo(s).`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Error al procesar el archivo Excel de la Matriz.");
    } finally {
      setCargandoMatrizExcel(false);
    }
  };

  const handleConfirmarImportacionMatriz = async () => {
    const docentesValidos = docentesParseadosHorarios.filter(d => d.valido);
    const hayCargasEnMatriz = resultadoParseoMatriz && resultadoParseoMatriz.cargas.length > 0;

    if (docentesValidos.length === 0 && !hayCargasEnMatriz) {
      toast.error("No se encontraron registros de docentes ni asignaciones en el archivo.");
      return;
    }

    setLoading(true);
    try {
      let arrayPersonal = [...docentes];

      // 1. Si el archivo tenía docentes en la Hoja 1, registrarlos/actualizarlos en bulk
      if (docentesValidos.length > 0) {
        const res = await fetch("/api/escuela-personal/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personal: docentesValidos }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.docentes) {
          arrayPersonal = data.docentes;
          setPersonalPlataforma(arrayPersonal);
          setDocentes(arrayPersonal);

          const mapaHoras = { ...horasDocentes };
          arrayPersonal.forEach((p: any) => {
            mapaHoras[p.id] = p.horasAsignadas ?? p.horas_base ?? (p.cargo === "DOCENTE" ? 20 : 0);
          });
          setHorasDocentes(mapaHoras);
        }
      }

      // 2. Si hay asignaciones en la matriz, aplicarlas con los IDs de docentes actualizados
      let numAsignadas = 0;
      if (hayCargasEnMatriz && archivoMatrizExcel) {
        const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
        const reparseado = await parsearExcelMatriz(archivoMatrizExcel, gruposDelPeriodoActual, getUACsIndividualesGrupo, arrayPersonal);
        const cargasValidas = reparseado.cargas.filter(c => c.valido && c.personalId);

        if (cargasValidas.length > 0) {
          const mapaCargas = new Map<string, any>();
          cargas.forEach((c) => {
            const key = `${c.grupoId}___${c.uacName || c.asignaturaId}`;
            mapaCargas.set(key, c);
          });

          cargasValidas.forEach((c) => {
            const key = `${c.grupoId}___${c.uacName}`;
            mapaCargas.set(key, {
              grupoId: c.grupoId,
              asignaturaId: c.uacName,
              uacName: c.uacName,
              personalId: c.personalId,
              horasSemanales: c.horasSemanales,
              requiereAulaEspecial: false,
            });
          });

          setCargas(Array.from(mapaCargas.values()));
          numAsignadas = cargasValidas.length;
        }
      }

      if (numAsignadas > 0 && docentesValidos.length > 0) {
        toast.success(`¡Importación exitosa! ${docentesValidos.length} docentes sincronizados y ${numAsignadas} materias asignadas.`);
      } else if (numAsignadas > 0) {
        toast.success(`¡Matriz actualizada! ${numAsignadas} materias asignadas a docentes.`);
      } else if (docentesValidos.length > 0) {
        toast.success(`¡Personal sincronizado con éxito (${docentesValidos.length} docentes)!`);
      }

      setMostrarModalMatrizExcel(false);
      setArchivoMatrizExcel(null);
      setResultadoParseoMatriz(null);
      setDocentesParseadosHorarios([]);
      if (fileInputMatrizRef.current) fileInputMatrizRef.current.value = "";
    } catch (e) {
      toast.error("Error al procesar la importación.");
    } finally {
      setLoading(false);
    }
  };

  const matchGrupoCarga = (cargaGrupoId: string, grpIdOrNombre: string) => {
    if (!cargaGrupoId || !grpIdOrNombre) return false;
    if (cargaGrupoId === grpIdOrNombre) return true;
    const grp = grupos.find(g => g.id === grpIdOrNombre || g.nombre === grpIdOrNombre);
    if (grp) {
      if (cargaGrupoId === grp.id || cargaGrupoId === grp.nombre) return true;
      if (normalizarNombreGrupo(cargaGrupoId) === normalizarNombreGrupo(grp.nombre)) return true;
    }
    return normalizarNombreGrupo(cargaGrupoId) === normalizarNombreGrupo(grpIdOrNombre);
  };

  const matchUacCarga = (cargaUac: string, cargaAsigId: string, uacObj: any) => {
    if (!uacObj) return false;
    if (cargaUac === uacObj.uacName || (cargaAsigId && cargaAsigId === uacObj.id)) return true;
    const normCarga = (cargaUac || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    const normObj = (uacObj.uacName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    if (normCarga === normObj) return true;
    if (normCarga.includes('TALLER DE CIENCIAS') && normObj.includes('TALLER DE CIENCIAS')) return true;
    return false;
  };

  const handleAsignarDocenteMatriz = (grupoId: string, uacObj: any, personalId: string) => {
    const uacName = uacObj.uacName;
    const asignaturaId = uacObj.id;
    const horasSemanales = uacObj.horasSemanales || 3;

    const cargasLimpias = cargas.filter(
      (c) => !(matchGrupoCarga(c.grupoId, grupoId) && matchUacCarga(c.uacName, c.asignaturaId, uacObj))
    );

    if (!personalId) {
      setCargas(cargasLimpias);
      return;
    }

    setCargas([
      ...cargasLimpias,
      {
        grupoId,
        asignaturaId,
        uacName,
        personalId,
        horasSemanales,
        requiereAulaEspecial: false
      }
    ]);
  };

  const getDocenteAsignado = (grupoId: string, uacObj: any) => {
    const matches = cargas.filter(
      (c) => matchGrupoCarga(c.grupoId, grupoId) && matchUacCarga(c.uacName, c.asignaturaId, uacObj)
    );
    const asignacion = matches.length > 0 ? matches[matches.length - 1] : undefined;
    return asignacion?.personalId || "";
  };

  const getHorasConsumidasDocente = (docenteId: string, excludeGrupoId?: string, excludeUacId?: string) => {
    let total = 0;

    grupos.forEach((g) => {
      const uacs = getUACsIndividualesGrupo(g);
      uacs.forEach((uac) => {
        if (excludeGrupoId && excludeUacId && g.id === excludeGrupoId && (uac.id === excludeUacId || uac.uacName === excludeUacId)) {
          return;
        }
        const asignadoId = getDocenteAsignado(g.id, uac);
        if (asignadoId === docenteId) {
          total += (uac.horasSemanales || 3);
        }
      });
    });

    return total;
  };

  const handleAvanzarPaso1 = () => {
    generarGruposSegunEstructura(g1, g2, g3);
    try {
      fetch("/api/horarios/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escuelaId,
          config: {
            diasLectivos: 5,
            horasPorDia: numPeriodos,
            horaInicio,
            periodoActivo,
            g1, g2, g3,
            zonaEscolar
          },
          escuela: {
            id: escuelaId,
            nombre: nombreEscuela,
            cct: cctEscuela,
            zonaEscolar,
            zona: zonaEscolar,
            gruposPrimerAno: g1,
            gruposSegundoAno: g2,
            gruposTercerAno: g3,
            mapaCurricularCompletado: true
          }
        })
      }).catch(() => {});
    } catch {}
    setPaso(2);
  };

  const handleAvanzarPaso2 = () => {
    guardarProgresoLocal();
    setPaso(3);
  };

  const handleGuardarConfiguracion = async () => {
    setLoading(true);

    const docentesSobrecargados = docentes.filter((d) => {
      const hrsConsumidas = getHorasConsumidasDocente(d.id);
      const hrsMax = horasDocentes[d.id] !== undefined ? horasDocentes[d.id] : (d.cargo === "DOCENTE" ? 20 : 0);
      return hrsConsumidas > hrsMax;
    });

    if (docentesSobrecargados.length > 0) {
      toast.error(`Atención: ${docentesSobrecargados.length} docente(s) exceden sus horas contratadas. Por favor reasigne materias.`);
      setLoading(false);
      return;
    }

    const cargasCompletas: any[] = [];
    grupos.forEach((g) => {
      const uacs = getUACsIndividualesGrupo(g);
      uacs.forEach((uac) => {
        const docenteId = getDocenteAsignado(g.id, uac);
        if (docenteId) {
          cargasCompletas.push({
            grupoId: g.id,
            asignaturaId: uac.id,
            uacName: uac.uacName,
            personalId: docenteId,
            docenteId: docenteId,
            horasSemanales: uac.horasSemanales || 3,
            tipo: uac.tipo || "fundamental"
          });
        }
      });
    });

    if (cargasCompletas.length === 0) {
      toast.error("Debe asignar al menos una materia a un docente en el Paso 3 antes de generar el horario.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/horarios/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escuelaId,
          config: {
            diasLectivos: 5,
            horasPorDia: numPeriodos,
            horaInicio,
            periodoActivo
          },
          grupos,
          aulas: aulasIniciales.length > 0 ? aulasIniciales : [{ nombre: "Aula General", tipo: "REGULAR" }],
          cargas: cargasCompletas,
          escuela: {
            id: escuelaId,
            nombre: nombreEscuela,
            cct: cctEscuela,
            zonaEscolar,
            zona: zonaEscolar,
            gruposPrimerAno: g1,
            gruposSegundoAno: g2,
            gruposTercerAno: g3,
            mapaCurricularCompletado: true,
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Configuración guardada correctamente");
        onGenerarClick({
          grupos,
          docentes,
          aulas: aulasIniciales.length > 0 ? aulasIniciales : [{ id: "aula-gen", nombre: "Aula General", tipo: "REGULAR" }],
          cargas: cargasCompletas,
          config: {
            diasLectivos: 5,
            horasPorDia: numPeriodos,
            horaInicio,
            periodoActivo,
            zonaEscolar
          },
          escuela: {
            id: escuelaId,
            nombre: nombreEscuela,
            cct: cctEscuela,
            zonaEscolar,
            zona: zonaEscolar,
            gruposPrimerAno: g1,
            gruposSegundoAno: g2,
            gruposTercerAno: g3,
            mapaCurricularCompletado: true
          },
          diasLectivos: 5,
          horasPorDia: numPeriodos,
          horaInicio
        });
      } else {
        toast.error(data.error || "Error al guardar configuración");
      }
    } catch (e) {
      toast.error("Error de conexión al servidor");
    } finally {
      setLoading(false);
    }
  };

  const getUACsIndividualesGrupo = (grupo: any) => {
    const sem = grupo.semestre;

    if (modoConfiguracion === "MANUAL_TECNOLOGICO") {
      const letraGrupo = grupo.nombre.split(" ")[1] || "A";
      const key = `${sem}_${letraGrupo}`;
      const listaCustom = curriculoManualPorGrupo[key] || [];
      return listaCustom.map((m: any, i: number) => ({
        id: m.id || `uac_custom_${sem}_${letraGrupo}_${i}`,
        uacName: m.uacName,
        abrev: (m.uacName || "UAC").substring(0, 10).toUpperCase(),
        tipo: "CUSTOM_MANUAL",
        horasSemanales: Number(m.horasSemanales || 3)
      }));
    }

    if (sem === 1) {
      return [
        { id: `uac_1_1`, uacName: "Ciencias Naturales, Experimentales y Tecnología I", abrev: "CNEyT-I", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_1_2`, uacName: "Pensamiento Matemático I", abrev: "PENS-MAT-I", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_1_3`, uacName: "Humanidades I", abrev: "HUM-I", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_1_4`, uacName: "Lenguaje y Comunicación I", abrev: "LENG-COM-I", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_1_5`, uacName: "Inglés I", abrev: "ING-I", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_1_6`, uacName: "Cultura Digital I", abrev: "CULT-DIG-I", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_1_8`, uacName: "Ciencias Sociales I", abrev: "CS-SOC-I", tipo: "UNIVERSAL", horasSemanales: 2 },
        { id: `uac_1_10`, uacName: "Actividades Físicas y Deportivas I", abrev: "ACT-FIS-I", tipo: "UNIVERSAL", horasSemanales: 2 }
      ];
    }

    if (sem === 3) {
      const capNombre = grupo.capacitacionNombre || FORMACIONES_LABORALES[0];
      const uacsLabInfo = UACS_LABORALES_MAPA[capNombre]?.sem3 || [
        { name: `Asignatura 1 de ${capNombre}`, abrev: "LAB-1" },
        { name: `Asignatura 2 de ${capNombre}`, abrev: "LAB-2" }
      ];

      return [
        { id: `uac_3_1`, uacName: "Ciencias Naturales, Experimentales y Tecnología III", abrev: "CNEyT-III", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_3_2`, uacName: "Pensamiento Matemático III", abrev: "PENS-MAT-III", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_3_3`, uacName: "Humanidades III", abrev: "HUM-III", tipo: "UNIVERSAL", horasSemanales: 5 },
        { id: `uac_3_4`, uacName: "Taller de Ciencias II", abrev: "TALL-CIEN-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_3_5`, uacName: grupo.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[0], abrev: "CURR-AMP-3", tipo: "AMPLIADO", horasSemanales: 2 },
        { id: `uac_3_6`, uacName: "Lengua y Comunicación III", abrev: "LENG-COM-III", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_3_7`, uacName: "Inglés III", abrev: "ING-III", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_3_lab_a`, uacName: uacsLabInfo[0].name, abrev: uacsLabInfo[0].abrev, capNombre, tipo: "LABORAL_A", horasSemanales: 3 },
        { id: `uac_3_lab_b`, uacName: uacsLabInfo[1].name, abrev: uacsLabInfo[1].abrev, capNombre, tipo: "LABORAL_B", horasSemanales: 3 }
      ];
    }

    if (sem === 5) {
      const capNombre = grupo.capacitacionNombre || FORMACIONES_LABORALES[0];
      const uacsLabInfo = UACS_LABORALES_MAPA[capNombre]?.sem5 || [
        { name: `Asignatura 1 de ${capNombre}`, abrev: "LAB-1" },
        { name: `Asignatura 2 de ${capNombre}`, abrev: "LAB-2" }
      ];
      const opts = grupo.ffeOptativas || [
        FFE_OPTATIVAS_CATALOGO[0],
        FFE_OPTATIVAS_CATALOGO[1],
        FFE_OPTATIVAS_CATALOGO[7],
        FFE_OPTATIVAS_CATALOGO[8]
      ];

      return [
        { id: `uac_5_1`, uacName: "La Energía en los Procesos de la Vida Diaria", abrev: "ENERG-VIDA", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_5_2`, uacName: "Conciencia Histórica II. México Durante el Expansionismo Capitalista", abrev: "CONC-HIST-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_5_3`, uacName: "Taller de Habilidades del Pensamiento", abrev: "TALL-HAB-PENS", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_5_ffe_1`, uacName: opts[0] || FFE_OPTATIVAS_CATALOGO[0], abrev: "FFE-1", tipo: "FFE_1", horasSemanales: 3 },
        { id: `uac_5_ffe_2`, uacName: opts[1] || FFE_OPTATIVAS_CATALOGO[1], abrev: "FFE-2", tipo: "FFE_2", horasSemanales: 3 },
        { id: `uac_5_ffe_3`, uacName: opts[2] || FFE_OPTATIVAS_CATALOGO[7], abrev: "FFE-3", tipo: "FFE_3", horasSemanales: 3 },
        { id: `uac_5_ffe_4`, uacName: opts[3] || FFE_OPTATIVAS_CATALOGO[8], abrev: "FFE-4", tipo: "FFE_4", horasSemanales: 3 },
        { id: `uac_5_5`, uacName: grupo.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[1], abrev: "CURR-AMP-5", tipo: "AMPLIADO", horasSemanales: 2 },
        { id: `uac_5_lab_a`, uacName: uacsLabInfo[0].name, abrev: uacsLabInfo[0].abrev, capNombre, tipo: "LABORAL_A", horasSemanales: 3 },
        { id: `uac_5_lab_b`, uacName: uacsLabInfo[1].name, abrev: uacsLabInfo[1].abrev, capNombre, tipo: "LABORAL_B", horasSemanales: 3 }
      ];
    }

    if (sem === 2) {
      return [
        { id: `uac_2_1`, uacName: "Ciencias Naturales, Experimentales y Tecnología II", abrev: "CNEyT-II", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_2_2`, uacName: "Pensamiento Matemático II", abrev: "PENS-MAT-II", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_2_3`, uacName: "Humanidades II", abrev: "HUM-II", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_2_4`, uacName: "Lenguaje y Comunicación II", abrev: "LENG-COM-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_2_5`, uacName: "Inglés II", abrev: "ING-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_2_6`, uacName: "Cultura Digital II", abrev: "CULT-DIG-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_2_7`, uacName: "Laboratorio de Investigación II", abrev: "LAB-INV-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_2_8`, uacName: "Ciencias Sociales II", abrev: "CS-SOC-II", tipo: "UNIVERSAL", horasSemanales: 2 },
        { id: `uac_2_9`, uacName: "Actividades Artísticas y Culturales II", abrev: "ART-CULT-II", tipo: "UNIVERSAL", horasSemanales: 2 },
        { id: `uac_2_10`, uacName: "Actividades Físicas y Deportivas II", abrev: "ACT-FIS-II", tipo: "UNIVERSAL", horasSemanales: 2 }
      ];
    }

    if (sem === 4) {
      const capNombre = grupo.capacitacionNombre || FORMACIONES_LABORALES[0];
      const uacsLabInfo = UACS_LABORALES_MAPA[capNombre]?.sem4 || UACS_LABORALES_MAPA["Administracion"].sem4;

      return [
        { id: `uac_4_1`, uacName: "Ciencias Naturales, Experimentales y Tecnología IV", abrev: "CNEyT-IV", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_4_2`, uacName: "Pensamiento Matemático IV", abrev: "PENS-MAT-IV", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_4_3`, uacName: "Humanidades IV", abrev: "HUM-IV", tipo: "UNIVERSAL", horasSemanales: 5 },
        { id: `uac_4_4`, uacName: "Taller de Ciencias III", abrev: "TALL-CIEN-III", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_4_5`, uacName: grupo.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[0], abrev: "CURR-AMP-4", tipo: "AMPLIADO", horasSemanales: 2 },
        { id: `uac_4_6`, uacName: "Lengua y Comunicación IV", abrev: "LENG-COM-IV", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_4_7`, uacName: "Inglés IV", abrev: "ING-IV", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_4_lab_a`, uacName: uacsLabInfo[0].name, abrev: uacsLabInfo[0].abrev, capNombre, tipo: "LABORAL_A", horasSemanales: 3 },
        { id: `uac_4_lab_b`, uacName: uacsLabInfo[1].name, abrev: uacsLabInfo[1].abrev, capNombre, tipo: "LABORAL_B", horasSemanales: 3 }
      ];
    }

    if (sem === 6) {
      const capNombre = grupo.capacitacionNombre || FORMACIONES_LABORALES[0];
      const uacsLabInfo = UACS_LABORALES_MAPA[capNombre]?.sem6 || UACS_LABORALES_MAPA["Administracion"].sem6;
      const opts5 = grupo.ffeOptativas || [
        FFE_OPTATIVAS_CATALOGO[0],
        FFE_OPTATIVAS_CATALOGO[1],
        FFE_OPTATIVAS_CATALOGO[7],
        FFE_OPTATIVAS_CATALOGO[8]
      ];
      const opts6 = opts5.map((f: string) => obtenerFfeSemestre6(f));

      return [
        { id: `uac_6_1`, uacName: "La Energía en los Procesos de la Vida Diaria II", abrev: "ENERG-VIDA-II", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_6_2`, uacName: "Conciencia Histórica III. México en el Siglo XXI", abrev: "CONC-HIST-III", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_6_3`, uacName: "Taller de Habilidades del Pensamiento II", abrev: "TALL-HAB-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_6_ffe_1`, uacName: opts6[0], abrev: "FFE-1-CONT", tipo: "FFE_1", horasSemanales: 3 },
        { id: `uac_6_ffe_2`, uacName: opts6[1], abrev: "FFE-2-CONT", tipo: "FFE_2", horasSemanales: 3 },
        { id: `uac_6_ffe_3`, uacName: opts6[2], abrev: "FFE-3-CONT", tipo: "FFE_3", horasSemanales: 3 },
        { id: `uac_6_ffe_4`, uacName: opts6[3], abrev: "FFE-4-CONT", tipo: "FFE_4", horasSemanales: 3 },
        { id: `uac_6_5`, uacName: grupo.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[1], abrev: "CURR-AMP-6", tipo: "AMPLIADO", horasSemanales: 2 },
        { id: `uac_6_lab_a`, uacName: uacsLabInfo[0].name, abrev: uacsLabInfo[0].abrev, capNombre, tipo: "LABORAL_A", horasSemanales: 3 },
        { id: `uac_6_lab_b`, uacName: uacsLabInfo[1].name, abrev: uacsLabInfo[1].abrev, capNombre, tipo: "LABORAL_B", horasSemanales: 3 }
      ];
    }

    return [];
  };

  const semestresActivosPeriodo = periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6];
  const gruposDelPeriodo = grupos.filter((g) => semestresActivosPeriodo.includes(g.semestre));
  const totalGrupos = gruposDelPeriodo.length;

  const horasRequeridasPlantel = gruposDelPeriodo.reduce((sum, g) => {
    const uacs = getUACsIndividualesGrupo(g);
    return sum + uacs.reduce((uSum: number, u: any) => uSum + Number(u.horasSemanales || 0), 0);
  }, 0);

  const totalHorasPlantillaDocente = Object.entries(horasDocentes).reduce((sum, [id, h]) => {
    const docente = docentes.find(d => d.id === id);
    const cargoUpper = String(docente?.cargo || "").toUpperCase();
    if (cargoUpper === "APOYO" || cargoUpper === "PERSONAL_DE_ASISTENCIA" || cargoUpper === "ASISTENCIA") {
      return sum;
    }
    return sum + Number(h || 0);
  }, 0);

  const totalHorasAsignadasMatriz = (() => {
    let total = 0;
    gruposDelPeriodo.forEach((g) => {
      const uacs = getUACsIndividualesGrupo(g);
      uacs.forEach((uac) => {
        const docenteId = getDocenteAsignado(g.id, uac);
        if (docenteId) {
          total += uac.horasSemanales || 3;
        }
      });
    });
    return total;
  })();

  const personalNoAgregado = personalPlataforma
    .filter((p) => {
      if (!p.cargo) return true;
      const cargoUpper = String(p.cargo).toUpperCase();
      return (
        !cargoUpper.includes("ASISTENCIA") &&
        !cargoUpper.includes("APOYO") &&
        cargoUpper !== "PERSONAL_DE_ASISTENCIA" &&
        cargoUpper !== "APOYO_ADMINISTRATIVO"
      );
    })
    .filter((p) => !docentes.some((d) => d.id === p.id));

  const personalDisponibleModal = personalNoAgregado.filter((p) => {
    return busquedaPersonal === "" || `${p.nombre} ${p.apellidoPaterno || ""} ${p.cargo || ""}`.toLowerCase().includes(busquedaPersonal.toLowerCase());
  });

  return (
    <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 10px 30px rgba(0,0,0,0.3)", maxWidth: "1250px", margin: "0 auto" }}>

      {/* PASO 1: Estructura Abierta de Grupos y Selección Curricular por Grupo */}
      {paso === 1 && (
        <>
        {/* Selector de Período Semestral */}
        <div style={{ background: "#1e293b", border: "2px solid #38bdf8", borderRadius: "14px", padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 900, color: "#38bdf8", marginBottom: "0.2rem" }}>📅 Período Semestral a Configurar</div>
            <div style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>Seleccione qué semestre desea configurar. El Semestre A es Agosto-Enero (1°,3°,5°) y el Semestre B es Febrero-Julio (2°,4°,6°).</div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => { setPeriodoActivo("A"); setUsuarioCambioGrupos(true); }}
              style={{
                padding: "0.6rem 1.4rem",
                borderRadius: "10px",
                fontWeight: 800,
                fontSize: "0.9rem",
                border: "2px solid " + (periodoActivo === "A" ? "#38bdf8" : "#475569"),
                background: periodoActivo === "A" ? "#0284c7" : "#0f172a",
                color: periodoActivo === "A" ? "#ffffff" : "#cbd5e1",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              📘 Semestre A (1°, 3°, 5°)
            </button>
            <button
              type="button"
              onClick={() => { setPeriodoActivo("B"); setUsuarioCambioGrupos(true); }}
              style={{
                padding: "0.6rem 1.4rem",
                borderRadius: "10px",
                fontWeight: 800,
                fontSize: "0.9rem",
                border: "2px solid " + (periodoActivo === "B" ? "#a78bfa" : "#475569"),
                background: periodoActivo === "B" ? "#7c3aed" : "#0f172a",
                color: periodoActivo === "B" ? "#ffffff" : "#cbd5e1",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              📗 Semestre B (2°, 4°, 6°)
            </button>
          </div>
          <div style={{ background: periodoActivo === "A" ? "rgba(2,132,199,0.2)" : "rgba(124,58,237,0.2)", border: `1px solid ${periodoActivo === "A" ? "rgba(56,189,248,0.3)" : "rgba(167,139,250,0.3)"}`, padding: "0.4rem 0.85rem", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 800, color: periodoActivo === "A" ? "#38bdf8" : "#c084fc" }}>
            {periodoActivo === "A" ? "⚙️ Configurando: Agosto-Enero" : "⚙️ Configurando: Febrero-Julio"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Datos del Plantel y Supervisión Escolar */}
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "14px", padding: "1.25rem", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
              <span style={{ fontSize: "1.25rem" }}>🏫</span>
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#ffffff" }}>Datos Oficiales del Plantel y Supervisión Escolar</div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Personalice el nombre del plantel, clave CCT y su Supervisión / Zona Escolar correspondiente (se reflejará en todos los membretes oficiales).</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.3rem" }}>
                  🏛️ Nombre del Plantel / Escuela:
                </label>
                <input
                  type="text"
                  value={nombreEscuela}
                  onChange={(e) => setNombreEscuela(e.target.value)}
                  placeholder="Ej. Bachillerato General Oficial..."
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#0f172a", color: "#ffffff", fontSize: "0.8125rem", fontWeight: 600 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.3rem" }}>
                  📋 Clave de Centro de Trabajo (C.C.T.):
                </label>
                <input
                  type="text"
                  value={cctEscuela}
                  onChange={(e) => setCctEscuela(e.target.value)}
                  placeholder="Ej. 21EBH0000X"
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#0f172a", color: "#ffffff", fontSize: "0.8125rem", fontWeight: 600 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#38bdf8", marginBottom: "0.3rem" }}>
                  📍 Supervisión / Zona Escolar:
                </label>
                <input
                  type="text"
                  value={zonaEscolar}
                  onChange={(e) => setZonaEscolar(e.target.value)}
                  placeholder="Ej. 004, 012, Zona 025..."
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "2px solid #38bdf8", background: "#0f172a", color: "#38bdf8", fontSize: "0.875rem", fontWeight: 800 }}
                />
              </div>
            </div>
          </div>

          {/* Banner Selector de Modo de Carga */}
          <div style={{ background: "#1e293b", padding: "1.25rem", borderRadius: "14px", border: "1px solid #334155", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#ffffff", margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Layers style={{ width: "18px", height: "18px", color: "#38bdf8" }} /> Seleccione el Modo de Generación de Horarios:
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <button
                type="button"
                onClick={() => setModoConfiguracion("SEMIAUTOMATICO")}
                style={{
                  textAlign: "left",
                  padding: "1rem",
                  borderRadius: "10px",
                  border: "2px solid " + (modoConfiguracion === "SEMIAUTOMATICO" ? "#38bdf8" : "#334155"),
                  background: modoConfiguracion === "SEMIAUTOMATICO" ? "rgba(37,99,235,0.2)" : "#0f172a",
                  cursor: "pointer"
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "0.875rem", color: modoConfiguracion === "SEMIAUTOMATICO" ? "#60a5fa" : "#f8fafc" }}>
                  🏫 Modo Semiautomático (SEP Bachillerato General Predeterminado)
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                  Precarga automáticamente el Mapa Curricular Oficial (MCCEMS 2025-2027), UACs universales, capacitaciones laborales y catálogo de docentes.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setModoConfiguracion("MANUAL_TECNOLOGICO")}
                style={{
                  textAlign: "left",
                  padding: "1rem",
                  borderRadius: "10px",
                  border: "2px solid " + (modoConfiguracion === "MANUAL_TECNOLOGICO" ? "#f59e0b" : "#334155"),
                  background: modoConfiguracion === "MANUAL_TECNOLOGICO" ? "rgba(217,119,6,0.2)" : "#0f172a",
                  cursor: "pointer"
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "0.875rem", color: modoConfiguracion === "MANUAL_TECNOLOGICO" ? "#fbbf24" : "#f8fafc" }}>
                  ⚙️ Modo Manual Libre (Bachilleratos Tecnológicos / CBTIS)
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                  Configuración 100% personalizada. Permite ingresar nombres libres de asignaturas, carreras técnicas, horas semanales libres y docentes manuales.
                </div>
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
            <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "12px", border: "1px solid #334155" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.4rem" }}>
                <Users style={{ width: "15px", height: "15px", color: "#38bdf8", display: "inline", marginRight: "5px" }} />
                1.er Año ({periodoActivo === "A" ? "1.º Semestre" : "2.º Semestre"})
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={g1}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value));
                    setG1(val);
                    setUsuarioCambioGrupos(true);
                    generarGruposSegunEstructura(val, g2, g3);
                  }}
                  style={{ width: "70px", padding: "0.4rem", borderRadius: "8px", border: "2px solid #3b82f6", background: "#0f172a", fontWeight: 800, textAlign: "center", fontSize: "1.125rem", color: "#ffffff" }}
                />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#38bdf8" }}>
                  Genera {periodoActivo === "A" ? "1°" : "2°"} A a {periodoActivo === "A" ? "1°" : "2°"} {String.fromCharCode(64 + Math.min(g1, 26))}
                </span>
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "12px", border: "1px solid #334155" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.4rem" }}>
                <Users style={{ width: "15px", height: "15px", color: "#38bdf8", display: "inline", marginRight: "5px" }} />
                2.º Año ({periodoActivo === "A" ? "3.er Semestre" : "4.º Semestre"})
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={g2}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value));
                    setG2(val);
                    setUsuarioCambioGrupos(true);
                    generarGruposSegunEstructura(g1, val, g3);
                  }}
                  style={{ width: "70px", padding: "0.4rem", borderRadius: "8px", border: "2px solid #3b82f6", background: "#0f172a", fontWeight: 800, textAlign: "center", fontSize: "1.125rem", color: "#ffffff" }}
                />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#38bdf8" }}>
                  Genera {periodoActivo === "A" ? "3°" : "4°"} A a {periodoActivo === "A" ? "3°" : "4°"} {String.fromCharCode(64 + Math.min(g2, 26))}
                </span>
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "12px", border: "1px solid #334155" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.4rem" }}>
                <Users style={{ width: "15px", height: "15px", color: "#38bdf8", display: "inline", marginRight: "5px" }} />
                3.er Año ({periodoActivo === "A" ? "5.º Semestre" : "6.º Semestre"})
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={g3}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value));
                    setG3(val);
                    setUsuarioCambioGrupos(true);
                    generarGruposSegunEstructura(g1, g2, val);
                  }}
                  style={{ width: "70px", padding: "0.4rem", borderRadius: "8px", border: "2px solid #3b82f6", background: "#0f172a", fontWeight: 800, textAlign: "center", fontSize: "1.125rem", color: "#ffffff" }}
                />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#38bdf8" }}>
                  Genera {periodoActivo === "A" ? "5°" : "6°"} A a {periodoActivo === "A" ? "5°" : "6°"} {String.fromCharCode(64 + Math.min(g3, 26))}
                </span>
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "12px", border: "1px solid #334155" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 800, color: "#f8fafc", marginBottom: "0.4rem" }}>
                <Clock style={{ width: "15px", height: "15px", color: "#4ade80", display: "inline", marginRight: "5px" }} />
                Jornada Escolar (BGE)
              </label>
              <select
                value={numPeriodos}
                onChange={(e) => setNumPeriodos(Number(e.target.value))}
                style={{ width: "100%", padding: "0.45rem", borderRadius: "8px", border: "2px solid #22c55e", background: "#0f172a", fontWeight: 800, fontSize: "0.8125rem", color: "#ffffff" }}
              >
                <option value={6} style={{ background: "#0f172a", color: "#ffffff" }}>6 Horas diarias (30 hrs/sem)</option>
                <option value={5} style={{ background: "#0f172a", color: "#ffffff" }}>5 Horas diarias (25 hrs/sem)</option>
                <option value={7} style={{ background: "#0f172a", color: "#ffffff" }}>7 Horas diarias (35 hrs/sem)</option>
                <option value={8} style={{ background: "#0f172a", color: "#ffffff" }}>8 Horas diarias (40 hrs/sem)</option>
              </select>
            </div>
          </div>

          {modoConfiguracion === "MANUAL_TECNOLOGICO" ? (
            <div style={{ border: "1px solid #f59e0b", borderRadius: "12px", padding: "1.25rem", background: "#1e293b" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#fbbf24", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ShieldCheck style={{ width: "18px", height: "18px", color: "#f59e0b" }} /> Asignaturas y Módulos del Subsistema Tecnológico / CBTIS
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "#cbd5e1", margin: "0 0 1rem" }}>
                Configure las asignaturas de <strong>cada grupo de manera independiente</strong>.
              </p>

              {Math.max(g1, g2, g3) > 1 && (
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "#0f172a", borderRadius: "10px", border: "1px solid #334155", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#fbbf24", marginRight: "0.25rem" }}>Configurar Grupo:</span>
                  {["A","B","C","D","E","F","G","H","I","J"].slice(0, Math.max(g1, g2, g3)).map(letra => (
                    <button
                      key={letra}
                      type="button"
                      onClick={() => setGrupoActivoManual(letra)}
                      style={{
                        padding: "0.45rem 1.1rem",
                        borderRadius: "8px",
                        fontWeight: 800,
                        fontSize: "0.8125rem",
                        border: "1px solid " + (grupoActivoManual === letra ? "#f59e0b" : "#475569"),
                        cursor: "pointer",
                        background: grupoActivoManual === letra ? "#d97706" : "#1e293b",
                        color: "#ffffff",
                        boxShadow: grupoActivoManual === letra ? "0 2px 8px rgba(217,119,6,0.4)" : "none"
                      }}
                    >
                      Grupo {letra}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
                {(periodoActivo === "A"
                  ? [
                    { sem: 1, label: "1er Semestre (Asignaturas Base)" },
                    { sem: 3, label: "3er Semestre (Física / Módulos Especialidad)" },
                    { sem: 5, label: "5to Semestre (Cálculo / Módulos Especialidad)" }
                  ]
                  : [
                    { sem: 2, label: "2do Semestre (Asignaturas Base)" },
                    { sem: 4, label: "4to Semestre (Física II / Módulos Especialidad)" },
                    { sem: 6, label: "6to Semestre (Estadística / Módulos Especialidad)" }
                  ]
                ).map(({ sem, label }) => {
                  const key = `${sem}_${grupoActivoManual}`;
                  const lista: any[] = curriculoManualPorGrupo[key] || [];
                  return (
                    <div key={sem} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "1rem", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #334155", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
                        <span style={{ fontSize: "0.875rem", fontWeight: 800, color: "#fbbf24", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                          {label}
                          {Math.max(g1, g2, g3) > 1 && (
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "#d97706", color: "#fff", padding: "0.15rem 0.5rem", borderRadius: "20px" }}>
                              Grupo {grupoActivoManual}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 800, background: "#1e293b", color: "#fbbf24", border: "1px solid #f59e0b", padding: "0.25rem 0.5rem", borderRadius: "6px", whiteSpace: "nowrap" }}>
                          {lista.reduce((sum: number, m: any) => sum + Number(m.horasSemanales || 0), 0)} hrs/sem
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {lista.map((m: any, mIdx: number) => (
                          <div key={m.id || mIdx} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <input
                              type="text"
                              value={m.uacName}
                              onChange={(e) => handleActualizarMateriaManual(sem, grupoActivoManual, mIdx, "uacName", e.target.value)}
                              placeholder="Nombre de la Asignatura / Módulo"
                              style={{ flex: 1, padding: "0.45rem 0.6rem", borderRadius: "6px", border: "1px solid #475569", background: "#1e293b", fontSize: "0.8125rem", fontWeight: 700, color: "#ffffff" }}
                            />
                            <input
                              type="number"
                              min={1}
                              max={25}
                              value={m.horasSemanales}
                              onChange={(e) => handleActualizarMateriaManual(sem, grupoActivoManual, mIdx, "horasSemanales", Math.max(1, Number(e.target.value)))}
                              style={{ width: "55px", padding: "0.45rem", borderRadius: "6px", border: "1px solid #475569", background: "#1e293b", fontSize: "0.8125rem", fontWeight: 800, textAlign: "center", color: "#ffffff" }}
                            />
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8" }}>hrs</span>
                            <button
                              type="button"
                              onClick={() => handleEliminarMateriaManual(sem, grupoActivoManual, mIdx)}
                              style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", padding: "0.4rem", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center" }}
                              title="Eliminar asignatura"
                            >
                              <Trash2 style={{ width: "14px", height: "14px" }} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAgregarMateriaManual(sem, grupoActivoManual)}
                        style={{ marginTop: "0.85rem", width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px dashed #f59e0b", background: "rgba(217,119,6,0.15)", color: "#fbbf24", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                      >
                        <Plus style={{ width: "14px", height: "14px" }} /> + Agregar Asignatura a {sem}° Semestre{Math.max(g1, g2, g3) > 1 ? ` – Grupo ${grupoActivoManual}` : ""}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ border: "1px solid #334155", borderRadius: "12px", padding: "1.25rem", background: "#1e293b" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#ffffff", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ShieldCheck style={{ width: "18px", height: "18px", color: "#38bdf8" }} /> Configuración Curricular Individual por Grupo
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {Array.from({ length: Math.max(g1, g2, g3) }, (_, i) => String.fromCharCode(65 + i)).map((letra) => {
                  const s1 = periodoActivo === "A" ? 1 : 2;
                  const s2 = periodoActivo === "A" ? 3 : 4;
                  const s3 = periodoActivo === "A" ? 5 : 6;
                  const g1Letra = grupos.find((g) => g.semestre === s1 && g.nombre.endsWith(letra));
                  const g3Letra = grupos.find((g) => g.semestre === s2 && g.nombre.endsWith(letra));
                  const g5Letra = grupos.find((g) => g.semestre === s3 && g.nombre.endsWith(letra));
                  const gruposTrack = [g1Letra, g3Letra, g5Letra].filter(Boolean);

                  if (gruposTrack.length === 0) return null;

                  return (
                    <div key={letra} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "1rem", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                      <h4 style={{ fontSize: "0.875rem", fontWeight: 900, color: "#38bdf8", margin: "0 0 0.85rem", borderBottom: "1px solid #334155", paddingBottom: "0.4rem" }}>
                        📌 Track de Grupos Letra "{letra}" ({gruposTrack.map(g => g.nombre).join(" | ")})
                      </h4>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
                        {gruposTrack.map((g) => {
                          const idx = grupos.findIndex((grp) => grp.nombre === g.nombre && grp.semestre === g.semestre);

                          return (
                            <div key={g.nombre} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "10px", padding: "0.85rem" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #334155", paddingBottom: "0.4rem", marginBottom: "0.6rem" }}>
                                <span style={{ fontSize: "0.875rem", fontWeight: 800, color: "#ffffff" }}>
                                  Grupo {g.nombre} ({g.semestre}° Semestre)
                                </span>
                                <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "0.2rem 0.4rem", borderRadius: "6px" }}>
                                  {g.semestre === 1 ? "Universal (8 UACs • 25 hrs)" : (g.semestre === 2 ? "Universal (10 UACs • 30 hrs)" : (g.semestre === 3 || g.semestre === 4) ? "Laboral (9 UACs • 30 hrs)" : "Laboral + FFE (10 UACs • 30 hrs)")}
                                </span>
                              </div>

                              <div style={{ marginBottom: "0.65rem" }}>
                                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "0.2rem" }}>
                                  Jornada Diaria del Grupo (Horas por día)
                                </label>
                                <select
                                  value={g.horasPorDia || (g.semestre === 1 ? 5 : 6)}
                                  onChange={(e) => handleActualizarConfigGrupo(idx, "horasPorDia", Number(e.target.value))}
                                  style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #475569", background: "#0f172a", fontSize: "0.75rem", fontWeight: 700, color: "#ffffff" }}
                                >
                                  <option value={5} style={{ background: "#0f172a", color: "#ffffff" }}>5 horas por día (25 hrs / semana)</option>
                                  <option value={6} style={{ background: "#0f172a", color: "#ffffff" }}>6 horas por día (30 hrs / semana)</option>
                                  <option value={7} style={{ background: "#0f172a", color: "#ffffff" }}>7 horas por día (35 hrs / semana)</option>
                                </select>
                              </div>

                              {g.semestre >= 3 && (
                                <div style={{ marginBottom: "0.65rem" }}>
                                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "0.2rem" }}>
                                    Formación Laboral (Capacitación del Grupo)
                                  </label>
                                  <select
                                    value={g.capacitacionNombre || FORMACIONES_LABORALES[0]}
                                    onChange={(e) => handleActualizarConfigGrupo(idx, "capacitacionNombre", e.target.value)}
                                    style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #475569", background: "#0f172a", fontSize: "0.78125rem", fontWeight: 700, color: "#ffffff" }}
                                  >
                                    {FORMACIONES_LABORALES.map((cap) => (
                                      <option key={cap} value={cap} style={{ background: "#0f172a", color: "#ffffff" }}>
                                        {cap}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {g.semestre >= 3 && (() => {
                                const letraGrupo = g.nombre.split(" ")[1] || "A";
                                const g3 = grupos.find(grp => normalizarNombreGrupo(grp.nombre) === `3° ${letraGrupo}`);
                                const socio3 = g3?.ffeoSocioemocional;
                                const opcionesDisponibles = (g.semestre === 5 && socio3)
                                  ? FORMACIONES_SOCIOEMOCIONALES.filter(s => s !== socio3)
                                  : FORMACIONES_SOCIOEMOCIONALES;

                                const esAuto = g.semestre === 4 || g.semestre === 6;

                                return (
                                  <div style={{ marginBottom: "0.65rem" }}>
                                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "0.2rem" }}>
                                      Currículum Ampliado / Formación Socioemocional (FFEO) {esAuto && "(Automático Semestre B)"}
                                    </label>
                                    <select
                                      disabled={esAuto}
                                      value={g.ffeoSocioemocional || (g.semestre === 3 ? FORMACIONES_SOCIOEMOCIONALES[0] : FORMACIONES_SOCIOEMOCIONALES[1])}
                                      onChange={(e) => handleActualizarConfigGrupo(idx, "ffeoSocioemocional", e.target.value)}
                                      style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid #475569", background: "#0f172a", fontSize: "0.72rem", fontWeight: 700, color: "#ffffff", opacity: esAuto ? 0.8 : 1 }}
                                    >
                                      {opcionesDisponibles.map((ffeo) => (
                                        <option key={ffeo} value={ffeo} style={{ background: "#0f172a", color: "#ffffff" }}>
                                          {ffeo}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                );
                              })()}

                              {g.semestre === 5 && (
                                <div>
                                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "0.3rem" }}>
                                    Optativas FFE (Selección libre de 4 asignaturas del catálogo oficial MCCEMS)
                                  </label>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
                                    {[0, 1, 2, 3].map((optIdx) => {
                                      const valorActual = g.ffeOptativas?.[optIdx] || FFE_OPTATIVAS_CATALOGO[optIdx] || FFE_OPTATIVAS_CATALOGO[0];
                                      const otrasSeleccionadas = (g.ffeOptativas || []).filter((_: any, i: number) => i !== optIdx);

                                      return (
                                        <div key={optIdx}>
                                          <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#94a3b8", display: "block" }}>
                                            Optativa FFE {optIdx + 1}
                                          </span>
                                          <select
                                            value={valorActual}
                                            onChange={(e) => handleActualizarOptativaGrupo(idx, optIdx, e.target.value)}
                                            style={{ width: "100%", padding: "0.35rem", borderRadius: "6px", border: "1px solid #475569", background: "#0f172a", fontSize: "0.6875rem", fontWeight: 700, color: "#ffffff" }}
                                          >
                                            <optgroup label="Recursos Sociocognitivos" style={{ background: "#0f172a", color: "#38bdf8" }}>
                                              {FFE_RECURSO_SOCIOCOGNITIVO.map((mat) => (
                                                <option key={mat} value={mat} disabled={otrasSeleccionadas.includes(mat)} style={{ background: "#0f172a", color: "#ffffff" }}>
                                                  {mat} {otrasSeleccionadas.includes(mat) ? "(Ya elegida)" : ""}
                                                </option>
                                              ))}
                                            </optgroup>
                                            <optgroup label="Áreas de Conocimiento" style={{ background: "#0f172a", color: "#a78bfa" }}>
                                              {FFE_AREA_CONOCIMIENTO.map((mat) => (
                                                <option key={mat} value={mat} disabled={otrasSeleccionadas.includes(mat)} style={{ background: "#0f172a", color: "#ffffff" }}>
                                                  {mat} {otrasSeleccionadas.includes(mat) ? "(Ya elegida)" : ""}
                                                </option>
                                              ))}
                                            </optgroup>
                                          </select>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {g.semestre === 1 && (
                                <div style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "6px", padding: "0.5rem", marginTop: "0.4rem" }}>
                                  <p style={{ fontSize: "0.72rem", color: "#4ade80", margin: 0, fontWeight: 700 }}>
                                    ✓ 1.er Semestre: 8 Asignaturas Fundamentales Oficiales (5 horas diarias = 25 hrs/semana).
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "1rem" }}>
            <button
              onClick={handleAvanzarPaso1}
              style={{ background: "#2563eb", color: "#ffffff", padding: "0.75rem 1.75rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.9375rem", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}
            >
              Siguiente: Plantilla Docente →
            </button>
          </div>
        </div>
        </>)}

      {/* PASO 2: Plantilla Docente & Contador de Horas del Plantel */}
      {paso === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", background: "#1e293b", padding: "1.25rem", borderRadius: "12px", border: "1px solid #334155" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#ffffff", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <UserCheck style={{ width: "18px", height: "18px", color: "#38bdf8" }} /> Carga Horaria de la Plantilla Docente Frente a Grupo
              </h3>
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem", margin: 0 }}>
                Administrativos, Apoyo y Responsables inician con 0 hrs. Asigne únicamente las horas frente a grupo reales.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ background: "#0f172a", padding: "0.5rem 1rem", borderRadius: "10px", border: "1px solid #334155", textAlign: "right" }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Plantilla Contratada</div>
                <div style={{ fontSize: "1.125rem", fontWeight: 900, color: totalHorasPlantillaDocente >= horasRequeridasPlantel ? "#4ade80" : "#fbbf24" }}>
                  {totalHorasPlantillaDocente} / {horasRequeridasPlantel} hrs
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
                  descargarPlantillaIntegralHorarios(gruposDelPeriodoActual, periodoActivo, getUACsIndividualesGrupo, docentes);
                }}
                title="Descargar libro de Excel unificado (Personal + Horarios)"
                style={{ background: "#1e293b", color: "#38bdf8", border: "1px solid #0284c7", padding: "0.625rem 0.85rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}
              >
                <Download style={{ width: "15px", height: "15px" }} /> 📑 Plantilla Integral (.xlsx)
              </button>

              <button
                type="button"
                onClick={() => {
                  setTabModalDocente("EXCEL");
                  setMostrarModalDocente(true);
                }}
                title="Subir archivo Excel o CSV con la plantilla docente"
                style={{ background: "#047857", color: "#ffffff", border: "1px solid #10b981", padding: "0.625rem 1rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}
              >
                <FileSpreadsheet style={{ width: "15px", height: "15px" }} /> 📥 Importar Excel
              </button>

              <button
                type="button"
                onClick={() => {
                  setTabModalDocente("PLATAFORMA");
                  setMostrarModalDocente(true);
                }}
                style={{ background: "#2563eb", color: "#ffffff", padding: "0.625rem 1.1rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.8125rem", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}
              >
                <UserPlus style={{ width: "16px", height: "16px" }} /> + Agregar Personal
              </button>
            </div>
          </div>

          {docentes.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", background: "#1e293b", border: "2px dashed #334155", borderRadius: "12px" }}>
              <AlertCircle style={{ width: "32px", height: "32px", color: "#94a3b8", margin: "0 auto 0.5rem" }} />
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#ffffff" }}>No se encontraron docentes activos en la plantilla del horario.</p>
              <button
                onClick={() => setMostrarModalDocente(true)}
                style={{ marginTop: "0.75rem", background: "#2563eb", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.8125rem", border: "none", cursor: "pointer" }}
              >
                + Agregar Personal a la Plantilla
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "0.85rem" }}>
              {docentesAptosParaHorario.map((d) => {
                const hrsAsignadasMatriz = getHorasConsumidasDocente(d.id);
                const hrsContratadas = horasDocentes[d.id] !== undefined ? horasDocentes[d.id] : (d.cargo === "DOCENTE" ? 20 : 0);
                const esExcedido = hrsAsignadasMatriz > hrsContratadas;

                return (
                  <div
                    key={d.id}
                    style={{
                      padding: "0.85rem",
                      border: "1px solid " + (esExcedido ? "#ef4444" : "#334155"),
                      borderRadius: "10px",
                      background: esExcedido ? "rgba(239, 68, 68, 0.15)" : "#1e293b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: "0.5rem" }}>
                      <p style={{ fontSize: "0.875rem", fontWeight: 800, color: esExcedido ? "#f87171" : "#ffffff", margin: 0 }}>
                        {d.apellidoPaterno} {d.apellidoMaterno || ""} {d.nombre}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: d.cargo === "DOCENTE" ? "#60a5fa" : "#fbbf24", background: "#0f172a", padding: "0.1rem 0.4rem", borderRadius: "4px", border: "1px solid #334155" }}>
                          {d.cargo || "DOCENTE"}
                        </span>
                        {hrsAsignadasMatriz > 0 && (
                          <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: esExcedido ? "#f87171" : "#4ade80" }}>
                            Asignadas: {hrsAsignadasMatriz}/{hrsContratadas}h {esExcedido ? "⚠️ EXCEDIDO" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={horasDocentes[d.id] !== undefined ? horasDocentes[d.id] : (d.cargo === "DOCENTE" ? 20 : 0)}
                          onChange={(e) => setHorasDocentes({ ...horasDocentes, [d.id]: Math.max(0, Number(e.target.value)) })}
                          style={{ width: "60px", padding: "0.35rem", borderRadius: "6px", border: "2px solid " + (esExcedido ? "#ef4444" : "#3b82f6"), background: "#0f172a", fontWeight: 800, textAlign: "center", fontSize: "0.875rem", color: "#ffffff" }}
                        />
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8" }}>hrs</span>
                      </div>

                      <button
                        type="button"
                        title="Remover docente de la plantilla activa"
                        onClick={() => handleEliminarDocentePlantilla(d.id)}
                        style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", padding: "0.4rem", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center" }}
                      >
                        <Trash2 style={{ width: "16px", height: "16px" }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "1rem" }}>
            <button
              onClick={() => setPaso(1)}
              style={{ background: "#334155", color: "#ffffff", padding: "0.75rem 1.5rem", borderRadius: "10px", fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              ← Atrás
            </button>
            <button
              onClick={handleAvanzarPaso2}
              style={{ background: "#2563eb", color: "#ffffff", padding: "0.75rem 1.75rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.9375rem", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}
            >
              Siguiente: Matriz por Semestre →
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Matriz Tabular Específica por Grupo */}
      {paso === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Banner Resumen de Cargas Horarias del Plantel */}
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "1rem 1.25rem", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#ffffff", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <BookOpen style={{ width: "20px", height: "20px", color: "#38bdf8" }} /> Matriz de Asignación Docente por Grupo (UACs Específicas)
              </h3>
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0.25rem 0 0" }}>
                Seleccione el docente responsable para cada UAC. Las opciones con exceso de horas contratadas se deshabilitan automáticamente.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
                  descargarPlantillaIntegralHorarios(gruposDelPeriodoActual, periodoActivo, getUACsIndividualesGrupo, docentes);
                }}
                title="Descargar libro de Excel unificado (Personal + Horarios)"
                style={{ background: "#1e293b", color: "#38bdf8", border: "1px solid #0284c7", padding: "0.625rem 0.85rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}
              >
                <Download style={{ width: "15px", height: "15px" }} /> 📑 Plantilla Integral (.xlsx)
              </button>

              <button
                type="button"
                onClick={() => setMostrarModalMatrizExcel(true)}
                title="Subir archivo Excel o CSV con la plantilla docente y horarios"
                style={{ background: "#047857", color: "#ffffff", border: "1px solid #10b981", padding: "0.625rem 1rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}
              >
                <FileSpreadsheet style={{ width: "15px", height: "15px" }} /> 📥 Importar Excel
              </button>

              <div style={{ background: "#0f172a", padding: "0.5rem 1rem", borderRadius: "10px", border: "1px solid #334155", textAlign: "right" }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Horas Asignadas en Matriz</div>
                <div style={{ fontSize: "1.125rem", fontWeight: 900, color: totalHorasAsignadasMatriz === horasRequeridasPlantel ? "#4ade80" : "#38bdf8" }}>
                  {totalHorasAsignadasMatriz} / {horasRequeridasPlantel} hrs
                </div>
              </div>
            </div>
          </div>

          {/* Alertas de Sobrecarga de Docentes */}
          {docentes.some((d) => getHorasConsumidasDocente(d.id) > (horasDocentes[d.id] !== undefined ? horasDocentes[d.id] : (d.cargo === "DOCENTE" ? 20 : 0))) && (
            <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "10px", padding: "0.85rem 1.25rem", color: "#fca5a5", fontSize: "0.8125rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <AlertTriangle style={{ width: "20px", height: "20px", color: "#ef4444", flexShrink: 0 }} />
              <div>
                <strong>⚠️ Advertencia de Sobre-asignación:</strong> Hay docente(s) que superan las horas contratadas en la plantilla. Ajuste las selecciones resaltadas en rojo para evitar empalmes.
              </div>
            </div>
          )}

          {(periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).map((sem) => {
            const gruposSemestre = grupos.filter((g) => g.semestre === sem);
            if (gruposSemestre.length === 0) return null;

            const labelSem: Record<number, string> = {
              1: "1er Semestre (1er Año - 10 UACs Universales)",
              2: "2do Semestre (1er Año - 10 UACs Universales)",
              3: "3er Semestre (2º Año - 9 UACs por Grupo)",
              4: "4to Semestre (2º Año - 9 UACs por Grupo)",
              5: "5to Semestre (3er Año - 10 UACs por Grupo)",
              6: "6to Semestre (3er Año - 10 UACs por Grupo)"
            };

            return (
              <div key={sem} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                <div style={{ background: "#0f172a", color: "#ffffff", padding: "0.625rem 1rem", borderRadius: "8px", fontWeight: 800, fontSize: "0.875rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #334155" }}>
                  <span style={{ color: "#38bdf8" }}>{labelSem[sem] || `${sem}° Semestre`}</span>
                  <span style={{ fontSize: "0.75rem", background: "#334155", color: "#e2e8f0", padding: "0.25rem 0.5rem", borderRadius: "4px" }}>
                    {gruposSemestre.length} Grupo(s) activo(s)
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem" }}>
                  {gruposSemestre.map((g) => {
                    const uacsEspecificas = getUACsIndividualesGrupo(g);

                    return (
                      <div key={g.id} style={{ border: "1px solid #334155", borderRadius: "10px", overflow: "hidden", background: "#0f172a", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                        <div style={{ background: "#1e293b", padding: "0.75rem 1rem", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "0.9375rem", fontWeight: 900, color: "#60a5fa" }}>
                            Grupo {g.nombre}
                          </span>
                          {g.capacitacionNombre && (
                            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#38bdf8", background: "#0f172a", padding: "0.2rem 0.6rem", borderRadius: "6px", border: "1px solid #334155" }}>
                              {g.capacitacionNombre}
                            </span>
                          )}
                        </div>

                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78125rem" }}>
                          <thead>
                            <tr style={{ background: "#1e293b", borderBottom: "1px solid #334155" }}>
                              <th style={{ padding: "0.5rem 0.625rem", textAlign: "left", fontWeight: 800, color: "#cbd5e1", width: "55%" }}>Materia (UAC)</th>
                              <th style={{ padding: "0.5rem", textAlign: "center", fontWeight: 800, color: "#38bdf8", width: "15%" }}>Horas</th>
                              <th style={{ padding: "0.5rem", textAlign: "center", fontWeight: 800, color: "#cbd5e1", width: "30%" }}>Docente Asignado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {uacsEspecificas.map((uac, uacIdx) => {
                              const docenteActualId = getDocenteAsignado(g.id, uac);
                              const docenteActualObj = docentes.find((d) => d.id === docenteActualId);
                              const hrsConsumidasDocenteActual = docenteActualId ? getHorasConsumidasDocente(docenteActualId, g.id, uac.id) : 0;
                              const hrsMaxDocenteActual = docenteActualId ? (horasDocentes[docenteActualId] !== undefined ? horasDocentes[docenteActualId] : (docenteActualObj?.cargo === "DOCENTE" ? 20 : 0)) : 0;
                              const hrsConDocenteConEsta = hrsConsumidasDocenteActual + (uac.horasSemanales || 3);
                              const esDocenteExcedido = docenteActualId && hrsConDocenteConEsta > hrsMaxDocenteActual;

                              return (
                                <tr key={uac.id || uacIdx} style={{ borderBottom: "1px solid #1e293b" }}>
                                  <td style={{ padding: "0.5rem 0.625rem", fontWeight: 700, color: "#f8fafc", lineHeight: 1.35 }}>
                                    {uac.tipo?.startsWith("LABORAL") ? (
                                      <div>
                                        <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#94a3b8", display: "block" }}>
                                          Formación Laboral {uac.tipo === "LABORAL_A" ? '"A"' : '"B"'} ({(uac as any).capNombre})
                                        </span>
                                        <span style={{ color: "#fbbf24", fontWeight: 900, fontSize: "0.8125rem" }}>
                                          {uac.uacName}
                                        </span>
                                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#60a5fa", marginLeft: "0.35rem" }}>
                                          ({uac.abrev})
                                        </span>
                                      </div>
                                    ) : uac.tipo === "AMPLIADO" ? (
                                      <div>
                                        <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#38bdf8", display: "block" }}>
                                          Currículum Ampliado (FFEO)
                                        </span>
                                        <span style={{ color: "#7dd3fc", fontWeight: 800 }}>
                                          {uac.uacName}
                                        </span>
                                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#94a3b8", marginLeft: "0.35rem" }}>
                                          ({uac.abrev})
                                        </span>
                                      </div>
                                    ) : uac.tipo?.startsWith("FFE_") ? (
                                      <div>
                                        <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#c084fc", display: "block" }}>
                                          Formación Fundamental Extendida (Optativa FFE)
                                        </span>
                                        <span style={{ color: "#d8b4fe", fontWeight: 800 }}>
                                          {uac.uacName}
                                        </span>
                                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#94a3b8", marginLeft: "0.35rem" }}>
                                          ({uac.abrev})
                                        </span>
                                      </div>
                                    ) : (
                                      <div>
                                        <span style={{ color: "#f8fafc" }}>{uac.uacName}</span>
                                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#38bdf8", marginLeft: "0.35rem" }}>
                                          ({uac.abrev})
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: "0.5rem", textAlign: "center", fontWeight: 800, color: "#38bdf8" }}>
                                    {uac.horasSemanales || 3}h
                                  </td>
                                  <td style={{ padding: "0.35rem" }}>
                                    <select
                                      value={docenteActualId}
                                      onChange={(e) => handleAsignarDocenteMatriz(g.id, uac, e.target.value)}
                                      style={{
                                        width: "100%",
                                        padding: "0.4rem 0.5rem",
                                        borderRadius: "6px",
                                        border: "2px solid " + (esDocenteExcedido ? "#ef4444" : docenteActualId ? "#22c55e" : "#475569"),
                                        background: esDocenteExcedido ? "#450a0a" : docenteActualId ? "#0f172a" : "#1e293b",
                                        fontSize: "0.72rem",
                                        fontWeight: 800,
                                        color: esDocenteExcedido ? "#f87171" : docenteActualId ? "#4ade80" : "#cbd5e1",
                                        outline: "none"
                                      }}
                                    >
                                      <option value="" style={{ background: "#0f172a", color: "#ffffff" }}>-- Sin Asignar --</option>
                                      {docentesAptosParaHorario.map((d) => {
                                        const hrsMax = horasDocentes[d.id] !== undefined ? horasDocentes[d.id] : (d.cargo === "DOCENTE" ? 20 : 0);
                                        const hrsConsumidasSinEstaCelda = getHorasConsumidasDocente(d.id, g.id, uac.id);
                                        const hrsTrasAsignar = hrsConsumidasSinEstaCelda + (uac.horasSemanales || 3);
                                        const esSeleccionado = docenteActualId === d.id;
                                        const excedeHoras = hrsTrasAsignar > hrsMax && !esSeleccionado;

                                        return (
                                          <option key={d.id} value={d.id} disabled={excedeHoras} style={{ background: "#0f172a", color: excedeHoras ? "#64748b" : "#ffffff" }}>
                                            {d.apellidoPaterno} {d.nombre} ({hrsConsumidasSinEstaCelda + (esSeleccionado ? (uac.horasSemanales || 3) : 0)}/{hrsMax}h) {excedeHoras ? `⚠️ EXCEDE LÍMITE (${hrsTrasAsignar}h > ${hrsMax}h)` : ""}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "1rem" }}>
            <button
              onClick={() => setPaso(2)}
              style={{ background: "#334155", color: "#ffffff", padding: "0.75rem 1.5rem", borderRadius: "10px", fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              ← Atrás
            </button>

            <button
              disabled={loading}
              onClick={handleGuardarConfiguracion}
              style={{ background: "#16a34a", color: "#ffffff", padding: "0.75rem 2.25rem", borderRadius: "12px", fontWeight: 800, fontSize: "1rem", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)" }}
            >
              {loading ? "Generando Matriz..." : "🚀 Generar Horarios con IA (0 Empalmes)"}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR DOCENTE / PERSONAL */}
      {mostrarModalDocente && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(4px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#0f172a", borderRadius: "16px", padding: "1.5rem", maxWidth: tabModalDocente === "EXCEL" ? "680px" : "540px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", border: "1px solid #334155" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                Agregar Personal a la Plantilla Horaria
              </h3>
              <button
                onClick={() => setMostrarModalDocente(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", borderBottom: "1px solid #334155", marginBottom: "1.25rem", gap: "4px" }}>
              <button
                type="button"
                onClick={() => setTabModalDocente("PLATAFORMA")}
                style={{
                  flex: 1,
                  padding: "0.5rem 0.25rem",
                  fontWeight: 800,
                  fontSize: "0.75rem",
                  border: "none",
                  background: "none",
                  borderBottom: tabModalDocente === "PLATAFORMA" ? "3px solid #38bdf8" : "none",
                  color: tabModalDocente === "PLATAFORMA" ? "#38bdf8" : "#94a3b8",
                  cursor: "pointer"
                }}
              >
                1. Registrados ({personalNoAgregado.length})
              </button>
              <button
                type="button"
                onClick={() => setTabModalDocente("MANUAL")}
                style={{
                  flex: 1,
                  padding: "0.5rem 0.25rem",
                  fontWeight: 800,
                  fontSize: "0.75rem",
                  border: "none",
                  background: "none",
                  borderBottom: tabModalDocente === "MANUAL" ? "3px solid #38bdf8" : "none",
                  color: tabModalDocente === "MANUAL" ? "#38bdf8" : "#94a3b8",
                  cursor: "pointer"
                }}
              >
                2. Nuevo Manual
              </button>
              <button
                type="button"
                onClick={() => setTabModalDocente("EXCEL")}
                style={{
                  flex: 1,
                  padding: "0.5rem 0.25rem",
                  fontWeight: 800,
                  fontSize: "0.75rem",
                  border: "none",
                  background: "none",
                  borderBottom: tabModalDocente === "EXCEL" ? "3px solid #10b981" : "none",
                  color: tabModalDocente === "EXCEL" ? "#34d399" : "#94a3b8",
                  cursor: "pointer"
                }}
              >
                3. 📥 Cargar Excel / CSV
              </button>
            </div>

            {tabModalDocente === "PLATAFORMA" ? (
              <div>
                <div style={{ position: "relative", marginBottom: "0.85rem" }}>
                  <Search style={{ width: "16px", height: "16px", position: "absolute", left: "10px", top: "10px", color: "#94a3b8" }} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o cargo (Docente, Administrativo...)..."
                    value={busquedaPersonal}
                    onChange={(e) => setBusquedaPersonal(e.target.value)}
                    style={{ width: "100%", padding: "0.45rem 0.6rem 0.45rem 2.2rem", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "#ffffff", fontSize: "0.8125rem" }}
                  />
                </div>

                <div style={{ maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem", paddingRight: "0.25rem" }}>
                  {personalDisponibleModal.length === 0 ? (
                    <div style={{ padding: "1.25rem", textAlign: "center", background: "#1e293b", borderRadius: "10px", border: "1px solid #334155" }}>
                      <p style={{ fontSize: "0.8125rem", color: "#94a3b8", margin: 0, fontWeight: 600 }}>
                        {personalPlataforma.length === 0
                          ? "Cargando personal registrado de la escuela..."
                          : personalNoAgregado.length === 0
                          ? "Todo el personal registrado ya forma parte de la plantilla del Paso 2. Puedes registrar nuevo personal en '2. Nuevo Manual' o en '3. Cargar Excel'."
                          : "No se encontró personal coincidente con el filtro."}
                      </p>
                    </div>
                  ) : (
                    personalDisponibleModal.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.75rem", border: "1px solid #334155", borderRadius: "8px", background: "#1e293b" }}>
                        <div>
                          <p style={{ fontSize: "0.8125rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                            {p.apellidoPaterno} {p.apellidoMaterno || ""} {p.nombre}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "2px" }}>
                            <span style={{ fontSize: "0.6875rem", color: p.cargo === "DOCENTE" ? "#60a5fa" : "#fbbf24", fontWeight: 700 }}>
                              {p.cargo || "DOCENTE"}
                            </span>
                            {p.horas_base !== undefined && (
                              <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>
                                • {p.horas_base} hrs base
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAgregarPersonalExistente(p)}
                          style={{ background: "#2563eb", color: "#ffffff", padding: "0.35rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, border: "none", cursor: "pointer" }}
                        >
                          + Agregar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : tabModalDocente === "MANUAL" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.25rem" }}>Nombre(s) *</label>
                  <input
                    type="text"
                    placeholder="Ej. Juan Manuel"
                    value={nuevoDocenteNombre}
                    onChange={(e) => setNuevoDocenteNombre(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "#ffffff", fontSize: "0.875rem", fontWeight: 700 }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.25rem" }}>Apellido Paterno *</label>
                    <input
                      type="text"
                      placeholder="Ej. Pérez"
                      value={nuevoDocentePaterno}
                      onChange={(e) => setNuevoDocentePaterno(e.target.value)}
                      style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "#ffffff", fontSize: "0.875rem", fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.25rem" }}>Apellido Materno</label>
                    <input
                      type="text"
                      placeholder="Ej. Gómez"
                      value={nuevoDocenteMaterno}
                      onChange={(e) => setNuevoDocenteMaterno(e.target.value)}
                      style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "#ffffff", fontSize: "0.875rem", fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.25rem" }}>Cargo / Rol *</label>
                    <select
                      value={nuevoDocenteCargo}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNuevoDocenteCargo(val);
                        if (val !== "DOCENTE" && nuevoDocenteHoras === 20) {
                          setNuevoDocenteHoras(0);
                        } else if (val === "DOCENTE" && nuevoDocenteHoras === 0) {
                          setNuevoDocenteHoras(20);
                        }
                      }}
                      style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "#ffffff", fontSize: "0.875rem", fontWeight: 700 }}
                    >
                      <option value="DOCENTE">Docente</option>
                      <option value="DIRECTIVO">Directivo</option>
                      <option value="PREFECTO">Prefecto</option>
                      <option value="ORIENTADOR">Orientador</option>
                      <option value="ADMINISTRATIVO">Administrativo</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.25rem" }}>Horas Frente a Grupo</label>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={nuevoDocenteHoras}
                      onChange={(e) => setNuevoDocenteHoras(Number(e.target.value))}
                      style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "2px solid #3b82f6", background: "#1e293b", color: "#ffffff", fontSize: "0.875rem", fontWeight: 800 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "0.25rem" }}>Email Institucional (Opcional)</label>
                  <input
                    type="email"
                    placeholder="docente@escuela.edu.mx"
                    value={nuevoDocenteEmail}
                    onChange={(e) => setNuevoDocenteEmail(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "#ffffff", fontSize: "0.875rem" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setMostrarModalDocente(false)}
                    style={{ background: "#334155", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCrearNuevoDocenteManual}
                    style={{ background: "#2563eb", color: "#ffffff", padding: "0.5rem 1.25rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}
                  >
                    Guardar Personal
                  </button>
                </div>
              </div>
            ) : (
              /* TAB 3: IMPORTAR EXCEL */
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div style={{ border: "2px dashed #475569", borderRadius: "12px", padding: "1.25rem", textAlign: "center", background: "#1e293b" }}>
                  <input
                    ref={fileInputHorariosRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleCargarArchivoExcelHorarios}
                    style={{ display: "none" }}
                    id="excel-horarios-input"
                  />
                  <div style={{ fontSize: "2rem", marginBottom: "0.35rem" }}>📑</div>
                  <p style={{ color: "#ffffff", fontWeight: 700, margin: "0 0 0.25rem", fontSize: "0.875rem" }}>
                    {archivoExcelHorarios ? archivoExcelHorarios.name : "Seleccione su archivo Excel (.xlsx, .xls) o CSV"}
                  </p>
                  <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "0 0 0.75rem" }}>
                    Columnas detectadas: Nombre, Apellidos, Cargo/Rol, Horas Base y Email.
                  </p>

                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => fileInputHorariosRef.current?.click()}
                      style={{ background: "#2563eb", color: "#ffffff", border: "none", padding: "0.45rem 0.85rem", borderRadius: "6px", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      📁 {archivoExcelHorarios ? "Cambiar Archivo" : "Seleccionar Archivo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => descargarPlantillaExcelDocentes()}
                      style={{ background: "#334155", color: "#38bdf8", border: "1px solid #475569", padding: "0.45rem 0.85rem", borderRadius: "6px", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      ⬇️ Descargar Formato
                    </button>
                  </div>
                </div>

                {cargandoExcelHorarios && (
                  <div style={{ textAlign: "center", color: "#38bdf8", fontSize: "0.8rem", fontWeight: 700 }}>
                    ⏳ Analizando hoja de cálculo...
                  </div>
                )}

                {docentesParseadosHorarios.length > 0 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ffffff" }}>
                        Previsualización ({docentesParseadosHorarios.filter(d => d.valido).length} listos de {docentesParseadosHorarios.length})
                      </span>
                    </div>

                    <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #334155", borderRadius: "6px", background: "#1e293b" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                        <thead>
                          <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
                            <th style={{ padding: "0.35rem 0.5rem", textAlign: "left", color: "#94a3b8" }}>#</th>
                            <th style={{ padding: "0.35rem 0.5rem", textAlign: "left", color: "#94a3b8" }}>Nombre</th>
                            <th style={{ padding: "0.35rem 0.5rem", textAlign: "left", color: "#94a3b8" }}>Cargo</th>
                            <th style={{ padding: "0.35rem 0.5rem", textAlign: "center", color: "#94a3b8" }}>Horas</th>
                            <th style={{ padding: "0.35rem 0.5rem", textAlign: "center", color: "#94a3b8" }}>Estatus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docentesParseadosHorarios.map((d, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #334155", background: !d.valido ? "rgba(239,68,68,0.1)" : "transparent" }}>
                              <td style={{ padding: "0.35rem 0.5rem", color: "#64748b" }}>{i + 1}</td>
                              <td style={{ padding: "0.35rem 0.5rem", color: "#ffffff", fontWeight: 700 }}>
                                {d.apellidoPaterno} {d.apellidoMaterno} {d.nombre}
                              </td>
                              <td style={{ padding: "0.35rem 0.5rem", color: d.cargo === "DOCENTE" ? "#60a5fa" : "#fbbf24" }}>
                                {d.cargo}
                              </td>
                              <td style={{ padding: "0.35rem 0.5rem", textAlign: "center", color: "#4ade80", fontWeight: 700 }}>
                                {d.horasBase}h
                              </td>
                              <td style={{ padding: "0.35rem 0.5rem", textAlign: "center" }}>
                                {d.valido ? <span style={{ color: "#4ade80", fontWeight: 800 }}>✓ Listo</span> : <span style={{ color: "#f87171" }}>⚠️ Incompleto</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {resultadoParseoMatriz && resultadoParseoMatriz.cargas.length > 0 && (
                  <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: "8px", padding: "0.6rem 0.85rem", color: "#86efac", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>📑</span>
                    <div>
                      <strong>¡Libro Integral Detectado!</strong> Se detectó también la hoja de <strong>Matriz de Horarios</strong> con {resultadoParseoMatriz.resumen.asignadasConExito} asignaciones para {resultadoParseoMatriz.gruposDetectados.length} grupo(s). Al confirmar, se importará el personal y se preparará la matriz de horarios automáticamente.
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarModalDocente(false);
                      setArchivoExcelHorarios(null);
                      setDocentesParseadosHorarios([]);
                    }}
                    style={{ background: "#334155", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleImportarExcelEnHorarios}
                    disabled={docentesParseadosHorarios.filter(d => d.valido).length === 0}
                    style={{
                      background: docentesParseadosHorarios.filter(d => d.valido).length === 0 ? "#334155" : "#10b981",
                      color: "#ffffff",
                      padding: "0.5rem 1.25rem",
                      borderRadius: "8px",
                      fontWeight: 800,
                      border: "none",
                      cursor: docentesParseadosHorarios.filter(d => d.valido).length === 0 ? "not-allowed" : "pointer"
                    }}
                  >
                    {resultadoParseoMatriz && resultadoParseoMatriz.cargas.length > 0 ? "Confirmar e Importar Libro Completo" : "Confirmar e Importar a Plantilla"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CARGAR MATRIZ HORARIA DESDE EXCEL */}
      {mostrarModalMatrizExcel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(4px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#0f172a", borderRadius: "16px", padding: "1.5rem", maxWidth: "780px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", border: "1px solid #334155" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileSpreadsheet style={{ width: "22px", height: "22px", color: "#10b981" }} />
                <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                  Cargar Horario y Matriz de Asignación desde Excel
                </h3>
              </div>
              <button
                onClick={() => {
                  setMostrarModalMatrizExcel(false);
                  setArchivoMatrizExcel(null);
                  setResultadoParseoMatriz(null);
                }}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Dropzone / File input */}
              <div style={{ border: "2px dashed #475569", borderRadius: "12px", padding: "1.25rem", textAlign: "center", background: "#1e293b" }}>
                <input
                  ref={fileInputMatrizRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleCargarArchivoMatrizExcel}
                  style={{ display: "none" }}
                  id="excel-matriz-input"
                />
                <div style={{ fontSize: "2.25rem", marginBottom: "0.35rem" }}>📑</div>
                <p style={{ color: "#ffffff", fontWeight: 700, margin: "0 0 0.25rem", fontSize: "0.9375rem" }}>
                  {archivoMatrizExcel ? archivoMatrizExcel.name : "Seleccione su archivo Excel con la tabla de horarios"}
                </p>
                <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "0 0 0.85rem" }}>
                  Formato compatible: Columnas con los nombres de grupos (ej: 1A, 1B, 1C, 2A, 3A...) y nombres de docentes en las celdas.
                </p>

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => fileInputMatrizRef.current?.click()}
                    style={{ background: "#2563eb", color: "#ffffff", border: "none", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer" }}
                  >
                    📁 {archivoMatrizExcel ? "Cambiar Archivo" : "Seleccionar Archivo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const gruposDelPeriodoActual = grupos.filter(g => (periodoActivo === "A" ? [1, 3, 5] : [2, 4, 6]).includes(g.semestre));
                      descargarPlantillaIntegralHorarios(gruposDelPeriodoActual, periodoActivo, getUACsIndividualesGrupo, docentes);
                    }}
                    style={{ background: "#334155", color: "#38bdf8", border: "1px solid #475569", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer" }}
                  >
                    ⬇️ Descargar Plantilla Integral
                  </button>
                </div>
              </div>

              {cargandoMatrizExcel && (
                <div style={{ textAlign: "center", color: "#38bdf8", fontSize: "0.875rem", fontWeight: 700, padding: "1rem" }}>
                  ⏳ Analizando tabla de horarios y asociando docentes...
                </div>
              )}

              {/* Previsualización de Cargas Encontradas */}
              {resultadoParseoMatriz && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {/* Banner de resumen */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem" }}>
                    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", padding: "0.5rem 0.75rem", textAlign: "center" }}>
                      <span style={{ fontSize: "0.6875rem", color: "#94a3b8", fontWeight: 700, display: "block" }}>Grupos Detectados</span>
                      <strong style={{ fontSize: "1rem", color: "#38bdf8" }}>{resultadoParseoMatriz.gruposDetectados.length}</strong>
                    </div>
                    <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", padding: "0.5rem 0.75rem", textAlign: "center" }}>
                      <span style={{ fontSize: "0.6875rem", color: "#86efac", fontWeight: 700, display: "block" }}>Asignadas con Éxito</span>
                      <strong style={{ fontSize: "1rem", color: "#4ade80" }}>{resultadoParseoMatriz.resumen.asignadasConExito}</strong>
                    </div>
                    <div style={{ background: resultadoParseoMatriz.resumen.requierenRevision > 0 ? "rgba(245,158,11,0.1)" : "#1e293b", border: "1px solid " + (resultadoParseoMatriz.resumen.requierenRevision > 0 ? "rgba(245,158,11,0.3)" : "#334155"), borderRadius: "8px", padding: "0.5rem 0.75rem", textAlign: "center" }}>
                      <span style={{ fontSize: "0.6875rem", color: "#fcd34d", fontWeight: 700, display: "block" }}>Docente No Reconocido</span>
                      <strong style={{ fontSize: "1rem", color: resultadoParseoMatriz.resumen.requierenRevision > 0 ? "#fbbf24" : "#94a3b8" }}>{resultadoParseoMatriz.resumen.requierenRevision}</strong>
                    </div>
                  </div>

                  {docentesParseadosHorarios.filter(d => d.valido).length > 0 && (
                    <div style={{ background: "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.4)", borderRadius: "8px", padding: "0.5rem 0.85rem", color: "#7dd3fc", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>👥</span>
                      <div>
                        <strong>Personal Detectado en Libro:</strong> Se sincronizarán {docentesParseadosHorarios.filter(d => d.valido).length} docentes del archivo con el catálogo de su escuela.
                      </div>
                    </div>
                  )}

                  <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid #334155", borderRadius: "8px", background: "#1e293b" }}>
                    {resultadoParseoMatriz.cargas.length > 0 ? (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                        <thead>
                          <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", position: "sticky", top: 0 }}>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>Grupo</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>Materia (UAC)</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>Texto en Excel</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>Docente Asociado</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "center", color: "#94a3b8" }}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultadoParseoMatriz.cargas.map((c, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #334155", background: c.valido ? "transparent" : "rgba(245,158,11,0.08)" }}>
                              <td style={{ padding: "0.35rem 0.6rem", color: "#38bdf8", fontWeight: 800 }}>{c.grupoNombre}</td>
                              <td style={{ padding: "0.35rem 0.6rem", color: "#ffffff", fontWeight: 600 }}>{c.uacName}</td>
                              <td style={{ padding: "0.35rem 0.6rem", color: "#94a3b8" }}>{c.docenteTextoExcel}</td>
                              <td style={{ padding: "0.35rem 0.6rem", color: c.valido ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                                {c.docenteNombreMatch || "No encontrado"}
                              </td>
                              <td style={{ padding: "0.35rem 0.6rem", textAlign: "center" }}>
                                {c.valido ? (
                                  <span style={{ color: "#4ade80", fontWeight: 800 }}>✓ Listo</span>
                                ) : (
                                  <span style={{ color: "#fbbf24", fontSize: "0.6875rem" }}>⚠️ Sin coincidencia</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : docentesParseadosHorarios.length > 0 ? (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                        <thead>
                          <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", position: "sticky", top: 0 }}>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>#</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>Nombre Docente / Directivo</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#94a3b8" }}>Cargo</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "center", color: "#94a3b8" }}>Horas</th>
                            <th style={{ padding: "0.4rem 0.6rem", textAlign: "center", color: "#94a3b8" }}>Estatus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {docentesParseadosHorarios.map((d, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #334155" }}>
                              <td style={{ padding: "0.35rem 0.6rem", color: "#64748b" }}>{i + 1}</td>
                              <td style={{ padding: "0.35rem 0.6rem", color: "#ffffff", fontWeight: 700 }}>
                                {d.apellidoPaterno} {d.apellidoMaterno} {d.nombre}
                              </td>
                              <td style={{ padding: "0.35rem 0.6rem", color: d.cargo === "DOCENTE" ? "#60a5fa" : "#fbbf24" }}>
                                {d.cargo}
                              </td>
                              <td style={{ padding: "0.35rem 0.6rem", textAlign: "center", color: "#4ade80", fontWeight: 700 }}>
                                {d.horasBase}h
                              </td>
                              <td style={{ padding: "0.35rem 0.6rem", textAlign: "center" }}>
                                {d.valido ? <span style={{ color: "#4ade80", fontWeight: 800 }}>✓ Listo</span> : <span style={{ color: "#f87171" }}>⚠️ Incompleto</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8125rem" }}>
                        No se detectaron asignaciones en la matriz ni registros de personal.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModalMatrizExcel(false);
                    setArchivoMatrizExcel(null);
                    setResultadoParseoMatriz(null);
                    setDocentesParseadosHorarios([]);
                  }}
                  style={{ background: "#334155", color: "#ffffff", padding: "0.5rem 1.1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarImportacionMatriz}
                  disabled={
                    loading ||
                    (!docentesParseadosHorarios.some(d => d.valido) && (!resultadoParseoMatriz || resultadoParseoMatriz.cargas.length === 0))
                  }
                  style={{
                    background: (loading || (!docentesParseadosHorarios.some(d => d.valido) && (!resultadoParseoMatriz || resultadoParseoMatriz.cargas.length === 0))) ? "#334155" : "#10b981",
                    color: "#ffffff",
                    padding: "0.5rem 1.4rem",
                    borderRadius: "8px",
                    fontWeight: 800,
                    border: "none",
                    cursor: (loading || (!docentesParseadosHorarios.some(d => d.valido) && (!resultadoParseoMatriz || resultadoParseoMatriz.cargas.length === 0))) ? "not-allowed" : "pointer"
                  }}
                >
                  {loading ? "Procesando..." : (resultadoParseoMatriz && resultadoParseoMatriz.cargas.length > 0) ? "Confirmar e Importar a Matriz" : "Confirmar e Importar Personal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
