"""Orchestrator: fetch RSS -> classify new items -> merge into data/news.json."""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from classify import classify_one, make_client
from fetch_news import enrich_images, fetch_all, load_sources, to_dicts

ROOT = Path(__file__).resolve().parent.parent
SOURCES_PATH = ROOT / "data" / "sources.yml"
NEWS_PATH = ROOT / "data" / "news.json"

MAX_ITEMS_KEPT = 200
MAX_NEW_CLASSIFY_PER_RUN = 80


def load_existing() -> dict:
    if NEWS_PATH.exists():
        with NEWS_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and "items" in data:
            return data
    return {"updated_at": None, "items": []}


def main() -> int:
    sources = load_sources(SOURCES_PATH)
    raw = fetch_all(sources)
    print(f"[fetch] {len(raw)} entries across {len(sources)} sources", file=sys.stderr)
    enrich_images(raw, max_fetch=80)

    existing = load_existing()
    known_ids = {item["id"] for item in existing["items"]}
    new_items = [a for a in to_dicts(raw) if a["id"] not in known_ids]
    print(f"[dedupe] {len(new_items)} new entries", file=sys.stderr)

    if len(new_items) > MAX_NEW_CLASSIFY_PER_RUN:
        new_items.sort(key=lambda a: a["published_at"], reverse=True)
        new_items = new_items[:MAX_NEW_CLASSIFY_PER_RUN]
        print(f"[dedupe] capped to {MAX_NEW_CLASSIFY_PER_RUN}", file=sys.stderr)

    client = make_client() if new_items else None
    classified: list[dict] = []
    for i, art in enumerate(new_items, 1):
        try:
            result = classify_one(client, art)
        except Exception as e:
            print(f"[classify] {i}/{len(new_items)} error: {e}", file=sys.stderr)
            time.sleep(2)
            continue
        if not result:
            print(f"[classify] {i}/{len(new_items)} dropped: {art['title'][:60]}", file=sys.stderr)
            continue
        classified.append({
            "id": art["id"],
            "url": art["url"],
            "source": art["source"],
            "published_at": art["published_at"],
            "lang": art["lang"],
            "image": art.get("image"),
            **result,
        })
        print(f"[classify] {i}/{len(new_items)} {result['category']} {art['title'][:60]}", file=sys.stderr)

    merged = classified + existing["items"]
    merged.sort(key=lambda a: a["published_at"], reverse=True)
    merged = merged[:MAX_ITEMS_KEPT]

    out = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "items": merged,
    }
    NEWS_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[write] {NEWS_PATH} now has {len(merged)} items", file=sys.stderr)

    # Also refresh topic / Chinese-maker stocks (accumulating).
    try:
        from seed_topics import main as seed_topics_main
        seed_topics_main()
    except Exception as e:
        print(f"[topics] skipped: {e}", file=sys.stderr)
    # Generate static digest for NotebookLM / plain-HTML crawlers.
    try:
        from generate_digest import main as digest_main
        digest_main()
    except Exception as e:
        print(f"[digest] skipped: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
