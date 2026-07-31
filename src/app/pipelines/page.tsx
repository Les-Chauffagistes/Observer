import { groupByPipeline, loadOverview } from "@/lib/pipelines";
import { PipelineOrientedDashboard } from "@/components/PipelineOrientedDashboard";
import { SetupNotice } from "@/components/SetupNotice";

/**
 * Pipeline-oriented view: the same live overview as the home page, pivoted so
 * pipelines (workflow names) are the top-level unit and repositories appear
 * inside them. Rendered on demand for the same reasons as the home page.
 */
export const dynamic = "force-dynamic";

export default async function Pipelines() {
  const result = await loadOverview();

  if (!result.ok) {
    return <SetupNotice message={result.message} />;
  }

  const visibleRepositories = result.groups.flatMap((group) => [
    ...group.repositories,
  ]);
  const pipelines = groupByPipeline(visibleRepositories);

  return (
    <PipelineOrientedDashboard
      overview={result.overview}
      pipelines={pipelines}
    />
  );
}
