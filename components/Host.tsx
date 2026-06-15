"use client";

import { useEffect, useRef, useState } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { useScreenShare } from "@/hooks/useScreenShare";
import { WebRTCHost } from "@/lib/webrtc";

interface HostProps {
  sessionCode: string;
}

export function Host({ sessionCode }: HostProps) {
  const { stream, error, startCapture, stopCapture } = useScreenShare();
  const hostRef = useRef<WebRTCHost | null>(null);
  const [status, setStatus] = useState<"idle" | "sharing" | "error">("idle");

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
    setStatus("idle");
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      hostRef.current?.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {stream ? (
        <>
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-core-border bg-black">
            <VideoPlayer stream={stream} muted />
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse-slow rounded-full bg-red-500" />
              En vivo
            </div>
          </div>

          <button onClick={handleStopSharing} className="btn-ghost self-center">
            Detener transmisión
          </button>
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
