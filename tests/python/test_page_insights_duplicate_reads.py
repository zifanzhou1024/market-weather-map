"""Assert that no two reads within the same route share the same first 80 chars.

This guards against the "same chart with two different question framings" UX
bug where a route's ``why_it_matters`` and a section's ``answer`` are so
similar that the FocusBlock adds no new information.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

PAGE_INSIGHTS = Path("public/data/derived/page_insights.json")


def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower()).strip()[:80]


def test_no_duplicate_reads_within_route():
    data = json.loads(PAGE_INSIGHTS.read_text())
    for route_key, route in data.get("routes", {}).items():
        reads = []
        if route.get("why_it_matters"):
            reads.append(("why_it_matters", _normalize(route["why_it_matters"])))
        for section in route.get("sections") or []:
            reads.append(
                (f"sections.{section['id']}.answer", _normalize(section.get("answer", "")))
            )
        # Pairwise distinct
        seen: dict[str, str] = {}
        for label, text in reads:
            if not text:
                continue
            assert text not in seen, (
                f"route {route_key!r}: read {label!r} duplicates {seen[text]!r}: {text!r}"
            )
            seen[text] = label
