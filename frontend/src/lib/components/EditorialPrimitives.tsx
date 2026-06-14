"use client";

/**
 * EditorialPrimitives.tsx
 *
 * Shared quiet-editorial task UI primitives for the Misokinesia redesign
 * (and any future lab task flows).
 *
 * Primitives consume semantic CSS tokens only; no hardcoded paper or dark
 * hex values. All colors resolve through the :root / .dark token maps.
 *
 * Surfaces covered:
 *  - EditorialKicker         — small uppercase section label
 *  - EditorialMetaTag        — compact pill badge (neutral or accent)
 *  - EditorialStepIndicator  — "01 / 04" row with expanding hairline + breadcrumb
 *  - EditorialProgressStrip  — "Clip N of M" tabular row + 2px progress bar
 *  - EditorialTaskShell      — centered task-page width + vertical rhythm
 *  - EditorialTaskPanel      — single quiet task surface
 *  - EditorialTaskHeader     — step/kicker/title/description/progress stack
 *  - EditorialPaneDots       — horizontal dot strip for paged carousels
 *  - EditorialChip           — single flat choice chip (select/hover/disabled/focus)
 *  - EditorialChipGroup      — wrapping row of EditorialChips (single-select helper)
 *  - EditorialFieldset       — subtle fieldset shell for question containers
 *  - EditorialCardLedger     — hairline-divided metadata table inside a card
 *  - EditorialPauseNote      — fieldset-bg pause/rest callout with icon slot
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// EditorialKicker
// Small uppercase label: 11px, weight 600, letter-spacing 0.18em, muted-foreground
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorialKickerProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function EditorialKicker({
  children,
  className,
  ...props
}: EditorialKickerProps) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialMetaTag
// Compact pill/badge. neutral (default) or accent (primary fill).
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorialMetaTagProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  /** When true, renders with bg-primary text-primary-foreground fill */
  accent?: boolean;
}

export function EditorialMetaTag({
  children,
  accent = false,
  className,
  ...props
}: EditorialMetaTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        accent
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialStepIndicator
// "01 / 04" tabular meta — hairline rule — breadcrumb text
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorialStepIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** e.g. "01 / 04" */
  stepTag: string;
  /** e.g. "Demographics → Intro → Task → Surveys" */
  breadcrumb?: string;
}

export function EditorialStepIndicator({
  stepTag,
  breadcrumb,
  className,
  ...props
}: EditorialStepIndicatorProps) {
  return (
    <div
      className={cn("flex items-center gap-3", className)}
      {...props}
    >
      <span
        className="shrink-0 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        aria-label={`Step ${stepTag}`}
      >
        {stepTag}
      </span>
      <div className="h-px flex-1 bg-border" aria-hidden />
      {breadcrumb && (
        <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {breadcrumb}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialProgressStrip
// "Clip 12 of 25" — 2px progress bar — "48%"
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorialProgressStripProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Current step (1-indexed) */
  current: number;
  /** Total steps */
  total: number;
  /** Override the left label; defaults to "Clip {current} of {total}" */
  label?: string;
  /** Hide the percentage on the right */
  hidePercent?: boolean;
}

export function EditorialProgressStrip({
  current,
  total,
  label,
  hidePercent = false,
  className,
  ...props
}: EditorialProgressStripProps) {
  const safeCurrent = Math.max(0, Math.min(current, total));
  const percent =
    total > 0 ? Math.round((safeCurrent / total) * 100) : 0;
  const displayLabel = label ?? `Clip ${safeCurrent} of ${total}`;

  return (
    <div
      className={cn("flex items-center gap-4", className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={displayLabel}
      {...props}
    >
      <span className="shrink-0 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {displayLabel}
      </span>
      <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      {!hidePercent && (
        <span className="shrink-0 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {percent}%
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialTaskShell + EditorialTaskPanel + EditorialTaskHeader
// Shared quiet-editorial shell for participant task and survey pages.
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorialTaskShellProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Vertically center short task states; long forms should use the default top flow. */
  centered?: boolean;
}

export function EditorialTaskShell({
  children,
  centered = false,
  className,
  ...props
}: EditorialTaskShellProps) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-[760px] flex-col py-6 sm:py-10",
        centered ? "justify-center" : "justify-start",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface EditorialTaskPanelProps
  extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function EditorialTaskPanel({
  children,
  className,
  ...props
}: EditorialTaskPanelProps) {
  return (
    <section
      className={cn(
        "rounded-[18px] border border-border bg-card p-5 shadow-[0_24px_60px_-52px_rgb(0_19_40/0.72)] sm:p-8",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export interface EditorialTaskHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  stepTag?: string;
  breadcrumb?: string;
  kicker?: React.ReactNode;
  progress?: Pick<
    EditorialProgressStripProps,
    "current" | "total" | "label" | "hidePercent"
  >;
}

export function EditorialTaskHeader({
  title,
  description,
  stepTag,
  breadcrumb,
  kicker,
  progress,
  className,
  ...props
}: EditorialTaskHeaderProps) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {stepTag && (
        <EditorialStepIndicator
          stepTag={stepTag}
          breadcrumb={breadcrumb}
        />
      )}
      <div className="space-y-2">
        {kicker && <EditorialKicker>{kicker}</EditorialKicker>}
        <h1 className="text-[22px] font-bold leading-snug text-foreground sm:text-[26px]">
          {title}
        </h1>
        {description && (
          <p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {progress && (
        <EditorialProgressStrip
          current={progress.current}
          total={progress.total}
          label={progress.label}
          hidePercent={progress.hidePercent}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialPaneDots
// Horizontal strip of dot segments for paged carousels.
// past = ubc-blue-300, current = primary, future = muted
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorialPaneDotsProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Total number of panes */
  total: number;
  /** Active pane index (0-indexed) */
  activeIndex: number;
}

export function EditorialPaneDots({
  total,
  activeIndex,
  className,
  ...props
}: EditorialPaneDotsProps) {
  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="tablist"
      aria-label="Pane progress"
      {...props}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          role="tab"
          aria-selected={i === activeIndex}
          aria-label={`Pane ${i + 1} of ${total}`}
          className={cn(
            "block h-1 w-7 rounded-full",
            i === activeIndex
              ? "bg-primary"
              : i < activeIndex
                ? "bg-[var(--ubc-blue-300)]"
                : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialChip
// Flat choice chip with selected / hover / disabled / focus-visible states.
// Supports both button (interactive) and span (display-only) rendering.
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorialChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether this chip is currently selected */
  selected?: boolean;
  /** Render as non-interactive span (for display contexts) */
  asSpan?: boolean;
}

export function EditorialChip({
  children,
  selected = false,
  disabled = false,
  asSpan = false,
  className,
  ...props
}: EditorialChipProps) {
  const base = cn(
    // Layout + shape
    "inline-flex h-9 cursor-pointer items-center justify-center rounded-[10px] border px-3.5 text-xs font-medium leading-none",
    // Transitions
    "transition-colors duration-150",
    // Focus ring
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
    // Selected state — flat primary fill, no shadow ring
    selected
      ? "border-transparent bg-primary text-primary-foreground"
      : [
          // Idle — neutral border + card fill
          "border-border bg-card text-muted-foreground",
          // Hover (unselected only)
          "hover:border-ring/40 hover:text-foreground",
        ],
    // Disabled
    disabled && "pointer-events-none opacity-50",
    className,
  );

  if (asSpan) {
    return (
      <span className={base} aria-selected={selected}>
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={base}
      disabled={disabled}
      aria-pressed={selected}
      {...props}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialChipGroup
// Single-select chip group. Manages selection and renders EditorialChip rows.
// ─────────────────────────────────────────────────────────────────────────────
export interface ChipOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface EditorialChipGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  options: ChipOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** Optional accessible label for the group */
  groupLabel?: string;
  disabled?: boolean;
}

export function EditorialChipGroup({
  options,
  value,
  onChange,
  groupLabel,
  disabled = false,
  className,
  ...props
}: EditorialChipGroupProps) {
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className={cn("flex flex-wrap gap-2", className)}
      {...props}
    >
      {options.map((opt) => (
        <EditorialChip
          key={opt.value}
          selected={value === opt.value}
          disabled={disabled || opt.disabled}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </EditorialChip>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialFieldset
// Subtle fieldset shell for question containers.
// Applies --fieldset-bg surface + hairline border + 14px radius.
// Does not own question content — wrap question label + chip row inside.
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorialFieldsetProps
  extends React.FieldsetHTMLAttributes<HTMLFieldSetElement> {
  /** Accessible legend text (visually hidden by default) */
  legend?: string;
  /** Whether to show the legend visibly */
  showLegend?: boolean;
  children: React.ReactNode;
}

export function EditorialFieldset({
  legend,
  showLegend = false,
  children,
  className,
  ...props
}: EditorialFieldsetProps) {
  return (
    <fieldset
      className={cn(
        "rounded-[14px] border border-border p-3.5 sm:p-4",
        className,
      )}
      style={{ background: "var(--fieldset-bg)" }}
      {...props}
    >
      {legend && (
        <legend className={cn(showLegend ? "mb-2 text-sm font-semibold text-foreground" : "sr-only")}>
          {legend}
        </legend>
      )}
      {children}
    </fieldset>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialCardLedger + EditorialLedgerRow
// Hairline-divided metadata table for use inside cards.
// Top border on the ledger container; each row has a bottom border except last.
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorialLedgerRowProps
  extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Label column width; defaults to "140px" */
  labelWidth?: string;
  /** Remove bottom border (use on the last row) */
  noBorder?: boolean;
}

export function EditorialLedgerRow({
  label,
  value,
  labelWidth = "140px",
  noBorder = false,
  className,
  ...props
}: EditorialLedgerRowProps) {
  return (
    <div
      className={cn(
        "grid gap-6 py-3",
        noBorder ? "" : "border-b border-border",
        className,
      )}
      style={{ gridTemplateColumns: `${labelWidth} 1fr` }}
      {...props}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span className="text-[13px] text-foreground">{value}</span>
    </div>
  );
}

export interface EditorialCardLedgerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function EditorialCardLedger({
  children,
  className,
  ...props
}: EditorialCardLedgerProps) {
  return (
    <div
      className={cn("border-t border-border", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorialPauseNote
// Fieldset-bg callout for pause / rest / informational notes.
// Accepts an optional icon slot on the left.
// ─────────────────────────────────────────────────────────────────────────────
export interface EditorialPauseNoteProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Optional icon element rendered before the text */
  icon?: React.ReactNode;
}

export function EditorialPauseNote({
  children,
  icon,
  className,
  ...props
}: EditorialPauseNoteProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-[10px] px-3.5 py-3 text-xs text-muted-foreground",
        className,
      )}
      style={{ background: "var(--fieldset-bg)" }}
      {...props}
    >
      {icon && (
        <span className="shrink-0 text-muted-foreground" aria-hidden>
          {icon}
        </span>
      )}
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
