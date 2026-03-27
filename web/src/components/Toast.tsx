"use client";

import { useEffect, useState, useCallback } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

type Listener = (toasts: ToastMessage[]) => void;

// Module-level toast queue so any component can trigger toasts
let _toasts: ToastMessage[] = [];
const _listeners = new Set<Listener>();

function notify() {
  _listeners.forEach((fn) => fn([..._toasts]));
}

export const toast = {
  show(message: string, type: ToastType = "info") {
    const id = Math.random().toString(36).slice(2);
    _toasts = [..._toasts, { id, type, message }];
    notify();
    setTimeout(() => {
      _toasts = _toasts.filter((t) => t.id !== id);
      notify();
    }, 3500);
  },
  success(message: string) {
    this.show(message, "success");
  },
  error(message: string) {
    this.show(message, "error");
  },
  info(message: string) {
    this.show(message, "info");
  },
  warning(message: string) {
    this.show(message, "warning");
  },
};

const ICONS: Record<ToastType, string> = {
  success: "check_circle",
  error: "error",
  info: "info",
  warning: "warning",
};

const COLORS: Record<ToastType, string> = {
  success: "bg-emerald-600/90 text-white backdrop-blur-xl",
  error: "bg-error-container/90 text-on-error-container backdrop-blur-xl",
  info: "bg-secondary-container/90 text-on-secondary-container backdrop-blur-xl",
  warning: "bg-primary-container/90 text-on-primary backdrop-blur-xl",
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener: Listener = (updated) => setToasts(updated);
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    _toasts = _toasts.filter((t) => t.id !== id);
    notify();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm animate-in slide-in-from-right-4 fade-in ${COLORS[t.type]}`}
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{ICONS[t.type]}</span>
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="ml-2 opacity-75 hover:opacity-100 text-lg leading-none"
            aria-label="關閉"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
