import type { PipelineStatus } from "@/lib/pipelines/types";
import { STATUS_PRESENTATION } from "@/components/statusPresentation";
import styles from "./StatusBadge.module.css";

interface StatusBadgeProps {
  readonly status: PipelineStatus;
  /** Render a compact dot instead of the full label. */
  readonly compact?: boolean;
}

/** Coloured badge representing a pipeline status. */
export function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  const { label, colorVar, icon } = STATUS_PRESENTATION[status];
  const color = `var(${colorVar})`;

  if (compact) {
    return (
      <span
        className={styles.dot}
        style={{ backgroundColor: color }}
        title={label}
        aria-label={label}
      />
    );
  }

  return (
    <span className={styles.badge} style={{ color, borderColor: color }}>
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}
