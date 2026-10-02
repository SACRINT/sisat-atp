"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bell } from "lucide-react";
import CentroAlertasDrawer from "./CentroAlertasDrawer";
import { useUserIdle } from "@/hooks/useUserIdle";

interface AlertaBadgeProps {
  className?: string;
}

export default function AlertaBadge({ className = "" }: AlertaBadgeProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [totalNoLeidas, setTotalNoLeidas] = useState(0);
  const [totalCriticas, setTotalCriticas] = useState(0);
  const lastCheckRef = useRef<number>(0);

  // Detectar inactividad humana (2 minutos sin mover mouse/teclado/scroll)
  const isIdle = useUserIdle(120_000);

  const consultarConteoAlertas = useCallback(async (forzar = false) => {
    // Si la pestaña está oculta o el usuario está inactivo (sin forzar), no consultar a Neon
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (!forzar && isIdle) return;

    const ahora = Date.now();
    // Throttle mínimo de 2 minutos para evitar ráfagas
    if (!forzar && ahora - lastCheckRef.current < 120_000) return;
    lastCheckRef.current = ahora;

    try {
      const res = await fetch("/api/vigilancia/alertas?noLeidas=true");
      if (res.ok) {
        const data = await res.json();
        setTotalNoLeidas(data.totalNoLeidas || 0);
        setTotalCriticas(data.totalCriticas || 0);
      }
    } catch {
      // Silencioso para no romper UI
    }
  }, [isIdle]);

  useEffect(() => {
    // Consulta inicial al montar
    consultarConteoAlertas(true);

    // Si el usuario está inactivo, pausar temporizador completamente para permitir Scale-to-Zero en Neon
    if (isIdle) return;

    // Polling espaciado a 5 minutos (300 s) únicamente con usuario activo
    const interval = setInterval(() => {
      consultarConteoAlertas(false);
    }, 300_000);

    // Al regresar a la pestaña, actualizar si el usuario no está inactivo
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        consultarConteoAlertas(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [consultarConteoAlertas, isIdle]);

  const handleAlertasActualizadas = (noLeidas: number, criticas: number) => {
    setTotalNoLeidas(noLeidas);
    setTotalCriticas(criticas);
  };

  const hasCriticas = totalCriticas > 0;
  const hasNoLeidas = totalNoLeidas > 0;

  const getButtonClass = () => {
    if (hasCriticas) return "alerta-badge-btn has-critica";
    if (hasNoLeidas) return "alerta-badge-btn has-warning";
    return "alerta-badge-btn";
  };

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className={`${getButtonClass()} ${className}`}
        title={`Centro de Alertas (${totalNoLeidas} no leídas, ${totalCriticas} críticas)`}
        aria-label="Abrir Centro de Alertas"
        style={{
          outline: "none",
          flexShrink: 0,
        }}
      >
        <Bell size={16} />
        {hasNoLeidas && (
          <span
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              backgroundColor: hasCriticas ? "#dc2626" : "#d97706",
              color: "#ffffff",
              fontSize: "0.625rem",
              fontWeight: 700,
              minWidth: "18px",
              height: "18px",
              borderRadius: "999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
              border: "2px solid #ffffff",
              lineHeight: 1,
            }}
          >
            {totalNoLeidas > 99 ? "99+" : totalNoLeidas}
          </span>
        )}
      </button>

      <CentroAlertasDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAlertasActualizadas={handleAlertasActualizadas}
      />
    </>
  );
}
