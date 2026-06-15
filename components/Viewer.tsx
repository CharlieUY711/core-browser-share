"use client";

import { useEffect, useRef, useState } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { WebRTCViewer } from "@/lib/webrtc";
import { supabase } from "@/lib/supabase";
import type { WebRTCState } from "@/types";
import type { ControlEvent } from "@/lib/control";

interface ViewerProps { sessionCode: string; }

type AgentStatus = "unknown" | "online" | "offline";

export function Viewer({ sessionCode }: ViewerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<WebRTCState>({ status: "connecting" });
  const [controlEnabled, setControlEnabled] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("unknown");
  const viewerRef = useRef<WebRTCViewer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const viewer = new WebRTCViewer(sessionCode);
    viewerRef.current = viewer;
    viewer.onTrack = (s) => { setStream(s); setState({ status: "connected" }); };
    viewer.connect().catch(() => setState({ status: "error", error: "No se pudo conectar." }));
    return () => { viewer.destroy(); };
  }, [sessionCode]);

  useEffect(() => {
    const ch = supabase.channel(`control:${sessionCode}`, {
      config: { presence: { key: "viewer" } }
    });
    channelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const agentOnline = Object.keys(state).includes("agent");
      setAgentStatus(agentOnline ? "online" : "offline");
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ role: "viewer", joined_at: new Date().toISOString() });
        // Chequeo inicial: si no hay presencia en 2s, el agent está offline
        setTimeout(() => {
          setAgentStatus(prev => prev === "unknown" ? "offline" : prev);
        }, 2000);
      }
    });

    return () => { supabase.removeChannel(ch); };
  }, [sessionCode]);

  const sendEvent = (event: Omit<ControlEvent, "session_code">) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "control",
      payload: { ...event, session_code: sessionCode } satisfies ControlEvent,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!controlEnabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    sendEvent({ type: "mousemove", x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!controlEnabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const button = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
    sendEvent({ type: "mousedown", x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height, button });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!controlEnabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const button = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
    sendEvent({ type: "mouseup", x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height, button });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!controlEnabled) return;
    e.preventDefault();
    sendEvent({ type: "keydown", key: e.key });
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!controlEnabled) return;
    sendEvent({ type: "keyup", key: e.key });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!controlEnabled) return;
    sendEvent({ type: "scroll", delta: e.deltaY });
  };

  const toggleControl = () => {
    if (!controlEnabled && agentStatus !== "online") return; // bloquear si agent offline
    setControlEnabled(!controlEnabled);
    if (!controlEnabled) containerRef.current?.focus();
  };

  const agentBadge = {
    unknown: { color: "bg-yellow-500", label: "Verificando agent..." },
    online:  { color: "bg-green-500",  label: "Core Agent online" },
    offline: { color: "bg-red-500",    label: "Core Agent offline" },
  }[agentStatus];

  if (state.status === "error")
    return <div className="card text-center text-sm text-red-400">{state.error}</div>;

  if (state.status === "connecting" || !stream)
    return (
      <div className="card flex flex-col items-center gap-3 py-10 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-core-muted border-t-core-accent" />
        <p className="text-sm text-core-text-muted">Esperando stream...</p>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={containerRef}
        tabIndex={0}
        className={`relative aspect-video w-full overflow-hidden rounded-xl border bg-black outline-none transition-colors ${
          controlEnabled ? "border-core-accent cursor-none" : "border-core-border cursor-default"
        }`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onWheel={handleWheel}
        onContextMenu={(e) => controlEnabled && e.preventDefault()}
      >
        <VideoPlayer stream={stream} />

        {/* Badge estado stream */}
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          Conectado
        </div>

        {/* Badge control activo */}
        {controlEnabled && (
          <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-core-accent/80 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-white" />
            Control activo
          </div>
        )}

        {/* Botón fullscreen */}
        <button
          onClick={() => {
            if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
            else document.exitFullscreen();
          }}
          className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm hover:bg-black/80"
        >
          ⛶ Pantalla completa
        </button>
      </div>

      {/* Estado del agent */}
      <div className="card flex items-center gap-3 py-3">
        <span className={`h-2.5 w-2.5 rounded-full ${agentBadge.color} ${agentStatus === "unknown" ? "animate-pulse" : ""}`} />
        <span className="text-xs text-core-text-muted">{agentBadge.label}</span>
        {agentStatus === "offline" && (
          <span className="ml-auto text-xs text-core-text-muted">
            Corré <code className="bg-core-bg px-1 rounded">node dist/index.js {sessionCode}</code> en el host
          </span>
        )}
      </div>

      {/* Panel de control */}
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-core-text">Control remoto</p>
          <p className="text-xs text-core-text-muted">
            {agentStatus !== "online"
              ? "El host necesita Core Agent corriendo para recibir control."
              : controlEnabled
              ? "Tus acciones se envían al host en tiempo real."
              : "Activá para tomar control del equipo del host."}
          </p>
        </div>
        <button
          onClick={toggleControl}
          disabled={agentStatus !== "online"}
          className={controlEnabled ? "btn-ghost" : "btn-primary"}
        >
          {controlEnabled ? "Desactivar" : "Tomar control"}
        </button>
      </div>
    </div>
  );
}
