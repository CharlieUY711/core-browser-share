"use client";

import { useEffect, useRef, useState } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { WebRTCViewer } from "@/lib/webrtc";
import { supabase } from "@/lib/supabase";
import type { WebRTCState } from "@/types";
import type { ControlEvent } from "@/lib/control";

interface ViewerProps {
  sessionCode: string;
}

export function Viewer({ sessionCode }: ViewerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<WebRTCState>({ status: "connecting" });
  const [controlEnabled, setControlEnabled] = useState(false);
  const viewerRef = useRef<WebRTCViewer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const viewer = new WebRTCViewer(sessionCode);
    viewerRef.current = viewer;
    viewer.onTrack = (remoteStream) => {
      setStream(remoteStream);
      setState({ status: "connected" });
    };
    viewer.connect().catch(() => {
      setState({ status: "error", error: "No se pudo conectar." });
    });
    return () => { viewer.destroy(); };
  }, [sessionCode]);

  useEffect(() => {
    const ch = supabase.channel(`control:${sessionCode}`);
    channelRef.current = ch;
    ch.subscribe();
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
    sendEvent({
      type: "mousemove",
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!controlEnabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const button = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
    sendEvent({
      type: "mousedown",
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      button,
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!controlEnabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const button = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
    sendEvent({
      type: "mouseup",
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      button,
    });
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

  if (state.status === "error") {
    return <div className="card text-center text-sm text-red-400">{state.error}</div>;
  }

  if (state.status === "connecting" || !stream) {
    return (
      <div className="card flex flex-col items-center gap-3 py-10 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-core-muted border-t-core-accent" />
        <p className="text-sm text-core-text-muted">Esperando stream...</p>
      </div>
    );
  }

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
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          <span className="h-2 w-2 animate-pulse-slow rounded-full bg-green-500" />
          Conectado
        </div>
        {controlEnabled && (
          <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-core-accent/80 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-white" />
            Control activo
          </div>
        )}
      </div>

      <div className="card flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-core-text">Control remoto</p>
          <p className="text-xs text-core-text-muted">
            {controlEnabled
              ? "Tus acciones se envían al host. El host necesita Core Agent corriendo."
              : "Activá para tomar control del navegador del host."}
          </p>
        </div>
        <button
          onClick={() => {
            setControlEnabled(!controlEnabled);
            if (!controlEnabled) containerRef.current?.focus();
          }}
          className={controlEnabled ? "btn-ghost" : "btn-primary"}
        >
          {controlEnabled ? "Desactivar" : "Tomar control"}
        </button>
      </div>
    </div>
  );
}
