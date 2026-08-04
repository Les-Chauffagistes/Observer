# GitHub integration

All GitHub HTTP access is encapsulated in the `github` layer. It owns HTTP
concerns **only** (auth, query building, caching, error mapping) and returns
**raw** GitHub payloads — translation to the domain model happens in
[`pipelines/mappers.ts`](../src/lib/pipelines/mappers.ts). See
[architecture.md](./architecture.md).

Files:
[`client.ts`](../src/lib/github/client.ts) ·
[`types.ts`](../src/lib/github/types.ts) ·
[`errors.ts`](../src/lib/github/errors.ts) ·
[`repo.ts`](../src/lib/github/repo.ts) ·
[`index.ts`](../src/lib/github/index.ts) (barrel)

## `GitHubClient`

Constructed with `{ token, baseUrl, revalidateSeconds }`
(`GitHubClientOptions`). A private `get<T>()` helper handles every request.

### Requests

- **Headers**: `Accept: application/vnd.github+json`,
  `Authorization: Bearer <token>`,
  `X-GitHub-Api-Version: 2022-11-28`.
- **Caching**: normal GETs use Next.js `fetch(..., { next: { revalidate:
  revalidateSeconds, tags: ["github-api"] } })`. Tune via
  `GITHUB_REVALIDATE_SECONDS` (see [configuration.md](./configuration.md)).
  A live repository update explicitly uses `cache: "no-store"`.
- **Query params**: built via `URL.searchParams` from a typed map.

### Methods

| Method                               | Endpoint                                             | Returns                     |
| ------------------------------------ | ---------------------------------------------------- | --------------------------- |
| `listOrgRepos(org)`                  | `GET /orgs/{org}/repos` (paginated, `per_page=100`)  | `GitHubRepo[]`              |
| `listWorkflowRuns(repo, perPage=30)` | `GET /repos/{owner}/{repo}/actions/runs`             | `GitHubWorkflowRun[]`       |
| `listBranches(repo, perPage=100)`    | `GET /repos/{owner}/{repo}/branches` (paginated)     | `GitHubBranch[]`            |
| `compareBranches(repo, base, head)`  | `GET /repos/{owner}/{repo}/compare/{base}...{head}`  | `GitHubComparison`          |

- `listOrgRepos` follows pagination until a short page is returned. Archived /
  disabled filtering is **not** done here — it is a caller concern (see
  `resolveRepositories` in [`service.ts`](../src/lib/pipelines/service.ts)).
- `listWorkflowRuns` returns GitHub's newest-first order, which
  `latestRunPerWorkflow` relies on.
- `listBranches` + `compareBranches` power the **by branch** view: candidate
  feature branches come from recent runs, and `compareBranches` decides whether
  each is merged (`ahead_by === 0`) into an integration branch. Ref names are
  percent-encoded per path segment (slashes preserved) and only the comparison
  counts are needed (`per_page=1`).

## Error handling

`get<T>()` throws [`GitHubApiError`](../src/lib/github/errors.ts) on non-2xx
responses. It carries:

- `status: number`, `url: string`, a human-readable `message` (built from the
  response body's `message` field when present).
- `isAuthError` (`401`/`403`) and `isNotFound` (`404`) convenience getters.

Callers translate these into user-facing text. `fetchRepoPipelines`
([`service.ts`](../src/lib/pipelines/service.ts)) maps:

| Condition          | Repo `error` message                          |
| ------------------ | --------------------------------------------- |
| `isNotFound`       | `Repository not found or Actions disabled.`   |
| `isAuthError`      | `Access denied — check the token's scopes.`   |
| other API error    | the `GitHubApiError.message`                  |
| non-API error      | the `Error.message` (or `Unknown error.`)     |

Because fetches are per-repo and isolated, a single failure becomes a red card,
never a crashed dashboard.

## API types

[`types.ts`](../src/lib/github/types.ts) contains **hand-written, narrow**
typings for only the fields Observer consumes (rather than a full SDK). Key
types: `GitHubRepo`, `GitHubWorkflowRun`, `GitHubWorkflowRunsResponse`,
`GitHubRunStatus`, `GitHubRunConclusion`, `GitHubActor`, `GitHubBranch`,
`GitHubComparison`, and `RepoRef`.

> When you add a field to a request, extend the matching type here, then map it
> in [`mappers.ts`](../src/lib/pipelines/mappers.ts). See the recipe in
> [how-to.md](./how-to.md#add-a-displayed-field).

## Adding an endpoint

1. Add the response shape to [`types.ts`](../src/lib/github/types.ts).
2. Add a method to `GitHubClient` using the private `get<T>()` helper.
3. Consume it from the `pipelines` layer (never from components).

Auth scopes: a token needs Actions read access — fine-grained
"Actions: Read-only" + "Metadata: Read-only", or classic `repo` / `public_repo`.

## Live workflow updates

For a single-instance self-hosted deployment, configure an organization webhook
at `https://<observer-host>/api/github/webhook`, with a JSON payload, a secret
matching `GITHUB_WEBHOOK_SECRET`, and the `Workflow runs` and `Workflow jobs`
events enabled. Observer validates `X-Hub-Signature-256` before accepting a
delivery.

Accepted deliveries are sent to open dashboards through
`GET /api/live-events` using Server-Sent Events. The affected browser then
reloads only the changed repository's projection without polling or a full page
reload. Reverse proxies must not buffer this endpoint; the response includes
`X-Accel-Buffering: no` for Nginx-compatible proxies.

Before publishing a valid event, the webhook invalidates the `github-api` cache
tag and the three dashboard paths. An ordinary browser reload therefore sees
fresh GitHub data even when no SSE client is connected.

The event hub is in-memory by design. It is appropriate for one application
instance; use a shared pub/sub broker before scaling horizontally.
