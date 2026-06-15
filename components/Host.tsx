"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface HostProps {
  sessionCode: string;
  onExit?: () => void;
}

type ControlStatus = "idle" | "starting" | "active" | "viewer-connected";

declare global {
  interface Window {
    coreAgent?: {
      start: (sessionCode: string) => Promise<{ ok: boolean; error?: string }>;
      stop: () => Promise<{ ok: boolean }>;
      status: () => Promise<{ running: boolean }>;
      onReady: (cb: () => void) => void;
      onViewerConnected: (cb: () => void) => void;
      onStopped: (cb: () => void) => void;
    };
  }
}

export function Host({ sessionCode, onExit }: HostProps) {
  const [controlStatus, setControlStatus] = useState<ControlStatus>("idle");
  const [copied, setCopied] = useState(false);
  const [isElectron] = useState(() => typeof window !== "undefined" && !!window.coreAgent);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!isElectron) return;
    window.coreAgent!.onReady(() => setControlStatus("active"));
    window.coreAgent!.onViewerConnected(() => setControlStatus("viewer-connected"));
    window.coreAgent!.onStopped(() => setControlStatus("idle"));
  }, [isElectron]);

  // Para uso sin Electron: signaling manual (fallback)
  useEffect(() => {
    if (isElectron) return;
    const ch = supabase.channel(`control:${sessionCode}`);
    channelRef.current = ch;
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionCode, isElectron]);

  const handleToggleControl = async () => {
    if (isElectron) {
      if (controlStatus === "idle") {
        setControlStatus("starting");
        const res = await window.coreAgent!.start(sessionCode);
        if (!res.ok) {
          setControlStatus("idle");
          alert("Error iniciando agente: " + res.error);
        }
      } else {
        await window.coreAgent!.stop();
        setControlStatus("idle");
      }
    } else {
      // Fallback browser: solo enviar señal de toggle
      channelRef.current?.send({
        type: "broadcast",
        event: "control:toggle",
        payload: { enabled: controlStatus === "idle", session_code: sessionCode },
      });
      setControlStatus(controlStatus === "idle" ? "active" : "idle");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusLabel = {
    idle: "Permitir Control",
    starting: "Iniciando...",
    active: "Agente listo — esperando viewer",
    "viewer-connected": "Viewer conectado ✓",
  }[controlStatus];

  const statusColor = {
    idle: "bg-white/10 text-core-text-muted hover:bg-white/20 hover:text-white",
    starting: "bg-yellow-500/20 text-yellow-300 cursor-wait",
    active: "bg-core-accent/80 text-white",
    "viewer-connected": "bg-green-500/80 text-white",
  }[controlStatus];

  return (
    <div className="flex flex-col w-full rounded-xl overflow-hidden border border-core-border bg-[#1e1e2e]"
      style={{ height: "calc(100vh - 120px)" }}>

      {/* Barra del browser */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#181825] border-b border-core-border shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <span className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>

        {/* Sesión info */}
        <div className="flex-1 flex items-center gap-2 bg-[#11111b] rounded-md px-3 py-1 mx-1">
          <svg className="h-3 w-3 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <span className="text-xs text-core-text-muted font-mono">
            Sesión activa — compartiendo pantalla
          </span>
        </div>

        {/* Código + controles */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-sm font-semibold text-core-accent tracking-widest">
            {sessionCode}
          </span>
          <button onClick={handleCopy} className="btn-ghost text-xs py-1 px-2">
            {copied ? "✓" : "Copiar"}
          </button>
          <button
            onClick={handleToggleControl}
            disabled={controlStatus === "starting"}
            className={`flex items-center gap-1.5 text-xs py-1 px-3 rounded-lg font-medium transition-all disabled:cursor-wait ${statusColor}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${
              controlStatus === "idle" ? "bg-core-text-muted" :
              controlStatus === "starting" ? "bg-yellow-400 animate-pulse" :
              controlStatus === "viewer-connected" ? "bg-white animate-pulse" :
              "bg-white animate-pulse"
            }`} />
            {statusLabel}
          </button>
          {onExit && (
            <button onClick={onExit} className="btn-ghost text-xs py-1 px-2 text-red-400 hover:text-red-300">
              Salir
            </button>
          )}
        </div>
      </div>

      {/* Vista de estado — instrucciones */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        {/* Código grande */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-core-text-muted uppercase tracking-widest">Tu código de sesión</p>
          <div className="flex gap-2">
            {sessionCode.split("").map((d, i) => (
              <span key={i} className="flex h-14 w-10 items-center justify-center rounded-lg bg-[#181825] border border-core-border font-mono text-2xl font-bold text-core-accent">
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Estado del agente */}
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          {controlStatus === "idle" && (
            <>
              <div className="h-12 w-12 rounded-full bg-white/5 border border-core-border flex items-center justify-center">
                <svg className="h-6 w-6 text-core-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                </svg>
              </div>
              <p className="text-sm text-core-text-muted">
                {isElectron
                  ? 'Hacé click en "Permitir Control" para que el viewer pueda ver y controlar tu pantalla.'
                  : 'Corriendo en modo browser. Para control completo, usá la app de escritorio.'}
              </p>
            </>
          )}
          {controlStatus === "starting" && (
            <>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-core-muted border-t-core-accent" />
              <p className="text-sm text-core-text-muted">Iniciando agente de pantalla...</p>
            </>
          )}
          {(controlStatus === "active" || controlStatus === "viewer-connected") && (
            <>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                controlStatus === "viewer-connected" ? "bg-green-500/20 border border-green-500/40" : "bg-core-accent/20 border border-core-accent/40"
              }`}>
                {controlStatus === "viewer-connected" ? (
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6 text-core-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-core-text-muted">
                {controlStatus === "viewer-connected"
                  ? "Viewer conectado. Está viendo tu pantalla en tiempo real."
                  : "Agente activo. Compartí el código con quien quiera ver tu pantalla."}
              </p>
            </>
          )}
        </div>

        {/* Instrucción viewer */}
        {(controlStatus === "active" || controlStatus === "viewer-connected") && (
          <div className="flex items-center gap-3 rounded-xl bg-[#181825] border border-core-border px-4 py-3 text-xs text-core-text-muted max-w-sm">
            <svg className="h-4 w-4 shrink-0 text-core-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            El viewer debe ir a <span className="text-core-accent font-mono mx-1">compartir.core.com.uy</span> e ingresar el código <span className="text-core-accent font-mono ml-1">{sessionCode}</span>
          </div>
        )}
      </div>
    </div>
  );
}
