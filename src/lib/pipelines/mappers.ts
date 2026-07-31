import type {
  GitHubRunConclusion,
  GitHubRunStatus,
  GitHubWorkflowRun,
} from "@/lib/github/types";
import type { PipelineRun, PipelineStatus } from "@/lib/pipelines/types";

/**
 * Collapse GitHub's `status` + `conclusion` pair into a single
 * {@link PipelineStatus}. A run is only "concluded" when `status` is
 * `completed`; otherwise it is still in flight.
 */
export function toPipelineStatus(
  status: GitHubRunStatus,
  conclusion: GitHubRunConclusion | null,
): PipelineStatus {
  if (status !== "completed") {
    return status === "queued" ||
      status === "waiting" ||
      status === "requested" ||
      status === "pending"
      ? "queued"
      : "running";
  }

  switch (conclusion) {
    case "success":
      return "success";
    case "failure":
    case "timed_out":
    case "startup_failure":
      return "failure";
    case "cancelled":
      return "cancelled";
    case "skipped":
    case "neutral":
    case "stale":
      return "skipped";
    case "action_required":
      return "action_required";
    default:
      return "unknown";
  }
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
  };
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
