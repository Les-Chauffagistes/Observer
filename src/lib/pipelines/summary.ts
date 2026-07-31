import type { Pipeline } from "@/lib/pipelines/byPipeline";
import type {
  PipelineOverview,
  PipelineStatus,
  RepoBranchPipelines,
  RepoPipelines,
} from "@/lib/pipelines/types";

/** Aggregate counts across all observed repositories. */
export interface OverviewSummary {
  readonly totalRepos: number;
  /** Repositories that failed to fetch. */
  readonly erroredRepos: number;
  /** Number of repositories per overall status. */
  readonly byStatus: Readonly<Record<PipelineStatus, number>>;
}

const EMPTY_STATUS_COUNTS: Record<PipelineStatus, number> = {
  success: 0,
  failure: 0,
  running: 0,
  queued: 0,
  cancelled: 0,
  skipped: 0,
  action_required: 0,
  unknown: 0,
};

function isErrored(repo: RepoPipelines): boolean {
  return repo.error !== null;
}

/** Compute headline counts for a set of repositories. */
export function summarizeRepositories(
  repositories: readonly RepoPipelines[],
): OverviewSummary {
  const byStatus: Record<PipelineStatus, number> = { ...EMPTY_STATUS_COUNTS };
  let erroredRepos = 0;

  for (const repo of repositories) {
    if (isErrored(repo)) erroredRepos += 1;
    if (repo.overallStatus) byStatus[repo.overallStatus] += 1;
  }

  return {
    totalRepos: repositories.length,
    erroredRepos,
    byStatus,
  };
}

/** Compute headline counts for the dashboard summary bar. */
export function summarizeOverview(overview: PipelineOverview): OverviewSummary {
  return summarizeRepositories(overview.repositories);
}

/**
 * Compute headline counts for the branch-oriented view: one entry per unmerged
 * branch, bucketed by that branch's overall status. `totalRepos` carries the
 * total number of unmerged branches so the shared {@link OverviewSummary} shape
 * still describes the collection being summarised.
 */
export function summarizeBranches(
  repositories: readonly RepoBranchPipelines[],
): OverviewSummary {
  const byStatus: Record<PipelineStatus, number> = { ...EMPTY_STATUS_COUNTS };
  let totalBranches = 0;
  let erroredRepos = 0;

  for (const repo of repositories) {
    if (repo.error !== null) erroredRepos += 1;
    for (const branch of repo.branches) {
      totalBranches += 1;
      if (branch.overallStatus) byStatus[branch.overallStatus] += 1;
    }
  }

  return { totalRepos: totalBranches, erroredRepos, byStatus };
}

/**
 * Compute headline counts for a single pipeline: one repository per count,
 * bucketed by that repository's run status for this pipeline. Reuses
 * {@link OverviewSummary} so the same {@link StatusSummary} UI renders it.
 */
export function summarizePipeline(pipeline: Pipeline): OverviewSummary {
  const byStatus: Record<PipelineStatus, number> = { ...EMPTY_STATUS_COUNTS };

  for (const { run } of pipeline.repositories) {
    byStatus[run.status] += 1;
  }

  return {
    totalRepos: pipeline.repositories.length,
    erroredRepos: 0,
    byStatus,
  };
}

/** Aggregate {@link summarizePipeline} across every pipeline (header bar). */
export function summarizePipelines(
  pipelines: readonly Pipeline[],
): OverviewSummary {
  const byStatus: Record<PipelineStatus, number> = { ...EMPTY_STATUS_COUNTS };
  let totalRepos = 0;

  for (const pipeline of pipelines) {
    const summary = summarizePipeline(pipeline);
    totalRepos += summary.totalRepos;
    for (const status of Object.keys(byStatus) as PipelineStatus[]) {
      byStatus[status] += summary.byStatus[status];
    }
  }

  return { totalRepos, erroredRepos: 0, byStatus };
}
