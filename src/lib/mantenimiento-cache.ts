import { prisma } from "@/lib/db";

interface MantenimientoCache {
  mantenimiento: boolean;
  timestamp: number;
}

let cache: MantenimientoCache | null = null;
const CACHE_TTL_MS = 180_000; // 3 minutos de caché en memoria server-side

/**
 * Consulta el estado de mantenimiento con caché en memoria en el servidor.
 * Protege a Neon evitando que múltiples clientes o peticiones frecuentes
 * mantengan encendido el cómputo de la base de datos de manera innecesaria.
 */
export async function getMantenimientoActivo(): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.mantenimiento;
  }

  try {
    const config = await prisma.preRevisionConfig.findUnique({
      where: { id: "singleton" },
      select: { mantenimiento: true },
    });

    const activo = !!config?.mantenimiento;
    cache = {
      mantenimiento: activo,
      timestamp: now,
    };
    return activo;
  } catch (error) {
    // Si la BD falla transitoriamente y teníamos un valor en caché, devolverlo
    if (cache) {
      return cache.mantenimiento;
    }
    throw error;
  }
}

/**
 * Invalida inmediatamente la caché cuando el administrador cambia el modo mantenimiento.
 */
export function invalidarCacheMantenimiento(): void {
  cache = null;
}

/**
 * Actualiza de inmediato el valor en caché con el nuevo estado establecido por el admin.
 */
export function setCacheMantenimiento(valor: boolean): void {
  cache = {
    mantenimiento: valor,
    timestamp: Date.now(),
  };
}
