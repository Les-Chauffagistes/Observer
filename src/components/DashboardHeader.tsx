import type { ReactNode } from "react";
import type { OverviewSummary } from "@/lib/pipelines/summary";
import { StatusSummary } from "@/components/StatusSummary";
import { ViewNav, type View } from "@/components/ViewNav";
import styles from "./PipelineDashboard.module.css";

interface DashboardHeaderProps {
  readonly activeView: View;
  readonly organization: string | null;
  readonly subtitle: ReactNode;
  readonly summary: OverviewSummary;
}

/** Shared dashboard masthead, separating navigation from CI health at a glance. */
export function DashboardHeader({
  activeView,
  organization,
  subtitle,
  summary,
}: DashboardHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>
          CI/CD Observer
          {organization && <span className={styles.org}>{organization}</span>}
        </h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      <div className={styles.headerControls}>
        <ViewNav active={activeView} />
      </div>
      <section className={styles.statusPanel} aria-label="Pipeline health">
        <span className={styles.statusLabel}>Pipeline health</span>
        <StatusSummary summary={summary} />
      </section>
    </header>
  );
}
