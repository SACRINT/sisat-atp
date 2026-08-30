/**
 * exportador.ts — Motor de Exportación Oficial de Horarios Escolares
 * Plataforma Inteligente de Horarios Escolares MCCEMS
 *
 * Formatos soportados:
 * 1. PDF Oficial (jsPDF + autoTable) — Landscape CARTA (Letter), membrete oficial sin placeholders, firmas de 3 columnas anti-colisión.
 * 2. Word Editable (.docx) — Landscape CARTA (Letter) garantizado para Microsoft Word escritorio, tablas editables, paleta pastel y tipografía diferenciada.
 * 3. Excel Estilizado (.xlsx) — ExcelJS con celdas pastel, congelación de paneles y membrete dinámico con Zona Escolar.
 * 4. Imagen WhatsApp / Redes Sociales — Motor Canvas 2D nativo ultra-fiable en 1080x1080 (Cuadrado) y 1080x1920 (Historia) con nombres completos y cero espacio muerto.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
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
  BorderStyle,
  PageOrientation
} from "docx";
import { getSubjectColors } from "./subject-colors";

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
    } | string;
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

export interface DatosSumario {
  nombreEscuela: string;
  cct: string;
  zonaEscolar?: string;
  dias: string[];
  numHorasPorDia: number;
  entidades: {
    id: string;
    etiqueta: string;
  }[];
  obtenerCelda: (entidadId: string, dia: number, periodo: number) => { texto: string } | null;
}

// Helpers de Color Hex a RGB para jsPDF y Canvas
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return [r, g, b];
}

// Helper para compatibilidad de hash color
export function getHashColor(texto: string): string {
  return getSubjectColors(texto).pastelBgHex;
}

// =========================================================================
// 1. EXPORTACIÓN A PDF OFICIAL FORMAL (Landscape Carta / Letter Anti-Colisión)
// =========================================================================
export function exportarHorarioPDF(datos: DatosExportacionHorario) {
  // Tamaño Carta Horizontal: 279.4 mm x 215.9 mm (Estándar México)
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "letter"
  });

  const totalFilas = datos.filas.length;
  const pageWidth = doc.internal.pageSize.getWidth(); // 279.4
  const pageHeight = doc.internal.pageSize.getHeight(); // 215.9

  const NAVY_RGB: [number, number, number] = [30, 58, 138]; // #1E3A8A
  const GOLD_RGB: [number, number, number] = [201, 162, 39]; // #C9A227
  const BORDER_RGB: [number, number, number] = [226, 232, 240]; // #E2E8F0

  const zonaTexto = datos.zonaEscolar ? (datos.zonaEscolar.toLowerCase().includes("zona") ? datos.zonaEscolar.toUpperCase() : `ZONA ${datos.zonaEscolar}`) : "ZONA 004";

  datos.filas.forEach((fila, idxFila) => {
    if (idxFila > 0) {
      doc.addPage("letter", "landscape");
    }

    // ── 1. Membrete Institucional Compacto y Elegante (Y=6.5 a 19 mm) ──
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY_RGB);
    doc.setFontSize(9.5);
    doc.text("GOBIERNO DEL ESTADO DE PUEBLA", pageWidth / 2, 6.5, { align: "center" });

    doc.setFontSize(8);
    doc.text("SECRETARÍA DE EDUCACIÓN PÚBLICA", pageWidth / 2, 10, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7);
    doc.text("SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR Y SUPERIOR", pageWidth / 2, 13, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text("DIRECCIÓN DE BACHILLERATOS GENERALES", pageWidth / 2, 16, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(`SUPERVISIÓN ESCOLAR ${zonaTexto}`, pageWidth / 2, 19, { align: "center" });

    // ── 2. Doble Línea Institucional (Azul Marino + Dorado) ──
    doc.setDrawColor(...NAVY_RGB);
    doc.setLineWidth(0.8);
    doc.line(14, 21, pageWidth - 14, 21);
    doc.setDrawColor(...GOLD_RGB);
    doc.setLineWidth(0.3);
    doc.line(14, 22, pageWidth - 14, 22);

    // ── 3. Banda de Título Oficial Compacta (Y=23.5 a 29 mm) ──
    doc.setFillColor(...NAVY_RGB);
    doc.rect(14, 23.5, pageWidth - 28, 5.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`HORARIO OFICIAL DE CLASES — CICLO ESCOLAR ${datos.cicloEscolar || "2026-2027"}`, pageWidth / 2, 27.2, { align: "center" });

    // ── 4. Barra de Metadatos Ejecutiva (Y=30.5 a 38.5 mm) ──
    doc.setFillColor(241, 245, 249); // #F1F5F9
    doc.setDrawColor(...BORDER_RGB);
    doc.setLineWidth(0.25);
    doc.roundedRect(14, 30.5, pageWidth - 28, 8, 1.2, 1.2, "FD");

    // Lado Izquierdo: Plantel, CCT y Zona
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text("Plantel:", 17, 34);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY_RGB);
    doc.text(datos.nombreEscuela.toUpperCase(), 28, 34);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("C.C.T.:", 17, 37.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(datos.cct.toUpperCase(), 27, 37.2);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Supervisión:", 60, 37.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(zonaTexto, 76, 37.2);

    // Lado Derecho: Entidad y Carga
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY_RGB);
    doc.text(`${fila.encabezado.toUpperCase()} ${fila.subtitulo ? " • " + fila.subtitulo : ""}`, pageWidth - 17, 34, { align: "right" });

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
    doc.setFontSize(7);
    doc.setTextColor(22, 101, 52); // Verde institucional
    doc.text(`Carga Total: ${totalHorasFila} hrs/semana (${asignaturasContadas.size} materias)`, pageWidth - 17, 37.2, { align: "right" });

    // ── 5. Construcción de Tabla Oficial ──
    const head = [["PERIODO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"]];
    const body: any[][] = [];
    const materiasGrid: (string | null)[][] = [];

    for (let p = 0; p < datos.periodos.length; p++) {
      const rowText: string[] = [`Hora ${p + 1}`];
      const rowMat: (string | null)[] = [null];

      for (let d = 1; d <= 5; d++) {
        const key = `${d}_${p + 1}`;
        const val = fila.celdas[key];

        if (!val) {
          rowText.push("Libre");
          rowMat.push(null);
        } else if (typeof val === "string") {
          rowText.push(val);
          rowMat.push(val !== "Libre" ? val : null);
        } else {
          const lineas: string[] = [];
          if (val.materia) lineas.push(val.materia);
          if (val.docente && !fila.encabezado.startsWith("DOCENTE")) lineas.push(`Prof. ${val.docente}`);
          if (val.grupo && !fila.encabezado.startsWith("GRUPO")) lineas.push(`Gpo: ${val.grupo}`);
          if (val.aula) lineas.push(`[${val.aula}]`);
          rowText.push(lineas.join("\n"));
          rowMat.push(val.materia || null);
        }
      }
      body.push(rowText);
      materiasGrid.push(rowMat);
    }

    const tableStartY = 40;
    const dayColWidth = (pageWidth - 28 - 22) / 5;

    autoTable(doc, {
      startY: tableStartY,
      head: head,
      body: body,
      theme: "grid",
      styles: {
        fontSize: 6.8,
        cellPadding: 1.1,
        halign: "center",
        valign: "middle",
        overflow: "linebreak",
        minCellHeight: 7.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.18
      },
      headStyles: {
        fillColor: [...NAVY_RGB],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
        cellPadding: 1.4
      },
      columnStyles: {
        0: { cellWidth: 22, fontStyle: "bold", fillColor: [241, 245, 249], textColor: [...NAVY_RGB] },
        1: { cellWidth: dayColWidth },
        2: { cellWidth: dayColWidth },
        3: { cellWidth: dayColWidth },
        4: { cellWidth: dayColWidth },
        5: { cellWidth: dayColWidth }
      },
      didParseCell: function(data) {
        if (data.section === "body" && data.column.index > 0) {
          const matNombre = materiasGrid[data.row.index]?.[data.column.index];
          if (matNombre) {
            const colors = getSubjectColors(matNombre);
            data.cell.styles.fillColor = hexToRgb(colors.pastelBgHex);
            data.cell.styles.textColor = hexToRgb(colors.pastelTextHex);
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.fillColor = [248, 250, 252]; // #F8FAFC
            data.cell.styles.textColor = [148, 163, 184]; // #94A3B8
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 135;

    // ── 6. Bloque Formal de Firmas Institucionales (3 Columnas Anti-Colisión) ──
    const yFirmas = Math.min(176, Math.max(finalY + 3.5, 136));
    const colWidth = (pageWidth - 28) / 3;

    const rolesFirmas = [
      {
        titulo: fila.encabezado.startsWith("DOCENTE") ? "DOCENTE DE LA ASIGNATURA" : "ASESOR / TITULAR DE GRUPO",
        subtitulo: "Nombre y Firma"
      },
      {
        titulo: "DIRECCIÓN DEL PLANTEL",
        subtitulo: "Sello y Firma Oficial"
      },
      {
        titulo: `SUPERVISIÓN ESCOLAR ${zonaTexto}`,
        subtitulo: "Vo. Bo. Supervisión Escolar"
      }
    ];

    rolesFirmas.forEach((rf, i) => {
      const x = 14 + i * colWidth;
      const boxW = 26;
      const boxH = 10;

      // Caja punteada para sello oficial
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.18);
      doc.setLineDashPattern([1, 1], 0);
      doc.rect(x + (colWidth / 2) - (boxW / 2), yFirmas, boxW, boxH);
      doc.setLineDashPattern([], 0);

      // Línea sólida de firma
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.35);
      doc.line(x + 10, yFirmas + 13.5, x + colWidth - 10, yFirmas + 13.5);

      // Texto de firmas
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...NAVY_RGB);
      doc.text(rf.titulo, x + (colWidth / 2), yFirmas + 17, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text(rf.subtitulo, x + (colWidth / 2), yFirmas + 20, { align: "center" });
    });

    // ── 7. Pie de Página con Trazabilidad y Paginación ──
    const pageNum = idxFila + 1;
    doc.setDrawColor(...NAVY_RGB);
    doc.setLineWidth(0.25);
    doc.line(14, pageHeight - 9, pageWidth - 14, pageHeight - 9);

    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `SIGPDA-EMS — Sistema Integral de Gestión de Planeación Didáctica Automatizada  |  Generado: ${new Date().toLocaleDateString("es-MX")}`,
      14,
      pageHeight - 5.5
    );
    doc.text(
      `Documento Oficial de Horarios  |  Hoja ${pageNum} de ${totalFilas}`,
      pageWidth - 14,
      pageHeight - 5.5,
      { align: "right" }
    );
  });

  const fileName = `Horario_Oficial_${datos.cct}_${datos.tipoVista}.pdf`;
  doc.save(fileName);
}

// =========================================================================
// 2. EXPORTACIÓN A WORD (.DOCX) — Horizontal (Landscape Carta / Letter Garantizado)
// =========================================================================
export async function exportarHorarioDOCX(datos: DatosExportacionHorario) {
  const NAVY = "1E3A8A";
  const BORDER = "E2E8F0";
  const zonaTexto = datos.zonaEscolar ? (datos.zonaEscolar.toLowerCase().includes("zona") ? datos.zonaEscolar.toUpperCase() : `ZONA ${datos.zonaEscolar}`) : "ZONA 004";

  // Dimensiones Carta Horizontal en DXA (1 pulgada = 1440 DXA)
  // Ancho: 11 in * 1440 = 15840 DXA. Alto: 8.5 in * 1440 = 12240 DXA.
  // Márgenes: 720 DXA (0.5 in). Ancho útil = 14400 DXA.
  const COL_PERIODO_DXA = 2000;
  const COL_DIA_DXA = 2480; // 5 * 2480 = 12400 DXA. Total = 14400 DXA.

  const sections = datos.filas.map((fila) => {
    const children: any[] = [];

    // 1. Membrete Institucional Centrado Formal
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 15 },
        children: [
          new TextRun({
            text: "GOBIERNO DEL ESTADO DE PUEBLA",
            bold: true,
            size: 19, // 9.5pt
            color: NAVY,
            font: "Helvetica"
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 15 },
        children: [
          new TextRun({
            text: "SECRETARÍA DE EDUCACIÓN PÚBLICA",
            bold: true,
            size: 17, // 8.5pt
            color: NAVY,
            font: "Helvetica"
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 15 },
        children: [
          new TextRun({
            text: "SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR Y SUPERIOR",
            size: 14, // 7pt
            color: "475569",
            font: "Helvetica"
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 15 },
        children: [
          new TextRun({
            text: "DIRECCIÓN DE BACHILLERATOS GENERALES",
            bold: true,
            size: 16, // 8pt
            color: "1e293b",
            font: "Helvetica"
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 30 },
        children: [
          new TextRun({
            text: `SUPERVISIÓN ESCOLAR ${zonaTexto}`,
            size: 15,
            color: "1e293b",
            font: "Helvetica"
          })
        ]
      }),
      // Línea divisoria
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY } },
        spacing: { after: 50 },
        children: []
      }),
      // Barra de Metadatos
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 25 },
        children: [
          new TextRun({
            text: `PLANTEL: ${datos.nombreEscuela.toUpperCase()}   •   C.C.T.: ${datos.cct.toUpperCase()}   •   SUPERVISIÓN: ${zonaTexto}`,
            bold: true,
            size: 16,
            color: "0f172a",
            font: "Helvetica"
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: `HORARIO OFICIAL: ${fila.encabezado.toUpperCase()} ${fila.subtitulo ? " - " + fila.subtitulo : ""}   •   CICLO ESCOLAR ${datos.cicloEscolar || "2026-2027"}`,
            bold: true,
            size: 16,
            color: NAVY,
            font: "Helvetica"
          })
        ]
      })
    );

    // 2. Cabecera de la tabla
    const headerCells = ["Periodo", ...datos.dias].map(
      (d) =>
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: d.toUpperCase(), bold: true, size: 16, color: "FFFFFF" })]
            })
          ],
          shading: { type: ShadingType.CLEAR, fill: NAVY },
          width: { size: d === "Periodo" ? COL_PERIODO_DXA : COL_DIA_DXA, type: WidthType.DXA }
        })
    );
    const headerRow = new TableRow({ children: headerCells, tableHeader: true, cantSplit: true });

    // 3. Filas de la tabla con colores pastel y nombres completos
    const bodyRows: TableRow[] = [];
    for (let p = 0; p < datos.periodos.length; p++) {
      const cells: TableCell[] = [
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `Hora ${p + 1}`, bold: true, size: 15, color: NAVY })]
            })
          ],
          shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
          width: { size: COL_PERIODO_DXA, type: WidthType.DXA }
        })
      ];

      for (let d = 1; d <= datos.dias.length; d++) {
        const key = `${d}_${p + 1}`;
        const val = fila.celdas[key];
        let matNombre = "";
        let docenteNombre = "";
        let grupoNombre = "";
        let aulaNombre = "";

        if (!val || val === "Libre") {
          matNombre = "Libre";
        } else if (typeof val === "string") {
          matNombre = val;
        } else {
          matNombre = val.materia || "Libre";
          if (val.docente && !fila.encabezado.startsWith("DOCENTE")) docenteNombre = `Prof. ${val.docente}`;
          if (val.grupo && !fila.encabezado.startsWith("GRUPO")) grupoNombre = `Gpo: ${val.grupo}`;
          if (val.aula) aulaNombre = `[${val.aula}]`;
        }

        const isFree = matNombre === "Libre";
        const colors = getSubjectColors(matNombre);

        const parrafos: Paragraph[] = [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 15 },
            children: [
              new TextRun({
                text: matNombre,
                bold: !isFree,
                size: 15, // 7.5pt bold para materia completa
                color: isFree ? "94A3B8" : colors.pastelText
              })
            ]
          })
        ];

        if (docenteNombre) {
          parrafos.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 10 },
              children: [
                new TextRun({
                  text: docenteNombre,
                  size: 13, // 6.5pt
                  color: "334155"
                })
              ]
            })
          );
        }

        if (grupoNombre || aulaNombre) {
          parrafos.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `${grupoNombre} ${aulaNombre}`.trim(),
                  size: 12, // 6pt
                  color: "64748B"
                })
              ]
            })
          );
        }

        cells.push(
          new TableCell({
            children: parrafos,
            shading: { type: ShadingType.CLEAR, fill: colors.pastelBg },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
              left: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
              right: { style: BorderStyle.SINGLE, size: 4, color: BORDER }
            },
            width: { size: COL_DIA_DXA, type: WidthType.DXA }
          })
        );
      }
      bodyRows.push(new TableRow({ children: cells, cantSplit: true }));
    }

    const tabla = new Table({
      rows: [headerRow, ...bodyRows],
      width: { size: 14400, type: WidthType.DXA }
    });

    // 4. Tabla de Firmas en 3 Columnas Horizontal
    const rolesFirmas = [
      fila.encabezado.startsWith("DOCENTE") ? "Docente de la Asignatura" : "Asesor / Titular de Grupo",
      "Dirección del Plantel",
      `Supervisión Escolar ${zonaTexto}`
    ];

    const tablaFirmas = new Table({
      width: { size: 14400, type: WidthType.DXA },
      columnWidths: [4800, 4800, 4800],
      rows: [
        new TableRow({
          cantSplit: true,
          children: rolesFirmas.map(() =>
            new TableCell({
              width: { size: 4800, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "334155" } },
              children: [
                new Paragraph({ text: "", spacing: { after: 100 } })
              ]
            })
          )
        }),
        new TableRow({
          cantSplit: true,
          children: rolesFirmas.map(
            (role) =>
              new TableCell({
                width: { size: 4800, type: WidthType.DXA },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: role, bold: true, size: 14, color: NAVY })]
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: "Sello y Firma Oficial", size: 12, color: "64748b" })]
                  })
                ]
              })
          )
        })
      ]
    });

    children.push(
      tabla,
      new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }),
      tablaFirmas
    );

    return {
      properties: {
        page: {
          size: {
            orientation: PageOrientation.LANDSCAPE,
            width: 12240, // 8.5 in (docx library swaps width and height when LANDSCAPE is set)
            height: 15840 // 11 in -> genera w:w="15840" w:h="12240" (Horizontal nativo en Word)
          },
          margin: { top: 540, bottom: 540, left: 720, right: 720 }
        }
      },
      children
    };
  });

  const doc = new Document({ sections });
  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Horario_Oficial_${datos.cct}_${datos.tipoVista}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// =========================================================================
// 3. EXPORTACIÓN A EXCEL (.XLSX) — ExcelJS con formato condicional y membrete dinámico
// =========================================================================
export async function exportarHorarioExcel(datos: DatosExportacionHorario) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIGPDA-EMS";
  wb.created = new Date();
  const zonaTexto = datos.zonaEscolar ? (datos.zonaEscolar.toLowerCase().includes("zona") ? datos.zonaEscolar.toUpperCase() : `ZONA ${datos.zonaEscolar}`) : "ZONA 004";

  for (const fila of datos.filas) {
    const sheetName = fila.encabezado.replace(/[\\/?*:[\]]/g, "_").slice(0, 30);
    const ws = wb.addWorksheet(sheetName, {
      views: [{ state: "frozen", ySplit: 6 }]
    });

    // 1. Membrete Institucional en Filas 1 a 4
    ws.mergeCells("A1:F1");
    const cellA1 = ws.getCell("A1");
    cellA1.value = "GOBIERNO DEL ESTADO DE PUEBLA · SECRETARÍA DE EDUCACIÓN PÚBLICA";
    cellA1.font = { bold: true, size: 11, color: { argb: "FF1E3A8A" } };
    cellA1.alignment = { horizontal: "center", vertical: "middle" };

    ws.mergeCells("A2:F2");
    const cellA2 = ws.getCell("A2");
    cellA2.value = `SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR Y SUPERIOR · SUPERVISIÓN ESCOLAR ${zonaTexto}`;
    cellA2.font = { bold: true, size: 10, color: { argb: "FF1E3A8A" } };
    cellA2.alignment = { horizontal: "center", vertical: "middle" };

    ws.mergeCells("A3:F3");
    const cellA3 = ws.getCell("A3");
    cellA3.value = `PLANTEL: ${datos.nombreEscuela.toUpperCase()}   C.C.T.: ${datos.cct.toUpperCase()}   CICLO ESCOLAR: ${datos.cicloEscolar || "2026-2027"}`;
    cellA3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cellA3.font = { bold: true, size: 9, color: { argb: "FF334155" } };
    cellA3.alignment = { horizontal: "center", vertical: "middle" };

    ws.mergeCells("A4:F4");
    const cellA4 = ws.getCell("A4");
    cellA4.value = `${fila.encabezado.toUpperCase()} ${fila.subtitulo ? " - " + fila.subtitulo : ""}`;
    cellA4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cellA4.font = { bold: true, size: 10, color: { argb: "FF1E3A8A" } };
    cellA4.alignment = { horizontal: "center", vertical: "middle" };

    // Fila 5: Espacio
    ws.getRow(5).height = 8;

    // Fila 6: Encabezados de Columna
    const headerRow = ws.getRow(6);
    headerRow.values = ["Periodo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FF334155" } },
        bottom: { style: "medium", color: { argb: "FF1E3A8A" } },
        left: { style: "thin", color: { argb: "FF334155" } },
        right: { style: "thin", color: { argb: "FF334155" } }
      };
    });

    // Filas 7+: Contenido de Horario con wrapText y nombres completos
    datos.periodos.forEach((_, pIdx) => {
      const rowNum = 7 + pIdx;
      const row = ws.getRow(rowNum);
      row.height = 42;

      const pCell = row.getCell(1);
      pCell.value = `Hora ${pIdx + 1}`;
      pCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      pCell.font = { bold: true, color: { argb: "FF1E3A8A" }, size: 9 };
      pCell.alignment = { horizontal: "center", vertical: "middle" };
      pCell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } }
      };

      for (let d = 1; d <= 5; d++) {
        const cell = row.getCell(d + 1);
        const key = `${d}_${pIdx + 1}`;
        const val = fila.celdas[key];

        if (!val || val === "Libre") {
          cell.value = "Libre";
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          cell.font = { italic: true, color: { argb: "FF94A3B8" }, size: 8.5 };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (typeof val === "string") {
          const colors = getSubjectColors(val);
          cell.value = val;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${colors.pastelBg}` } };
          cell.font = { bold: true, color: { argb: `FF${colors.pastelText}` }, size: 9 };
          cell.alignment = { wrapText: true, horizontal: "center", vertical: "middle" };
        } else {
          const colors = getSubjectColors(val.materia);
          const lineas: string[] = [val.materia];
          if (val.docente && !fila.encabezado.startsWith("DOCENTE")) lineas.push(`Prof. ${val.docente}`);
          if (val.grupo && !fila.encabezado.startsWith("GRUPO")) lineas.push(`Gpo: ${val.grupo}`);
          if (val.aula) lineas.push(`[${val.aula}]`);

          cell.value = lineas.join("\n");
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${colors.pastelBg}` } };
          cell.font = { bold: true, color: { argb: `FF${colors.pastelText}` }, size: 8.5 };
          cell.alignment = { wrapText: true, horizontal: "center", vertical: "middle" };
        }

        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      }
    });

    // Ajuste de Anchos de Columna
    ws.columns = [
      { width: 14 },
      { width: 30 },
      { width: 30 },
      { width: 30 },
      { width: 30 },
      { width: 30 }
    ];
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Horario_${datos.cct}_${datos.tipoVista}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// Sumario Maestro / Grupo en Excel con ExcelJS
export async function exportarSumarioExcel(datos: DatosSumario, tipo: "DOCENTE" | "GRUPO") {
  const wb = new ExcelJS.Workbook();
  const { dias, numHorasPorDia } = datos;
  const zonaTexto = datos.zonaEscolar ? (datos.zonaEscolar.toLowerCase().includes("zona") ? datos.zonaEscolar.toUpperCase() : `ZONA ${datos.zonaEscolar}`) : "ZONA 004";

  const ws = wb.addWorksheet(tipo === "DOCENTE" ? "Sumario Maestros" : "Sumario Grupos", {
    views: [{ state: "frozen", ySplit: 5, xSplit: 1 }]
  });

  const totalCols = 1 + (dias.length * numHorasPorDia);

  // Membrete
  ws.mergeCells(1, 1, 1, totalCols);
  const c1 = ws.getCell(1, 1);
  c1.value = `SECRETARÍA DE EDUCACIÓN PÚBLICA · SUPERVISIÓN ESCOLAR ${zonaTexto} · PLANTEL: ${datos.nombreEscuela.toUpperCase()} (${datos.cct})`;
  c1.font = { bold: true, size: 11, color: { argb: "FF1E3A8A" } };
  c1.alignment = { horizontal: "center" };

  ws.mergeCells(2, 1, 2, totalCols);
  const c2 = ws.getCell(2, 1);
  c2.value = `SUMARIO ${tipo === "DOCENTE" ? "MAESTRO OFICIAL" : "POR GRUPOS"} · HORARIO SEMANAL COMPLETO`;
  c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  c2.font = { bold: true, size: 10, color: { argb: "FF334155" } };
  c2.alignment = { horizontal: "center" };

  // Encabezados
  const headerValues = [tipo === "DOCENTE" ? "Docente" : "Grupo"];
  for (let d = 0; d < dias.length; d++) {
    for (let h = 1; h <= numHorasPorDia; h++) {
      headerValues.push(`${dias[d].substring(0, 3)}/H${h}`);
    }
  }

  const headerRow = ws.getRow(4);
  headerRow.values = headerValues;
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // Datos con nombres completos
  datos.entidades.forEach((entidad, idx) => {
    const row = ws.getRow(5 + idx);
    row.height = 32;
    const cellE = row.getCell(1);
    cellE.value = entidad.etiqueta;
    cellE.font = { bold: true, size: 9 };
    cellE.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

    let colIdx = 2;
    for (let d = 1; d <= dias.length; d++) {
      for (let h = 1; h <= numHorasPorDia; h++) {
        const cell = row.getCell(colIdx++);
        const celda = datos.obtenerCelda(entidad.id, d, h);
        if (celda && celda.texto) {
          const colors = getSubjectColors(celda.texto);
          cell.value = celda.texto;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${colors.pastelBg}` } };
          cell.font = { bold: true, color: { argb: `FF${colors.pastelText}` }, size: 8 };
        } else {
          cell.value = "—";
          cell.font = { color: { argb: "FF94A3B8" }, size: 8 };
        }
        cell.alignment = { wrapText: true, horizontal: "center", vertical: "middle" };
      }
    }
  });

  // Auto anchos
  ws.columns = [
    { width: 34 },
    ...Array.from({ length: totalCols - 1 }, () => ({ width: 19 }))
  ];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Sumario_${tipo === "DOCENTE" ? "Maestro" : "Grupos"}_${datos.cct}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// =========================================================================
// 4. EXPORTACIÓN A WHATSAPP / REDES SOCIALES — Canvas 2D Nombres Completos y Cero Espacio Muerto
// =========================================================================

/**
 * Función auxiliar para dibujar texto multilínea sin truncar artificialmente
 */
function wrapTextCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 4
): number {
  const words = text.split(" ");
  let line = "";
  let linesCount = 0;
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
      linesCount++;
      if (linesCount >= maxLines - 1 && n < words.length - 1) {
        const remainingWords = words.slice(n).join(" ");
        let truncated = remainingWords;
        while (ctx.measureText(truncated + "...").width > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + "...", x, currentY);
        return currentY + lineHeight;
      }
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
  return currentY + lineHeight;
}

/**
 * Función auxiliar para dibujar rectángulos redondeados en Canvas
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill = true,
  stroke = false
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

/**
 * Exportador nativo ultra-robusto usando HTML5 Canvas 2D
 * Garantiza cero pantallas negras, rendering nítido, nombres completos y máximo aprovechamiento visual.
 */
export async function exportarHorarioWhatsApp(
  datos: DatosExportacionHorario,
  formato: "square" | "story" = "square"
) {
  const isStory = formato === "story";
  const width = 1080;
  const height = isStory ? 1920 : 1080;

  const fila = datos.filas[0];
  if (!fila) return;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const zonaTexto = datos.zonaEscolar ? (datos.zonaEscolar.toLowerCase().includes("zona") ? datos.zonaEscolar.toUpperCase() : `ZONA ${datos.zonaEscolar}`) : "ZONA 004";

  // ── 1. Fondo Oscuro Cyber Degradado ──
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#060913");
  bgGrad.addColorStop(0.4, "#0b0f19");
  bgGrad.addColorStop(1, "#0f172a");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Resplandor superior sutil
  const glowGrad = ctx.createRadialGradient(width / 2, 0, 20, width / 2, 0, 700);
  glowGrad.addColorStop(0, "rgba(34, 211, 238, 0.22)");
  glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, width, 700);

  const padX = isStory ? 42 : 36;
  const padY = isStory ? 55 : 32;

  // ── 2. Header Institucional Neón ──
  const iconSize = isStory ? 56 : 46;
  ctx.fillStyle = "#1E293B";
  ctx.strokeStyle = "#38BDF8";
  ctx.lineWidth = 2;
  roundRect(ctx, padX, padY, iconSize, iconSize, 12, true, true);

  ctx.fillStyle = "#38BDF8";
  ctx.font = `bold ${isStory ? "28px" : "24px"} system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🎓", padX + iconSize / 2, padY + iconSize / 2);

  // Nombre de Escuela y CCT
  ctx.textAlign = "left";
  ctx.fillStyle = "#22D3EE";
  ctx.font = `900 ${isStory ? "24px" : "19px"} system-ui, -apple-system, sans-serif`;
  ctx.shadowColor = "rgba(34, 211, 238, 0.6)";
  ctx.shadowBlur = 8;
  ctx.fillText(datos.nombreEscuela.toUpperCase(), padX + iconSize + 14, padY + (isStory ? 20 : 17));

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#94A3B8";
  ctx.font = `600 ${isStory ? "14.5px" : "12.5px"} system-ui, -apple-system, sans-serif`;
  ctx.fillText(`C.C.T.: ${datos.cct.toUpperCase()}   •   CICLO: ${datos.cicloEscolar || "2026-2027"}`, padX + iconSize + 14, padY + (isStory ? 44 : 37));

  // Badge Zona Escolar
  const badgeW = isStory ? 140 : 120;
  const badgeH = isStory ? 38 : 32;
  const badgeX = width - padX - badgeW;
  const badgeY = padY + 6;
  ctx.fillStyle = "rgba(34, 211, 238, 0.14)";
  ctx.strokeStyle = "#22D3EE";
  ctx.lineWidth = 1.5;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 16, true, true);

  ctx.textAlign = "center";
  ctx.fillStyle = "#22D3EE";
  ctx.font = `800 ${isStory ? "13px" : "11.5px"} system-ui, -apple-system, sans-serif`;
  ctx.fillText(zonaTexto, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);

  // Línea divisoria superior
  const divY1 = padY + (isStory ? 74 : 58);
  ctx.strokeStyle = "#1E293B";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, divY1);
  ctx.lineTo(width - padX, divY1);
  ctx.stroke();

  // ── 3. Título del Horario / Entidad ──
  const titleY = divY1 + (isStory ? 34 : 26);
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 ${isStory ? "34px" : "26px"} system-ui, -apple-system, sans-serif`;
  ctx.shadowColor = "rgba(255, 255, 255, 0.3)";
  ctx.shadowBlur = 6;
  ctx.fillText(fila.encabezado.toUpperCase(), padX, titleY);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#A3E635"; // Verde lima neón
  ctx.font = `bold ${isStory ? "15px" : "12.5px"} system-ui, -apple-system, sans-serif`;
  ctx.fillText(`HORARIO OFICIAL DE CLASES • TURNO MATUTINO`, padX, titleY + (isStory ? 24 : 18));

  // ── 4. Matriz de Horario Semanal (5 Columnas) ──
  const gridStartY = titleY + (isStory ? 42 : 30);
  const footerHeight = isStory ? 55 : 42;
  const gridEndY = height - padY - footerHeight;
  const gridHeight = gridEndY - gridStartY;

  const numDias = 5;
  const colGap = isStory ? 10 : 8;
  const availableW = width - padX * 2 - (colGap * (numDias - 1));
  const colW = availableW / numDias;

  const numPeriodos = datos.periodos.length;
  const headerColH = isStory ? 38 : 28;
  const cellGap = isStory ? 10 : 6;
  const availableCellH = gridHeight - headerColH - 8 - (cellGap * (numPeriodos - 1));
  const cellH = Math.max(40, Math.floor(availableCellH / numPeriodos));

  for (let d = 1; d <= numDias; d++) {
    const colX = padX + (d - 1) * (colW + colGap);
    const diaNombre = datos.dias[d - 1] || `Día ${d}`;

    // Cabecera del día
    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    roundRect(ctx, colX, gridStartY, colW, headerColH, 8, true, true);

    ctx.textAlign = "center";
    ctx.fillStyle = "#F472B6"; // Rosa Neón
    ctx.font = `800 ${isStory ? "14px" : "12px"} system-ui, -apple-system, sans-serif`;
    ctx.shadowColor = "rgba(244, 114, 182, 0.5)";
    ctx.shadowBlur = 4;
    ctx.fillText(diaNombre.toUpperCase(), colX + colW / 2, gridStartY + headerColH / 2 + 1);
    ctx.shadowBlur = 0;

    // Celdas de cada periodo
    for (let p = 1; p <= numPeriodos; p++) {
      const cellY = gridStartY + headerColH + 8 + (p - 1) * (cellH + cellGap);
      const val = fila.celdas[`${d}_${p}`];

      if (!val || val === "Libre") {
        // Celda Libre
        ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
        ctx.strokeStyle = "#1E293B";
        ctx.lineWidth = 1;
        roundRect(ctx, colX, cellY, colW, cellH, 8, true, true);

        ctx.textAlign = "center";
        ctx.fillStyle = "#475569";
        ctx.font = `700 ${isStory ? "12px" : "10px"} system-ui, -apple-system, sans-serif`;
        ctx.fillText(`H${p}`, colX + colW / 2, cellY + cellH / 2 - (isStory ? 8 : 6));
        ctx.fillStyle = "#64748B";
        ctx.font = `italic ${isStory ? "13px" : "10.5px"} system-ui, -apple-system, sans-serif`;
        ctx.fillText("Libre", colX + colW / 2, cellY + cellH / 2 + (isStory ? 10 : 7));
      } else {
        // Celda con Materia
        const mat = typeof val === "string" ? val : val.materia;
        const doc = typeof val === "object" ? val.docente : undefined;
        const gpo = typeof val === "object" ? val.grupo : undefined;
        const colors = getSubjectColors(mat);

        // Fondo de tarjeta
        ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        roundRect(ctx, colX, cellY, colW, cellH, 8, true, true);

        // Barra lateral neón de color
        ctx.fillStyle = colors.neon;
        ctx.shadowColor = colors.neonGlow;
        ctx.shadowBlur = 6;
        ctx.fillRect(colX, cellY + 3, 4, cellH - 6);
        ctx.shadowBlur = 0;

        if (isStory) {
          // ── STORY (9:16) ULTRA-ENRIQUECIDO — Cero espacio muerto ──
          // Badge Periodo y Hora
          ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 1;
          roundRect(ctx, colX + 8, cellY + 8, 36, 20, 6, true, true);

          ctx.textAlign = "center";
          ctx.fillStyle = "#38BDF8";
          ctx.font = "bold 10.5px system-ui, -apple-system, sans-serif";
          ctx.fillText(`H${p}`, colX + 26, cellY + 18);

          if (gpo || fila.encabezado.startsWith("DOCENTE")) {
            const tagGpo = gpo ? `Gpo ${gpo}` : "";
            if (tagGpo) {
              ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
              ctx.strokeStyle = "#38BDF8";
              roundRect(ctx, colX + colW - 58, cellY + 8, 50, 20, 6, true, true);
              ctx.fillStyle = "#38BDF8";
              ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
              ctx.fillText(tagGpo, colX + colW - 33, cellY + 18);
            }
          }

          // Nombre de la Materia Completo (Neón)
          ctx.textAlign = "left";
          ctx.fillStyle = colors.neon;
          ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
          ctx.shadowColor = colors.neonGlow;
          ctx.shadowBlur = 5;
          const endY = wrapTextCanvas(ctx, mat, colX + 8, cellY + 44, colW - 16, 17, 5);
          ctx.shadowBlur = 0;

          // Docente en Tarjeta Inferior
          if (doc && !fila.encabezado.startsWith("DOCENTE")) {
            const docBoxY = Math.max(endY + 6, cellY + cellH - 46);
            const docBoxH = 38;
            ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
            ctx.strokeStyle = "#334155";
            ctx.lineWidth = 1;
            roundRect(ctx, colX + 6, docBoxY, colW - 12, docBoxH, 6, true, true);

            ctx.fillStyle = "#94A3B8";
            ctx.font = "700 9.5px system-ui, -apple-system, sans-serif";
            ctx.fillText("👨‍🏫 DOCENTE:", colX + 10, docBoxY + 13);

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
            wrapTextCanvas(ctx, doc, colX + 10, docBoxY + 28, colW - 20, 12, 1);
          }
        } else {
          // ── SQUARE (1:1) — Nombres Completos y Óptima Jerarquía ──
          // Badge de Periodo
          ctx.textAlign = "left";
          ctx.fillStyle = "#94A3B8";
          ctx.font = "bold 9px system-ui, -apple-system, sans-serif";
          ctx.fillText(`H${p}`, colX + 8, cellY + 12);

          if (gpo && !fila.encabezado.startsWith("GRUPO")) {
            ctx.textAlign = "right";
            ctx.fillStyle = "#38BDF8";
            ctx.font = "bold 9px system-ui, -apple-system, sans-serif";
            ctx.fillText(`[${gpo}]`, colX + colW - 6, cellY + 12);
          }

          // Nombre de la Materia Completo
          ctx.textAlign = "left";
          ctx.fillStyle = colors.neon;
          const isMatLong = mat.length > 32;
          ctx.font = `bold ${isMatLong ? "10.5px" : "11.5px"} system-ui, -apple-system, sans-serif`;
          ctx.shadowColor = colors.neonGlow;
          ctx.shadowBlur = 4;
          const endMatY = wrapTextCanvas(ctx, mat, colX + 8, cellY + 25, colW - 14, isMatLong ? 12.5 : 13.5, 4);
          ctx.shadowBlur = 0;

          // Docente Completo al Pie de Celda
          if (doc && !fila.encabezado.startsWith("DOCENTE")) {
            ctx.fillStyle = "#E2E8F0";
            ctx.font = "600 9px system-ui, -apple-system, sans-serif";
            const docY = Math.max(endMatY + 4, cellY + cellH - 7);
            wrapTextCanvas(ctx, `Prof. ${doc}`, colX + 8, docY, colW - 14, 10.5, 2);
          }
        }
      }
    }
  }

  // ── 5. Footer Neón ──
  const footY = height - padY;
  ctx.strokeStyle = "#1E293B";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(padX, footY - (isStory ? 20 : 15));
  ctx.lineTo(width - padX, footY - (isStory ? 20 : 15));
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#64748B";
  ctx.font = `600 ${isStory ? "13px" : "11px"} system-ui, -apple-system, sans-serif`;
  ctx.fillText(`⚡ SISAT-ATP — Sistema Integral de Supervisión y Asistencia Técnica Pedagógica`, padX, footY);

  // Badge Redes
  const badgeSocialW = isStory ? 210 : 180;
  const badgeSocialH = isStory ? 28 : 24;
  const badgeSocialX = width - padX - badgeSocialW;
  const badgeSocialY = footY - (isStory ? 16 : 14);

  ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
  ctx.strokeStyle = "#10B981";
  ctx.lineWidth = 1;
  roundRect(ctx, badgeSocialX, badgeSocialY, badgeSocialW, badgeSocialH, 12, true, true);

  ctx.textAlign = "center";
  ctx.fillStyle = "#34D399";
  ctx.font = `bold ${isStory ? "11.5px" : "10px"} system-ui, -apple-system, sans-serif`;
  ctx.fillText("📱 Válido para WhatsApp & Redes", badgeSocialX + badgeSocialW / 2, badgeSocialY + badgeSocialH / 2 + 1);

  // ── 6. Descarga del PNG ──
  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `Horario_WhatsApp_${datos.cct}_${fila.encabezado.replace(/\s+/g, "_")}.png`;
  a.click();
}
