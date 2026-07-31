import type { RepoBranchPipelines } from "@/lib/pipelines";
import { RepoBranchCard } from "@/components/RepoBranchCard";
import styles from "./RepoGrid.module.css";

interface BranchGridProps {
  readonly repositories: readonly RepoBranchPipelines[];
  readonly showOwner: boolean;
}

/** Responsive grid of branch cards, shared by flat and folder layouts. */
export function BranchGrid({ repositories, showOwner }: BranchGridProps) {
  return (
    <div className={styles.grid}>
      {repositories.map((repo) => (
        <RepoBranchCard
          key={`${repo.repo.owner}/${repo.repo.name}`}
          data={repo}
          showOwner={showOwner}
        />
      ))}
    </div>
  );
}
