"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import CentroAlertasDrawer from "./CentroAlertasDrawer";

interface AlertaBadgeProps {
  className?: string;
}

export default function AlertaBadge({ className = "" }: AlertaBadgeProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [totalNoLeidas, setTotalNoLeidas] = useState(0);
  const [totalCriticas, setTotalCriticas] = useState(0);

  const consultarConteoAlertas = useCallback(async () => {
    // No consultar si la pestaña está oculta (ahorra CU-hours en Neon)
    if (document.visibilityState === "hidden") return;
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
  }, []);

  useEffect(() => {
    consultarConteoAlertas();
    // Polling cada 120 segundos (antes: 60 s) — reduce consumo de CU-hours en Neon ~50 %
    const interval = setInterval(consultarConteoAlertas, 120_000);

    // Al regresar a la pestaña, actualizar de inmediato
    const handleVisibility = () => {
      if (document.visibilityState === "visible") consultarConteoAlertas();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [consultarConteoAlertas]);

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
