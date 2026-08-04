import { createHmac, timingSafeEqual } from "node:crypto";

import type { RepositoryChangedEvent } from "@/lib/live-events";

interface WebhookRepository {
  readonly name?: unknown;
  readonly owner?: { readonly login?: unknown };
}

interface WebhookRun {
  readonly id?: unknown;
}

interface WebhookJob {
  readonly run_id?: unknown;
}

interface WebhookPayload {
  readonly repository?: WebhookRepository;
  readonly workflow_run?: WebhookRun;
  readonly workflow_job?: WebhookJob;
}

export function hasValidWebhookSignature(
  body: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const received = signature.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function toRepositoryChangedEvent(
  eventName: string | null,
  deliveryId: string | null,
  value: unknown,
): RepositoryChangedEvent | null {
  if (
    (eventName !== "workflow_run" && eventName !== "workflow_job") ||
    !deliveryId ||
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const payload = value as WebhookPayload;
  const owner = payload.repository?.owner?.login;
  const repository = payload.repository?.name;
  const runId =
    eventName === "workflow_run"
      ? payload.workflow_run?.id
      : payload.workflow_job?.run_id;

  if (
    typeof owner !== "string" ||
    typeof repository !== "string" ||
    typeof runId !== "number"
  ) {
    return null;
  }
  return { deliveryId, owner, repository, runId };
}
