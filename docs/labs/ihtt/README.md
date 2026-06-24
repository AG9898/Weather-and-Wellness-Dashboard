# IHTT Lab

## Lab Overview

The Interhemispheric Transfer Time lab uses the platform to administer a
Poffenberger Paradigm reaction-time task. The lab slug is `ihtt`, which is the
value expected in Supabase Auth `app_metadata.lab` and the eventual `labs.slug`
database row.

The first IHTT component is the Poffenberger task. The RA-provided task brief in
`reference/labs/ihtt/Poffenberger Paradigm.docx` is the authoritative source for
the initial implementation requirements. The PDF in the same reference folder is
available for later literature review but is not part of the v1 source of truth.

The RA brief specifies task output requirements only: categorized reaction time
and categorized accuracy for the four response-hand by visual-field conditions.
It does not specify additional IHTT-specific participant demographics. The
platform's required anonymous start-session demographic intake still applies
unless the project owner changes that platform rule.

## Data Access

Lab data is accessed through Supabase Studio by default. Participants do not
download data. Any future admin import/export or chatbot access must follow the
same lab isolation rules as the rest of the platform.

## Lab Slug

`ihtt` - used as `app_metadata.lab` in Supabase Auth and as the planned
`labs.slug` value.

Official display name: `Interhemispheric Transfer Time`.

## Component Docs

Global routing map: [`docs/INDEX.md`](../../INDEX.md)

This lab is organized by component. Component-specific API contracts, UX specs,
task docs, and scoring rules live under the component directory. Lab-level docs
cover cross-component concerns only.

### Poffenberger

| Document | Purpose |
|---|---|
| [`poffenberger/API.md`](poffenberger/API.md) | Planned FastAPI contracts for IHTT Poffenberger launch, trial manifests, and run submission |
| [`poffenberger/SCHEMA.md`](poffenberger/SCHEMA.md) | Database tables for Poffenberger run and trial persistence |
| [`poffenberger/DESIGN_SPEC.md`](poffenberger/DESIGN_SPEC.md) | RA launch page and participant task UX |
| [`poffenberger/POFFENBERGER.md`](poffenberger/POFFENBERGER.md) | Task protocol and data collection requirements |
| [`poffenberger/SCORING.md`](poffenberger/SCORING.md) | Server-side scoring and derived summary fields |

## Reference Materials

- `reference/labs/ihtt/Poffenberger Paradigm.docx` - RA-provided authoritative
  v1 requirements.
- `reference/labs/ihtt/2017_friedrich_long-term_reliability_of_the_vi_38726.pdf`
  - supporting literature, ignored for v1 unless the RA later asks to use it.
