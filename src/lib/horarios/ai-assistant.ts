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

export interface AccionHorario {
  tipo: "REGENERAR_CON_RESTRICCIONES" | "MOVER_CELDA" | "FIJAR_CELDA";
  bloqueosDocentes?: BloqueoDocenteIA[];
  bloqueosGrupos?: BloqueoGrupoIA[];
  restriccionDistribucion?: "MAX_1_HR_DIA";
  grupoId?: string;
  docenteId?: string;
  diaOrigen?: number;
  periodoOrigen?: number;
  diaDestino?: number;
  periodoDestino?: number;
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
  const systemInstruction = `Eres el Asistente Inteligente de Horarios Escolares para SISAT-ATP (SEP Puebla).
Tu tarea es analizar en lenguaje natural los comandos de directores, VALIDAR LA FACTIBILIDAD MATEMÁTICA de sus peticiones y ejecutar la reorganización óptima mediante el Solver de Restricciones.

REGLAS DE BLOQUEO DE HORAS LIBRES (ESTRICTO E INVIOLABLE):
- El director ha fijado previamente horas libres y bloqueos con candado (🔒).
- Las horas libres bloqueadas NUNCA deben asignarse a ninguna materia bajo ninguna circunstancia.
- Si el usuario dice "respeta las horas libres bloqueadas" o pide bloquear días/horas adicionales a docentes o grupos, DEBES incluir esas restricciones explícitamente en 'bloqueosDocentes' o 'bloqueosGrupos'.

IMPORTANTE SOBRE LA MEMORIA CONVERSACIONAL:
- Si el usuario te da una nueva instrucción, DEBES acumularla con las instrucciones anteriores del historial.
- Si te pidió darle el lunes libre a un docente en el mensaje 1, y en el mensaje 2 te pide el martes libre a otro docente, en tu respuesta DEBES INCLUIR LAS RESTRICCIONES DE AMBOS. Si no lo haces, destruirás el trabajo previo.

REGLA DE VALIDACIÓN MATEMÁTICA DE DÍAS LIBRES (CRÍTICO):
1. Si un director pide otorgar un día libre a un docente (ej: "darle el miércoles libre a X"):
   - Días lectivos restantes para el docente = 4 días.
   - Capacidad máxima de horas en 4 días = 4 × horasPorDia (ej: 4 × 6 = 24 horas).
   - Compara las 'horasAsignadas' del docente con la capacidad máxima:
     * Si horasAsignadas > capacidadMáxima (ej: 25 hrs > 24 hrs): ES MATEMÁTICAMENTE IMPOSIBLE otorgar el día entero libre.
     * En este caso DEBES responder con "factible": false, "acciones": [] y explicar claramente al director por qué excede la capacidad máxima semanal.

2. Si piden distribuir asignaturas "equitativamente" o "1 hora por día":
   - Agrega a la acción la propiedad "restriccionDistribucion": "MAX_1_HR_DIA".

3. Si piden bloquear horas o periodos específicos (ej: "no pongas clases en la 6ta hora a Nemorio el viernes"):
   - Agrega en 'bloqueosDocentes' el 'docenteId' con 'periodosIndisponibles': [{ "dia": 5, "periodo": 6 }].

FORMATO DE RESPUESTA OBLIGATORIO (JSON ESTRICTO):
{
  "explicacion": "Explicación amable y profesional sobre la factibilidad y las acciones aplicadas, confirmando explícitamente que se respetan los bloqueos de horas libres solicitados",
  "factible": true | false,
  "advertencia": "Advertencia en caso de colisión o nulo",
  "acciones": [
    {
      "tipo": "REGENERAR_CON_RESTRICCIONES",
      "restriccionDistribucion": "MAX_1_HR_DIA",
      "bloqueosDocentes": [
        {
          "docenteId": "ID_DEL_DOCENTE",
          "diasIndisponibles": [3],
          "periodosIndisponibles": [{ "dia": 5, "periodo": 6 }]
        }
      ],
      "bloqueosGrupos": [
        {
          "grupoId": "ID_DEL_GRUPO",
          "diasIndisponibles": [],
          "periodosIndisponibles": []
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
      "application/json",
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
