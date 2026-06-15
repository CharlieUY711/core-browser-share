"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const nut_js_1 = require("@nut-tree-fork/nut-js");
const wrtc = require("@roamhq/wrtc");
const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, nonstandard } = wrtc;
const { RTCVideoSource } = nonstandard;
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
async function startScreenCapture(videoSource, W, H) {
    const screenshot = require("screenshot-desktop");
    const Jimp = require("jimp");
    const FPS = 15;
    const capture = async () => {
        const start = Date.now();
        try {
            const buf = await screenshot({ format: "png" });
            const img = await Jimp.Jimp.read(buf);
            img.resize({ w: W, h: H });
            const data = new Uint8ClampedArray(W * H * 4);
            let i = 0;
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const idx = (y * W + x) * 4;
                    data[i++] = img.bitmap.data[idx];
                    data[i++] = img.bitmap.data[idx + 1];
                    data[i++] = img.bitmap.data[idx + 2];
                    data[i++] = 255;
                }
            }
            videoSource.onFrame({ width: W, height: H, data });
        }
        catch (e) {
            // silenciar errores de captura
        }
        const elapsed = Date.now() - start;
        setTimeout(capture, Math.max(0, 1000 / FPS - elapsed));
    };
    capture();
}
async function main() {
    console.log(`\n Core Agent v0.2.0 — sesión: ${SESSION_CODE}`);
    const screenSize = await getScreenSize();
    const W = 1280, H = Math.round(1280 * screenSize.height / screenSize.width);
    console.log(`Pantalla: ${screenSize.width}x${screenSize.height} → stream ${W}x${H}`);
    const signalingCh = supabase.channel(`signaling:${SESSION_CODE}`);
    const controlCh = supabase.channel(`control:${SESSION_CODE}`, {
        config: { presence: { key: "agent" } }
    });
    let pc = null;
    signalingCh
        .on("broadcast", { event: "signal" }, async ({ payload }) => {
        if (payload.from === "agent")
            return;
        if (payload.type === "ready") {
            console.log("Viewer conectado, iniciando WebRTC...");
            pc = new RTCPeerConnection(ICE_SERVERS);
            const videoSource = new RTCVideoSource();
            const videoTrack = videoSource.createTrack();
            pc.addTrack(videoTrack);
            startScreenCapture(videoSource, W, H);
            pc.onicecandidate = async ({ candidate }) => {
                if (candidate) {
                    await signalingCh.send({
                        type: "broadcast", event: "signal",
                        payload: { type: "candidate", payload: candidate.toJSON(), from: "agent" }
                    });
                }
            };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await signalingCh.send({
                type: "broadcast", event: "signal",
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
        .subscribe((status) => {
        if (status === "SUBSCRIBED")
            console.log("Signaling listo, esperando viewer...");
    });
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
