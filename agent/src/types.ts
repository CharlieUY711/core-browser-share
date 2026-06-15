export type ControlEventType =
  | "mousemove"
  | "mousedown"
  | "mouseup"
  | "click"
  | "keydown"
  | "keyup"
  | "scroll";

export interface ControlEvent {
  type: ControlEventType;
  x?: number;
  y?: number;
  button?: "left" | "right" | "middle";
  key?: string;
  delta?: number;
  session_code: string;
}
