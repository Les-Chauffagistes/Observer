import { overallStatus } from "@/lib/pipelines/mappers";
import type {
  BranchPipelines,
  PipelineRun,
  PipelineStatus,
  RepoBranchPipelines,
} from "@/lib/pipelines/types";

/**
 * Branch names treated as **integration targets**: a feature branch is
 * considered "merged" once its commits land on one of these. They are the
 * comparison bases and are never listed as feature branches themselves.
 *
 * Matched case-insensitively; only bases that actually exist in a repository
 * are used for merge detection (see `service.ts`).
 */
export const INTEGRATION_BRANCHES: readonly string[] = [
  "develop",
  "main",
  "master",
];

/** Whether a branch name is one of the integration branches. */
export function isIntegrationBranch(branch: string): boolean {
  return INTEGRATION_BRANCHES.includes(branch.toLowerCase());
}

/**
 * Group runs by their head branch, keeping the **latest run per workflow**
 * within each branch. GitHub returns runs newest-first, so the first run seen
 * for a (branch, workflow) pair is the most recent one.
 *
 * Runs with no head branch (e.g. tag-triggered) are ignored — this view is
 * about branches.
 */
export function groupRunsByBranch(
  runs: readonly PipelineRun[],
): BranchPipelines[] {
  const byBranch = new Map<string, Map<number, PipelineRun>>();

  for (const run of runs) {
    if (!run.branch) continue;
    let perWorkflow = byBranch.get(run.branch);
    if (!perWorkflow) {
      perWorkflow = new Map();
      byBranch.set(run.branch, perWorkflow);
    }
    if (!perWorkflow.has(run.workflowId)) {
      perWorkflow.set(run.workflowId, run);
    }
  }

  const branches: BranchPipelines[] = [];
  for (const [branch, perWorkflow] of byBranch) {
    const branchRuns = [...perWorkflow.values()].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
    branches.push({
      branch,
      runs: branchRuns,
      overallStatus: overallStatus(branchRuns),
    });
  }

  return branches;
}

/**
 * Order branches within a repository by most-actionable status first, then by
 * most recently updated, so failures and fresh activity surface at the top.
 */
export function sortBranches(
  branches: readonly BranchPipelines[],
): BranchPipelines[] {
  return [...branches].sort((a, b) => {
    const severity =
      statusSeverity(b.overallStatus) - statusSeverity(a.overallStatus);
    if (severity !== 0) return severity;
    return latestUpdate(b) - latestUpdate(a);
  });
}

function latestUpdate(branch: BranchPipelines): number {
  return branch.runs.reduce(
    (newest, run) => Math.max(newest, Date.parse(run.updatedAt)),
    0,
  );
}

function statusSeverity(status: PipelineStatus | null): number {
  return status === null ? -1 : STATUS_SEVERITY[status];
}

/**
 * Total number of unmerged branches across a set of repositories — the natural
 * "size" of the branch-oriented view.
 */
export function countBranches(
  repositories: readonly RepoBranchPipelines[],
): number {
  return repositories.reduce((total, repo) => total + repo.branches.length, 0);
}

/**
 * Drop repositories that have no unmerged branches (and no error to report), so
 * the branch view only surfaces repositories with something to show.
 */
export function withUnmergedBranches(
  repositories: readonly RepoBranchPipelines[],
): RepoBranchPipelines[] {
  return repositories.filter(
    (repo) => repo.branches.length > 0 || repo.error !== null,
  );
}

/**
 * Local severity ranking mirroring `STATUS_SEVERITY` in
 * [`mappers.ts`](./mappers.ts): higher wins, so failures surface first.
 */
const STATUS_SEVERITY: Record<PipelineStatus, number> = {
  failure: 6,
  action_required: 5,
  running: 4,
  queued: 3,
  cancelled: 2,
  unknown: 1,
  skipped: 0,
  success: 0,
};
