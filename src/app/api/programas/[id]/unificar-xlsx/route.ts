import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getNombrePeriodo } from "@/lib/constants";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** 1 pixel in DrawingML EMUs at 96 DPI */
const EMU_PER_PIXEL = 9525;

function configureCloudinary() {
    cloudinary.config({
        cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
}

function parseCloudinaryUrl(url: string) {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(
        /res\.cloudinary\.com\/([^/]+)\/(\w+)\/upload\/(?:v\d+\/)?(.+)$/
    );
    if (!match) return null;

    const cloudName = match[1];
    const resourceType = match[2];
    const fullPath = match[3];
    const lastDot = fullPath.lastIndexOf(".");
    const format = lastDot > 0 ? fullPath.slice(lastDot + 1) : "";

    const publicId =
        resourceType === "raw"
            ? fullPath
            : (lastDot > 0 ? fullPath.slice(0, lastDot) : fullPath);

    return { cloudName, resourceType, publicId, format };
}

/**
 * Downloads file buffer with fallback between direct CDN URL and signed Cloudinary HMAC URL.
 */
async function fetchFileBuffer(fileUrl: string, driveId?: string | null): Promise<Buffer | null> {
    try {
        const directRes = await fetch(fileUrl, {
            headers: { "User-Agent": "SISAT-ATP/1.0" },
            signal: AbortSignal.timeout(10000),
        });
        if (directRes.ok) {
            const arr = await directRes.arrayBuffer();
            return Buffer.from(arr);
        }
    } catch {
        // Direct fetch failed, continue to Cloudinary fallback
    }

    try {
        const cloudName = process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET;

        if (cloudName && apiKey && apiSecret && fileUrl.includes("res.cloudinary.com")) {
            configureCloudinary();
            const parsed = parseCloudinaryUrl(fileUrl);
            const publicId = driveId || parsed?.publicId;
            if (publicId) {
                const signedUrl = cloudinary.utils.private_download_url(
                    publicId,
                    "",
                    { resource_type: "raw", type: "upload" }
                );
                const signedRes = await fetch(signedUrl, { signal: AbortSignal.timeout(10000) });
                if (signedRes.ok) {
                    const arr = await signedRes.arrayBuffer();
                    return Buffer.from(arr);
                }
            }
        }
    } catch (e) {
        console.warn(`[unificar-xlsx] Failed fallback download for ${fileUrl}:`, e);
    }
    return null;
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // 1. Auth check: Admin only
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const programaId = params.id;

        const body = await request.json().catch(() => ({}));
        const { periodoId } = body as { periodoId?: string };

        // 2. Query program and periods
        const programa = await prisma.programa.findUnique({
            where: { id: programaId },
            include: {
                periodos: {
                    include: {
                        entregas: {
                            include: {
                                escuela: true,
                                archivos: true,
                            }
                        }
                    }
                }
            }
        });

        if (!programa) {
            return NextResponse.json({ error: "Programa no encontrado" }, { status: 404 });
        }

        // 3. Find target period
        let targetPeriodo = periodoId
            ? programa.periodos.find(p => p.id === periodoId)
            : programa.periodos.find(p => p.activo) || programa.periodos.find(p =>
                p.entregas.some(e => e.archivos.some(a => a.nombre.toLowerCase().endsWith(".xlsx") || a.driveUrl?.toLowerCase().includes(".xlsx")))
            ) || programa.periodos[0];

        if (!targetPeriodo) {
            return NextResponse.json({ error: "No se encontró ningún periodo para este programa" }, { status: 404 });
        }

        // 4. Collect entregas that have .xlsx files
        const entregasConXlsx = targetPeriodo.entregas.filter(e =>
            e.archivos && e.archivos.some(a => a.driveUrl && (a.nombre.toLowerCase().endsWith(".xlsx") || a.driveUrl.toLowerCase().includes(".xlsx")))
        );

        if (entregasConXlsx.length === 0) {
            return NextResponse.json({
                error: "No se encontraron archivos de Excel (.xlsx) entregados en este periodo."
            }, { status: 404 });
        }

        // 5. Locate Master Template
        const candidatePaths = [
            path.join(process.cwd(), "documentos_referencia", "Dia_Naranja", "EVIDENCIA DE ACTIVIDADES DÍA NARANJA ZONA004.xlsx"),
            path.join(process.cwd(), "..", "documentos_referencia", "Dia_Naranja", "EVIDENCIA DE ACTIVIDADES DÍA NARANJA ZONA004.xlsx"),
        ];
        const templatePath = candidatePaths.find(p => fs.existsSync(p));

        if (!templatePath) {
            return NextResponse.json({
                error: "Plantilla maestra de Día Naranja no encontrada en el servidor."
            }, { status: 500 });
        }

        // 6. Read Master Template with ExcelJS
        const masterWb = new ExcelJS.Workbook();
        await masterWb.xlsx.readFile(templatePath);
        const masterWs = masterWb.worksheets[0];

        // Ensure Column G has ample width for side-by-side evidence images
        masterWs.getColumn("G").width = 78;

        // Detect schools in rows 18-34 of master template
        const escuelasMaster: Record<string, { row: number; label: string }> = {};
        for (let r = 18; r <= 34; r++) {
            const val = String(masterWs.getCell(`G${r}`).value || "").trim();
            const match = val.match(/\((21[A-Z0-9]+)\)/i);
            if (match) {
                escuelasMaster[match[1].toUpperCase()] = { row: r, label: val };
            }
        }

        // 7. Process each school's uploaded Excel file
        interface DatosEscuela {
            cct: string;
            nombreCt?: string;
            topCounts?: {
                mantenimiento: number | null;
                administrativos: number | null;
                docentes: number | null;
                directores: number | null;
                supervisores: number | null;
                atp: number | null;
                jefes: any;
            };
            actData?: {
                nombreCt: string | null;
                actividad: string;
                objetivo: string;
                descripcion: string;
            };
            images: { buffer: Buffer; extension: string }[];
        }

        const datosEscuelas: Record<string, DatosEscuela> = {};

        for (const entrega of entregasConXlsx) {
            const cct = entrega.escuela.cct.toUpperCase();
            // Find latest .xlsx file in entrega
            const archivoXlsx = entrega.archivos
                .filter(a => a.driveUrl && (a.nombre.toLowerCase().endsWith(".xlsx") || a.driveUrl.toLowerCase().includes(".xlsx")))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

            if (!archivoXlsx || !archivoXlsx.driveUrl) continue;

            const fileBuf = await fetchFileBuffer(archivoXlsx.driveUrl, archivoXlsx.driveId);
            if (!fileBuf) {
                console.warn(`[unificar-xlsx] Could not download file for CCT ${cct}`);
                continue;
            }

            try {
                const schoolWb = new ExcelJS.Workbook();
                await schoolWb.xlsx.load(fileBuf as any);
                const schoolWs = schoolWb.worksheets[0];

                // 7.1. Dynamic activity header detection (do NOT hardcode row 40)
                let actHeaderRow: number | null = null;
                for (let r = 20; r <= Math.min(schoolWs.rowCount, 55); r++) {
                    for (let c = 1; c <= 8; c++) {
                        const cellVal = String(schoolWs.getRow(r).getCell(c).value || "").trim().toUpperCase();
                        if (cellVal.includes("ACTIVIDAD") || cellVal.includes("OBJETIVO") || cellVal.includes("DESCRIPCI")) {
                            actHeaderRow = r;
                            break;
                        }
                    }
                    if (actHeaderRow) break;
                }

                // 7.2. Extract activity text
                let actData: DatosEscuela["actData"] = undefined;
                if (actHeaderRow) {
                    for (let r = actHeaderRow + 1; r <= Math.min(schoolWs.rowCount, actHeaderRow + 10); r++) {
                        const row = schoolWs.getRow(r);
                        const act = row.getCell(4).value;
                        const obj = row.getCell(5).value;
                        const desc = row.getCell(6).value;
                        const nombreCt = row.getCell(3).value;

                        if ((act || obj || desc) && String(act).trim() !== "#VALUE!") {
                            actData = {
                                nombreCt: nombreCt ? String(nombreCt).trim() : null,
                                actividad: act ? String(act).trim() : "",
                                objetivo: obj ? String(obj).trim() : "",
                                descripcion: desc ? String(desc).trim() : "",
                            };
                            break;
                        }
                    }
                }

                // 7.3. Extract personnel counts from top table
                let topCounts: DatosEscuela["topCounts"] = undefined;
                for (let r = 16; r <= Math.min(schoolWs.rowCount, 36); r++) {
                    const c7Val = String(schoolWs.getRow(r).getCell(7).value || "").trim().toUpperCase();
                    if (c7Val.includes(cct)) {
                        const getNum = (val: any) => {
                            if (val === null || val === undefined || val === "" || val === " ") return null;
                            const n = Number(val);
                            return isNaN(n) ? null : n;
                        };
                        topCounts = {
                            mantenimiento: getNum(schoolWs.getRow(r).getCell(8).value),
                            administrativos: getNum(schoolWs.getRow(r).getCell(9).value),
                            docentes: getNum(schoolWs.getRow(r).getCell(10).value),
                            directores: getNum(schoolWs.getRow(r).getCell(11).value),
                            supervisores: getNum(schoolWs.getRow(r).getCell(12).value),
                            atp: getNum(schoolWs.getRow(r).getCell(13).value),
                            jefes: schoolWs.getRow(r).getCell(14).value,
                        };
                        break;
                    }
                }

                // 7.4. Extract evidence photos (skip header logo at row < 10)
                const schoolImages = schoolWs.getImages();
                const validImages: { buffer: Buffer; extension: string }[] = [];
                for (const img of schoolImages) {
                    if (img.range.tl.row < 10) continue; // Skip header logo
                    const media = (schoolWb.model as any).media?.[parseInt(img.imageId)];
                    if (media && media.buffer) {
                        validImages.push({
                            buffer: media.buffer,
                            extension: media.extension
                        });
                    }
                }

                // Store if better than previous entry
                const prev = datosEscuelas[cct];
                if (!prev || (actData && !prev.actData) || (validImages.length > prev.images.length)) {
                    datosEscuelas[cct] = {
                        cct,
                        nombreCt: entrega.escuela.nombre,
                        topCounts,
                        actData,
                        images: validImages,
                    };
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[unificar-xlsx] Error parsing Excel for ${cct}:`, msg);
            }
        }

        // 8. Update Top Table (Personnel counts, rows 18-34)
        for (const [cct, info] of Object.entries(escuelasMaster)) {
            const sData = datosEscuelas[cct];
            if (sData && sData.topCounts) {
                const tc = sData.topCounts;
                const r = info.row;
                if (tc.mantenimiento !== null) masterWs.getCell(`H${r}`).value = tc.mantenimiento;
                if (tc.administrativos !== null) masterWs.getCell(`I${r}`).value = tc.administrativos;
                if (tc.docentes !== null) masterWs.getCell(`J${r}`).value = tc.docentes;
                if (tc.directores !== null) masterWs.getCell(`K${r}`).value = tc.directores;
                if (tc.supervisores !== null) masterWs.getCell(`L${r}`).value = tc.supervisores;
                if (tc.atp !== null) masterWs.getCell(`M${r}`).value = tc.atp;
                if (tc.jefes !== null && tc.jefes !== undefined) masterWs.getCell(`N${r}`).value = tc.jefes;
            }
        }

        // 9. Build Activity Table (Rows 40+, one row per school sorted by CCT)
        const cctsSorted = Object.keys(escuelasMaster).sort();
        let currentRow = 40;

        for (const cct of cctsSorted) {
            const info = escuelasMaster[cct];
            const sData = datosEscuelas[cct] || { cct, images: [] };
            const act = sData.actData || { nombreCt: null, actividad: "", objetivo: "", descripcion: "" };
            const images = sData.images || [];

            masterWs.getCell(`A${currentRow}`).value = "GEN004";
            masterWs.getCell(`B${currentRow}`).value = cct;
            const nombreCt = act.nombreCt || sData.nombreCt || info.label.split("(")[0].trim();
            masterWs.getCell(`C${currentRow}`).value = nombreCt;
            masterWs.getCell(`D${currentRow}`).value = act.actividad || "";
            masterWs.getCell(`E${currentRow}`).value = act.objetivo || "";
            masterWs.getCell(`F${currentRow}`).value = act.descripcion || "";
            masterWs.getCell(`G${currentRow}`).value = ""; // Image anchor cell

            // Format row cells (thin borders, Calibri 9pt, middle alignment)
            for (let c = 1; c <= 7; c++) {
                const cell = masterWs.getRow(currentRow).getCell(c);
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" }
                };
                cell.alignment = {
                    wrapText: true,
                    vertical: "middle",
                    horizontal: c <= 2 ? "center" : "left"
                };
                cell.font = { name: "Calibri", size: 9 };
            }

            // Layout evidence images side-by-side without overlapping!
            if (images.length > 0) {
                masterWs.getRow(currentRow).height = 195;
                const count = Math.min(images.length, 4);

                let imgW = 200;
                let imgH = 175;
                let startPx = 15;
                let gapPx = 10;

                if (count === 1) {
                    imgW = 220;
                    imgH = 175;
                    startPx = 25;
                } else if (count === 2) {
                    imgW = 160;
                    imgH = 175;
                    startPx = 15;
                    gapPx = 15;
                } else if (count === 3) {
                    imgW = 125;
                    imgH = 170;
                    startPx = 10;
                    gapPx = 10;
                } else if (count >= 4) {
                    imgW = 115;
                    imgH = 170;
                    startPx = 8;
                    gapPx = 8;
                }

                for (let i = 0; i < count; i++) {
                    const img = images[i];
                    const ext = (img.extension === "jpg" ? "jpeg" : img.extension) as "jpeg" | "png" | "gif";
                    const addedId = masterWb.addImage({
                        buffer: img.buffer as any,
                        extension: ext,
                    });

                    const colOffPx = startPx + i * (imgW + gapPx);
                    const rowOffPx = 12;

                    masterWs.addImage(addedId, {
                        tl: {
                            nativeCol: 6, // Column G (0-indexed)
                            nativeColOff: Math.floor(colOffPx * EMU_PER_PIXEL),
                            nativeRow: currentRow - 1,
                            nativeRowOff: Math.floor(rowOffPx * EMU_PER_PIXEL),
                        } as any,
                        ext: { width: imgW, height: imgH },
                        editAs: "oneCell"
                    });
                }
            } else {
                masterWs.getRow(currentRow).height = 55;
            }

            currentRow++;
        }

        // 10. Generate XLSX buffer and return as download
        const buffer = await masterWb.xlsx.writeBuffer();
        const periodoNombre = getNombrePeriodo(targetPeriodo, programa.nombre);
        const fileName = `CONCENTRADO_ZONAL_DIA_NARANJA_${periodoNombre.toUpperCase().replace(/[/\\?%*:|"<>]/g, "_")}.xlsx`;

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[unificar-xlsx] Unhandled error:", msg);
        return NextResponse.json({ error: `Error al unificar Excel: ${msg}` }, { status: 500 });
    }
}
