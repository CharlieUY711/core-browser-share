"use client";

import { useCallback, useRef, useState } from "react";

export function useScreenShare() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCapture = useCallback(async (): Promise<MediaStream | null> => {
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // Prefer window capture — user will choose from the browser dialog
          displaySurface: "window",
          frameRate: 30,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);

      // Clean up when the user stops sharing via the browser's native button
      mediaStream.getVideoTracks()[0].addEventListener("ended", () => {
        setStream(null);
        streamRef.current = null;
      });

      return mediaStream;
    } catch (err) {
      if (err instanceof Error && err.name !== "NotAllowedError") {
        setError("No se pudo acceder a la pantalla.");
      }
      return null;
    }
  }, []);

  const stopCapture = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  return { stream, error, startCapture, stopCapture };
}
