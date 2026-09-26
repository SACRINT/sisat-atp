import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    const user = session?.user as any;

    const config = await prisma.preRevisionConfig.findUnique({
      where: { id: "singleton" },
      select: { mantenimiento: true }
    });

    const mantenimientoActivo = !!config?.mantenimiento;

    // Determinar si el usuario actual está exento de mantenimiento (Administradores o Escuela de Prueba)
    let esExento = false;
    if (user) {
      if (user.role === "admin") {
        esExento = true;
      } else if (user.cct) {
        const escuela = await prisma.escuela.findUnique({
          where: { cct: user.cct },
          select: { esDePrueba: true }
        });
        if (escuela?.esDePrueba) esExento = true;
      }
    }

    return NextResponse.json({
      mantenimiento: mantenimientoActivo,
      bloquear: mantenimientoActivo && !esExento
    });
  } catch (error: any) {
    // Detectar error de cuota agotada de Neon (código PG 53000)
    // para que el frontend pueda mostrar un mensaje diferenciado.
    const code = error?.cause?.code ?? error?.code ?? "";
    const isDbQuota = code === "53000" || String(error?.message ?? "").includes("exceeded the quota");

    return NextResponse.json(
      { mantenimiento: false, bloquear: false, db_error: isDbQuota },
      { status: isDbQuota ? 503 : 200 }
    );
  }
}
