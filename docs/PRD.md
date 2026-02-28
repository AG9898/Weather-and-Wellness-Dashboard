# PRD — Research Web Application (Weather & Wellness + Misokinesia)

## Objective
Internal lab-operated web app to:
- Run Backwards Digit Span (repo-matched parameters)
- Administer 4 surveys (exact wording)
- Auto-score all instruments
- Store data linked by participant + session
- Provide data access via Supabase Studio (Phase 1)
- Phase 3: provide an RA-only Import/Export page for legacy imports and controlled admin exports (CSV/XLSX)

## Users
- LabMember (RA/Admin)
- Participant (no login)

## Participant Model
- participant_number (ascending integer starting at 1; the only human-facing Participant ID)
- participant_uuid (stable UUID; internal key only)
- participants are anonymous: no names or other direct identifiers are stored

## Phase 1 Scope
- Keyboard-only Backwards Digit Span
- ULS-8 (auto-score + 0–100 transform)
- CES-D 10 (reverse score + total)
- GAD-7 (total + severity band)
- Cognitive Function 8a (sum + mean)
- Session creation + data access via Supabase Studio (no export UI in Phase 1)

## Success Criteria
- End-to-end session without manual scoring
- All data linked to participant_uuid + session_id
- Lab team can view stored results via Supabase Studio
