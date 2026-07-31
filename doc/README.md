# Observer — Knowledge Base

Structured documentation for the **Observer** dashboard, written so that a
developer or an AI agent can understand the project and implement changes
**without reading large amounts of code**.

Observer is a Next.js (App Router) app that aggregates **GitHub Actions CI/CD
status** across many microservice repositories into a single view, organised
into optional folders.

## How to use this knowledge base

Each document is focused and cross-linked. Every doc references the exact source
files it describes, so you can jump straight to the relevant code. Start here,
then follow the links you need.

### Start here by task

| I want to…                                            | Read                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Understand the big picture and module boundaries      | [architecture.md](./architecture.md)                                              |
| Change what repositories are shown, or add folders    | [configuration.md](./configuration.md)                                            |
| Understand the data types passed around the app       | [domain-model.md](./domain-model.md)                                              |
| Work with the GitHub API / add an endpoint            | [github-integration.md](./github-integration.md)                                  |
| Change the dashboard UI, cards, badges, or styling    | [ui.md](./ui.md)                                                                   |
| Add a feature (field, filter, data source, folder…)   | [how-to.md](./how-to.md)                                                           |

## Document map

- **[architecture.md](./architecture.md)** — Layered design, module map,
  dependency rules, and end-to-end data/render flow (with diagrams).
- **[configuration.md](./configuration.md)** — Environment variables and the
  optional `observer.config.json` folder file; repository resolution rules.
- **[domain-model.md](./domain-model.md)** — The core types (`PipelineRun`,
  `RepoPipelines`, `PipelineGroup`, …) and how GitHub statuses are normalised.
- **[github-integration.md](./github-integration.md)** — The typed REST client,
  the endpoints used, auth, error handling, caching, and pagination.
- **[ui.md](./ui.md)** — The component catalogue, rendering tree, theming, and
  CSS-module conventions.
- **[how-to.md](./how-to.md)** — Recipes for common changes, plus commands and
  gotchas.

## Source layout (quick reference)

```
src/
  app/          Next.js App Router entry (page = composition + render)
  components/    Server components + CSS modules for the dashboard
  lib/
    config/      Environment + observer.config.json parsing & validation
    github/      Typed GitHub REST client, error types, API types, repo utils
    pipelines/   Domain model, mappers, aggregation, grouping, composition root
    format/      Presentation-agnostic formatting helpers
```

See [architecture.md](./architecture.md) for what each layer may and may not
depend on.

## Conventions used in these docs

- **Source references** use repo-root-relative paths, e.g.
  [`src/lib/pipelines/index.ts`](../src/lib/pipelines/index.ts).
- **Symbols** (functions/types) are named exactly as they appear in code.
- When a doc says a value is "normalised" or "isolated", the linked source is
  the source of truth — update both together.
