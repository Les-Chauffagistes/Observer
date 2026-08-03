import { promises as fs } from "node:fs";
import path from "node:path";

import { ConfigError, resolveRepoEntry } from "@/lib/config";
import type { RepoRef } from "@/lib/github/types";

/** A single folder: a named set of repositories to display together. */
export interface RepoGroupConfig {
  readonly name: string;
  readonly repos: readonly RepoRef[];
}

/**
 * One deployment environment tracked for the pinned repository: a human label
 * (e.g. `Production`) paired with the branch whose latest pipeline reflects that
 * environment's state (e.g. `main`).
 */
export interface EnvironmentConfig {
  readonly label: string;
  readonly branch: string;
}

/**
 * The single **pinned** repository, shown above every folder with its
 * per-environment pipeline state highlighted side by side. Meant for a repo
 * that does not fit the normal folders — typically a GitOps/deployment repo.
 */
export interface PinnedRepoConfig {
  readonly repo: RepoRef;
  readonly environments: readonly EnvironmentConfig[];
}

/**
 * Default environments for a pinned repository when none are configured:
 * `develop` → Staging and `main` → Production, in promotion order.
 */
export const DEFAULT_PINNED_ENVIRONMENTS: readonly EnvironmentConfig[] = [
  { label: "Staging", branch: "develop" },
  { label: "Production", branch: "main" },
];

/** Resolved contents of `observer.config.json`. */
export interface GroupsConfig {
  readonly groups: readonly RepoGroupConfig[];
  /**
   * Whether repositories not listed in any group are shown (in an "Other"
   * folder). When `false`, they are hidden entirely — the way to filter out
   * repositories that are not relevant.
   */
  readonly includeUngrouped: boolean;
  /**
   * A single repository pinned at the top of the dashboard with its
   * per-environment pipeline state highlighted, or `null` when unset.
   */
  readonly pinned: PinnedRepoConfig | null;
}

const CONFIG_FILENAME = "observer.config.json";

function assertObject(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConfigError(`${context} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function parseGroup(
  raw: unknown,
  index: number,
  defaultOwner: string | null,
): RepoGroupConfig {
  const context = `${CONFIG_FILENAME} groups[${index}]`;
  const group = assertObject(raw, context);

  if (typeof group.name !== "string" || group.name.trim() === "") {
    throw new ConfigError(`${context}.name must be a non-empty string.`);
  }
  if (!Array.isArray(group.repos)) {
    throw new ConfigError(`${context}.repos must be an array.`);
  }

  const repos = group.repos.map((entry, repoIndex) => {
    if (typeof entry !== "string") {
      throw new ConfigError(
        `${context}.repos[${repoIndex}] must be a string ("repo" or "owner/repo").`,
      );
    }
    return resolveRepoEntry(entry.trim(), defaultOwner, `${context}.repos`);
  });

  return { name: group.name.trim(), repos };
}

function parseEnvironment(
  raw: unknown,
  index: number,
): EnvironmentConfig {
  const context = `${CONFIG_FILENAME} pinned.environments[${index}]`;
  const env = assertObject(raw, context);

  if (typeof env.label !== "string" || env.label.trim() === "") {
    throw new ConfigError(`${context}.label must be a non-empty string.`);
  }
  if (typeof env.branch !== "string" || env.branch.trim() === "") {
    throw new ConfigError(`${context}.branch must be a non-empty string.`);
  }

  return { label: env.label.trim(), branch: env.branch.trim() };
}

/**
 * Parse the optional `pinned` entry. Accepts either a bare string
 * (`"owner/repo"` / `"repo"`, using the default environments) or an object with
 * a `repo` and an optional `environments` array.
 */
function parsePinned(
  raw: unknown,
  defaultOwner: string | null,
): PinnedRepoConfig {
  const context = `${CONFIG_FILENAME} pinned`;

  if (typeof raw === "string") {
    return {
      repo: resolveRepoEntry(raw.trim(), defaultOwner, context),
      environments: DEFAULT_PINNED_ENVIRONMENTS,
    };
  }

  const pinned = assertObject(raw, context);

  if (typeof pinned.repo !== "string" || pinned.repo.trim() === "") {
    throw new ConfigError(
      `${context}.repo must be a non-empty string ("repo" or "owner/repo").`,
    );
  }
  const repo = resolveRepoEntry(pinned.repo.trim(), defaultOwner, `${context}.repo`);

  if (pinned.environments === undefined) {
    return { repo, environments: DEFAULT_PINNED_ENVIRONMENTS };
  }
  if (!Array.isArray(pinned.environments)) {
    throw new ConfigError(`${context}.environments must be an array.`);
  }
  if (pinned.environments.length === 0) {
    throw new ConfigError(
      `${context}.environments must list at least one environment.`,
    );
  }

  return {
    repo,
    environments: pinned.environments.map((env, index) =>
      parseEnvironment(env, index),
    ),
  };
}

function parseGroupsConfig(
  raw: unknown,
  defaultOwner: string | null,
): GroupsConfig {
  const config = assertObject(raw, CONFIG_FILENAME);

  if (!Array.isArray(config.groups)) {
    throw new ConfigError(`${CONFIG_FILENAME} must define a "groups" array.`);
  }
  if (
    config.includeUngrouped !== undefined &&
    typeof config.includeUngrouped !== "boolean"
  ) {
    throw new ConfigError(
      `${CONFIG_FILENAME} "includeUngrouped" must be a boolean.`,
    );
  }

  return {
    groups: config.groups.map((group, index) =>
      parseGroup(group, index, defaultOwner),
    ),
    includeUngrouped: (config.includeUngrouped as boolean | undefined) ?? true,
    pinned:
      config.pinned === undefined
        ? null
        : parsePinned(config.pinned, defaultOwner),
  };
}

/**
 * Load `observer.config.json` from the project root, if present.
 *
 * The file is optional: when it is absent the dashboard falls back to a single
 * flat view. Bare repository names are resolved against `defaultOwner` (the
 * configured organisation).
 *
 * @returns the parsed configuration, or `null` when no file exists.
 * @throws {ConfigError} when the file exists but is invalid.
 */
export async function loadGroupsConfig(
  defaultOwner: string | null,
  cwd: string = process.cwd(),
): Promise<GroupsConfig | null> {
  const filePath = path.join(cwd, CONFIG_FILENAME);

  let contents: string;
  try {
    contents = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new ConfigError(`Could not read ${CONFIG_FILENAME}: ${String(error)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new ConfigError(`${CONFIG_FILENAME} is not valid JSON: ${String(error)}`);
  }

  return parseGroupsConfig(parsed, defaultOwner);
}

/** Every repository referenced across all groups. */
export function groupRepoRefs(config: GroupsConfig): RepoRef[] {
  return config.groups.flatMap((group) => [...group.repos]);
}
