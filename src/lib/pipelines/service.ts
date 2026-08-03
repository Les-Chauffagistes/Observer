import type { AppConfig } from "@/lib/config";
import { GitHubApiError } from "@/lib/github/errors";
import type { GitHubClient } from "@/lib/github/client";
import { repoRefKey } from "@/lib/github/repo";
import type { GitHubBranch, RepoRef } from "@/lib/github/types";
import {
  groupRunsByBranch,
  isIntegrationBranch,
  sortBranches,
} from "@/lib/pipelines/byBranch";
import {
  latestRunPerWorkflow,
  overallStatus,
  toPipelineRun,
} from "@/lib/pipelines/mappers";
import type {
  BranchOverview,
  PinnedRepoPipelines,
  PipelineOverview,
  RepoBranchPipelines,
  RepoPipelines,
} from "@/lib/pipelines/types";
import type { EnvironmentConfig } from "@/lib/config/groups";

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

/**
 * How many recent runs to inspect when building the branch view. A branch is
 * only surfaced if it appears among these runs, so this must be generous enough
 * to reach past a busy default branch to the feature branches behind it.
 */
const BRANCH_VIEW_RUN_LIMIT = 100;

/**
 * Fetch a single repository's branch-oriented pipeline state, isolating
 * failures. Feature branches already merged into an integration branch
 * (`develop`/`main`/`master`) are dropped, so only branches with outstanding,
 * unmerged work remain.
 */
async function fetchRepoBranchPipelines(
  client: GitHubClient,
  repo: RepoRef,
): Promise<RepoBranchPipelines> {
  try {
    const [rawRuns, allBranches] = await Promise.all([
      client.listWorkflowRuns(repo, BRANCH_VIEW_RUN_LIMIT),
      client.listBranches(repo),
    ]);

    const existingBranches = new Set(allBranches.map((branch) => branch.name));
    const bases = integrationBases(allBranches);

    // Candidate feature branches: they have runs, still exist, and are not
    // themselves an integration branch.
    const candidates = groupRunsByBranch(rawRuns.map(toPipelineRun)).filter(
      (branch) =>
        existingBranches.has(branch.branch) &&
        !isIntegrationBranch(branch.branch),
    );

    const mergedFlags = await Promise.all(
      candidates.map((branch) =>
        isBranchMerged(client, repo, branch.branch, bases),
      ),
    );
    const unmerged = candidates.filter((_, index) => !mergedFlags[index]);

    return { repo, branches: sortBranches(unmerged), error: null };
  } catch (error) {
    return { repo, branches: [], error: describeFetchError(error) };
  }
}

/** The integration branches that actually exist in the repository. */
function integrationBases(branches: readonly GitHubBranch[]): string[] {
  return branches
    .map((branch) => branch.name)
    .filter((name) => isIntegrationBranch(name));
}

/**
 * Whether `head` is fully merged into any existing integration branch. A branch
 * is merged into a base when the base contains all of its commits
 * (`ahead_by === 0`). Comparison failures are treated as "not merged" so that a
 * transient error never hides real, unmerged work.
 */
async function isBranchMerged(
  client: GitHubClient,
  repo: RepoRef,
  head: string,
  bases: readonly string[],
): Promise<boolean> {
  for (const base of bases) {
    if (base === head) continue;
    try {
      const comparison = await client.compareBranches(repo, base, head);
      if (comparison.ahead_by === 0) return true;
    } catch {
      // Ignore and try the next base; default is to keep the branch visible.
    }
  }
  return false;
}

/**
 * Build the branch-oriented overview: resolve repositories, then fetch each
 * one's unmerged-branch pipeline state in parallel. Like
 * {@link getPipelineOverview}, a single repository's failure is reported inline
 * via {@link RepoBranchPipelines.error} rather than failing the whole overview.
 */
export async function getBranchOverview(
  client: GitHubClient,
  config: AppConfig,
  options: OverviewOptions = {},
): Promise<BranchOverview> {
  const repos = await resolveRepositories(client, config, options);
  const repositories = await Promise.all(
    repos.map((repo) => fetchRepoBranchPipelines(client, repo)),
  );

  return { repositories, generatedAt: new Date().toISOString() };
}

/**
 * How many recent runs to inspect for the pinned repository. Must be generous
 * enough to reach the latest run on every tracked environment branch (e.g.
 * `main`) past a busier one (e.g. `develop`).
 */
const PINNED_RUN_LIMIT = 100;

/**
 * Fetch the pinned repository's per-environment pipeline state, isolating
 * failures. Each configured environment is matched to its branch's latest run
 * per workflow; environments whose branch has no runs get `pipelines: null`.
 */
export async function getPinnedRepo(
  client: GitHubClient,
  repo: RepoRef,
  environments: readonly EnvironmentConfig[],
): Promise<PinnedRepoPipelines> {
  try {
    const rawRuns = await client.listWorkflowRuns(repo, PINNED_RUN_LIMIT);
    const byBranch = new Map(
      groupRunsByBranch(rawRuns.map(toPipelineRun)).map((branch) => [
        branch.branch,
        branch,
      ]),
    );

    return {
      repo,
      environments: environments.map((env) => ({
        label: env.label,
        branch: env.branch,
        pipelines: byBranch.get(env.branch) ?? null,
      })),
      error: null,
    };
  } catch (error) {
    return {
      repo,
      environments: environments.map((env) => ({
        label: env.label,
        branch: env.branch,
        pipelines: null,
      })),
      error: describeFetchError(error),
    };
  }
}
