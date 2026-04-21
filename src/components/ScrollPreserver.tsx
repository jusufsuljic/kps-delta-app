"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const PENDING_SCROLL_KEY = "kps-delta-app:pending-scroll";

type PendingScrollState = {
  pathname: string;
  timestamp: number;
  y: number;
};

function readPendingScroll(): PendingScrollState | null {
  const rawValue = sessionStorage.getItem(PENDING_SCROLL_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const value = JSON.parse(rawValue) as Partial<PendingScrollState>;
    if (
      typeof value.pathname !== "string" ||
      typeof value.timestamp !== "number" ||
      typeof value.y !== "number"
    ) {
      return null;
    }

    return value as PendingScrollState;
  } catch {
    return null;
  }
}

function writePendingScroll(y: number) {
  sessionStorage.setItem(
    PENDING_SCROLL_KEY,
    JSON.stringify({
      pathname: window.location.pathname,
      timestamp: Date.now(),
      y,
    } satisfies PendingScrollState),
  );
}

function clearPendingScroll() {
  sessionStorage.removeItem(PENDING_SCROLL_KEY);
}

function restoreScrollPosition(y: number) {
  window.scrollTo({
    top: y,
    left: 0,
    behavior: "auto",
  });
}

function scheduleRestore(y: number) {
  restoreScrollPosition(y);
  requestAnimationFrame(() => restoreScrollPosition(y));

  const timeouts = [
    window.setTimeout(() => restoreScrollPosition(y), 80),
    window.setTimeout(() => restoreScrollPosition(y), 220),
    window.setTimeout(() => restoreScrollPosition(y), 500),
  ];

  return () => {
    for (const timeout of timeouts) {
      window.clearTimeout(timeout);
    }
  };
}

export function ScrollPreserver() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;
  const lastAppliedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const pendingScroll = readPendingScroll();
    if (!pendingScroll || pendingScroll.pathname !== pathname) {
      return;
    }

    const applyKey = `${routeKey}:${pendingScroll.timestamp}`;
    if (lastAppliedKeyRef.current === applyKey) {
      return;
    }

    lastAppliedKeyRef.current = applyKey;
    const cancelRestore = scheduleRestore(pendingScroll.y);
    const cleanupTimeout = window.setTimeout(() => {
      const latestPendingScroll = readPendingScroll();
      if (latestPendingScroll?.timestamp === pendingScroll.timestamp) {
        clearPendingScroll();
      }
    }, 700);

    return () => {
      cancelRestore();
      window.clearTimeout(cleanupTimeout);
    };
  }, [pathname, routeKey]);

  useEffect(() => {
    function handleSubmit(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      if (form.dataset.preserveScroll !== "true") {
        return;
      }

      const scrollY = window.scrollY;
      writePendingScroll(scrollY);
      scheduleRestore(scrollY);
    }

    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  return null;
}
