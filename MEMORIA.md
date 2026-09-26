# Manual Técnico y Memoria de Arquitectura - SISAT-ATP

Este documento es el **Manual Técnico Definitivo** de **SISAT-ATP (Sistema Inteligente de Supervisión Administrativa Tecnológica y Automatización Técnica Pedagógica)**. Está diseñado para que cualquier desarrollador (humano o Inteligencia Artificial) pueda comprender la estructura completa del proyecto, la ubicación de cada módulo, y el funcionamiento técnico de los subsistemas, facilitando la implementación, actualización y modificación de la plataforma.

---

## 1. Arquitectura General y Stack Tecnológico

SISAT-ATP está construido sobre una arquitectura **Serverless** y **SSR (Server-Side Rendering)** híbrida utilizando los últimos estándares de React.

*   **Framework Principal**: **Next.js 14+** (App Router). La lógica de frontend se encuentra en componentes de cliente (`"use client"`) y la lógica de negocio en **Server Actions** o **API Routes** (`/api`).
*   **Base de Datos**: PostgreSQL alojada en [Neon](https://neon.tech/), optimizada para entornos serverless.
*   **ORM**: **Prisma** (`prisma/schema.prisma`). Gestiona los modelos, migraciones y el cliente fuertemente tipado.
*   **Autenticación**: **NextAuth.js v5 (Beta)**. Implementa estrategias JWT usando el proveedor `Credentials`. Soporta roles mixtos (Director de Escuela, ATP Lector, ATP Editor, Super Admin).
*   **Almacenamiento de Archivos**: **Cloudinary**. Se usa para almacenar PDFs, DOCX y JPGs de manera temporal o persistente. La subida va directo a Cloudinary desde el cliente con firma de `/api/sign-cloudinary` y se confirma en `/api/upload/confirm` (evita el límite de 4.5 MB de Vercel).
*   **Motor de Inteligencia Artificial**: **Google Gemini API** (`@google/genai`). Utilizado para revisión de documentos (texto) y OCR inteligente (visión). Cuenta con un sistema interno de rotación y fallback de API Keys.

---

## 2. Panel del Administrador (Supervisión / ATPs)

El portal administrativo se encuentra en la ruta `src/app/admin/AdminDashboard.tsx`. Actúa como el centro de mando y se divide en secciones renderizadas dinámicamente según los permisos granulares (JSON) del usuario en sesión. Los componentes individuales viven en `src/app/admin/_componentes/`.

### 2.1 Sección: Monitoreo
Enfocada en la visualización de métricas y el cumplimiento de las escuelas.
*   **Vista General (`VistaGeneral.tsx`)**: Dashboard estadístico que cruza datos de escuelas con el total de entregas aprobadas, pendientes y rechazadas. Calcula el "semáforo" de cumplimiento de la zona escolar.
*   **Avance de Entregas (`GestionPeriodos.tsx` / `ListadoProgramas.tsx`)**: Matrices de doble entrada (Escuela vs Programa) para identificar qué escuela ya subió el PMC, PAEC, etc.
*   **Reportes al Nivel (`ReportesNivel.tsx`)**: Genera sábanas Excel (XLSX) y reportes automatizados (CEDAVIM, Día Naranja). Llama a `/api/entregas/reportes`.

### 2.2 Sección: Configuración
El núcleo de parametrización del sistema.

*   **Gestión de Escuelas (`GestionEscuelas.tsx`)**: CRUD de escuelas (CCT, Nombre, Director). Incluye:
    - Reset de contraseñas de directores.
    - **Pestaña "Programas y Módulos por Escuela"** (nueva): Tabla-matriz donde cada fila es una escuela y cada columna es un módulo del sistema (Horarios IA, PMC, PAEC-PEC, etc.). Permite activar o desactivar módulos de forma individual por escuela o masivamente para todas. Ver sección 5.1.

*   **Programas y Módulos (`GestionProgramas.tsx`)**: Define los programas federales/estatales. Aquí se asocian las **Plantillas de Evaluación** (Rúbricas) que la IA leerá. Cuando se crea un programa nuevo, automáticamente aparece como columna nueva en la Matriz de Escuelas.

*   **Fechas y Entregas de Programas** *(antes llamada "Periodos y Tareas")*: Controla las fechas de apertura y cierre de entregas.

*   **Ciclos Escolares (`GestionCiclos.tsx`)**: Gestiona años lectivos (ej. "2025-2026").

*   **Formatos y Plantillas**: Subida de machotes en DOCX/PDF descargables por los directores.

*   **Configuración CAPEMS (`GestionCapems.tsx`)**: Parametriza las fichas de Control de Actividades. Establece qué meses están activos.

*   **Accesos y Seguridad (`GestionATPs.tsx`)**: Panel exclusivo del SUPER ADMIN para dar de alta a ATPs con permisos granulares en JSON.

*   **Herramientas de IA (`GestionLlavesIA.tsx` / `GestionPrompts.tsx`)**: Administración de llaves de API (Gemini/OpenRouter). Rotación automática entre llaves.

### 2.3 Sección: Módulos Activos
*   **Expedientes de Personal**: Listado completo de trabajadores de toda la zona con filtros por documento faltante/rechazado.
*   **Documentos Admin**: Sub-panel para documentos exclusivos de la supervisión.

---

## 3. Portal del Director (Escuelas)

Ubicado en `src/app/director/DirectorPortal.tsx`. Los componentes viven en `src/app/director/_componentes/`.

*   **Avance de Entregas (`EntregasListado.tsx`)**: Lista de tareas (PMC, PAEC, etc). Al subir un archivo, se dispara `/api/upload/confirm` y se invoca la Pre-Revisión IA automáticamente. El **Asistente de Correcciones** es una ventana de chat embebida que habla con el LLM usando como contexto las observaciones de esa entrega.

*   **Expedientes de Personal (`ExpedientesPanel.tsx`)**: CRUD de trabajadores de la escuela. El director llena datos básicos (RFC, nombre) y sube hasta 10 tipos de documentos. Al subir, se lanza validación OCR en segundo plano. **Regla de validación de Título según Cargo**:
    - **Personal de Apoyo Administrativo**: acepta Certificado de Bachillerato como Título válido (marcado como correcto).
    - **Docentes, Directores, Responsables de Plantel, ATPs, Supervisores**: requieren Título universitario completo.

*   **Fichas CAPEMS (`CapemsPanel.tsx`)**: Subida mensual de controles. La IA valida que la imagen corresponda a una ficha oficial.

*   **Generador de Horarios IA** (`src/app/director/_componentes/horarios/`): Ver sección 5.2.

*   **Inscripción de Eventos (`InscripcionEventos.tsx` / `OlimpiadaMatematicas.tsx`)**: Módulos temporales para concursos zonales.

---

## 4. Manual Técnico de Sistemas Centrales (Subsistemas)

### 4.1 Sistema de Autenticación y Autorización (JWT / Middlewares)
*   **Ubicación**: `src/lib/auth.ts`, `src/middleware.ts`, `src/lib/permissions.ts`.
*   **Funcionamiento**: NextAuth v5. Al hacer login (`/api/auth/callback/credentials`), se verifica el password con `bcryptjs`. Si es correcto, NextAuth inyecta en el JWT el `rol`, `cct` y `permisos`.
*   **Modificación**: Si agregas una nueva pestaña en el Admin, añade la llave de permiso en `src/lib/permissions.ts` y actualiza la DB (`schema.prisma > Admin > permisos (JSON)`).

### 4.2 Sistema OCR y Extracción de Datos Multimodal (Gemini Vision)
*   **Ubicación**: `src/lib/ocr-validator.ts` y `/api/expedientes/documentos/route.ts`.
*   **Funcionamiento**:
    1. Se descarga temporalmente de Cloudinary al servidor.
    2. Se convierte a buffer y se detecta el MimeType.
    3. Se arma un prompt rígido exigiendo respuesta en JSON.
    4. Gemini Vision analiza el documento (ej. extrae TODAS las Claves Presupuestales si es COMPROBANTE_PAGO).
    5. El backend intercepta el JSON y actualiza la DB automáticamente.
*   **Actualización**: Edita `systemInstruction` y expande `responseSchema` en `src/lib/ocr-validator.ts`.

### 4.3 Sistema de Pre-Revisión Textual, Evaluación Multiparte y Chat Contextual
*   **Ubicación**: `src/lib/pre-revision.ts`, `src/lib/gemini.ts`, `/api/entregas/[id]/chat/route.ts`.
*   **Pre-revisión en 3 Partes**: Documentos largos (PMC, PAEC-PEC, etc.) se dividen en 3 secciones temáticas para evitar timeouts de Vercel y recortes por ventana de contexto.
*   **Chat Asistente**: La API recupera el historial de mensajes (`ChatMensaje`) y el JSON de la Pre-revisión. Se concatena un System Prompt con la rúbrica y observaciones. Respuesta en tiempo real al frontend.

### 4.4 Generador de Códigos CVD y Firmas SHA-256 (Trazabilidad)
*   **Ubicación**: Lógica al aprobar documentos y en la visualización de formatos.
*   **Funcionamiento**: Hash SHA-256 combinando ID de escuela, fecha y un salt secreto. Se genera una URL de validación pública con QR estampado en el PDF final.

### 4.5 Generación de Documentos Oficiales en Masa (Docxtemplater)
*   **Ubicación**: `src/app/api/expedientes/generar-oficios/`.
*   **Funcionamiento**: `docxtemplater` + `pizzip`. Lee machotes `.docx` con tags tipo `{DIRECTOR_NOMBRE}`, `{ATP1_CLAVE}`, `{FECHA}`. El backend carga autoridades desde `AutoridadesConfig`, cruza con `Personal` e inyecta variables. Comprime todo en `.zip` descargable.

### 4.6 Arquitectura de Orquestación de IA, Pool Multiproveedor y Rotación Round-Robin
*   **Ubicación**: `src/lib/gemini.ts`, `src/app/admin/_componentes/GestionLlavesIA.tsx`, `/api/admin/api-keys/probar/route.ts` y `schema.prisma` (`ApiKey`, `PreRevisionConfig`).
*   **Rotación Round-Robin**: Puntero anular `globalKeyPointerIndex` que rota entre llaves en cada llamada.
*   **Modelos Autorizados Exclusivos**:
    - **Predeterminado (Principal)**: `gemini-3.5-flash-lite`
    - **Reserva (Fallback)**: `gemini-3.1-flash-lite`
    - ⛔ **REGLA ESTRICTA**: Queda prohibido usar o solicitar modelos obsoletos o de alto costo como `gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-pro` o similares. Toda la plataforma (Pre-revisión, OCR, Horarios, Reportes y Planeaciones) debe operar exclusivamente con `gemini-3.5-flash-lite` (o `gemini-3.1-flash-lite`).
*   **Failover y Reactivación Automática**: Si una llave devuelve HTTP 429 transitorio, se salta y prueba la siguiente. Si una llave tiene 5+ errores graves, se desactiva y reactiva tras 60 minutos.

---

## 5. Módulos Nuevos (v3.0 - v3.1)

### 5.1 Módulo: Generador de Horarios IA

#### Rutas y Archivos
| Archivo | Descripción |
|---------|-------------|
| `src/app/director/horarios/page.tsx` | Página principal del generador (Server Component) |
| `src/app/director/horarios/HorariosClient.tsx` | Shell cliente que decide si mostrar el Wizard o el Editor |
| `src/app/director/_componentes/horarios/WizardConfiguracion.tsx` | Wizard de 3 pasos para configurar el horario |
| `src/app/director/_componentes/horarios/EditorHorarios.tsx` | Visor y editor del horario ya generado |
| `src/app/api/horarios/configuracion/route.ts` | API para guardar/leer/borrar configuración de grupos y cargas |
| `src/app/api/horarios/generar/route.ts` | API que invoca la IA para generar el horario sin empalmes |
| `src/app/api/horarios/catalogos/route.ts` | API para gestionar catálogos (docentes manuales, etc.) |

#### Flujo del Wizard (3 Pasos)

**Paso 1 — Estructura & Currículo**
- Selector de Modo:
  - **Semiautomático (SEP Bachillerato General)**: Pre-carga el Mapa Curricular Oficial MCCEMS 2025-2026 (UACs universales, Capacitaciones Laborales, FFE Optativas). Cada grupo tiene un selector de Formación Laboral y opciones FFE independientes.
  - **Manual Libre (Tecnológicos / CBTIS)**: El usuario escribe libremente los nombres de las asignaturas y sus horas semanales. **Clave técnica**: se usa `curriculoManualPorGrupo: Record<string, any[]>` con clave `"semestre_letra"` (ej. `"1_A"`, `"3_B"`). Si hay 2+ grupos, aparece una barra de **tabs** (Grupo A | Grupo B | Grupo C…) que permite configurar las asignaturas de cada grupo de forma completamente independiente.
- Número de grupos por grado (1–20). Se autogenera la letra oficial (A, B, C…).
- Jornada Escolar (5, 6, 7 u 8 horas diarias).

**Paso 2 — Plantilla Docente**
- Lista de docentes activos en la escuela.
- Cada docente tiene un campo de **Horas Oficiales de Nombramiento** (cargado automáticamente desde `Personal.horasOficiales` en la DB).
- Permite agregar docentes directamente desde los expedientes de la plataforma (botón "Usar Expedientes") o crear docentes manuales.
- El sistema deshabilita la asignación de materias a docentes que ya superaron sus horas contratadas.

**Paso 3 — Matriz de Asignación Docente por Semestre**
- Muestra todos los grupos y sus UACs/asignaturas.
- Para cada celda (UAC × Grupo), el director selecciona el docente responsable de un `<select>`.
- Las opciones con exceso de horas se deshabilitan automáticamente.
- Contador en tiempo real: Horas Asignadas vs Horas Totales Requeridas del plantel.
- Botón **"Generar Horarios con IA"**: envía la configuración completa a la API que construye el horario sin empalmes usando lógica de restricciones.
- Botón **"Limpiar Datos"**: borra todas las cargas docentes y horarios generados de la DB (para empezar de cero).

#### Descarga de Horarios
- **Por Grupo (PDF)**: incluye nombre completo de asignaturas, horario de lunes a viernes.
- **Por Docente (PDF)**: horario personal de un único docente con todas sus horas.
- **Todos los Docentes (lote)**: descarga masiva en un solo clic.
- **Excel**: exportación de la matriz completa.

#### Campo `horasOficiales` en Modelo `Personal` (Prisma)
```prisma
model Personal {
  ...
  fechaIngreso      DateTime?
  clavePresupuestal String?
  horasOficiales    Int       @default(20)   // ← NUEVO en v3.0
  orden             Int       @default(0)
  ...
}
```
Este campo se carga automáticamente en el Paso 2 del Wizard para evitar inconsistencias entre lo que el director escribe manualmente y el nombramiento oficial del docente.

#### Variables de LocalStorage (v4)
El Wizard persiste su estado en `localStorage` con clave `horarios_wizard_v4_${escuelaId}`. Guarda: `paso`, `numGruposPorGrado`, `numPeriodos`, `grupos`, `horasDocentes`, `curriculoManualPorGrupo`, `grupoActivoManual`. Las **cargas (asignaciones docente-materia)** se excluyen del localStorage para evitar datos fantasma entre sesiones.

> ⚠️ **Nota de versión**: Si se cambia la estructura de datos del Wizard, hay que incrementar el sufijo de versión (`v4` → `v5`, etc.) para forzar la limpieza del caché viejo en los navegadores de los usuarios.

---

### 5.2 Módulo: Matriz de Control de Programas y Módulos por Escuela

#### Ubicación
`src/app/admin/_componentes/GestionEscuelas.tsx` — pestaña **"Programas y Módulos por Escuela"**

#### Descripción
Tabla-matriz donde:
- Cada **fila** representa una escuela de la zona.
- Cada **columna** representa un módulo del sistema (Horarios IA, PMC, PAEC-PEC, y cualquier programa nuevo).

#### Comportamiento de los Toggles
- **Toggle individual por escuela**: Activa/desactiva un módulo para una sola escuela. Optimistic UI update (cambia el color inmediatamente, luego hace el POST al API `/api/escuelas/${escuelaId}`).
- **Botón maestro por columna** (en el encabezado): Activa/desactiva un módulo para TODAS las escuelas en un solo clic. Usa el endpoint `/api/admin/escuelas/masivo-permisos`. **Importante**: después de la respuesta exitosa se actualiza el estado local directamente (`setEscuelas`) en lugar de llamar a `router.refresh()` (que no resetea `useState` en Client Components).

#### Endpoint Masivo
`POST /api/admin/escuelas/masivo-permisos`

Cuerpo de solicitud:
```json
{
  "tipo": "HORARIOS_IA" | "PLANEACIONES_IA" | "PROGRAMA",
  "accion": "ACTIVAR_TODOS" | "DESACTIVAR_TODOS",
  "programaNombre": "string (solo si tipo=PROGRAMA)"
}
```

#### Persistencia de Permisos en la DB
Los permisos se almacenan como JSON en el campo `permisos` de `Escuela`:
```json
{
  "horariosDesactivado": false,
  "planeacionesDesactivado": false,
  "programasInactivos": ["PMC", "PAEC-PEC"]
}
```

#### Propagación Automática de Nuevos Programas
Cuando el administrador crea un nuevo programa en "Programas y Módulos", automáticamente aparece como una nueva columna en la tabla de escuelas. No se requiere intervención manual.

#### Visibilidad de módulos en el Portal del Director
- Si `horariosDesactivado === true`, el Generador de Horarios desaparece del portal.
- Si `planeacionesDesactivado === true`, la Revisión de Planeaciones desaparece del portal.
- Ambas condiciones se consultan en `src/app/director/page.tsx` junto con la configuración global del módulo (`HorariosConfig`, `PlaneacionesConfig`).

---

### 5.4 Módulo: Revisión de Planeaciones Didácticas con IA (v3.3)

Implementado en julio 2026. Permite a los directores subir planeaciones didácticas de sus docentes y recibir retroalimentación automática generada por IA con base en el Anexo 12 USICAMM.

#### Rutas y Archivos
| Archivo | Descripción |
|---------|-------------|
| `src/lib/planeaciones-evaluator.ts` | Motor de IA: prompt engineering, criterios Anexo 12, llamada a `callGemini()` |
| `src/app/api/director/planeaciones/route.ts` | GET (lista + requisitos) / POST (sube y lanza revisión IA asíncrona) |
| `src/app/api/director/planeaciones/[id]/route.ts` | GET (detalle) / DELETE (eliminar) |
| `src/app/api/admin/planeaciones-config/route.ts` | GET/POST para que el admin active/desactive globalmente |
| `src/app/director/_componentes/planeaciones/GestionPlaneaciones.tsx` | UI del director: subida, listado, dictámenes, descarga Word |
| `src/app/admin/_componentes/GestionEscuelas.tsx` | Columna "📋 Planeaciones IA" en la Matriz de Módulos |

#### Estructura de Grupos por Escuela y Catálogo MCCEMS 2025-2026 (v3.4 - Actualizado v3.6)
- **Estructura de Grupos en `Escuela` (`gruposPrimerAno`, `gruposSegundoAno`, `gruposTercerAno`)**: Define la cantidad de grupos por año lectivo (ej. `3-3-3` = 3 grupos de 1.º/2.º semestre, 3 de 3.er/4.º semestre, 3 de 5.º/6.º semestre).
- **Catálogo Maestro Oficial**: Exactamente **203 Asignaturas / UACs totales** (correspondientes a **201 programas de estudio** debido a que *Actividades Artísticas y Culturales I y II* comparten el mismo programa de estudio, al igual que *Actividades Físicas y Deportivas I y II*).
- **Desglose de las 203 UACs**:
  1. **Currículum Fundamental**: 27 UACs (1.º a 6.º semestre).
  2. **Currículum Ampliado (Socioemocionales)**: 7 UACs (1.º a 5.º semestre).
  3. **FFEO (Obligatorias)**: 9 UACs (1.º a 6.º semestre).
  4. **FFE Optativas**: 40 UACs (20 en 5.º y 20 en 6.º semestre).
  5. **Currículum Laboral**: 120 Submódulos oficiales exactos (15 Capacitaciones × 8 submódulos por capacitación de 3.º a 6.º semestre).
- **Semestres A / B**:
  - **Semestre A**: 1.º, 3.er y 5.º Semestres.
  - **Semestre B**: 2.º, 4.º y 6.º Semestres.
- **Formaciones Laborales (15 Capacitaciones BGE Puebla)**: Cada grupo de 3.er y 5.º Semestre tiene asignada su Capacitación Laboral (Administración, Tecnología Informática, Redes y Mantenimiento, Área de la Salud, etc.), resolviendo automáticamente los 2 submódulos oficiales de esa capacitación por semestre (8 submódulos totales por capacitación).

#### Modelos Prisma Nuevos
```prisma
model PlaneacionesConfig {
  id              String   @id @default("singleton")
  activoGlobal    Boolean  @default(false)   // El admin activa/desactiva el módulo para todos
  requierePaecPec Boolean  @default(true)    // ← CANDADO: Sin PAEC-PEC no se puede usar
  requiereApiKey  Boolean  @default(true)
}

model PlaneacionDidactica {
  id                      String   @id @default(cuid())
  escuelaId               String
  cct                     String
  docenteNombre           String
  asignatura              String
  semestre                Int
  estado                  String   // PENDIENTE | EN_REVISION | REVISADO | ERROR
  archivoUrl              String
  puntajeObtenido         Int?
  puntajeMaximo           Int?
  nivelCumplimiento       String?  // COMPLETO | PARCIAL | REQUIERE_CORRECCION
  retroalimentacionDocente String?
  resultadoJson           Json?
  observacionesJson       Json?
  revisadoPor             String?
  fechaRevision           DateTime?
  fechaSubida             DateTime @default(now())
  escuela                 Escuela  @relation(fields: [escuelaId], references: [id])
}
```

#### Flujo de Revisión IA
1. Director sube PDF/DOCX de planeación en `GestionPlaneaciones.tsx`.
2. El POST sube el archivo a Cloudinary, crea el registro con `estado: EN_REVISION`.
3. Se lanza `revisarPlaneacionEnBackground()` (sin `await`) → respuesta rápida al frontend.
4. El background: descarga el PDF con `fetch()`, determina el tipo de evaluación (sem 1-4 / 5-6 / Laboral), llama a `evaluarPlaneacion()` → `callGemini()` con el buffer del PDF + prompt del Anexo 12.
5. Al terminar, actualiza el registro con el JSON de resultados y `estado: REVISADO`.
6. El director puede descargar la retroalimentación como `.docx` formal.

#### Tipos de Evaluación (según semestre)
| Tipo | Semestres | Rúbrica | Términos |
|------|-----------|---------|----------|
| `FUNDAMENTAL_1_4` | 1° – 4° | Anexo 12 CC 1-4 | Propósitos Formativos, Contenidos |
| `FUNDAMENTAL_5_6` | 5° – 6° | Anexo 12 CC 5-6 | Progresiones, Categorías, Metas |
| `LABORAL` | Cualquiera | Guía Retroalimentación Laboral | Competencias Laborales |

#### Candado de PAEC-PEC (REGLA CRÍTICA)
> ⚠️ Si la escuela **no ha subido su PAEC-PEC** (en cualquier estado distinto a `PENDIENTE`/`NO_ENTREGADO`), el módulo queda **completamente bloqueado** para esa escuela. La UI muestra un banner con el mensaje: *"Para usar la Revisión de Planeaciones Didácticas es obligatorio haber subido el PAEC-PEC de tu escuela."*

#### Control de Acceso por Nivel
| Nivel | Control |
|-------|---------|
| **Global** | `PlaneacionesConfig.activoGlobal` (el admin activa/desactiva para todos) |
| **Por escuela** | `Escuela.permisos.planeacionesDesactivado` (toggle en Matriz de Módulos) |
| **Por requisito** | `PlaneacionesConfig.requierePaecPec` + existencia de entrega PAEC-PEC |
| **Modo Pruebas (Admin)** | `PlaneacionesConfig.modoSinRestricciones` / `PreRevisionConfig.modoSinRestriccionesHorarios` (Omite todas las restricciones de PAEC-PEC, API Key y permisos para pruebas rápidas) |

#### Modelos Autorizados para Evaluación
- **Principal**: `gemini-3.5-flash-lite` (configurado en `PreRevisionConfig.modelDefault`)
- **Reserva**: `gemini-3.1-flash-lite`
- ⛔ NO usar `gemini-1.5-flash`, `gemini-2.0-flash` ni ningún modelo de costo elevado.


### 5.3 Módulo: Reporte de Cumplimiento con IA (v3.2)

Implementado en julio 2026. Reemplaza el antiguo reporte estático del botón "Descargar Reporte Final (Word)" con un sistema completo de análisis narrativo generado por IA.

#### Rutas y Archivos
| Archivo | Descripción |
|---------|-------------|
| `src/app/api/admin/reporte-cumplimiento/route.ts` | **[NUEVO]** API que consulta la BD, clasifica documentos y llama a la IA |
| `src/app/api/admin/ranking/route.ts` | **[MODIFICADO]** Agrega campos de breakdown y corrige el orden del ranking |
| `src/app/admin/_componentes/RankingEscuelas.tsx` | **[MODIFICADO]** Indicadores visuales + botón con IA + Word generado en cliente |

#### Distinción Crítica de Tipos de Incumplimiento

El sistema diferencia explícitamente dos situaciones con distinta severidad:

| Tipo | Estado en BD | Significado | Severidad | Lenguaje en el reporte |
|------|-------------|-------------|-----------|----------------------|
| **TIPO A** | `REQUIERE_CORRECCION` | La escuela SÍ entregó el documento, el ATP señaló correcciones que el director NO ha atendido | Moderada | "entregó el documento, sin embargo las correcciones no han sido atendidas" |
| **TIPO B** | `PENDIENTE`, `NO_ENTREGADO`, `NO_APROBADO` | La escuela NUNCA presentó el documento | **Grave** — penalización | "no fue presentado en ningún momento", "incumplimiento total", "el plantel adeuda completamente" |

> ⚠️ **Regla de negocio**: TIPO A y TIPO B **no son equivalentes**. Una escuela que entregó pero no corrigió es MENOS grave que una que nunca entregó. Esta distinción se refleja tanto en el ranking (posición) como en el Word (narrativa y color de tabla).

#### API: `GET /api/admin/reporte-cumplimiento`

**Proceso interno:**
1. Consulta todas las escuelas con entregas del ciclo activo (incluyendo `programa.nombre` y `correcciones` vía Prisma includes).
2. Clasifica cada documento:
   - `APROBADO` / `ENTREGADO_FISICO` → aprobados
   - `EN_REVISION` → en revisión (pendiente de dictamen ATP)
   - `REQUIERE_CORRECCION` → **TIPO A** (`docsConCorreccionesPendientes`)
   - `PENDIENTE` / `NO_ENTREGADO` / `NO_APROBADO` → **TIPO B** (`docsNoEntregados`)
   - `EXENTO` → excluido del cálculo
3. Calcula cumplimiento, medalla y ordenamiento.
4. Construye un prompt textual con datos de cada escuela, indicando explícitamente el tipo de incumplimiento y su gravedad.
5. Llama a `callGemini()` con el pool de llaves configurado en la plataforma.
6. Si la IA falla, genera narrativas de respaldo con `generarNarrativaFallback()`.
7. Retorna JSON con: `escuelas`, `narrativaPorEscuela`, `observacionesGenerales`, `conclusion`, `resumen`.

**Respuesta JSON (esquema):**
```typescript
{
  cicloNombre: string,
  fechaGeneracion: string,        // ISO
  supervisor: string,
  atpNombre: string,
  escuelas: EscuelaData[],
  narrativaPorEscuela: { cct: string; narrativa: string }[],
  observacionesGenerales: string,
  conclusion: string,
  resumen: {
    total: number,
    conOro: number, conPlata: number, conBronce: number, sinMedalla: number,
    conCorreccionesPendientes: number,  // escuelas con TIPO A
    conDocsNoEntregados: number,        // escuelas con TIPO B
    ningunoATiempo: boolean,
    promedioZona: number
  }
}
```

**Configuración de timeout:** `export const maxDuration = 60;` para permitir hasta 60 segundos en Vercel (necesario para la llamada IA con 17+ escuelas).

#### Prompt Engineering (Sistema de IA)

El `SYSTEM_INSTRUCTION` distingue explícitamente los dos tipos:

```
TIPO A — ENTREGÓ PERO NO ATENDIÓ CORRECCIONES:
  Severidad: MODERADA — entregó, pero el expediente quedó con observaciones.
  Redacción: "presentó el documento, sin embargo las correcciones no han sido atendidas"

TIPO B — NUNCA ENTREGÓ:
  Severidad: GRAVE — incumplimiento total.
  Redacción: "no fue presentado en ningún momento", "adeuda completamente"
```

El prompt de usuario envía los datos estructurados de cada escuela con marcadores explícitos:
```
--- TIPO A: ENTREGÓ PERO NO ATENDIÓ CORRECCIONES (1 documento) ---
   * Informe de Diagnóstico | Observación ATP: "Faltan gráficas de la sección 3"

--- TIPO B: NUNCA ENTREGÓ — INCUMPLIMIENTO TOTAL (2 documentos) ---
   * PAEC-PEC [NO_ENTREGADO] ← NO presentado en ningún momento
   * Plan de Mejora Continua [PENDIENTE] ← NO presentado en ningún momento
```

#### Corrección del Ranking (`ranking/route.ts`)

Se agregaron dos campos nuevos a cada elemento del ranking:
```typescript
docsConCorreccionesPendientes: number  // TIPO A: entregó pero no corrigió
docsNoEntregados: number               // TIPO B: nunca entregó (más grave)
```

**Nuevo orden de clasificación** (cuando el % de cumplimiento es igual):
1. Por medalla (ORO > PLATA > BRONCE > NINGUNA)
2. Por `cumplimiento` descendente
3. **Menos `docsNoEntregados` = mejor posición** (TIPO B penaliza el ranking)
4. Menos `docsConCorreccionesPendientes` (TIPO A penaliza menos)
5. Alfabético por nombre

**Ejemplo:** Dos escuelas con 87.5% de cumplimiento:
- Escuela A: 2 docs `REQUIERE_CORRECCION` → posición más alta
- Escuela B: 1 `REQUIERE_CORRECCION` + 1 `NO_ENTREGADO` → posición media
- Escuela C: 2 docs `NO_ENTREGADO` → posición más baja (Luis Donaldo Colosio)

#### Componente `RankingEscuelas.tsx`

**Cambios en la interfaz:**
```typescript
interface RankingItem {
  // ... campos existentes ...
  docsConCorreccionesPendientes: number;  // nuevo — TIPO A
  docsNoEntregados: number;               // nuevo — TIPO B
}
```

**Nueva columna "Estado de Entrega"** con etiquetas coloreadas:
- 🔴 Rojo `#fdecea` → nunca entregó (`docsNoEntregados > 0`)
- 🟠 Ámbar `#fffbeb` → sin corregir (`docsConCorreccionesPendientes > 0`)
- ✅ Verde → completo (ambos en 0)

**Botón "Descargar Reporte Final (Word)":**
- Muestra spinner con texto "Generando con IA..." mientras llama a `/api/admin/reporte-cumplimiento`
- Al recibir respuesta, llama a `buildWordReport(data)` en el cliente
- Descarga automáticamente el DOCX generado

#### Generador del Word (`buildWordReport`)

Función cliente que usa la librería `docx` para construir un documento con **8 secciones**:

| Sección | Contenido |
|---------|-----------|
| I | Datos de identificación (tabla) |
| II | Antecedentes y contexto (párrafos) |
| III | Resumen ejecutivo (tabla con estadísticas) |
| IV.1 | Tabla de escuelas con Medalla ORO (fondo dorado) |
| IV.2 | Tabla de escuelas con Medalla PLATA (fondo azul) |
| IV.3 | **TIPO A** — Entregaron sin corregir (fondo ámbar) |
| IV.4 | **TIPO B** — Nunca entregaron (fondo rojo) |
| V.A | Narrativas IA de planteles con cumplimiento completo |
| V.B | Narrativas IA de planteles con incumplimiento (con etiquetas de color) |
| VI | Observaciones y recomendaciones (párrafo IA) |
| VII | Conclusión (párrafo IA) |
| VIII | Firmas (tabla sin bordes, dos columnas: ATP y Supervisor) |

**Colores de tablas:**
```
ORO:    encabezado #B7860D / filas #FEF9C3, #FFFFF0
PLATA:  encabezado #2E5F9A / filas #D6E4F0, #EFF5FB
TIPO A: encabezado #C57B21 / filas #FEF3E2, #FFFBF5
TIPO B: encabezado #8B1A1A / filas #FDECEA, #FFF5F5
```

---

## 6. Historial de Bugs Corregidos (relevantes para futuros desarrollos)

### Bug: Toggle individual de Horarios IA (lógica invertida)
**Archivo**: `GestionEscuelas.tsx` — función `handleToggleHorariosEscuela`

**Causa**: El onClick pasaba `!horariosActivo` cuando debería pasar `horariosActivo`.
```tsx
// ❌ Incorrecto (bug)
onClick={() => handleToggleHorariosEscuela(esc.id, !horariosActivo)}

// ✅ Correcto
onClick={() => handleToggleHorariosEscuela(esc.id, horariosActivo)}
```
La función recibe `desactivado: boolean`. Si la escuela está activa (`horariosActivo = true`), hay que desactivarla (`desactivado = true`). Con `!horariosActivo` siempre se pasaba el valor incorrecto y el botón no cambiaba nada.

### Bug: Botones masivos no actualizaban la UI
**Archivo**: `GestionEscuelas.tsx` — función `handleAccionMasivaPermisos`

**Causa**: Después de un POST exitoso se llamaba `router.refresh()`. En Next.js App Router, `router.refresh()` re-renderiza Server Components pero **no resetea el `useState` de Client Components** que ya tienen datos cargados. El estado de la tabla permanecía igual aunque la DB sí se actualizaba.

**Solución**: Reemplazar `router.refresh()` por una actualización directa del estado local:
```tsx
// ❌ Incorrecto
if (data.success) { toast.success(...); router.refresh(); }

// ✅ Correcto
if (data.success) {
  toast.success(...);
  if (tipo === "HORARIOS_IA") {
    setEscuelas(prev => prev.map(e => ({ ...e, permisos: { ...e.permisos, horariosDesactivado } })));
  }
}
```

### Bug: Unique Constraint en `/api/horarios/configuracion`
**Error**: `PrismaClientKnownRequestError: Unique constraint failed on the fields: (escuelaId, nombre)`

**Causa**: Se intentaba hacer `upsert` de `HorarioGrupo` con una combinación de `escuelaId + nombre` que ya existía pero con un `id` diferente.

**Solución**: Usar `deleteMany` + `createMany` en lugar de `upsert` para grupos, garantizando idempotencia completa.

### Arquitectura: Modo Manual con currículo compartido (bug de diseño)
**Problema original**: El modo manual usaba 3 arrays compartidos (`materiasManualesSem1/3/5`) para TODOS los grupos. Con 2+ grupos, todos veían las mismas materias.

**Solución**: Cambio de estructura de datos a `curriculoManualPorGrupo: Record<string, any[]>` con clave `"semestre_letra"`. Así el Grupo A puede tener "Módulo de Mecatrónica" en 3er semestre mientras el Grupo B tiene "Módulo de Electrónica".

---

## 7. Modelos de Prisma Relevantes (actualizados)

```prisma
model Personal {
  id                String    @id @default(cuid())
  escuelaId         String
  nombre            String
  apellidoPaterno   String
  apellidoMaterno   String?
  cargo             String    // DOCENTE, DIRECTOR, ATP, APOYO_ADMINISTRATIVO, etc.
  rfcSinHomoclave   String?
  sexo              String    @default("MASCULINO")
  fechaIngreso      DateTime?
  clavePresupuestal String?
  horasOficiales    Int       @default(20)   // ← v3.0: horas de nombramiento oficial
  orden             Int       @default(0)
  escuela           Escuela   @relation(...)
  documentos        Documento[]
}

model Escuela {
  id           String   @id @default(cuid())
  cct          String   @unique
  nombre       String
  permisos     Json     @default("{}")  // horariosDesactivado, planeacionesDesactivado, programasInactivos
  // ... otros campos
}

model HorarioGrupo {
  id        String  @id @default(cuid())
  escuelaId String
  nombre    String  // "1° A", "3° B", etc.
  // Unique constraint: @@unique([escuelaId, nombre])
  escuela   Escuela @relation(...)
}
```

---

## 8. Asistente de Mapa Curricular, Formación Socioemocional y Bachilleratos Tecnológicos (v3.5)

### 8.1 Catálogo Oficial de Formación Socioemocional (Currículum Ampliado / FFEO)
Nombres exactos oficiales según el marco MCCEMS BGE Puebla:
1. `Educación para la Salud`
2. `Educación Integral en Sexualidad y Género`
3. `Práctica y Colaboración Ciudadana`

#### Regla de Asignación Estricta y No Repetición por Grupo (3.º a 6.º Semestre):
Para cada grupo (ej: Grupo A) a lo largo de los semestres 3.º, 4.º, 5.º y 6.º:
*   **3.er Semestre**: El Director elige **1 de las 3 asignaturas** (ej: *Educación para la Salud*).
    - **Bloqueo Total**: La asignatura elegida en 3.er semestre **NUNCA se puede seleccionar en 4.º, 5.º ni 6.º semestre**.
*   **5.º Semestre**: El Director elige **1 de las 2 asignaturas restantes** (ej: *Práctica y Colaboración Ciudadana*).
    - **Bloqueo Total**: La asignatura elegida en 5.º semestre **NUNCA se puede seleccionar en 3.er, 4.º ni 6.º semestre**.
*   **4.º y 6.º Semestre**: Se asigna automáticamente la **3.ª asignatura restante** (la que no fue seleccionada ni en 3.er ni en 5.º semestre).
    - **Coincidencia Exacta**: La asignatura asignada a 4.º semestre es **EXACTAMENTE LA MISMA** que se asigna a 6.º semestre.

#### Ejemplo de Distribución por Semestre para un Grupo:
Dadas las 3 asignaturas: `S1: Educación para la Salud`, `S2: Educación Integral en Sexualidad y Género`, `S3: Práctica y Colaboración Ciudadana`.
1. **3.er Semestre**: Director selecciona `S1: Educación para la Salud`.
2. **5.º Semestre**: Director selecciona `S3: Práctica y Colaboración Ciudadana`.
3. **4.º Semestre**: Sistema asigna automáticamente `S2: Educación Integral en Sexualidad y Género`.
4. **6.º Semestre**: Sistema asigna automáticamente `S2: Educación Integral en Sexualidad y Género` (misma que en 4.º semestre).

#### Función Helpers de Resolución:
*   **Frontend / Helpers**: `resolverSocioemocionalGrupo(socioemocionalSem3, socioemocionalSem5)` en `src/lib/escuela-grupos.ts`.

### 8.2 Optativas FFE Categorizadas por Cuadros (5.º Semestre BGE)
Las Optativas de Formación Formativa Extendida (FFE) están divididas en 2 bloques independientes:

#### Bloque 1: Recursos Sociocognitivos (Optativas 1 y 2)
1. `Comunicación y Sociedad I`
2. `Raíces Etimológicas del Español I`
3. `Inglés V (Avanzado)`
4. `Taller de Pensamiento Variacional I`
5. `Dibujo Técnico I`
6. `Pensamiento Matemático Aplicado a las Finanzas I`
7. `Taller de Probabilidad y Estadística I`

#### Bloque 2: Áreas de Conocimiento (Optativas 3 y 4)
1. `Salud Integral I`
2. `Análisis de Fenómenos y Procesos Biológicos`
3. `Análisis de Fenómenos Físicos I`
4. `Organización del Flujo de Materia y Energía en los Organismos I`
5. `Fundamentos de Administración I`
6. `Procesos Contables I`
7. `Derecho y Sociedad I`
8. `Economía I. La Función de los Agentes Económicos en la Sociedad`
9. `Temas Selectos de Ciencias Sociales I`
10. `Psicología I`
11. `Arte y Cultura I`
12. `Lógica y Pensamiento Crítico`
13. `Pensamiento Filosófico I`

### 8.3 Estructura de Datos para Bachilleratos Tecnológicos (CBTIS / DGETI / CBTa / CECYTE)
Basado en la Estructura Curricular Oficial del Bachillerato Tecnológico (Subsecretaría de Educación Media Superior):
*   **`Escuela.tipoBachillerato`**: `BACHILLERATO_GENERAL` vs `BACHILLERATO_TECNOLOGICO`.
*   **`Escuela.trayectoTecnologico`** / **`HorarioGrupo.trayectoTecnologico`**:
    - `FISICO_MATEMATICAS` (Temas de Física, Dibujo Técnico, Matemáticas Aplicadas).
    - `ECONOMICO_ADMINISTRATIVA` (Temas de Administración, Introducción a la Economía, Introducción al Derecho).
    - `QUIMICO_BIOLOGICA` (Introducción a la Bioquímica, Temas de Biología Contemporánea, Temas de Ciencias de la Salud).
    - `HUMANIDADES_Y_CIENCIAS_SOCIALES` (Temas de Ciencias Sociales, Literatura, Historia, Otras).
*   **`CarreraTecnica` (Modelo Prisma)**:
    - `modulo1`: Módulo I (Semestre 2, 17 hrs).
    - `modulo2`: Módulo II (Semestre 3, 17 hrs).
    - `modulo3`: Módulo III (Semestre 4, 17 hrs).
    - `modulo4`: Módulo IV (Semestre 5, 12 hrs).
    - `modulo5`: Módulo V (Semestre 6, 12 hrs).

---

*Este manual debe ser consultado y actualizado cada vez que se realicen modificaciones a la arquitectura profunda o se añadan nuevos modelos Prisma.*

*Última actualización: Julio 2026 — v3.5 — Mapa Curricular MCCEMS BGE, Categorías FFE, Socioemocional y Bachilleratos Tecnológicos integrados.*

---

## 9. Módulos Nuevos y Correcciones Críticas (v3.6 — Julio 2026)

### 9.1 Sistema de Guardia de Sesiones en Modo Mantenimiento (`MantenimientoListener`)

**Problema resuelto**: Si el Administrador activaba el Modo Mantenimiento, los usuarios ya autenticados podían seguir navegando sin enterarse.

**Implementación**:
- **Componente**: `src/components/MantenimientoListener.tsx` — Componente cliente montado en `RootLayout` (global para toda la aplicación).
- **API**: `GET /api/mantenimiento-status` — Retorna `{ mantenimiento: boolean, bloquear: boolean }`. Los Administradores y Escuelas de Prueba tienen `bloquear: false` incluso en mantenimiento.
- **Comportamiento**: El componente sondea el endpoint cada 15 segundos. Si `bloquear === true`, muestra un overlay de pantalla completa no cerrable y redirige a `/mantenimiento` en 2.5 segundos.
- **Protección a nivel API**: `POST /api/escuelas/[id]/mapa-curricular` retorna HTTP 503 durante mantenimiento para usuarios no exentos.

### 9.2 Reorganización de Sidebar — Sección "🤖 Herramientas IA"

**Portal del Director** (`src/app/director/DirectorPortal.tsx`):
- Se creó la sección **"🤖 Herramientas IA"** en el sidebar lateral, que agrupa:
  - 📅 **Generador de Horarios IA** (enlace a `/director/horarios`, visible solo si `isHorariosActive`)
  - 📋 **Revisión de Planeaciones IA** (tab interna, visible solo si `isPlaneacionesActive`)
  - 🔑 **Ajustes de API IA** (tab interna, movida desde "Ajustes")
- **Detección automática de configuración pendiente**: Al cargar el portal, se verifica si el director tiene API Key y Mapa Curricular configurados. Si falta alguno, aparece una alerta naranja en la sección de Herramientas IA con mensaje específico de lo que falta.
- Si ninguna herramienta IA está activa (`isHorariosActive === false` y `isPlaneacionesActive === false`), el botón de Ajustes de API se mueve a una sección "Ajustes" clásica para no perder la funcionalidad.

### 9.3 Corrección Crítica: WizardConfiguracion no Cargaba Datos del Mapa Curricular (BD)

**Causa Raíz**: El `useEffect` `generarGruposSegunEstructura(g1, g2, g3)` se ejecutaba en cada render y sobreescribía los grupos con valores predeterminados, ignorando los `gruposIniciales` recibidos desde la BD. Además, el match de nombres de grupo fallaba porque la DB usa `º` (ordinal masculino Unicode U+00BA) pero el código generaba `°` (símbolo de grado Unicode U+00B0).

**Correcciones en `WizardConfiguracion.tsx`**:
1. **Prioridad BD**: Se agregó `useEffect` con `inicializadoDesdeBD` flag. Si llegan `gruposIniciales` con datos reales, se cargan directamente en el estado sin pasar por la función de generación automática.
2. **Flag de cambio manual** (`usuarioCambioGrupos`): La función `generarGruposSegunEstructura` solo se invoca cuando el usuario cambia explícitamente el número de grupos desde los inputs del formulario, **no** durante la inicialización.
3. **Normalización de símbolo** (`normalizarNombreGrupo`): Al buscar grupos existentes, se normalizan ambos caracteres (`º` → `°`) para garantizar coincidencias exactas.
4. **Parseo de `ffeOptativas`**: Si el campo llega como string JSON de Prisma, se parsea automáticamente.

> ⚠️ **REGLA ESTRICTA DE CONSISTENCIA**: Los nombres de grupos en la BD se almacenan con `°` (U+00B0, símbolo de grado). La función `generarGruposSegunEstructura` genera nombres con `°`. Al leer de la BD, siempre normalizar con `replace(/º/g, '°')` antes de comparar.

### 9.4 Corrección: `AdminHorariosClient.tsx` — Prop `gruposIniciales` Faltante

En `src/app/admin/horarios/AdminHorariosClient.tsx`, el componente `<ModalConfiguracionMapaCurricular>` no recibía la prop `gruposIniciales`. Sin ella, el modal siempre abría con valores predeterminados ignorando la configuración guardada. **Corrección**: se pasó `gruposIniciales={grupos}` correctamente.

### 9.5 Persistencia de Mapa Curricular — Parseo Robusto en Modal

En `src/components/ModalConfiguracionMapaCurricular.tsx`:
- `ffeOptativas` puede llegar de Prisma como `string[]` (arreglo JS) o `string` (JSON stringificado). Se agregó parseo automático con `JSON.parse` + fallback.
- Las claves del `initialMap` se normalizan con doble entrada (`g.nombre` y `g.nombre.replace("º", "°")`) para garantizar recuperación correcta.
- El `useEffect` de inicialización usa un guard `initialized` para evitar sobreescritura en re-renders.

### 9.6 Corrección Crítica: Resolución de Asignaturas Socioemocionales en 5.º Semestre (`resolverSocioemocionalGrupo`)

**Problema resuelto**: En la sección de Planeaciones Didácticas (`GestionPlaneaciones.tsx`), las asignaturas socioemocionales del 5.º semestre (ej. *Educación para la Salud*) no cargaban el docente asignado desde el generador de horarios, mostrando `-- Seleccionar Docente --`.

**Causa Raíz**: 
La función `resolverSocioemocionalGrupo(socio3, socio5)` en `src/lib/escuela-grupos.ts` asumía por defecto que si `socio3` (3.er semestre) no estaba definido en la DB, tomaba la primera opción de la lista (`Educación para la Salud`). Cuando el 5.º semestre tenía asignado explícitamente `Educación para la Salud` en el generador de horarios, la función filtraba esa asignatura creyendo que ya había sido tomada en 3.er semestre, sobrescribiendo el 5.º semestre a `Educación Integral en Sexualidad y Género`. Al no coincidir el nombre de la materia devuelto por `obtenerAsignaturasParaGrupo` con el registrado en `HorarioCargaDocente`, la interfaz no mostraba el docente asignado.

**Solución Implementada**:
1. **Refactor de `resolverSocioemocionalGrupo`**: Prioriza elecciones explícitas. Si `socioemocionalSem5` está definido explícitamente y `socioemocionalSem3` no lo está, la función respeta la elección de 5.º semestre y ajusta 3.er semestre con una de las opciones restantes.
2. **Match flexible de ordinales**: En `GestionPlaneaciones.tsx`, la búsqueda de `hGrupo3` y `hGrupo5` en `gruposDB` ahora contempla tanto `°` (U+00B0) como `º` (U+00BA) y hace fallback a `hGrupo.ffeoSocioemocional`.

### 9.7 Corrección Crítica: Evaluación IA Incompleta en Vercel Serverless (`revisarPlaneacionEnBackground`)

**Problema resuelto**: Al subir una planeación en Vercel y hacer clic en *Enviar a Revisión IA*, la entrega se quedaba congelada indefinidamente en estado `⏳ Analizando...`.

**Causa Raíz**: 
En la arquitectura Serverless de Vercel (AWS Lambda), cuando una API Route ejecuta una función asíncrona sin `await` (`revisarPlaneacionEnBackground(...)`) y retorna inmediatamente `NextResponse.json(...)`, Vercel congela/elimina la instancia del contenedor de forma instantánea. Esto cortaba el proceso de llamada a Gemini antes de completar la evaluación y guardar el resultado en BD.

**Solución Implementada**:
Se agregó `await` a `revisarPlaneacionEnBackground(...)` dentro de `POST /api/director/planeaciones/route.ts`. Dado que la ruta cuenta con `export const maxDuration = 60;`, la ejecución completa de Gemini (~5 a 10 segundos) corre de forma síncrona dentro del margen permitido por Vercel, retornando la respuesta con el estado `REVISADO` y dictamen completo.

### 9.8 Soporte Completo para Semestre B (2.º, 4.º y 6.º Semestre)

**Descripción del Requisito**:
El generador de horarios (`WizardConfiguracion.tsx`) estaba limitado únicamente a configurar los semestres impares (Semestre A: 1.º, 3.º, 5.º). No existía forma de generar u obtener la carga horaria y materias para los semestres pares (Semestre B: 2.º, 4.º, 6.º).

**Solución Implementada**:
1. **Selector de Período Semestral (`periodoActivo`)**:
   - En el Paso 1 de `WizardConfiguracion.tsx`, se incluyó un selector con dos modos:
     - 📘 **Semestre A**: Configura semestres 1.º, 3.º y 5.º (Agosto - Enero).
     - 📗 **Semestre B**: Configura semestres 2.º, 4.º y 6.º (Febrero - Julio).
   - El estado `periodoActivo` ("A" | "B") se persiste automáticamente en `localStorage` y en el estado global.
2. **Generación Adaptativa de Grupos (`generarGruposSegunEstructura`)**:
   - Al seleccionar Semestre B, los grupos generados corresponden a `2°`, `4°` y `6°` en lugar de `1°`, `3°` y `5°`.
3. **Currículum por Defecto de Semestre B (`getDefaultMateriasSem` & `getUACsIndividualesGrupo`)**:
   - Se registraron todas las UACs correspondientes a 2.º semestre (*Ciencias II, Pensamiento Matemático II, Humanidades II, etc.*), 4.º semestre (*Física II, Cálculo Integral, Módulos Profesional I-B, etc.*) y 6.º semestre (*Estadística, Módulos II-B, etc.*).
4. **Visualización Dinámica de Tracks y Resumen de los 6 Semestres**:
   - Se ajustó el renderizado por letras/tracks ("A", "B", "C"...) y las tarjetas del formulario de configuración (`ModalConfiguracionMapaCurricular.tsx`) para incluir un bloque **📗 Vista Previa del Semestre B Correspondiente** (4.º y 6.º semestre) en cada tarjeta de grupo.
   - El director visualiza la trayectoria completa de los **6 semestres** del ciclo escolar: las selecciones activas de 3.er y 5.º semestre junto con la derivación automática de 2.º, 4.º y 6.º semestre (Submódulos laborales 3, 4, 5 y 6, asignatura socioemocional calculada y optativas FFE).

---

### 9.9 Persistencia del Mapa Curricular, Herencia de Semestre B en Planeaciones, Fix Borrado 404 y NAVEGACIÓN UNIFICADA DE 4 PASOS (v4.1)

**Descripción de los Ajustes Realizados**:
1. **Persistencia Real y Prioridad de la BD sobre Valores por Defecto (`WizardConfiguracion.tsx`)**:
   - Se corrigió el bug por el cual el Paso 1 cargaba los valores por defecto (`Administración`) al abrir el Wizard o pulsar "Reconfigurar".
   - `useEffect` en `WizardConfiguracion` ahora realiza un *merge* directo donde los datos guardados en la base de datos (`gruposIniciales`: `Comunicación Gráfica`, optativas FFE, socioemocionales) tienen prioridad absoluta sobre los valores por defecto y sobre la caché antigua de `localStorage`.
2. **Herencia de Capacitación y Asignaturas para Semestre B en Planeaciones Didácticas (`GestionPlaneaciones.tsx`)**:
   - Se ajustó el mapeo de `hGrupo` en las tarjetas de grupos de `GestionPlaneaciones.tsx`.
   - Para grupos del Semestre B (ej. `4° A` y `6° A`), `GestionPlaneaciones` busca primero el grupo exacto o hereda directamente la capacitación (`Comunicación Gráfica`) y optativas desde sus grupos base del Semestre A (`3° A` y `5° A`).
   - Se utilizó `resolverSocioemocionalGrupo` para asignar la 3.ª asignatura socioemocional restante (`Educación Integral en Sexualidad y Género`), previniendo que `Educación para la Salud` se repitiera erróneamente en 4.º y 6.º semestre.
3. **Corrección de Borrado (Fix 404) y Botón de "Reintentar Dictamen IA" (`route.ts` & `GestionPlaneaciones.tsx`)**:
   - Se corrigió el handler `DELETE /api/director/planeaciones/[id]` para buscar y eliminar la planeación directamente por su ID único (`where: { id }`), resolviendo el error 404 reportado en Vercel logs.
   - Se agregó el handler `POST /api/director/planeaciones/[id]` para ejecutar la re-evaluación del dictamen con Gemini de forma asíncrona/síncrona.
   - En la interfaz de planeaciones, se agregó el botón **"🔄 Reintentar IA"** en cada fila para re-ejecutar el análisis sin necesidad de eliminar y re-subir el archivo.
4. **Navegación Unificada de 4 Pasos en Horarios (`HorariosClient.tsx` & `AdminHorariosClient.tsx`)**:
   - Se integró un **Stepper Header Unificado de 4 Pasos**:
     - `1️⃣ Estructura & Currículum`
     - `2️⃣ Plantilla Docente`
     - `3️⃣ Matriz por Semestre`
     - `4️⃣ Horario Generado (IA)`
   - El director o administrador puede cambiar libremente entre cualquier paso con un solo clic sin perder los datos cargados ni reiniciar la configuración.
5. **Filtrado por Semestre A / B en el Horario Generado (`EditorHorarios.tsx`)**:
   - Se agregó el selector de período `📅 Semestre A (1º, 3º, 5º)` y `📅 Semestre B (2º, 4º, 6º)` en el control de vistas del horario generado para alternar de forma inmediata la visualización de los grupos de semestres pares e impares.

---

### 9.10 Respeto a Selección BD de Formación Socioemocional y Limpieza de Encabezado Duplicado (v4.2)

**Descripción de la Causa Raíz y Solución**:
1. **Fix a la Sobrescritura de Formación Socioemocional (`WizardConfiguracion.tsx`)**:
   - **Causa Raíz**: En `generarGruposSegunEstructura`, al construir los grupos de Paso 1, `socioCalculado` se calculaba utilizando `resolverSocioemocionalGrupo` e insertaba directamente `ffeoSocioemocional: socioCalculado`, ignorando por completo la propiedad `grupoExistente?.ffeoSocioemocional` que contenía el valor guardado previamente en base de datos. Si `g5Socio` aún no estaba en el estado local, `resolverSocioemocionalGrupo` caía al valor por defecto (`Educación para la Salud`), destruyendo la selección hecha por el usuario en `ModalConfiguracionMapaCurricular` (`Educación Integral en Sexualidad y Género`).
   - **Solución Implementada**: Se definió `socioDbGuardado = grupoExistente?.ffeoSocioemocional || gruposIniciales.find(...)?.ffeoSocioemocional`. Si `socioDbGuardado` está presente, `socioCalculado` toma ese valor **prioritariamente**, asegurando que los datos guardados en la BD nunca sean suplantados por cálculos automáticos.

2. **Remoción de Encabezado Duplicado e Integración de "🗑️ Limpiar Datos" en Barra Superior (`HorariosClient.tsx`, `AdminHorariosClient.tsx` & `WizardConfiguracion.tsx`)**:
   - Se eliminó el bloque de tarjeta interna `Asistente de Configuración de Horario (SEP Puebla)` de `WizardConfiguracion.tsx` que duplicaba la barra de pasos (`1. Estructura & Currícu`, `2. Plantilla Docente`, `3. Matriz por Semestre`).
   - Se trasladó el botón `🗑️ Limpiar Datos` a la barra superior principal de acciones (junto a `🔄 Reiniciar Configuración`), manteniendo la interfaz limpia, minimalista y libre de redundancias.

---

*Versión actualizada: Agosto 2026 — v4.2*

---

### 9.11 Reglas de Privilegios Administrativos Super Admin, Sincronización de Estructura de Grupos y Feedback UX (v4.3)

**Principios y Reglas Fundamentales del Proyecto**:

1. **Privilegios Totales del Administrador Super Admin (`isAdmin === true`)**:
   - **Regla Estricta**: El usuario Administrador (`role === "admin"` / `isAdmin === true`) **NUNCA DEBE SER BLOQUEADO** por faltas de requisitos del plantel (como falta de API Key de Gemini, falta de PAEC-PEC o desactivación de toggles en la matriz de escuelas).
   - **Botón de Cerrar (✕) en Modales**: Todos los modales de configuración (incluyendo `ModalConfiguracionMapaCurricular`) DEBEN mostrar visiblemente el botón de cerrar `✕` cuando el usuario es Administrador (`isAdmin={true}`), incluso si el mapa curricular del plantel no ha sido marcado como completado (`forceObligatorio`).

2. **Fuente Única de Verdad para Estructura de Grupos por Grado**:
   - La estructura de grupos por grado (`gruposPrimerAno`, `gruposSegundoAno`, `gruposTercerAno`) configurada en `ModalConfiguracionMapaCurricular` se almacena en la tabla `Escuela` y `HorarioGrupo` de la base de datos PostgreSQL.
   - En la sección `Escuelas` del panel Admin (`GestionEscuelas.tsx`), la tarjeta `Estructura de Grupos por Grado / Año` sincroniza su estado automáticamente al consumir el endpoint `/api/horarios/configuracion?escuelaId=${id}`, evitando que muestre la estructura por defecto (`1-1-1`) cuando la escuela ya tiene guardada una estructura real (ej. `3-3-3`).

3. **Feedback Visual e Interactividad en Botones de Larga Ejecución**:
   - Todo botón o acción que realice llamadas asíncronas o de Inteligencia Artificial que tomen tiempo (como `Reintentar IA` o `Subir Planeación` en `GestionPlaneaciones.tsx`) DEBE mostrar una animación visual clara (icono girando con `animation: spin 1s linear infinite`), deshabilitar el botón (`disabled={true}`, `cursor: wait`) y cambiar su etiqueta de texto mientras se completa la operación para dar retroalimentación inmediata al usuario.

---

*Versión actualizada: Agosto 2026 — v4.3*

---

### 9.12 Motor de Reordenamiento Inteligente (Ripple Solver) y Persistencia de Cambios en Horarios (v4.4)

**Principios y Reglas de Edición de Horarios**:

1. **Garantía Anti-Desaparición y Reacomodo Inteligente en Cascada (Ripple Solver)**:
   - **Regla Estricta**: **NINGUNA CLASE O ASIGNATURA DEBE DESAPARECER O PERDERSE JAMÁS AL MOVERLA EN LA MATRIZ DE HORARIOS**. El número total de celdas en el horario es un invariante estricto.
   - **Motor Ripple Solver (`src/lib/horarios/ripple-solver.ts`)**: Al arrastrar una clase a una nueva casilla, el sistema ejecuta un algoritmo de reordenamiento inteligente por backtracking con heurística MRV.
   - Si la casilla destino está libre y sin empalmes, la reubica de forma directa.
   - Si la casilla destino o el horario del docente genera colisiones, el motor busca un reacomodo en cascada (ripple) de las demás asignaturas no fijadas del grupo y de otros grupos.
   - Si el movimiento es imposible de resolver sin colisiones ni violar celdas bloqueadas (🔒), el sistema **RECHAZA** el movimiento, mantiene el horario 100% intacto y notifica al usuario: *"⚠️ No es posible realizar este movimiento porque generaría una colisión de horarios imposible de resolver sin afectar clases fijadas."*

2. **Persistencia de Edición de Horarios ("💾 Guardar Cambios")**:
   - **Endpoint de Persistencia**: `POST /api/horarios/guardar` (`src/app/api/horarios/guardar/route.ts`).
   - Se agregó el botón **"💾 Guardar Cambios"** en la barra superior del visor de horarios (`EditorHorarios.tsx`). Al realizar cualquier ajuste manual o bloqueo con candado 🔒, el botón se activa (`(*) Cambios sin guardar`).
   - Al hacer clic en el botón, el sistema guarda permanentemente las nuevas posiciones `(diaSemana, periodo, esBloqueado)` de las celdas en la base de datos PostgreSQL en una transacción atómica.
   - Al recargar la página, cambiar entre el paso 3 y paso 4 o alternar de pestaña, los ajustes manuales del usuario se mantienen intactos y persistentes.

---

*Versión actualizada: Agosto 2026 — v4.4*

---

### 9.13 Respeto Estricto y Universal de Bloqueos en Horas Libres (v4.5)

**Regla de Bloqueos en Horas Vacías/Libres**:

1. **Inviolabilidad de Horas Libres Bloqueadas (🔒)**:
   - **Regla Estricta**: Cuando el director fija una hora libre con candado (🔒) en cualquiera de las vistas (`Por Grupo`, `Por Docente` o `Por Aula`), esa casilla de tiempo queda **ESTRICTAMENTE BLOQUEADA** para ese docente, grupo o aula.
   - La función `isSlotLibreBloqueadoParaCelda` en `src/lib/horarios/ripple-solver.ts` evalúa de forma unificada si la coordenada `(día, periodo)` está fijada en `slotsLibresBloqueados` para el `grupoId`, el `docenteId` o el `aulaId`.
   - **Prohibición Total de Colisiones**: Ni el movimiento manual por drag-and-drop ni el motor de reordenamiento inteligente en cascada (`Ripple Solver`) ni el Asistente IA pueden colocar materias en una hora libre bloqueada para el docente, grupo o aula.
   - **Persistencia Completa**: Los arreglos de `slotsLibresBloqueados` se persisten de forma permanente en PostgreSQL (`horarioGenerado.scoreMetricas.slotsLibresBloqueados`) y en `localStorage`, garantizando que se conserven al recargar la página o cambiar de pestaña.

---

### 9.14 Integración de Horas Libres Bloqueadas en Chat IA y Desbloqueo de Drag-and-Drop (v4.6)

**Regla de Integración del Chat IA con Restricciones Físicas**:

1. **Paso Directo de `slotsLibresBloqueados` al Solver de Restricciones**:
   - El endpoint `/api/horarios/chat` (`src/app/api/horarios/chat/route.ts`) extrae `slotsLibresBloqueados` desde `horario.scoreMetricas` y lo envía tanto a `procesarComandoIA` en `ai-assistant.ts` como al motor `resolverHorario` en `solver.ts`.
   - `resolverHorario` bloquea automáticamente en `ocupacionDocente`, `ocupacionGrupo` y `ocupacionAula` las coordenadas `(día, periodo, id)` pertenecientes a `slotsLibresBloqueados`.
   - **Garantía Total**: Al solicitar al Chat IA redistribuciones ("distribuir equitativamente", "1 hora al día", etc.), la IA **NUNCA** programará clases en las horas libres que el director bloqueó (ej. lunes de Samuel, viernes de Imelda, martes de Víctor).

2. **Desbloqueo de Movimiento Manual (Drag-and-Drop)**:
   - Dado que el Solver ya no coloca materias dentro de franjas bloqueadas como horas libres, el motor de reordenamiento inteligente (`ripple-solver.ts`) no detectará choques entre la posición inicial de las clases y `slotsLibresBloqueados`.
   - El usuario recupera el control manual 100% interactivo mediante Drag-and-Drop sin bloqueos espurios.

---

### 9.15 Asistente / Chatbot de Trámites y Normativa SEP (Motor RAG 24/7) (v4.7)

**Arquitectura RAG para Consultas Normativas**:

1. **Esquema de Base de Datos PostgreSQL**:
   - `DocumentoNormativo`: Almacena manuales, rubricas USICAMM, lineamientos PAEC/PEC, formatos CAPEMS, circulares oficiales y guías de horarios con metadatos (`categoria`, `titulo`, `descripcion`, `tags`, `contenidoTexto`, `archivoUrl`, `esOficial`).
   - `ChatTramitesMensaje`: Almacena el historial de consultas de usuarios y respuestas generadas por Gemini 3.5 con citas a fuentes oficiales.

2. **Motor RAG (`src/lib/tramites/rag-engine.ts`)**:
   - Analiza la consulta del docente o director contra los documentos normativos activos.
   - Pondera coincidencias léxicas/semánticas para inyectar el contexto normativo oficial más relevante en Gemini 3.5 Flash / Flash Lite.
   - Genera respuestas estructuradas que incluyen obligatoriamente el bloque `📌 **Fuente(s) Oficial(es) Consultada(s):**` con el título exacto de las normativas consultadas.

3. **Panel de Gestión de Normativas (`src/app/admin/_componentes/GestionNormativas.tsx`)**:
   - Accesible para la Supervisión/Administrador desde el menú lateral en "Biblioteca de Normativas SEP".
   - Soporta pestañas de navegación por categoría (`USICAMM`, `PAEC_PEC`, `CAPEMS`, `CIRCULARES`, `TRAMITES_SEP`, `HORARIOS_CURRICULO`), tarjetas descriptivas, extracción de texto de documentos y modal de edición.

4. **Widget Flotante Web (`src/components/ChatbotTramitesWidget.tsx`)**:
   - Integrado globalmente en `src/app/layout.tsx` para estar disponible 24/7 para directores y docentes en todas las secciones de la plataforma.
   - Diseñado siguiendo la identidad visual de SISAT-ATP (píldora azul `#2563eb`, tarjetas slate `#0f172a`, badges de fuentes citadas y preguntas sugeridas preconfiguradas).

---

### 9.16 Auditoría Inteligente & Descubrimiento de Procesos ATP (v5.0)

**Arquitectura de Ingesta Local Offline y Descubrimiento Semántico**:

1. **Esquema de Base de Datos Multi-Tenant en Neon PostgreSQL**:
   - `CuentaAuditoria`: Configuración administrable de cuenta de supervisión/auditoría (`email`, `nombreTitular`, `tipoFuente: CORPUS_LOCAL | MICROSOFT_GRAPH`, `directorioCorpus`). Cero hardcodes de correos o nombres en esquema de DB.
   - `EmailConversation`: 1,687 hilos de conversación agrupados y trazados con métricas de confianza, duración y participantes.
   - `EmailMessage`: 5,272 mensajes de correo (3,068 recibidos y 2,204 enviados) con hash SHA-256 de cuerpo, clasificación de origen/tipo, plazos y resúmenes semánticos IA (&le; 500 tokens).
   - `EmailAttachment`: 9,143 adjuntos catalogados con rutas relativas a disco (`Adjuntos/` y `Adjuntos_md/`), preservando espacio y garantizando privacidad sin almacenar blobs binarios en DB.
   - Modelos de Gobernanza y Automatización: `Process`, `Task`, `Discovery`, `Evidence`, `ProcesoCorreccion`, `ModulePlan`, `GapItem`, `SyncState`.
   - **Multi-Tenant Ready**: Todos los modelos indexados y particionados con `tenantId` (default `"zona004"` como valor de datos).

2. **Servicio Ingestor Local (`src/lib/discovery/local-ingestor.ts`)**:
   - Ingesta en batches de 500 registros desde `index.json`, `threads.json` y `analisis_semantico.json` en `C:\NotebookLM\BaseConocimiento`.
   - Duración de ingesta inicial: 25 segundos para el corpus completo de 5,272 correos y 9,143 adjuntos.
   - Aislamiento estricto de privacidad: Base de datos almacena únicamente metadatos, rutas relativas y análisis semánticos; el contenido masivo físico permanece seguro en disco.

3. **Endpoints y Controladores API**:
   - `/api/admin/auditoria/cuenta`: CRUD multi-tenant de configuración de cuenta y directorio de corpus.
   - `/api/admin/auditoria/ingestar-local`: Trigger de sincronización/re-ingesta del corpus local.
   - `/api/admin/auditoria/mensajes`: Consultas con paginación, filtros por bandeja, categorías, plazos y búsqueda full-text.
   - `/api/admin/auditoria/hilos`: Consulta de los 1,687 hilos con su historial cronológico de mensajes.

4. **Panel de Control Web (`src/app/admin/_componentes/AuditoriaInteligentePanel.tsx`)**:
   - Pestaña **Resumen Ejecutivo**: Métricas en tiempo real, desglose de correos por bandeja, hilos y adjuntos.
   - Pestaña **Explorador de Correos**: Búsqueda interactiva en los 5,272 correos con etiquetas de tipo, origen, badges de plazos detectados y resúmenes IA.
   - Pestaña **Hilos de Conversación**: Visualización de los 1,687 flujos conversacionales multi-turno.
   - Pestaña **Configuración Fuente & Multi-Tenant**: Formulario para editar cuenta, nombre del titular y directorio del corpus local.

---

### 9.17 Motores Cuantitativos Deterministas y Quality Gates Oficiales (Homologación SACRINT v6.0)

A partir de la versión 6.0, se implementó la **Homologación Integral de Auditoría y Evaluación IA** entre **SIGPDA-EMS** (portal docente/directivo) y **SISAT-ATP** (portal de supervisión y asesoría técnico-pedagógica).

#### 1. Principio Arquitectónico: Separación Determinista
Anteriormente, el LLM estimaba puntos y porcentajes de manera heurística y mediante llamadas secuenciales no estructuradas. La nueva arquitectura divide estrictamente las responsabilidades:
- **LLM (Google Gemini / Gemini 2.5 Flash)**: Extrae evidencias contextuales y califica cumplimiento normativo cualitativo (`pass` / `warning` / `fail` o `SI` / `PARCIAL` / `NO`). Se propaga `escuelaId` para utilizar llaves de API específicas de los planteles cuando estén configuradas.
- **TypeScript Core**: Aplica ponderaciones matemáticas exactas, acumula puntos brutos, calcula porcentajes dimensionales, evalúa reglas de descalificación y emite el dictamen institucional oficial con estricto determinismo.

#### 2. Catálogo de los 4 Quality Gates Homologados

1. **Control y Auditoría de Planeaciones Didácticas (`src/lib/planeaciones-evaluator.ts`)**:
   - **Semestres 1° a 4° (MCCEMS Propósitos Formativos)**: 17 criterios normativos distribuidos en Rubro I (90 pts), Rubro II (70 pts) y Rubro III (140 pts) = **300 pts máximos**.
   - **Semestres 5° y 6° (MCCEMS Progresiones)**: 13 criterios normativos distribuidos en Rubro I (90 pts), Rubro II (70 pts) y Rubro III (140 pts) = **300 pts máximos**.
   - **Formación Laboral (Guía Laboral DBEPA)**: 7 criterios normativos de saberes técnicos, seguridad e insumos = **200 pts máximos**.
   - **Extracción de Texto Digital**: En `/api/director/planeaciones/route.ts`, se extrae el texto de DOCX y PDF previo al envío al evaluador, incluyendo la descarga y extracción del PAEC escolar para validar la transversalidad curricular.
   - **Umbrales**: $\ge 88\%$ `COMPLETO`, $\ge 65\%$ `PARCIAL`, $< 65\%$ `REQUIERE_CORRECCION`.

2. **Quality Gate PAEC-PEC (`src/lib/quality-gates/paec-evaluator.ts`)**:
   - **8 Dimensiones Normativas**: Diagnóstico Comunitario (16 pts), Justificación (12 pts), Mapeo Curricular (12 pts), Cronograma (8 pts), Progresiones (8 pts), Plan Territorial (16 pts), Implementación (8 pts) y Gobernanza (12 pts).
   - **23 Criterios Oficiales**: Escala 1-4 pts por criterio ($23 \times 4 = \mathbf{92\text{ pts brutos}}$ normalizados al 100%).
   - **Umbrales**: $\ge 85\%$ `aprobado_excelente`, $\ge 70\%$ `aprobado`, $< 70\%$ `requiere_ajustes`.
   - **Generador de Reporte**: Markdown institucional completo con desglose dimensional, sellos y firmas.

3. **Quality Gate PMC e Informe Final (`src/lib/quality-gates/pmc-evaluator.ts`)**:
   - **PMC (Planeación Inicial)**: 5 dimensiones normativas (Identificación, Diagnóstico e Indicadores, FODA y Priorización, Plan de Acción y Metas, Corresponsabilidad del Personal) distribuidas en **10 criterios oficiales** = **100 pts brutos**. Detección de evidencias no conformes.
   - **Informe Final de Cierre (Rendición de Cuentas)**: 5 dimensiones evaluadas (100 pts) con contraste directo contra el texto del PMC original planeado en el ciclo lectivo (`pmcEntrega`), premiando la justificación reflexiva y honesta de metas no cumplidas.
   - **Umbrales**: $\ge 85\%$ `EXCELENTE`, $\ge 70\%$ `SATISFACTORIO`, $\ge 50\%$ `EN_DESARROLLO`, $< 50\%$ `REQUIERE_REVISION`.

4. **Quality Gate PIPS / Cartografía Territorial (`src/lib/quality-gates/pips-evaluator.ts`)**:
   - **6 Dimensiones Zonales**: Identificación Zonal (10 pts), Reflexión y Diagnóstico (25 pts), Censo de Planteles (15 pts), Objetivos y Metas (20 pts), Cronograma (15 pts) y Monitoreo/Instrumentos (15 pts).
   - **7 Criterios Normativos**: Total exacto de **100 pts brutos**.
   - **Umbrales**: $\ge 85\%$ `EXCELENTE` (0 criterios en fail), $\ge 70\%$ `SATISFACTORIO`, $\ge 50\%$ `EN_DESARROLLO`, $< 50\%$ `REQUIERE_REVISION`.
   - **Integración**: Integrado en `src/lib/pre-revision.ts` (L15, L859) reemplazando la última llamada secuencial de 3 partes de Gemini.

#### 3. Batería de Pruebas Automatizadas
El sistema cuenta con scripts dedicados en `scripts/`:
- `test-paec-evaluator.ts`: Valida 23 criterios, 8 dimensiones, 92 pts brutos y fallbacks.
- `test-pmc-evaluator.ts`: Valida 10 criterios de PMC, 5 dimensiones de Informe Final, 100 pts y reportes.
- `test-pips-evaluator.ts`: Valida 7 criterios, 6 dimensiones, 100 pts y estructura del dictamen zonal.

---

### 9.18 Unificador Universal de Concentrados PDF por CCT (Módulo Avance de Entregas)

A partir de la actualización de Septiembre 2026, se eliminó la restricción rígida que limitaba la unificación zonal de archivos PDF únicamente a *"DÍA NARANJA"*, habilitando un **mecanismo dinámico y universal** para todos los programas educativos de la supervisión.

#### 1. Principio y Motivación Institucional
El Asesor Técnico Pedagógico (ATP) y la Supervisión Escolar requieren remitir concentrados consolidados a dependencias de la SEP (ej. Plataformas de Dirección General, formularios del programa *El ABC de las Emociones*, CEDAVIM, etc.), donde las evidencias de las escuelas deben presentarse en un único archivo PDF ordenado alfabéticamente por Clave de Centro de Trabajo (CCT).

#### 2. Componentes y Arquitectura
- **Ubicación**: `src/app/admin/_componentes/ListadoProgramas.tsx` y `src/lib/merge-pdfs.ts`.
- **Generación Dinámica de Botones (`obtenerBotonesUnificacion`)**:
  - **Programas de 1 Documento (`numArchivos <= 1`)**: Aplica a *El ABC de las Emociones*, *PMC*, *PAEC-PEC*, *Seguridad y Paz*, etc. Genera un botón `[🔗 Unificar Evidencias]` con `etiquetaMatch: null`, garantizando la inclusión del archivo entregado incluso si la etiqueta es `null` o genérica.
  - **Programas de 2 o más Documentos (`numArchivos >= 2`)**: Mapea dinámicamente cada etiqueta a su propio botón (`[🔗 Unificar Registros]`, `[🔗 Unificar Evidencias]`, o el nombre del documento).
  - **Fallback sin etiquetas**: Si un programa requiere $N$ archivos pero no tiene etiquetas configuradas en BD, genera `Unificar Archivo 1`, `Unificar Archivo 2`...
- **Deduplicación y Ordenamiento Estricto**:
  - Deduplica por CCT (1 documento representativo por bachillerato).
  - Ordena alfabéticamente mediante `items.sort((a, b) => a.cct.localeCompare(b.cct))`.
- **Concurrencia Aislada y No Bloqueante**:
  - El estado de procesamiento está desacoplado por clave de unificación individual: `mergingKeys: Record<string, boolean>` con formato `${prog.id}_${periodoId}_${config.tipo}`.
  - El progreso de descarga y unión se reporta por programa (`mergeProgressByProg: Record<string, MergeProgress>`), permitiendo al usuario procesar múltiples programas o periodos en paralelo.
- **Prefijo Configurable y Nomenclatura Institucional**:
  - Editor en línea de prefijo (✎) con preview reactiva: `${mergePrefix}_${progNombreLimpio}${periodoSuffix}_${config.tipo}.PDF`.
- **Unificación por Periodo / Mes**:
  - En programas mensuales o semestrales, cada fila de periodo expandido expone su propio botón para consolidar exclusivamente las entregas de ese mes.

#### 3. Validación y Pruebas
- Script de validación automatizada: `scripts/test-unificador-universal.ts` (valida los 4 casos de generación de botones, fallback, deduplicación y orden alfabético por CCT).

---

*Versión actualizada: Septiembre 2026 — v6.1 (Unificador Universal de PDFs por CCT & Homologación SACRINT)*
