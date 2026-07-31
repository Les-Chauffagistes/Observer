import type { PipelineOverview, PipelineStatus } from "@/lib/pipelines/types";
import { summarizeOverview } from "@/lib/pipelines/summary";
import { formatRelativeTime } from "@/lib/format/time";
import { STATUS_PRESENTATION } from "@/components/statusPresentation";
import { RepoPipelineCard } from "@/components/RepoPipelineCard";
import styles from "./PipelineDashboard.module.css";

interface PipelineDashboardProps {
  readonly overview: PipelineOverview;
}

/** Status counts worth surfacing in the summary bar, in display order. */
const SUMMARY_STATUSES: readonly PipelineStatus[] = [
  "failure",
  "action_required",
  "running",
  "queued",
  "success",
];

/** Top-level dashboard: summary bar plus a grid of repository cards. */
export function PipelineDashboard({ overview }: PipelineDashboardProps) {
  const summary = summarizeOverview(overview);

  // When every repository shares one owner, show it once here and drop the
  // redundant prefix from each card.
  const owners = new Set(
    overview.repositories.map((repo) => repo.repo.owner.toLowerCase()),
  );
  const commonOwner =
    owners.size === 1 ? overview.repositories[0]?.repo.owner ?? null : null;

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            CI/CD Observer
            {commonOwner && <span className={styles.org}>{commonOwner}</span>}
          </h1>
          <p className={styles.subtitle}>
            {summary.totalRepos} repositor
            {summary.totalRepos === 1 ? "y" : "ies"} · updated{" "}
            {formatRelativeTime(overview.generatedAt)}
          </p>
        </div>
        <ul className={styles.summary}>
          {SUMMARY_STATUSES.map((status) => (
            <li key={status} className={styles.summaryItem}>
              <span
                className={styles.summaryDot}
                style={{
                  backgroundColor: `var(${STATUS_PRESENTATION[status].colorVar})`,
                }}
              />
              <span className={styles.summaryCount}>
                {summary.byStatus[status]}
              </span>
              <span className={styles.summaryLabel}>
                {STATUS_PRESENTATION[status].label}
              </span>
            </li>
          ))}
        </ul>
      </header>

      {overview.repositories.length === 0 ? (
        <p className={styles.empty}>No repositories matched the configuration.</p>
      ) : (
        <div className={styles.grid}>
          {overview.repositories.map((repo) => (
            <RepoPipelineCard
              key={`${repo.repo.owner}/${repo.repo.name}`}
              data={repo}
              showOwner={commonOwner === null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
