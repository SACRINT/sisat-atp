import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  ShadingType,
  HeadingLevel,
  BorderStyle
} from "docx";

export interface FilaExportacion {
  encabezado: string;
  subtitulo?: string;
  celdas: {
    [diaPeriodo: string]: {
      materia: string;
      docente?: string;
      grupo?: string;
      aula?: string;
      colorBg?: string;
    } | string; // Compatibilidad con string simple
  };
}

export interface DatosExportacionHorario {
  nombreEscuela: string;
  cct: string;
  zonaEscolar?: string;
  cicloEscolar?: string;
  tipoVista: "GRUPO" | "DOCENTE" | "AULA" | "SUMARIO" | "PAQUETE_DOCENTES" | "PAQUETE_GRUPOS";
  tituloTabla: string;
  dias: string[];
  periodos: string[];
  filas: FilaExportacion[];
}

// Colores pastel/elegantes para asignaturas
const PALETA_COLORES_DOC = [
  "#eff6ff", "#f0fdf4", "#fefce8", "#fff7ed", "#fdf2f8",
  "#f5f3ff", "#ecfeff", "#f0fdfa", "#fafaf9", "#eef2ff"
];

export function getHashColor(texto: string): string {
  if (!texto) return "#f8fafc";
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = texto.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETA_COLORES_DOC.length;
  return PALETA_COLORES_DOC[index];
}

// =========================================================================
// EXPORTACIÓN A EXCEL (.XLSX)
// =========================================================================
export function exportarHorarioExcel(datos: DatosExportacionHorario) {
  const wb = XLSX.utils.book_new();

  const headerRow = ["Periodo / Día", ...datos.dias.map(d => d.toUpperCase())];

  for (const fila of datos.filas) {
    const rowsData: string[][] = [
      [`GOBIERNO DEL ESTADO DE PUEBLA — SECRETARÍA DE EDUCACIÓN PÚBLICA`],
      [`SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA — DIRECCIÓN DE BACHILLERATOS GENERALES`],
      [`SUPERVISIÓN ESCOLAR ZONA 004 — PLANTEL: ${datos.nombreEscuela.toUpperCase()} (CCT: ${datos.cct})`],
      [`HORARIO OFICIAL DE CLASES — ${datos.tituloTabla.toUpperCase()} • CICLO ${datos.cicloEscolar || "2026-2027"}`],
      [`${fila.encabezado.toUpperCase()} ${fila.subtitulo ? " - " + fila.subtitulo : ""}`],
      [],
      headerRow
    ];

    for (let p = 0; p < datos.periodos.length; p++) {
      const row: string[] = [`Hora ${p + 1}`];

      for (let d = 1; d <= datos.dias.length; d++) {
        const key = `${d}_${p + 1}`;
        const val = fila.celdas[key];

        if (!val) {
          row.push("Libre");
        } else if (typeof val === "string") {
          row.push(val);
        } else {
          // Formatear celda rica
          const partes: string[] = [];
          if (val.materia) partes.push(val.materia);
          if (val.docente && !fila.encabezado.startsWith("DOCENTE")) partes.push(`Prof. ${val.docente}`);
          if (val.grupo && !fila.encabezado.startsWith("GRUPO")) partes.push(`Grupo ${val.grupo}`);
          row.push(partes.join("\n"));
        }
      }
      rowsData.push(row);
    }

    rowsData.push([]);
    rowsData.push([
      "FIRMAS DE CONFORMIDAD Y VALIDACIÓN OFICIAL:",
      "",
      "",
      "",
      "",
      ""
    ]);
    rowsData.push([
      "____________________________________",
      "",
      "____________________________________",
      "",
      "____________________________________",
      ""
    ]);
    rowsData.push([
      fila.encabezado.startsWith("DOCENTE") ? "DOCENTE DE LA ASIGNATURA" : "ASESOR / TITULAR DE GRUPO",
      "",
      "DIRECCIÓN DEL PLANTEL",
      "",
      "SUPERVISIÓN ESCOLAR ZONA 004",
      ""
    ]);
    rowsData.push([
      "Nombre y Firma",
      "",
      "Sello y Firma Oficial",
      "",
      "Vo. Bo. Supervisión Escolar",
      ""
    ]);
    rowsData.push([]);
    rowsData.push(["SISAT-ATP • Plataforma Integral de Supervisión Escolar Zona 004"]);

    const ws = XLSX.utils.aoa_to_sheet(rowsData);

    // Ajustar ancho de columnas
    ws["!cols"] = [
      { wch: 18 },
      { wch: 32 },
      { wch: 32 },
      { wch: 32 },
      { wch: 32 },
      { wch: 32 }
    ];

    const sheetName = fila.encabezado.replace(/[\\/?*:[\]]/g, "_").slice(0, 30);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const fileName = `Horario_${datos.cct}_${datos.tipoVista}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// =========================================================================
// EXPORTACIÓN A PDF OFICIAL FORMAL (Landscape A4)
// =========================================================================
export function exportarHorarioPDF(datos: DatosExportacionHorario) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const totalFilas = datos.filas.length;

  datos.filas.forEach((fila, idxFila) => {
    if (idxFila > 0) {
      doc.addPage();
    }

    // 1. Franja decorativa institucional superior (Azul Marino + Dorado SEP)
    doc.setFillColor(30, 58, 138); // Azul marino institucional #1e3a8a
    doc.rect(14, 10, 269, 2.5, "F");
    doc.setFillColor(180, 83, 9); // Dorado institucional #b45309
    doc.rect(14, 12.5, 269, 1, "F");

    // 2. Membrete Oficial Zona Escolar 004
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 138);
    doc.text("GOBIERNO DEL ESTADO DE PUEBLA", 14, 19);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("SECRETARÍA DE EDUCACIÓN PÚBLICA  |  SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA", 14, 23.5);
    doc.text("DIRECCIÓN DE BACHILLERATOS GENERALES Y PREPARATORIA ABIERTA  |  SUPERVISIÓN ESCOLAR ZONA 004", 14, 27.5);

    // 3. Tarjeta de Información Ejecutiva del Plantel / Horario
    doc.setFillColor(248, 250, 252); // Fondo suave #f8fafc
    doc.setDrawColor(203, 213, 225); // Borde #cbd5e1
    doc.setLineWidth(0.3);
    doc.roundedRect(14, 30.5, 269, 16.5, 2, 2, "FD");

    // Columna Izquierda: Plantel y CCT
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`PLANTEL: ${datos.nombreEscuela.toUpperCase()}`, 18, 35.5);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`C.C.T.: ${datos.cct}   |   ZONA ESCOLAR: 004   |   TURNO: MATUTINO`, 18, 40);
    doc.text(`CICLO ESCOLAR: ${datos.cicloEscolar || "2026-2027"}`, 18, 44.5);

    // Columna Derecha: Título y Entidad
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 58, 138);
    doc.text(`${fila.encabezado.toUpperCase()} ${fila.subtitulo ? " • " + fila.subtitulo : ""}`, 280, 36, { align: "right" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`${datos.tituloTabla.toUpperCase()}`, 280, 41, { align: "right" });

    // Contar total de horas asignadas en esta retícula
    let totalHorasFila = 0;
    const asignaturasContadas = new Set<string>();
    for (let d = 1; d <= 5; d++) {
      for (let p = 0; p < datos.periodos.length; p++) {
        const val = fila.celdas[`${d}_${p + 1}`];
        if (val && val !== "Libre") {
          totalHorasFila++;
          if (typeof val !== "string" && val.materia) asignaturasContadas.add(val.materia);
        }
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52); // Verde formal
    doc.text(`TOTAL HORAS SEMANALES: ${totalHorasFila} hrs ${asignaturasContadas.size > 0 ? `(${asignaturasContadas.size} Asignaturas)` : ""}`, 280, 45, { align: "right" });

    // 4. Construir cuerpo de la tabla
    const head = [["PERIODO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"]];
    const body: any[][] = [];

    for (let p = 0; p < datos.periodos.length; p++) {
      const row: string[] = [`Hora ${p + 1}`];

      for (let d = 1; d <= 5; d++) {
        const key = `${d}_${p + 1}`;
        const val = fila.celdas[key];

        if (!val) {
          row.push("Libre");
        } else if (typeof val === "string") {
          row.push(val);
        } else {
          const lineas: string[] = [];
          if (val.materia) lineas.push(val.materia);
          if (val.docente && !fila.encabezado.startsWith("DOCENTE")) lineas.push(`Doc: ${val.docente}`);
          if (val.grupo && !fila.encabezado.startsWith("GRUPO")) lineas.push(`Gpo: ${val.grupo}`);
          if (val.aula) lineas.push(`Aula: ${val.aula}`);
          row.push(lineas.join("\n"));
        }
      }
      body.push(row);
    }

    // 5. Renderizar autoTable con formato ejecutivo
    autoTable(doc, {
      startY: 49,
      head: head,
      body: body,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
        halign: "center",
        valign: "middle",
        lineColor: [203, 213, 225],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
        cellPadding: 2.8
      },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: "bold", fillColor: [241, 245, 249], textColor: [30, 58, 138] },
        1: { cellWidth: 49 },
        2: { cellWidth: 49 },
        3: { cellWidth: 49 },
        4: { cellWidth: 49 },
        5: { cellWidth: 49 }
      },
      didParseCell: function(data) {
        if (data.section === "body" && data.column.index > 0) {
          const txt = data.cell.raw as string;
          if (txt && txt !== "Libre") {
            data.cell.styles.fillColor = [240, 249, 255]; // Azul helado claro #f0f9ff
            data.cell.styles.textColor = [15, 23, 42];    // Texto oscuro legible
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [148, 163, 184]; // Gris claro para Libre
            data.cell.styles.fillColor = [255, 255, 255];
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 145;

    // 6. Bloque Formal de Firmas Institucionales (3 Columnas)
    const yFirmas = Math.min(184, Math.max(finalY + 10, 160));
    doc.setLineWidth(0.3);
    doc.setDrawColor(100, 116, 139);

    // Columna 1: Docente / Asesor
    const x1 = 20;
    const wFirma = 65;
    doc.line(x1, yFirmas, x1 + wFirma, yFirmas);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 58, 138);
    doc.text(fila.encabezado.startsWith("DOCENTE") ? "DOCENTE DE LA ASIGNATURA" : "ASESOR / TITULAR DE GRUPO", x1 + (wFirma / 2), yFirmas + 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Nombre y Firma", x1 + (wFirma / 2), yFirmas + 7.5, { align: "center" });

    // Columna 2: Director del Plantel
    const x2 = 116;
    doc.line(x2, yFirmas, x2 + wFirma, yFirmas);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 58, 138);
    doc.text("DIRECCIÓN DEL PLANTEL", x2 + (wFirma / 2), yFirmas + 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Sello y Firma Oficial", x2 + (wFirma / 2), yFirmas + 7.5, { align: "center" });

    // Columna 3: Supervisión Escolar Zona 004
    const x3 = 212;
    doc.line(x3, yFirmas, x3 + wFirma, yFirmas);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 58, 138);
    doc.text("SUPERVISIÓN ESCOLAR ZONA 004", x3 + (wFirma / 2), yFirmas + 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Vo. Bo. Supervisión Escolar", x3 + (wFirma / 2), yFirmas + 7.5, { align: "center" });

    // 7. Pie de página formal
    const pageNum = idxFila + 1;
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `SISAT-ATP • Plataforma Integral de Supervisión Escolar Zona 004  |  Documento Oficial de Horarios  |  Hoja ${pageNum} de ${totalFilas}`,
      14,
      202
    );
  });

  // Descargar PDF
  const fileName = `Horario_Oficial_${datos.cct}_${datos.tipoVista}.pdf`;
  doc.save(fileName);
}

// =========================================================================
// EXPORTACIÓN A WORD (.DOCX) — Formato editable
// =========================================================================
export async function exportarHorarioDOCX(datos: DatosExportacionHorario) {
  const sections: any[] = [];

  for (const fila of datos.filas) {
    // Encabezado institucional formal
    sections.push(
      new Paragraph({
        text: "GOBIERNO DEL ESTADO DE PUEBLA",
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "GOBIERNO DEL ESTADO DE PUEBLA", bold: true, size: 24, color: "1e3a8a" })]
      }),
      new Paragraph({
        text: "SECRETARÍA DE EDUCACIÓN PÚBLICA | SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA",
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "SECRETARÍA DE EDUCACIÓN PÚBLICA | SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA", bold: false, size: 18, color: "475569" })]
      }),
      new Paragraph({
        text: "SUPERVISIÓN ESCOLAR DE BACHILLERATOS GENERALES ZONA ESCOLAR 004",
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "DIRECCIÓN DE BACHILLERATOS GENERALES | SUPERVISIÓN ESCOLAR ZONA 004", bold: true, size: 18, color: "475569" })]
      }),
      new Paragraph({
        text: `PLANTEL: ${datos.nombreEscuela.toUpperCase()} (CCT: ${datos.cct})`,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `PLANTEL: ${datos.nombreEscuela.toUpperCase()} (CCT: ${datos.cct})`, bold: true, size: 20, color: "0f172a" })]
      }),
      new Paragraph({
        text: `${fila.encabezado.toUpperCase()} ${fila.subtitulo ? " - " + fila.subtitulo : ""}`,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `${fila.encabezado.toUpperCase()} ${fila.subtitulo ? " - " + fila.subtitulo : ""}`, bold: true, size: 22, color: "1e3a8a" })]
      }),
      new Paragraph({
        text: `${datos.tituloTabla.toUpperCase()} • CICLO ESCOLAR ${datos.cicloEscolar || "2026-2027"}`,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `${datos.tituloTabla.toUpperCase()} • CICLO ESCOLAR ${datos.cicloEscolar || "2026-2027"}`, bold: false, size: 18, color: "64748b" })]
      }),
      new Paragraph({ text: "" })
    );

    // Cabecera de la tabla: Periodo | Lunes | Martes | ... | Viernes
    const headerCells = ["Periodo", ...datos.dias].map(
      (d) =>
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: d.toUpperCase(), bold: true, size: 17, color: "FFFFFF" })] })],
          shading: { type: ShadingType.SOLID, color: "1e3a8a", fill: "1e3a8a" },
          width: { size: d === "Periodo" ? 1500 : 2000, type: WidthType.DXA }
        })
    );
    const headerRow = new TableRow({ children: headerCells, tableHeader: true });

    // Filas de datos
    const bodyRows: TableRow[] = [];
    for (let p = 0; p < datos.periodos.length; p++) {
      const cells: TableCell[] = [
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Hora ${p + 1}`, bold: true, size: 16, color: "1e3a8a" })] })],
          shading: { type: ShadingType.SOLID, color: "f1f5f9", fill: "f1f5f9" },
          width: { size: 1500, type: WidthType.DXA }
        })
      ];

      for (let d = 1; d <= datos.dias.length; d++) {
        const key = `${d}_${p + 1}`;
        const val = fila.celdas[key];
        let textoLineas: string[] = [];

        if (!val) {
          textoLineas = ["Libre"];
        } else if (typeof val === "string") {
          textoLineas = [val];
        } else {
          if (val.materia) textoLineas.push(val.materia);
          if (val.docente && !fila.encabezado.startsWith("DOCENTE")) textoLineas.push(`Doc: ${val.docente}`);
          if (val.grupo && !fila.encabezado.startsWith("GRUPO")) textoLineas.push(`Gpo: ${val.grupo}`);
        }

        const esLibre = textoLineas[0] === "Libre";
        cells.push(
          new TableCell({
            children: textoLineas.map(
              (l, idx) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: l, bold: idx === 0 && !esLibre, size: 15, color: esLibre ? "94a3b8" : "0f172a" })] })
            ),
            shading: esLibre ? undefined : { type: ShadingType.SOLID, color: "f0f9ff", fill: "f0f9ff" },
            width: { size: 2000, type: WidthType.DXA }
          })
        );
      }
      bodyRows.push(new TableRow({ children: cells }));
    }

    const tabla = new Table({
      rows: [headerRow, ...bodyRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" }
      }
    });

    // Tabla de Firmas en 3 Columnas
    const tablaFirmas = new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ text: "" }),
                new Paragraph({ text: "" }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "____________________________________", bold: false, size: 16, color: "64748b" })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: fila.encabezado.startsWith("DOCENTE") ? "DOCENTE DE LA ASIGNATURA" : "ASESOR / TITULAR DE GRUPO", bold: true, size: 16, color: "1e3a8a" })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Nombre y Firma", size: 14, color: "64748b" })] })
              ],
              width: { size: 33, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [
                new Paragraph({ text: "" }),
                new Paragraph({ text: "" }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "____________________________________", bold: false, size: 16, color: "64748b" })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DIRECCIÓN DEL PLANTEL", bold: true, size: 16, color: "1e3a8a" })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Sello y Firma Oficial", size: 14, color: "64748b" })] })
              ],
              width: { size: 34, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [
                new Paragraph({ text: "" }),
                new Paragraph({ text: "" }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "____________________________________", bold: false, size: 16, color: "64748b" })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SUPERVISIÓN ESCOLAR ZONA 004", bold: true, size: 16, color: "1e3a8a" })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Vo. Bo. Supervisión Escolar", size: 14, color: "64748b" })] })
              ],
              width: { size: 33, type: WidthType.PERCENTAGE }
            })
          ]
        })
      ],
      width: { size: 100, type: WidthType.PERCENTAGE }
    });

    sections.push(tabla, new Paragraph({ text: "" }), tablaFirmas, new Paragraph({ text: "" }));
  }

  const doc = new Document({
    sections: [{ children: sections }]
  });

  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Horario_Oficial_${datos.cct}_${datos.tipoVista}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// =========================================================================
// SUMARIO MAESTRO — Excel con todos los docentes en filas, horas en columnas
// Formato: Docente | Lun/H1 | Lun/H2 | ... | Vie/H6
// =========================================================================
export interface DatosSumario {
  nombreEscuela: string;
  cct: string;
  dias: string[];
  numHorasPorDia: number;
  entidades: {
    id: string;
    etiqueta: string; // Nombre del docente o grupo
  }[];
  obtenerCelda: (entidadId: string, dia: number, periodo: number) => { texto: string } | null;
}

export function exportarSumarioExcel(datos: DatosSumario, tipo: "DOCENTE" | "GRUPO") {
  const wb = XLSX.utils.book_new();
  const { dias, numHorasPorDia } = datos;

  // Construir encabezados: Docente/Grupo + una columna por cada hora de cada día
  const headerRow: string[] = [tipo === "DOCENTE" ? "Docente" : "Grupo"];
  for (let d = 0; d < dias.length; d++) {
    for (let h = 1; h <= numHorasPorDia; h++) {
      headerRow.push(`${dias[d].substring(0, 3)}/H${h}`);
    }
  }

  const rowsData: string[][] = [
    [`SECRETARÍA DE EDUCACIÓN PÚBLICA — ZONA ESCOLAR 004`],
    [`ESCUELA: ${datos.nombreEscuela.toUpperCase()} (CCT: ${datos.cct})`],
    [`SUMARIO ${tipo === "DOCENTE" ? "MAESTRO" : "POR GRUPO"} — HORARIO SEMANAL COMPLETO`],
    [],
    headerRow
  ];

  for (const entidad of datos.entidades) {
    const fila: string[] = [entidad.etiqueta];
    for (let d = 1; d <= dias.length; d++) {
      for (let h = 1; h <= numHorasPorDia; h++) {
        const celda = datos.obtenerCelda(entidad.id, d, h);
        fila.push(celda ? celda.texto : "—");
      }
    }
    rowsData.push(fila);
  }

  rowsData.push([]);
  rowsData.push(["Generado por SISAT-ATP | Sistema Inteligente de Horarios IA"]);

  const ws = XLSX.utils.aoa_to_sheet(rowsData);

  // Ajustar ancho de columnas
  const wCols = [{ wch: 30 }]; // Primera columna más ancha
  for (let i = 0; i < dias.length * numHorasPorDia; i++) {
    wCols.push({ wch: 22 });
  }
  ws["!cols"] = wCols;

  const sheetName = tipo === "DOCENTE" ? "Sumario Maestros" : "Sumario Grupos";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const fileName = `Sumario_${tipo === "DOCENTE" ? "Maestro" : "Grupos"}_${datos.cct}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
