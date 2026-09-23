/**
 * Script de prueba unitaria y lógica para el Unificador Universal de PDFs por CCT
 * Ejecutar con: npx tsx scripts/test-unificador-universal.ts
 */

import {
    obtenerBotonesUnificacion,
    BotonUnificacion,
} from "../src/app/admin/_componentes/ListadoProgramas";
import { ProgramaAdmin } from "../src/types";

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FALLÓ ASERCIÓN: ${message}`);
        process.exit(1);
    }
}

async function main() {
    console.log("=================================================================");
    console.log("TEST: UNIFICADOR UNIVERSAL DE PDFS POR CCT (SISAT-ATP)");
    console.log("=================================================================\n");

    // ── 1. Caso El ABC de las Emociones (numArchivos = 1, etiquetas vacías/null) ──
    console.log("[1] Probando Caso 1: Programa de 1 archivo (ej. El ABC de las Emociones)");
    const progAbc = {
        id: "prog-abc-1",
        nombre: "El ABC de las Emociones",
        numArchivos: 1,
        etiquetasArchivos: [],
        periodos: [],
    } as unknown as ProgramaAdmin;

    const botonesAbc = obtenerBotonesUnificacion(progAbc);
    console.log(`- Botones generados: ${botonesAbc.length}`);
    assert(botonesAbc.length === 1, "Debe generar exactamente 1 botón para numArchivos = 1");
    assert(botonesAbc[0].tipo === "EVIDENCIAS", "El tipo debe ser 'EVIDENCIAS'");
    assert(botonesAbc[0].label === "Unificar Evidencias", "El label debe ser 'Unificar Evidencias'");
    assert(botonesAbc[0].etiquetaMatch === null, "etiquetaMatch debe ser null para aceptar cualquier PDF entregado");
    console.log("  ✅ Caso 1 verificado correctamente.\n");

    // ── 2. Caso Día Naranja (numArchivos = 2, con etiquetas de Registro y Evidencias) ──
    console.log("[2] Probando Caso 2: Programa de 2 archivos con etiquetas (Día Naranja)");
    const progDiaNaranja = {
        id: "prog-naranja-2",
        nombre: "DÍA NARANJA",
        numArchivos: 2,
        etiquetasArchivos: [
            "Registro de Participación (Firmado y Sellado)",
            "Evidencias Fotográficas (Máx. 2 fotos por hoja)"
        ],
        periodos: [],
    } as unknown as ProgramaAdmin;

    const botonesNaranja = obtenerBotonesUnificacion(progDiaNaranja);
    console.log(`- Botones generados: ${botonesNaranja.length}`);
    assert(botonesNaranja.length === 2, "Debe generar exactamente 2 botones");
    assert(botonesNaranja[0].tipo === "REGISTROS", "El primer tipo debe ser 'REGISTROS'");
    assert(botonesNaranja[0].label === "Unificar Registros", "El primer label debe ser 'Unificar Registros'");
    assert(botonesNaranja[1].tipo === "EVIDENCIAS", "El segundo tipo debe ser 'EVIDENCIAS'");
    assert(botonesNaranja[1].label === "Unificar Evidencias", "El segundo label debe ser 'Unificar Evidencias'");
    console.log("  ✅ Caso 2 verificado correctamente.\n");

    // ── 3. Caso Programa Nuevo con N Archivos (ej. 3 archivos) ──
    console.log("[3] Probando Caso 3: Programa nuevo con 3 documentos específicos");
    const progNuevo = {
        id: "prog-nuevo-3",
        nombre: "Seguridad y Cultura de Paz",
        numArchivos: 3,
        etiquetasArchivos: [
            "Acta Constitutiva del Comité",
            "Bitácora Mensual de Incidencias",
            "Evidencias Gráficas"
        ],
        periodos: [],
    } as unknown as ProgramaAdmin;

    const botonesNuevo = obtenerBotonesUnificacion(progNuevo);
    console.log(`- Botones generados: ${botonesNuevo.length}`);
    assert(botonesNuevo.length === 3, "Debe generar 3 botones");
    assert(botonesNuevo[2].tipo === "EVIDENCIAS", "Tercer botón debe ser detectado como EVIDENCIAS");
    console.log("  ✅ Caso 3 verificado correctamente.\n");

    // ── 4. Caso Fallback (numArchivos > 1 pero sin etiquetas configuradas) ──
    console.log("[4] Probando Caso 4: Fallback (numArchivos = 2, sin etiquetas en BD)");
    const progFallback = {
        id: "prog-fallback-4",
        nombre: "Programa Genérico Sin Etiquetas",
        numArchivos: 2,
        etiquetasArchivos: [],
        periodos: [],
    } as unknown as ProgramaAdmin;

    const botonesFallback = obtenerBotonesUnificacion(progFallback);
    console.log(`- Botones generados: ${botonesFallback.length}`);
    assert(botonesFallback.length === 2, "Debe generar 2 botones fallback");
    assert(botonesFallback[0].label === "Unificar Archivo 1", "Primer botón fallback debe ser 'Unificar Archivo 1'");
    assert(botonesFallback[1].label === "Unificar Archivo 2", "Segundo botón fallback debe ser 'Unificar Archivo 2'");
    console.log("  ✅ Caso 4 verificado correctamente.\n");

    // ── 5. Simulación de Deduplicación y Ordenación Alfabética por CCT ──
    console.log("[5] Probando Deduplicación y Orden Alfabético por CCT");
    const escuelasPrueba = [
        { cct: "21EBH0105X", nombreArchivo: "evidencias_105.pdf", etiqueta: null },
        { cct: "21EBH0012A", nombreArchivo: "evidencias_12a.pdf", etiqueta: null },
        { cct: "21EBH0012A", nombreArchivo: "evidencias_12a_duplicado.pdf", etiqueta: null },
        { cct: "21EBH0045B", nombreArchivo: "evidencias_45b.pdf", etiqueta: null },
    ];

    const mapaCct = new Map<string, typeof escuelasPrueba[0]>();
    for (const item of escuelasPrueba) {
        if (!mapaCct.has(item.cct)) {
            mapaCct.set(item.cct, item);
        }
    }

    const itemsOrdenados = [...mapaCct.values()].sort((a, b) => a.cct.localeCompare(b.cct));
    console.log(`- Total escuelas únicas procesadas: ${itemsOrdenados.length} (esperado: 3)`);
    assert(itemsOrdenados.length === 3, "Debe deduplicar a 1 archivo por CCT");
    assert(itemsOrdenados[0].cct === "21EBH0012A", "El primer CCT debe ser 21EBH0012A");
    assert(itemsOrdenados[1].cct === "21EBH0045B", "El segundo CCT debe ser 21EBH0045B");
    assert(itemsOrdenados[2].cct === "21EBH0105X", "El tercer CCT debe ser 21EBH0105X");
    console.log("  ✅ Ordenación alfabética y deduplicación verificadas con éxito.\n");

    console.log("=================================================================");
    console.log("TODAS LAS PRUEBAS DEL UNIFICADOR UNIVERSAL PASARON EXITOSAMENTE (5/5)");
    console.log("=================================================================");
}

main().catch(err => {
    console.error("Error en pruebas:", err);
    process.exit(1);
});
