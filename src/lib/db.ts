import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createPrismaClient() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        // Permite que el endpoint de Neon escale a cero cuando no hay actividad.
        // Sin estos valores el pool mantiene la conexión indefinidamente y
        // consume las CU-hours del plan gratuito (límite: 100 CU-h/mes).
        max: 5,                      // máximo de conexiones concurrentes
        idleTimeoutMillis: 10_000,   // cierra conexiones inactivas tras 10 s
        connectionTimeoutMillis: 5_000, // falla rápido si la BD no responde en 5 s
        allowExitOnIdle: true,       // permite que el proceso termine aunque haya clientes inactivos
    });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
