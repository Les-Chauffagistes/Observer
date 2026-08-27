# How-to recipes

Task-oriented guides for common changes. Each recipe lists the files to touch in
order. For the why, see [architecture.md](./architecture.md),
[domain-model.md](./domain-model.md), and [ui.md](./ui.md).

## Commands

Run from the repo root:

```bash
npm run dev     # dev server (http://localhost:3000)
npm run build   # production build — also runs the TypeScript type-check
npm run lint    # ESLint (eslint-config-next)
```

There is **no test suite yet**. The pure functions in `lib/pipelines/mappers.ts`,
`lib/pipelines/summary.ts`, `lib/pipelines/grouping.ts`, `lib/config/*`, and
`lib/format/time.ts` are written to be easily unit-tested — adding tests is a
good next step before piling on features. Always run `npm run lint` **and**
`npm run build` before considering a change done (build is the type-check).

## Add a displayed field

Example: show each run's `runNumber` on the card.

1. **API type** — ensure the field exists on `GitHubWorkflowRun` in
   [`github/types.ts`](../src/lib/github/types.ts) (add it if the API returns a
   new field).
2. **Domain type** — add it to `PipelineRun` in
   [`pipelines/types.ts`](../src/lib/pipelines/types.ts).
3. **Mapper** — populate it in `toPipelineRun` in
   [`mappers.ts`](../src/lib/pipelines/mappers.ts).
4. **UI** — render it in `RunRow` inside
   [`RepoPipelineCard.tsx`](../src/components/RepoPipelineCard.tsx) (+ its CSS
   module).

The layering means steps 1–3 are UI-independent and step 4 needs no GitHub
knowledge.

## Add a configuration value

1. Add parsing/validation to `loadConfig` and the `AppConfig` type in
   [`config/index.ts`](../src/lib/config/index.ts). Validate and throw
   `ConfigError` on bad input.
2. Document it in [`.env.example`](../.env.example) and
   [configuration.md](./configuration.md).
3. Consume it where needed (e.g. pass into `GitHubClient` from
   [`pipelines/index.ts`](../src/lib/pipelines/index.ts)).

## Change grouping / folder behaviour

- **Schema** (new field in `observer.config.yml`): extend `GroupsConfig` and
  its validation in [`config/groups.ts`](../src/lib/config/groups.ts), and
  update [`observer.config.example.json`](../observer.config.example.json).
- **Partition logic** (how repos are placed in folders): edit
  `groupRepositories` in
  [`pipelines/grouping.ts`](../src/lib/pipelines/grouping.ts).
- **Folder rendering**: edit
  [`RepoGroupSection.tsx`](../src/components/RepoGroupSection.tsx).

Example ideas already scoped for the future: glob/pattern matching for repo
entries (e.g. exclude `*-docs`), or per-folder default-open control.

## Add a new top-level view (pivot of the same data)

Example (already shipped): the **pipeline-oriented** view at `/pipelines`, the
inverse of the repository-oriented home page. It reuses the exact same
`loadOverview()` result — **no extra GitHub calls** — by pivoting the domain
model in a pure function. Use this recipe whenever a new page is just a
different projection/arrangement of already-fetched data.

1. **Projection (domain)** — add a pure transform + its types under
   [`pipelines/`](../src/lib/pipelines/), e.g.
   [`byPipeline.ts`](../src/lib/pipelines/byPipeline.ts)'s `groupByPipeline()`
   returning `Pipeline[]`. Keep it UI-agnostic and reuse existing helpers
   (`overallStatus`, the `STATUS_SEVERITY` ranking) so behaviour stays
   consistent.
2. **Summary (optional)** — if the view has a header/section count, add a
   sibling to `summarizeRepositories` in
   [`summary.ts`](../src/lib/pipelines/summary.ts) that returns the same
   `OverviewSummary` shape, so `StatusSummary` renders it unchanged.
3. **Barrel** — export the new function/types from
   [`pipelines/index.ts`](../src/lib/pipelines/index.ts).
4. **Components** — add a dashboard shell + a section component (reuse
   `StatusBadge`, `StatusSummary`, native `<details>` for collapsible groups —
   no client JS). Follow the CSS-Module conventions (one module per component,
   pure selectors). Reusing shared shell classes across dashboards is fine:
   import another component's `*.module.css` (see
   [`PipelineOrientedDashboard`](../src/components/PipelineOrientedDashboard.tsx)
   reusing `PipelineDashboard.module.css`).
5. **Route** — add `src/app/<view>/page.tsx` with `export const dynamic =
   "force-dynamic"`, calling `loadOverview()`, guarding `!result.ok` with
   `SetupNotice`, then feeding the projection to the new dashboard. Derive
   visible repositories from `result.groups` (not `overview.repositories`) so
   the view honours `observer.config.yml` hiding, exactly like the home page.
6. **Navigation** — add the route to
   [`ViewNav`](../src/components/ViewNav.tsx) and pass the correct `active` prop
   from each dashboard header. `ViewNav` is a plain-link toggle (no JS).
7. **Docs** — update the rendering tree + component catalogue in
   [ui.md](./ui.md), add the new types to [domain-model.md](./domain-model.md),
   and the feature bullet in the [README](../README.md).

Golden rule: a new view is a **presentation concern**. Pivot in a pure
`pipelines/` function and render it — never add a GitHub call for a view that
rearranges data the overview already contains.

## Add a UI filter or search

Filtering/searching over the already-fetched repositories is a **presentation**
concern. Prefer computing it from `overview`/`groups` in
[`PipelineDashboard`](../src/components/PipelineDashboard.tsx). If it needs
interactivity (text input, toggles), introduce a small `"use client"` leaf
component and keep `page.tsx`/data-fetching on the server. Do **not** move
GitHub calls into components.

## Add a new data source (e.g. non-Actions CI)

This is the one change that warrants a refactor, and it has a natural seam:

1. Today, `RepoPipelines.runs` come only from GitHub Actions via
   [`service.ts`](../src/lib/pipelines/service.ts). To add another source
   (commit statuses, checks API, a different CI), introduce a **provider**
   abstraction that yields `PipelineRun[]` for a repo, and have the service
   merge providers.
2. Keep the provider inside the `pipelines`/`github` layers; the domain types
   and the entire UI stay unchanged because they already speak `PipelineRun`.

Flag this refactor explicitly when it arrives — see the note in
[architecture.md](./architecture.md).

## Gotchas

- **CSS Module pure selectors**: a bare element selector (`code { … }`) fails
  the Turbopack build with *"Selector is not pure"*. Scope it with a local
  class: `.card code { … }`. See [ui.md](./ui.md#styling-conventions).
- **Server vs client**: everything is a server component by default. Reading
  files (`observer.config.yml`) and env vars is fine on the server; never do it
  from a `"use client"` component.
- **`force-dynamic`**: [`page.tsx`](../src/app/page.tsx) opts out of static
  rendering so the dashboard is always live; GitHub responses are still cached
  briefly at the fetch layer.
- **Config errors are data**: return them via `OverviewResult`
  (`{ ok: false, reason: "config" }`) so [`SetupNotice`](../src/components/SetupNotice.tsx)
  can render — don't throw for expected misconfiguration.
- **Round status dots**: size dots in **whole pixels** (`width: 10px; height: 10px`),
  not fractional `rem`. `0.6rem` = 9.6px rounds to different device pixels on
  each axis depending on position (10×9), producing an oval; integer px sizes
  land exactly and stay circular. Use `flex: none` so a flex row never resizes
  them. See
  [`StatusSummary.module.css`](../src/components/StatusSummary.module.css) /
  [`StatusBadge.module.css`](../src/components/StatusBadge.module.css).
- **Dedup key**: use `repoRefKey` ([`github/repo.ts`](../src/lib/github/repo.ts))
  for any repo comparison; it is case-insensitive.
