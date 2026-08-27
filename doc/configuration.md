# Configuration

Observer draws its configuration from two sources:

1. **Environment variables** — secrets and the repository source. Parsed by
   [`src/lib/config/index.ts`](../src/lib/config/index.ts).
2. **`observer.config.yml`** (optional) — folder organisation. Parsed by
   [`src/lib/config/groups.ts`](../src/lib/config/groups.ts).

Both are combined in the composition root
[`loadOverview`](../src/lib/pipelines/index.ts). See
[architecture.md](./architecture.md) for the flow.

Related: [domain-model.md](./domain-model.md) ·
[github-integration.md](./github-integration.md)

## Environment variables

Template: [`.env.example`](../.env.example). Local values go in `.env.local`
(git-ignored). Loaded and validated by `loadConfig()` into `AppConfig`.

| Variable                    | Required | Default                  | Meaning                                                          |
| --------------------------- | -------- | ------------------------ | ---------------------------------------------------------------- |
| `GITHUB_TOKEN`              | yes      | —                        | Token with Actions read access. Missing → `ConfigError`.         |
| `GITHUB_ORG`                | see \*   | `null`                   | Organisation whose repos are auto-discovered.                    |
| `GITHUB_REPOS`              | see \*   | `[]`                     | Comma/space separated repo entries (bare `repo` or `owner/repo`). |
| `GITHUB_API_URL`            | no       | `https://api.github.com` | API base URL (change for GitHub Enterprise Server).              |
| `GITHUB_REVALIDATE_SECONDS` | no       | `30`                     | Cache lifetime applied to GitHub responses.                     |
| `GITHUB_WEBHOOK_SECRET`     | no       | `null`                   | Shared secret that verifies inbound GitHub workflow webhooks.   |

\* At least one repository source must exist: `GITHUB_ORG`, `GITHUB_REPOS`, **or**
a group in `observer.config.yml`. `loadConfig` only requires the token; the
"no repository source" check happens in
[`loadOverview`](../src/lib/pipelines/index.ts) because groups are also a source.

`GITHUB_WEBHOOK_SECRET` is only required when enabling live workflow updates.
Use a high-entropy value and configure the same value as the GitHub webhook
secret; the application rejects unsigned or incorrectly signed deliveries.

### Repository entry resolution

`resolveRepoEntry(entry, defaultOwner, source)` (exported from
[`config/index.ts`](../src/lib/config/index.ts)) resolves a single entry and is
reused by both `GITHUB_REPOS` and `observer.config.yml`:

- `owner/repo` → `{ owner, name }`.
- bare `repo` → `{ owner: defaultOwner, name }`, where `defaultOwner` is
  `GITHUB_ORG`. If there is no `GITHUB_ORG`, a bare name throws `ConfigError`.
- Anything else (empty, `a/b/c`) → `ConfigError`.

## Folders — `observer.config.yml`

Optional file at the project root that organises repositories into collapsible
folders and can hide irrelevant ones. Template:
[`observer.config.example.yml`](../observer.config.example.yml). The real file
is git-ignored (see [`.gitignore`](../.gitignore)).

```yaml
includeUngrouped: true
pinned:
  repo: gitops
  environments:
    - label: Staging
      branch: develop
    - label: Production
      branch: main
groups:
  - name: Microservices
    repos: [auth-service, coins-service]
  - name: Frontends
    repos: [pool-site]
```

Parsed into `GroupsConfig` by `loadGroupsConfig(defaultOwner)`:

| Field              | Type                              | Default | Meaning                                                            |
| ------------------ | --------------------------------- | ------- | ------------------------------------------------------------------ |
| `groups`           | `{ name, repos: string[] }[]`     | —       | Ordered folders. `name` non-empty; `repos` entries as above.      |
| `includeUngrouped` | `boolean`                         | `true`  | Show org repos not in any group (in an `Other` folder) or hide them. |
| `pinned`           | `string` \| `{ repo, environments? }` | `null`  | A single repository pinned above the folders (see below).         |

### Pinned repository — `pinned`

A single repository that does not fit any folder (typically a GitOps/deployment
repo) can be pinned at the top of the dashboard with its per-environment
pipeline state highlighted side by side. Parsed into `PinnedRepoConfig` by
`parsePinned` in [`groups.ts`](../src/lib/config/groups.ts):

| Field          | Type                        | Default                         | Meaning                                                        |
| -------------- | --------------------------- | ------------------------------- | -------------------------------------------------------------- |
| `repo`         | `string`                    | —                               | Bare `repo` or `owner/repo`; always observed, even outside org. |
| `environments` | `{ label, branch }[]`       | `develop`→Staging, `main`→Prod  | Each pairs a display `label` with the branch that reflects it.  |

- `"pinned": "gitops"` (a bare string) is shorthand for that repo with the
  default environments.
- Each environment shows the **latest run per workflow** on its branch (reusing
  `groupRunsByBranch`), plus each run's **jobs**, fetched via `getPinnedRepo` in
  [`service.ts`](../src/lib/pipelines/service.ts). Jobs are shown because a run
  marked `success` can hide a `skipped` deployment job.
- The pinned repo is excluded from the folders in
  [`loadOverview`](../src/lib/pipelines/index.ts) (matched by `repoRefKey`) so it
  never appears twice; header summary counts cover the folders only.
- A fetch failure is isolated on the card itself (`PinnedRepoPipelines.error`)
  and never breaks the rest of the dashboard.

Behavioural rules (implemented in
[`pipelines/grouping.ts`](../src/lib/pipelines/grouping.ts) and
[`pipelines/index.ts`](../src/lib/pipelines/index.ts)):

- Folders render in the order listed; the `Other` folder (constant
  `UNGROUPED_LABEL`) is appended last and is **collapsed by default**.
- A repository appears in **at most one** folder (first match wins).
- Repositories referenced by a group are **always observed**, even if outside
  the org — group repos are added to the fetch set via `groupRepoRefs`.
- `includeUngrouped: false` hides ungrouped repos **and** skips organisation
  discovery (`discoverOrg: false`), so no API calls are spent on hidden repos.
- Header summary counts reflect **visible** repositories only (see
  [`PipelineDashboard.tsx`](../src/components/PipelineDashboard.tsx)).
- Without the file, `groupRepositories` returns a single implicit group
  (`name: null`) and the dashboard renders a flat grid.

### Validation & errors

Both loaders throw [`ConfigError`](../src/lib/config/index.ts) with a descriptive
message on malformed input (bad JSON/YAML, wrong types, empty group name,
unresolved bare name). `loadOverview` catches `ConfigError` and surfaces it through
[`SetupNotice`](../src/components/SetupNotice.tsx) rather than crashing.

## Precedence summary

The observed repository set is the **union** of: `GITHUB_REPOS` + all group
repos + (org discovery, unless skipped). Duplicates are removed by
`repoRefKey` (case-insensitive `owner/name`). See `resolveRepositories` in
[`service.ts`](../src/lib/pipelines/service.ts). The `pinned` repo is fetched
separately by `getPinnedRepo` (also always observed) and then excluded from the
folders so it appears only in its top card.
