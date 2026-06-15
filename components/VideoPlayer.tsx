"use client";

import { useEffect, useRef } from "react";

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}

export function VideoPlayer({ stream, muted = false, className = "" }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`h-full w-full rounded-lg object-contain ${className}`}
    />
  );
}
