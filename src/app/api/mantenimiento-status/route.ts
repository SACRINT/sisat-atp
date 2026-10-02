import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getMantenimientoActivo } from "@/lib/mantenimiento-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Obtener estado de mantenimiento desde la caché en memoria del servidor (TTL 3 min).
    // Esto previene que peticiones continuas de múltiples clientes mantengan encendido el cómputo de Neon.
    const mantenimientoActivo = await getMantenimientoActivo();

    // 2. Si el mantenimiento NO está activo (caso del 99.9% del tiempo), retornar de inmediato.
    // NUNCA consultar la tabla de escuelas en este escenario para evitar queries redundantes a Neon.
    if (!mantenimientoActivo) {
      return NextResponse.json(
        { mantenimiento: false, bloquear: false },
        {
          headers: {
            "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
          },
        }
      );
    }

    // 3. Únicamente si el mantenimiento ESTÁ ACTIVO, verificar si el usuario en sesión es administrador o escuela de prueba.
    const session = await auth();
    const user = session?.user as any;
    let esExento = false;

    if (user) {
      if (user.role === "admin") {
        esExento = true;
      } else if (user.cct) {
        const escuela = await prisma.escuela.findUnique({
          where: { cct: user.cct },
          select: { esDePrueba: true },
        });
        if (escuela?.esDePrueba) esExento = true;
      }
    }

    return NextResponse.json(
      {
        mantenimiento: true,
        bloquear: !esExento,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    // Cualquier falla de BD (cuota agotada, timeout, connection-refused) devuelve
    // 503 + db_error:true para que el pre-chequeo del login lo detecte correctamente.
    // db_quota:true distingue específicamente el error de cuota Neon (código 53000).
    const code = error?.cause?.code ?? error?.code ?? "";
    const isDbQuota = code === "53000" || String(error?.message ?? "").includes("exceeded the quota");
    console.error("[mantenimiento-status] BD no disponible:", error?.message);
    return NextResponse.json(
      { mantenimiento: false, bloquear: false, db_error: true, db_quota: isDbQuota },
      { status: 503 }
    );
  }
}
