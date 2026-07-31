import type { RepoRef } from "@/lib/github/types";

/**
 * Application configuration, resolved once from the environment.
 *
 * Two ways to select the repositories to observe are supported and can be
 * combined:
 *  - an explicit list of `owner/repo` entries (`GITHUB_REPOS`)
 *  - a whole organisation whose repositories are discovered automatically
 *    (`GITHUB_ORG`)
 */
export interface AppConfig {
  /** GitHub API base URL (e.g. `https://api.github.com`). */
  readonly apiBaseUrl: string;
  /** Personal access token (or app token) used to authenticate. */
  readonly token: string;
  /** Organisation whose repositories are auto-discovered, if any. */
  readonly org: string | null;
  /** Explicitly configured repositories, always observed. */
  readonly repos: readonly RepoRef[];
  /** Cache lifetime, in seconds, applied to GitHub responses. */
  readonly revalidateSeconds: number;
}

/** Raised when the environment does not provide a usable configuration. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const DEFAULT_API_BASE_URL = "https://api.github.com";
const DEFAULT_REVALIDATE_SECONDS = 30;

/**
/**
 * Resolve a single repository entry, either a full `owner/repo` or a bare
 * `repo` name that falls back to `defaultOwner`.
 *
 * @param source label used in error messages (e.g. `GITHUB_REPOS`).
 * @throws {ConfigError} when the entry is malformed or lacks a resolvable owner.
 */
export function resolveRepoEntry(
  entry: string,
  defaultOwner: string | null,
  source: string,
): RepoRef {
  const parts = entry.split("/");

  if (parts.length === 1) {
    const [name] = parts;
    if (!name) {
      throw new ConfigError(`Empty repository entry in ${source}.`);
    }
    if (!defaultOwner) {
      throw new ConfigError(
        `Repository "${entry}" in ${source} has no owner. Set GITHUB_ORG or use "owner/repo".`,
      );
    }
    return { owner: defaultOwner, name };
  }

  const [owner, name, ...rest] = parts;
  if (!owner || !name || rest.length > 0) {
    throw new ConfigError(
      `Invalid repository "${entry}" in ${source}. Expected "owner/repo" or "repo".`,
    );
  }
  return { owner, name };
}

/**
 * Parse a comma/whitespace separated list of repository entries (see
 * {@link resolveRepoEntry}).
 */
function parseRepoList(
  raw: string | undefined,
  defaultOwner: string | null,
): RepoRef[] {
  if (!raw) return [];

  return raw
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => resolveRepoEntry(entry, defaultOwner, "GITHUB_REPOS"));
}

function parseRevalidate(raw: string | undefined): number {
  if (!raw) return DEFAULT_REVALIDATE_SECONDS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new ConfigError(
      `Invalid GITHUB_REVALIDATE_SECONDS "${raw}". Expected a non-negative number.`,
    );
  }
  return Math.floor(value);
}

/**
 * Load and validate the application configuration from `process.env`.
 *
 * Note: this does not enforce that a repository source exists — repositories may
 * also come from `observer.config.json` groups, so that check lives in the
 * composition root (`loadOverview`).
 *
 * @throws {ConfigError} when the token is missing or a value is malformed.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const token = env.GITHUB_TOKEN?.trim();
  if (!token) {
    throw new ConfigError(
      "GITHUB_TOKEN is not set. Provide a GitHub token with `repo`/`actions:read` scope.",
    );
  }

  const org = env.GITHUB_ORG?.trim() || null;
  const repos = parseRepoList(env.GITHUB_REPOS, org);

  return {
    apiBaseUrl: env.GITHUB_API_URL?.trim() || DEFAULT_API_BASE_URL,
    token,
    org,
    repos,
    revalidateSeconds: parseRevalidate(env.GITHUB_REVALIDATE_SECONDS),
  };
}
