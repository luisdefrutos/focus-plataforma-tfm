'use client';

import { useEffect, useCallback, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos de inactividad
const TAB_SESSION_KEY = 'focus-tab-active';
const CHANNEL_NAME = 'focus-session';
const HANDSHAKE_MS = 500; // espera para que otra pestaña confirme sesión viva

export function AutoLogout() {
  const { status } = useSession();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Guard por pestaña con herencia entre pestañas ───
  // sessionStorage es por pestaña y se destruye al cerrarla. Una pestaña SIN la
  // marca puede ser (a) una pestaña nueva abierta durante una sesión viva
  // (Ctrl+click) o (b) el navegador reabierto. Para distinguirlas, preguntamos
  // por BroadcastChannel: si otra pestaña responde, heredamos la marca; si nadie
  // responde en HANDSHAKE_MS, asumimos navegador reabierto y cerramos sesión.
  useEffect(() => {
    if (status !== 'authenticated') return;

    // Sin BroadcastChannel (navegadores muy viejos): no bloquear, marcar activa.
    if (typeof BroadcastChannel === 'undefined') {
      sessionStorage.setItem(TAB_SESSION_KEY, 'true');
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    const alreadyActive = !!sessionStorage.getItem(TAB_SESSION_KEY);
    let inherited = alreadyActive;

    channel.onmessage = (e) => {
      // Responder a otras pestañas que preguntan si hay sesión viva.
      if (e.data === 'ping' && sessionStorage.getItem(TAB_SESSION_KEY)) {
        channel.postMessage('pong');
      } else if (e.data === 'pong') {
        // Otra pestaña confirma sesión viva → heredar la marca.
        inherited = true;
        sessionStorage.setItem(TAB_SESSION_KEY, 'true');
      }
    };

    let handshake: ReturnType<typeof setTimeout> | undefined;
    if (!alreadyActive) {
      channel.postMessage('ping');
      handshake = setTimeout(() => {
        if (!inherited) {
          console.warn('Sesión cerrada: sin otras pestañas activas (navegador reabierto).');
          signOut({ callbackUrl: '/login' });
        }
      }, HANDSHAKE_MS);
    }

    return () => {
      if (handshake) clearTimeout(handshake);
      channel.close();
    };
  }, [status]);

  // ─── Logout por inactividad ───
  const handleIdle = useCallback(() => {
    if (status === 'authenticated') {
      console.warn('Sesión cerrada automáticamente por inactividad.');
      sessionStorage.removeItem(TAB_SESSION_KEY);
      signOut({ callbackUrl: '/login' });
    }
  }, [status]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (status === 'authenticated') {
      timeoutRef.current = setTimeout(handleIdle, IDLE_TIMEOUT_MS);
    }
  }, [handleIdle, status]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    // Iniciar temporizador
    resetTimer();

    // Escuchar eventos de actividad del usuario
    const events = [
      'mousemove',
      'keydown',
      'scroll',
      'click',
      'touchstart',
    ];

    events.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [resetTimer, status]);

  // Este componente es invisible, solo ejecuta lógica
  return null;
}
