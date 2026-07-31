import type { PipelineStatus } from "@/lib/pipelines/types";

/** Presentation metadata for a pipeline status. */
export interface StatusPresentation {
  readonly label: string;
  /** CSS custom property holding the status colour (see globals.css). */
  readonly colorVar: string;
  /** Short glyph shown in badges. */
  readonly icon: string;
}

/** Statuses surfaced in summary bars, in display (priority) order. */
export const SUMMARY_STATUSES: readonly PipelineStatus[] = [
  "failure",
  "action_required",
  "running",
  "queued",
  "success",
];

/**
 * Single source of truth mapping a domain {@link PipelineStatus} to how it is
 * rendered. Colours reference CSS variables so light/dark theming stays in
 * globals.css.
 */
export const STATUS_PRESENTATION: Record<PipelineStatus, StatusPresentation> = {
  success: { label: "Success", colorVar: "--status-success", icon: "✓" },
  failure: { label: "Failure", colorVar: "--status-failure", icon: "✕" },
  running: { label: "Running", colorVar: "--status-running", icon: "●" },
  queued: { label: "Queued", colorVar: "--status-queued", icon: "◔" },
  cancelled: { label: "Cancelled", colorVar: "--status-cancelled", icon: "⊘" },
  skipped: { label: "Skipped", colorVar: "--status-skipped", icon: "»" },
  action_required: {
    label: "Action required",
    colorVar: "--status-action_required",
    icon: "!",
  },
  unknown: { label: "Unknown", colorVar: "--status-unknown", icon: "?" },
};
