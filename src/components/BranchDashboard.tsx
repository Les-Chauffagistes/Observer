"use client";

import { useCallback, useState } from "react";
import { withUnmergedBranches } from "@/lib/pipelines/byBranch";
import type { PipelineGroup } from "@/lib/pipelines/grouping";
import { summarizeBranches } from "@/lib/pipelines/summary";
import type { BranchOverview, RepoBranchPipelines } from "@/lib/pipelines/types";
import { repoRefKey } from "@/lib/github/repo";
import { RelativeTime } from "@/components/RelativeTime";
import { useLiveRepositoryUpdates } from "@/components/useLiveRepositoryUpdates";
import { BranchGrid } from "@/components/BranchGrid";
import { BranchGroupSection } from "@/components/BranchGroupSection";
import { DashboardHeader } from "@/components/DashboardHeader";
import styles from "./PipelineDashboard.module.css";

interface BranchDashboardProps {
  readonly overview: BranchOverview;
  readonly groups: readonly PipelineGroup<RepoBranchPipelines>[];
}

/**
 * A single implicit group (no `observer.config.yml`) is rendered as a plain
 * grid; anything else is rendered as collapsible folders.
 */
function isFlat(
  groups: readonly PipelineGroup<RepoBranchPipelines>[],
): boolean {
  return groups.length <= 1 && (groups[0]?.name ?? null) === null;
}

/**
 * Branch-oriented dashboard: per repository, the branches not yet merged into
 * an integration branch and each branch's pipeline runs. Complements the
 * repository- and pipeline-oriented views, surfacing feature-branch results
 * that the latest default-branch run would otherwise mask.
 */
export function BranchDashboard({ overview, groups }: BranchDashboardProps) {
  const [liveGroups, setLiveGroups] = useState(groups);
  const [liveOverview, setLiveOverview] = useState(overview);
  const handlesRepository = useCallback(
    (owner: string, repository: string) =>
      liveGroups.some((group) =>
        group.repositories.some(
          (item) => repoRefKey(item.repo) === `${owner}/${repository}`.toLowerCase(),
        ),
      ),
    [liveGroups],
  );
  const updateRepository = useCallback((owner: string, repository: string) => {
    void fetch(
      `/api/live/repository?owner=${encodeURIComponent(owner)}&repository=${encodeURIComponent(repository)}&projection=branches`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(`Live update failed (${response.status}).`);
        return response.json() as Promise<{
          repository: RepoBranchPipelines;
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
        setLiveOverview((current) => ({ ...current, generatedAt: update.generatedAt }));
      })
      .catch((error: unknown) => console.error("Could not apply live CI update.", error));
  }, []);
  useLiveRepositoryUpdates(handlesRepository, updateRepository);

  const displayedGroups = liveGroups.map((group) => ({
    ...group,
    repositories: withUnmergedBranches(group.repositories),
  }));
  const visibleRepositories = displayedGroups.flatMap((group) => [
    ...group.repositories,
  ]);
  const summary = summarizeBranches(visibleRepositories);
  const branchCount = summary.totalRepos;

  const owners = new Set(
    visibleRepositories.map((repo) => repo.repo.owner.toLowerCase()),
  );
  const commonOwner =
    owners.size === 1 ? visibleRepositories[0]?.repo.owner ?? null : null;
  const showOwner = commonOwner === null;

  return (
    <div className={styles.dashboard}>
      <DashboardHeader
        activeView="branches"
        organization={commonOwner}
        summary={summary}
        subtitle={
          <>
            {branchCount} unmerged branch{branchCount === 1 ? "" : "es"} ·
            updated <RelativeTime dateTime={liveOverview.generatedAt} />
          </>
        }
      />

      {visibleRepositories.length === 0 ? (
        <p className={styles.empty}>
          No unmerged branches across the observed repositories.
        </p>
      ) : isFlat(displayedGroups) ? (
        <BranchGrid
          repositories={visibleRepositories}
          showOwner={showOwner}
        />
      ) : (
        <div className={styles.folders}>
          {displayedGroups.map((group) => (
            <BranchGroupSection
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
