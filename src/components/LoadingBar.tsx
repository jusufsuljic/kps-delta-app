"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const INITIAL_PROGRESS = 0.08;
const MAX_TRICKLE_PROGRESS = 0.9;

function isModifiedEvent(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function isInternalNavigationLink(anchor: HTMLAnchorElement) {
  if (!anchor.href || anchor.target === "_blank" || anchor.hasAttribute("download")) {
    return false;
  }

  try {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) {
      return false;
    }

    const currentUrl = new URL(window.location.href);
    if (url.pathname === currentUrl.pathname && url.search === currentUrl.search && url.hash) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isTrackableFetchInput(input: RequestInfo | URL) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const url =
      typeof input === "string"
        ? new URL(input, window.location.href)
        : input instanceof URL
          ? input
          : new URL(input.url, window.location.href);

    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function LoadingBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const isFirstRenderRef = useRef(true);
  const pendingNavigationRef = useRef(false);
  const activeFetchCountRef = useRef(0);
  const trickleIntervalRef = useRef<number | null>(null);
  const finishTimeoutRef = useRef<number | null>(null);
  const navigationFallbackRef = useRef<number | null>(null);

  const clearFinishTimeout = useCallback(() => {
    if (finishTimeoutRef.current !== null) {
      window.clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
  }, []);

  const clearNavigationFallback = useCallback(() => {
    if (navigationFallbackRef.current !== null) {
      window.clearTimeout(navigationFallbackRef.current);
      navigationFallbackRef.current = null;
    }
  }, []);

  const stopTrickle = useCallback(() => {
    if (trickleIntervalRef.current !== null) {
      window.clearInterval(trickleIntervalRef.current);
      trickleIntervalRef.current = null;
    }
  }, []);

  const startTrickle = useCallback(() => {
    if (trickleIntervalRef.current !== null) {
      return;
    }

    trickleIntervalRef.current = window.setInterval(() => {
      setProgress((currentProgress) => {
        if (currentProgress >= MAX_TRICKLE_PROGRESS) {
          return currentProgress;
        }

        const remaining = MAX_TRICKLE_PROGRESS - currentProgress;
        const step = Math.max(remaining * (0.08 + Math.random() * 0.12), 0.01);
        return Math.min(currentProgress + step, MAX_TRICKLE_PROGRESS);
      });
    }, 180);
  }, []);

  const beginLoading = useCallback(() => {
    clearFinishTimeout();
    setVisible(true);
    setProgress((currentProgress) =>
      currentProgress > INITIAL_PROGRESS ? currentProgress : INITIAL_PROGRESS,
    );
    startTrickle();
  }, [clearFinishTimeout, startTrickle]);

  const maybeFinishLoading = useCallback(() => {
    if (pendingNavigationRef.current || activeFetchCountRef.current > 0) {
      return;
    }

    stopTrickle();
    clearFinishTimeout();
    setProgress(1);

    finishTimeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
      finishTimeoutRef.current = null;
    }, 220);
  }, [clearFinishTimeout, stopTrickle]);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    pendingNavigationRef.current = false;
    clearNavigationFallback();
    maybeFinishLoading();
  }, [clearNavigationFallback, maybeFinishLoading, routeKey]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || isModifiedEvent(event)) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || !isInternalNavigationLink(anchor)) {
        return;
      }

      pendingNavigationRef.current = true;
      clearNavigationFallback();
      navigationFallbackRef.current = window.setTimeout(() => {
        pendingNavigationRef.current = false;
        maybeFinishLoading();
      }, 8000);
      beginLoading();
    }

    function handleDocumentSubmit(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLFormElement) || event.defaultPrevented) {
        return;
      }

      beginLoading();
    }

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const shouldTrack = isTrackableFetchInput(input);

      if (shouldTrack) {
        activeFetchCountRef.current += 1;
        beginLoading();
      }

      try {
        return await originalFetch(input, init);
      } finally {
        if (shouldTrack) {
          activeFetchCountRef.current = Math.max(activeFetchCountRef.current - 1, 0);
          maybeFinishLoading();
        }
      }
    };

    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("submit", handleDocumentSubmit, true);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("submit", handleDocumentSubmit, true);
      window.fetch = originalFetch;
      stopTrickle();
      clearFinishTimeout();
      clearNavigationFallback();
    };
  }, [
    beginLoading,
    clearFinishTimeout,
    clearNavigationFallback,
    maybeFinishLoading,
    stopTrickle,
  ]);

  return (
    <div
      aria-hidden="true"
      className={`loading-bar ${visible ? "loading-bar--visible" : ""}`}
      style={{ transform: `scaleX(${progress})` }}
    />
  );
}
