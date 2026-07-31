import { repoRefKey } from "@/lib/github/repo";
import type { RepoRef } from "@/lib/github/types";
import { overallStatus } from "@/lib/pipelines/mappers";
import type {
  PipelineRun,
  PipelineStatus,
  RepoPipelines,
} from "@/lib/pipelines/types";

/**
 * A single repository's participation in one pipeline: the latest run of that
 * workflow in that repository. This is the inverse projection of
 * {@link RepoPipelines} — here the pipeline is fixed and the repository varies.
 */
export interface PipelineRepoStatus {
  readonly repo: RepoRef;
  /** Latest run of this pipeline's workflow in this repository. */
  readonly run: PipelineRun;
}

/**
 * A pipeline (identified by its workflow name) across every repository that
 * runs it. This is the top-level unit of the pipeline-oriented view, mirroring
 * how {@link RepoPipelines} is the unit of the repository-oriented view.
 */
export interface Pipeline {
  /** Workflow name shared across repositories (e.g. "CI", "Deploy"). */
  readonly name: string;
  /** Repositories running this pipeline, most actionable status first. */
  readonly repositories: readonly PipelineRepoStatus[];
  /** Most actionable status across all repositories running this pipeline. */
  readonly overallStatus: PipelineStatus | null;
}

/**
 * Pivot the repository-oriented overview into a pipeline-oriented one.
 *
 * Pipelines are identified by **workflow name** so the same logical pipeline
 * (e.g. "CI") is grouped across repositories even though GitHub assigns it a
 * different numeric `workflow_id` in each repo. Repositories that do not run a
 * given workflow simply do not appear under it; repositories that failed to
 * fetch (no runs) contribute to no pipeline.
 *
 * Reuses the exact same fetched data as {@link getPipelineOverview} — no
 * additional GitHub calls are made.
 */
export function groupByPipeline(
  repositories: readonly RepoPipelines[],
): Pipeline[] {
  const byName = new Map<string, PipelineRepoStatus[]>();

  for (const { repo, runs } of repositories) {
    for (const run of runs) {
      const members = byName.get(run.workflowName) ?? [];
      members.push({ repo, run });
      byName.set(run.workflowName, members);
    }
  }

  const pipelines: Pipeline[] = [...byName.entries()].map(([name, members]) => {
    const sorted = [...members].sort(compareRepoStatus);
    return {
      name,
      repositories: sorted,
      overallStatus: overallStatus(sorted.map((member) => member.run)),
    };
  });

  return pipelines.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Order repositories within a pipeline by most-actionable status first, then
 * alphabetically so the layout is stable between refreshes.
 */
function compareRepoStatus(
  a: PipelineRepoStatus,
  b: PipelineRepoStatus,
): number {
  const severity =
    STATUS_SEVERITY[b.run.status] - STATUS_SEVERITY[a.run.status];
  if (severity !== 0) return severity;
  return repoRefKey(a.repo).localeCompare(repoRefKey(b.repo));
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
