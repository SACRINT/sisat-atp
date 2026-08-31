import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const escuelaId = searchParams.get('escuelaId');
    const tipoCedula = searchParams.get('tipoCedula');
    const estado = searchParams.get('estado');

    const where: any = {};
    if (escuelaId) where.escuelaId = escuelaId;
    if (tipoCedula) where.tipoCedula = tipoCedula;
    if (estado) where.estado = estado;

    // Si es un ATP o Admin, puede ver todas o filtrar por supervisadoPor
    const cedulas = await prisma.cedulaSupervision.findMany({
      where,
      include: {
        escuela: {
          select: {
            id: true,
            nombre: true,
            cct: true,
            municipio: true,
            localidad: true,
            director: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ cedulas });
  } catch (error: any) {
    console.error('[API cedulas GET error]:', error);
    return NextResponse.json(
      { error: 'Error al obtener cédulas de supervisión' },
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

    const body = await request.json();
    const {
      escuelaId,
      tipoCedula,
      estado = 'BORRADOR',
      campos,
      audioUrl,
      transcripcion,
      hallazgos,
      observacionesATP,
    } = body;

    if (!escuelaId || !tipoCedula || !campos) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios (escuelaId, tipoCedula, campos)' },
        { status: 400 }
      );
    }

    const cedula = await prisma.cedulaSupervision.create({
      data: {
        escuelaId,
        supervisadoPor: session.user.email,
        tipoCedula,
        estado,
        campos,
        audioUrl: audioUrl || null,
        transcripcion: transcripcion || null,
        hallazgos: hallazgos || null,
        observacionesATP: observacionesATP || null,
      },
      include: {
        escuela: {
          select: { id: true, nombre: true, cct: true },
        },
      },
    });

    return NextResponse.json({ cedula }, { status: 201 });
  } catch (error: any) {
    console.error('[API cedulas POST error]:', error);
    return NextResponse.json(
      { error: 'Error al registrar la cédula de supervisión' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, estado, campos, transcripcion, hallazgos, observacionesATP, audioUrl } = body;

    if (!id) {
      return NextResponse.json({ error: 'id requerido para actualizar' }, { status: 400 });
    }

    const updateData: any = {};
    if (estado !== undefined) updateData.estado = estado;
    if (campos !== undefined) updateData.campos = campos;
    if (transcripcion !== undefined) updateData.transcripcion = transcripcion;
    if (hallazgos !== undefined) updateData.hallazgos = hallazgos;
    if (observacionesATP !== undefined) updateData.observacionesATP = observacionesATP;
    if (audioUrl !== undefined) updateData.audioUrl = audioUrl;

    const updated = await prisma.cedulaSupervision.update({
      where: { id },
      data: updateData,
      include: {
        escuela: {
          select: { id: true, nombre: true, cct: true },
        },
      },
    });

    return NextResponse.json({ cedula: updated });
  } catch (error: any) {
    console.error('[API cedulas PUT error]:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la cédula de supervisión' },
      { status: 500 }
    );
  }
}
