/**
 * Error raised when a GitHub API request fails. Carries the HTTP status so
 * callers can react (e.g. distinguish auth/rate-limit failures from a missing
 * repository) without re-parsing the response.
 */
export class GitHubApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string, message: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.url = url;
  }

  /** Authentication or authorization failure. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** The requested resource does not exist (or is not visible to the token). */
  get isNotFound(): boolean {
    return this.status === 404;
  }
}
