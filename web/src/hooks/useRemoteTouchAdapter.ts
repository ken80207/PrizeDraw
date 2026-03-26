"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { TouchFrame } from "./useDrawInputSync";

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a stream of remote TouchFrame values into synthetic PointerEvents
 * dispatched on the target canvas element.
 *
 * This lets the real animation components (ScratchReveal, TearReveal, etc.)
 * respond to a remote drawer's touch input without any modification — they
 * receive the same pointer events they would from a local user.
 *
 * Key implementation details:
 * - Pointer capture is NOT set (we're dispatching from the outside, not inside
 *   the component's handler), so we dispatch pointermove events with bubbles.
 * - We track a synthetic "pointer is down" state so we can emit pointerdown /
 *   pointermove / pointerup transitions correctly regardless of whether
 *   individual frames carry isDown=true or isDown=false.
 * - Canvas coordinates are scaled from normalised [0,1] to actual CSS pixels
 *   using the canvas's current bounding rect each frame.
 *
 * @param canvasRef A ref to the canvas element that receives pointer events.
 * @param remoteFrame The latest remote touch frame (null when no session active).
 * @param enabled Set false to disable all event dispatch (e.g. in drawer mode).
 */
export function useRemoteTouchAdapter(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  remoteFrame: TouchFrame | null,
  enabled: boolean,
): void {
  // Track whether the remote "pointer" is currently in the pressed-down state
  // so we can emit pointerdown / pointerup transitions correctly.
  const pointerDownRef = useRef(false);

  // Keep a stable ref to the last processed timestamp to avoid replaying old frames.
  const lastTimestampRef = useRef<number>(-1);

  useEffect(() => {
    if (!enabled || !remoteFrame || !canvasRef.current) return;

    // Skip frames we have already processed (idempotent replay guard).
    if (remoteFrame.timestamp <= lastTimestampRef.current) return;
    lastTimestampRef.current = remoteFrame.timestamp;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Scale normalised coords → CSS pixel positions within the canvas.
    const clientX = rect.left + remoteFrame.x * rect.width;
    const clientY = rect.top + remoteFrame.y * rect.height;

    const baseInit: PointerEventInit = {
      pointerId: 99, // fixed synthetic ID — distinct from real touch IDs
      pointerType: "touch",
      clientX,
      clientY,
      bubbles: true,
      cancelable: true,
      isPrimary: true,
    };

    if (remoteFrame.isDown) {
      if (!pointerDownRef.current) {
        // Transition: up → down: fire pointerdown first
        pointerDownRef.current = true;
        canvas.dispatchEvent(new PointerEvent("pointerdown", baseInit));
      } else {
        // Continued drag: fire pointermove
        canvas.dispatchEvent(new PointerEvent("pointermove", baseInit));
      }
    } else {
      if (pointerDownRef.current) {
        // Transition: down → up: fire pointerup
        pointerDownRef.current = false;
        canvas.dispatchEvent(new PointerEvent("pointerup", baseInit));
      }
      // If already up and still up: nothing to do.
    }
  }, [remoteFrame, enabled, canvasRef]);

  // Clean up: emit pointerup if the remote pointer was down when the hook
  // unmounts or is disabled mid-session.
  useEffect(() => {
    // Capture canvas node at effect setup time so the cleanup closure sees a
    // stable reference (react-hooks/exhaustive-deps warns when using
    // canvasRef.current inside a cleanup function directly).
    const canvas = canvasRef.current;
    return () => {
      if (pointerDownRef.current && canvas) {
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(
          new PointerEvent("pointerup", {
            pointerId: 99,
            pointerType: "touch",
            clientX: rect.left,
            clientY: rect.top,
            bubbles: true,
          }),
        );
        pointerDownRef.current = false;
      }
    };
  // canvasRef.current is captured above; enabled controls when we re-run
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
