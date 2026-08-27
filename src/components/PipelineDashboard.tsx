"use client";

import { useCallback, useState } from "react";
import type { PipelineGroup } from "@/lib/pipelines/grouping";
import { summarizeRepositories } from "@/lib/pipelines/summary";
import type {
  PinnedRepoPipelines,
  PipelineOverview,
} from "@/lib/pipelines/types";
import { repoRefKey } from "@/lib/github/repo";
import { RelativeTime } from "@/components/RelativeTime";
import { useLiveRepositoryUpdates } from "@/components/useLiveRepositoryUpdates";
import { RepoGrid } from "@/components/RepoGrid";
import { RepoGroupSection } from "@/components/RepoGroupSection";
import { PinnedRepoCard } from "@/components/PinnedRepoCard";
import { DashboardHeader } from "@/components/DashboardHeader";
import styles from "./PipelineDashboard.module.css";

interface PipelineDashboardProps {
  readonly overview: PipelineOverview;
  readonly groups: readonly PipelineGroup[];
  /** The pinned repository shown above the folders, if configured. */
  readonly pinned?: PinnedRepoPipelines | null;
}

/**
 * A single implicit group (no `observer.config.yml`) is rendered as a plain
 * grid; anything else is rendered as collapsible folders.
 */
function isFlat(groups: readonly PipelineGroup[]): boolean {
  return groups.length <= 1 && (groups[0]?.name ?? null) === null;
}

/** Top-level dashboard: summary bar plus repository folders (or a flat grid). */
export function PipelineDashboard({
  overview,
  groups,
  pinned = null,
}: PipelineDashboardProps) {
  const [liveGroups, setLiveGroups] = useState(groups);
  const [livePinned, setLivePinned] = useState(pinned);
  const [liveOverview, setLiveOverview] = useState(overview);
  const handlesRepository = useCallback(
    (owner: string, repository: string) =>
      liveGroups.some((group) =>
        group.repositories.some(
          (item) => repoRefKey(item.repo) === `${owner}/${repository}`.toLowerCase(),
        ),
      ) ||
      (livePinned !== null &&
        repoRefKey(livePinned.repo) === `${owner}/${repository}`.toLowerCase()),
    [liveGroups, livePinned],
  );
  const updateRepository = useCallback((owner: string, repository: string) => {
    void fetch(
      `/api/live/repository?owner=${encodeURIComponent(owner)}&repository=${encodeURIComponent(repository)}&projection=pipelines`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(`Live update failed (${response.status}).`);
        return response.json() as Promise<{
          repository: PipelineGroup["repositories"][number];
          pinned: PinnedRepoPipelines | null;
          generatedAt: string;
        }>;
      })
      .then((update) => {
        const key = repoRefKey(update.repository.repo);
        setLiveGroups((current) =>
          current.map((group) => ({
            ...group,
            repositories: group.repositories.map((item) =>
              repoRefKey(item.repo) === key ? update.repository : item,
            ),
          })),
        );
        if (update.pinned) setLivePinned(update.pinned);
        setLiveOverview((current) => ({ ...current, generatedAt: update.generatedAt }));
      })
      .catch((error: unknown) => console.error("Could not apply live CI update.", error));
  }, []);
  useLiveRepositoryUpdates(handlesRepository, updateRepository);

  // Summaries reflect only the repositories that are actually shown — hidden
  // (ungrouped) repositories must not skew the header counts.
  const visibleRepositories = liveGroups.flatMap((group) => [
    ...group.repositories,
  ]);
  const summary = summarizeRepositories(visibleRepositories);

  // When every visible repository shares one owner, show it once here and drop
  // the redundant prefix from each card.
  const owners = new Set(
    visibleRepositories.map((repo) => repo.repo.owner.toLowerCase()),
  );
  const commonOwner =
    owners.size === 1 ? visibleRepositories[0]?.repo.owner ?? null : null;
  const showOwner = commonOwner === null;

  return (
    <div className={styles.dashboard}>
      <DashboardHeader
        activeView="repositories"
        organization={commonOwner}
        summary={summary}
        subtitle={
          <>
            {summary.totalRepos} repositor
            {summary.totalRepos === 1 ? "y" : "ies"} · updated{" "}
            <RelativeTime dateTime={liveOverview.generatedAt} />
          </>
        }
      />

      {livePinned && <PinnedRepoCard data={livePinned} />}

      {visibleRepositories.length === 0 ? (
        <p className={styles.empty}>No repositories matched the configuration.</p>
      ) : isFlat(liveGroups) ? (
        <RepoGrid repositories={visibleRepositories} showOwner={showOwner} />
      ) : (
        <div className={styles.folders}>
          {liveGroups.map((group) => (
            <RepoGroupSection
              key={group.name}
              group={{ ...group, name: group.name as string }}
              showOwner={showOwner}
            />
          ))}
        </div>
      )}
    </div>
  );
}
