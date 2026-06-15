const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SESSION_CODE = process.argv[2] || process.env.SESSION_CODE;

async function main() {
  const { mouse, keyboard, Point, Key, Button, screen } = require("@nut-tree-fork/nut-js");
  mouse.config.mouseSpeed = 2000;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const screenW = await screen.width();
  const screenH = await screen.height();

  console.log(`Agent online — ${screenW}x${screenH} — sesión ${SESSION_CODE}`);

  const KEY_MAP = {
    Enter: Key.Return, Backspace: Key.Backspace, Delete: Key.Delete,
    Escape: Key.Escape, Tab: Key.Tab, ArrowUp: Key.Up, ArrowDown: Key.Down,
    ArrowLeft: Key.Left, ArrowRight: Key.Right, " ": Key.Space,
  };

  async function handleControl(event) {
    try {
      const px = Math.round((event.x ?? 0) * screenW);
      const py = Math.round((event.y ?? 0) * screenH);
      switch (event.type) {
        case "mousemove": await mouse.move([new Point(px, py)]); break;
        case "mousedown": {
          const btn = event.button === "right" ? Button.RIGHT : event.button === "middle" ? Button.MIDDLE : Button.LEFT;
          await mouse.move([new Point(px, py)]);
          await mouse.pressButton(btn); break;
        }
        case "mouseup": {
          const btn = event.button === "right" ? Button.RIGHT : event.button === "middle" ? Button.MIDDLE : Button.LEFT;
          await mouse.move([new Point(px, py)]);
          await mouse.releaseButton(btn); break;
        }
        case "scroll":
          if ((event.delta ?? 0) > 0) await mouse.scrollDown(Math.round(Math.abs(event.delta) / 100));
          else await mouse.scrollUp(Math.round(Math.abs(event.delta ?? 0) / 100));
          break;
        case "keydown": {
          const k = KEY_MAP[event.key];
          if (k) await keyboard.pressKey(k);
          else if (event.key?.length === 1) await keyboard.type(event.key);
          break;
        }
        case "keyup": {
          const k = KEY_MAP[event.key];
          if (k) await keyboard.releaseKey(k);
          break;
        }
      }
    } catch {}
  }

  const ch = supabase.channel(`control:${SESSION_CODE}`, {
    config: { presence: { key: "agent" } }
  });

  ch.on("broadcast", { event: "control" }, ({ payload }) => handleControl(payload))
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ online_at: new Date().toISOString(), screenW, screenH });
      }
    });

  process.on("SIGTERM", () => { supabase.removeChannel(ch); process.exit(0); });
}

main().catch(console.error);
