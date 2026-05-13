"""RSS feeds -> normalized article dicts."""
from __future__ import annotations

import hashlib
import html
import os
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

# Defensive SSL cert fallback for systems where the default CA bundle is missing
# (notably macOS Python builds without the "Install Certificates.command" step).
if "SSL_CERT_FILE" not in os.environ:
    try:
        import certifi
        os.environ["SSL_CERT_FILE"] = certifi.where()
    except ImportError:
        pass

import feedparser
import yaml
from dateutil import parser as dateparser


@dataclass
class RawArticle:
    id: str
    url: str
    source: str
    source_hint: list[str]
    lang: str
    published_at: str
    title: str
    snippet: str
    image: str | None = None


def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _parse_date(entry) -> str:
    for key in ("published", "updated", "created"):
        val = entry.get(key)
        if val:
            try:
                dt = dateparser.parse(val)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc).isoformat()
            except (ValueError, TypeError):
                continue
    return datetime.now(timezone.utc).isoformat()


def _hash_url(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]


def _extract_image(entry) -> str | None:
    for mc in entry.get("media_content", []) or []:
        if mc.get("url"):
            return mc["url"]
    for mt in entry.get("media_thumbnail", []) or []:
        if mt.get("url"):
            return mt["url"]
    for enc in entry.get("enclosures", []) or []:
        href = enc.get("href") or enc.get("url")
        if href and (enc.get("type") or "").startswith("image/"):
            return href
    for field in ("content", "summary", "description"):
        val = entry.get(field)
        if isinstance(val, list) and val:
            val = val[0].get("value")
        if not val or not isinstance(val, str):
            continue
        m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', val)
        if m:
            return m.group(1)
    return None


def load_sources(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)["sources"]


def fetch_all(sources: list[dict], per_source_limit: int = 15) -> list[RawArticle]:
    out: list[RawArticle] = []
    for src in sources:
        feed = feedparser.parse(src["url"])
        for entry in feed.entries[:per_source_limit]:
            url = entry.get("link") or ""
            if not url:
                continue
            title = _strip_html(entry.get("title", ""))
            summary = _strip_html(entry.get("summary", "") or entry.get("description", ""))
            snippet = summary[:600]
            out.append(
                RawArticle(
                    id=_hash_url(url),
                    url=url,
                    source=src["name"],
                    source_hint=src.get("hint") or [],
                    lang=src.get("lang", "en"),
                    published_at=_parse_date(entry),
                    title=title,
                    snippet=snippet,
                    image=_extract_image(entry),
                )
            )
    return out


def to_dicts(articles: Iterable[RawArticle]) -> list[dict]:
    return [asdict(a) for a in articles]


# === Article-page image enrichment (og:image / twitter:image) ===

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/127.0 Safari/537.36"
)

_OG_PATTERNS = [
    re.compile(r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)["\']', re.I),
    re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image(?::secure_url)?["\']', re.I),
    re.compile(r'<meta[^>]+name=["\']twitter:image(?::src)?["\'][^>]+content=["\']([^"\']+)["\']', re.I),
    re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image(?::src)?["\']', re.I),
    re.compile(r'<link[^>]+rel=["\']image_src["\'][^>]+href=["\']([^"\']+)["\']', re.I),
]


def _decode(raw: bytes, ctype: str) -> str:
    enc = "utf-8"
    m = re.search(r"charset=([A-Za-z0-9_-]+)", ctype or "")
    if m:
        enc = m.group(1)
    try:
        return raw.decode(enc, errors="replace")
    except LookupError:
        return raw.decode("utf-8", errors="replace")


def _find_og(html_text: str) -> str | None:
    for pat in _OG_PATTERNS:
        m = pat.search(html_text)
        if m:
            return html.unescape(m.group(1).strip())
    return None


def _follow_google_news(html_text: str) -> str | None:
    # Try to extract publisher URL from a Google News interstitial.
    for pat in (
        re.compile(r'data-n-au=["\'](https?://[^"\']+)["\']'),
        re.compile(r'<a[^>]+href=["\'](https?://(?!news\.google\.|www\.google\.)[^"\']+)["\']'),
        re.compile(r'<meta[^>]+http-equiv=["\']refresh["\'][^>]+url=([^"\']+)["\']', re.I),
    ):
        m = pat.search(html_text)
        if m:
            return html.unescape(m.group(1).strip())
    return None


def fetch_og_image(url: str, timeout: float = 8.0, _depth: int = 0) -> str | None:
    if _depth > 1:
        return None
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": _UA,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "ja,en;q=0.8",
        })
        with urllib.request.urlopen(req, timeout=timeout) as r:
            ctype = r.headers.get("Content-Type", "")
            raw = r.read(400_000)
            final_url = r.geturl()
    except Exception:
        return None
    text = _decode(raw, ctype)
    img = _find_og(text)
    if img:
        return urllib.parse.urljoin(final_url, img)
    if "news.google.com" in final_url:
        target = _follow_google_news(text)
        if target and target != url:
            return fetch_og_image(target, timeout=timeout, _depth=_depth + 1)
    return None


def enrich_images(articles: list[RawArticle], max_fetch: int = 60, workers: int = 8) -> list[RawArticle]:
    pending = [a for a in articles if not a.image][:max_fetch]
    if not pending:
        return articles
    print(f"[enrich] fetching og:image for {len(pending)} articles", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=workers) as ex:
        results = list(ex.map(fetch_og_image, [a.url for a in pending]))
    hits = 0
    for a, img in zip(pending, results):
        if img:
            a.image = img
            hits += 1
    print(f"[enrich] +{hits} images", file=sys.stderr)
    return articles
