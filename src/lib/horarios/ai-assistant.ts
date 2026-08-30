import { callGemini } from "@/lib/gemini";

export interface BloqueoDocenteIA {
  docenteId: string;
  diasIndisponibles?: number[];
  periodosIndisponibles?: { dia: number; periodo: number }[];
}

export interface BloqueoGrupoIA {
  grupoId: string;
  diasIndisponibles?: number[];
  periodosIndisponibles?: { dia: number; periodo: number }[];
}

export type TipoAccionHorario =
  | "REGENERAR_CON_RESTRICCIONES"
  | "MACRO_RESTRICCION"
  | "MOVER_CELDA"
  | "INTERCAMBIAR"
  | "AGRUPAR"
  | "FIJAR_CELDA"
  | "BLOQUEAR_LIBRE";

export interface AccionHorario {
  tipo: TipoAccionHorario;
  bloqueosDocentes?: BloqueoDocenteIA[];
  bloqueosGrupos?: BloqueoGrupoIA[];
  restriccionDistribucion?: "MAX_1_HR_DIA";
  // Propiedades para mutaciones atómicas:
  asignatura?: string;
  grupoId?: string;
  docenteId?: string;
  diaOrigen?: number;
  periodoOrigen?: number;
  diaDestino?: number;
  periodoDestino?: number;
  origen?: { dia: number; periodo: number; grupoId?: string; docenteId?: string };
  destino?: { dia: number; periodo: number; grupoId?: string; docenteId?: string };
  dias?: number[];
  periodos?: { dia: number; periodo: number }[];
  intermedias?: boolean;
}

export interface RespuestaIAHorario {
  explicacion: string;
  acciones: AccionHorario[];
  factible: boolean;
  advertencia?: string;
}

export async function procesarComandoIA(
  mensajeUsuario: string,
  contextoHorario: {
    nombreEscuela: string;
    horasPorDia: number;
    diasLectivos: number;
    grupos: { id: string; nombre: string }[];
    docentes: { id: string; nombreCompleto: string; horasAsignadas: number }[];
    materias: { id: string; nombre: string }[];
    celdasActuales: any[];
    slotsLibresBloqueados?: string[];
    historialConversacion?: { role: string; content: string }[];
  },
  escuelaId?: string
): Promise<RespuestaIAHorario> {
  const systemInstruction = `Eres el Asistente Inteligente de Horarios Escolares para SISAT-ATP (Sistema Integral de Supervisión y Asistencia Técnica Pedagógica - SEP Puebla).
Tu tarea es analizar en lenguaje natural los comandos de directores, VALIDAR LA FACTIBILIDAD MATEMÁTICA de sus peticiones y ejecutar la acción óptima mediante Mutaciones Quirúrgicas o el Solver de Restricciones.

ROUTER DE INTENCIONES (ELIGE EL TIPO DE ACCIÓN CORRECTO):
1. 'MOVER_CELDA': Cuando el director pide mover una clase puntual (ej: "Mueve la clase de Química del 1°A del lunes hora 2 al miércoles hora 4").
2. 'INTERCAMBIAR': Cuando pide intercambiar dos clases o periodos (ej: "Intercambia la clase de Historia con la de Matemáticas el martes en 3°B").
3. 'BLOQUEAR_LIBRE': Cuando pide dar un día libre o bloquear periodos a un docente (ej: "Deja libre el martes a Alejandra", "No le pongas clases en la hora 6 a Pedro").
4. 'MACRO_RESTRICCION' o 'REGENERAR_CON_RESTRICCIONES': Solo cuando pide una reorganización masiva o global que requiera regenerar la distribución completa.

REGLAS DE BLOQUEO DE HORAS LIBRES (ESTRICTO E INVIOLABLE):
- El director ha fijado previamente horas libres y bloqueos con candado (🔒).
- Las horas libres bloqueadas NUNCA deben asignarse a ninguna materia bajo ninguna circunstancia.

REGLA DE VALIDACIÓN MATEMÁTICA DE DÍAS LIBRES:
1. Si un director pide otorgar un día libre a un docente (ej: "darle el miércoles libre a X"):
   - Días lectivos restantes para el docente = 4 días.
   - Capacidad máxima de horas en 4 días = 4 × horasPorDia (ej: 4 × 6 = 24 horas).
   - Compara las 'horasAsignadas' del docente con la capacidad máxima:
     * Si horasAsignadas > capacidadMáxima (ej: 25 hrs > 24 hrs): ES MATEMÁTICAMENTE IMPOSIBLE otorgar el día entero libre.
     * En este caso responde con "factible": false, "acciones": [] y explica detalladamente la razón matemática.

2. Si piden que las horas libres de un docente sean "intermedias" (evitando primera o última hora de salida/entrada):
   - HorasLibres = (diasLectivos × horasPorDia) - horasAsignadas.
   - Si un docente tiene 27 horas asignadas en una jornada de 30 horas, solo tiene 3 horas libres en toda la semana.
   - En este caso, NO le bloquees los periodos 1 y 6 de los 5 días. Explica amablemente que sus 27 horas de clase cubrirán entradas/salidas para que sus 3 huecos queden en medio.

FORMATO DE RESPUESTA OBLIGATORIO (JSON ESTRICTO):
{
  "explicacion": "Explicación amable y profesional sobre la factibilidad y las acciones aplicadas, confirmando explícitamente los días libres y movimientos realizados.",
  "factible": true | false,
  "advertencia": "Advertencia en caso de colisión o nulo",
  "acciones": [
    {
      "tipo": "BLOQUEAR_LIBRE" | "MOVER_CELDA" | "INTERCAMBIAR" | "MACRO_RESTRICCION" | "REGENERAR_CON_RESTRICCIONES",
      "docenteId": "ID_DOCENTE",
      "dias": [2],
      "bloqueosDocentes": [
        {
          "docenteId": "ID_DEL_DOCENTE",
          "diasIndisponibles": [2]
        }
      ]
    }
  ]
}`;

  const historialPrompt = contextoHorario.historialConversacion && contextoHorario.historialConversacion.length > 0 
    ? `\nHISTORIAL DE LA CONVERSACIÓN (¡Conserva y acumula estas peticiones si son restricciones!):\n${contextoHorario.historialConversacion.map(m => `${m.role === 'user' ? 'DIRECTOR' : 'ASISTENTE'}: ${m.content}`).join('\n')}`
    : "";

  const diasNombres = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const slotsLegibles = (contextoHorario.slotsLibresBloqueados || []).map(key => {
    const parts = key.split("_");
    if (parts.length >= 3) {
      const dia = parseInt(parts[0], 10);
      const periodo = parseInt(parts[1], 10);
      const filtroId = parts.slice(2).join("_");
      const doc = contextoHorario.docentes.find(d => d.id === filtroId);
      if (doc) return `• ${diasNombres[dia] || `Día ${dia}`} Periodo ${periodo}: Docente ${doc.nombreCompleto} (ID: ${doc.id}) [BLOQUEADO INTOCABLE]`;
      const grp = contextoHorario.grupos.find(g => g.id === filtroId);
      if (grp) return `• ${diasNombres[dia] || `Día ${dia}`} Periodo ${periodo}: Grupo ${grp.nombre} (ID: ${grp.id}) [BLOQUEADO INTOCABLE]`;
      return `• ${diasNombres[dia] || `Día ${dia}`} Periodo ${periodo}: ID ${filtroId} [BLOQUEADO INTOCABLE]`;
    }
    return `• ${key} [BLOQUEADO INTOCABLE]`;
  });

  const slotsLibresInfo = slotsLegibles.length > 0
    ? `\nSLOTS LIBRES BLOQUEADOS POR EL DIRECTOR EN LA RETÍCULA (INVIOLABLES, PROHIBIDO ASIGNAR MATERIAS AQUÍ):\n${slotsLegibles.join('\n')}`
    : "";

  const prompt = `
CONTEXTO DE LA ESCUELA:
Escuela: ${contextoHorario.nombreEscuela}
Jornada: ${contextoHorario.horasPorDia} Horas/Día × ${contextoHorario.diasLectivos} Días = ${contextoHorario.horasPorDia * contextoHorario.diasLectivos} hrs semanales máximas por grupo.
Grupos: ${JSON.stringify(contextoHorario.grupos)}
Docentes con Horas Asignadas: ${JSON.stringify(contextoHorario.docentes)}${slotsLibresInfo}${historialPrompt}

NUEVA INSTRUCCIÓN DEL DIRECTOR:
"${mensajeUsuario}"

Analiza la factibilidad matemática, ACUMULA las peticiones previas con la nueva y responde exclusivamente en JSON.`;

  try {
    const rawResponse = await callGemini(
      systemInstruction,
      prompt,
      undefined,
      "application/pdf",
      undefined,
      false,
      escuelaId
    );

    const cleanJson = rawResponse
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanJson) as RespuestaIAHorario;
    return parsed;
  } catch (error) {
    console.error("[ai-assistant] Error procesando comando de horario:", error);
    return {
      explicacion: "No pude procesar la instrucción en este momento. Por favor reformula la solicitud.",
      acciones: [],
      factible: false,
      advertencia: "Error de comunicación con el motor de IA."
    };
  }
}
