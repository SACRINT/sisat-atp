/**
 * Utilidades para la estructura de grupos por año/grado y asignaturas oficiales del MCCEMS 2025-2026
 */

export interface EscuelaEstructuraGrupos {
  gruposPrimerAno: number;   // 1er Año (1º o 2º Semestre)
  gruposSegundoAno: number;  // 2º Año (3º o 4º Semestre)
  gruposTercerAno: number;   // 3er Año (5º o 6º Semestre)
}

export interface GrupoDefinicion {
  id: string;
  nombre: string;         // Ej: "1° A", "3° A", "5° A"
  semestre: number;       // 1, 2, 3, 4, 5, 6
  gradoAno: number;       // 1, 2, 3
  letra: string;          // "A", "B", "C"...
}

const LETRAS_GRUPO = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

/**
 * 15 Capacitaciones Laborales Oficiales BGE Puebla (MCCEMS 2025-2026)
 */
export const FORMACIONES_LABORALES = [
  "Administracion",
  "Agricultura Sostenible de Traspatio",
  "Area de la Salud",
  "Comunicacion Grafica",
  "Contabilidad",
  "Domotica",
  "Instalaciones Residenciales",
  "Mecanica Dental",
  "Preparacion de Alimentos Artesanales",
  "Procesos Culinarios y Reposteria",
  "Redes y Mantenimiento",
  "Servicios Ecosistemicos",
  "Sistemas Electricos",
  "Tecnologia Informatica",
  "Turismo"
];

/**
 * Mapeo oficial de Nombres de Submódulos por Capacitación Laboral
 */
export const UACS_LABORALES_MAPA: Record<string, {
  sem3: { name: string; abrev: string }[];
  sem4: { name: string; abrev: string }[];
  sem5: { name: string; abrev: string }[];
  sem6: { name: string; abrev: string }[];
}> = {
  "Administracion": {
    sem3: [
      { name: "Entrega recursos materiales a otras áreas de una organización", abrev: "ENTR-REC" },
      { name: "Organiza recursos materiales a solicitud de un superior", abrev: "ORG-REC" }
    ],
    sem4: [
      { name: "Proporciona atención y servicio al cliente en la organización", abrev: "ATN-CLI" },
      { name: "Auxilia en el reclutamiento y selección de personal", abrev: "RECL-PERS" }
    ],
    sem5: [
      { name: "Elabora trámites administrativos básicos de una organización", abrev: "TRAM-ADM" },
      { name: "Organiza expedientes y documentación interna de las diferentes áreas de una organización", abrev: "ORG-EXP" }
    ],
    sem6: [
      { name: "Apoya en la elaboración de nóminas y control de incidencias", abrev: "NOM-INC" },
      { name: "Elabora reportes de inventarios y control de mercancías", abrev: "REP-INV" }
    ]
  },
  "Agricultura Sostenible de Traspatio": {
    sem3: [
      { name: "Construye huerto para la producción agrícola sostenible de traspatio", abrev: "CONST-HUERTO" },
      { name: "Planea huerto para la producción agrícola sostenible de traspatio", abrev: "PLAN-HUERTO" }
    ],
    sem4: [
      { name: "Produce hortalizas de manera sostenible en el huerto de traspatio", abrev: "PROD-HORT" },
      { name: "Elabora abonos orgánicos e insumos agroecológicos", abrev: "ABON-ORG" }
    ],
    sem5: [
      { name: "Aplica técnicas agroecológicas de conservación de suelo y agua, y de control de plagas y enfermedades", abrev: "TECN-AGROE" },
      { name: "Distingue técnicas agroecológicas de conservación de suelo y agua y de control de plagas y enfermedades", abrev: "DIST-AGROE" }
    ],
    sem6: [
      { name: "Cosecha, maneja y conserva productos agrícolas de traspatio", abrev: "COS-PROD" },
      { name: "Promueve la comercialización local de excedentes de producción", abrev: "COM-EXCED" }
    ]
  },
  "Area de la Salud": {
    sem3: [
      { name: "Despacha medicamentos y material de curación de acuerdo con prescripciones médicas y productos farmacéuticos", abrev: "DESP-MED" },
      { name: "Lleva registro de recetas, inventarios de medicamentos y productos farmacéuticos", abrev: "REG-RECET" }
    ],
    sem4: [
      { name: "Promueve hábitos de vida saludable y prevención de enfermedades en la comunidad", abrev: "PROM-SALUD" },
      { name: "Aplica técnicas básicas de primeros auxilios y somatometría", abrev: "PRIM-AUX" }
    ],
    sem5: [
      { name: "Asiste especialistas del área en las necesidades del paciente", abrev: "ASIST-PAC" },
      { name: "Asiste especialistas del área en las necesidades del paciente diagnosticado", abrev: "ASIST-DIAG" }
    ],
    sem6: [
      { name: "Apoya en el cuidado holístico e higiene del paciente en el entorno comunitario", abrev: "CUID-PAC" },
      { name: "Aplica medidas de bioseguridad y manejo de residuos peligrosos biológico-infecciosos", abrev: "BIO-SEG" }
    ]
  },
  "Comunicacion Grafica": {
    sem3: [
      { name: "Elabora bocetos gráficos comprensibles y creativos a partir de las necesidades de comunicación gráfica requerida", abrev: "BOC-GRAF" },
      { name: "Ilustra dibujos en materiales artesanales o artísticos", abrev: "ILUS-DIB" }
    ],
    sem4: [
      { name: "Produce elementos editoriales gráficos vectoriales y de mapa de bits", abrev: "PROD-EDIT" },
      { name: "Diseña identidades visuales y marcas para la comunicación de proyectos", abrev: "DIS-MARCA" }
    ],
    sem5: [
      { name: "Integra efectos visuales a imágenes y textos por medio de software o aplicaciones digitales de uso libre", abrev: "EFEC-VIS" },
      { name: "Utiliza técnicas de impresión para los diversos productos gráficos, artesanales, artísticos y publicitarios", abrev: "TECN-IMP" }
    ],
    sem6: [
      { name: "Prepara archivos digitales para salidas de preprensa y medios digitales", abrev: "PRE-PRENSA" },
      { name: "Desarrolla proyectos de diseño gráfico publicitario e industrial básico", abrev: "PROY-DIS" }
    ]
  },
  "Contabilidad": {
    sem3: [
      { name: "Opera programas de cómputo para efectuar el registro, cálculo, control y análisis de la información contable", abrev: "PROG-CONT" },
      { name: "Registra movimientos contables de una entidad económica, con base en documentos fuente", abrev: "REG-MOV" }
    ],
    sem4: [
      { name: "Calcula nóminas y percepciones laborales de los trabajadores", abrev: "CALC-NOM" },
      { name: "Realiza conciliaciones bancarias y arqueos de caja", abrev: "CONC-BANC" }
    ],
    sem5: [
      { name: "Realiza reportes básicos previos a los estados financieros", abrev: "REP-FIN" },
      { name: "Registra compras y ventas del sector comercial", abrev: "REG-COMP" }
    ],
    sem6: [
      { name: "Auxilia en la determinación de obligaciones fiscales básicas", abrev: "DETERM-FISC" },
      { name: "Elabora estados financieros básicos de una entidad económica", abrev: "EST-FIN" }
    ]
  },
  "Domotica": {
    sem3: [
      { name: "Separa componentes electrónicos y mecánicos de uso doméstico y comercial", abrev: "COMP-ELEC" },
      { name: "Separa componentes eléctricos y domóticos de uso doméstico y comercial", abrev: "COMP-DOM" }
    ],
    sem4: [
      { name: "Instala sensores y actuadores en sistemas inteligentes residenciales", abrev: "INST-SENS" },
      { name: "Configura redes de comunicación domótica inalámbricas y cableadas", abrev: "CONF-RED" }
    ],
    sem5: [
      { name: "Asiste instalaciones de equipo de automatización y control para uso residencial y comercial", abrev: "ASIST-AUTO" },
      { name: "Opera equipo domótico en instalaciones residenciales y comerciales, bajo supervisión", abrev: "OP-DOM" }
    ],
    sem6: [
      { name: "Programa escenarios de iluminación y seguridad en entornos inteligentes", abrev: "PROG-ESC" },
      { name: "Brinda mantenimiento preventivo a sistemas domóticos instalados", abrev: "MANT-DOM" }
    ]
  },
  "Instalaciones Residenciales": {
    sem3: [
      { name: "Interpreta croquis de diferentes instalaciones básicas de una vivienda", abrev: "INTERP-CROQ" },
      { name: "Prepara materiales en cantidad y calidad especificada para llevar a cabo diferentes tipos de mezclas bajo la supervisión del experto", abrev: "PREP-MEZC" }
    ],
    sem4: [
      { name: "Realiza instalaciones eléctricas residenciales monofásicas y bifásicas", abrev: "INST-ELEC" },
      { name: "Ejecuta instalaciones hidráulicas y sanitarias básicas en vivienda", abrev: "INST-HIDR" }
    ],
    sem5: [
      { name: "Coloca elementos constructivos básicos de una vivienda", abrev: "ELEM-CONST" },
      { name: "Limpia muebles, tuberías y conexiones para llevar a cabo diferentes instalaciones de una vivienda", abrev: "LIMP-TUB" }
    ],
    sem6: [
      { name: "Mantiene y repara redes de agua potable y drenaje residencial", abrev: "MANT-AGUA" },
      { name: "Instala equipos y accesorios de gas L.P. y gas natural bajo norma", abrev: "INST-GAS" }
    ]
  },
  "Mecanica Dental": {
    sem3: [
      { name: "Prepara modelos, moldes, porta impresiones, bloques o rodillos para realizar impresiones dentales parciales o totales", abrev: "PREP-MOLD" },
      { name: "Registra órdenes de trabajo siguiendo especificaciones y prescripciones para dispositivos y aparatos dentales", abrev: "REG-ORD" }
    ],
    sem4: [
      { name: "Confecciona prótesis dentales removibles acrílicas y metálicas", abrev: "CONF-PROT" },
      { name: "Elabora dentaduras totales y prótesis provisionales", abrev: "DENT-TOT" }
    ],
    sem5: [
      { name: "Modela alambres de diversos calibres para casos de aparatología ortodóntica", abrev: "MOD-ALAMB" },
      { name: "Realiza perfilado para prótesis dentales fijas y removibles", abrev: "PERF-PROT" }
    ],
    sem6: [
      { name: "Elabora aparatos de ortodoncia retenedores y de expansión", abrev: "ORTO-RET" },
      { name: "Pulido y terminado estético de dispositivos protésicos dentales", abrev: "PUL-ESTET" }
    ]
  },
  "Preparacion de Alimentos Artesanales": {
    sem3: [
      { name: "Conserva frutas, verduras y legumbres a través de métodos tradicionales", abrev: "CONS-FRUT" },
      { name: "Transforma cereales y harinas para la elaboración de tortillas y productos afines", abrev: "TRANS-CER" }
    ],
    sem4: [
      { name: "Elabora embutidos y productos cárnicos artesanales", abrev: "ELAB-EMBUT" },
      { name: "Prepara lácteos, quesos y derivados lácteos artesanales", abrev: "PREP-LACT" }
    ],
    sem5: [
      { name: "Obtiene bebidas no alcohólicas mediante procedimientos simples", abrev: "OBT-BEB" },
      { name: "Prepara productos de carnes, derivados disponibles y sustitutos de proteína", abrev: "PREP-CARN" }
    ],
    sem6: [
      { name: "Envasa y etiqueta conservas y alimentos procesados tradicionalmente", abrev: "ENV-CONS" },
      { name: "Controla la inocuidad y calidad en la cocina artesanal", abrev: "INOC-ALIM" }
    ]
  },
  "Procesos Culinarios y Reposteria": {
    sem3: [
      { name: "Elabora productos de panificación siguiendo procesos establecidos", abrev: "PROD-PAN" },
      { name: "Emplea productos, utensilios y conceptos culinarios durante el proceso de transformación de alimentos", abrev: "TRANS-ALIM" }
    ],
    sem4: [
      { name: "Elabora bases de cocina fría y caliente para platillos de carta", abrev: "COC-FRIO" },
      { name: "Decora y presenta platillos aplicando montajes vanguardistas", abrev: "DEC-PLAT" }
    ],
    sem5: [
      { name: "Determina costos de producción en la elaboración de platillos", abrev: "COST-PLAT" },
      { name: "Prepara postres y productos de repostería básica", abrev: "PREP-POST" }
    ],
    sem6: [
      { name: "Elabora pastelería fina, galletería y confitería", abrev: "PAST-FINA" },
      { name: "Diseña menús equilibrados atendiendo requerimientos nutricionales", abrev: "DIS-MENU" }
    ]
  },
  "Redes y Mantenimiento": {
    sem3: [
      { name: "Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante", abrev: "ACT-EQUIP" },
      { name: "Usa técnicas y estrategias de mantenimiento del equipo de cómputo", abrev: "MANT-COMP" }
    ],
    sem4: [
      { name: "Instala y configura sistemas operativos de cliente y servidor", abrev: "INST-SO" },
      { name: "Diseña y ponchado de cableado estructurado UTP para redes LAN", abrev: "CAB-RED" }
    ],
    sem5: [
      { name: "Administra redes de acuerdo con las condiciones y requerimientos de una organización", abrev: "ADM-REDES" },
      { name: "Brinda soporte en software de aplicación y hardware según los requerimientos del usuario", abrev: "SOP-SOFT" }
    ],
    sem6: [
      { name: "Configura enrutadores y conmutadores para pequeñas y medianas empresas", abrev: "CONF-ROUT" },
      { name: "Aplica políticas de seguridad informática y respaldo de datos", abrev: "SEG-DATOS" }
    ]
  },
  "Servicios Ecosistemicos": {
    sem3: [
      { name: "Aplica técnicas de muestreo indicadas por el especialista", abrev: "TECN-MUEST" },
      { name: "Recopila muestras para las pruebas de niveles de contaminantes con guía del especialista", abrev: "RECOP-MUEST" }
    ],
    sem4: [
      { name: "Evalúa la biodiversidad de flora y fauna en ecosistemas locales", abrev: "EVAL-BIODIV" },
      { name: "Realiza monitoreo de calidad del agua y aire en la comunidad", abrev: "MON-AGUA" }
    ],
    sem5: [
      { name: "Aplica técnicas para la siembra de diversas semillas forestales bajo supervisión", abrev: "SIEMB-FOR" },
      { name: "Realiza pruebas de suelos y fertilizantes para el mantenimiento del ecosistema forestal", abrev: "PRUEB-SUEL" }
    ],
    sem6: [
      { name: "Promueve proyectos de reforestación y restauración de suelos", abrev: "REFOR-SUEL" },
      { name: "Diseña senderos interpretativos y proyectos de educación ambiental", abrev: "ED-AMB" }
    ]
  },
  "Sistemas Electricos": {
    sem3: [
      { name: "Elabora empalmes acordes con las características de los hilos", abrev: "ELAB-EMP" },
      { name: "Limpia áreas de trabajo, equipo, materiales y herramientas utilizadas durante la actividad", abrev: "LIMP-HERR" }
    ],
    sem4: [
      { name: "Monta canalizaciones, tubería conduit y cajas de registro eléctricas", abrev: "MONT-CANAL" },
      { name: "Cablea circuitos de alumbrado y contactos comerciales", abrev: "CABL-ALUMB" }
    ],
    sem5: [
      { name: "Ensambla componentes sobre tableros en perfocel para circuitos eléctricos básicos", abrev: "ENS-PERF" },
      { name: "Reconoce planos de sistemas eléctricos en servicios domésticos y comerciales", abrev: "PLAN-ELEC" }
    ],
    sem6: [
      { name: "Mantiene motores eléctricos monofásicos y trifásicos", abrev: "MANT-MOT" },
      { name: "Instala subestaciones y tableros de distribución de baja tensión", abrev: "INST-TAB" }
    ]
  },
  "Tecnologia Informatica": {
    sem3: [
      { name: "Utiliza herramientas de programación estructurada para solución de problemas simples", abrev: "PROG-ESTR" },
      { name: "Utiliza aplicaciones ofimáticas en distintos sistemas operativos", abrev: "APL-OFIM" }
    ],
    sem4: [
      { name: "Desarrolla sitios web dinámicos con HTML, CSS y JavaScript", abrev: "DEV-WEB" },
      { name: "Diseña y gestiona bases de datos relacionales simples", abrev: "BASES-DATOS" }
    ],
    sem5: [
      { name: "Elabora presentaciones electrónicas en diferentes aplicaciones relacionadas con la ofimática", abrev: "PRES-OFIM" },
      { name: "Opera dispositivos electrónicos multifuncionales en procesos administrativos", abrev: "OP-MULTIF" }
    ],
    sem6: [
      { name: "Desarrolla aplicaciones móviles y sistemas orientados a objetos", abrev: "DEV-MOVIL" },
      { name: "Implementa servicios en la nube e inteligencia artificial básica", abrev: "NUBE-IA" }
    ]
  },
  "Turismo": {
    sem3: [
      { name: "Explica procesos de expedición de documentos oficiales en las instituciones gubernamentales correspondientes para transitar o viajar", abrev: "DOC-TUR" },
      { name: "Muestra variedad de servicios que componen el catálogo de la planta turística", abrev: "SERV-TUR" }
    ],
    sem4: [
      { name: "Diseña itinerarios y paquetes turísticos regionales y nacionales", abrev: "DIS-ITIN" },
      { name: "Coordina recorridos guiados patrimonio cultural y natural", abrev: "RECORR-GUI" }
    ],
    sem5: [
      { name: "Asiste usuarios en la selección, adquisición y utilización eficiente de servicios turísticos requeridos", abrev: "ASIST-TUR" },
      { name: "Promociona sitios alternativos de lugares a visitar según necesidades del turista", abrev: "PROM-TUR" }
    ],
    sem6: [
      { name: "Administra reservas hoteleras y pasajes en plataformas turísticas", abrev: "ADM-RESV" },
      { name: "Organiza eventos, convenciones y ferias turísticas locales", abrev: "ORG-EVENT" }
    ]
  }
};

/**
 * Optativas FFE Categorizadas por Cuadros (MCCEMS 2025-2026 Puebla)
 */
export const FFE_RECURSOS_SOCIOCOGNITIVOS = [
  "Comunicación y Sociedad I",
  "Raíces Etimológicas del Español I",
  "Inglés V (Avanzado)",
  "Taller de Pensamiento Variacional I",
  "Dibujo Técnico I",
  "Pensamiento Matemático Aplicado a las Finanzas I",
  "Taller de Probabilidad y Estadística I"
];

export const FFE_AREAS_CONOCIMIENTO = [
  "Salud Integral I",
  "Análisis de Fenómenos y Procesos Biológicos",
  "Análisis de Fenómenos Físicos I",
  "Organización del Flujo de Materia y Energía en los Organismos I",
  "Fundamentos de Administración I",
  "Procesos Contables I",
  "Derecho y Sociedad I",
  "Economía I. La Función de los Agentes Económicos en la Sociedad",
  "Temas Selectos de Ciencias Sociales I",
  "Psicología I",
  "Arte y Cultura I",
  "Lógica y Pensamiento Crítico",
  "Pensamiento Filosófico I"
];

/**
 * Mapeo Oficial de Continuidad de Asignaturas FFE (5.º Semestre -> 6.º Semestre)
 * Según documento normativo oficial "FFE 2025-2026.pdf"
 */
export const FFE_CONTINUIDAD_5_A_6: Record<string, string> = {
  // Recursos Sociocognitivos - Lengua y Comunicación
  "Comunicación y Sociedad I": "Comunicación y Sociedad II",
  "Raíces Etimológicas del Español I": "Raíces Etimológicas del Español II",
  "Inglés V (Avanzado)": "Inglés VI (Avanzado)",
  "Inglés V": "Inglés VI",

  // Recursos Sociocognitivos - Pensamiento Matemático
  "Taller de Pensamiento Variacional I": "Taller de Pensamiento Variacional II",
  "Dibujo Técnico I": "Dibujo Técnico II",
  "Pensamiento Matemático Aplicado a las Finanzas I": "Pensamiento Matemático Aplicado a las Finanzas II",
  "Taller de Probabilidad y Estadística I": "Taller de Probabilidad y Estadística II",

  // Áreas de Conocimiento - Ciencias Naturales, Experimentales y Tecnología
  "Salud Integral I": "Salud Integral II",
  "Análisis de Fenómenos y Procesos Biológicos": "Temas Selectos de Biología",
  "Análisis de Fenómenos Físicos I": "Análisis de Fenómenos Físicos II",
  "Organización del Flujo de Materia y Energía en los Organismos I": "Organización del Flujo de Materia en los Organismos II",

  // Áreas de Conocimiento - Ciencias Sociales
  "Fundamentos de Administración I": "Fundamentos de Administración II",
  "Procesos Contables I": "Procesos Contables II",
  "Derecho y Sociedad I": "Derecho y Sociedad II",
  "Economía I. La Función de los Agentes Económicos en la Sociedad": "Economía II. Política Económica y Política Pública Mexicana",
  "Temas Selectos de Ciencias Sociales I": "Temas Selectos de Ciencias Sociales II",
  "Psicología I": "Psicología II",

  // Áreas de Conocimiento - Humanidades
  "Arte y Cultura I": "Arte y Cultura II",
  "Lógica y Pensamiento Crítico": "Experiencia Estética",
  "Pensamiento Filosófico I": "Pensamiento Filosófico II"
};

/**
 * Obtiene el nombre de la asignatura continuadora en 6.º semestre a partir de la de 5.º
 */
export function obtenerFfeSemestre6(nombreSem5: string): string {
  if (!nombreSem5) return "Optativa FFE II";
  return FFE_CONTINUIDAD_5_A_6[nombreSem5] || nombreSem5.replace(/ I$/, " II");
}

/**
 * Catálogo Oficial Completo de Optativas FFE MCCEMS 2025-2026
 */
export const FFE_OPTATIVAS_CATALOGO = [
  ...FFE_RECURSOS_SOCIOCOGNITIVOS,
  ...FFE_AREAS_CONOCIMIENTO
];

/**
 * Genera la lista de grupos oficiales de una escuela basándose en su estructura (ej: 2-1-1)
 */
export function generarGruposPorEstructura(
  escuela: { gruposPrimerAno?: number; gruposSegundoAno?: number; gruposTercerAno?: number },
  periodoSemestral: "SEMESTRE_A" | "SEMESTRE_B" = "SEMESTRE_A"
): GrupoDefinicion[] {
  const g1 = Math.max(1, escuela.gruposPrimerAno ?? 1);
  const g2 = Math.max(1, escuela.gruposSegundoAno ?? 1);
  const g3 = Math.max(1, escuela.gruposTercerAno ?? 1);

  const grupos: GrupoDefinicion[] = [];
  const semestres = periodoSemestral === "SEMESTRE_A" ? [1, 3, 5] : [2, 4, 6];

  for (let i = 0; i < g1; i++) {
    const letra = LETRAS_GRUPO[i] || `${i + 1}`;
    grupos.push({ id: `g-${semestres[0]}-${letra}`, nombre: `${semestres[0]}° ${letra}`, semestre: semestres[0], gradoAno: 1, letra });
  }

  for (let i = 0; i < g2; i++) {
    const letra = LETRAS_GRUPO[i] || `${i + 1}`;
    grupos.push({ id: `g-${semestres[1]}-${letra}`, nombre: `${semestres[1]}° ${letra}`, semestre: semestres[1], gradoAno: 2, letra });
  }

  for (let i = 0; i < g3; i++) {
    const letra = LETRAS_GRUPO[i] || `${i + 1}`;
    grupos.push({ id: `g-${semestres[2]}-${letra}`, nombre: `${semestres[2]}° ${letra}`, semestre: semestres[2], gradoAno: 3, letra });
  }

  return grupos;
}

/**
 * Catálogo Oficial Nombres Exactos de Formación Socioemocional (Currículum Ampliado / FFEO)
 * Nombres oficiales según MCCEMS BGE Puebla:
 * 1. Educación para la Salud
 * 2. Educación Integral en Sexualidad y Género
 * 3. Práctica y Colaboración Ciudadana
 */
export const FORMACIONES_SOCIOEMOCIONALES = [
  "Educación para la Salud",
  "Educación Integral en Sexualidad y Género",
  "Práctica y Colaboración Ciudadana"
];

/**
 * Calcula la Formación Socioemocional exacta para cada semestre de un grupo (3º, 4º, 5º, 6º)
 * Reglas Estrictas:
 * - 3.er Semestre: Selección del Director (Opción 1). NUNCA se repite en 4.º, 5.º ni 6.º.
 * - 5.º Semestre: Selección del Director entre las 2 restantes (Opción 2). NUNCA se repite en 3.er, 4.º ni 6.º.
 * - 4.º y 6.º Semestre: Asignación automática de la 3.ª opción restante (Opción 3). 4.º y 6.º llevan EXACTAMENTE la misma asignatura.
 */
export function resolverSocioemocionalGrupo(
  socioemocionalSem3?: string,
  socioemocionalSem5?: string
): { sem3: string; sem4: string; sem5: string; sem6: string } {
  let s3: string;
  let s5: string;

  if (socioemocionalSem3 && socioemocionalSem5) {
    s3 = socioemocionalSem3;
    s5 = socioemocionalSem5 === socioemocionalSem3
      ? (FORMACIONES_SOCIOEMOCIONALES.find(s => s !== socioemocionalSem3) || FORMACIONES_SOCIOEMOCIONALES[1])
      : socioemocionalSem5;
  } else if (socioemocionalSem3 && !socioemocionalSem5) {
    s3 = socioemocionalSem3;
    s5 = FORMACIONES_SOCIOEMOCIONALES.find(s => s !== socioemocionalSem3) || FORMACIONES_SOCIOEMOCIONALES[1];
  } else if (!socioemocionalSem3 && socioemocionalSem5) {
    s5 = socioemocionalSem5;
    s3 = FORMACIONES_SOCIOEMOCIONALES.find(s => s !== socioemocionalSem5) || FORMACIONES_SOCIOEMOCIONALES[0];
  } else {
    s3 = FORMACIONES_SOCIOEMOCIONALES[0];
    s5 = FORMACIONES_SOCIOEMOCIONALES[1];
  }

  const restanteParaSem4y6 = FORMACIONES_SOCIOEMOCIONALES.find(s => s !== s3 && s !== s5) || FORMACIONES_SOCIOEMOCIONALES[2];

  return {
    sem3: s3,
    sem4: restanteParaSem4y6,
    sem5: s5,
    sem6: restanteParaSem4y6
  };
}

/**
 * Resuelve las Asignaturas/UACs oficiales exactas para un Grupo según su Semestre y Capacitaciones
 */
export function obtenerAsignaturasParaGrupo(
  semestre: number,
  capacitacionNombre: string = "Administracion",
  ffeOptativasArr: string[] = [],
  ffeoSocioemocional?: string
): { nombre: string; tipo: "FUNDAMENTAL" | "LABORAL" | "EXTENDIDO" | "SOCIOEMOCIONAL"; horas: number }[] {

  if (semestre === 1) {
    // 1.er Semestre 2026-2027: 8 asignaturas activas (25 horas totales)
    // Se ocultan LAB-INV (3 hrs) y ART-CULT-I (2 hrs) según nuevas indicaciones SEP
    return [
      { nombre: "Ciencias Naturales, Experimentales y Tecnología I", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático I", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Humanidades I", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Lenguaje y Comunicación I", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés I", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Cultura Digital I", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Ciencias Sociales I", tipo: "FUNDAMENTAL", horas: 2 },
      { nombre: "Actividades Físicas y Deportivas I", tipo: "SOCIOEMOCIONAL", horas: 2 },
    ];
  }

  if (semestre === 2) {
    return [
      { nombre: "Conservación de la Materia y sus Interacciones con la Energía", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático II", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Humanidades II", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Lenguaje y Comunicación II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Cultura Digital II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Ciencias Sociales II", tipo: "FUNDAMENTAL", horas: 2 },
      { nombre: "Actividades Físicas y Deportivas II", tipo: "SOCIOEMOCIONAL", horas: 2 },
    ];
  }

  if (semestre === 3) {
    const labInfo = UACS_LABORALES_MAPA[capacitacionNombre]?.sem3 || UACS_LABORALES_MAPA["Administracion"].sem3;
    const socioNombre = ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[0];

    return [
      { nombre: "Ciencias Naturales, Experimentales y Tecnología III", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático III", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Humanidades III", tipo: "FUNDAMENTAL", horas: 5 },
      { nombre: "Taller de Ciencias II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Lengua y Comunicación III", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés III", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: socioNombre, tipo: "SOCIOEMOCIONAL", horas: 2 },
      { nombre: labInfo[0].name, tipo: "LABORAL", horas: 3 },
      { nombre: labInfo[1].name, tipo: "LABORAL", horas: 3 },
    ];
  }

  if (semestre === 4) {
    const labInfo = UACS_LABORALES_MAPA[capacitacionNombre]?.sem4 || UACS_LABORALES_MAPA["Administracion"].sem4;
    const socioNombre = ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[2];

    return [
      { nombre: "Ciencias Naturales, Experimentales y Tecnología IV", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático IV", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Humanidades IV", tipo: "FUNDAMENTAL", horas: 5 },
      { nombre: "Taller de Ciencias III", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Lengua y Comunicación IV", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés IV", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: socioNombre, tipo: "SOCIOEMOCIONAL", horas: 2 },
      { nombre: labInfo[0].name, tipo: "LABORAL", horas: 3 },
      { nombre: labInfo[1].name, tipo: "LABORAL", horas: 3 },
    ];
  }

  if (semestre === 5) {
    const labInfo = UACS_LABORALES_MAPA[capacitacionNombre]?.sem5 || UACS_LABORALES_MAPA["Administracion"].sem5;
    
    // 4 Optativas FFE de libre selección (cualquiera de las 20 del catálogo)
    const ffe1 = ffeOptativasArr[0] || FFE_OPTATIVAS_CATALOGO[0];
    const ffe2 = ffeOptativasArr[1] || FFE_OPTATIVAS_CATALOGO[1];
    const ffe3 = ffeOptativasArr[2] || FFE_OPTATIVAS_CATALOGO[2];
    const ffe4 = ffeOptativasArr[3] || FFE_OPTATIVAS_CATALOGO[3];
    const socioNombre = ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[1];

    return [
      // UACs Fundamentales oficiales del 5.º semestre MCCEMS 2025-2026 BGE Puebla
      { nombre: "La Energía en los Procesos de la Vida Diaria", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Conciencia Histórica II. México Durante el Expansionismo Capitalista", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Taller de Habilidades del Pensamiento", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: socioNombre, tipo: "SOCIOEMOCIONAL", horas: 2 },
      { nombre: labInfo[0].name, tipo: "LABORAL", horas: 3 },
      { nombre: labInfo[1].name, tipo: "LABORAL", horas: 3 },
      { nombre: ffe1, tipo: "EXTENDIDO", horas: 3 },
      { nombre: ffe2, tipo: "EXTENDIDO", horas: 3 },
      { nombre: ffe3, tipo: "EXTENDIDO", horas: 3 },
      { nombre: ffe4, tipo: "EXTENDIDO", horas: 3 },
    ];
  }

  // Semestre 6: Continuidad automática con FFE de 5.º semestre
  const labInfo6 = UACS_LABORALES_MAPA[capacitacionNombre]?.sem6 || UACS_LABORALES_MAPA["Administracion"].sem6;
  const ffe1 = obtenerFfeSemestre6(ffeOptativasArr[0] || FFE_OPTATIVAS_CATALOGO[0]);
  const ffe2 = obtenerFfeSemestre6(ffeOptativasArr[1] || FFE_OPTATIVAS_CATALOGO[1]);
  const ffe3 = obtenerFfeSemestre6(ffeOptativasArr[2] || FFE_OPTATIVAS_CATALOGO[2]);
  const ffe4 = obtenerFfeSemestre6(ffeOptativasArr[3] || FFE_OPTATIVAS_CATALOGO[3]);
  const socioNombre = ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[2];

  return [
    { nombre: "La Energía en los Procesos de la Vida Diaria II", tipo: "FUNDAMENTAL", horas: 4 },
    { nombre: "Conciencia Histórica III. México en el Siglo XXI", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Taller de Habilidades del Pensamiento II", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: socioNombre, tipo: "SOCIOEMOCIONAL", horas: 2 },
    { nombre: labInfo6[0].name, tipo: "LABORAL", horas: 3 },
    { nombre: labInfo6[1].name, tipo: "LABORAL", horas: 3 },
    { nombre: ffe1, tipo: "EXTENDIDO", horas: 3 },
    { nombre: ffe2, tipo: "EXTENDIDO", horas: 3 },
    { nombre: ffe3, tipo: "EXTENDIDO", horas: 3 },
    { nombre: ffe4, tipo: "EXTENDIDO", horas: 3 },
  ];
}
