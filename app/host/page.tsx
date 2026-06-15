"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Connection {
  role: string;
  joined_at: string;
}

interface SessionInfo {
  code: string;
  connections: Record<string, Connection[]>;
  agentOnline: boolean;
}

export default function HostPanel() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [watchCode, setWatchCode] = useState("");
  const [watching, setWatching] = useState<string[]>([]);

  const addSession = (code: string) => {
    if (!code || watching.includes(code)) return;
    setWatching(prev => [...prev, code]);
  };

  useEffect(() => {
    const channels = watching.map(code => {
      const ch = supabase.channel(`control:${code}`, {
        config: { presence: { key: "panel" } }
      });

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, Connection[]>;
        setSessions(prev => {
          const exists = prev.find(s => s.code === code);
          const info: SessionInfo = {
            code,
            connections: state,
            agentOnline: Object.keys(state).includes("agent"),
          };
          if (exists) return prev.map(s => s.code === code ? info : s);
          return [...prev, info];
        });
      });

      ch.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ role: "panel", joined_at: new Date().toISOString() });
        }
      });

      return ch;
    });

    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [watching]);

  return (
    <div className="flex min-h-screen bg-core-bg">
      {/* Panel lateral */}
      <aside className="w-72 border-r border-core-border bg-core-surface flex flex-col">
        <div className="border-b border-core-border px-5 py-4">
          <h2 className="text-sm font-semibold text-core-text">Panel del Host</h2>
          <p className="text-xs text-core-text-muted mt-0.5">Sesiones activas</p>
        </div>

        {/* Agregar sesión */}
        <div className="p-4 border-b border-core-border flex gap-2">
          <input
            value={watchCode}
            onChange={e => setWatchCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Código..."
            className="flex-1 rounded-lg border border-core-border bg-core-bg px-3 py-2 font-mono text-sm text-core-text placeholder-core-muted outline-none focus:border-core-accent"
          />
          <button
            onClick={() => { addSession(watchCode); setWatchCode(""); }}
            disabled={watchCode.length !== 6}
            className="btn-primary px-3 py-2 text-xs"
          >
            +
          </button>
        </div>

        {/* Lista de sesiones */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {watching.length === 0 && (
            <p className="text-xs text-core-text-muted text-center py-6">
              Ingresá un código de sesión para monitorear
            </p>
          )}
          {watching.map(code => {
            const info = sessions.find(s => s.code === code);
            const viewerCount = Object.entries(info?.connections ?? {})
              .filter(([k]) => k === "viewer").length;
            const viewers = Object.entries(info?.connections ?? {})
              .filter(([k]) => k.startsWith("viewer"))
              .flatMap(([, v]) => v);

            return (
              <div key={code} className="rounded-lg border border-core-border bg-core-bg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold text-core-accent tracking-widest">
                    {code}
                  </span>
                  <button
                    onClick={() => setWatching(prev => prev.filter(c => c !== code))}
                    className="text-xs text-core-text-muted hover:text-red-400"
                  >✕</button>
                </div>

                {/* Agent status */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${info?.agentOnline ? "bg-green-500" : "bg-red-400"}`} />
                  <span className="text-xs text-core-text-muted">
                    Agent {info?.agentOnline ? "online" : "offline"}
                  </span>
                </div>

                {/* Viewers */}
                <div className="text-xs text-core-text-muted">
                  {viewers.length === 0
                    ? "Sin viewers conectados"
                    : `${viewers.length} viewer${viewers.length > 1 ? "s" : ""} conectado${viewers.length > 1 ? "s" : ""}`}
                </div>
                {viewers.map((v, i) => (
                  <div key={i} className="mt-1 text-xs text-core-text-muted pl-2 border-l border-core-border">
                    Viewer {i + 1} — {new Date(v.joined_at).toLocaleTimeString()}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Área principal */}
      <main className="flex-1 flex flex-col items-center justify-center text-center p-12">
        <div className="rounded-xl border border-core-border bg-core-surface p-8 max-w-sm">
          <p className="text-2xl mb-3">🖥️</p>
          <h3 className="text-sm font-semibold text-core-text mb-1">Panel de monitoreo</h3>
          <p className="text-xs text-core-text-muted">
            Ingresá códigos de sesión en el panel izquierdo para ver quién está conectado y el estado del agent en tiempo real.
          </p>
        </div>
      </main>
    </div>
  );
}
