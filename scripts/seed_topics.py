"""Fetch topic / Chinese-maker searches and merge into data/topics.json.

Each topic in data/topics.yml is queried against Google News (bilingual).
Optional `sns_url` lets you point at an RSS proxy (e.g. RSSHub) for SNS feeds.
Articles accumulate across runs (dedup by URL), capped per topic.
"""
from __future__ import annotations

import html
import json
import re
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch_news import _hash_url, _parse_date, _strip_html  # type: ignore

import feedparser
import yaml

ROOT = Path(__file__).resolve().parent.parent
TOPICS_YML = ROOT / "data" / "topics.yml"
OUT_PATH = ROOT / "data" / "topics.json"

PER_QUERY_LIMIT = 12
MAX_KEEP_PER_TOPIC = 60


def gnews_url(query: str, lang: str) -> str:
    q = urllib.parse.quote(query)
    if lang == "ja":
        return f"https://news.google.com/rss/search?q={q}&hl=ja&gl=JP&ceid=JP:ja"
    return f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"


def fetch_entries(url: str, lang: str, source_label: str) -> list[dict]:
    out = []
    feed = feedparser.parse(url)
    for e in feed.entries[:PER_QUERY_LIMIT]:
        link = e.get("link")
        if not link:
            continue
        title = _strip_html(e.get("title", ""))
        snippet = _strip_html(e.get("summary", "") or e.get("description", ""))[:400]
        src_title = ""
        if hasattr(e, "source") and isinstance(e.source, dict):
            src_title = e.source.get("title", "")
        out.append({
            "id": _hash_url(link),
            "url": link,
            "source": src_title or source_label,
            "lang": lang,
            "published_at": _parse_date(e),
            "title_ja": title,
            "title_en": title,
            "summary_ja": snippet,
            "summary_en": snippet,
        })
    return out


def fetch_topic(topic: dict) -> list[dict]:
    found: list[dict] = []
    # 1) Direct feed URL (RSS / Atom). Use this for note.com, RSSHub, etc.
    feed_url = topic.get("feed_url")
    if feed_url:
        flang = topic.get("feed_lang", "ja")
        label = topic.get("feed_label") or f"{topic.get('name_' + flang, topic['id'])}"
        try:
            found.extend(fetch_entries(feed_url, flang, label))
        except Exception as e:
            print(f"[topics] {topic['id']} feed error: {e}", file=sys.stderr)
    # 2) Google News search (bilingual)
    for lang in ("ja", "en"):
        q = topic.get(f"query_{lang}")
        if not q:
            continue
        label = f"Google News ({lang.upper()}) · {topic.get('name_' + lang, topic['id'])}"
        try:
            found.extend(fetch_entries(gnews_url(q, lang), lang, label))
        except Exception as e:
            print(f"[topics] {topic['id']} {lang} error: {e}", file=sys.stderr)
    # 3) Optional SNS source (RSSHub / Nitter) — language defaults to en
    sns = topic.get("sns_url")
    if sns:
        try:
            found.extend(fetch_entries(sns, topic.get("sns_lang", "en"), f"SNS · {topic['id']}"))
        except Exception as e:
            print(f"[topics] {topic['id']} sns error: {e}", file=sys.stderr)
    return found


def load_existing() -> dict:
    if OUT_PATH.exists():
        try:
            with OUT_PATH.open("r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and "topics" in data:
                return data
        except Exception:
            pass
    return {"updated_at": None, "topics": []}


def main() -> int:
    with TOPICS_YML.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    topics_cfg = cfg.get("topics", [])
    existing = load_existing()
    by_id = {t["id"]: t for t in existing.get("topics", [])}

    out_topics: list[dict] = []
    for tcfg in topics_cfg:
        tid = tcfg["id"]
        print(f"[topics] {tid}: fetching...", file=sys.stderr)
        fresh = fetch_topic(tcfg)
        # merge with existing
        prev = by_id.get(tid) or {"items": []}
        seen = {it["id"] for it in prev["items"]}
        added = 0
        merged = list(prev["items"])
        for it in fresh:
            if it["id"] in seen:
                continue
            seen.add(it["id"])
            merged.append(it)
            added += 1
        merged.sort(key=lambda x: x["published_at"], reverse=True)
        merged = merged[:MAX_KEEP_PER_TOPIC]
        out_topics.append({
            "id": tid,
            "name_ja": tcfg.get("name_ja", tid),
            "name_en": tcfg.get("name_en", tid),
            "color": tcfg.get("color", "#1A1340"),
            "is_company": bool(tcfg.get("is_company")),
            "items": merged,
        })
        print(f"[topics] {tid}: +{added} new, total {len(merged)}", file=sys.stderr)

    out = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "topics": out_topics,
    }
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[topics] wrote {OUT_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
