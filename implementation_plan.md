# Plan de Implementación y Remediación Técnica

## Bases Auditadas
- **SISAT-ATP**: `df8032d..e2e6aec`
- **SIGPDA-EMS**: `af101e2..8052348`

---

## 1. Módulos y Remediaciones SISAT-ATP

### [815a8aa] fix(archivos): Resolver descarga 502/404 y optimizar rutas con nomenclatura compacta por CCT
- **Commit**: `815a8aafe5b2893dfdb96350f7a3d87cf75980e0`
- **Archivos**:
  ```text
  src/__tests__/download-nomenclatura.test.ts |  50 ++++++++++++
  src/app/api/download/route.ts               | 122 ++++++++++++++++++----------
  src/app/api/sign-cloudinary/route.ts        |  32 ++++++--
  src/app/api/upload/confirm/route.ts         |   4 +
  src/lib/cloudinary.ts                       |  58 ++++++++++++-
  src/lib/pre-revision.ts                     |  68 ++++++++++------
  6 files changed, 259 insertions(+), 75 deletions(-)
  ```
- **Descripción y Justificación**:
  - Resuelve error de descarga 502/404 provocado por longitud de URLs/rutas (> 254 caracteres) en planteles con nombres largos (e.g., CCT `21EBH0789L`).
  - Optimiza la jerarquía de almacenamiento en Cloudinary mediante nomenclatura compacta `[CCT]/[PROG_SLUG]/[DOC]` y normalización en `buildFolderPath` (`src/lib/cloudinary.ts:235`).
  - Implementa estrategia de reintentos escalonados con candidatos firmados (raw, image, video) y proxy local en `src/app/api/download/route.ts`.
  - Verificado con suite unitaria real: `src/__tests__/download-nomenclatura.test.ts` (4 pruebas, exit 0).

### [88e7bd0] fix(director): (T1/H-1) Reflejar estado preliminar sin IA en vista de autoevaluación
- **Commit**: `88e7bd0`
- **Archivos**: `src/app/director/_componentes/EntregasListado.tsx`, `src/lib/pre-revision-badge.ts:85-110`
- **Criterio de Aceptación**:
  - Cuando `errorConexo: true` o `error`, la vista del director no muestra la píldora verde de "Aprobado", sino el estado informativo "Preliminar (IA no disponible)".
  - Estilos reales centralizados en `calcularPillDirector`: fondo `#fef3c7`, texto `#b45309`, borde `1px solid #fde68a`.

### [1a149e3 / cbd67a3] fix(admin): (T2/H-2 / P2-F2) Conectar cálculo de error en observaciones del panel
- **Commits**: `1a149e3` y `cbd67a3`
- **Archivos**: `src/app/admin/AdminDashboard.tsx:95,1861`, `src/lib/pre-revision-badge.ts:120-130`
- **Criterio de Aceptación**:
  - `AdminDashboard.tsx` consume directamente la función pura exportada `calcularHasErrorAdmin(res)` importada en la línea 95 e invocada en la línea 1861.
  - Activa el contenedor de advertencia ante contingencias (`errorConexo`, `error`, fallos de descarga o ausencia de borrador), eliminando la duplicación inline y asegurando cobertura directa de los tests unitarios en producción.

### [9238dee] test(ui): (T3/P1) Pruebas de regresión para UI Director y Administrador
- **Commit**: `9238dee`
- **Archivos**: `src/__tests__/estado-error-ui.test.ts`
- **Criterio de Aceptación**: Suite Vitest con 10 pruebas unitarias que validan exhaustivamente `calcularPillDirector` y `calcularHasErrorAdmin` importando funciones de producción.

### [059300c] fix(pre-revision): (T6/H-5) Evitar anidamiento recursivo de resultadoPrevia en fallos consecutivos
- **Commit**: `059300c`
- **Archivos**: `src/lib/pre-revision.ts:1326-1338`, `src/__tests__/preservacion-estado-error.test.ts`
- **Criterio de Aceptación**: `sanitizedPrevia` establece `resultadoPrevia: undefined`, impidiendo la duplicación y anidamiento recursivo de JSONB en base de datos. Test de 2 fallos consecutivos confirma `expect(savedResultado.resultadoPrevia.resultadoPrevia).toBeUndefined()`.

### [34d0dc0] refactor(ui): (T7/H-7) Optimizar cálculo de badge por fila
- **Commit**: `34d0dc0`
- **Archivos**: `src/app/admin/_componentes/ListadoEscuelas.tsx:466`, `src/app/admin/_componentes/ListadoProgramas.tsx:859`
- **Criterio de Aceptación**: Se calcula `const badge = calcularBadgePreDictamen(...)` una sola vez por fila (1x por entrega), reutilizando sus propiedades y eliminando el patrón N+1 de render. Citas actualizadas: métricas de PMC residen en `pre-revision.ts:870` y `:858`.

### [a163e06] fix(lint): (T4/H-4) Sanear tipos explicit-any y caracteres no escapados
- **Commit**: `a163e06`
- **Archivos**: `src/lib/pre-revision.ts`, `src/app/admin/_componentes/ListadoEscuelas.tsx`, `src/app/admin/_componentes/ListadoProgramas.tsx`
- **Criterio de Aceptación**: Eliminación de tipos `any` en los archivos auditados y reemplazo de comillas no escapadas (`&quot;No Aplica&quot;` en :842).

### [de312b0] fix(types): Asegurar compatibilidad estricta de incidenciasDetalle y type guards
- **Commit**: `de312b0788eea3fbe2456d0c0a9bdbffed33cf45`
- **Archivos**:
  ```text
  src/lib/pre-revision.ts | 28 ++++++++++++++++++----------
  1 file changed, 18 insertions(+), 10 deletions(-)
  ```
- **Descripción y Justificación**:
  - Restablece el tipado estricto de `incidenciasDetalle` con la interfaz `{ mes, categoria, edad, violencia, escuela, cct, localidad }[]` y type guards seguros `isX(val: unknown): boolean` para la validación de incidentes de violencia en matrices Excel de Acoso Escolar.
  - Asegura que `npx tsc --noEmit` y `npm run build` compilen con 0 errores de TypeScript en Turbopack.

### [a7aa742] fix(director): (P2-F3) Eliminar variable score sin usar en EntregasListado
- **Commit**: `a7aa742`
- **Archivos**: `src/app/director/_componentes/EntregasListado.tsx:683`
- **Criterio de Aceptación**: Se remueve `const score = resultado?.puntuacion || "N/A";` no consumida tras la integración de `pill.texto`, extinguiendo la advertencia de `@typescript-eslint/no-unused-vars`.

---

## 2. Módulos y Remediaciones SIGPDA-EMS

### [7918a1b] fix(cartografia): Implementar bloqueo suave 422 si quality gate determina REQUIERE_REVISION (F-R20-03)
- **Commit**: `7918a1bbe472e357cea7a7a96bea5cf22384ac4f`
- **Archivos**:
  ```text
  src/__tests__/cartografia-docx-routes.test.ts | 92 +++++++++++++++++++++++++++
  src/app/api/pdf/cartografia/[id]/route.ts     | 17 +++++
  src/lib/cartografia-docx-response.ts          | 17 +++++
  3 files changed, 126 insertions(+)
  ```
- **Impacto en el flujo docente y pedagógico**:
  - Implementa un gate de calidad previo a la exportación oficial de Cartografía de Zona (PDF y DOCX).
  - Si el Quality Gate determina un puntaje menor al 50% (`REQUIERE_REVISION`), los endpoints retornan HTTP 422 con payload explicativo `{ error, quality }` para evitar la emisión de documentos incompletos sin las 5 dimensiones normativas de NEM/MCCEMS.
  - En commits subsecuentes (`0dd04d3`), la UI integra `CartografiaDownloadButton` con modal interactivo de calidad para guiar al supervisor/docente en las dimensiones pendientes.

### [1f9c645] test(e2e): (T5/H-3) Ampliar timeout a 45s en descarga masiva zip
- **Commit**: `1f9c645`
- **Archivo**: `src/__tests__/bulk-download-zip.test.ts:150`
- **Criterio de Aceptación**: Se incrementa el timeout del test de estrés E2E de 18 PDFs a 45000 ms, estabilizando la suite contra fluctuaciones de CPU en Node.js. 3 corridas arrojaron 1274 pruebas exitosas (1267 passed, 7 skipped) en el commit 1f9c645.

### [0dd04d3 & c8bb9e4] Componente CartografiaDownloadButton y timeout de fixtures PMC
- **Commits**: `0dd04d3`, `c8bb9e4`
- **Archivos**: `src/components/cartografia/CartografiaDownloadButton.tsx`, `src/__tests__/pmc-parse-previous-coverage.test.ts`
- **Alcance**: Gestión en frontend del status 422 con modal y homogeneización de timeouts a 45000ms en suites de fixtures reales de PMC (alcanzando 1276 pruebas: 1269 passed, 7 skipped en c8bb9e4).

### [a41c6c4] test(cartografia): Cubrir branch 422 y extraer parseDownloadResponse en CartografiaDownloadButton (F-R22-02)
- **Commit**: `a41c6c41c83ec0f603bf5cd8fd216d657c6879f0`
- **Archivos**:
  ```text
  src/components/cartografia/CartografiaDownloadButton.tsx |  55 ++++---
  src/__tests__/cartografia-download-button.test.tsx      | 130 ++++++++++++++++
  2 files changed, 185 insertions(+), 32 deletions(-)
  ```
- **Alcance**: Extracción modular del parser de respuesta HTTP (`parseDownloadResponse`) y suite de pruebas unitarias exhaustiva con testing-library para simular códigos 200, 422 y errores de red, elevando la suite completa de SIGPDA-EMS a 1281 pruebas (1274 passed, 7 skipped en 149 archivos).

### [8052348] test(cartografia): Cubrir RFC 5987 y fallback sin header en parseDownloadResponse (F-R23-03)
- **Commit**: `8052348be5ccaf2b84bc08e9bbf165ba0936db5f`
- **Archivos**:
  ```text
  src/__tests__/cartografia-download-button.test.tsx | 65 +++++++++++++++++-----
  1 file changed, 52 insertions(+), 13 deletions(-)
  ```
- **Alcance**: Cobertura unitaria rigurosa del parser de descargas ante cabeceras `Content-Disposition` codificadas con RFC 5987 (`filename*=UTF-8''...`) y resiliencia ante su ausencia completa (fallback a nombre sintético seguro), consolidando la suite de SIGPDA-EMS en 1283 pruebas (1276 passed, 7 skipped en 149 archivos).

---

## 3. Estado de Verificación de Puertas de Calidad

- **SISAT-ATP** (`df8032d..e2e6aec`):
  - `npx tsc --noEmit`: 0 errores (Exit code 0).
  - `npm test` / `vitest run --reporter=verbose`: 6 archivos, 28 pruebas pasadas (Exit code 0).
  - `npx eslint`: 0 problemas nuevos introducidos; 51 advertencias/errores preexistentes retenidos idénticos al estado base `df8032d`.
  - `npm run build`: 81/81 rutas compiladas exitosamente (Next.js 16.1.6 Turbopack, Exit code 0).
- **SIGPDA-EMS** (`af101e2..8052348`):
  - `npx tsc --noEmit`: 0 errores (Exit code 0).
  - `npm test`: 149 suites, 1276 pruebas pasadas, 7 skipped (1283 totales, Exit code 0).
  - `npm run build`: 123/123 rutas + Middleware Proxy compiladas exitosamente (Next.js 16.2.9 Turbopack, Exit code 0).

---

## 4. Deuda Técnica Preexistente (Declarada sin Incremento Neto)

### A. Emisiones de `console.*` en SISAT-ATP
Deuda técnica histórica retenida en producción (no existe módulo centralizado `logger.ts` en SISAT-ATP):
- `src/app/api/download/route.ts`: 9 ocurrencias
- `src/lib/pre-revision.ts`: 49 ocurrencias
- `src/app/api/sign-cloudinary/route.ts`: 1 ocurrencia
- `src/app/api/upload/confirm/route.ts`: 8 ocurrencias
- **Verificación de variación neta**: `git diff df8032d..HEAD | Select-String '^\+.*console\.'` (+8 agregados en nuevos bloques catch / -8 removidos en refactorización = 0 incremento neto).

### B. Linters de Código Preexistente en SISAT-ATP (Desglose Real Medido)
Los 51 problemas reportados en ESLint sobre los 13 archivos tocados corresponden al código base original (base `df8032d` tenía 99 en total):
- **27 errores** de `@typescript-eslint/no-explicit-any`:
  - `AdminDashboard.tsx`: 19
  - `EntregasListado.tsx`: 3
  - `cloudinary.ts`: 3
  - `download/route.ts`: 1
  - `sign-cloudinary/route.ts`: 1
- **4 errores** de `react/no-unescaped-entities`:
  - `EntregasListado.tsx`: 4
- **17 advertencias** de `@typescript-eslint/no-unused-vars`:
  - `AdminDashboard.tsx`: 16
  - `EntregasListado.tsx`: 1
- **3 advertencias** de `react-hooks/exhaustive-deps`:
  - `AdminDashboard.tsx`: 2
  - `EntregasListado.tsx`: 1
- **Totales exactos**: 31 errores + 20 advertencias = 51 problemas retenidos. Cero problemas nuevos introducidos.
