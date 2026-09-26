"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Wrench } from "lucide-react";

export default function MantenimientoListener() {
  const pathname = usePathname();
  const [bloqueado, setBloqueado] = useState(false);

  // Determinar si debemos ejecutar la verificación (no en mantenimiento/login)
  const esRutaExcluida = pathname === "/mantenimiento" || pathname === "/login";

  useEffect(() => {
    // No ejecutar si estamos en rutas excluidas
    if (esRutaExcluida) return;
    let timerId: any;

    const verificarEstado = async () => {
      // No consultar si la pestaña está oculta (ahorra CU-hours en Neon)
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/mantenimiento-status", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.bloquear) {
            setBloqueado(true);
            setTimeout(() => {
              window.location.href = "/mantenimiento";
            }, 2500);
          }
        }
      } catch {
        /* silencioso */
      }
    };

    // Verificar inmediatamente al cambiar de página
    verificarEstado();

    // Polling cada 60 segundos (antes: 15 s) — reduce consumo de CU-hours en Neon ~75 %
    timerId = setInterval(verificarEstado, 60_000);

    // Cuando el usuario vuelve a la pestaña, verificar de inmediato
    const handleVisibility = () => {
      if (document.visibilityState === "visible") verificarEstado();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname]);

  if (!bloqueado) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 99999,
      background: "rgba(15, 23, 42, 0.95)",
      backdropFilter: "blur(10px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1.5rem",
      color: "white",
      textAlign: "center"
    }}>
      <div style={{
        maxWidth: "480px",
        background: "#1e293b",
        border: "2px solid #f97316",
        borderRadius: "16px",
        padding: "2rem",
        boxShadow: "0 25px 50px -12px rgba(249, 115, 22, 0.35)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem"
      }}>
        <div style={{ background: "#ea580c", padding: "1rem", borderRadius: "50%", display: "flex" }}>
          <Wrench size={40} color="white" />
        </div>

        <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "#fdba74" }}>
          🚧 Modo Mantenimiento Activado
        </h2>

        <p style={{ margin: 0, fontSize: "0.9rem", color: "#cbd5e1", lineHeight: 1.5 }}>
          La plataforma ha entrado en mantenimiento programado. Por seguridad y protección de tus datos, tu sesión ha sido pausada.
        </p>

        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#f97316", background: "#431407", padding: "0.5rem 1rem", borderRadius: "8px" }}>
          Redirigiendo a pantalla de mantenimiento...
        </div>
      </div>
    </div>
  );
}
