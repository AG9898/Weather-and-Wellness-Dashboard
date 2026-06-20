"""Doc-grounded methodology explainer for the RA chatbot.

The runtime tool reads only the backend-bundled corpus generated from canonical
docs. It never imports or introspects scoring source code and never reads the
repo-root ``docs/`` tree.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from importlib import resources
from typing import Any

from app.services.chat_tools import ChatAggregateToolResult


TOOL_NAME = "explain_methodology"
MAX_QUERY_CHARS = 240
MAX_EXCERPT_CHARS = 900
MAX_SUMMARY_CHARS = 500
MIN_SCORE = 2

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOPWORDS = {
    "a",
    "about",
    "and",
    "are",
    "does",
    "for",
    "from",
    "how",
    "is",
    "it",
    "of",
    "or",
    "section",
    "the",
    "this",
    "to",
    "what",
    "work",
    "works",
}
_ALIASES = {
    "gad": {"gad", "gad7", "anxiety"},
    "anxiety": {"anxiety", "gad", "gad7", "gadded"},
    "gad7": {"gad", "gad7", "anxiety"},
    "gad-7": {"gad", "gad7", "anxiety"},
    "cesd": {"cesd", "cesd10", "ces", "depression"},
    "ces-d": {"cesd", "cesd10", "ces", "depression"},
    "depression": {"cesd", "cesd10", "depression"},
    "uls": {"uls", "uls8", "loneliness"},
    "uls-8": {"uls", "uls8", "loneliness"},
    "loneliness": {"uls", "uls8", "loneliness"},
    "cogfunc": {"cogfunc", "cognitive", "function", "promis"},
    "digit": {"digit", "span", "backwards"},
    "stroop": {"stroop", "interference", "accuracy"},
    "card": {"card", "sorting", "perseverative"},
    "mkaq": {"mkaq", "misokinesia", "visual"},
    "maq": {"maq", "misophonia", "sound"},
    "misokinesia": {"misokinesia", "mkaq", "visual", "reactivity"},
    "reactivity": {"reactivity", "clip", "clips", "video"},
    "scored": {"score", "scored", "scoring"},
    "scoring": {"score", "scored", "scoring"},
    "weather": {"weather", "study", "day", "derived"},
    "daylight": {"daylight", "sunshine", "derived"},
}
_DOMAIN_TOKENS = {
    "anxiety",
    "backwards",
    "card",
    "ces",
    "cesd",
    "clip",
    "cognitive",
    "cogfunc",
    "day",
    "daylight",
    "depression",
    "derived",
    "digit",
    "gad",
    "gad7",
    "instrument",
    "loneliness",
    "maq",
    "misokinesia",
    "misophonia",
    "mkaq",
    "promis",
    "reactivity",
    "score",
    "span",
    "stroop",
    "study",
    "survey",
    "uls",
    "uls8",
    "weather",
}


def _load_corpus() -> dict[str, Any]:
    corpus_path = resources.files("app.methodology").joinpath("corpus.json")
    return json.loads(corpus_path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _sections() -> tuple[dict[str, Any], ...]:
    corpus = _load_corpus()
    return tuple(corpus.get("sections", ()))


def _tokens(value: str) -> set[str]:
    value = (
        value.lower()
        .replace("gad-7", "gad7")
        .replace("ces-d", "cesd")
        .replace("uls-8", "uls8")
    )
    tokens = {token for token in _TOKEN_RE.findall(value.lower()) if token not in _STOPWORDS}
    expanded = set(tokens)
    for token in tokens:
        expanded.update(_ALIASES.get(token, set()))
    return expanded


def _score_section(query_tokens: set[str], section: dict[str, Any]) -> int:
    heading_tokens = _tokens(str(section.get("heading", "")))
    source_path = str(section.get("source_path", ""))
    path_tokens = _tokens(source_path)
    content_tokens = _tokens(str(section.get("content", "")))
    score = len(query_tokens & content_tokens)
    score += 3 * len(query_tokens & heading_tokens)
    score += 2 * len(query_tokens & path_tokens)
    source_path_lower = source_path.lower()
    score += 8 * sum(1 for token in query_tokens if token in source_path_lower)
    if query_tokens & {"score", "scored", "scoring"} and heading_tokens & {
        "score",
        "scored",
        "scoring",
    }:
        score += 30
    if "weather" in query_tokens and "/weather/" in source_path_lower:
        score += 20
    if "misokinesia" in query_tokens and "/misokinesia/" in source_path_lower:
        score += 20
    if source_path_lower.endswith(("gad7.md", "cesd10.md", "uls8.md")):
        score += 12 * len(query_tokens & path_tokens)
    return score


def _bounded_text(value: str, max_chars: int) -> str:
    compact = re.sub(r"\n{3,}", "\n\n", value.strip())
    if len(compact) <= max_chars:
        return compact
    truncated = compact[: max_chars - 1].rstrip()
    return f"{truncated}..."


def explain_methodology(question: str) -> ChatAggregateToolResult:
    """Return a bounded, cited methodology explanation from the bundled corpus."""

    normalized_question = question.strip()
    if not normalized_question:
        return ChatAggregateToolResult(
            tool_name=TOOL_NAME,
            status="invalid_scope",
            message="A methodology question is required.",
            data={"supported": False},
        )
    if len(normalized_question) > MAX_QUERY_CHARS:
        return ChatAggregateToolResult(
            tool_name=TOOL_NAME,
            status="invalid_scope",
            message=f"Methodology question must be {MAX_QUERY_CHARS} characters or fewer.",
            data={"supported": False, "max_query_chars": MAX_QUERY_CHARS},
        )

    query_tokens = _tokens(normalized_question)
    if not query_tokens & _DOMAIN_TOKENS:
        return ChatAggregateToolResult(
            tool_name=TOOL_NAME,
            status="insufficient_data",
            message=(
                "The bundled methodology corpus cannot support that topic. "
                "Ask about documented Weather-Wellness scoring, cognitive tasks, "
                "misokinesia instruments, or documented study-day derived fields."
            ),
            data={"supported": False, "question": normalized_question},
        )
    ranked = sorted(
        (
            (_score_section(query_tokens, section), section)
            for section in _sections()
        ),
        key=lambda item: item[0],
        reverse=True,
    )
    if not ranked or ranked[0][0] < MIN_SCORE:
        return ChatAggregateToolResult(
            tool_name=TOOL_NAME,
            status="insufficient_data",
            message=(
                "The bundled methodology corpus cannot support that topic. "
                "Ask about documented Weather-Wellness scoring, cognitive tasks, "
                "misokinesia instruments, or documented study-day derived fields."
            ),
            data={"supported": False, "question": normalized_question},
        )

    score, section = ranked[0]
    source_path = str(section["source_path"])
    heading = str(section["heading"])
    excerpt = _bounded_text(str(section["content"]), MAX_EXCERPT_CHARS)
    return ChatAggregateToolResult(
        tool_name=TOOL_NAME,
        status="ready",
        message=f"Found methodology context in {source_path} / {heading}.",
        data={
            "supported": True,
            "question": normalized_question,
            "summary": _bounded_text(excerpt, MAX_SUMMARY_CHARS),
            "citation": {"path": source_path, "heading": heading},
            "excerpt": excerpt,
            "retrieval": {"score": score},
        },
    )


__all__ = ["TOOL_NAME", "explain_methodology"]
