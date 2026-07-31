import type { RepoRef } from "@/lib/github/types";

/**
 * Normalised, UI-facing status of a pipeline run. Collapses GitHub's separate
 * `status` + `conclusion` fields into a single value that maps cleanly to a
 * badge.
 */
export type PipelineStatus =
  | "success"
  | "failure"
  | "cancelled"
  | "running"
  | "queued"
  | "skipped"
  | "action_required"
  | "unknown";

/** A single workflow run, projected into the application's domain model. */
export interface PipelineRun {
  readonly id: number;
  /** Workflow this run belongs to (used to keep the latest run per workflow). */
  readonly workflowId: number;
  readonly workflowName: string;
  readonly title: string;
  readonly runNumber: number;
  readonly status: PipelineStatus;
  readonly branch: string | null;
  readonly commitSha: string;
  readonly event: string;
  readonly url: string;
  readonly actor: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Aggregated pipeline state for a single repository. */
export interface RepoPipelines {
  readonly repo: RepoRef;
  /** Latest run per workflow, newest first. Empty when no runs exist. */
  readonly runs: readonly PipelineRun[];
  /**
   * Worst status across the repository's workflows, used for at-a-glance
   * sorting and colouring. `null` when the repository has no runs.
   */
  readonly overallStatus: PipelineStatus | null;
  /** Set when this repository could not be fetched; `runs` is then empty. */
  readonly error: string | null;
}

/** Full dashboard payload: every observed repository plus fetch metadata. */
export interface PipelineOverview {
  readonly repositories: readonly RepoPipelines[];
  readonly generatedAt: string;
}

/**
 * Pipeline state for a single branch: the latest run per workflow observed on
 * that branch. Used by the branch-oriented view, where the default-branch run
 * of a workflow no longer masks the same workflow's run on a feature branch.
 */
export interface BranchPipelines {
  readonly branch: string;
  /** Latest run per workflow on this branch, newest first. */
  readonly runs: readonly PipelineRun[];
  /** Most actionable status across the branch's workflows (`null` if none). */
  readonly overallStatus: PipelineStatus | null;
}

/**
 * A repository's branches that are **not yet merged** into an integration
 * branch (`develop`/`main`/`master`), each with its own pipeline state. This is
 * the unit of the branch-oriented view.
 */
export interface RepoBranchPipelines {
  readonly repo: RepoRef;
  /** Unmerged branches with runs, most actionable first. Empty on error. */
  readonly branches: readonly BranchPipelines[];
  /** Set when the repository could not be fetched; `branches` is then empty. */
  readonly error: string | null;
}

/** Full branch-oriented payload: every observed repository plus fetch metadata. */
export interface BranchOverview {
  readonly repositories: readonly RepoBranchPipelines[];
  readonly generatedAt: string;
}
