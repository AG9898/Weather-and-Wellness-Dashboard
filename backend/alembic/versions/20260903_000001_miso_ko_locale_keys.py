"""Add misokinesia_participants.language and backfill choice columns to option keys.

Adds the per-session locale column (default ``en``) and rewrites every stored
Misokinesia demographics / end-of-task choice value from English display text to
the stable, language-independent option keys registered in
``docs/labs/weather-wellness/misokinesia/LOCALIZATION.md`` section 4.

The mapping below is a frozen copy of that document's migration table. It is
deliberately self-contained: migrations must not import application code, whose
option lists will change in later tasks.

Values that match no mapping entry abort the migration rather than being nulled
or silently passed through, and ``downgrade()`` reverses the mapping so the
revision is not one-way.

Revision ID: 20260903_000001
Revises: 20260712_000001
Create Date: 2026-09-03 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260903_000001"
down_revision = "20260712_000001"
branch_labels = None
depends_on = None


TABLE = "misokinesia_participants"

# --------------------------------------------------------------------------
# English-text-to-key mapping (LOCALIZATION.md section 4).
#
# The stored English strings are authoritative, not the workbook text: note
# "Bachelors degree" (no apostrophe) and the legacy "Seperated" misspelling.
# --------------------------------------------------------------------------

SCALAR_COLUMN_MAPPINGS: dict[str, dict[str, str]] = {
    "sex": {
        "Male": "sex_male",
        "Female": "sex_female",
    },
    "residence_status": {
        "Canadian Citizenship": "residence_citizenship",
        "Permanent Resident": "residence_permanent_resident",
        "Student Visa": "residence_student_visa",
        "Other": "residence_other",
    },
    "student_type": {
        "Domestic": "student_domestic",
        "International": "student_international",
    },
    "highest_education_completed": {
        "Elementary or middle school": "education_elementary_middle",
        "High school or equivalent (e.g., GED)": "education_high_school",
        "College diploma": "education_college_diploma",
        "Bachelors degree": "education_bachelors",
        "Masters degree": "education_masters",
        "Doctorate degree": "education_doctorate",
    },
    "english_fluency": {
        "Strongly agree": "fluency_strongly_agree",
        "Agree": "fluency_agree",
        "Neither agree nor disagree": "fluency_neutral",
        "Disagree": "fluency_disagree",
        "Strongly disagree": "fluency_strongly_disagree",
    },
    "english_speaking_frequency": {
        "Always": "frequency_always",
        "Often": "frequency_often",
        "Sometimes": "frequency_sometimes",
        "Rarely": "frequency_rarely",
        "Never": "frequency_never",
    },
    "adhd_medication": {
        "Yes": "adhd_med_yes",
        "Maybe": "adhd_med_maybe",
        "No": "adhd_med_no",
    },
    "relationship_status": {
        "Single": "relationship_single",
        "In a relationship": "relationship_in_relationship",
        "Married (and not separated)": "relationship_married",
        "Common-law": "relationship_common_law",
        # Legacy misspelling; match the stored string, not the workbook text.
        "Seperated": "relationship_separated",
        "Divorced": "relationship_divorced",
        "Widowed": "relationship_widowed",
        "Other": "relationship_other",
        "None of the Above": "relationship_none",
    },
    "occupational_status": {
        "Employed full-time": "occupation_employed_full_time",
        "Employed part-time": "occupation_employed_part_time",
        "Out of work but looking for work": "occupation_out_of_work_looking",
        "Out of work and not looking for work": "occupation_out_of_work_not_looking",
        "Homemaker": "occupation_homemaker",
        "Student": "occupation_student",
        "Military": "occupation_military",
        "Retired": "occupation_retired",
        "Unable to work": "occupation_unable_to_work",
        "Other": "occupation_other",
        "None of the above": "occupation_none",
    },
    "stronger_responses_timing": {
        "Immediately": "timing_immediately",
        "After 5 seconds": "timing_after_5s",
        "After 10 seconds": "timing_after_10s",
        "At the end of the video": "timing_end_of_video",
    },
}

ARRAY_COLUMN_MAPPINGS: dict[str, dict[str, str]] = {
    "ethnicity": {
        "European Canadian": "ethnicity_european",
        "Chinese": "ethnicity_chinese",
        "South Asian": "ethnicity_south_asian",
        "Filipino": "ethnicity_filipino",
        "Southeast Asian": "ethnicity_southeast_asian",
        "Japanese": "ethnicity_japanese",
        "Latin American": "ethnicity_latin_american",
        "Korean": "ethnicity_korean",
        "Other": "ethnicity_other",
    },
    "fluent_languages": {
        "French": "fluent_lang_french",
        "Mandarin": "fluent_lang_mandarin",
        "Cantonese": "fluent_lang_cantonese",
        "Hindi": "fluent_lang_hindi",
        "Punjabi": "fluent_lang_punjabi",
        # Every pre-existing row is an `en` session, so the divergent slot maps
        # to the EN key. No existing row can contain `fluent_lang_english`.
        "Korean": "fluent_lang_korean",
        "None": "fluent_lang_none",
        "Other": "fluent_lang_other",
    },
    "instruction_languages": {
        "French": "instruction_lang_french",
        "Mandarin": "instruction_lang_mandarin",
        "Cantonese": "instruction_lang_cantonese",
        "Hindi": "instruction_lang_hindi",
        "Punjabi": "instruction_lang_punjabi",
        "Korean": "instruction_lang_korean",
        "Other": "instruction_lang_other",
    },
    "diagnosed_disorders": {
        "Neurological Disorder": "disorder_neurological",
        "Generalized Anxiety Disorder": "disorder_generalized_anxiety",
        "Depression": "disorder_depression",
        "Mood Disorder": "disorder_mood",
        "Substance Use Disorder": "disorder_substance_use",
        "Other": "disorder_other",
        "N/A": "disorder_na",
    },
    "regular_substances": {
        "Alcohol": "substance_alcohol",
        "Cannabis": "substance_cannabis",
        "Tobacco": "substance_tobacco",
        "Vaping": "substance_vaping",
        "Caffeinated Stimulants (coffee, energy drinks, etc.)": "substance_caffeine",
        "Other": "substance_other",
        "None of the Above": "substance_none",
    },
}


def _invert(mapping: dict[str, str]) -> dict[str, str]:
    inverted: dict[str, str] = {}
    for source, target in mapping.items():
        if target in inverted:  # pragma: no cover - guards a hand-edited table
            raise RuntimeError(
                f"Non-invertible mapping: option key {target!r} is reachable from "
                f"both {inverted[target]!r} and {source!r}."
            )
        inverted[target] = source
    return inverted


def _assert_disjoint(mapping: dict[str, str], column: str) -> None:
    """Source and target vocabularies must not overlap.

    Rewrites are applied one mapping entry at a time, so an overlap would let a
    freshly written value be rewritten again by a later entry.
    """
    collisions = sorted(set(mapping) & set(mapping.values()))
    if collisions:  # pragma: no cover - guards a hand-edited table
        raise RuntimeError(
            f"{column}: mapping source and target values overlap: {collisions}"
        )


def _assert_all_mapped(
    conn: sa.engine.Connection, column: str, mapping: dict[str, str], *, is_array: bool
) -> None:
    if is_array:
        stmt = sa.text(
            f"SELECT DISTINCT element AS value "  # noqa: S608 - column is a literal
            f"FROM {TABLE} AS p, unnest(p.{column}) AS element"
        )
    else:
        stmt = sa.text(
            f"SELECT DISTINCT {column} AS value "  # noqa: S608 - column is a literal
            f"FROM {TABLE} WHERE {column} IS NOT NULL"
        )
    stored = conn.execute(stmt).scalars().all()
    unmapped = sorted(value for value in stored if value not in mapping)
    if unmapped:
        raise RuntimeError(
            f"{TABLE}.{column} holds {len(unmapped)} value(s) with no mapping entry: "
            f"{unmapped}. Add them to LOCALIZATION.md section 4 and to this "
            f"revision before migrating; refusing to null or pass them through."
        )


def _rewrite(conn: sa.engine.Connection, mapping_by_column: dict[str, dict[str, str]], *, is_array: bool) -> None:
    for column, mapping in mapping_by_column.items():
        _assert_disjoint(mapping, column)
        _assert_all_mapped(conn, column, mapping, is_array=is_array)
        for source, target in mapping.items():
            if is_array:
                stmt = sa.text(
                    f"UPDATE {TABLE} "  # noqa: S608 - column is a literal
                    f"SET {column} = array_replace({column}, :source, :target) "
                    f"WHERE :source = ANY({column})"
                )
            else:
                stmt = sa.text(
                    f"UPDATE {TABLE} "  # noqa: S608 - column is a literal
                    f"SET {column} = :target WHERE {column} = :source"
                )
            conn.execute(stmt, {"source": source, "target": target})


def _migrate(*, to_keys: bool) -> None:
    conn = op.get_bind()
    scalars = SCALAR_COLUMN_MAPPINGS
    arrays = ARRAY_COLUMN_MAPPINGS
    if not to_keys:
        scalars = {c: _invert(m) for c, m in SCALAR_COLUMN_MAPPINGS.items()}
        arrays = {c: _invert(m) for c, m in ARRAY_COLUMN_MAPPINGS.items()}
    _rewrite(conn, scalars, is_array=False)
    _rewrite(conn, arrays, is_array=True)


def upgrade() -> None:
    op.add_column(
        TABLE,
        sa.Column(
            "language",
            sa.String(),
            nullable=False,
            server_default=sa.text("'en'"),
        ),
    )
    _migrate(to_keys=True)


def downgrade() -> None:
    _migrate(to_keys=False)
    op.drop_column(TABLE, "language")
