"use client";

import { useEffect, useRef, useState } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { WebRTCViewer } from "@/lib/webrtc";
import type { WebRTCState } from "@/types";

interface ViewerProps {
  sessionCode: string;
}

export function Viewer({ sessionCode }: ViewerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<WebRTCState>({ status: "connecting" });
  const viewerRef = useRef<WebRTCViewer | null>(null);

  useEffect(() => {
    const viewer = new WebRTCViewer(sessionCode);
    viewerRef.current = viewer;

    viewer.onTrack = (remoteStream) => {
      setStream(remoteStream);
      setState({ status: "connected" });
    };

    viewer.connect().catch(() => {
      setState({ status: "error", error: "No se pudo conectar a la sesión." });
    });

    return () => {
      viewer.destroy();
    };
  }, [sessionCode]);

  if (state.status === "error") {
    return (
      <div className="card text-center text-sm text-red-400">
        {state.error}
      </div>
    );
  }

  if (state.status === "connecting" || !stream) {
    return (
      <div className="card flex flex-col items-center gap-3 py-10 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-core-muted border-t-core-accent" />
        <p className="text-sm text-core-text-muted">
          Esperando que el host comparta su pantalla...
        </p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-core-border bg-black">
      <VideoPlayer stream={stream} />
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
        <span className="h-2 w-2 animate-pulse-slow rounded-full bg-green-500" />
        Conectado
      </div>
    </div>
  );
}
