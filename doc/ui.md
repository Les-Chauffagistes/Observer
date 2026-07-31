# UI

The UI is built entirely from **React Server Components** (no client-side
JavaScript) plus **CSS Modules**. Components render domain types only — they
never call GitHub. See [architecture.md](./architecture.md) and
[domain-model.md](./domain-model.md).

All components live in [`src/components`](../src/components); the entry point is
[`src/app/page.tsx`](../src/app/page.tsx).

## Rendering tree

```
app/page.tsx  (force-dynamic, async server component → loadOverview())
 ├─ SetupNotice                         when result.ok === false
 └─ PipelineDashboard  { overview, groups }
     ├─ StatusSummary  { summary }      header status counts (visible repos)
     ├─ RepoGrid  { repositories }      flat view (no observer.config.json)
     └─ RepoGroupSection*  { group }    folder view (one per group)
         └─ RepoGrid → RepoPipelineCard*  { data, showOwner }
             ├─ StatusBadge  { status }         overall + per-run
             └─ (internal) CardBody → RunRow*
```

## Component catalogue

| Component                                                                    | Props                              | Responsibility                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| [`PipelineDashboard`](../src/components/PipelineDashboard.tsx)                | `overview`, `groups`               | Page shell: header, computes **visible** repos, chooses flat vs folder layout. |
| [`RepoGroupSection`](../src/components/RepoGroupSection.tsx)                  | `group`, `showOwner`               | One collapsible folder using native `<details>` (no JS). Per-folder summary.   |
| [`RepoGrid`](../src/components/RepoGrid.tsx)                                  | `repositories`, `showOwner`        | Responsive grid of cards. Shared by flat & folder layouts.                     |
| [`RepoPipelineCard`](../src/components/RepoPipelineCard.tsx)                  | `data`, `showOwner?`               | One repo: title, overall badge, run list. `CardBody`/`RunRow` are internal.    |
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
