import { ConfigError, loadConfig } from "@/lib/config";
import { GitHubClient } from "@/lib/github/client";
import { getPipelineOverview } from "@/lib/pipelines/service";
import type { PipelineOverview } from "@/lib/pipelines/types";

export type * from "@/lib/pipelines/types";
export { getPipelineOverview, resolveRepositories } from "@/lib/pipelines/service";
export { summarizeOverview } from "@/lib/pipelines/summary";
export type { OverviewSummary } from "@/lib/pipelines/summary";

/**
 * Discriminated result of {@link loadOverview}. A missing/invalid configuration
 * is an expected, recoverable state (the UI renders setup instructions) and is
 * therefore modelled as data rather than a thrown error.
 */
export type OverviewResult =
  | { readonly ok: true; readonly overview: PipelineOverview }
  | { readonly ok: false; readonly reason: "config"; readonly message: string };

/**
 * Composition root for the dashboard: read configuration from the environment,
 * build a GitHub client, and produce the pipeline overview.
 *
 * Only configuration problems are caught here; unexpected failures (e.g. total
 * GitHub outage) propagate so Next.js can render the error boundary.
 */
export async function loadOverview(): Promise<OverviewResult> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      return { ok: false, reason: "config", message: error.message };
    }
    throw error;
  }

  const client = new GitHubClient({
    token: config.token,
    baseUrl: config.apiBaseUrl,
    revalidateSeconds: config.revalidateSeconds,
  });

  return { ok: true, overview: await getPipelineOverview(client, config) };
}
