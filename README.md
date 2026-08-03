# Observer

A Next.js dashboard that aggregates **GitHub Actions CI/CD status** across a set
of microservice repositories, giving the single overview the GitHub UI does not.

> **Documentation:** a structured knowledge base for developers and AI agents
> lives in [`doc/`](./doc/README.md) — start there to understand or extend the
> project without reading large amounts of code.

## Features

- Observe repositories from an explicit list, a whole organisation, or both.
- Three views of the same data: **by repository** (`/`), **by pipeline**
  (`/pipelines`), or **by branch** (`/branches`), toggled from the header.
- The **by branch** view lists, per repository, the branches not yet merged into
  `develop`/`main`/`master` and each branch's runs — so a feature branch's
  result is never masked by a later run on the default branch.
- Organise repositories into collapsible **folders** and hide irrelevant ones
  (`observer.config.json`).
- **Pin** one key repository (e.g. a GitOps repo) at the very top, highlighting
  the latest pipeline result of each environment side by side — `develop`
  (staging) and `main` (production).
- Latest run per workflow, per repository, with a normalised status badge.
- Per-repository fault isolation: one failing repo never breaks the dashboard.
- Brief fetch-layer caching to stay within GitHub API rate limits.

## Getting started

1. Copy the environment template and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   At minimum set `GITHUB_TOKEN` and one of `GITHUB_ORG` / `GITHUB_REPOS`.

2. Run the dev server:

   ```bash
   npm run dev
   ```

3. Open <http://localhost:3000>.

## Docker

The app builds into a self-contained image using Next.js standalone output.

Build and run with Docker directly:

```bash
docker build -t observer:latest .
docker run --rm -p 3000:3000 --env-file .env observer:latest
```

Or use Docker Compose (reads variables from a local `.env`):

```bash
docker compose up --build
```

Then open <http://localhost:3000>. All `GITHUB_*` variables are read at runtime,
so the same image works across environments without rebuilding.

## Configuration

| Variable                    | Required | Description                                              |
| --------------------------- | -------- | -------------------------------------------------------- |
| `GITHUB_TOKEN`              | yes      | Token with Actions read access.                          |
| `GITHUB_ORG`                | one of\* | Organisation whose repos are auto-discovered.            |
| `GITHUB_REPOS`              | one of\* | Bare `repo` names (owner = `GITHUB_ORG`) or `owner/repo`. |
| `GITHUB_API_URL`            | no       | API base URL (default `https://api.github.com`).         |
| `GITHUB_REVALIDATE_SECONDS` | no       | Cache lifetime for GitHub responses (default `30`).      |

\* At least one repository source must exist: `GITHUB_ORG`, `GITHUB_REPOS`, or a
group in `observer.config.json`.

## Folders (`observer.config.json`)

To organise the view — and filter out repositories that are not relevant —
create an optional `observer.config.json` at the project root
(see `observer.config.example.json`):

```json
{
  "includeUngrouped": true,
  "groups": [
    { "name": "Microservices", "repos": ["auth-service", "coins-service"] },
    { "name": "Frontends", "repos": ["pool-site"] }
  ]
}
```

- Each group becomes a collapsible folder, in the order listed.
- Repository names may be bare (owner defaults to `GITHUB_ORG`) or `owner/repo`.
  Repositories referenced here are always observed, even outside the org.
- `includeUngrouped` (default `true`) controls repositories not in any group:
  they appear in a collapsed **Other** folder, or are hidden entirely when set
  to `false`.

The file is optional; without it the dashboard shows a single flat grid.

### Pinned repository

One repository that does not fit any folder — typically a GitOps/deployment
repo — can be **pinned** at the very top of the dashboard with a dedicated card
that highlights the latest pipeline result of each environment side by side:

```json
{
  "pinned": {
    "repo": "gitops",
    "environments": [
      { "label": "Staging", "branch": "develop" },
      { "label": "Production", "branch": "main" }
    ]
  },
  "groups": [ ... ]
}
```

- `repo` may be bare (owner defaults to `GITHUB_ORG`) or `owner/repo`, and is
  always observed even outside the org.
- Each entry in `environments` pairs a `label` with the `branch` whose latest
  run per workflow reflects that environment. `environments` is optional and
  defaults to `develop` → **Staging** and `main` → **Production**.
- `"pinned": "gitops"` (a bare string) is shorthand for the repo with those
  default environments.
- The pinned repository is shown only in its top card; it is removed from the
  folders below so it never appears twice.

## Architecture

The code is organised in layers so successive additions stay easy to make:

```
src/
  lib/
    config/      Environment + observer.config.json parsing & validation.
    github/      Typed GitHub REST client, error types, API types.
    pipelines/   Domain model, mappers, aggregation, grouping, composition root.
    format/      Presentation-agnostic formatting helpers.
  components/    Server components rendering the dashboard.
  app/           Next.js App Router entry (page = composition + render).
```

Key boundaries:

- **`github/`** owns HTTP concerns only and returns raw GitHub payloads.
- **`pipelines/`** translates those payloads into a UI-agnostic domain model
  (`mappers.ts`), aggregates them (`service.ts`), and exposes a single
  composition root, `loadOverview()`.
- **`components/`** never talk to GitHub directly; they render domain types.

This separation means new data sources or views can be added without touching
the client, and the client can evolve without touching the UI.
