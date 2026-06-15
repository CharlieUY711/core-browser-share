export interface BrowserSession {
  id: string;
  code: string;
  created_at: string;
  active: boolean;
}

export type SessionRole = "host" | "viewer";

export interface SignalingMessage {
  type: "offer" | "answer" | "candidate" | "ready" | "bye";
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
  from: SessionRole;
  session_code: string;
}

export interface WebRTCState {
  status: "idle" | "connecting" | "connected" | "disconnected" | "error";
  error?: string;
}
