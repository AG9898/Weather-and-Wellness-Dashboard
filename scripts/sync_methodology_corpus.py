#!/usr/bin/env python3
"""Generate or check the backend-bundled AI chat methodology corpus."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Sequence


SOURCE_DIRS = (
    Path("docs/labs/weather-wellness/weather"),
    Path("docs/labs/weather-wellness/misokinesia"),
)
BUNDLE_PATH = Path("backend/app/methodology/corpus.json")
CORPUS_VERSION = 1
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")


def _normalize_markdown(text: str) -> str:
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").split("\n")]
    return "\n".join(lines).strip() + "\n"


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "section"


def _iter_source_docs(root: Path) -> list[Path]:
    docs: list[Path] = []
    for source_dir in SOURCE_DIRS:
        docs.extend((root / source_dir).glob("**/*.md"))
    return sorted(docs, key=lambda path: path.relative_to(root).as_posix())


def _split_sections(path: Path, repo_root: Path) -> list[dict[str, str]]:
    rel_path = path.relative_to(repo_root).as_posix()
    text = _normalize_markdown(path.read_text(encoding="utf-8"))
    sections: list[dict[str, str]] = []
    current_heading = path.stem
    current_level = 1
    current_lines: list[str] = []

    def flush() -> None:
        content = "\n".join(current_lines).strip()
        if not content:
            return
        sections.append(
            {
                "id": f"{rel_path}#{_slugify(current_heading)}",
                "source_path": rel_path,
                "heading": current_heading,
                "level": str(current_level),
                "content": content,
                "sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
            }
        )

    for line in text.split("\n"):
        match = HEADING_RE.match(line)
        if match:
            flush()
            current_level = len(match.group(1))
            current_heading = match.group(2).strip()
            current_lines = [line]
        else:
            current_lines.append(line)
    flush()
    return sections


def build_corpus(repo_root: Path) -> dict[str, object]:
    repo_root = repo_root.resolve()
    source_docs = _iter_source_docs(repo_root)
    sections: list[dict[str, str]] = []
    for source_doc in source_docs:
        sections.extend(_split_sections(source_doc, repo_root))

    return {
        "version": CORPUS_VERSION,
        "source_dirs": [path.as_posix() for path in SOURCE_DIRS],
        "source_docs": [path.relative_to(repo_root).as_posix() for path in source_docs],
        "sections": sections,
    }


def _canonical_json(corpus: dict[str, object]) -> str:
    return json.dumps(corpus, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def sync_corpus(repo_root: Path) -> None:
    bundle_path = repo_root / BUNDLE_PATH
    bundle_path.parent.mkdir(parents=True, exist_ok=True)
    bundle_path.write_text(_canonical_json(build_corpus(repo_root)), encoding="utf-8")


def check_corpus(repo_root: Path) -> tuple[bool, str]:
    expected = _canonical_json(build_corpus(repo_root))
    bundle_path = repo_root / BUNDLE_PATH
    if not bundle_path.exists():
        return False, f"Missing bundled corpus: {BUNDLE_PATH.as_posix()}"
    actual = bundle_path.read_text(encoding="utf-8")
    if actual != expected:
        return (
            False,
            "Bundled methodology corpus is out of sync. Run "
            "python scripts/sync_methodology_corpus.py",
        )
    return True, "Bundled methodology corpus is in sync."


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if corpus is stale")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="repository root; defaults to this script's parent repository",
    )
    args = parser.parse_args(argv)

    repo_root = args.root.resolve()
    if args.check:
        ok, message = check_corpus(repo_root)
        print(message)
        return 0 if ok else 1

    sync_corpus(repo_root)
    print(f"Wrote {BUNDLE_PATH.as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
