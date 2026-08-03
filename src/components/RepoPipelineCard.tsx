import type { PipelineRun, RepoPipelines } from "@/lib/pipelines/types";
import { formatRelativeTime } from "@/lib/format/time";
import { StatusBadge } from "@/components/StatusBadge";
import styles from "./RepoPipelineCard.module.css";

interface RepoPipelineCardProps {
  readonly data: RepoPipelines;
  /**
   * Whether to show the owner prefix. Hidden when every observed repository
   * shares the same owner (it is then shown once in the dashboard header).
   */
  readonly showOwner?: boolean;
}

/** Card summarising a single repository's latest pipeline runs. */
export function RepoPipelineCard({
  data,
  showOwner = true,
}: RepoPipelineCardProps) {
  const { repo, runs, overallStatus, error } = data;
  const fullName = `${repo.owner}/${repo.name}`;
  const repoUrl = `https://github.com/${fullName}`;

  return (
    <article className={styles.card} data-status={overallStatus ?? undefined}>
      <header className={styles.header}>
        <a
          className={styles.title}
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={fullName}
        >
          {showOwner && <span className={styles.owner}>{repo.owner}/</span>}
          <span className={styles.name}>{repo.name}</span>
        </a>
        {overallStatus && <StatusBadge status={overallStatus} />}
      </header>

      <CardBody error={error} runs={runs} />
    </article>
  );
}

/** Body of a repository card: an error, an empty state, or the list of runs. */
function CardBody({
  error,
  runs,
}: {
  readonly error: string | null;
  readonly runs: readonly PipelineRun[];
}) {
  if (error) {
    return <p className={styles.error}>{error}</p>;
  }
  if (runs.length === 0) {
    return <p className={styles.empty}>No workflow runs found.</p>;
  }
  return (
    <ul className={styles.runs}>
      {runs.map((run) => (
        <RunRow key={run.id} run={run} />
      ))}
    </ul>
  );
}

/** A single workflow run row inside a repository card. */
function RunRow({ run }: { readonly run: PipelineRun }) {
  return (
    <li className={styles.run}>
      <StatusBadge status={run.status} compact />
      <a
        className={styles.runName}
        href={run.url}
        target="_blank"
        rel="noopener noreferrer"
        title={run.title}
      >
        {run.workflowName}
      </a>
      <span className={styles.meta}>
        {run.branch && <span className={styles.branch}>{run.branch}</span>}
        <span>{formatRelativeTime(run.updatedAt)}</span>
      </span>
    </li>
  );
}
