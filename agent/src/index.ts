import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { mouse, keyboard, Point, Key, Button } from "@nut-tree-fork/nut-js";
import type { ControlEvent } from "./types";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SESSION_CODE = process.argv[2] || process.env.SESSION_CODE!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SESSION_CODE) {
  console.error("Uso: core-agent <SESSION_CODE>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
mouse.config.mouseSpeed = 2000;

async function getScreenSize() {
  const { screen } = await import("@nut-tree-fork/nut-js");
  return { width: await screen.width(), height: await screen.height() };
}

const KEY_MAP: Record<string, Key> = {
  Enter: Key.Return, Backspace: Key.Backspace, Delete: Key.Delete,
  Escape: Key.Escape, Tab: Key.Tab, ArrowUp: Key.Up, ArrowDown: Key.Down,
  ArrowLeft: Key.Left, ArrowRight: Key.Right, Control: Key.LeftControl,
  Shift: Key.LeftShift, Alt: Key.LeftAlt, Meta: Key.LeftSuper, " ": Key.Space,
};

async function handleEvent(event: ControlEvent, screen: { width: number; height: number }) {
  try {
    switch (event.type) {
      case "mousemove":
        if (event.x !== undefined && event.y !== undefined)
          await mouse.move([new Point(Math.round(event.x * screen.width), Math.round(event.y * screen.height))]);
        break;
      case "mousedown":
      case "mouseup": {
        const btn = event.button === "right" ? Button.RIGHT : event.button === "middle" ? Button.MIDDLE : Button.LEFT;
        if (event.x !== undefined && event.y !== undefined)
          await mouse.move([new Point(Math.round(event.x * screen.width), Math.round(event.y * screen.height))]);
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

async function main() {
  console.log(`\n Core Agent v0.1.0 — sesión: ${SESSION_CODE}`);
  const screen = await getScreenSize();
  console.log(`Pantalla: ${screen.width}x${screen.height}`);

  const channel = supabase.channel(`control:${SESSION_CODE}`, {
    config: { presence: { key: "agent" } }
  });

  channel
    .on("broadcast", { event: "control" }, ({ payload }) => {
      handleEvent(payload as ControlEvent, screen);
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
