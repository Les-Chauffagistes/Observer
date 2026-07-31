import type { Pipeline, PipelineOverview } from "@/lib/pipelines";
import { summarizePipelines } from "@/lib/pipelines";
import { formatRelativeTime } from "@/lib/format/time";
import { PipelineSection } from "@/components/PipelineSection";
import { StatusSummary } from "@/components/StatusSummary";
import { ViewNav } from "@/components/ViewNav";
import styles from "./PipelineDashboard.module.css";

interface PipelineOrientedDashboardProps {
  readonly overview: PipelineOverview;
  readonly pipelines: readonly Pipeline[];
}

/**
 * Pipeline-oriented dashboard: one collapsible section per pipeline (workflow
 * name), each listing the repositories that run it and their status. The
 * inverse of {@link PipelineDashboard}.
 */
export function PipelineOrientedDashboard({
  overview,
  pipelines,
}: PipelineOrientedDashboardProps) {
  const summary = summarizePipelines(pipelines);

  // When every repository across all pipelines shares one owner, drop the
  // redundant `owner/` prefix from each row and show it once in the header.
  const owners = new Set(
    pipelines.flatMap((pipeline) =>
      pipeline.repositories.map(({ repo }) => repo.owner.toLowerCase()),
    ),
  );
  const firstOwner = pipelines[0]?.repositories[0]?.repo.owner ?? null;
  const commonOwner = owners.size === 1 ? firstOwner : null;
  const showOwner = commonOwner === null;

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            CI/CD Observer
            {commonOwner && <span className={styles.org}>{commonOwner}</span>}
          </h1>
          <p className={styles.subtitle}>
            {pipelines.length} pipeline{pipelines.length === 1 ? "" : "s"} ·
            updated {formatRelativeTime(overview.generatedAt)}
          </p>
        </div>
        <div className={styles.headerAside}>
          <ViewNav active="pipelines" />
          <StatusSummary summary={summary} />
        </div>
      </header>

      {pipelines.length === 0 ? (
        <p className={styles.empty}>
          No pipelines found across the observed repositories.
        </p>
      ) : (
        <div className={styles.folders}>
          {pipelines.map((pipeline) => (
            <PipelineSection
              key={pipeline.name}
              pipeline={pipeline}
              showOwner={showOwner}
              defaultOpen={pipelines.length <= 6}
            />
          ))}
        </div>
      )}
    </div>
  );
}
