import { ConfigError, loadConfig } from "@/lib/config";
import { groupRepoRefs, loadGroupsConfig } from "@/lib/config/groups";
import { GitHubClient } from "@/lib/github/client";
import { groupRepositories } from "@/lib/pipelines/grouping";
import type { PipelineGroup } from "@/lib/pipelines/grouping";
import { getPipelineOverview } from "@/lib/pipelines/service";
import type { PipelineOverview } from "@/lib/pipelines/types";

export type * from "@/lib/pipelines/types";
export { getPipelineOverview, resolveRepositories } from "@/lib/pipelines/service";
export { groupRepositories, UNGROUPED_LABEL } from "@/lib/pipelines/grouping";
export type { PipelineGroup } from "@/lib/pipelines/grouping";
export {
  summarizeOverview,
  summarizeRepositories,
} from "@/lib/pipelines/summary";
export type { OverviewSummary } from "@/lib/pipelines/summary";

/**
 * Discriminated result of {@link loadOverview}. A missing/invalid configuration
 * is an expected, recoverable state (the UI renders setup instructions) and is
 * therefore modelled as data rather than a thrown error.
 */
export type OverviewResult =
  | {
      readonly ok: true;
      readonly overview: PipelineOverview;
      readonly groups: readonly PipelineGroup[];
    }
  | { readonly ok: false; readonly reason: "config"; readonly message: string };

/**
 * Composition root for the dashboard: read configuration (environment +
 * optional `observer.config.json`), build a GitHub client, fetch every
 * observed repository, and organise the result into folders.
 *
 * Only configuration problems are caught here; unexpected failures (e.g. total
 * GitHub outage) propagate so Next.js can render the error boundary.
 */
export async function loadOverview(): Promise<OverviewResult> {
  try {
    const config = loadConfig();
    const groupsConfig = await loadGroupsConfig(config.org);
    const groupRepos = groupsConfig ? groupRepoRefs(groupsConfig) : [];

    if (config.repos.length === 0 && !config.org && groupRepos.length === 0) {
      return {
        ok: false,
        reason: "config",
        message:
          "No repositories configured. Set GITHUB_ORG, GITHUB_REPOS, or define groups in observer.config.json.",
      };
    }

    const client = new GitHubClient({
      token: config.token,
      baseUrl: config.apiBaseUrl,
      revalidateSeconds: config.revalidateSeconds,
    });

    // When ungrouped repositories are hidden, there is no need to discover the
    // whole organisation — only the explicitly grouped/listed repos are shown.
    const discoverOrg = groupsConfig?.includeUngrouped !== false;

    const overview = await getPipelineOverview(client, config, {
      extraRepos: groupRepos,
      discoverOrg,
    });
    const groups = groupRepositories(overview.repositories, groupsConfig);

    return { ok: true, overview, groups };
  } catch (error) {
    if (error instanceof ConfigError) {
      return { ok: false, reason: "config", message: error.message };
    }
    throw error;
  }
}
