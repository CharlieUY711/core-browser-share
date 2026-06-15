import type { SignalingMessage } from "@/types";
import { SignalingChannel } from "./signaling";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export class WebRTCHost {
  private pc: RTCPeerConnection;
  private signaling: SignalingChannel;
  private stream: MediaStream;

  constructor(sessionCode: string, stream: MediaStream) {
    this.stream = stream;
    this.signaling = new SignalingChannel(sessionCode, "host");
    this.pc = new RTCPeerConnection(ICE_SERVERS);
  }

  async start(): Promise<void> {
    // Add all tracks from the captured stream
    this.stream.getTracks().forEach((track) => {
      this.pc.addTrack(track, this.stream);
    });

    // Send ICE candidates as they are gathered
    this.pc.onicecandidate = async ({ candidate }) => {
      if (candidate) {
        await this.signaling.send({ type: "candidate", payload: candidate.toJSON() });
      }
    };

    // Subscribe and wait for the viewer to signal "ready"
    await this.signaling.subscribe(async (message: SignalingMessage) => {
      if (message.type === "ready") {
        await this.createAndSendOffer();
      }

      if (message.type === "answer" && message.payload) {
        await this.pc.setRemoteDescription(
          new RTCSessionDescription(message.payload as RTCSessionDescriptionInit)
        );
      }

      if (message.type === "candidate" && message.payload) {
        await this.pc.addIceCandidate(
          new RTCIceCandidate(message.payload as RTCIceCandidateInit)
        );
      }
    });
  }

  private async createAndSendOffer(): Promise<void> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.signaling.send({ type: "offer", payload: offer });
  }

  destroy(): void {
    this.stream.getTracks().forEach((t) => t.stop());
    this.pc.close();
    this.signaling.destroy();
  }
}

export class WebRTCViewer {
  private pc: RTCPeerConnection;
  private signaling: SignalingChannel;
  onTrack: ((stream: MediaStream) => void) | null = null;

  constructor(sessionCode: string) {
    this.signaling = new SignalingChannel(sessionCode, "viewer");
    this.pc = new RTCPeerConnection(ICE_SERVERS);
  }

  async connect(): Promise<void> {
    this.pc.ontrack = ({ streams }) => {
      if (this.onTrack && streams[0]) {
        this.onTrack(streams[0]);
      }
    };

    this.pc.onicecandidate = async ({ candidate }) => {
      if (candidate) {
        await this.signaling.send({ type: "candidate", payload: candidate.toJSON() });
      }
    };

    await this.signaling.subscribe(async (message: SignalingMessage) => {
      if (message.type === "offer" && message.payload) {
        await this.pc.setRemoteDescription(
          new RTCSessionDescription(message.payload as RTCSessionDescriptionInit)
        );
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await this.signaling.send({ type: "answer", payload: answer });
      }

      if (message.type === "candidate" && message.payload) {
        await this.pc.addIceCandidate(
          new RTCIceCandidate(message.payload as RTCIceCandidateInit)
        );
      }
    });

    // Notify the host we are ready to receive
    await this.signaling.send({ type: "ready", payload: null });
  }

  destroy(): void {
    this.pc.close();
    this.signaling.destroy();
  }
}
