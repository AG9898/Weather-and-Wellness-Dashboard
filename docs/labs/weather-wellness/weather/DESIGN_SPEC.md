# Design Spec — Phase 1 + Phase 2 + Phase 3 + Phase 4

Visual language baseline: [docs/styleguide.md](../../../styleguide.md) · Animation library: [docs/animejs.md](../../../animejs.md)

## UX Goals
- Guided, simple flow — one screen per step, no back navigation during session
- Keyboard-only digit span (no mouse interaction)
- Exact survey wording from lab instrument forms (present-tense, "Right now..." framing)

## RA Flow
1. Login
   - App-owned RA/admin invitation links use `/set-password?invite=<token>`; successful activation sets the Supabase Auth password through the backend invitation acceptance endpoint, then returns the user to normal email/password login.
2. Click "Start New Entry" → navigates to `/new-session`
3. **Step 1 (consent):** Participant reads the official consent PDF; clicks "I Consent" to proceed or "I Do Not Consent" to cancel and return to dashboard (no DB record in either case)
4. **Step 2 (demographics):** RA fills required participant details and chooses either production start or rehearsal start:
   - **Start Session:** backend creates anonymous participant + active session atomically
   - **Run Test Trial:** frontend enters local-only trial mode with a fake session id and no backend calls
5. RA is navigated directly into the participant survey flow (`/session/<id>/uls8`) for either mode
6. After completion, return to RA dashboard:
   - production mode: KPIs reflect the new complete session
   - trial mode: no KPI/data changes (no writes)
7. View data via Supabase Studio
8. To run a Misokinesia session: click the **Misokinesia** entry in the floating dock → navigates to `/misokinesia` → click either "Start Misokinesia Session" (backend-backed write path) or "Run Test Trial" (read-only rehearsal path) → app navigates to `/misokinesia/[id]` participant task page (same device). See [Misokinesia Design Spec](../misokinesia/DESIGN_SPEC.md).

## Participant Flow
1. ULS-8 survey
2. CES-D 10 survey
3. GAD-7 survey
4. Cognitive Function 8a survey
5. Digit Span instructions → practice trial → 14 scored trials → session marked complete
6. Completion screen (thank you) → return to RA dashboard

> **Note:** Consent is obtained at `/new-session` (Step 1 of the RA flow) before the participant session is created. There is no consent page within the `/session/[id]/` route tree.

## Trial Run Mode (no-write rehearsal)

Trial Run mode is an RA-invoked rehearsal path for both WW and Misokinesia. It demonstrates the participant interaction flow without writing research data.

- Launch points:
  - WW: `/new-session` (after consent + demographics view)
  - Misokinesia: `/misokinesia`
- Data behavior:
  - Uses frontend-generated fake ids (`session_id`, and for misokinesia also fake `misokinesia_participant_id`)
  - WW trial mode does not call FastAPI endpoints
  - Misokinesia trial mode may call a read-only RA endpoint for a sampled clip manifest, but never calls write endpoints
  - Never writes rows to `participants`, `sessions`, survey tables, digit span tables, or misokinesia tables
  - Misokinesia Trial Run locally generates the post-video survey order and never persists that assignment
- Misokinesia video behavior:
  - Samples 5 active videos by `stimulus_id` each time "Run Test Trial" is clicked
  - Plays the sampled videos from public Supabase Storage CDN URLs
  - Does not serve or proxy video bytes through FastAPI
- UX behavior:
  - Preserves the same end-to-end screen order as production flow
  - Shows a centered top-screen "Trial Run" watermark on WW participant trial-mode screens; Misokinesia participant task screens do not show this badge
  - Ends on the standard completion screens

---
