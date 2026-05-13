"""Classify articles into 4 robot categories + bilingual summary via Gemini API."""
from __future__ import annotations

import json
import os
import re
from typing import Any

from google import genai
from google.genai import types

# Cheap, fast — sufficient for short JSON classification & bilingual summary.
# To upgrade quality: "gemini-2.5-flash" (~5x cost) or "gemini-2.5-pro".
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")

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
    text = (text or "").strip()
    # Strip optional code fence
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    return json.loads(text)


def classify_one(client: genai.Client, article: dict) -> dict | None:
    """Return classification dict, or None if the article should be dropped."""
    try:
        resp = client.models.generate_content(
            model=MODEL,
            contents=_build_user(article),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM,
                response_mime_type="application/json",
                temperature=0,
                max_output_tokens=600,
            ),
        )
    except Exception:
        return None
    raw = getattr(resp, "text", "") or ""
    try:
        data = _extract_json(raw)
    except json.JSONDecodeError:
        return None
    cat = data.get("category")
    if cat not in CATEGORIES:
        return None
    return {
        "category": cat,
        "title_ja": (data.get("title_ja") or article["title"])[:120],
        "title_en": (data.get("title_en") or article["title"])[:200],
        "summary_ja": (data.get("summary_ja") or "")[:300],
        "summary_en": (data.get("summary_en") or "")[:400],
        "tags": [str(t)[:30] for t in (data.get("tags") or [])][:4],
    }


def make_client() -> genai.Client:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise SystemExit("GEMINI_API_KEY is not set")
    return genai.Client(api_key=key)
