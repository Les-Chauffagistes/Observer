"use client";

import { useCallback, useState } from "react";
import { groupByPipeline } from "@/lib/pipelines/byPipeline";
import { summarizePipelines } from "@/lib/pipelines/summary";
import type { RepoPipelines } from "@/lib/pipelines/types";
import type { PipelineOverview } from "@/lib/pipelines/types";
import { repoRefKey } from "@/lib/github/repo";
import { RelativeTime } from "@/components/RelativeTime";
import { useLiveRepositoryUpdates } from "@/components/useLiveRepositoryUpdates";
import { PipelineSection } from "@/components/PipelineSection";
import { DashboardHeader } from "@/components/DashboardHeader";
import styles from "./PipelineDashboard.module.css";

interface PipelineOrientedDashboardProps {
  readonly overview: PipelineOverview;
  readonly repositories: readonly RepoPipelines[];
}

/**
 * Pipeline-oriented dashboard: one collapsible section per pipeline (workflow
 * name), each listing the repositories that run it and their status. The
 * inverse of {@link PipelineDashboard}.
 */
export function PipelineOrientedDashboard({
  overview,
  repositories,
}: PipelineOrientedDashboardProps) {
  const [liveRepositories, setLiveRepositories] = useState(repositories);
  const [liveOverview, setLiveOverview] = useState(overview);
  const pipelines = groupByPipeline(liveRepositories);
  const handlesRepository = useCallback(
    (owner: string, repository: string) =>
      liveRepositories.some(
        (item) => repoRefKey(item.repo) === `${owner}/${repository}`.toLowerCase(),
      ),
    [liveRepositories],
  );
  const updateRepository = useCallback((owner: string, repository: string) => {
    void fetch(
      `/api/live/repository?owner=${encodeURIComponent(owner)}&repository=${encodeURIComponent(repository)}&projection=pipelines`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(`Live update failed (${response.status}).`);
        return response.json() as Promise<{
          repository: RepoPipelines;
          generatedAt: string;
        }>;
      })
      .then((update) => {
        const key = repoRefKey(update.repository.repo);
        setLiveRepositories((current) =>
          current.map((item) =>
            repoRefKey(item.repo) === key ? update.repository : item,
          ),
        );
        setLiveOverview((current) => ({ ...current, generatedAt: update.generatedAt }));
      })
      .catch((error: unknown) => console.error("Could not apply live CI update.", error));
  }, []);
  useLiveRepositoryUpdates(handlesRepository, updateRepository);

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
            updated <RelativeTime dateTime={liveOverview.generatedAt} />
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
