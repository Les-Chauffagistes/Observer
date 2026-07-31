import type {
  PipelineOverview,
  PipelineStatus,
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

/** Compute headline counts for the dashboard summary bar. */
export function summarizeOverview(overview: PipelineOverview): OverviewSummary {
  const byStatus: Record<PipelineStatus, number> = { ...EMPTY_STATUS_COUNTS };
  let erroredRepos = 0;

  for (const repo of overview.repositories) {
    if (isErrored(repo)) erroredRepos += 1;
    if (repo.overallStatus) byStatus[repo.overallStatus] += 1;
  }

  return {
    totalRepos: overview.repositories.length,
    erroredRepos,
    byStatus,
  };
}
