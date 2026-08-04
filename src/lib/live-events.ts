export interface RepositoryChangedEvent {
  readonly deliveryId: string;
  readonly owner: string;
  readonly repository: string;
  readonly runId: number;
}

const encoder = new TextEncoder();
const listeners = new Set<(event: RepositoryChangedEvent) => void>();

export function publishRepositoryChanged(event: RepositoryChangedEvent): void {
  listeners.forEach((listener) => listener(event));
}

export function createLiveEventStream(signal: AbortSignal): ReadableStream<Uint8Array> {
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let listener: ((event: RepositoryChangedEvent) => void) | null = null;

  const close = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (listener) listeners.delete(listener);
    if (heartbeat) clearInterval(heartbeat);
    controller.close();
  };

  return new ReadableStream({
    start(controller) {
      const send = (event: RepositoryChangedEvent) => {
        controller.enqueue(
          encoder.encode(`event: repository-changed\ndata: ${JSON.stringify(event)}\n\n`),
        );
      };
      listener = send;
      listeners.add(listener);
      controller.enqueue(encoder.encode(": connected\n\n"));
      heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keepalive\n\n")), 25_000);

      signal.addEventListener(
        "abort",
        () => close(controller),
        { once: true },
      );
    },
    cancel() {
      if (listener) listeners.delete(listener);
      if (heartbeat) clearInterval(heartbeat);
    },
  });
}
