import type { Pipeline, PipelineOverview } from "@/lib/pipelines";
import { summarizePipelines } from "@/lib/pipelines";
import { formatRelativeTime } from "@/lib/format/time";
import { PipelineSection } from "@/components/PipelineSection";
import { DashboardHeader } from "@/components/DashboardHeader";
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
      <DashboardHeader
        activeView="pipelines"
        organization={commonOwner}
        summary={summary}
        subtitle={
          <>
            {pipelines.length} pipeline{pipelines.length === 1 ? "" : "s"} ·
            updated {formatRelativeTime(overview.generatedAt)}
          </>
        }
      />

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
