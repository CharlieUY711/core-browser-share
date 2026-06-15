"use client";

import { useEffect, useRef, useState } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { WebRTCViewer } from "@/lib/webrtc";
import { supabase } from "@/lib/supabase";
import type { WebRTCState } from "@/types";
import type { ControlEvent } from "@/lib/control";

interface ViewerProps { sessionCode: string; }

export function Viewer({ sessionCode }: ViewerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<WebRTCState>({ status: "connecting" });
  const [controlEnabled, setControlEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const viewer = new WebRTCViewer(sessionCode);
    viewer.onTrack = (s) => { setStream(s); setState({ status: "connected" }); };
    viewer.connect().catch(() => setState({ status: "error", error: "No se pudo conectar." }));
    return () => { viewer.destroy(); };
  }, [sessionCode]);

  useEffect(() => {
    const ch = supabase.channel(`control:${sessionCode}`);
    channelRef.current = ch;
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionCode]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

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
    e.preventDefault();
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  if (state.status === "error")
    return (
      <div className="card text-center text-sm text-red-400 py-10">
        {state.error}
      </div>
    );

  if (state.status === "connecting" || !stream)
    return (
      <div className="card flex flex-col items-center gap-3 py-16 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-core-muted border-t-core-accent" />
        <p className="text-sm text-core-text-muted">Conectando con el host...</p>
      </div>
    );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className="flex flex-col w-full rounded-xl overflow-hidden border border-core-border outline-none focus:outline-none bg-[#1e1e2e]"
      style={{ height: isFullscreen ? "100vh" : "calc(100vh - 180px)" }}
    >
      {/* Barra de browser falsa */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#181825] border-b border-core-border shrink-0">
        {/* Botones de ventana */}
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <span className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>

        {/* Navegación */}
        <div className="flex items-center gap-1 ml-2">
          <button className="p-1 rounded hover:bg-white/10 text-core-text-muted">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button className="p-1 rounded hover:bg-white/10 text-core-text-muted">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button className="p-1 rounded hover:bg-white/10 text-core-text-muted">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Barra de URL */}
        <div className="flex-1 flex items-center gap-2 bg-[#11111b] rounded-md px-3 py-1 mx-2">
          <svg className="h-3 w-3 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-xs text-core-text-muted font-mono truncate">
            compartir.core.com.uy/session/{sessionCode}
          </span>
        </div>

        {/* Acciones derecha */}
        <div className="flex items-center gap-1">
          {/* Indicador live */}
          <div className="flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5 mr-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 font-medium">EN VIVO</span>
          </div>

          {/* Tomar control */}
          <button
            onClick={() => {
              setControlEnabled(!controlEnabled);
              if (!controlEnabled) containerRef.current?.focus();
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
              controlEnabled
                ? "bg-core-accent text-white"
                : "bg-white/10 text-core-text-muted hover:bg-white/20 hover:text-white"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${controlEnabled ? "bg-white animate-pulse" : "bg-core-text-muted"}`} />
            {controlEnabled ? "Control activo" : "Tomar control"}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-white/10 text-core-text-muted hover:text-white"
            title="Pantalla completa"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Stream — ocupa todo el espacio restante */}
      <div
        className={`flex-1 relative bg-black overflow-hidden ${controlEnabled ? "cursor-none" : "cursor-default"}`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => controlEnabled && e.preventDefault()}
      >
        <VideoPlayer stream={stream} />

        {/* Overlay cursor personalizado cuando control activo */}
        {controlEnabled && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-core-accent/90 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Controlando pantalla remota
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
