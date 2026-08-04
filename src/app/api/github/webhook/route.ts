import { revalidatePath, revalidateTag } from "next/cache";
import { loadConfig } from "@/lib/config";
import { GITHUB_CACHE_TAG } from "@/lib/github/client";
import {
  hasValidWebhookSignature,
  toRepositoryChangedEvent,
} from "@/lib/github/webhook";
import { publishRepositoryChanged } from "@/lib/live-events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = loadConfig();
  if (!config.webhookSecret) {
    return new Response("Webhook integration is not configured.", { status: 503 });
  }

  const body = await request.text();
  if (
    !hasValidWebhookSignature(
      body,
      request.headers.get("x-hub-signature-256"),
      config.webhookSecret,
    )
  ) {
    return new Response("Invalid webhook signature.", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON payload.", { status: 400 });
  }

  const event = toRepositoryChangedEvent(
    request.headers.get("x-github-event"),
    request.headers.get("x-github-delivery"),
    payload,
  );
  if (event) {
    revalidateTag(GITHUB_CACHE_TAG, "max");
    revalidatePath("/");
    revalidatePath("/pipelines");
    revalidatePath("/branches");
    publishRepositoryChanged(event);
  }

  return new Response(null, { status: 202 });
}
