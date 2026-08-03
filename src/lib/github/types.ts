/**
 * Minimal, hand-written typings for the subset of the GitHub REST API that
 * this application consumes. Keeping these narrow (rather than depending on a
 * full SDK) documents exactly which fields we rely on.
 *
 * @see https://docs.github.com/en/rest
 */

/** A repository identified by its owner and name. */
export interface RepoRef {
  readonly owner: string;
  readonly name: string;
}

/** `GET /orgs/{org}/repos` (partial). */
export interface GitHubRepo {
  readonly name: string;
  readonly full_name: string;
  readonly owner: { readonly login: string };
  readonly html_url: string;
  readonly archived: boolean;
  readonly disabled: boolean;
  readonly default_branch: string;
}

/** Lifecycle status of a workflow run. */
export type GitHubRunStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "waiting"
  | "requested"
  | "pending";

/** Outcome of a completed workflow run (`conclusion`). */
export type GitHubRunConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | "neutral"
  | "stale"
  | "startup_failure";

/** An actor (user) referenced by a workflow run. */
export interface GitHubActor {
  readonly login: string;
  readonly avatar_url: string;
  readonly html_url: string;
}

/** `workflow_runs[]` item from `GET /repos/{owner}/{repo}/actions/runs`. */
export interface GitHubWorkflowRun {
  readonly id: number;
  readonly name: string | null;
  readonly workflow_id: number;
  readonly head_branch: string | null;
  readonly head_sha: string;
  readonly display_title: string;
  readonly run_number: number;
  readonly event: string;
  readonly status: GitHubRunStatus;
  readonly conclusion: GitHubRunConclusion | null;
  readonly html_url: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly run_started_at: string | null;
  readonly actor: GitHubActor | null;
}

/** Envelope of `GET /repos/{owner}/{repo}/actions/runs`. */
export interface GitHubWorkflowRunsResponse {
  readonly total_count: number;
  readonly workflow_runs: readonly GitHubWorkflowRun[];
}

/**
 * `jobs[]` item from `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`
 * (partial). A job carries its own `status`/`conclusion`, so a run marked
 * `success` overall can still contain a `skipped` deployment job — surfacing
 * jobs is the only way to see that.
 */
export interface GitHubWorkflowJob {
  readonly id: number;
  readonly name: string;
  readonly status: GitHubRunStatus;
  readonly conclusion: GitHubRunConclusion | null;
  readonly html_url: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
}

/** Envelope of `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`. */
export interface GitHubWorkflowJobsResponse {
  readonly total_count: number;
  readonly jobs: readonly GitHubWorkflowJob[];
}

/** `branches[]` item from `GET /repos/{owner}/{repo}/branches` (partial). */
export interface GitHubBranch {
  readonly name: string;
  readonly commit: { readonly sha: string };
  readonly protected: boolean;
}

/** Relationship of `head` to `base` in a comparison. */
export type GitHubComparisonStatus =
  | "diverged"
  | "ahead"
  | "behind"
  | "identical";

/**
 * `GET /repos/{owner}/{repo}/compare/{base}...{head}` (partial).
 *
 * `ahead_by` counts commits present in `head` but not in `base`; a value of `0`
 * means every commit of `head` is already contained in `base` (i.e. `head` is
 * fully merged into `base`).
 */
export interface GitHubComparison {
  readonly status: GitHubComparisonStatus;
  readonly ahead_by: number;
  readonly behind_by: number;
  readonly total_commits: number;
}
