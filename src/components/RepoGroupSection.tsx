import type { PipelineGroup } from "@/lib/pipelines/grouping";
import { summarizeRepositories } from "@/lib/pipelines/summary";
import { RepoGrid } from "@/components/RepoGrid";
import { StatusSummary } from "@/components/StatusSummary";
import styles from "./RepoGroupSection.module.css";

interface RepoGroupSectionProps {
  /** A named folder (implicit groups are rendered directly, not here). */
  readonly group: PipelineGroup & { readonly name: string };
  readonly showOwner: boolean;
}

/**
 * A collapsible folder of repositories. Uses the native `<details>` element so
 * expand/collapse works without any client-side JavaScript.
 */
export function RepoGroupSection({ group, showOwner }: RepoGroupSectionProps) {
  const summary = summarizeRepositories(group.repositories);
  const count = group.repositories.length;

  return (
    <details className={styles.folder} open={group.defaultOpen}>
      <summary className={styles.summary}>
        <span className={styles.heading}>
          <span className={styles.chevron} aria-hidden>
            ▸
          </span>
          <span className={styles.name}>{group.name}</span>
          <span className={styles.count}>{count}</span>
        </span>
        <StatusSummary summary={summary} hideZeros />
      </summary>

      {count === 0 ? (
        <p className={styles.empty}>No repositories in this folder.</p>
      ) : (
        <div className={styles.body}>
          <RepoGrid repositories={group.repositories} showOwner={showOwner} />
        </div>
      )}
    </details>
  );
}
