"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { startRemoteControlListener } from "@/lib/remote-control";

type ControlStatus = "idle" | "active";

interface HostProps {
  sessionCode: string;
  onExit: () => void;
}

export function Host({ sessionCode, onExit }: HostProps) {
  const [copied, setCopied] = useState(false);
  const [controlStatus, setControlStatus] = useState<ControlStatus>("idle");
  const [viewerCount, setViewerCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stopControlRef = useRef<(() => void) | null>(null);

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

  const handleCopy = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleControl = () => {
    if (controlStatus === "idle") {
      // Activar: escuchar eventos remotos y ejecutarlos en este DOM
      const stop = startRemoteControlListener(sessionCode);
      stopControlRef.current = stop;
      setControlStatus("active");
    } else {
      // Desactivar
      stopControlRef.current?.();
      stopControlRef.current = null;
      setControlStatus("idle");
    }
  };

  return (
    <div className="card">
      <div className="flex flex-col gap-1 mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-core-text-muted">
          Tu código de sesión
        </p>
        <p className="session-code">{sessionCode.split("").join(" ")}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Copiar código */}
        <button onClick={handleCopy} className="btn-ghost flex items-center gap-2">
          {copied
            ? <><span className="h-2 w-2 rounded-full bg-green-500" />Copiado</>
            : "Copiar código"}
        </button>

        {/* Permitir / Revocar control */}
        <button
          onClick={handleToggleControl}
          className={`flex items-center gap-2 ${controlStatus === "active" ? "btn-ghost border-core-accent/60 text-core-accent" : "btn-primary"}`}
        >
          <span className={`h-2 w-2 rounded-full ${controlStatus === "active" ? "bg-core-accent animate-pulse" : "bg-white/60"}`} />
          {controlStatus === "active" ? "Revocar Control" : "Permitir Control"}
        </button>

        {/* Salir */}
        <button onClick={onExit} className="btn-ghost ml-auto">Salir</button>
      </div>

      {/* Estado */}
      <div className="mt-3 flex items-center gap-4">
        {viewerCount > 0 && (
          <p className="text-xs text-core-text-muted">
            <span className="text-core-accent font-medium">{viewerCount}</span> viewer{viewerCount > 1 ? "s" : ""} conectado{viewerCount > 1 ? "s" : ""}
          </p>
        )}
        {controlStatus === "active" && (
          <p className="text-xs text-core-accent/80">
            Control remoto activo — el viewer puede interactuar con tu pantalla.
          </p>
        )}
      </div>
    </div>
  );
}
