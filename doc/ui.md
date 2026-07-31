# UI

The UI is built entirely from **React Server Components** (no client-side
JavaScript) plus **CSS Modules**. Components render domain types only — they
never call GitHub. See [architecture.md](./architecture.md) and
[domain-model.md](./domain-model.md).

All components live in [`src/components`](../src/components); the entry points
are [`src/app/page.tsx`](../src/app/page.tsx) (by repository),
[`src/app/pipelines/page.tsx`](../src/app/pipelines/page.tsx) (by pipeline) and
[`src/app/branches/page.tsx`](../src/app/branches/page.tsx) (by branch).

## Rendering tree

```
app/page.tsx  (force-dynamic, async server component → loadOverview())
 ├─ SetupNotice                         when result.ok === false
 └─ PipelineDashboard  { overview, groups }
     ├─ ViewNav  { active }             repository ⇄ pipeline ⇄ branch toggle
     ├─ StatusSummary  { summary }      header status counts (visible repos)
     ├─ RepoGrid  { repositories }      flat view (no observer.config.json)
     └─ RepoGroupSection*  { group }    folder view (one per group)
         └─ RepoGrid → RepoPipelineCard*  { data, showOwner }
             ├─ StatusBadge  { status }         overall + per-run
             └─ (internal) CardBody → RunRow*

app/pipelines/page.tsx  (force-dynamic → loadOverview() + groupByPipeline())
 ├─ SetupNotice                         when result.ok === false
 └─ PipelineOrientedDashboard  { overview, pipelines }
     ├─ ViewNav  { active }             repository ⇄ pipeline ⇄ branch toggle
     ├─ StatusSummary  { summary }      header status counts (all pipelines)
     └─ PipelineSection*  { pipeline }  one collapsible folder per pipeline
         ├─ StatusBadge  { status }     overall + per-repo
         └─ StatusSummary  { summary }  per-pipeline repo counts

app/branches/page.tsx  (force-dynamic → loadBranchOverview())
 ├─ SetupNotice                         when result.ok === false
 └─ BranchDashboard  { overview, groups }
     ├─ ViewNav  { active }             repository ⇄ pipeline ⇄ branch toggle
     ├─ StatusSummary  { summary }      header status counts (unmerged branches)
     ├─ BranchGrid  { repositories }    flat view (no observer.config.json)
     └─ BranchGroupSection*  { group }  folder view (one per group)
         └─ BranchGrid → RepoBranchCard*  { data, showOwner }
             └─ (internal) BranchBlock* → StatusBadge + RunRow*
```

## Views

The dashboard offers three views of the same fetched data, switched via
`ViewNav` (plain links, no JS):

- **By repository** (`/`) — repositories are the top-level unit; each card lists
  that repo's pipelines. Rendered by `PipelineDashboard`.
- **By pipeline** (`/pipelines`) — pipelines (workflow names) are the top-level
  unit; each collapsible section lists the repositories that run it and their
  status. Rendered by `PipelineOrientedDashboard` via `groupByPipeline` (see
  [domain-model.md](./domain-model.md)). No extra GitHub calls — it pivots the
  same `loadOverview()` result.
- **By branch** (`/branches`) — per repository, the branches **not yet merged**
  into `develop`/`main`/`master`, each with its own runs. Rendered by
  `BranchDashboard` from `loadBranchOverview()`. Unlike the other two views this
  one **does** make extra GitHub calls (branch listing + compare) to determine
  merge status; see [architecture.md](./architecture.md).

## Component catalogue

| Component                                                                    | Props                              | Responsibility                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| [`PipelineDashboard`](../src/components/PipelineDashboard.tsx)                | `overview`, `groups`               | Repository view shell: header, computes **visible** repos, chooses flat vs folder layout. |
| [`PipelineOrientedDashboard`](../src/components/PipelineOrientedDashboard.tsx) | `overview`, `pipelines`           | Pipeline view shell: header + one `PipelineSection` per pipeline.              |
| [`BranchDashboard`](../src/components/BranchDashboard.tsx)                    | `overview`, `groups`               | Branch view shell: header, flat vs folder layout of `RepoBranchCard`s.        |
| [`PipelineSection`](../src/components/PipelineSection.tsx)                    | `pipeline`, `showOwner`, `defaultOpen` | One collapsible pipeline folder (native `<details>`) listing its repos + status. |
| [`ViewNav`](../src/components/ViewNav.tsx)                                    | `active`                           | Repository ⇄ pipeline ⇄ branch view toggle (plain links).                     |
| [`RepoGroupSection`](../src/components/RepoGroupSection.tsx)                  | `group`, `showOwner`               | One collapsible folder using native `<details>` (no JS). Per-folder summary.   |
| [`BranchGroupSection`](../src/components/BranchGroupSection.tsx)              | `group`, `showOwner`               | Branch-view folder (native `<details>`), summarised by unmerged branches.      |
| [`RepoGrid`](../src/components/RepoGrid.tsx)                                  | `repositories`, `showOwner`        | Responsive grid of cards. Shared by flat & folder layouts.                     |
| [`BranchGrid`](../src/components/BranchGrid.tsx)                              | `repositories`, `showOwner`        | Responsive grid of `RepoBranchCard`s. Shared by flat & folder layouts.         |
| [`RepoPipelineCard`](../src/components/RepoPipelineCard.tsx)                  | `data`, `showOwner?`               | One repo: title, overall badge, run list. `CardBody`/`RunRow` are internal.    |
| [`RepoBranchCard`](../src/components/RepoBranchCard.tsx)                      | `data`, `showOwner?`               | One repo's unmerged branches, each with a status badge + its runs.             |
| [`StatusBadge`](../src/components/StatusBadge.tsx)                            | `status`, `compact?`               | Coloured badge (or dot) for a `PipelineStatus`.                                 |
| [`StatusSummary`](../src/components/StatusSummary.tsx)                        | `summary`, `hideZeros?`            | Inline list of status dots + counts. Shared by header and folders.             |
| [`SetupNotice`](../src/components/SetupNotice.tsx)                            | `message`                          | Shown when configuration is missing/invalid.                                   |

### `showOwner` logic

`PipelineDashboard` computes the set of distinct owners across **visible**
repositories. When there is exactly one, it shows the owner once as a chip next
to the title and passes `showOwner={false}` so cards drop the redundant
`owner/` prefix. With multiple owners, the prefix reappears per card.

## Status presentation

The **only** place that maps a domain `PipelineStatus` to how it looks is
[`statusPresentation.ts`](../src/components/statusPresentation.ts):

- `STATUS_PRESENTATION[status]` → `{ label, colorVar, icon }`.
- `SUMMARY_STATUSES` → the ordered subset shown in summary bars
  (`failure, action_required, running, queued, success`).

Colours are **CSS custom properties** (e.g. `--status-failure`) defined in
[`src/app/globals.css`](../src/app/globals.css), which also defines the
light/dark theme tokens (`--surface`, `--border`, `--text-muted`, …). To change
a status colour, edit the variable in `globals.css`; to change its label/icon,
edit `statusPresentation.ts`.

## Styling conventions

- **One CSS Module per component**: `Component.module.css` next to
  `Component.tsx`. Import as `styles` and reference `styles.className`.
- **Selectors must be "pure"** (contain a local class). A bare element selector
  like `code { … }` fails the Turbopack build — scope it, e.g. `.card code { … }`
  (this bit us once; see [how-to.md](./how-to.md#gotchas)).
- **Theme via variables**: use the tokens in `globals.css` rather than
  hard-coded colours, so light/dark both work.
- **No client JS**: prefer native elements (`<details>`/`<summary>` for
  collapsible folders). If you ever need interactivity, add a `"use client"`
  component — but keep it a leaf, and keep data-fetching in server components.
