"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { WebRTCHost } from "@/lib/webrtc";

interface HostProps {
  sessionCode: string;
  onExit?: () => void;
}

export function Host({ sessionCode, onExit }: HostProps) {
  const searchParams = useSearchParams();
  const isElectron = searchParams.get("electron") === "1";
  const [sharing, setSharing] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hostRef = useRef<WebRTCHost | null>(null);
  const startedRef = useRef(false);

  // Auto-iniciar si viene de Electron
  useEffect(() => {
    if (isElectron && !startedRef.current) {
      startedRef.current = true;
      startSharing();
    }
  }, [isElectron]);

  // Contar viewers
  useEffect(() => {
    const ch = supabase.channel(`session:${sessionCode}`, {
      config: { presence: { key: "host" } }
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as any;
      const count = Object.values(state).flat().filter((p: any) => p.role === "viewer").length;
      setViewerCount(count);
    });
    ch.subscribe(async (s) => {
      if (s === "SUBSCRIBED") await ch.track({ role: "host" });
    });
    return () => { supabase.removeChannel(ch); };
  }, [sessionCode]);

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080, frameRate: 30 },
        audio: false,
      });
      const rtcHost = new WebRTCHost(sessionCode, stream);
      hostRef.current = rtcHost;
      await rtcHost.start();
      setSharing(true);
      setError(null);
      stream.getVideoTracks()[0].onended = stopSharing;
    } catch (e: any) {
      if (e.name !== "NotAllowedError") {
        setError(e.message);
      }
    }
  };

  const stopSharing = () => {
    hostRef.current?.destroy();
    hostRef.current = null;
    setSharing(false);
    (window as any).coreDesktop?.stopAgent?.();
    onExit?.();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!sharing) return (
    <div className="card flex flex-col items-center gap-4 py-10 text-center max-w-sm mx-auto">
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      <svg className="h-10 w-10 text-core-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
      </svg>
      <div>
        <p className="font-semibold text-core-text">Iniciar compartir pantalla</p>
        <p className="text-sm text-core-text-muted mt-1">El viewer verá tu pantalla en tiempo real</p>
      </div>
      <button onClick={startSharing} className="btn-primary w-full">
        {isElectron ? "Conectando..." : "Compartir pantalla"}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium text-core-text">Compartiendo en vivo</span>
          {viewerCount > 0 && (
            <span className="rounded-full bg-core-accent/20 border border-core-accent/30 px-2 py-0.5 text-xs text-core-accent">
              {viewerCount} viewer{viewerCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button onClick={stopSharing} className="btn-ghost text-xs text-red-400 hover:text-red-300">
          Detener
        </button>
      </div>

      <div className="card flex flex-col items-center gap-4 py-8">
        <p className="text-xs text-core-text-muted uppercase tracking-widest">Código de sesión</p>
        <div className="flex gap-2">
          {sessionCode.split("").map((d, i) => (
            <span key={i} className="flex h-14 w-10 items-center justify-center rounded-lg bg-[#181825] border border-core-border font-mono text-2xl font-bold text-core-accent">
              {d}
            </span>
          ))}
        </div>
        <button onClick={handleCopy} className="btn-ghost text-sm">
          {copied ? "✓ Copiado" : "Copiar código"}
        </button>
        <p className="text-xs text-core-text-muted text-center">
          El viewer va a <span className="text-core-accent font-mono">compartir.core.com.uy</span> e ingresa este código
        </p>
      </div>

      <div className="card flex items-center gap-3 py-3">
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs text-core-text-muted">
          Control remoto activo — el agente está corriendo en tu desktop
        </span>
      </div>
    </div>
  );
}
