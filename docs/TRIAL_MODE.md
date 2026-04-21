# TRIAL_MODE.md — Trial Run Canonical Rules

Canonical specification for trial-run behavior across WW and Misokinesia participant flows.

---

## Fake ID Format

- Trial mode IDs must use the `trial-<sequence>` format (for example, `trial-1`, `trial-2`).
- Do not use UUID v4 IDs in trial mode.
- Store trial IDs in session/local storage only.
- Never write trial IDs to the database.

## Watermark Visibility

- Show the `Trial Run` watermark on Weather Wellness participant pages only.
- Always exclude the watermark from the Misokinesia participant task route (`/misokinesia/[id]`), even when `TRIAL_RUN_MODE` is active.

## Module Placement

- Trial-mode pure functions, including `getTrialRunWatermarkLabel`, live in `src/lib/trial-mode.ts`.
- Watermark UI rendering lives in a separate component.
- Keep both modules side-effect free and synchronous (no async logic).

## Consent

- Consent gating is UI-only.
- The consent screen gates participant flow before navigation to the first survey.
- Consent does not write a database row.
- Trial mode does not bypass or alter consent gating logic.
