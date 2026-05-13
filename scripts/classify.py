"""Classify articles into 4 robot categories + bilingual summary via Claude API."""
from __future__ import annotations

import json
import os
import re
from typing import Any

from anthropic import Anthropic

MODEL = "claude-haiku-4-5-20251001"

CATEGORIES = ["industrial", "military", "service", "home"]

SYSTEM = """You classify robotics news into exactly one of four categories and produce a bilingual (Japanese + English) headline & one-sentence summary.

Categories (use exactly these keys):
- industrial : factory automation, welding/assembly/material-handling robots, cobots, warehouse AMRs/AGVs, agricultural robots, construction robots
- military   : armed drones, UGVs/UAVs for defense, autonomous weapons, military/police-tactical robots
- service    : medical/care/hospitality/cleaning/guidance/education/retail/hotel robots
- home       : consumer products for households: robot vacuums, companion/pet robots, cooking-appliance robots, home-security robots

Tie-break priority when ambiguous: military > industrial > service > home (prefer the more specific category).

If the article is NOT about a physical robot (pure AI/software/chatbot/policy with no robot hardware angle), return category "none" — it will be dropped.

Output STRICT JSON only, no prose, no markdown fence:
{
  "category": "industrial|military|service|home|none",
  "title_ja": "日本語タイトル（30字以内）",
  "title_en": "English title (under 80 chars)",
  "summary_ja": "日本語1文要約（80字以内）",
  "summary_en": "English one-sentence summary (under 160 chars)",
  "tags": ["short", "tags", "max 4"]
}
"""


def _build_user(article: dict) -> str:
    hint = ", ".join(article.get("source_hint") or []) or "(none)"
    return (
        f"Source: {article['source']}\n"
        f"Source category hint (weak prior): {hint}\n"
        f"Original language: {article['lang']}\n"
        f"Title: {article['title']}\n"
        f"Snippet: {article['snippet']}\n"
    )


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    # Strip optional code fence
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    return json.loads(text)


def classify_one(client: Anthropic, article: dict) -> dict | None:
    """Return classification dict, or None if the article should be dropped."""
    resp = client.messages.create(
        model=MODEL,
        max_tokens=600,
        system=SYSTEM,
        messages=[{"role": "user", "content": _build_user(article)}],
    )
    raw = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
    try:
        data = _extract_json(raw)
    except json.JSONDecodeError:
        return None
    cat = data.get("category")
    if cat not in CATEGORIES:
        return None
    return {
        "category": cat,
        "title_ja": data.get("title_ja", article["title"])[:120],
        "title_en": data.get("title_en", article["title"])[:200],
        "summary_ja": data.get("summary_ja", "")[:300],
        "summary_en": data.get("summary_en", "")[:400],
        "tags": [str(t)[:30] for t in (data.get("tags") or [])][:4],
    }


def make_client() -> Anthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise SystemExit("ANTHROPIC_API_KEY is not set")
    return Anthropic(api_key=key)
