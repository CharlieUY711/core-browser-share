"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ControlEvent } from "@/lib/control";

interface ViewerProps { sessionCode: string; }

export function Viewer({ sessionCode }: ViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [controlEnabled, setControlEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Un solo canal para todo: control + url:change + presencia
    const ch = supabase.channel(`session:${sessionCode}`, {
      config: { presence: { key: "viewer" } }
    });
    channelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as any;
      const entries = Object.values(state).flat() as any[];
      const host = entries.find((p: any) => p.role === "host");
      if (host?.url) setUrl(host.url);
    });

    ch.on("broadcast", { event: "url:change" }, ({ payload }) => {
      if (payload?.url) setUrl(payload.url);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ role: "viewer", joined_at: new Date().toISOString() });
      }
    });

    // Canal separado solo para eventos de control
    const controlCh = supabase.channel(`control:${sessionCode}`);
    controlCh.subscribe();
    // Guardar referencia al canal de control para enviar eventos
    const originalRef = channelRef;

    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(controlCh);
    };
  }, [sessionCode]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const sendEvent = (event: Omit<ControlEvent, "session_code">) => {
    // Enviar al canal control:
    supabase.channel(`control:${sessionCode}`).send({
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

  if (!url) return (
    <div className="card flex flex-col items-center gap-3 py-16 text-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-core-muted border-t-core-accent" />
      <p className="text-sm text-core-text-muted">Esperando al host...</p>
    </div>
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className="flex flex-col w-full rounded-xl overflow-hidden border border-core-border outline-none bg-[#1e1e2e]"
      style={{ height: isFullscreen ? "100vh" : "calc(100vh - 180px)" }}
    >
      {/* Barra browser */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#181825] border-b border-core-border shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <span className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>

        <div className="flex-1 flex items-center gap-2 bg-[#11111b] rounded-md px-3 py-1 mx-2">
          <svg className="h-3 w-3 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-xs text-core-text-muted font-mono truncate">{url}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 font-medium">EN VIVO</span>
          </div>

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

          <button
            onClick={() => {
              if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
              else document.exitFullscreen();
            }}
            className="p-1.5 rounded hover:bg-white/10 text-core-text-muted hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`flex-1 relative overflow-hidden ${controlEnabled ? "cursor-crosshair" : "cursor-default"}`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => controlEnabled && e.preventDefault()}
      >
        <iframe
          src={url}
          className="w-full h-full border-0 pointer-events-none"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
        {controlEnabled && <div className="absolute inset-0 bg-transparent" />}
        {controlEnabled && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-core-accent/90 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm pointer-events-none">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Controlando pantalla remota
          </div>
        )}
      </div>
    </div>
  );
}
