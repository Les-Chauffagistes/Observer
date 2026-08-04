import type {
  EnvironmentPipelines,
  PinnedRepoPipelines,
} from "@/lib/pipelines/types";
import { repoFullName } from "@/lib/github/repo";
import { RelativeTime } from "@/components/RelativeTime";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_PRESENTATION } from "@/components/statusPresentation";
import styles from "./PinnedRepoCard.module.css";

interface PinnedRepoCardProps {
  readonly data: PinnedRepoPipelines;
}

/**
 * Prominent card for the pinned repository (e.g. GitOps), shown above every
 * folder. Highlights each configured environment's latest pipeline result side
 * by side — typically `develop` (staging) and `main` (production).
 */
export function PinnedRepoCard({ data }: PinnedRepoCardProps) {
  const { repo, environments, error } = data;
  const fullName = repoFullName(repo);
  const repoUrl = `https://github.com/${fullName}`;

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <a
          className={styles.title}
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={fullName}
        >
          <span className={styles.owner}>{repo.owner}/</span>
          <span className={styles.name}>{repo.name}</span>
        </a>
        <span className={styles.deploymentLabel}>Deployment overview</span>
      </header>

      {error ? (
        <p className={styles.error}>{error}</p>
      ) : (
        <div className={styles.environments}>
          {environments.map((environment) => (
            <EnvironmentColumn
              key={environment.label}
              environment={environment}
            />
          ))}
        </div>
      )}
    </article>
  );
}

/** One environment column: label, branch, overall status, and its runs. */
function EnvironmentColumn({
  environment,
}: {
  readonly environment: EnvironmentPipelines;
}) {
  const { label, branch, pipelines } = environment;

  return (
    <section className={styles.environment}>
      <header className={styles.envHeader}>
        <div className={styles.envHeading}>
          <span className={styles.envLabel}>{label}</span>
          <span className={styles.envBranch}>{branch}</span>
        </div>
        {pipelines?.overallStatus && (
          <StatusBadge status={pipelines.overallStatus} />
        )}
      </header>

      {pipelines ? (
        <ul className={styles.runs}>
          {pipelines.runs.map((run) => (
            <li key={run.id} className={styles.run}>
              <div className={styles.runLine}>
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
                  <RelativeTime dateTime={run.updatedAt} />
                </span>
              </div>
              {run.jobs && run.jobs.length > 0 && (
                <ul className={styles.jobs}>
                  {run.jobs.map((job) => (
                    <li key={job.id} className={styles.job}>
                      <StatusBadge status={job.status} compact />
                      {job.url ? (
                        <a
                          className={styles.jobName}
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={job.name}
                        >
                          {job.name}
                        </a>
                      ) : (
                        <span className={styles.jobName} title={job.name}>
                          {job.name}
                        </span>
                      )}
                      <span className={styles.jobStatus}>
                        {STATUS_PRESENTATION[job.status].label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No runs on {branch}.</p>
      )}
    </section>
  );
}
