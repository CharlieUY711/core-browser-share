"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { startRemoteControlListener } from "@/lib/remote-control";

type ShareStatus = "idle" | "selecting" | "sharing";
type ControlStatus = "idle" | "active";

interface HostProps {
  sessionCode: string;
  onExit?: () => void;
}

export function Host({ sessionCode, onExit }: HostProps) {
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [controlStatus, setControlStatus] = useState<ControlStatus>("idle");
  const [viewerCount, setViewerCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const stopControlRef = useRef<(() => void) | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Presencia: contar viewers
  useEffect(() => {
    const ch = supabase.channel(`session:${sessionCode}`, {
      config: { presence: { key: "host" } }
    });
    channelRef.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const viewers = Object.values(state).flat().filter((p: any) => p.role === "viewer");
      setViewerCount(viewers.length);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ role: "host", joined_at: new Date().toISOString() });
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [sessionCode]);

  const handleShare = async () => {
    setError(null);
    setShareStatus("selecting");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0].onended = () => {
        handleStopShare();
      };
      setShareStatus("sharing");
    } catch {
      setShareStatus("idle");
      setError("Compartir pantalla cancelado o no permitido.");
    }
  };

  const handleStopShare = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setShareStatus("idle");
    // Detener control si estaba activo
    stopControlRef.current?.();
    stopControlRef.current = null;
    setControlStatus("idle");
  };

  const handleToggleControl = () => {
    if (controlStatus === "idle") {
      const stop = startRemoteControlListener(sessionCode);
      stopControlRef.current = stop;
      setControlStatus("active");
    } else {
      stopControlRef.current?.();
      stopControlRef.current = null;
      setControlStatus("idle");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Selector / estado de pantalla compartida */}
      {shareStatus === "idle" && (
        <div className="card flex flex-col items-center gap-4 py-10 text-center">
          <div className="rounded-full bg-core-surface border border-core-border p-4">
            <svg className="h-8 w-8 text-core-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-core-text">Compartir pantalla</p>
            <p className="text-xs text-core-text-muted mt-1">
              Elegí qué tab, ventana o pantalla querés compartir.
            </p>
          </div>
          <button onClick={handleShare} className="btn-primary">
            Seleccionar pantalla
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {shareStatus === "selecting" && (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-core-muted border-t-core-accent" />
          <p className="text-sm text-core-text-muted">Esperando selección...</p>
        </div>
      )}

      {shareStatus === "sharing" && (
        <div className="card flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            <div>
              <p className="text-sm font-medium text-core-text">Pantalla compartida</p>
              <p className="text-xs text-core-text-muted">
                {viewerCount > 0
                  ? `${viewerCount} viewer${viewerCount > 1 ? "s" : ""} conectado${viewerCount > 1 ? "s" : ""}`
                  : "Esperando viewers..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleCopy} className="btn-ghost flex items-center gap-2 text-sm">
              {copied ? <><span className="h-2 w-2 rounded-full bg-green-500" />Copiado</> : "Copiar código"}
            </button>
            <button
              onClick={handleToggleControl}
              className={`flex items-center gap-2 text-sm ${controlStatus === "active" ? "btn-ghost border-core-accent/60 text-core-accent" : "btn-primary"}`}
            >
              <span className={`h-2 w-2 rounded-full ${controlStatus === "active" ? "bg-core-accent animate-pulse" : "bg-white/60"}`} />
              {controlStatus === "active" ? "Revocar Control" : "Permitir Control"}
            </button>
            <button onClick={handleStopShare} className="btn-ghost text-sm text-red-400 border-red-500/30 hover:border-red-400">
              Detener
            </button>
          </div>
          {controlStatus === "active" && (
            <p className="w-full text-xs text-core-accent/80">
              Control remoto activo — el viewer puede interactuar con tu pantalla.
            </p>
          )}
        </div>
      )}

    </div>
  );
}
