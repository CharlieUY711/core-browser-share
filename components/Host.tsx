"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { startRemoteControlListener } from "@/lib/remote-control";

interface HostProps {
  sessionCode: string;
  onExit?: () => void;
}

type ControlStatus = "idle" | "active";

export function Host({ sessionCode, onExit }: HostProps) {
  const [url, setUrl] = useState("https://www.google.com");
  const [inputUrl, setInputUrl] = useState("https://www.google.com");
  const [controlStatus, setControlStatus] = useState<ControlStatus>("idle");
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stopControlRef = useRef<(() => void) | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Sincronizar URL actual con viewers via Supabase
  useEffect(() => {
    const ch = supabase.channel(`session:${sessionCode}`, {
      config: { presence: { key: "host" } }
    });
    channelRef.current = ch;
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ role: "host", url, joined_at: new Date().toISOString() });
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [sessionCode]);

  // Cuando cambia la URL, notificar a viewers
  const navigateTo = (rawUrl: string) => {
    let finalUrl = rawUrl.trim();
    if (!finalUrl.startsWith("http")) finalUrl = "https://" + finalUrl;
    setUrl(finalUrl);
    setInputUrl(finalUrl);
    channelRef.current?.send({
      type: "broadcast",
      event: "url:change",
      payload: { url: finalUrl },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") navigateTo(inputUrl);
  };

  const handleToggleControl = () => {
    if (controlStatus === "idle") {
      // Escuchar eventos del viewer y ejecutarlos en el iframe
      const stop = startRemoteControlListenerInIframe(sessionCode, iframeRef);
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
    <div className="flex flex-col w-full rounded-xl overflow-hidden border border-core-border bg-[#1e1e2e]"
      style={{ height: "calc(100vh - 120px)" }}>

      {/* Barra del browser */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#181825] border-b border-core-border shrink-0">
        {/* Dots */}
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <span className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-1 ml-1">
          <button onClick={() => iframeRef.current?.contentWindow?.history.back()}
            className="p-1 rounded hover:bg-white/10 text-core-text-muted">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={() => iframeRef.current?.contentWindow?.history.forward()}
            className="p-1 rounded hover:bg-white/10 text-core-text-muted">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button onClick={() => navigateTo(url)}
            className="p-1 rounded hover:bg-white/10 text-core-text-muted">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* URL bar */}
        <div className="flex-1 flex items-center gap-2 bg-[#11111b] rounded-md px-3 py-1 mx-1">
          <svg className="h-3 w-3 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <input
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={e => e.target.select()}
            className="flex-1 bg-transparent text-xs text-core-text font-mono outline-none"
            spellCheck={false}
          />
        </div>

        {/* Código + controles */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-sm font-semibold text-core-accent tracking-widest">
            {sessionCode}
          </span>
          <button onClick={handleCopy} className="btn-ghost text-xs py-1 px-2">
            {copied ? "✓" : "Copiar"}
          </button>
          <button
            onClick={handleToggleControl}
            className={`flex items-center gap-1.5 text-xs py-1 px-3 rounded-lg font-medium transition-all ${
              controlStatus === "active"
                ? "bg-core-accent text-white"
                : "bg-white/10 text-core-text-muted hover:bg-white/20 hover:text-white"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${controlStatus === "active" ? "bg-white animate-pulse" : "bg-core-text-muted"}`} />
            {controlStatus === "active" ? "Revocar Control" : "Permitir Control"}
          </button>
        </div>
      </div>

      {/* iframe — el sitio real */}
      <iframe
        ref={iframeRef}
        src={url}
        className="flex-1 w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        allow="autoplay; fullscreen"
        onLoad={() => {
          try {
            const iframeUrl = iframeRef.current?.contentWindow?.location.href;
            if (iframeUrl && iframeUrl !== "about:blank") setInputUrl(iframeUrl);
          } catch {}
        }}
      />
    </div>
  );
}

// Control remoto ejecutado dentro del iframe del host
function startRemoteControlListenerInIframe(
  sessionCode: string,
  iframeRef: React.RefObject<HTMLIFrameElement>
) {
  const { supabase } = require("@/lib/supabase");
  const channel = supabase.channel(`control:${sessionCode}`);

  channel.on("broadcast", { event: "control" }, ({ payload }: any) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    const x = (payload.x ?? 0) * iframe.clientWidth;
    const y = (payload.y ?? 0) * iframe.clientHeight;

    const fire = (type: string, extra?: object) => {
      const el = doc.elementFromPoint(x, y) ?? doc.body;
      el.dispatchEvent(new MouseEvent(type, {
        bubbles: true, cancelable: true,
        clientX: x, clientY: y,
        ...extra,
      }));
    };

    switch (payload.type) {
      case "mousemove": fire("mousemove"); break;
      case "mousedown":
        fire("mousedown");
        (doc.elementFromPoint(x, y) as HTMLElement)?.focus?.();
        break;
      case "mouseup":
        fire("mouseup");
        fire("click");
        break;
      case "scroll": {
        const el = doc.elementFromPoint(x, y) ?? doc.documentElement;
        el.scrollBy({ top: payload.delta ?? 0, behavior: "instant" as ScrollBehavior });
        break;
      }
      case "keydown": {
        const el = doc.activeElement ?? doc.body;
        if (payload.key === "Backspace") {
          if (el instanceof iframe.contentWindow.HTMLInputElement ||
              el instanceof iframe.contentWindow.HTMLTextAreaElement) {
            const start = el.selectionStart ?? el.value.length;
            if (start > 0) {
              el.value = el.value.slice(0, start - 1) + el.value.slice(start);
              el.selectionStart = el.selectionEnd = start - 1;
              el.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
        } else if (payload.key?.length === 1) {
          if (el instanceof iframe.contentWindow.HTMLInputElement ||
              el instanceof iframe.contentWindow.HTMLTextAreaElement) {
            const start = el.selectionStart ?? el.value.length;
            el.value = el.value.slice(0, start) + payload.key + el.value.slice(start);
            el.selectionStart = el.selectionEnd = start + 1;
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
        el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: payload.key }));
        break;
      }
    }
  });

  channel.subscribe();
  return () => supabase.removeChannel(channel);
}
