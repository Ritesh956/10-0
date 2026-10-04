import { useEffect, useState } from "react";

/** Chrome/Edge/Android's install prompt event (not in the DOM lib types). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Called once at startup (main.tsx): the browser fires `beforeinstallprompt` early, often before
    React has mounted anything that could listen for it, so it's captured here and held. Also
    registers the service worker — production builds only, so dev/HMR is never served from a cache. */
export function initPwa(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // No offline shell — the site still works online.
      });
    });
  }
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iOS Safari has no install prompt — installing is Share → Add to Home Screen, so we explain it. */
export function isIosBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone();
}

/** Whether the "Install app" action is available, and the call that shows the browser's prompt. */
export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void>; iosHint: boolean } {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return {
    canInstall: deferred !== null && !isStandalone(),
    iosHint: isIosBrowser(),
    install: async () => {
      if (!deferred) return;
      const event = deferred;
      deferred = null;
      await event.prompt();
      await event.userChoice.catch(() => undefined);
      notify();
    },
  };
}

/** Tracks the browser's online state, for the "you're offline" banner. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
