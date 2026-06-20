from __future__ import annotations

import asyncio
import importlib.util
from pathlib import Path

from app.services.chat_methodology_tool import explain_methodology
from app.services.chat_tool_registry import (
    chat_tool_specs,
    dispatch_tool,
    get_chat_tool,
)


REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_sync_script():
    script_path = REPO_ROOT / "scripts" / "sync_methodology_corpus.py"
    spec = importlib.util.spec_from_file_location("sync_methodology_corpus", script_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_explain_methodology_returns_cited_weather_instrument_context() -> None:
    result = explain_methodology("How is GAD-7 scored in the weather study?")

    assert result.status == "ready"
    assert result.tool_name == "explain_methodology"
    assert result.data["supported"] is True
    assert result.data["citation"]["path"].startswith(
        "docs/labs/weather-wellness/weather/"
    )
    assert result.data["citation"]["heading"]
    assert "total_score" in result.data["excerpt"] or "severity_band" in result.data["excerpt"]


def test_explain_methodology_returns_cited_misokinesia_context() -> None:
    result = explain_methodology("How does the misokinesia MkAQ section work?")

    assert result.status == "ready"
    assert result.data["supported"] is True
    assert result.data["citation"]["path"].startswith(
        "docs/labs/weather-wellness/misokinesia/"
    )
    assert "MkAQ" in result.data["excerpt"] or "Misokinesia" in result.data["excerpt"]


def test_explain_methodology_cannot_answer_unsupported_topic() -> None:
    result = explain_methodology("What is the RA's vacation policy?")

    assert result.status == "insufficient_data"
    assert result.data["supported"] is False
    assert "cannot support" in result.message


def test_methodology_tool_is_registered_and_dispatchable() -> None:
    tool = get_chat_tool("explain_methodology")
    assert tool.input_schema()["properties"]["question"]["type"] == "string"
    assert "lab_name" not in tool.input_schema()["properties"]
    assert any(
        spec["function"]["name"] == "explain_methodology"
        for spec in chat_tool_specs()
    )

    result = asyncio.run(
        dispatch_tool(
            object(),
            lab_member=object(),
            tool_name="explain_methodology",
            params={"question": "How is CES-D scored?"},
        )
    )

    assert result.status == "ready"
    assert result.data["supported"] is True
    assert result.data["citation"]["path"].endswith("CESD10.md")


def test_methodology_corpus_drift_check_passes_for_bundled_artifact() -> None:
    sync_script = _load_sync_script()

    ok, message = sync_script.check_corpus(REPO_ROOT)

    assert ok, message


def test_methodology_corpus_drift_check_fails_when_bundle_is_stale(tmp_path: Path) -> None:
    sync_script = _load_sync_script()
    source_dir = tmp_path / "docs/labs/weather-wellness/weather"
    source_dir.mkdir(parents=True)
    (source_dir / "GAD7.md").write_text("# GAD-7\n\n## Scoring\n\nSum items.\n")
    (tmp_path / "docs/labs/weather-wellness/misokinesia").mkdir(parents=True)
    bundle_dir = tmp_path / "backend/app/methodology"
    bundle_dir.mkdir(parents=True)
    (bundle_dir / "corpus.json").write_text("{}\n")

    ok, message = sync_script.check_corpus(tmp_path)

    assert not ok
    assert "out of sync" in message
