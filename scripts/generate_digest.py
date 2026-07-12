"""Generate digest.md — a static markdown view of news.json + topics.json.

Designed so NotebookLM (and other plain-HTML crawlers) can ingest the content
without running JavaScript. Output:
- digest.md            : combined Japanese + English digest (master)
- digest-index.html    : tiny static landing page that lists links to digest.md
                         and references the SPA — works as a Pages entry point
                         that NotebookLM can crawl.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NEWS_PATH = ROOT / "data" / "news.json"
TOPICS_PATH = ROOT / "data" / "topics.json"
DIGEST_MD = ROOT / "digest.md"
DIGEST_HTML = ROOT / "digest.html"

JST = timezone(timedelta(hours=9))

CAT_LABEL_JA = {
    "industrial": "産業",
    "military": "軍事",
    "service": "サービス",
    "home": "家庭",
}
CAT_LABEL_EN = {
    "industrial": "INDUSTRIAL",
    "military": "MILITARY",
    "service": "SERVICE",
    "home": "HOME",
}


def fmt_jst(iso: str | None) -> str:
    if not iso:
        return "—"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(JST)
        return dt.strftime("%Y-%m-%d %H:%M JST")
    except Exception:
        return iso


def fmt_date(iso: str | None) -> str:
    if not iso:
        return ""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(JST)
        return dt.strftime("%Y.%m.%d")
    except Exception:
        return iso[:10]


def md_escape(s: str) -> str:
    return (s or "").replace("\n", " ").replace("|", "\\|").strip()


def render_news_section(items: list[dict]) -> str:
    items = sorted(items, key=lambda x: x.get("published_at", ""), reverse=True)
    if not items:
        return "_該当する記事はありません / no items_\n"

    out: list[str] = []
    # Today's top story
    if items:
        top = items[0]
        out.append("### 🏁 今日の一面 / Top Story\n")
        out.append(f"**[{md_escape(top.get('title_ja') or top.get('title_en'))}]({top['url']})**\n")
        out.append(f"- カテゴリ / Category: `{CAT_LABEL_JA.get(top['category'])} / {CAT_LABEL_EN.get(top['category'])}`")
        out.append(f"- ソース / Source: {md_escape(top.get('source',''))}")
        out.append(f"- 公開 / Published: {fmt_date(top.get('published_at'))}\n")
        if top.get("summary_ja"):
            out.append(f"> {md_escape(top['summary_ja'])}\n")
        if top.get("summary_en") and top.get("summary_en") != top.get("summary_ja"):
            out.append(f"> _EN:_ {md_escape(top['summary_en'])}\n")
        out.append("")

    # Per-category sections
    for cat in ("industrial", "military", "service", "home"):
        sub = [i for i in items if i.get("category") == cat]
        if not sub:
            continue
        out.append(f"### {CAT_LABEL_JA[cat]} / {CAT_LABEL_EN[cat]} ({len(sub)} 件)\n")
        for it in sub:
            title = md_escape(it.get("title_ja") or it.get("title_en"))
            src = md_escape(it.get("source", ""))
            date = fmt_date(it.get("published_at"))
            out.append(f"- [{title}]({it['url']}) — *{src}* · {date}")
            summary = it.get("summary_ja") or it.get("summary_en")
            if summary:
                out.append(f"  > {md_escape(summary)[:220]}")
        out.append("")
    return "\n".join(out)


def render_fulltext_section(items: list[dict]) -> str:
    """fulltext ソース（note 等）から取り込んだ本文＋画像のアーカイブ。"""
    subs = [i for i in items if i.get("content")]
    if not subs:
        return ""
    subs = sorted(subs, key=lambda x: x.get("published_at", ""), reverse=True)
    out: list[str] = ["## 📖 全文アーカイブ / Full-text Archive\n"]
    out.append(
        "> `fulltext: true` を指定したソースの本文・画像の取り込み。"
        "有料・メンバーシップ限定記事は**無料公開部分のみ**収録。\n"
    )
    for it in subs:
        title = md_escape(it.get("title_ja") or it.get("title_en") or "")
        out.append(f"### [{title}]({it['url']})\n")
        out.append(f"- ソース / Source: {md_escape(it.get('source', ''))} · {fmt_date(it.get('published_at'))}")
        if it.get("content_partial"):
            out.append("- ⚠️ メンバーシップ/有料記事のため無料公開部分のみ / Free preview only")
        out.append("")
        if it.get("image"):
            out.append(f"![見出し画像]({it['image']})\n")
        out.append(it["content"].strip())
        out.append("\n---\n")
    return "\n".join(out)


def render_topics_section(topics: list[dict]) -> str:
    if not topics:
        return ""
    out: list[str] = []
    tech = [t for t in topics if not t.get("is_company")]
    makers = [t for t in topics if t.get("is_company")]

    def render_group(label_ja: str, label_en: str, group: list[dict]) -> None:
        if not group:
            return
        out.append(f"## {label_ja} / {label_en}\n")
        for t in group:
            name = t.get("name_ja") or t.get("name_en") or t["id"]
            items = t.get("items", [])
            out.append(f"### {name} ({len(items)} 件 stocked)\n")
            for it in items[:15]:
                title = md_escape(it.get("title_ja") or it.get("title_en"))
                src = md_escape(it.get("source", ""))
                date = fmt_date(it.get("published_at"))
                out.append(f"- [{title}]({it['url']}) — *{src}* · {date}")
            if len(items) > 15:
                out.append(f"- _…and {len(items) - 15} more_")
            out.append("")

    render_group("📚 トピック (技術)", "Tech Topics", tech)
    render_group("🏭 中国大手メーカー", "Major Chinese Makers", makers)
    return "\n".join(out)


def main() -> int:
    news = json.loads(NEWS_PATH.read_text(encoding="utf-8")) if NEWS_PATH.exists() else {"items": []}
    topics = json.loads(TOPICS_PATH.read_text(encoding="utf-8")) if TOPICS_PATH.exists() else {"topics": []}
    news_items = news.get("items", [])
    topic_list = topics.get("topics", [])

    counts = {c: sum(1 for i in news_items if i.get("category") == c) for c in CAT_LABEL_JA}
    total_topic_items = sum(len(t.get("items", [])) for t in topic_list)
    updated = fmt_jst(news.get("updated_at"))

    header = f"""# ロボットニュース ダイジェスト / Robot News Digest

> **集計サイト / Live site:** [ロボットニュース](./index.html)
> **最終更新 / Last updated:** {updated}
> **集計件数 / Article counts:** 産業 {counts['industrial']} · 軍事 {counts['military']} · サービス {counts['service']} · 家庭 {counts['home']}
> **トピックストック / Topics stocked:** {len(topic_list)} 件 · 合計 {total_topic_items} 記事
>
> このページは NotebookLM など静的クローラー向けの **テキスト・ダイジェスト**です。
> 各リンクは元記事に直接ジャンプします。

---

## 📰 今朝の配信 / Today's Dispatch

"""

    body = render_news_section(news_items)
    fulltext_md = render_fulltext_section(news_items)
    topics_md = render_topics_section(topic_list)

    full = header + body + "\n---\n\n"
    if fulltext_md:
        full += fulltext_md + "\n"
    full += topics_md + "\n"
    DIGEST_MD.write_text(full, encoding="utf-8")
    print(f"[digest] wrote {DIGEST_MD} ({len(full):,} chars)")

    # Static HTML mirror so NotebookLM-style crawlers that prefer .html also work.
    html = f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>ロボットニュース ダイジェスト / Robot News Digest</title>
<meta name="description" content="ロボット業界ニュースの日次ダイジェスト (テキスト版・NotebookLM対応)" />
<style>
  body {{ font-family: -apple-system, "Hiragino Sans", system-ui, sans-serif;
         max-width: 900px; margin: 2em auto; padding: 0 1em; line-height: 1.7; color: #1A1340; }}
  h1, h2, h3 {{ line-height: 1.3; }}
  h1 {{ border-bottom: 3px solid #1A1340; padding-bottom: .3em; }}
  h2 {{ border-bottom: 2px dashed #ccc; padding-bottom: .2em; margin-top: 2em; }}
  a {{ color: #2563EB; }}
  blockquote {{ border-left: 4px solid #FBBF24; padding-left: 1em; color: #555; margin: .4em 0; }}
  code {{ background: #FFF7EC; padding: 1px 6px; border-radius: 3px; }}
  img {{ max-width: 100%; height: auto; border-radius: 6px; }}
</style>
</head>
<body>
<article>
{markdown_to_minimal_html(full)}
</article>
</body>
</html>
"""
    DIGEST_HTML.write_text(html, encoding="utf-8")
    print(f"[digest] wrote {DIGEST_HTML} ({len(html):,} chars)")
    return 0


def markdown_to_minimal_html(md: str) -> str:
    """Tiny markdown→HTML converter sufficient for the digest output above."""
    import re
    lines = md.splitlines()
    out: list[str] = []
    in_list = False
    for line in lines:
        stripped = line.strip()
        # close list when needed
        if not stripped.startswith("-") and in_list:
            out.append("</ul>")
            in_list = False
        if stripped.startswith("# "):
            out.append(f"<h1>{_inline(stripped[2:])}</h1>")
        elif stripped.startswith("## "):
            out.append(f"<h2>{_inline(stripped[3:])}</h2>")
        elif stripped.startswith("### "):
            out.append(f"<h3>{_inline(stripped[4:])}</h3>")
        elif stripped.startswith("> "):
            out.append(f"<blockquote>{_inline(stripped[2:])}</blockquote>")
        elif stripped.startswith("!["):
            m = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", stripped)
            if m:
                out.append(f'<img src="{m.group(2)}" alt="{m.group(1)}" loading="lazy" />')
        elif stripped.startswith("- "):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{_inline(stripped[2:])}</li>")
        elif stripped == "---":
            out.append("<hr/>")
        elif stripped == "":
            out.append("")
        else:
            out.append(f"<p>{_inline(stripped)}</p>")
    if in_list:
        out.append("</ul>")
    return "\n".join(out)


def _inline(text: str) -> str:
    import re
    # links [text](url)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', text)
    # bold
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    # italics
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", text)
    # code
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    return text


if __name__ == "__main__":
    raise SystemExit(main())
