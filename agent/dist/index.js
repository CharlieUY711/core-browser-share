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
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const nut_js_1 = require("@nut-tree-fork/nut-js");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SESSION_CODE = process.argv[2] || process.env.SESSION_CODE;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SESSION_CODE) {
    console.error("Uso: core-agent <SESSION_CODE>");
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
nut_js_1.mouse.config.mouseSpeed = 2000;
async function getScreenSize() {
    const { screen } = await Promise.resolve().then(() => __importStar(require("@nut-tree-fork/nut-js")));
    return { width: await screen.width(), height: await screen.height() };
}
const KEY_MAP = {
    Enter: nut_js_1.Key.Return, Backspace: nut_js_1.Key.Backspace, Delete: nut_js_1.Key.Delete,
    Escape: nut_js_1.Key.Escape, Tab: nut_js_1.Key.Tab, ArrowUp: nut_js_1.Key.Up, ArrowDown: nut_js_1.Key.Down,
    ArrowLeft: nut_js_1.Key.Left, ArrowRight: nut_js_1.Key.Right, Control: nut_js_1.Key.LeftControl,
    Shift: nut_js_1.Key.LeftShift, Alt: nut_js_1.Key.LeftAlt, Meta: nut_js_1.Key.LeftSuper, " ": nut_js_1.Key.Space,
};
async function handleEvent(event, screen) {
    try {
        switch (event.type) {
            case "mousemove":
                if (event.x !== undefined && event.y !== undefined)
                    await nut_js_1.mouse.move([new nut_js_1.Point(Math.round(event.x * screen.width), Math.round(event.y * screen.height))]);
                break;
            case "mousedown":
            case "mouseup": {
                const btn = event.button === "right" ? nut_js_1.Button.RIGHT : event.button === "middle" ? nut_js_1.Button.MIDDLE : nut_js_1.Button.LEFT;
                if (event.x !== undefined && event.y !== undefined)
                    await nut_js_1.mouse.move([new nut_js_1.Point(Math.round(event.x * screen.width), Math.round(event.y * screen.height))]);
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
async function main() {
    console.log(`\n Core Agent v0.1.0 — sesión: ${SESSION_CODE}`);
    const screen = await getScreenSize();
    console.log(`Pantalla: ${screen.width}x${screen.height}`);
    const channel = supabase.channel(`control:${SESSION_CODE}`, {
        config: { presence: { key: "agent" } }
    });
    channel
        .on("broadcast", { event: "control" }, ({ payload }) => {
        handleEvent(payload, screen);
    })
        .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
            // Anunciar presencia del agent
            await channel.track({ online_at: new Date().toISOString(), screen });
            console.log(`Agent online. El viewer puede tomar control ahora.\n`);
            console.log(`Ctrl+C para detener.\n`);
        }
    });
    process.on("SIGINT", async () => {
        await channel.untrack();
        await supabase.removeChannel(channel);
        process.exit(0);
    });
}
main().catch(console.error);
