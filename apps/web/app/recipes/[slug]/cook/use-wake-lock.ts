"use client";

import { useEffect, useState } from "react";

export type WakeLockStatus = "active" | "pending" | "unsupported";

/**
 * Keeps the screen on while mounted. The browser releases the lock when the
 * tab is hidden, so it is re-requested on `visibilitychange`.
 */
export function useWakeLock(): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>("pending");

  useEffect(() => {
    if (!("wakeLock" in navigator && window.isSecureContext)) {
      setStatus("unsupported");
      return;
    }
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function request() {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock.release();
          return;
        }
        sentinel = lock;
        setStatus("active");
        lock.addEventListener("release", () => {
          if (!cancelled) {
            setStatus("pending");
          }
        });
      } catch {
        setStatus("unsupported");
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        request();
      }
    }

    request();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sentinel?.release().catch(() => undefined);
    };
  }, []);

  return status;
}
