"use client";

import { useEffect, useRef, useState } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { useScreenShare } from "@/hooks/useScreenShare";
import { WebRTCHost } from "@/lib/webrtc";
import { startRemoteControlListener } from "@/lib/remote-control";

interface HostProps {
  sessionCode: string;
  onExit?: () => void;
}

type ControlStatus = "idle" | "active";

export function Host({ sessionCode, onExit }: HostProps) {
  const { stream, error, startCapture, stopCapture } = useScreenShare();
  const hostRef = useRef<WebRTCHost | null>(null);
  const stopControlRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<"idle" | "sharing" | "error">("idle");
  const [controlStatus, setControlStatus] = useState<ControlStatus>("idle");
  const [copied, setCopied] = useState(false);

  const handleStartSharing = async () => {
    const capturedStream = await startCapture();
    if (!capturedStream) return;
    const host = new WebRTCHost(sessionCode, capturedStream);
    hostRef.current = host;
    try {
      await host.start();
      setStatus("sharing");
    } catch {
      setStatus("error");
    }
  };

  const handleStopSharing = () => {
    hostRef.current?.destroy();
    hostRef.current = null;
    stopCapture();
    stopControlRef.current?.();
    stopControlRef.current = null;
    setStatus("idle");
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

  useEffect(() => {
    return () => { hostRef.current?.destroy(); };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {stream ? (
        <>
          {/* Preview de la pantalla compartida */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-core-border bg-black">
            <VideoPlayer stream={stream} muted />
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              En vivo
            </div>
          </div>

          {/* Código + controles */}
          <div className="card flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-core-text-muted mb-1">Código de sesión</p>
              <p className="session-code text-2xl">{sessionCode}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleCopy} className="btn-ghost text-sm flex items-center gap-2">
                {copied ? <><span className="h-2 w-2 rounded-full bg-green-500" />Copiado</> : "Copiar código"}
              </button>
              <button
                onClick={handleToggleControl}
                className={`flex items-center gap-2 text-sm ${controlStatus === "active" ? "btn-ghost border-core-accent/60 text-core-accent" : "btn-primary"}`}
              >
                <span className={`h-2 w-2 rounded-full ${controlStatus === "active" ? "bg-core-accent animate-pulse" : "bg-white/60"}`} />
                {controlStatus === "active" ? "Revocar Control" : "Permitir Control"}
              </button>
              <button onClick={handleStopSharing} className="btn-ghost text-sm text-red-400 border-red-500/30 hover:border-red-400">
                Detener
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="card flex flex-col items-center gap-4 py-10 text-center">
          <div className="text-4xl">🖥️</div>
          <p className="text-core-text-muted text-sm">
            Seleccioná la ventana del navegador que querés compartir
          </p>
          <button onClick={handleStartSharing} className="btn-primary" disabled={status === "error"}>
            Compartir ventana
          </button>
          {(error || status === "error") && (
            <p className="text-sm text-red-400">
              {error || "Error al iniciar la transmisión. Intentá de nuevo."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
