"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const nut_js_1 = require("@nut-tree-fork/nut-js");
const screenshot_desktop_1 = __importDefault(require("screenshot-desktop"));
// @roamhq/wrtc para WebRTC en Node
const wrtc = require("@roamhq/wrtc");
const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, nonstandard } = wrtc;
const { RTCVideoSource, RTCAudioSource } = nonstandard;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SESSION_CODE = process.argv[2] || process.env.SESSION_CODE;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SESSION_CODE) {
    console.error("Uso: core-agent <SESSION_CODE>");
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
nut_js_1.mouse.config.mouseSpeed = 2000;
const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};
const KEY_MAP = {
    Enter: nut_js_1.Key.Return, Backspace: nut_js_1.Key.Backspace, Delete: nut_js_1.Key.Delete,
    Escape: nut_js_1.Key.Escape, Tab: nut_js_1.Key.Tab, ArrowUp: nut_js_1.Key.Up, ArrowDown: nut_js_1.Key.Down,
    ArrowLeft: nut_js_1.Key.Left, ArrowRight: nut_js_1.Key.Right, Control: nut_js_1.Key.LeftControl,
    Shift: nut_js_1.Key.LeftShift, Alt: nut_js_1.Key.LeftAlt, Meta: nut_js_1.Key.LeftSuper, " ": nut_js_1.Key.Space,
};
async function getScreenSize() {
    return { width: await nut_js_1.screen.width(), height: await nut_js_1.screen.height() };
}
async function handleEvent(event, screenSize) {
    try {
        switch (event.type) {
            case "mousemove":
                if (event.x !== undefined && event.y !== undefined)
                    await nut_js_1.mouse.move([new nut_js_1.Point(Math.round(event.x * screenSize.width), Math.round(event.y * screenSize.height))]);
                break;
            case "mousedown":
            case "mouseup": {
                const btn = event.button === "right" ? nut_js_1.Button.RIGHT : event.button === "middle" ? nut_js_1.Button.MIDDLE : nut_js_1.Button.LEFT;
                if (event.x !== undefined && event.y !== undefined)
                    await nut_js_1.mouse.move([new nut_js_1.Point(Math.round(event.x * screenSize.width), Math.round(event.y * screenSize.height))]);
                if (event.type === "mousedown")
                    await nut_js_1.mouse.pressButton(btn);
                else
                    await nut_js_1.mouse.releaseButton(btn);
                break;
            }
            case "scroll":
                if (event.delta !== undefined) {
                    if (event.delta > 0)
                        await nut_js_1.mouse.scrollDown(Math.round(event.delta / 100));
                    else
                        await nut_js_1.mouse.scrollUp(Math.round(Math.abs(event.delta) / 100));
                }
                break;
            case "keydown": {
                if (!event.key)
                    break;
                const k = KEY_MAP[event.key];
                if (k)
                    await nut_js_1.keyboard.pressKey(k);
                else if (event.key.length === 1)
                    await nut_js_1.keyboard.type(event.key);
                break;
            }
            case "keyup": {
                if (!event.key)
                    break;
                const k = KEY_MAP[event.key];
                if (k)
                    await nut_js_1.keyboard.releaseKey(k);
                break;
            }
        }
    }
    catch { }
}
// Captura pantalla en loop y alimenta el RTCVideoSource
async function startScreenCapture(videoSource, screenSize) {
    const FPS = 15;
    const interval = 1000 / FPS;
    const capture = async () => {
        try {
            const imgBuffer = await (0, screenshot_desktop_1.default)({ format: "png" });
            // Convertir PNG a raw RGBA para wrtc
            const { createCanvas, loadImage } = await Promise.resolve().then(() => __importStar(require("canvas"))).catch(() => ({ createCanvas: null, loadImage: null }));
            if (!createCanvas || !loadImage) {
                // Fallback: sin canvas, usar jimp
                const Jimp = (await Promise.resolve().then(() => __importStar(require("jimp"))).catch(() => null))?.default;
                if (!Jimp)
                    return;
                const img = await Jimp.read(imgBuffer);
                img.resize(1280, 720);
                const w = img.getWidth();
                const h = img.getHeight();
                const data = new Uint8ClampedArray(w * h * 4);
                let i = 0;
                img.scan(0, 0, w, h, (_x, _y, idx) => {
                    data[i++] = img.bitmap.data[idx];
                    data[i++] = img.bitmap.data[idx + 1];
                    data[i++] = img.bitmap.data[idx + 2];
                    data[i++] = 255;
                });
                videoSource.onFrame({ width: w, height: h, data });
            }
            else {
                const img = await loadImage(imgBuffer);
                const W = 1280, H = 720;
                const canvas = createCanvas(W, H);
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, W, H);
                const frame = ctx.getImageData(0, 0, W, H);
                videoSource.onFrame({ width: W, height: H, data: frame.data });
            }
        }
        catch { }
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
    let pc = null;
    signalingCh
        .on("broadcast", { event: "signal" }, async ({ payload }) => {
        if (payload.from === "agent")
            return; // ignorar los propios
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
            pc.onicecandidate = async ({ candidate }) => {
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
            try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.payload));
            }
            catch { }
        }
    })
        .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
            console.log("Signaling listo, esperando viewer...");
        }
    });
    // Control remoto
    controlCh
        .on("broadcast", { event: "control" }, ({ payload }) => {
        handleEvent(payload, screenSize);
    })
        .subscribe(async (status) => {
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
