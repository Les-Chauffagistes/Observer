import type { PipelineGroup, RepoBranchPipelines } from "@/lib/pipelines";
import { summarizeBranches } from "@/lib/pipelines";
import { BranchGrid } from "@/components/BranchGrid";
import { StatusSummary } from "@/components/StatusSummary";
import styles from "./RepoGroupSection.module.css";

interface BranchGroupSectionProps {
  /** A named folder (implicit groups are rendered directly, not here). */
  readonly group: PipelineGroup<RepoBranchPipelines> & {
    readonly name: string;
  };
  readonly showOwner: boolean;
}

/**
 * A collapsible folder of repositories in the branch-oriented view. Uses the
 * native `<details>` element so expand/collapse needs no client-side JS.
 */
export function BranchGroupSection({
  group,
  showOwner,
}: BranchGroupSectionProps) {
  const summary = summarizeBranches(group.repositories);
  const branchCount = summary.totalRepos;

  return (
    <details className={styles.folder} open={group.defaultOpen}>
      <summary className={styles.summary}>
        <span className={styles.heading}>
          <span className={styles.chevron} aria-hidden>
            ▸
          </span>
          <span className={styles.name}>{group.name}</span>
          <span className={styles.count}>{branchCount}</span>
        </span>
        <StatusSummary summary={summary} hideZeros />
      </summary>

      {group.repositories.length === 0 ? (
        <p className={styles.empty}>No repositories in this folder.</p>
      ) : (
        <div className={styles.body}>
          <BranchGrid repositories={group.repositories} showOwner={showOwner} />
        </div>
      )}
    </details>
  );
}
