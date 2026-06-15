import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { mouse, keyboard, Point, Key, Button, screen } from "@nut-tree-fork/nut-js";
import screenshot from "screenshot-desktop";
import type { ControlEvent } from "./types";

// @roamhq/wrtc para WebRTC en Node
const wrtc = require("@roamhq/wrtc");
const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, nonstandard } = wrtc;
const { RTCVideoSource, RTCAudioSource } = nonstandard;

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SESSION_CODE = process.argv[2] || process.env.SESSION_CODE!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SESSION_CODE) {
  console.error("Uso: core-agent <SESSION_CODE>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
mouse.config.mouseSpeed = 2000;

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const KEY_MAP: Record<string, Key> = {
  Enter: Key.Return, Backspace: Key.Backspace, Delete: Key.Delete,
  Escape: Key.Escape, Tab: Key.Tab, ArrowUp: Key.Up, ArrowDown: Key.Down,
  ArrowLeft: Key.Left, ArrowRight: Key.Right, Control: Key.LeftControl,
  Shift: Key.LeftShift, Alt: Key.LeftAlt, Meta: Key.LeftSuper, " ": Key.Space,
};

async function getScreenSize() {
  return { width: await screen.width(), height: await screen.height() };
}

async function handleEvent(event: ControlEvent, screenSize: { width: number; height: number }) {
  try {
    switch (event.type) {
      case "mousemove":
        if (event.x !== undefined && event.y !== undefined)
          await mouse.move([new Point(Math.round(event.x * screenSize.width), Math.round(event.y * screenSize.height))]);
        break;
      case "mousedown":
      case "mouseup": {
        const btn = event.button === "right" ? Button.RIGHT : event.button === "middle" ? Button.MIDDLE : Button.LEFT;
        if (event.x !== undefined && event.y !== undefined)
          await mouse.move([new Point(Math.round(event.x * screenSize.width), Math.round(event.y * screenSize.height))]);
        if (event.type === "mousedown") await mouse.pressButton(btn);
        else await mouse.releaseButton(btn);
        break;
      }
      case "scroll":
        if (event.delta !== undefined) {
          if (event.delta > 0) await mouse.scrollDown(Math.round(event.delta / 100));
          else await mouse.scrollUp(Math.round(Math.abs(event.delta) / 100));
        }
        break;
      case "keydown": {
        if (!event.key) break;
        const k = KEY_MAP[event.key];
        if (k) await keyboard.pressKey(k);
        else if (event.key.length === 1) await keyboard.type(event.key);
        break;
      }
      case "keyup": {
        if (!event.key) break;
        const k = KEY_MAP[event.key];
        if (k) await keyboard.releaseKey(k);
        break;
      }
    }
  } catch {}
}

// Captura pantalla en loop y alimenta el RTCVideoSource
async function startScreenCapture(videoSource: any, screenSize: { width: number; height: number }) {
  const FPS = 15;
  const interval = 1000 / FPS;

  const capture = async () => {
    try {
      const imgBuffer = await screenshot({ format: "png" });
      // Convertir PNG a raw RGBA para wrtc
      const { createCanvas, loadImage } = await import("canvas").catch(() => ({ createCanvas: null, loadImage: null }));
      if (!createCanvas || !loadImage) {
        // Fallback: sin canvas, usar jimp
        const Jimp = (await import("jimp").catch(() => null))?.default;
        if (!Jimp) return;
        const img = await Jimp.read(imgBuffer);
        img.resize(1280, 720);
        const w = img.getWidth();
        const h = img.getHeight();
        const data = new Uint8ClampedArray(w * h * 4);
        let i = 0;
        img.scan(0, 0, w, h, (_x: number, _y: number, idx: number) => {
          data[i++] = img.bitmap.data[idx];
          data[i++] = img.bitmap.data[idx + 1];
          data[i++] = img.bitmap.data[idx + 2];
          data[i++] = 255;
        });
        videoSource.onFrame({ width: w, height: h, data });
      } else {
        const img = await loadImage(imgBuffer);
        const W = 1280, H = 720;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img as any, 0, 0, W, H);
        const frame = ctx.getImageData(0, 0, W, H);
        videoSource.onFrame({ width: W, height: H, data: frame.data });
      }
    } catch {}
    setTimeout(capture, interval);
  };

  capture();
}

async function main() {
  console.log(`\n Core Agent v0.2.0 — sesión: ${SESSION_CODE}`);
  const screenSize = await getScreenSize();
  console.log(`Pantalla: ${screenSize.width}x${screenSize.height}`);

  // Signaling via Supabase
  const signalingCh = supabase.channel(`signaling:${SESSION_CODE}`);
  const controlCh = supabase.channel(`control:${SESSION_CODE}`, {
    config: { presence: { key: "agent" } }
  });

  let pc: any = null;

  signalingCh
    .on("broadcast", { event: "signal" }, async ({ payload }: any) => {
      if (payload.from === "agent") return; // ignorar los propios

      if (payload.type === "ready") {
        console.log("Viewer conectado, iniciando WebRTC...");

        // Crear peer connection
        pc = new RTCPeerConnection(ICE_SERVERS);

        // Video source — pantalla
        const videoSource = new RTCVideoSource();
        const videoTrack = videoSource.createTrack();
        pc.addTrack(videoTrack);

        // Iniciar captura
        startScreenCapture(videoSource, screenSize);

        // ICE candidates
        pc.onicecandidate = async ({ candidate }: any) => {
          if (candidate) {
            await signalingCh.send({
              type: "broadcast",
              event: "signal",
              payload: { type: "candidate", payload: candidate.toJSON(), from: "agent" }
            });
          }
        };

        // Crear offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await signalingCh.send({
          type: "broadcast",
          event: "signal",
          payload: { type: "offer", payload: offer, from: "agent" }
        });
      }

      if (payload.type === "answer" && pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
      }

      if (payload.type === "candidate" && pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.payload)); } catch {}
      }
    })
    .subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        console.log("Signaling listo, esperando viewer...");
      }
    });

  // Control remoto
  controlCh
    .on("broadcast", { event: "control" }, ({ payload }: any) => {
      handleEvent(payload as ControlEvent, screenSize);
    })
    .subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await controlCh.track({ online_at: new Date().toISOString(), screen: screenSize });
        console.log(`Agent online. Sesión: ${SESSION_CODE}\nCtrl+C para detener.\n`);
      }
    });

  process.on("SIGINT", async () => {
    pc?.close();
    await supabase.removeChannel(signalingCh);
    await supabase.removeChannel(controlCh);
    process.exit(0);
  });
}

main().catch(console.error);
