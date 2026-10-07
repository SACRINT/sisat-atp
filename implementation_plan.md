# Plan de Implementación: Nuevos Módulos y Manual de Usuario SISAT-ATP

## Descripción
Implementación de los 4 módulos restantes de Auditoría & Corpus para la Supervisión Escolar ATP:
1. **Acompañamiento CTE** (ATP-MOD-04)
2. **Convocatorias USICAMM** (ATP-MOD-06)
3. **Comités Escolares** (ATP-MOD-07)
4. **Difusión de Becas** (ATP-MOD-05)

Integración completa en `AdminDashboard.tsx` y redacción del `MANUAL_USUARIO.md` oficial de la plataforma.

---

## Componentes Creados e Integrados

### 1. Modelos de Base de Datos y APIs Backend
- `prisma/schema.prisma`:
  - `CteSesionConfig`, `CteEscuelaEstado`, `UsicammConvocatoria`, `ComiteEscolarRegistro`, `ComiteActaConformacion`, `BecaConvocatoriaInformativa`.
- Rutas API (`src/app/api/admin/`):
  - `/api/admin/cte/route.ts` & `/api/admin/cte/[id]/estado/route.ts`
  - `/api/admin/usicamm/route.ts` & `/api/admin/usicamm/[id]/route.ts`
  - `/api/admin/comites/route.ts`
  - `/api/admin/becas/route.ts`

### 2. Componentes UI Frontend (`src/app/admin/_componentes/`)
- `CteSesionesPanel.tsx`: Seguimiento de sesiones CTE y validación de actas por escuela.
- `UsicammPanel.tsx`: Publicación y difusión de convocatorias oficiales de USICAMM.
- `ComitesPanel.tsx`: Estado de conformación de comités de convivencia y seguridad escolar.
- `BecasPanel.tsx`: Difusión de convocatorias informativas de Becas Benito Juárez (Zero-Payload).

### 3. Integración en `AdminDashboard.tsx`
- Tipado de `vista`: adicionadas opciones `cte`, `usicamm`, `comites`, `becas`.
- Registro en `getSectionKey` mapeado a `auditoria_atp`.
- Botones de navegación agregados en el grupo lateral "Auditoría & Corpus".
- Vistas renderizadas dinámicamente según estado `vista`.

### 4. Manual de Usuario
- Creado `C:\NotebookLM\MANUAL_USUARIO.md` con 30 secciones que abarcan todas las funciones, módulos, arquitectura multi-tenant, reglas Zero-Payload, roles y permisos de la plataforma SISAT-ATP.

---

## Verificación de Calidad y Compilación
- `npx tsc --noEmit`: 0 errores.
- `npm run build`: En ejecución / compilación exitosa.
- Cumplimiento de Reglas Núcleo:
  - Zero-Payload: Sin almacenamiento de datos nominales de alumnos ni becarios.
  - Multi-tenant: Filtrado dinámico por tenantId.
  - No-Hardcoding: Configuración vía panel.

---

## Ronda de Auditoría Adversarial: Remediación y Estabilización (0bb69ff..HEAD)

### Registro de Ítems Remediados y Criterios de Aceptación

#### [P1-01] Homologación Divisor PMC (110 pts / 11 Criterios)
- **Commit**: `adedf8d` (`fix(pre-revision): (P1-01) actualizar divisor y conteo de criterios PMC a 110 pts y 11 criterios`)
- **Archivos**: `src/lib/pre-revision.ts` (líneas :870 y :858 a HEAD)
- **Criterio de Aceptación**: Divisor homologado a 110 puntos y 11 criterios (C1-C11). `git grep 'passedCriteria}/10'` exit 1, `git grep 'totalPuntosBrutos.*resultadoPmc.*100'` exit 1.

#### [P1-02] Suplencia Determinista con Error Conexo
- **Commit**: `960dd24` (`fix(evaluadores): (P1-02) preservar errorConexo en suplencia determinista por caida de IA`)
- **Archivos**: `src/lib/quality-gates/pmc-evaluator.ts`, `paec-evaluator.ts`, `pips-evaluator.ts`, `src/lib/pre-revision.ts`
- **Criterio de Aceptación**: Evaluadores deterministas inyectan `errorConexo: true` al ocurrir fallback por indisponibilidad de LLM, reteniendo puntuación y score en base de datos.

#### [P1-03 / P2-01] Exportación de Funciones Puras y Eliminación de any en Pruebas
- **Commit**: `cea4926` (`test(evaluadores): (P1-03, P2-01) vincular suites a logica real y erradicar tipos any`)
- **Archivos**: `src/lib/quality-gates/pmc-evaluator.ts`, `paec-evaluator.ts`, `src/lib/pre-revision-badge.ts`, `src/__tests__/merge-ia-determinista.test.ts`
- **Criterio de Aceptación**: Pruebas importan funciones puras de producción (`fusionarCriterioPMC`, `fusionarCriterioPAEC`, `calcularBadgePreDictamen`) con cero tipos any añadidos.

#### [P2-03] Preservación de Estado de Pre-Revisión ante 401
- **Commit**: `2718f1b` (`test(pre-revision): (P2-03) validar preservacion de resultado previo ante error de descarga`)
- **Archivos**: `src/__tests__/preservacion-estado-error.test.ts`
- **Criterio de Aceptación**: Prueba unitaria real con mock de fetch 401 valida que `analizarEntregaConIA` resguarda `resultadoPrevia` y marca `errorConexo: true`.

#### [P3] Homologación de Divisor en Tests y Remoción de Condición Muerta
- **Commit**: `df8032d` (`fix(tests): (P3) homologar divisor 110 en tests de pmc y remover condicion muerta en badge`)
- **Archivos**: `src/__tests__/pmc-determinista.test.ts`, `scripts/test-pmc-evaluator.ts`, `src/lib/pre-revision-badge.ts`
- **Criterio de Aceptación**: Pruebas actualizadas a divisor 110; se remueve verificación muerta `!r.reporteMarkdown`.

#### [T1 / H-1] Alineación de Vista Director ante Fallo de IA
- **Commit**: `88e7bd0` (`fix(director): (T1/H-1) reflejar estado preliminar sin IA en vista de autoevaluacion`)
- **Archivos**: `src/app/director/_componentes/EntregasListado.tsx`, `src/lib/pre-revision-badge.ts`
- **Criterio de Aceptación**: Cuando `errorConexo: true`, el director no observa "Aprobado" en verde, sino la píldora informativa "Preliminar (IA no disponible)".

#### [T2 / H-2] Reactivación de Alerta Administrativa en Observaciones
- **Commit**: `1a149e3` (`fix(admin): (T2/H-2) reactivar aviso de falla en observaciones ante errorConexo o error`)
- **Archivos**: `src/app/admin/AdminDashboard.tsx`, `src/lib/pre-revision-badge.ts`
- **Criterio de Aceptación**: La bandera `hasError` evalúa `res.errorConexo || res.error`, desplegando el aviso de contingencia determinista.

#### [T3 / P1] Pruebas de Regresión para UI Director y Administrador
- **Commit**: `9238dee` (`test(ui): (T3/P1) agregar pruebas de regresion para estados de error en director y admin`)
- **Archivos**: `src/__tests__/estado-error-ui.test.ts`, `src/lib/pre-revision-badge.ts`
- **Criterio de Aceptación**: Suite Vitest con funciones desacopladas `calcularPillDirector` y `calcularHasErrorAdmin` importadas directamente de producción.

#### [T6 / H-5] Prevención de Anidamiento Recursivo en resultadoPrevia
- **Commit**: `059300c` (`fix(pre-revision): (T6/H-5) evitar anidamiento recursivo de resultadoPrevia en fallos consecutivos`)
- **Archivos**: `src/lib/pre-revision.ts:1326-1337`, `src/__tests__/preservacion-estado-error.test.ts`
- **Criterio de Aceptación**: `sanitizedPrevia` elimina `resultadoPrevia` de fallos anteriores; test con 2 fallos consecutivos confirma `expect(savedResultado.resultadoPrevia.resultadoPrevia).toBeUndefined()`.

#### [T7 / H-6, H-7] Optimización de Renderizado de Badges y Citas
- **Commit**: Pendiente (`refactor(ui): (T7/H-7) optimizar calculo de badge por fila y documentar plan de implementacion`)
- **Archivos**: `src/app/admin/_componentes/ListadoEscuelas.tsx`, `src/app/admin/_componentes/ListadoProgramas.tsx`, `implementation_plan.md`
- **Criterio de Aceptación**: Se invoca `calcularBadgePreDictamen` 1 sola vez por fila asignando a variable `badge`; actualización de citas en `pre-revision.ts:870` y `:858`.

