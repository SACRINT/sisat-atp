"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Hook para detectar si el usuario está inactivo (sin mover ratón, teclear ni hacer scroll).
 * Permite a los componentes de polling suspender de inmediato cualquier petición recurrente
 * mientras el usuario no esté usando la interfaz activamente, protegiendo las horas de Neon.
 *
 * @param idleTimeoutMs Tiempo en milisegundos para considerar al usuario inactivo (por defecto: 2 minutos)
 */
export function useUserIdle(idleTimeoutMs: number = 120_000): boolean {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    setIsIdle(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, idleTimeoutMs);
  }, [idleTimeoutMs]);

  useEffect(() => {
    // Si estamos en entorno servidor, no hacer nada
    if (typeof window === "undefined") return;

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll", "wheel"];

    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
          resetTimer();
        }, 1000);
      }
    };

    events.forEach((evt) => {
      window.addEventListener(evt, handleActivity, { passive: true });
    });

    // Iniciar temporizador inicial
    timerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, idleTimeoutMs);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleActivity);
      });
      if (timerRef.current) clearTimeout(timerRef.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [idleTimeoutMs, resetTimer]);

  return isIdle;
}
