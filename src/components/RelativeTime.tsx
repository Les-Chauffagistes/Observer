"use client";

import { useSyncExternalStore } from "react";
import { formatRelativeTime } from "@/lib/format/time";

const UPDATE_INTERVAL_MS = 15_000;

let currentTime = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): number {
  return currentTime;
}

function getServerSnapshot(): number {
  return 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  currentTime = Date.now();

  if (intervalId === null) {
    intervalId = setInterval(() => {
      currentTime = Date.now();
      listeners.forEach((callback) => callback());
    }, UPDATE_INTERVAL_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

interface RelativeTimeProps {
  readonly dateTime: string;
}

/**
 * A relative timestamp that keeps progressing while a cached dashboard view
 * remains open, without issuing additional API requests.
 */
export function RelativeTime({ dateTime }: RelativeTimeProps) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const label = formatRelativeTime(
    dateTime,
    now === 0 ? new Date() : new Date(now),
  );

  return (
    <time dateTime={dateTime} suppressHydrationWarning>
      {label}
    </time>
  );
}
