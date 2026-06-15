"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { WebRTCHost } from "@/lib/webrtc";

interface HostProps {
  sessionCode: string;
  onExit?: () => void;
}

type Phase = "select" | "sharing" | "error";

interface Source {
  id: string;
  name: string;
  thumbnail: string;
}

declare global {
  interface Window {
    coreDesktop?: {
      getSources: () => Promise<Source[]>;
      startAgent: (code: string) => Promise<{ ok: boolean; error?: string }>;
      stopAgent: () => Promise<void>;
      onAgentReady: (cb: (data: { screenW: number; screenH: number }) => void) => void;
      onAgentStopped: (cb: () => void) => void;
      isElectron: boolean;
    };
  }
}

export function Host({ sessionCode, onExit }: HostProps) {
  const [phase, setPhase] = useState<Phase>("select");
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agentReady, setAgentReady] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hostRef = useRef<WebRTCHost | null>(null);
  const isElectron = typeof window !== "undefined" && !!window.coreDesktop?.isElectron;

  // Cargar fuentes de pantalla
  useEffect(() => {
    async function load() {
      if (isElectron) {
        const srcs = await window.coreDesktop!.getSources();
        setSources(srcs);
        if (srcs.length > 0) setSelectedId(srcs[0].id);
      } else {
        // Fallback browser: usar getDisplayMedia directo
        setSources([{ id: "browser", name: "Tu pantalla (browser)", thumbnail: "" }]);
        setSelectedId("browser");
      }
    }
    load();
  }, [isElectron]);

  // Escuchar agente
  useEffect(() => {
    if (!isElectron) return;
    window.coreDesktop!.onAgentReady(() => setAgentReady(true));
    window.coreDesktop!.onAgentStopped(() => setAgentReady(false));
  }, [isElectron]);

  // Contar viewers
  useEffect(() => {
    const ch = supabase.channel(`session:${sessionCode}`, {
      config: { presence: { key: "host" } }
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as any;
      const viewers = Object.values(state).flat().filter((p: any) => p.role === "viewer").length;
      setViewerCount(viewers);
    });
    ch.subscribe(async (s) => {
      if (s === "SUBSCRIBED") await ch.track({ role: "host", session: sessionCode });
    });
    return () => { supabase.removeChannel(ch); };
  }, [sessionCode]);

  const startSharing = async () => {
    if (!selectedId) return;
    try {
      let stream: MediaStream;

      if (isElectron && selectedId !== "browser") {
        // Electron: capturar fuente específica
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // @ts-ignore — Electron extiende constraints
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: selectedId,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080,
            },
          },
        });
      } else {
        // Browser fallback: getDisplayMedia
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080, frameRate: 30 },
          audio: false,
        });
      }

      // Iniciar WebRTC host
      const rtcHost = new WebRTCHost(sessionCode, stream);
      hostRef.current = rtcHost;
      await rtcHost.start();

      // Iniciar agente de control
      if (isElectron) {
        const res = await window.coreDesktop!.startAgent(sessionCode);
        if (!res.ok) console.warn("Agent error:", res.error);
      }

      setPhase("sharing");

      // Cuando el stream termina (usuario cierra compartir)
      stream.getVideoTracks()[0].onended = () => stopSharing();

    } catch (e: any) {
      if (e.name !== "NotAllowedError") {
        setError(e.message);
        setPhase("error");
      }
    }
  };

  const stopSharing = () => {
    hostRef.current?.destroy();
    hostRef.current = null;
    if (isElectron) window.coreDesktop!.stopAgent();
    setPhase("select");
    setAgentReady(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── FASE: SELECCIÓN ───────────────────────────────────────────────────────
  if (phase === "select") return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      <div className="card">
        <h2 className="text-lg font-semibold text-core-text mb-1">¿Qué querés compartir?</h2>
        <p className="text-sm text-core-text-muted mb-4">Elegí la pantalla o ventana que verá el viewer.</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {sources.map((src) => (
            <button
              key={src.id}
              onClick={() => setSelectedId(src.id)}
              className={`rounded-lg border p-2 text-left transition-all ${
                selectedId === src.id
                  ? "border-core-accent bg-core-accent/10"
                  : "border-core-border hover:border-core-accent/50"
              }`}
            >
              {src.thumbnail ? (
                <img src={src.thumbnail} alt={src.name} className="w-full rounded mb-2 aspect-video object-cover bg-black" />
              ) : (
                <div className="w-full rounded mb-2 aspect-video bg-[#181825] flex items-center justify-center">
                  <svg className="h-8 w-8 text-core-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                  </svg>
                </div>
              )}
              <p className="text-xs font-medium text-core-text truncate">{src.name}</p>
            </button>
          ))}
        </div>

        <button
          onClick={startSharing}
          disabled={!selectedId}
          className="btn-primary w-full"
        >
          Compartir pantalla
        </button>
      </div>
    </div>
  );

  // ── FASE: COMPARTIENDO ────────────────────────────────────────────────────
  if (phase === "sharing") return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium text-core-text">Compartiendo pantalla</span>
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

      {/* Código */}
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

      {/* Estado agente */}
      <div className="card flex items-center gap-3 py-3">
        <span className={`h-2 w-2 rounded-full ${agentReady ? "bg-green-500" : isElectron ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`} />
        <span className="text-xs text-core-text-muted">
          {agentReady ? "Control remoto habilitado" : isElectron ? "Iniciando agente..." : "Control remoto no disponible en modo browser"}
        </span>
      </div>
    </div>
  );

  // ── FASE: ERROR ───────────────────────────────────────────────────────────
  return (
    <div className="card text-center py-10">
      <p className="text-red-400 text-sm mb-4">{error}</p>
      <button onClick={() => setPhase("select")} className="btn-primary">Reintentar</button>
    </div>
  );
}
