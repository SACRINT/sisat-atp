/**
 * Phase 7B: Cédulas de Supervisión Templates
 * Defines structured field templates with conditional logic for field visits.
 */

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'scale' | 'voice';
  options?: string[];
  required?: boolean;
  conditionalOn?: { fieldId: string; value: string };
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
}

export interface CedulaTemplate {
  id: string;
  tipo: string;
  titulo: string;
  subtitulo: string;
  icono: string;
  campos: FormField[];
}

export const CEDULAS_TEMPLATES: Record<string, CedulaTemplate> = {
  OBSERVACION_CLASE: {
    id: 'OBSERVACION_CLASE',
    tipo: 'OBSERVACION_CLASE',
    titulo: 'Observación de Clase en Aula',
    subtitulo: 'Instrumento de acompañamiento y observación pedagógica in situ',
    icono: 'GraduationCap',
    campos: [
      {
        id: 'docenteObservado',
        label: 'Nombre completo del docente observado',
        type: 'text',
        required: true,
        placeholder: 'Ej. Prof. Juan Pérez Morales',
      },
      {
        id: 'asignatura',
        label: 'Asignatura / UAC observada',
        type: 'text',
        required: true,
        placeholder: 'Ej. Pensamiento Matemático I / Lengua y Comunicación',
      },
      {
        id: 'semestreGrupo',
        label: 'Semestre y Grupo',
        type: 'select',
        required: true,
        options: ['1° Semestre - Grupo A', '1° Semestre - Grupo B', '2° Semestre - Grupo A', '2° Semestre - Grupo B', '3° Semestre - Grupo A', '3° Semestre - Grupo B', '4° Semestre - Grupo A', '4° Semestre - Grupo B', '5° Semestre - Grupo A', '5° Semestre - Grupo B', '6° Semestre - Grupo A', '6° Semestre - Grupo B'],
      },
      {
        id: 'numAlumnosPresentes',
        label: 'Alumnos presentes en el aula',
        type: 'text',
        required: true,
        placeholder: 'Ej. 28 alumnos (15 M / 13 H)',
      },
      {
        id: 'metodologiaObservada',
        label: 'Metodología pedagógica activa observada',
        type: 'select',
        required: true,
        options: [
          'Aprendizaje Basado en Proyectos (ABP)',
          'Aprendizaje Basado en Indagación (STEAM)',
          'Aprendizaje Basado en Problemas (ABPol)',
          'Aprendizaje Servicio (AS)',
          'Estudio de Casos',
          'Cátedra Expositiva / Tradicional',
          'Trabajo Colaborativo en Equipos',
        ],
      },
      {
        id: 'recursosDidacticos',
        label: 'Uso de recursos didácticos en clase',
        type: 'checkbox',
        options: [
          'Guía / Material de trabajo impreso',
          'Pizarrón / Plumones',
          'Proyector / Computadora',
          'Libro de texto / Antología',
          'Dispositivos móviles de los alumnos',
          'Material de laboratorio o experimental',
        ],
      },
      {
        id: 'participacionEstudiantil',
        label: 'Nivel de participación y dinamismo estudiantil (1: Bajo, 5: Excelente)',
        type: 'scale',
        required: true,
        options: ['1', '2', '3', '4', '5'],
      },
      {
        id: 'vinculoPaec',
        label: '¿La sesión demuestra vinculación con el proyecto PAEC / PEC comunitario?',
        type: 'radio',
        required: true,
        options: ['Sí', 'No', 'En proceso'],
      },
      {
        id: 'justificacionPaec',
        label: 'Explique por qué no se vincula o cómo podría articularse al PAEC:',
        type: 'textarea',
        conditionalOn: { fieldId: 'vinculoPaec', value: 'No' },
        placeholder: 'Detalle las áreas de oportunidad para la transversalidad comunitaria...',
      },
      {
        id: 'dictadoObservaciones',
        label: 'Dictado de Hallazgos y Observaciones de Aula (Voz a Texto con IA)',
        type: 'voice',
        required: true,
        placeholder: 'Presione el botón del micrófono y comience a hablar. Describa la interacción, la disciplina, el dominio del tema y la retroalimentación...',
        helpText: 'Hable con naturalidad. La IA estructurará sus comentarios automáticamente.',
      },
      {
        id: 'acuerdosEstablecidos',
        label: 'Acuerdos pedagógicos y compromisos con el docente',
        type: 'textarea',
        placeholder: 'Compromisos de mejora acordados para la siguiente visita...',
      },
    ],
  },

  INFRAESTRUCTURA: {
    id: 'INFRAESTRUCTURA',
    tipo: 'INFRAESTRUCTURA',
    titulo: 'Lista de Cotejo de Infraestructura y Seguridad',
    subtitulo: 'Evaluación física de instalaciones, servicios básicos y equipamiento escolar',
    icono: 'Building2',
    campos: [
      {
        id: 'aulasCondiciones',
        label: 'Estado general de las aulas y ventilación',
        type: 'select',
        required: true,
        options: ['Óptimo', 'Aceptable con detalles menores', 'Requiere mantenimiento urgente', 'Crítico'],
      },
      {
        id: 'serviciosBasicos',
        label: 'Disponibilidad de servicios básicos en el plantel',
        type: 'checkbox',
        options: [
          'Agua potable continua',
          'Energía eléctrica estable',
          'Internet para fines pedagógicos',
          'Drenaje y alcantarillado',
          'Sanitarios limpios y funcionales (H/M)',
          'Cisterna o tanque de almacenamiento',
        ],
      },
      {
        id: 'laboratoriosTalleres',
        label: 'Estado de laboratorios, talleres de cómputo y biblioteca',
        type: 'select',
        options: ['Completamente equipados y en uso', 'Parcialmente equipados', 'Inhabilitados / Sin equipo', 'No cuenta con laboratorios'],
      },
      {
        id: 'areasExteriores',
        label: 'Espacios verdes, canchas deportivas y patio cívico',
        type: 'select',
        options: ['En buen estado y delimitados', 'Requieren limpieza o pintura', 'Deteriorados o riesgo de accidentes'],
      },
      {
        id: 'senaleticaSeguridad',
        label: '¿Cuenta con señalética de protección civil y extintores vigentes?',
        type: 'radio',
        required: true,
        options: ['Sí', 'No', 'Parcialmente'],
      },
      {
        id: 'detalleSeguridad',
        label: 'Faltantes en protección civil detectados:',
        type: 'textarea',
        conditionalOn: { fieldId: 'senaleticaSeguridad', value: 'No' },
        placeholder: 'Indique rutas de evacuación faltantes, extintores vencidos, etc...',
      },
      {
        id: 'dictadoObservacionesInfra',
        label: 'Dictado de Hallazgos de Infraestructura (Voz a Texto)',
        type: 'voice',
        required: true,
        placeholder: 'Dicte las necesidades prioritarias, riesgos físicos, estado de techos, sanitarios o bardas perimetrales...',
      },
    ],
  },

  DIAGNOSTICO_PLANTEL: {
    id: 'DIAGNOSTICO_PLANTEL',
    tipo: 'DIAGNOSTICO_PLANTEL',
    titulo: 'Diagnóstico Integral y Operativo del Plantel',
    subtitulo: 'Revisión directiva, clima escolar, avance del PMC y carpetas institucionales',
    icono: 'ClipboardCheck',
    campos: [
      {
        id: 'directorPresente',
        label: '¿El Director(a) titular se encuentra en el plantel durante la visita?',
        type: 'radio',
        required: true,
        options: ['Sí', 'No'],
      },
      {
        id: 'nombreAtendio',
        label: 'Nombre y cargo de quien atiende la visita:',
        type: 'text',
        required: true,
        placeholder: 'Nombre del responsable en el plantel',
      },
      {
        id: 'avancePmc',
        label: 'Estado de implementación del Programa de Mejora Continua (PMC)',
        type: 'select',
        required: true,
        options: ['Alineado con metas y evidencias al día', 'En proceso de recopilación de evidencias', 'Desfasado en metas programadas', 'No presentado'],
      },
      {
        id: 'avancePaec',
        label: 'Avance en los proyectos comunitarios PAEC / PEC',
        type: 'select',
        required: true,
        options: ['Proyectos activos con impacto comunitario', 'Proyectos en fase de diseño', 'Sin evidencia de proyectos comunitarios'],
      },
      {
        id: 'carpetasPedagogicas',
        label: 'Revisión de carpetas pedagógicas y planeaciones de los docentes',
        type: 'select',
        required: true,
        options: ['100% de docentes con planeaciones al día', 'Mayoría al día con faltantes menores', 'Rezagos significativos en entregas'],
      },
      {
        id: 'dictadoDiagnostico',
        label: 'Dictado de Conclusiones Generales del Plantel (Voz a Texto)',
        type: 'voice',
        required: true,
        placeholder: 'Dicte la valoración general de la gestión escolar, clima laboral, relación con la comunidad y compromisos adquiridos...',
      },
    ],
  },

  INCIDENCIAS: {
    id: 'INCIDENCIAS',
    tipo: 'INCIDENCIAS',
    titulo: 'Registro de Incidencias y Atención Inmediata',
    subtitulo: 'Acta de hechos para situaciones extraordinarias, conflictos o emergencias escolares',
    icono: 'AlertTriangle',
    campos: [
      {
        id: 'tipoIncidencia',
        label: 'Clasificación de la incidencia',
        type: 'select',
        required: true,
        options: [
          'Conflicto interpersonal / Convivencia escolar',
          'Inasistencia o abandono docente',
          'Queja o petición de padres de familia',
          'Incidente de infraestructura o siniestro',
          'Irregularidad administrativa o documental',
          'Otro asunto prioritario',
        ],
      },
      {
        id: 'personasInvolucradas',
        label: 'Actores o personas involucradas (Personal, Alumnos o Tutores)',
        type: 'text',
        required: true,
        placeholder: 'Nombres y cargos o grupos de los involucrados',
      },
      {
        id: 'descripcionHechos',
        label: 'Narrativa cronológica de los hechos observados o reportados',
        type: 'textarea',
        required: true,
        placeholder: 'Describa fecha, hora y circunstancias de lo ocurrido...',
      },
      {
        id: 'dictadoDetalles',
        label: 'Ampliación y Testimonio por Dictado de Voz (Voz a Texto)',
        type: 'voice',
        placeholder: 'Dicte declaraciones, observaciones directas o antecedentes relevantes...',
      },
      {
        id: 'medidasUrgentes',
        label: 'Medidas inmediatas aplicadas durante la intervención',
        type: 'textarea',
        required: true,
        placeholder: 'Acciones preventivas o correctivas adoptadas al momento...',
      },
      {
        id: 'acuerdosFirmados',
        label: 'Acuerdos firmados y seguimiento requerido por Supervisión',
        type: 'textarea',
        required: true,
        placeholder: 'Compromisos con plazos y responsables...',
      },
    ],
  },
};
