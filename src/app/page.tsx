import { loadOverview } from "@/lib/pipelines";
import { PipelineDashboard } from "@/components/PipelineDashboard";
import { SetupNotice } from "@/components/SetupNotice";

/**
 * The dashboard reflects live CI/CD state, so it is always rendered on demand.
 * GitHub responses are still cached briefly at the fetch layer
 * (`GITHUB_REVALIDATE_SECONDS`) to stay within rate limits.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await loadOverview();

  if (!result.ok) {
    return <SetupNotice message={result.message} />;
  }

  return <PipelineDashboard overview={result.overview} />;
}
