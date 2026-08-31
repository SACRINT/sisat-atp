import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { procesarBoletaOcr } from '@/lib/sisat/ocr-boletas';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const escuelaId = searchParams.get('escuelaId');
    const cicloEscolar = searchParams.get('cicloEscolar');

    const where: any = {};
    if (escuelaId) where.escuelaId = escuelaId;
    if (cicloEscolar) where.cicloEscolar = cicloEscolar;

    const boletas = await prisma.ocrBoleta.findMany({
      where,
      include: {
        escuela: {
          select: {
            id: true,
            nombre: true,
            cct: true,
            municipio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ boletas });
  } catch (error: any) {
    console.error('[API ocr/boletas GET error]:', error);
    return NextResponse.json(
      { error: 'Error al consultar boletas históricas procesadas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let escuelaId: string | null = null;
    let cicloEscolar: string = '2024-2025';
    let semestre: number | null = null;
    let grupo: string | null = null;
    let archivoUrl: string | null = null;
    let fileBuffer: Buffer | undefined;
    let mimeType: string = 'application/pdf';
    let rawText: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      escuelaId = formData.get('escuelaId') as string;
      cicloEscolar = (formData.get('cicloEscolar') as string) || '2024-2025';
      const semStr = formData.get('semestre') as string;
      if (semStr) semestre = parseInt(semStr, 10);
      grupo = (formData.get('grupo') as string) || null;
      archivoUrl = (formData.get('archivoUrl') as string) || null;
      rawText = (formData.get('rawText') as string) || undefined;

      const file = formData.get('file') as File | null;
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
        mimeType = file.type || 'application/pdf';
      }
    } else {
      const body = await request.json();
      escuelaId = body.escuelaId;
      cicloEscolar = body.cicloEscolar || '2024-2025';
      semestre = body.semestre ? parseInt(body.semestre, 10) : null;
      grupo = body.grupo || null;
      archivoUrl = body.archivoUrl || null;
      rawText = body.rawText || undefined;
      mimeType = body.mimeType || 'application/pdf';

      if (body.base64File) {
        const cleanBase64 = body.base64File.replace(/^data:[^;]+;base64,/, '');
        fileBuffer = Buffer.from(cleanBase64, 'base64');
      }
    }

    if (!escuelaId) {
      return NextResponse.json(
        { error: 'escuelaId es requerido para asociar la boleta procesada' },
        { status: 400 }
      );
    }

    // Procesar OCR con IA
    const resultado = await procesarBoletaOcr({
      fileBuffer,
      mimeType,
      escuelaId,
      cicloEscolarSugerido: cicloEscolar,
      rawText,
    });

    // Guardar en Neon DB
    const ocrBoleta = await prisma.ocrBoleta.create({
      data: {
        escuelaId,
        cicloEscolar: resultado.cicloEscolar || cicloEscolar,
        semestre: resultado.semestre || semestre,
        grupo: resultado.grupo || grupo,
        datosExtraidos: resultado as any,
        confidence: resultado.confidence,
        archivoUrl,
        procesadoPor: session.user.email,
      },
      include: {
        escuela: {
          select: { id: true, nombre: true, cct: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      ocrBoleta,
      resultado,
    });
  } catch (error: any) {
    console.error('[API ocr/boletas POST error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al procesar la boleta con OCR' },
      { status: 500 }
    );
  }
}
