import type { RepoRef } from "@/lib/github/types";

/** `owner/name`, preserving original casing (for display and API paths). */
export function repoFullName(repo: RepoRef): string {
  return `${repo.owner}/${repo.name}`;
}

/** Case-insensitive de-duplication / lookup key for a repository. */
export function repoRefKey(repo: RepoRef): string {
  return repoFullName(repo).toLowerCase();
}
