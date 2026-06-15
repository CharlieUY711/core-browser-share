import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { SignalingMessage, SessionRole } from "@/types";

type MessageHandler = (message: SignalingMessage) => void;

export class SignalingChannel {
  private channel: RealtimeChannel;
  private sessionCode: string;
  private role: SessionRole;

  constructor(sessionCode: string, role: SessionRole) {
    this.sessionCode = sessionCode;
    this.role = role;
    this.channel = supabase.channel(`session:${sessionCode}`);
  }

  subscribe(onMessage: MessageHandler): Promise<void> {
    return new Promise((resolve, reject) => {
      this.channel
        .on("broadcast", { event: "signal" }, ({ payload }) => {
          const message = payload as SignalingMessage;
          // Ignore our own messages
          if (message.from !== this.role) {
            onMessage(message);
          }
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") resolve();
          if (status === "CHANNEL_ERROR") reject(new Error("Channel error"));
        });
    });
  }

  async send(message: Omit<SignalingMessage, "from" | "session_code">): Promise<void> {
    await this.channel.send({
      type: "broadcast",
      event: "signal",
      payload: {
        ...message,
        from: this.role,
        session_code: this.sessionCode,
      } satisfies SignalingMessage,
    });
  }

  destroy(): void {
    supabase.removeChannel(this.channel);
  }
}
