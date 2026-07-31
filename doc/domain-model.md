# Domain model

The domain model is the **UI-agnostic** representation of pipeline state. GitHub
payloads are projected into these types by
[`mappers.ts`](../src/lib/pipelines/mappers.ts); everything above the
`pipelines` layer (components, page) works only with these types.

Types live in [`src/lib/pipelines/types.ts`](../src/lib/pipelines/types.ts)
(plus `PipelineGroup` in [`grouping.ts`](../src/lib/pipelines/grouping.ts) and
`OverviewSummary` in [`summary.ts`](../src/lib/pipelines/summary.ts)).

Related: [architecture.md](./architecture.md) ·
[github-integration.md](./github-integration.md) · [ui.md](./ui.md)

## Type reference

### `RepoRef` — [`github/types.ts`](../src/lib/github/types.ts)

`{ owner: string; name: string }`. The lightweight identity of a repository.
Helpers in [`github/repo.ts`](../src/lib/github/repo.ts):

- `repoFullName(repo)` → `"owner/name"` (original casing, for display/URLs).
- `repoRefKey(repo)` → lowercased `"owner/name"` (dedup & lookup key).

### `PipelineStatus` — normalised status

A single value that collapses GitHub's separate `status` + `conclusion` fields:

```
"success" | "failure" | "cancelled" | "running" | "queued"
| "skipped" | "action_required" | "unknown"
```

### `PipelineRun`

One workflow run projected into the domain. Fields: `id`, `workflowId`,
`workflowName`, `title`, `runNumber`, `status` (`PipelineStatus`), `branch`,
`commitSha`, `event`, `url`, `actor`, `createdAt`, `updatedAt`.

### `RepoPipelines`

Aggregated state for one repository:

- `repo: RepoRef`
- `runs: PipelineRun[]` — **latest run per workflow**, newest first (see
  `latestRunPerWorkflow`).
- `overallStatus: PipelineStatus | null` — most actionable status across runs
  (`null` when there are no runs).
- `error: string | null` — set when the repo could not be fetched; `runs` is
  then empty. Enables per-repo fault isolation.

### `PipelineOverview`

`{ repositories: RepoPipelines[]; generatedAt: string }` — the full fetch
result, before grouping.

### `Pipeline` / `PipelineRepoStatus` — [`byPipeline.ts`](../src/lib/pipelines/byPipeline.ts)

The **inverse** projection of `RepoPipelines`, used by the pipeline-oriented
view (`/pipelines`). A `Pipeline` is a workflow **name** grouped across every
repository that runs it:

- `PipelineRepoStatus` = `{ repo: RepoRef; run: PipelineRun }` — one
  repository's latest run of that pipeline's workflow.
- `Pipeline` = `{ name: string; repositories: PipelineRepoStatus[]; overallStatus: PipelineStatus | null }`.

`groupByPipeline(repositories)` pivots `RepoPipelines[]` into `Pipeline[]`,
keyed by `workflowName` so the same logical pipeline (e.g. `"CI"`) is grouped
across repos despite each having a distinct numeric `workflow_id`. It reuses the
**already-fetched** data — no extra GitHub calls. Repositories that failed to
fetch (no runs) contribute to no pipeline.

### `PipelineGroup` — [`grouping.ts`](../src/lib/pipelines/grouping.ts)

A folder: `{ name: string | null; repositories: RepoPipelines[]; defaultOpen: boolean }`.
`name: null` is the implicit "everything" group used when no
`observer.config.json` exists (rendered as a flat grid, not a folder).

### `OverviewSummary` — [`summary.ts`](../src/lib/pipelines/summary.ts)

`{ totalRepos; erroredRepos; byStatus: Record<PipelineStatus, number> }`.
Computed by `summarizeRepositories(repos)` (and `summarizeOverview(overview)`).
For the pipeline-oriented view, `summarizePipeline(pipeline)` /
`summarizePipelines(pipelines)` produce the same shape, bucketing repositories
by their per-pipeline run status.

## Status normalisation

Implemented in `toPipelineStatus(status, conclusion)`
([`mappers.ts`](../src/lib/pipelines/mappers.ts)). A run is only "concluded"
when GitHub `status === "completed"`.

| GitHub `status`                              | GitHub `conclusion`                         | → `PipelineStatus`  |
| -------------------------------------------- | ------------------------------------------- | ------------------- |
| `queued` / `waiting` / `requested` / `pending` | —                                         | `queued`            |
| `in_progress` (any other non-completed)      | —                                           | `running`           |
| `completed`                                  | `success`                                   | `success`           |
| `completed`                                  | `failure` / `timed_out` / `startup_failure` | `failure`           |
| `completed`                                  | `cancelled`                                 | `cancelled`         |
| `completed`                                  | `skipped` / `neutral` / `stale`             | `skipped`           |
| `completed`                                  | `action_required`                           | `action_required`   |
| `completed`                                  | anything else / `null`                      | `unknown`           |

## Overall status severity

`overallStatus(runs)` picks the **most actionable** status. Severity ranking
(higher wins), from `STATUS_SEVERITY` in
[`mappers.ts`](../src/lib/pipelines/mappers.ts):

```
failure (6) > action_required (5) > running (4) > queued (3)
> cancelled (2) > unknown (1) > skipped (0) = success (0)
```

So a repo with any failing workflow surfaces as `failure`; a fully green repo is
`success`.

## Projection helpers (mappers)

| Function                        | Purpose                                                        |
| ------------------------------- | ------------------------------------------------------------- |
| `toPipelineStatus(s, c)`        | Normalise status/conclusion (table above).                    |
| `toPipelineRun(run)`            | Map one raw `GitHubWorkflowRun` → `PipelineRun`.             |
| `latestRunPerWorkflow(runs)`    | Keep newest run per `workflow_id`, sorted newest-first.       |
| `overallStatus(runs)`           | Most actionable status across a repo's runs (or `null`).      |

Presentation of a `PipelineStatus` (label, colour, icon) is **not** here — it
lives in the UI layer, see
[`statusPresentation.ts`](../src/components/statusPresentation.ts) and
[ui.md](./ui.md).
