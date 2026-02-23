# PRD — Research Web Application (Weather & Wellness + Misokinesia)

## Objective
Internal lab-operated web app to:
- Run Backwards Digit Span (repo-matched parameters)
- Administer 4 surveys (exact wording)
- Auto-score all instruments
- Store data linked by participant + session
- Provide data access via Supabase Studio (no CSV export in Phase 1)

## Users
- LabMember (RA/Admin)
- Participant (no login)

## Participant Model
- participant_number (ascending integer starting at 1)
- participant_uuid (stable UUID)
- first_name, last_name (entered by RA)

## Phase 1 Scope
- Keyboard-only Backwards Digit Span
- ULS-8 (auto-score + 0–100 transform)
- CES-D 10 (reverse score + total)
- GAD-7 (total + severity band)
- Cognitive Function 8a (sum + mean)
- Session creation + data access via Supabase Studio (no CSV export)

## Success Criteria
- End-to-end session without manual scoring
- All data linked to participant_uuid + session_id
- Lab team can view stored results via Supabase Studio
