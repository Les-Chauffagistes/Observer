import type { Pipeline } from "@/lib/pipelines";
import { summarizePipeline } from "@/lib/pipelines";
import { repoFullName } from "@/lib/github/repo";
import { formatRelativeTime } from "@/lib/format/time";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusSummary } from "@/components/StatusSummary";
import styles from "./PipelineSection.module.css";

interface PipelineSectionProps {
  readonly pipeline: Pipeline;
  /** Whether to show the owner prefix on each repository row. */
  readonly showOwner: boolean;
  readonly defaultOpen: boolean;
}

/**
 * A collapsible folder for one pipeline (workflow name), listing every
 * repository that runs it with that repository's latest status. The inverse of
 * {@link RepoPipelineCard}. Uses native `<details>` — no client-side JS.
 */
export function PipelineSection({
  pipeline,
  showOwner,
  defaultOpen,
}: PipelineSectionProps) {
  const summary = summarizePipeline(pipeline);
  const count = pipeline.repositories.length;

  return (
    <details className={styles.folder} open={defaultOpen}>
      <summary className={styles.summary}>
        <span className={styles.heading}>
          <span className={styles.chevron} aria-hidden>
            ▸
          </span>
          {pipeline.overallStatus && (
            <StatusBadge status={pipeline.overallStatus} compact />
          )}
          <span className={styles.name}>{pipeline.name}</span>
          <span className={styles.count}>{count}</span>
        </span>
        <StatusSummary summary={summary} hideZeros />
      </summary>

      {count === 0 ? (
        <p className={styles.empty}>No repositories run this pipeline.</p>
      ) : (
        <ul className={styles.repos}>
          {pipeline.repositories.map(({ repo, run }) => {
            const fullName = repoFullName(repo);
            return (
              <li key={fullName} className={styles.repo}>
                <StatusBadge status={run.status} compact />
                <a
                  className={styles.repoName}
                  href={run.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${fullName} — ${run.title}`}
                >
                  {showOwner && (
                    <span className={styles.owner}>{repo.owner}/</span>
                  )}
                  <span>{repo.name}</span>
                </a>
                <span className={styles.meta}>
                  {run.branch && (
                    <span className={styles.branch}>{run.branch}</span>
                  )}
                  <span>{formatRelativeTime(run.updatedAt)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
