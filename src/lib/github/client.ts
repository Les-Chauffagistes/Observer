import { GitHubApiError } from "@/lib/github/errors";
import type {
  GitHubBranch,
  GitHubComparison,
  GitHubRepo,
  GitHubWorkflowJob,
  GitHubWorkflowJobsResponse,
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

  /**
   * List the jobs of a workflow run. Each job has its own status/conclusion, so
   * this reveals detail the run's single top-level status hides — e.g. a
   * `success` run whose deployment job was `skipped`.
   */
  async listWorkflowJobs(
    repo: RepoRef,
    runId: number,
  ): Promise<GitHubWorkflowJob[]> {
    const response = await this.get<GitHubWorkflowJobsResponse>(
      `/repos/${repo.owner}/${repo.name}/actions/runs/${runId}/jobs`,
      { searchParams: { per_page: 100, filter: "latest" } },
    );
    return [...response.jobs];
  }

  /**
   * List a repository's branches, following pagination. Returns every branch;
   * filtering (e.g. dropping integration branches) is a caller concern.
   */
  async listBranches(repo: RepoRef, perPage = 100): Promise<GitHubBranch[]> {
    const branches: GitHubBranch[] = [];

    for (let page = 1; ; page += 1) {
      const batch = await this.get<GitHubBranch[]>(
        `/repos/${repo.owner}/${repo.name}/branches`,
        { searchParams: { per_page: perPage, page } },
      );
      branches.push(...batch);
      if (batch.length < perPage) break;
    }

    return branches;
  }

  /**
   * Compare two branches (`base...head`). The `ahead_by` field reveals whether
   * `head` is fully merged into `base` (see {@link GitHubComparison}). Only the
   * counts are needed, so the commit list is trimmed to one entry.
   */
  async compareBranches(
    repo: RepoRef,
    base: string,
    head: string,
  ): Promise<GitHubComparison> {
    const basehead = `${encodeRef(base)}...${encodeRef(head)}`;
    return this.get<GitHubComparison>(
      `/repos/${repo.owner}/${repo.name}/compare/${basehead}`,
      { searchParams: { per_page: 1 } },
    );
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

/**
 * Percent-encode a git ref for use in a URL path, preserving `/` separators
 * (branch names such as `feature/foo` are valid path segments).
 */
function encodeRef(ref: string): string {
  return ref.split("/").map(encodeURIComponent).join("/");
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
