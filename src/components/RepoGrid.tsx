import type { RepoPipelines } from "@/lib/pipelines/types";
import { RepoPipelineCard } from "@/components/RepoPipelineCard";
import styles from "./RepoGrid.module.css";

interface RepoGridProps {
  readonly repositories: readonly RepoPipelines[];
  readonly showOwner: boolean;
}

/** Responsive grid of repository cards, shared by flat and folder layouts. */
export function RepoGrid({ repositories, showOwner }: RepoGridProps) {
  return (
    <div className={styles.grid}>
      {repositories.map((repo) => (
        <RepoPipelineCard
          key={`${repo.repo.owner}/${repo.repo.name}`}
          data={repo}
          showOwner={showOwner}
        />
      ))}
    </div>
  );
}
