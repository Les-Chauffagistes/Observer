import type { PipelineGroup, PipelineOverview } from "@/lib/pipelines";
import { summarizeRepositories } from "@/lib/pipelines";
import type { PinnedRepoPipelines } from "@/lib/pipelines/types";
import { formatRelativeTime } from "@/lib/format/time";
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
 * A single implicit group (no `observer.config.json`) is rendered as a plain
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
  // Summaries reflect only the repositories that are actually shown — hidden
  // (ungrouped) repositories must not skew the header counts.
  const visibleRepositories = groups.flatMap((group) => [
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
            {formatRelativeTime(overview.generatedAt)}
          </>
        }
      />

      {pinned && <PinnedRepoCard data={pinned} />}

      {visibleRepositories.length === 0 ? (
        <p className={styles.empty}>No repositories matched the configuration.</p>
      ) : isFlat(groups) ? (
        <RepoGrid repositories={visibleRepositories} showOwner={showOwner} />
      ) : (
        <div className={styles.folders}>
          {groups.map((group) => (
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
