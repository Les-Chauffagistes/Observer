"use client";

import { useEffect, useRef } from "react";

interface RepositoryChangedEvent {
  readonly deliveryId: string;
  readonly owner: string;
  readonly repository: string;
}

export function useLiveRepositoryUpdates(
  handlesRepository: (owner: string, repository: string) => boolean,
  onRepositoryChanged: (owner: string, repository: string) => void,
) {
  const handlers = useRef({ handlesRepository, onRepositoryChanged });

  useEffect(() => {
    handlers.current = { handlesRepository, onRepositoryChanged };
  }, [handlesRepository, onRepositoryChanged]);

  useEffect(() => {
    const deliveries = new Set<string>();
    const events = new EventSource("/api/live-events");
    events.addEventListener("repository-changed", (message) => {
      const event = JSON.parse(
        (message as MessageEvent<string>).data,
      ) as RepositoryChangedEvent;
      if (
        deliveries.has(event.deliveryId) ||
        !handlers.current.handlesRepository(event.owner, event.repository)
      ) {
        return;
      }
      deliveries.add(event.deliveryId);
      handlers.current.onRepositoryChanged(event.owner, event.repository);
    });
    return () => events.close();
  }, []);
}
