"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Wrench } from "lucide-react";

export default function MantenimientoListener() {
  const pathname = usePathname();
  const [bloqueado, setBloqueado] = useState(false);

  // Determinar si debemos ejecutar la verificación (no en mantenimiento/login)
  const esRutaExcluida = pathname === "/mantenimiento" || pathname === "/login";

  const lastCheckRef = useRef<number>(0);

  const verificarEstado = useCallback(async (forzar = false) => {
    if (esRutaExcluida) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    const ahora = Date.now();
    // Throttle: no consultar más de 1 vez cada 3 minutos a menos que sea forzado por navegación
    if (!forzar && ahora - lastCheckRef.current < 180_000) return;
    lastCheckRef.current = ahora;

    try {
      const res = await fetch("/api/mantenimiento-status");
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
      /* Silencioso para no degradar UX */
    }
  }, [esRutaExcluida]);

  useEffect(() => {
    // 1. Verificar puntualmente al cambiar de página o montar
    verificarEstado(true);

    // 2. Al regresar a la pestaña tras haber estado oculta, verificar con throttle (máx. 1 vez cada 3 min)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        verificarEstado(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname, verificarEstado]);

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
