"""Seed data/news.json with real RSS articles, classified by keyword (no LLM).

Use this when you want to preview the site without an ANTHROPIC_API_KEY.
The proper pipeline (scripts/build.py) uses Claude for classification.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch_news import enrich_images, fetch_all, load_sources, to_dicts

ROOT = Path(__file__).resolve().parent.parent
NEWS_PATH = ROOT / "data" / "news.json"
SOURCES_PATH = ROOT / "data" / "sources.yml"

# Per-category cap so the grid stays balanced for the demo.
PER_CATEGORY_CAP = 14

# Keyword patterns are scored; the highest-scoring category wins.
# Each pattern matches keywords in title + snippet (EN/JA).
PATTERNS: dict[str, list[tuple[re.Pattern, int]]] = {
    "military": [
        (re.compile(r"\b(military|defense|defence|army|navy|air force|soldier|"
                    r"weapon|missile|combat|warfare|battlefield|"
                    r"UGV|UAV|drone strike|armed drone|DARPA|pentagon|tactical|"
                    r"autonomous weapon|loitering munition|kamikaze drone)\b",
                    re.I), 3),
        (re.compile(r"軍|防衛|自衛隊|武器|ミサイル|戦闘|軍用|国防|無人機"), 3),
        (re.compile(r"\b(ukraine|russia|israel|nato|pentagon)\b", re.I), 1),
    ],
    "industrial": [
        (re.compile(r"\b(factory|manufactur|warehouse|logistics|"
                    r"AMR|AGV|cobot|assembly line|welding|industrial robot|"
                    r"agricultur|farm robot|construction robot|"
                    r"palletiz|pick.?and.?place|robotic arm|foundation model|"
                    r"foxconn|automaker|humanoid|dexterit|"
                    r"supply chain|inventory)\b", re.I), 3),
        (re.compile(r"工場|製造|産業用|倉庫|物流|農業|建設|協働ロボ|"
                    r"溶接|組立|人型|ヒューマノイド|アーム|生産"), 3),
        (re.compile(r"\b(automation|automate)\b", re.I), 1),
    ],
    "service": [
        (re.compile(r"\b(hospital|medical|surger|healthcare|nursing|elderly|"
                    r"caregiv|caregiving|care robot|"
                    r"restaurant|hotel|hospitality|retail|cleaning robot|"
                    r"educat|school robot|"
                    r"delivery robot|guidance robot|reception robot|barista|"
                    r"food.?service)\b", re.I), 3),
        (re.compile(r"医療|手術|介護|配膳|接客|清掃|ホテル|病院|"
                    r"レストラン|学校|案内|教育|サービスロボ"), 3),
    ],
    "home": [
        (re.compile(r"\b(roomba|vacuum|household robot|home robot|consumer robot|"
                    r"pet robot|companion robot|cooking robot|home.security|"
                    r"smart home|familiar)\b", re.I), 4),
        (re.compile(r"ルンバ|家庭用|掃除機|家庭向け|"
                    r"ペットロボ|コンパニオン|抱きしめ"), 4),
    ],
}

ROBOT_HINT = re.compile(
    r"robot|drone|automat|autonomous|cobot|AMR|AGV|UGV|UAV|humanoid|"
    r"ロボ|ドローン|自動化|自律|無人|人型",
    re.I,
)

# Fallback when nothing matches but the text mentions robotics:
# most generic robot news is industrial.
DEFAULT_CATEGORY = "industrial"


def classify_by_keywords(article: dict) -> str | None:
    hay = f"{article['title']} {article['snippet']}"
    if not ROBOT_HINT.search(hay):
        return None
    scores = {cat: 0 for cat in PATTERNS}
    for cat, rules in PATTERNS.items():
        for pat, weight in rules:
            if pat.search(hay):
                scores[cat] += weight
    if all(v == 0 for v in scores.values()):
        return DEFAULT_CATEGORY
    # Tie-break priority: military > industrial > service > home
    priority = ["military", "industrial", "service", "home"]
    best_score = max(scores.values())
    for cat in priority:
        if scores[cat] == best_score:
            return cat
    return DEFAULT_CATEGORY


def stub_summary(article: dict) -> tuple[str, str, str, str]:
    """Return (title_ja, title_en, summary_ja, summary_en).

    Without LLM translation we mirror the original in both fields. The
    front-end shows whichever the user toggles to. The build.py pipeline
    replaces these with real bilingual versions.
    """
    title = article["title"][:200]
    summary = article["snippet"][:240]
    return (title, title, summary, summary)


def main() -> int:
    sources = load_sources(SOURCES_PATH)
    raw = fetch_all(sources, per_source_limit=10)
    print(f"[seed] fetched {len(raw)} entries", file=sys.stderr)

    # 1) Classify and bucket first so we know which items are robot-relevant.
    bucketed: dict[str, list] = {"industrial": [], "military": [], "service": [], "home": []}
    for art in raw:
        cat = classify_by_keywords({"title": art.title, "snippet": art.snippet})
        if cat is None:
            continue
        bucketed[cat].append(art)

    # 2) Cap per category, sorted by date desc.
    kept: list = []
    for cat, bucket in bucketed.items():
        bucket.sort(key=lambda a: a.published_at, reverse=True)
        for art in bucket[:PER_CATEGORY_CAP]:
            kept.append((cat, art))
    print(f"[seed] kept {len(kept)} after classification", file=sys.stderr)

    # 3) Only now enrich images for the items we'll actually keep.
    raw_kept = [a for _, a in kept]
    enrich_images(raw_kept, max_fetch=len(raw_kept))

    # 4) Convert to output dicts.
    items: list[dict] = []
    for cat, art in kept:
        title_ja, title_en, summary_ja, summary_en = stub_summary({"title": art.title, "snippet": art.snippet})
        items.append({
            "id": art.id,
            "url": art.url,
            "source": art.source,
            "published_at": art.published_at,
            "lang": art.lang,
            "image": art.image,
            "category": cat,
            "title_ja": title_ja,
            "title_en": title_en,
            "summary_ja": summary_ja,
            "summary_en": summary_en,
            "tags": ["sample"],
        })

    items.sort(key=lambda x: x["published_at"], reverse=True)

    counts = {c: 0 for c in bucketed}
    for it in items:
        counts[it["category"]] += 1
    print(f"[seed] kept {len(items)}: {counts}", file=sys.stderr)

    out = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "items": items,
    }
    NEWS_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[seed] wrote {NEWS_PATH}", file=sys.stderr)
    # Regenerate the static digest (for NotebookLM etc.).
    try:
        from generate_digest import main as digest_main
        digest_main()
    except Exception as e:
        print(f"[digest] skipped: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
