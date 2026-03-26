"use client";

import { useCallback, useRef } from "react";

/**
 * Hook for the DRAWING player — captures touch/pointer events on their
 * animation canvas and emits normalised coordinates to the WebSocket
 * at up to 60 fps.
 *
 * Usage:
 * ```tsx
 * const { attachToCanvas } = useDrawInputEmitter(sessionId, ws);
 * // After canvas mounts:
 * attachToCanvas(canvasRef.current);
 * ```
 */

interface DrawInputEmitterOptions {
  /** Active draw session ID. Null disables emission. */
  sessionId: string | null;
  /** WebSocket send function. */
  send: ((data: string) => void) | null;
  /** Max frames per second (default 60). */
  maxFps?: number;
}

export function useDrawInputEmitter({
  sessionId,
  send,
  maxFps = 60,
}: DrawInputEmitterOptions) {
  const lastEmitRef = useRef(0);
  const minIntervalMs = 1000 / maxFps;

  const emit = useCallback(
    (x: number, y: number, isDown: boolean) => {
      if (!sessionId || !send) return;

      const now = Date.now();
      if (now - lastEmitRef.current < minIntervalMs) return;
      lastEmitRef.current = now;

      send(
        JSON.stringify({
          type: "C2S_DRAW_INPUT",
          sessionId,
          x,
          y,
          isDown,
          timestamp: now,
        }),
      );
    },
    [sessionId, send, minIntervalMs],
  );

  /**
   * Attach pointer event listeners to a canvas element.
   * Returns a cleanup function.
   */
  const attachToCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return () => {};

      const getNormalized = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
          y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
        };
      };

      const onDown = (e: PointerEvent) => {
        const { x, y } = getNormalized(e);
        emit(x, y, true);
      };
      const onMove = (e: PointerEvent) => {
        if (e.buttons === 0) return; // not pressed
        const { x, y } = getNormalized(e);
        emit(x, y, true);
      };
      const onUp = (e: PointerEvent) => {
        const { x, y } = getNormalized(e);
        emit(x, y, false);
      };

      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);

      return () => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
      };
    },
    [emit],
  );

  return { emit, attachToCanvas };
}
