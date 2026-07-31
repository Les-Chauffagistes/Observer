import type { AppConfig } from "@/lib/config";
import { GitHubApiError } from "@/lib/github/errors";
import type { GitHubClient } from "@/lib/github/client";
import type { RepoRef } from "@/lib/github/types";
import {
  latestRunPerWorkflow,
  overallStatus,
} from "@/lib/pipelines/mappers";
import type { PipelineOverview, RepoPipelines } from "@/lib/pipelines/types";

/** Serialise a repo reference into a stable de-duplication key. */
function repoKey(repo: RepoRef): string {
  return `${repo.owner}/${repo.name}`.toLowerCase();
}

/**
 * Resolve the effective set of repositories to observe, combining the
 * explicitly configured list with organisation discovery. Archived and
 * disabled repositories are dropped, and duplicates are removed.
 */
export async function resolveRepositories(
  client: GitHubClient,
  config: AppConfig,
): Promise<RepoRef[]> {
  const byKey = new Map<string, RepoRef>();

  for (const repo of config.repos) {
    byKey.set(repoKey(repo), repo);
  }

  if (config.org) {
    const discovered = await client.listOrgRepos(config.org);
    for (const repo of discovered) {
      if (repo.archived || repo.disabled) continue;
      const ref: RepoRef = { owner: repo.owner.login, name: repo.name };
      byKey.set(repoKey(ref), ref);
    }
  }

  return [...byKey.values()].sort((a, b) =>
    repoKey(a).localeCompare(repoKey(b)),
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
): Promise<PipelineOverview> {
  const repos = await resolveRepositories(client, config);
  const repositories = await Promise.all(
    repos.map((repo) => fetchRepoPipelines(client, repo)),
  );

  return { repositories, generatedAt: new Date().toISOString() };
}
