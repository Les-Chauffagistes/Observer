import type { GroupsConfig } from "@/lib/config/groups";
import { repoRefKey } from "@/lib/github/repo";
import type { RepoRef } from "@/lib/github/types";
import type { RepoPipelines } from "@/lib/pipelines/types";

/** Folder name used for organisation repositories not listed in any group. */
export const UNGROUPED_LABEL = "Other";

/**
 * A folder in the dashboard: a named set of repositories. A `name` of `null`
 * denotes the implicit "everything" group used when no configuration exists —
 * the dashboard renders it as a plain grid without folder chrome.
 *
 * Generic over the per-repository payload so the same folder logic serves both
 * the repository-oriented ({@link RepoPipelines}) and branch-oriented views.
 */
export interface PipelineGroup<T extends { readonly repo: RepoRef } = RepoPipelines> {
  readonly name: string | null;
  readonly repositories: readonly T[];
  /** Whether the folder is expanded by default in the UI. */
  readonly defaultOpen: boolean;
}

/**
 * Partition repositories into folders according to `config`.
 *
 * - Without a config, returns a single implicit group with every repository.
 * - With a config, returns one folder per configured group (in order),
 *   followed by an "Other" folder for ungrouped repositories when
 *   {@link GroupsConfig.includeUngrouped} is enabled.
 *
 * A configured repository that was not fetched is simply omitted from its
 * folder; a repository is never shown in more than one folder.
 */
export function groupRepositories<T extends { readonly repo: RepoRef }>(
  repositories: readonly T[],
  config: GroupsConfig | null,
): PipelineGroup<T>[] {
  if (!config) {
    return [{ name: null, repositories, defaultOpen: true }];
  }

  const byKey = new Map<string, T>();
  for (const repo of repositories) {
    byKey.set(repoRefKey(repo.repo), repo);
  }

  const assigned = new Set<string>();
  const groups: PipelineGroup<T>[] = config.groups.map((group) => {
    const members: T[] = [];
    for (const ref of group.repos) {
      const key = repoRefKey(ref);
      const found = byKey.get(key);
      if (found && !assigned.has(key)) {
        members.push(found);
        assigned.add(key);
      }
    }
    return { name: group.name, repositories: members, defaultOpen: true };
  });

  if (config.includeUngrouped) {
    const ungrouped = repositories.filter(
      (repo) => !assigned.has(repoRefKey(repo.repo)),
    );
    if (ungrouped.length > 0) {
      groups.push({
        name: UNGROUPED_LABEL,
        repositories: ungrouped,
        defaultOpen: false,
      });
    }
  }

  return groups;
}
