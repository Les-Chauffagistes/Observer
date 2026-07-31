import { GitHubApiError } from "@/lib/github/errors";
import type {
  GitHubRepo,
  GitHubWorkflowRun,
  GitHubWorkflowRunsResponse,
  RepoRef,
} from "@/lib/github/types";

const GITHUB_API_VERSION = "2022-11-28";

/** Options accepted when constructing a {@link GitHubClient}. */
export interface GitHubClientOptions {
  readonly token: string;
  readonly baseUrl: string;
  /** Cache lifetime (seconds) applied to GET requests via Next's fetch. */
  readonly revalidateSeconds: number;
}

interface RequestOptions {
  readonly searchParams?: Record<string, string | number>;
}

/**
 * Thin, typed wrapper over the GitHub REST API.
 *
 * The client owns HTTP concerns only (auth headers, query building, error
 * mapping, caching). It intentionally returns raw GitHub payloads; translation
 * to the application's domain model lives in the pipelines layer.
 */
export class GitHubClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly revalidateSeconds: number;

  constructor(options: GitHubClientOptions) {
    this.token = options.token;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.revalidateSeconds = options.revalidateSeconds;
  }

  /**
   * List repositories belonging to an organisation, following pagination.
   * Archived and disabled repositories are included; filtering is a concern of
   * higher layers.
   */
  async listOrgRepos(org: string): Promise<GitHubRepo[]> {
    const perPage = 100;
    const repos: GitHubRepo[] = [];

    for (let page = 1; ; page += 1) {
      const batch = await this.get<GitHubRepo[]>(`/orgs/${org}/repos`, {
        searchParams: { per_page: perPage, page, sort: "full_name" },
      });
      repos.push(...batch);
      if (batch.length < perPage) break;
    }

    return repos;
  }

  /**
   * List the most recent workflow runs for a repository.
   *
   * @param perPage number of runs to request (GitHub returns newest first).
   */
  async listWorkflowRuns(
    repo: RepoRef,
    perPage = 30,
  ): Promise<GitHubWorkflowRun[]> {
    const response = await this.get<GitHubWorkflowRunsResponse>(
      `/repos/${repo.owner}/${repo.name}/actions/runs`,
      { searchParams: { per_page: perPage } },
    );
    return [...response.workflow_runs];
  }

  private async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(options.searchParams ?? {})) {
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      next: { revalidate: this.revalidateSeconds },
    });

    if (!response.ok) {
      throw new GitHubApiError(
        response.status,
        url.toString(),
        await describeError(response),
      );
    }

    return (await response.json()) as T;
  }
}

/** Build a human-readable message from a failed GitHub response. */
async function describeError(response: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await response.json()) as { message?: string };
    detail = body.message ? `: ${body.message}` : "";
  } catch {
    // Body was not JSON; the status line is enough.
  }
  return `GitHub API request failed (${response.status} ${response.statusText})${detail}`;
}
