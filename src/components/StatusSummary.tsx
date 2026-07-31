import type { OverviewSummary } from "@/lib/pipelines";
import {
  STATUS_PRESENTATION,
  SUMMARY_STATUSES,
} from "@/components/statusPresentation";
import styles from "./StatusSummary.module.css";

interface StatusSummaryProps {
  readonly summary: OverviewSummary;
  /** Hide statuses whose count is zero (used in compact folder headers). */
  readonly hideZeros?: boolean;
}

/** Inline list of status dots with counts, shared by the header and folders. */
export function StatusSummary({
  summary,
  hideZeros = false,
}: StatusSummaryProps) {
  const statuses = hideZeros
    ? SUMMARY_STATUSES.filter((status) => summary.byStatus[status] > 0)
    : SUMMARY_STATUSES;

  return (
    <ul className={styles.summary}>
      {statuses.map((status) => (
        <li key={status} className={styles.item}>
          <span
            className={styles.dot}
            style={{
              backgroundColor: `var(${STATUS_PRESENTATION[status].colorVar})`,
            }}
          />
          <span className={styles.count}>{summary.byStatus[status]}</span>
          <span className={styles.label}>
            {STATUS_PRESENTATION[status].label}
          </span>
        </li>
      ))}
    </ul>
  );
}
