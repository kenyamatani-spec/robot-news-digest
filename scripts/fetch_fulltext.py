"""note.com 記事の本文・画像の取り込み。

note の公開 v3 API (https://note.com/api/v3/notes/<key>) から記事本文 HTML を取得し、
プレーンテキスト（画像はマークダウン形式 `![図](url)` で本文中の位置に埋め込み）へ変換する。

- 無料記事: 全文が取得できる
- 有料 / メンバーシップ限定記事: API が返すのは無料公開部分のみ
  （can_read=False で判別し content_partial=True を付す）

sources.yml で `fulltext: true` を付けたソースの記事にのみ適用する。
"""
from __future__ import annotations

import html as htmllib
import json
import os
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

# fetch_news.py と同じ CA バンドルのフォールバック（macOS Python 対策）。
if "SSL_CERT_FILE" not in os.environ:
    try:
        import certifi
        os.environ["SSL_CERT_FILE"] = certifi.where()
    except ImportError:
        pass

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/127.0 Safari/537.36"
)

NOTE_KEY_RE = re.compile(r"https?://note\.com/[^/]+/n/(n[0-9a-f]+)")

_IMG_RE = re.compile(r"<img[^>]+src=[\"\']([^\"\']+)[\"\'][^>]*>", re.I)
_BLOCK_END_RE = re.compile(
    r"</(?:p|h[1-6]|li|blockquote|figure|figcaption|div|ul|ol|table|tr)>", re.I
)

MAX_CONTENT_CHARS = 20_000


def _body_to_text(body_html: str) -> tuple[str, list[str]]:
    """note の本文 HTML → (プレーンテキスト+インライン画像, 画像URLリスト)。"""
    images: list[str] = []

    def _img(m: re.Match) -> str:
        url = htmllib.unescape(m.group(1))
        images.append(url)
        return f"\n![図]({url})\n"

    text = _IMG_RE.sub(_img, body_html)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = _BLOCK_END_RE.sub("\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = htmllib.unescape(text)
    text = "\n".join(ln.strip() for ln in text.split("\n"))
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) > MAX_CONTENT_CHARS:
        text = text[:MAX_CONTENT_CHARS] + "\n\n（長文のため切り詰め / truncated）"
    return text, images


def fetch_note_content(url: str, timeout: float = 10.0) -> dict | None:
    m = NOTE_KEY_RE.match(url)
    if not m:
        return None
    api = f"https://note.com/api/v3/notes/{m.group(1)}"
    try:
        req = urllib.request.Request(
            api, headers={"User-Agent": _UA, "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode("utf-8", errors="replace"))
    except Exception:
        return None
    d = (data or {}).get("data") or {}
    body = d.get("body") or ""
    if not body:
        return None
    content, images = _body_to_text(body)
    if not content:
        return None
    return {
        "content": content,
        "images": images,
        "eyecatch": d.get("eyecatch") or None,
        "partial": d.get("can_read") is False,
    }


def _fulltext_source_names(sources: list[dict]) -> set[str]:
    return {s["name"] for s in sources if s.get("fulltext")}


def _apply(item: dict, res: dict) -> None:
    item["content"] = res["content"]
    item["images"] = res["images"]
    if res["partial"]:
        item["content_partial"] = True
    if not item.get("image") and res["eyecatch"]:
        item["image"] = res["eyecatch"]


def enrich_fulltext(items: list[dict], sources: list[dict], workers: int = 4) -> list[dict]:
    """`fulltext: true` ソース由来の item dict に content / images を付与する。"""
    names = _fulltext_source_names(sources)
    targets = [
        it for it in items
        if it.get("source") in names and not it.get("content") and NOTE_KEY_RE.match(it.get("url", ""))
    ]
    if not targets:
        return items
    print(f"[fulltext] fetching note body for {len(targets)} articles", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=workers) as ex:
        results = list(ex.map(fetch_note_content, [it["url"] for it in targets]))
    hits = 0
    for it, res in zip(targets, results):
        if res:
            _apply(it, res)
            hits += 1
    print(f"[fulltext] +{hits} bodies", file=sys.stderr)
    return items
