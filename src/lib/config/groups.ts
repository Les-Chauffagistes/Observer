import { promises as fs } from "node:fs";
import path from "node:path";

import { ConfigError, resolveRepoEntry } from "@/lib/config";
import type { RepoRef } from "@/lib/github/types";

/** A single folder: a named set of repositories to display together. */
export interface RepoGroupConfig {
  readonly name: string;
  readonly repos: readonly RepoRef[];
}

/** Resolved contents of `observer.config.json`. */
export interface GroupsConfig {
  readonly groups: readonly RepoGroupConfig[];
  /**
   * Whether repositories not listed in any group are shown (in an "Other"
   * folder). When `false`, they are hidden entirely — the way to filter out
   * repositories that are not relevant.
   */
  readonly includeUngrouped: boolean;
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
