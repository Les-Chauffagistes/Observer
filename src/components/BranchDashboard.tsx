import type { BranchOverview, PipelineGroup } from "@/lib/pipelines";
import type { RepoBranchPipelines } from "@/lib/pipelines";
import { summarizeBranches } from "@/lib/pipelines";
import { formatRelativeTime } from "@/lib/format/time";
import { BranchGrid } from "@/components/BranchGrid";
import { BranchGroupSection } from "@/components/BranchGroupSection";
import { DashboardHeader } from "@/components/DashboardHeader";
import styles from "./PipelineDashboard.module.css";

interface BranchDashboardProps {
  readonly overview: BranchOverview;
  readonly groups: readonly PipelineGroup<RepoBranchPipelines>[];
}

/**
 * A single implicit group (no `observer.config.json`) is rendered as a plain
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
  const visibleRepositories = groups.flatMap((group) => [
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
            updated {formatRelativeTime(overview.generatedAt)}
          </>
        }
      />

      {visibleRepositories.length === 0 ? (
        <p className={styles.empty}>
          No unmerged branches across the observed repositories.
        </p>
      ) : isFlat(groups) ? (
        <BranchGrid
          repositories={visibleRepositories}
          showOwner={showOwner}
        />
      ) : (
        <div className={styles.folders}>
          {groups.map((group) => (
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
