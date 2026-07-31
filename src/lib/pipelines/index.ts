import { ConfigError, loadConfig } from "@/lib/config";
import { groupRepoRefs, loadGroupsConfig } from "@/lib/config/groups";
import { GitHubClient } from "@/lib/github/client";
import { groupRepositories } from "@/lib/pipelines/grouping";
import type { PipelineGroup } from "@/lib/pipelines/grouping";
import {
  getBranchOverview,
  getPipelineOverview,
} from "@/lib/pipelines/service";
import type {
  BranchOverview,
  PipelineOverview,
  RepoBranchPipelines,
} from "@/lib/pipelines/types";

export type * from "@/lib/pipelines/types";
export {
  getBranchOverview,
  getPipelineOverview,
  resolveRepositories,
} from "@/lib/pipelines/service";
export { groupRepositories, UNGROUPED_LABEL } from "@/lib/pipelines/grouping";
export type { PipelineGroup } from "@/lib/pipelines/grouping";
export {
  summarizeBranches,
  summarizeOverview,
  summarizePipeline,
  summarizePipelines,
  summarizeRepositories,
} from "@/lib/pipelines/summary";
export type { OverviewSummary } from "@/lib/pipelines/summary";
export { groupByPipeline } from "@/lib/pipelines/byPipeline";
export type { Pipeline, PipelineRepoStatus } from "@/lib/pipelines/byPipeline";
export {
  countBranches,
  withUnmergedBranches,
} from "@/lib/pipelines/byBranch";

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
 * Result of {@link loadBranchOverview}: the branch-oriented equivalent of
 * {@link OverviewResult}.
 */
export type BranchOverviewResult =
  | {
      readonly ok: true;
      readonly overview: BranchOverview;
      readonly groups: readonly PipelineGroup<RepoBranchPipelines>[];
    }
  | { readonly ok: false; readonly reason: "config"; readonly message: string };

/** Resolved dashboard context shared by every view's composition root. */
interface DashboardContext {
  readonly client: GitHubClient;
  readonly groupsConfig: Awaited<ReturnType<typeof loadGroupsConfig>>;
  readonly groupRepos: ReturnType<typeof groupRepoRefs>;
  /** Whether to auto-discover the organisation (folders may hide ungrouped). */
  readonly discoverOrg: boolean;
  readonly config: ReturnType<typeof loadConfig>;
}

/**
 * Read configuration (environment + optional `observer.config.json`) and build
 * a GitHub client. Returns a config-error result when no repository source is
 * configured, so callers can render setup instructions instead.
 */
async function resolveDashboardContext(): Promise<
  | { readonly ok: true; readonly context: DashboardContext }
  | { readonly ok: false; readonly reason: "config"; readonly message: string }
> {
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

  return {
    ok: true,
    context: { client, groupsConfig, groupRepos, discoverOrg, config },
  };
}

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
    const resolved = await resolveDashboardContext();
    if (!resolved.ok) return resolved;

    const { client, config, groupsConfig, groupRepos, discoverOrg } =
      resolved.context;

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

/**
 * Composition root for the **branch-oriented** view. Mirrors
 * {@link loadOverview} but fetches each repository's unmerged branches (those
 * not yet merged into `develop`/`main`/`master`) and organises them into the
 * same folders.
 */
export async function loadBranchOverview(): Promise<BranchOverviewResult> {
  try {
    const resolved = await resolveDashboardContext();
    if (!resolved.ok) return resolved;

    const { client, config, groupsConfig, groupRepos, discoverOrg } =
      resolved.context;

    const overview = await getBranchOverview(client, config, {
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
