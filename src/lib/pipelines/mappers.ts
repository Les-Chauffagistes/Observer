import type {
  GitHubRunConclusion,
  GitHubRunStatus,
  GitHubWorkflowJob,
  GitHubWorkflowRun,
} from "@/lib/github/types";
import type {
  PipelineJob,
  PipelineRun,
  PipelineStatus,
} from "@/lib/pipelines/types";

/**
 * Map a terminal outcome (`conclusion`, or a terminal value GitHub occasionally
 * places in `status`) to a {@link PipelineStatus}.
 */
const TERMINAL_STATUS: Record<string, PipelineStatus> = {
  success: "success",
  failure: "failure",
  timed_out: "failure",
  startup_failure: "failure",
  cancelled: "cancelled",
  skipped: "skipped",
  neutral: "skipped",
  stale: "skipped",
  action_required: "action_required",
};

/**
 * Collapse GitHub's `status` + `conclusion` pair into a single
 * {@link PipelineStatus}.
 *
 * In-flight lifecycle states map to `queued`/`running`. Otherwise the run is
 * concluded and we use its `conclusion`; as a safety net we also accept a
 * terminal value carried directly in `status` (GitHub does this for some
 * `skipped` runs) so those never fall back to `queued`/`running`.
 */
export function toPipelineStatus(
  status: GitHubRunStatus,
  conclusion: GitHubRunConclusion | null,
): PipelineStatus {
  switch (status) {
    case "queued":
    case "waiting":
    case "requested":
    case "pending":
      return "queued";
    case "in_progress":
      return "running";
  }

  const terminal = conclusion ?? status;
  return TERMINAL_STATUS[terminal] ?? "unknown";
}

/** Project a raw GitHub workflow run into the domain model. */
export function toPipelineRun(run: GitHubWorkflowRun): PipelineRun {
  return {
    id: run.id,
    workflowId: run.workflow_id,
    workflowName: run.name ?? "Workflow",
    title: run.display_title,
    runNumber: run.run_number,
    status: toPipelineStatus(run.status, run.conclusion),
    branch: run.head_branch,
    commitSha: run.head_sha,
    event: run.event,
    url: run.html_url,
    actor: run.actor?.login ?? null,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    jobs: null,
  };
}

/** Project a raw GitHub workflow job into the domain model. */
export function toPipelineJob(job: GitHubWorkflowJob): PipelineJob {
  return {
    id: job.id,
    name: job.name,
    status: toPipelineStatus(job.status, job.conclusion),
    url: job.html_url,
  };
}

/** Attach fetched jobs to a run, returning a new run (runs are immutable). */
export function withJobs(
  run: PipelineRun,
  jobs: readonly GitHubWorkflowJob[],
): PipelineRun {
  return { ...run, jobs: jobs.map(toPipelineJob) };
}

/**
 * Reduce a repository's runs to the latest run per workflow, newest first.
 * GitHub returns runs newest-first, so the first run seen for a workflow id is
 * the most recent one.
 */
export function latestRunPerWorkflow(
  runs: readonly GitHubWorkflowRun[],
): PipelineRun[] {
  const latestByWorkflow = new Map<number, PipelineRun>();

  for (const run of runs) {
    if (!latestByWorkflow.has(run.workflow_id)) {
      latestByWorkflow.set(run.workflow_id, toPipelineRun(run));
    }
  }

  return [...latestByWorkflow.values()].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

/**
 * Severity ranking used to surface the most actionable status for a repository.
 * Higher wins.
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

/** Pick the most actionable status across a set of runs. */
export function overallStatus(
  runs: readonly PipelineRun[],
): PipelineStatus | null {
  if (runs.length === 0) return null;
  return runs.reduce<PipelineStatus>((worst, run) => {
    return STATUS_SEVERITY[run.status] > STATUS_SEVERITY[worst]
      ? run.status
      : worst;
  }, "success");
}
