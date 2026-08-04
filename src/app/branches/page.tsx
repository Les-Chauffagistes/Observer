import { loadBranchOverview } from "@/lib/pipelines";
import { BranchDashboard } from "@/components/BranchDashboard";
import { SetupNotice } from "@/components/SetupNotice";

/**
 * Branch-oriented view: per repository, the branches not yet merged into an
 * integration branch (`develop`/`main`/`master`) and each branch's pipeline
 * runs. This surfaces feature-branch results that the latest run on the default
 * branch would otherwise mask in the other views. Rendered on demand for the
 * same reasons as the home page.
 */
export const dynamic = "force-dynamic";

export default async function Branches() {
  const result = await loadBranchOverview();

  if (!result.ok) {
    return <SetupNotice message={result.message} />;
  }

  return <BranchDashboard overview={result.overview} groups={result.groups} />;
}
