import type {
  BranchPipelines,
  PipelineRun,
  RepoBranchPipelines,
} from "@/lib/pipelines/types";
import { RelativeTime } from "@/components/RelativeTime";
import { StatusBadge } from "@/components/StatusBadge";
import cardStyles from "./RepoPipelineCard.module.css";
import styles from "./RepoBranchCard.module.css";

interface RepoBranchCardProps {
  readonly data: RepoBranchPipelines;
  /**
   * Whether to show the owner prefix. Hidden when every observed repository
   * shares the same owner (it is then shown once in the dashboard header).
   */
  readonly showOwner?: boolean;
}

/** Card listing a repository's unmerged branches and their pipeline runs. */
export function RepoBranchCard({ data, showOwner = true }: RepoBranchCardProps) {
  const { repo, branches, error } = data;
  const fullName = `${repo.owner}/${repo.name}`;
  const repoUrl = `https://github.com/${fullName}`;

  return (
    <article className={cardStyles.card}>
      <header className={cardStyles.header}>
        <a
          className={cardStyles.title}
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={fullName}
        >
          {showOwner && (
            <span className={cardStyles.owner}>{repo.owner}/</span>
          )}
          <span className={cardStyles.name}>{repo.name}</span>
        </a>
        {!error && branches.length > 0 && (
          <span className={styles.count}>
            {branches.length} branch{branches.length === 1 ? "" : "es"}
          </span>
        )}
      </header>

      <CardBody error={error} branches={branches} repoUrl={repoUrl} />
    </article>
  );
}

/** Body of a branch card: an error, an empty state, or the branch list. */
function CardBody({
  error,
  branches,
  repoUrl,
}: {
  readonly error: string | null;
  readonly branches: readonly BranchPipelines[];
  readonly repoUrl: string;
}) {
  if (error) {
    return <p className={cardStyles.error}>{error}</p>;
  }
  if (branches.length === 0) {
    return <p className={cardStyles.empty}>No unmerged branches.</p>;
  }
  return (
    <ul className={styles.branches}>
      {branches.map((branch) => (
        <BranchBlock key={branch.branch} branch={branch} repoUrl={repoUrl} />
      ))}
    </ul>
  );
}

/** One unmerged branch: its name, overall status, and per-workflow runs. */
function BranchBlock({
  branch,
  repoUrl,
}: {
  readonly branch: BranchPipelines;
  readonly repoUrl: string;
}) {
  const branchUrl = `${repoUrl}/tree/${encodeBranch(branch.branch)}`;

  return (
    <li className={styles.branch}>
      <div className={styles.branchHeader}>
        <a
          className={styles.branchName}
          href={branchUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={branch.branch}
        >
          {branch.branch}
        </a>
        {branch.overallStatus && <StatusBadge status={branch.overallStatus} />}
      </div>
      <ul className={cardStyles.runs}>
        {branch.runs.map((run) => (
          <RunRow key={run.id} run={run} />
        ))}
      </ul>
    </li>
  );
}

/** A single workflow run row inside a branch block. */
function RunRow({ run }: { readonly run: PipelineRun }) {
  return (
    <li className={cardStyles.run}>
      <StatusBadge status={run.status} compact />
      <a
        className={cardStyles.runName}
        href={run.url}
        target="_blank"
        rel="noopener noreferrer"
        title={run.title}
      >
        {run.workflowName}
      </a>
      <span className={cardStyles.meta}>
        <RelativeTime dateTime={run.updatedAt} />
      </span>
    </li>
  );
}

/** Encode a branch name for a URL path, preserving `/` separators. */
function encodeBranch(branch: string): string {
  return branch.split("/").map(encodeURIComponent).join("/");
}
