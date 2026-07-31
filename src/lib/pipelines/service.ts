import type { AppConfig } from "@/lib/config";
import { GitHubApiError } from "@/lib/github/errors";
import type { GitHubClient } from "@/lib/github/client";
import { repoRefKey } from "@/lib/github/repo";
import type { RepoRef } from "@/lib/github/types";
import {
  latestRunPerWorkflow,
  overallStatus,
} from "@/lib/pipelines/mappers";
import type { PipelineOverview, RepoPipelines } from "@/lib/pipelines/types";

/** Options controlling which repositories an overview covers. */
export interface OverviewOptions {
  /** Extra repositories to observe (e.g. those referenced by groups). */
  readonly extraRepos?: readonly RepoRef[];
  /** Whether to auto-discover the organisation's repositories. Default `true`. */
  readonly discoverOrg?: boolean;
}

/**
 * Resolve the effective set of repositories to observe, combining the
 * explicitly configured list, any extra repositories, and (optionally)
 * organisation discovery. Archived and disabled organisation repositories are
 * dropped, and duplicates are removed.
 */
export async function resolveRepositories(
  client: GitHubClient,
  config: AppConfig,
  options: OverviewOptions = {},
): Promise<RepoRef[]> {
  const { extraRepos = [], discoverOrg = true } = options;
  const byKey = new Map<string, RepoRef>();

  for (const repo of [...config.repos, ...extraRepos]) {
    byKey.set(repoRefKey(repo), repo);
  }

  if (discoverOrg && config.org) {
    const discovered = await client.listOrgRepos(config.org);
    for (const repo of discovered) {
      if (repo.archived || repo.disabled) continue;
      const ref: RepoRef = { owner: repo.owner.login, name: repo.name };
      byKey.set(repoRefKey(ref), ref);
    }
  }

  return [...byKey.values()].sort((a, b) =>
    repoRefKey(a).localeCompare(repoRefKey(b)),
  );
}

/** Fetch and project a single repository's pipelines, isolating failures. */
async function fetchRepoPipelines(
  client: GitHubClient,
  repo: RepoRef,
): Promise<RepoPipelines> {
  try {
    const runs = latestRunPerWorkflow(await client.listWorkflowRuns(repo));
    return { repo, runs, overallStatus: overallStatus(runs), error: null };
  } catch (error) {
    return {
      repo,
      runs: [],
      overallStatus: null,
      error: describeFetchError(error),
    };
  }
}

function describeFetchError(error: unknown): string {
  if (error instanceof GitHubApiError) {
    if (error.isNotFound) return "Repository not found or Actions disabled.";
    if (error.isAuthError) return "Access denied — check the token's scopes.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Unknown error.";
}

/**
 * Build the full dashboard overview: resolve repositories, then fetch each
 * one's pipeline state in parallel. A failure on one repository never fails the
 * whole overview — it is reported inline via {@link RepoPipelines.error}.
 */
export async function getPipelineOverview(
  client: GitHubClient,
  config: AppConfig,
  options: OverviewOptions = {},
): Promise<PipelineOverview> {
  const repos = await resolveRepositories(client, config, options);
  const repositories = await Promise.all(
    repos.map((repo) => fetchRepoPipelines(client, repo)),
  );

  return { repositories, generatedAt: new Date().toISOString() };
}
