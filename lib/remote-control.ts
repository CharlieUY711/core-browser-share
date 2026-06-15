import { supabase } from "./supabase";
import type { ControlEvent } from "./control";

/**
 * Dado un punto normalizado (0-1, 0-1), encuentra el elemento
 * real en el DOM del host y dispara el evento correspondiente.
 */
function getElementAt(x: number, y: number): Element | null {
  const px = x * window.innerWidth;
  const py = y * window.innerHeight;
  return document.elementFromPoint(px, py);
}

function fireMouseEvent(type: string, x: number, y: number, button = 0) {
  const px = x * window.innerWidth;
  const py = y * window.innerHeight;
  const el = document.elementFromPoint(px, py) ?? document.body;
  el.dispatchEvent(new MouseEvent(type, {
    bubbles: true, cancelable: true,
    clientX: px, clientY: py,
    screenX: px, screenY: py,
    button, buttons: button === 0 ? 1 : 0,
  }));
}

function fireKeyEvent(type: string, key: string) {
  const el = document.activeElement ?? document.body;
  el.dispatchEvent(new KeyboardEvent(type, {
    bubbles: true, cancelable: true, key,
    code: `Key${key.toUpperCase()}`,
  }));
  // Si es keydown y es un caracter imprimible, insertar en input activo
  if (type === "keydown" && key.length === 1) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const start = el.selectionStart ?? el.value.length;
      el.value = el.value.slice(0, start) + key + el.value.slice(start);
      el.selectionStart = el.selectionEnd = start + 1;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
}

export function applyControlEvent(event: ControlEvent) {
  const x = event.x ?? 0;
  const y = event.y ?? 0;
  const btnMap: Record<string, number> = { left: 0, middle: 1, right: 2 };
  const btn = btnMap[event.button ?? "left"] ?? 0;

  switch (event.type) {
    case "mousemove":
      fireMouseEvent("mousemove", x, y);
      break;
    case "mousedown":
      fireMouseEvent("mousedown", x, y, btn);
      // Foco en el elemento bajo el cursor
      (document.elementFromPoint(x * window.innerWidth, y * window.innerHeight) as HTMLElement)?.focus?.();
      break;
    case "mouseup":
      fireMouseEvent("mouseup", x, y, btn);
      fireMouseEvent("click", x, y, btn);
      break;
    case "scroll": {
      const el = document.elementFromPoint(x * window.innerWidth, y * window.innerHeight) ?? document.documentElement;
      el.scrollBy({ top: event.delta ?? 0, behavior: "instant" as ScrollBehavior });
      break;
    }
    case "keydown":
      if (event.key === "Backspace") {
        const el = document.activeElement;
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          const start = el.selectionStart ?? el.value.length;
          if (start > 0) {
            el.value = el.value.slice(0, start - 1) + el.value.slice(start);
            el.selectionStart = el.selectionEnd = start - 1;
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
      } else {
        fireKeyEvent("keydown", event.key ?? "");
      }
      break;
    case "keyup":
      fireKeyEvent("keyup", event.key ?? "");
      break;
  }
}

export function startRemoteControlListener(sessionCode: string) {
  const channel = supabase.channel(`control:${sessionCode}`);
  channel
    .on("broadcast", { event: "control" }, ({ payload }) => {
      applyControlEvent(payload as ControlEvent);
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}
