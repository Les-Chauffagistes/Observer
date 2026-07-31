# Configuration

Observer draws its configuration from two sources:

1. **Environment variables** — secrets and the repository source. Parsed by
   [`src/lib/config/index.ts`](../src/lib/config/index.ts).
2. **`observer.config.json`** (optional) — folder organisation. Parsed by
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

\* At least one repository source must exist: `GITHUB_ORG`, `GITHUB_REPOS`, **or**
a group in `observer.config.json`. `loadConfig` only requires the token; the
"no repository source" check happens in
[`loadOverview`](../src/lib/pipelines/index.ts) because groups are also a source.

### Repository entry resolution

`resolveRepoEntry(entry, defaultOwner, source)` (exported from
[`config/index.ts`](../src/lib/config/index.ts)) resolves a single entry and is
reused by both `GITHUB_REPOS` and `observer.config.json`:

- `owner/repo` → `{ owner, name }`.
- bare `repo` → `{ owner: defaultOwner, name }`, where `defaultOwner` is
  `GITHUB_ORG`. If there is no `GITHUB_ORG`, a bare name throws `ConfigError`.
- Anything else (empty, `a/b/c`) → `ConfigError`.

## Folders — `observer.config.json`

Optional file at the project root that organises repositories into collapsible
folders and can hide irrelevant ones. Template:
[`observer.config.example.json`](../observer.config.example.json). The real file
is git-ignored (see [`.gitignore`](../.gitignore)).

```json
{
  "includeUngrouped": true,
  "groups": [
    { "name": "Microservices", "repos": ["auth-service", "coins-service"] },
    { "name": "Frontends", "repos": ["pool-site"] }
  ]
}
```

Parsed into `GroupsConfig` by `loadGroupsConfig(defaultOwner)`:

| Field              | Type                              | Default | Meaning                                                            |
| ------------------ | --------------------------------- | ------- | ------------------------------------------------------------------ |
| `groups`           | `{ name, repos: string[] }[]`     | —       | Ordered folders. `name` non-empty; `repos` entries as above.      |
| `includeUngrouped` | `boolean`                         | `true`  | Show org repos not in any group (in an `Other` folder) or hide them. |

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
message on malformed input (bad JSON, wrong types, empty group name, unresolved
bare name). `loadOverview` catches `ConfigError` and surfaces it through
[`SetupNotice`](../src/components/SetupNotice.tsx) rather than crashing.

## Precedence summary

The observed repository set is the **union** of: `GITHUB_REPOS` + all group
repos + (org discovery, unless skipped). Duplicates are removed by
`repoRefKey` (case-insensitive `owner/name`). See `resolveRepositories` in
[`service.ts`](../src/lib/pipelines/service.ts).
