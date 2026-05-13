(() => {
  const CATEGORIES = ["industrial", "military", "service", "home"];
  const COLOR = {
    industrial: "#2563EB",
    military:   "#EF4444",
    service:    "#10B981",
    home:       "#F59E0B",
  };

  const state = {
    lang: detectLang(),
    category: "all",
    query: "",
    items: [],
    rawItems: [],
    topics: [],
    topicFilter: "all",
  };

  const I18N = {
    ja: {
      "kicker": "ROBOT NEWS DIGEST · 毎朝07:15 JST更新",
      "hero.kicker": "DAILY · ロボットニュース",
      "hero.title": "ロボットの<br/><em>今日</em>を、<br/>ひと目で。",
      "hero.sub": "産業 / 軍事 / サービス / 家庭 — RSS と Claude AI で毎朝整理。",
      "stat.donut": "カテゴリ別の本日",
      "stat.bars": "過去7日の配信数",
      "stat.pipe": "RSS → Claude AI → 4カテゴリ",
      "m.total": "TOTAL",
      "m.updated": "UPDATED",
      "m.items": "件",
      "cat.all": "すべて",
      "cat.industrial": "産業",
      "cat.military": "軍事",
      "cat.service": "サービス",
      "cat.home": "家庭",
      "sec.today.en": "TODAY'S DISPATCH",
      "sec.today.ja": "今朝の配信",
      "sec.top.headline": "今日の一面",
      "sec.other": "他の最新",
      "sec.book.en": "RECENT BOOKMARKS",
      "sec.book.ja": "最新ブックマーク",
      "sec.arch.en": "ARCHIVE",
      "sec.arch.ja": "過去の配信",
      "arch.help": "配信日ごとのカテゴリ別件数を可視化（高さ＝件数、色＝カテゴリ）",
      "sec.topic.en": "TOPICS & MAKERS",
      "sec.topic.ja": "トピック・メーカー収集",
      "topics.help": "<code>data/topics.yml</code> に登録した検索クエリで自動収集・ストック。中国大手メーカー (UBTECH / Unitree / Fourier 等) は SNS / ニュースを横断検索。",
      "topic.tab.all": "すべて",
      "topic.tab.tech": "技術トピック",
      "topic.tab.makers": "中国大手メーカー",
      "topic.more": "もっと見る",
      "topic.tag.tech": "技術",
      "topic.tag.maker": "メーカー",
      "topic.count": "件ストック",
      "empty.today": "本日の配信はまだありません。",
      "empty.archive": "過去の配信はまだありません。",
      "empty.none": "該当する記事がありません",
      "loading": "読み込み中…",
      "footer.tagline": "ロボット業界のニュースを毎朝整理 — 産業 / 軍事 / サービス / 家庭",
      "footer.curated": "CURATED · ROBOT NEWS DIGEST",
    },
    en: {
      "kicker": "ROBOT NEWS DIGEST · UPDATED 07:15 JST DAILY",
      "hero.kicker": "DAILY · ROBOT NEWS",
      "hero.title": "Today in<br/><em>robotics</em><br/>at a glance.",
      "hero.sub": "Industrial / Military / Service / Home — curated every morning by Claude.",
      "stat.donut": "Today by category",
      "stat.bars": "Last 7 days of dispatch",
      "stat.pipe": "RSS → Claude AI → 4 categories",
      "m.total": "TOTAL",
      "m.updated": "UPDATED",
      "m.items": "items",
      "cat.all": "ALL",
      "cat.industrial": "INDUSTRIAL",
      "cat.military": "MILITARY",
      "cat.service": "SERVICE",
      "cat.home": "HOME",
      "sec.today.en": "TODAY'S DISPATCH",
      "sec.today.ja": "Today's Dispatch",
      "sec.top.headline": "TOP STORY",
      "sec.other": "Other Items",
      "sec.book.en": "RECENT BOOKMARKS",
      "sec.book.ja": "Recent Bookmarks",
      "sec.arch.en": "ARCHIVE",
      "sec.arch.ja": "Archive",
      "arch.help": "Daily volume by category — bar height = item count, color = category.",
      "sec.topic.en": "TOPICS & MAKERS",
      "sec.topic.ja": "Topics & Makers",
      "topics.help": "Saved searches defined in <code>data/topics.yml</code>. Chinese majors (UBTECH / Unitree / Fourier, etc.) pull SNS + news together.",
      "topic.tab.all": "All",
      "topic.tab.tech": "Tech topics",
      "topic.tab.makers": "Chinese makers",
      "topic.more": "Show more",
      "topic.tag.tech": "TECH",
      "topic.tag.maker": "MAKER",
      "topic.count": "stocked",
      "empty.today": "No dispatch for today yet.",
      "empty.archive": "No archive yet.",
      "empty.none": "No matching items.",
      "loading": "Loading…",
      "footer.tagline": "Daily robot news — industrial / military / service / home",
      "footer.curated": "CURATED · ROBOT NEWS DIGEST",
    },
  };

  function detectLang() {
    const stored = localStorage.getItem("lang");
    if (stored === "ja" || stored === "en") return stored;
    return (navigator.language || "en").toLowerCase().startsWith("ja") ? "ja" : "en";
  }

  function applyI18n() {
    const dict = I18N[state.lang];
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const k = el.getAttribute("data-i18n");
      if (dict[k] != null) el.innerHTML = dict[k];
    });
    const jp = document.querySelector(".lang-toggle [data-lang-jp]");
    const en = document.querySelector(".lang-toggle [data-lang-en]");
    if (jp && en) {
      jp.classList.toggle("is-dim", state.lang !== "ja");
      en.classList.toggle("is-dim", state.lang !== "en");
    }
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  function jstParts(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return null;
    const jst = new Date(d.getTime() + 9 * 3600 * 1000);
    return {
      key: `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`,
      y: jst.getUTCFullYear(),
      m: jst.getUTCMonth() + 1,
      d: jst.getUTCDate(),
      h: jst.getUTCHours(),
      min: jst.getUTCMinutes(),
      dow: jst.getUTCDay(),
    };
  }

  function formatUpdated(iso) {
    if (!iso) return "—";
    const p = jstParts(iso);
    if (!p) return iso;
    return `${p.y}.${pad(p.m)}.${pad(p.d)} ${pad(p.h)}:${pad(p.min)} JST`;
  }
  function formatBuild(iso) {
    if (!iso) return "BUILD —";
    const p = jstParts(iso);
    if (!p) return `BUILD ${iso}`;
    return `BUILD ${p.y}${pad(p.m)}${pad(p.d)}.${pad(p.h)}${pad(p.min)}`;
  }
  function relativeTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const diff = (Date.now() - d.getTime()) / 1000;
    const t = state.lang === "ja"
      ? { just: "たった今", m: "分前", h: "時間前", d: "日前" }
      : { just: "just now", m: "m ago", h: "h ago", d: "d ago" };
    if (diff < 60) return t.just;
    if (diff < 3600) return `${Math.floor(diff / 60)}${t.m}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}${t.h}`;
    if (diff < 86400 * 14) return `${Math.floor(diff / 86400)}${t.d}`;
    const p = jstParts(iso);
    return p ? `${p.y}.${pad(p.m)}.${pad(p.d)}` : "";
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function matchesQuery(item, q) {
    if (!q) return true;
    const hay = [
      item.title_ja, item.title_en, item.summary_ja, item.summary_en,
      item.source, ...(item.tags || []),
    ].join(" ").toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function pickTitle(item) {
    return state.lang === "ja" ? (item.title_ja || item.title_en) : (item.title_en || item.title_ja);
  }
  function pickSummary(item) {
    return state.lang === "ja" ? (item.summary_ja || item.summary_en) : (item.summary_en || item.summary_ja);
  }
  function catLabel(cat) { return I18N[state.lang][`cat.${cat}`] || cat; }

  /* ============ Top Story custom diagram ============ */

  const STOCK_TAGS = {
    ja: {
      industrial: ["工場", "自動化", "協働ロボ"],
      military:   ["ドローン", "無人機", "国防"],
      service:    ["医療", "介護", "接客"],
      home:       ["ロボ掃除", "スマート", "家庭"],
    },
    en: {
      industrial: ["FACTORY", "AUTOMATION", "COBOT"],
      military:   ["DRONE", "UAV", "DEFENSE"],
      service:    ["MEDICAL", "CARE", "HOSPITALITY"],
      home:       ["ROBOT VAC", "SMART HOME", "COMPANION"],
    },
  };

  function tagBubble(text, fill, textColor) {
    const w = Math.max(64, 18 + text.length * 11);
    return `
      <rect x="${-w/2}" y="-17" width="${w}" height="34" rx="17"
            fill="${fill}" stroke="#1A1340" stroke-width="3"/>
      <text x="0" y="6" text-anchor="middle"
            font-family="Plus Jakarta Sans, Noto Sans JP, sans-serif"
            font-weight="800" font-size="14"
            fill="${textColor}" letter-spacing="0.04em">${escapeHtml(text)}</text>`;
  }

  function diagramOverlay(item, p) {
    const headline = state.lang === "ja" ? "今日の一面" : "TOP STORY";
    const dateStr = p ? `${p.y}.${pad(p.m)}.${pad(p.d)}` : "";
    return `
      <g transform="translate(22 24)">
        <rect width="148" height="34" rx="17" fill="#EC4899" stroke="#1A1340" stroke-width="3"/>
        <text x="74" y="22" text-anchor="middle"
              font-family="JetBrains Mono, monospace" font-weight="700"
              font-size="13" fill="#FFFBEB" letter-spacing="0.2em">${escapeHtml(headline)}</text>
      </g>
      <g transform="translate(22 380)">
        <text font-family="JetBrains Mono, monospace" font-size="12"
              fill="#FFFBEB" letter-spacing="0.18em" font-weight="500">
          ${escapeHtml((item.source || "").toUpperCase())} · ${dateStr}
        </text>
      </g>`;
  }

  function sceneIndustrial(tags) {
    return `
      <rect width="600" height="400" fill="#2563EB"/>
      <rect width="600" height="400" fill="url(#diag-grid)" opacity="0.5"/>
      <!-- factory skyline -->
      <g transform="translate(0 230)" fill="#1A1340">
        <rect x="20"  y="80" width="80"  height="60"/>
        <rect x="100" y="40" width="100" height="100"/>
        <rect x="200" y="60" width="60"  height="80"/>
        <rect x="260" y="20" width="120" height="120"/>
        <rect x="380" y="50" width="80"  height="90"/>
        <rect x="460" y="30" width="120" height="110"/>
        <rect x="135" y="-15" width="14" height="55"/>
        <rect x="300" y="-30" width="14" height="50"/>
        <rect x="490" y="-20" width="14" height="50"/>
      </g>
      <g fill="#FFFBEB" opacity="0.65">
        <circle cx="142" cy="205" r="14"/>
        <circle cx="158" cy="188" r="10"/>
        <circle cx="307" cy="190" r="16"/>
        <circle cx="325" cy="170" r="11"/>
        <circle cx="497" cy="200" r="13"/>
      </g>
      <g fill="#FBBF24">
        <rect x="115" y="320" width="6" height="6"/>
        <rect x="125" y="320" width="6" height="6"/>
        <rect x="135" y="320" width="6" height="6"/>
        <rect x="285" y="300" width="6" height="6"/>
        <rect x="295" y="300" width="6" height="6"/>
        <rect x="305" y="300" width="6" height="6"/>
        <rect x="285" y="315" width="6" height="6"/>
        <rect x="295" y="315" width="6" height="6"/>
        <rect x="475" y="305" width="6" height="6"/>
        <rect x="485" y="305" width="6" height="6"/>
      </g>

      <!-- giant gear -->
      <g transform="translate(490 100)">
        <g fill="#FBBF24" stroke="#1A1340" stroke-width="3">
          <rect x="-7" y="-80" width="14" height="20"/>
          <rect x="-7" y="60"  width="14" height="20"/>
          <rect x="-80" y="-7" width="20" height="14"/>
          <rect x="60"  y="-7" width="20" height="14"/>
          <g transform="rotate(45)">
            <rect x="-7" y="-80" width="14" height="20"/>
            <rect x="-7" y="60"  width="14" height="20"/>
            <rect x="-80" y="-7" width="20" height="14"/>
            <rect x="60"  y="-7" width="20" height="14"/>
          </g>
        </g>
        <circle r="60" fill="#FBBF24" stroke="#1A1340" stroke-width="4"/>
        <circle r="22" fill="#1A1340"/>
        <circle r="8"  fill="#FBBF24"/>
      </g>

      <!-- robot arm -->
      <g transform="translate(170 130)">
        <rect x="-26" y="116" width="52" height="22" rx="3" fill="#FFFBEB" stroke="#1A1340" stroke-width="3"/>
        <line x1="0" y1="116" x2="0" y2="38" stroke="#FFFBEB" stroke-width="16" stroke-linecap="round"/>
        <line x1="0" y1="116" x2="0" y2="38" stroke="#1A1340" stroke-width="3" fill="none"/>
        <line x1="0" y1="38" x2="84" y2="-2" stroke="#FFFBEB" stroke-width="16" stroke-linecap="round"/>
        <line x1="0" y1="38" x2="84" y2="-2" stroke="#1A1340" stroke-width="3" fill="none"/>
        <circle cx="0" cy="116" r="11" fill="#FBBF24" stroke="#1A1340" stroke-width="3"/>
        <circle cx="0" cy="38"  r="9"  fill="#FBBF24" stroke="#1A1340" stroke-width="3"/>
        <g transform="translate(84 -2)">
          <rect x="-5" y="-10" width="10" height="20" fill="#FFFBEB" stroke="#1A1340" stroke-width="3"/>
          <rect x="-14" y="-14" width="6" height="10" fill="#FFFBEB" stroke="#1A1340" stroke-width="3"/>
          <rect x="8"   y="-14" width="6" height="10" fill="#FFFBEB" stroke="#1A1340" stroke-width="3"/>
          <rect x="-9"  y="-26" width="18" height="12" fill="#EC4899" stroke="#1A1340" stroke-width="3"/>
        </g>
      </g>

      <!-- conveyor -->
      <g transform="translate(0 360)">
        <rect x="40" y="0" width="520" height="14" fill="#1A1340"/>
        <g fill="#FFFBEB">
          <circle cx="60"  cy="7" r="3"/>
          <circle cx="100" cy="7" r="3"/>
          <circle cx="140" cy="7" r="3"/>
          <circle cx="180" cy="7" r="3"/>
          <circle cx="220" cy="7" r="3"/>
          <circle cx="260" cy="7" r="3"/>
          <circle cx="300" cy="7" r="3"/>
          <circle cx="340" cy="7" r="3"/>
          <circle cx="380" cy="7" r="3"/>
          <circle cx="420" cy="7" r="3"/>
          <circle cx="460" cy="7" r="3"/>
          <circle cx="500" cy="7" r="3"/>
          <circle cx="540" cy="7" r="3"/>
        </g>
      </g>

      <!-- tag bubbles -->
      <g transform="translate(310 80)">${tagBubble(tags[0], "#FBBF24", "#1A1340")}</g>
      <g transform="translate(420 250)">${tagBubble(tags[1], "#FFFBEB", "#1A1340")}</g>
      <g transform="translate(110 320)">${tagBubble(tags[2], "#EC4899", "#FFFBEB")}</g>
    `;
  }

  function sceneMilitary(tags) {
    return `
      <rect width="600" height="400" fill="#EF4444"/>
      <rect width="600" height="400" fill="url(#diag-cross)" opacity="0.4"/>

      <!-- terrain horizon -->
      <path d="M0 320 L 80 300 L 160 315 L 250 295 L 340 312 L 430 290 L 520 308 L 600 295 L 600 400 L 0 400 Z" fill="#7F1D1D"/>

      <!-- radar concentric -->
      <g transform="translate(490 100)" fill="none" stroke="#FFFBEB" stroke-width="2" opacity="0.85">
        <circle r="74"/>
        <circle r="56"/>
        <circle r="38"/>
        <circle r="20"/>
        <line x1="-84" y1="0" x2="84" y2="0" stroke-width="1.5" opacity="0.55"/>
        <line x1="0" y1="-84" x2="0" y2="84" stroke-width="1.5" opacity="0.55"/>
        <line x1="0" y1="0" x2="62" y2="-42" stroke="#FBBF24" stroke-width="3"/>
        <circle r="6" fill="#FBBF24" stroke="#1A1340" stroke-width="2"/>
      </g>

      <!-- main drone -->
      <g transform="translate(230 175)">
        <ellipse cx="0" cy="0" rx="52" ry="14" fill="#FFFBEB" stroke="#1A1340" stroke-width="3"/>
        <rect x="-24" y="-7" width="48" height="14" rx="3" fill="#1A1340"/>
        <g stroke="#1A1340" stroke-width="3">
          <line x1="-42" y1="0" x2="-74" y2="-26"/>
          <line x1="42"  y1="0" x2="74"  y2="-26"/>
          <line x1="-42" y1="0" x2="-74" y2="26"/>
          <line x1="42"  y1="0" x2="74"  y2="26"/>
        </g>
        <g fill="#FFFBEB" stroke="#1A1340" stroke-width="3">
          <circle cx="-74" cy="-26" r="14"/>
          <circle cx="74"  cy="-26" r="14"/>
          <circle cx="-74" cy="26"  r="14"/>
          <circle cx="74"  cy="26"  r="14"/>
        </g>
        <g stroke="#FBBF24" stroke-width="2" opacity="0.85">
          <line x1="-86" y1="-26" x2="-62" y2="-26"/>
          <line x1="-74" y1="-38" x2="-74" y2="-14"/>
          <line x1="62"  y1="-26" x2="86"  y2="-26"/>
          <line x1="74"  y1="-38" x2="74"  y2="-14"/>
          <line x1="-86" y1="26" x2="-62" y2="26"/>
          <line x1="-74" y1="14"  x2="-74" y2="38"/>
          <line x1="62"  y1="26" x2="86"  y2="26"/>
          <line x1="74"  y1="14"  x2="74"  y2="38"/>
        </g>
        <circle cx="0" cy="16" r="6" fill="#1A1340" stroke="#FFFBEB" stroke-width="2"/>
      </g>

      <!-- small drone formation -->
      <g transform="translate(440 270)">
        <g>
          <ellipse cx="0" cy="0" rx="22" ry="6" fill="#FFFBEB" stroke="#1A1340" stroke-width="2"/>
          <g fill="#FFFBEB" stroke="#1A1340" stroke-width="2">
            <circle cx="-22" cy="-9" r="6"/>
            <circle cx="22"  cy="-9" r="6"/>
            <circle cx="-22" cy="9"  r="6"/>
            <circle cx="22"  cy="9"  r="6"/>
          </g>
        </g>
        <g transform="translate(-48 -22)">
          <ellipse cx="0" cy="0" rx="16" ry="5" fill="#FFFBEB" stroke="#1A1340" stroke-width="2"/>
          <g fill="#FFFBEB" stroke="#1A1340" stroke-width="2">
            <circle cx="-16" cy="-6" r="4"/>
            <circle cx="16"  cy="-6" r="4"/>
          </g>
        </g>
      </g>

      <!-- target reticle -->
      <g transform="translate(120 310)" fill="none" stroke="#FBBF24" stroke-width="3">
        <circle r="20"/>
        <line x1="-28" y1="0" x2="-12" y2="0"/>
        <line x1="12"  y1="0" x2="28"  y2="0"/>
        <line x1="0" y1="-28" x2="0" y2="-12"/>
        <line x1="0" y1="12"  x2="0" y2="28"/>
        <circle r="3" fill="#FBBF24"/>
      </g>

      <!-- tag bubbles -->
      <g transform="translate(120 80)">${tagBubble(tags[0], "#FFFBEB", "#1A1340")}</g>
      <g transform="translate(330 80)">${tagBubble(tags[1], "#FBBF24", "#1A1340")}</g>
      <g transform="translate(330 320)">${tagBubble(tags[2], "#1A1340", "#FFFBEB")}</g>
    `;
  }

  function sceneService(tags) {
    return `
      <rect width="600" height="400" fill="#10B981"/>
      <rect width="600" height="400" fill="url(#diag-dots)" opacity="0.5"/>

      <!-- ground -->
      <rect x="0" y="330" width="600" height="70" fill="#047857"/>

      <!-- hospital building -->
      <g transform="translate(360 90)">
        <polygon points="-12,0 88,-40 188,0" fill="#1A1340"/>
        <rect x="0" y="0" width="180" height="240" fill="#FFFBEB" stroke="#1A1340" stroke-width="4"/>
        <g transform="translate(90 60)">
          <rect x="-9" y="-32" width="18" height="64" fill="#EF4444"/>
          <rect x="-32" y="-9" width="64" height="18" fill="#EF4444"/>
        </g>
        <g fill="#FBBF24" stroke="#1A1340" stroke-width="2">
          <rect x="18"  y="120" width="22" height="22"/>
          <rect x="54"  y="120" width="22" height="22"/>
          <rect x="104" y="120" width="22" height="22"/>
          <rect x="140" y="120" width="22" height="22"/>
          <rect x="18"  y="156" width="22" height="22"/>
          <rect x="54"  y="156" width="22" height="22"/>
          <rect x="104" y="156" width="22" height="22"/>
          <rect x="140" y="156" width="22" height="22"/>
        </g>
        <rect x="74" y="194" width="32" height="46" fill="#1A1340"/>
        <circle cx="98" cy="218" r="2" fill="#FBBF24"/>
      </g>

      <!-- service robot -->
      <g transform="translate(140 195)">
        <line x1="0" y1="-72" x2="0" y2="-94" stroke="#1A1340" stroke-width="4"/>
        <circle cx="0" cy="-98" r="7" fill="#EC4899" stroke="#1A1340" stroke-width="3"/>
        <rect x="-34" y="-72" width="68" height="54" rx="9" fill="#FFFBEB" stroke="#1A1340" stroke-width="4"/>
        <circle cx="-13" cy="-45" r="7" fill="#1A1340"/>
        <circle cx="13"  cy="-45" r="7" fill="#1A1340"/>
        <circle cx="-11" cy="-47" r="2" fill="#FFFBEB"/>
        <circle cx="15"  cy="-47" r="2" fill="#FFFBEB"/>
        <path d="M-13 -28 Q0 -16 13 -28" stroke="#1A1340" stroke-width="3" fill="none" stroke-linecap="round"/>
        <rect x="-42" y="-18" width="84" height="100" rx="12" fill="#FBBF24" stroke="#1A1340" stroke-width="4"/>
        <rect x="-58" y="14" width="116" height="12" rx="3" fill="#FFFBEB" stroke="#1A1340" stroke-width="3"/>
        <circle cx="-32" cy="8"  r="7" fill="#EF4444" stroke="#1A1340" stroke-width="2"/>
        <rect   x="-6"  y="0"   width="14" height="14" fill="#2563EB" stroke="#1A1340" stroke-width="2"/>
        <circle cx="30"  cy="8"  r="7" fill="#EC4899" stroke="#1A1340" stroke-width="2"/>
        <rect x="-38" y="82" width="76" height="22" rx="6" fill="#1A1340"/>
        <circle cx="-22" cy="93" r="6" fill="#FFFBEB"/>
        <circle cx="22"  cy="93" r="6" fill="#FFFBEB"/>
      </g>

      <!-- floating hearts -->
      <g transform="translate(270 65)">
        <path d="M0 8 Q-10 -10 -18 4 Q-22 18 0 34 Q22 18 18 4 Q10 -10 0 8z" fill="#EC4899" stroke="#1A1340" stroke-width="3"/>
      </g>
      <g transform="translate(295 280)">
        <path d="M0 5 Q-7 -7 -12 3 Q-15 12 0 22 Q15 12 12 3 Q7 -7 0 5z" fill="#FBBF24" stroke="#1A1340" stroke-width="3"/>
      </g>

      <!-- plus signs -->
      <g fill="#FFFBEB" opacity="0.7">
        <g transform="translate(330 200)"><rect x="-2" y="-10" width="4" height="20"/><rect x="-10" y="-2" width="20" height="4"/></g>
        <g transform="translate(70 130)"><rect x="-2" y="-10" width="4" height="20"/><rect x="-10" y="-2" width="20" height="4"/></g>
      </g>

      <!-- tag bubbles -->
      <g transform="translate(110 80)">${tagBubble(tags[0], "#FFFBEB", "#1A1340")}</g>
      <g transform="translate(330 130)">${tagBubble(tags[1], "#FBBF24", "#1A1340")}</g>
      <g transform="translate(140 320)">${tagBubble(tags[2], "#EC4899", "#FFFBEB")}</g>
    `;
  }

  function sceneHome(tags) {
    return `
      <rect width="600" height="400" fill="#F59E0B"/>
      <rect width="600" height="400" fill="url(#diag-dots)" opacity="0.55"/>

      <!-- sun -->
      <g transform="translate(70 80)">
        <circle r="34" fill="#FBBF24" stroke="#1A1340" stroke-width="3"/>
        <g stroke="#1A1340" stroke-width="3" stroke-linecap="round">
          <line x1="0"  y1="-50" x2="0"  y2="-60"/>
          <line x1="0"  y1="50"  x2="0"  y2="60"/>
          <line x1="-50" y1="0"  x2="-60" y2="0"/>
          <line x1="50"  y1="0"  x2="60"  y2="0"/>
          <line x1="-36" y1="-36" x2="-44" y2="-44"/>
          <line x1="36"  y1="-36" x2="44"  y2="-44"/>
          <line x1="-36" y1="36"  x2="-44" y2="44"/>
          <line x1="36"  y1="36"  x2="44"  y2="44"/>
        </g>
      </g>

      <!-- house structure -->
      <g transform="translate(150 70)">
        <polygon points="-10,90 180,0 370,90" fill="#1A1340"/>
        <rect x="0" y="90" width="360" height="220" fill="#FFFBEB" stroke="#1A1340" stroke-width="4"/>
        <line x1="180" y1="90" x2="180" y2="310" stroke="#1A1340" stroke-width="3"/>
        <line x1="0"   y1="190" x2="360" y2="190" stroke="#1A1340" stroke-width="3"/>

        <!-- living room (TL): TV + sofa -->
        <rect x="20"  y="110" width="64" height="36" fill="#1A1340"/>
        <rect x="26"  y="114" width="52" height="24" fill="#06B6D4"/>
        <rect x="100" y="150" width="64" height="24" rx="4" fill="#EC4899" stroke="#1A1340" stroke-width="2"/>

        <!-- bedroom (TR): bed -->
        <rect x="200" y="130" width="90" height="46" rx="3" fill="#84CC16" stroke="#1A1340" stroke-width="3"/>
        <rect x="290" y="140" width="44" height="36" rx="2" fill="#FBBF24" stroke="#1A1340" stroke-width="2"/>

        <!-- kitchen (BL): stove + fridge -->
        <rect x="20"  y="210" width="56" height="68" fill="#EF4444" stroke="#1A1340" stroke-width="3"/>
        <line x1="20" y1="230" x2="76" y2="230" stroke="#1A1340" stroke-width="2"/>
        <circle cx="34" cy="252" r="3" fill="#FBBF24"/>
        <circle cx="62" cy="252" r="3" fill="#FBBF24"/>
        <rect x="98"  y="230" width="64" height="54" fill="#2563EB" stroke="#1A1340" stroke-width="3"/>
        <line x1="98" y1="252" x2="162" y2="252" stroke="#FFFBEB" stroke-width="2"/>

        <!-- robot vacuum bottom-right -->
        <g transform="translate(280 264)">
          <circle r="24" fill="#1A1340" stroke="#1A1340" stroke-width="3"/>
          <circle r="14" fill="#FBBF24"/>
          <circle r="3"  fill="#1A1340"/>
          <line x1="-2" y1="-22" x2="2" y2="-22" stroke="#FFFBEB" stroke-width="3"/>
          <!-- dashed path -->
          <g stroke="#EC4899" stroke-width="3" stroke-dasharray="4 4" fill="none">
            <path d="M -22 4 Q -50 18 -64 -10"/>
          </g>
          <polygon points="-66,-14 -68,-2 -56,-6" fill="#EC4899"/>
        </g>
      </g>

      <!-- chimney + smoke -->
      <g transform="translate(420 30)">
        <rect x="-8" y="0" width="16" height="40" fill="#1A1340"/>
        <circle cx="-2" cy="-12" r="11" fill="#FFFBEB" opacity="0.85" stroke="#1A1340" stroke-width="2"/>
        <circle cx="-18" cy="-26" r="8" fill="#FFFBEB" opacity="0.7" stroke="#1A1340" stroke-width="2"/>
      </g>

      <!-- floating hearts -->
      <g transform="translate(60 270)">
        <path d="M0 6 Q-9 -9 -16 3 Q-20 16 0 30 Q20 16 16 3 Q9 -9 0 6z" fill="#EC4899" stroke="#1A1340" stroke-width="3"/>
      </g>

      <!-- tag bubbles -->
      <g transform="translate(140 60)">${tagBubble(tags[0], "#FFFBEB", "#1A1340")}</g>
      <g transform="translate(490 140)">${tagBubble(tags[1], "#EC4899", "#FFFBEB")}</g>
      <g transform="translate(500 320)">${tagBubble(tags[2], "#84CC16", "#1A1340")}</g>
    `;
  }

  function topStoryDiagram(item) {
    const tags = STOCK_TAGS[state.lang][item.category] || ["", "", ""];
    const p = jstParts(item.published_at);
    const scene = (
      item.category === "industrial" ? sceneIndustrial(tags) :
      item.category === "military"   ? sceneMilitary(tags)   :
      item.category === "service"    ? sceneService(tags)    :
      item.category === "home"       ? sceneHome(tags)       : ""
    );
    return `<svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" class="ts-svg" width="100%" height="100%">${scene}${diagramOverlay(item, p)}</svg>`;
  }

  /* ============ Charts ============ */

  function renderDonut(counts) {
    const order = CATEGORIES;
    const total = order.reduce((s, k) => s + (counts[k] || 0), 0);
    const r = 36, circ = 2 * Math.PI * r;
    let offset = 0;
    let arcs = "";
    if (total === 0) {
      arcs = `<circle r="${r}" cx="50" cy="50" fill="none" stroke="#E5DEC9" stroke-width="18"/>`;
    } else {
      for (const k of order) {
        const v = counts[k] || 0;
        if (v === 0) continue;
        const len = (v / total) * circ;
        arcs += `<circle r="${r}" cx="50" cy="50" fill="transparent"
          stroke="${COLOR[k]}" stroke-width="18"
          stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}"
          stroke-dashoffset="${(-offset).toFixed(2)}"
          stroke-linecap="butt"
          transform="rotate(-90 50 50)"/>`;
        offset += len;
      }
    }
    document.querySelector("#donut").innerHTML = `
      <svg viewBox="0 0 100 100" class="donut">
        <circle r="${r}" cx="50" cy="50" fill="#FFFBEB"/>
        ${arcs}
        <text x="50" y="50" text-anchor="middle" class="center-num" dominant-baseline="middle">${total}</text>
        <text x="50" y="64" text-anchor="middle" class="center-lbl" dominant-baseline="middle">ARTICLES</text>
      </svg>`;
  }

  function renderBars(byDate) {
    // last 7 days from latest data date (so the chart is meaningful even when "today" is empty)
    const sortedKeys = Object.keys(byDate).sort().reverse();
    const anchorKey = sortedKeys[0];
    if (!anchorKey) {
      document.querySelector("#bars").innerHTML =
        `<svg viewBox="0 0 100 100" class="bars-empty"><text x="50" y="50" text-anchor="middle" font-family="JetBrains Mono" font-size="6" fill="#5B5079">NO DATA</text></svg>`;
      return;
    }
    const [ay, am, ad] = anchorKey.split("-").map(Number);
    const anchor = new Date(Date.UTC(ay, am - 1, ad));
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor.getTime() - i * 86400 * 1000);
      const k = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      days.push({ key: k, dd: d.getUTCDate(), items: byDate[k] || [] });
    }
    const max = Math.max(1, ...days.map(d => d.items.length));
    const W = 100, H = 100;
    const colW = (W - 6) / days.length;
    const top = 12, btm = 88;
    let body = "";
    days.forEach((d, i) => {
      const x = 3 + i * colW;
      const total = d.items.length;
      const h = (total / max) * (btm - top);
      let y = btm;
      for (const cat of CATEGORIES) {
        const ct = d.items.filter(it => it.category === cat).length;
        if (!ct) continue;
        const ch = (ct / total) * h;
        y -= ch;
        body += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(colW - 2).toFixed(2)}" height="${ch.toFixed(2)}" fill="${COLOR[cat]}" stroke="#1A1340" stroke-width="0.6"/>`;
      }
      // label
      body += `<text x="${(x + (colW - 2) / 2).toFixed(2)}" y="96" text-anchor="middle" font-family="JetBrains Mono" font-size="4.5" fill="#1A1340">${pad(d.dd)}</text>`;
      // count above bar
      if (total > 0) {
        body += `<text x="${(x + (colW - 2) / 2).toFixed(2)}" y="${(y - 1.5).toFixed(2)}" text-anchor="middle" font-family="Plus Jakarta Sans" font-weight="800" font-size="5" fill="#1A1340">${total}</text>`;
      }
    });
    // baseline
    body += `<line x1="2" y1="${btm}" x2="${W - 2}" y2="${btm}" stroke="#1A1340" stroke-width="0.6"/>`;
    document.querySelector("#bars").innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
  }

  function renderArchive(byDate, todayKey) {
    const list = document.querySelector("#archive");
    const empty = document.querySelector("#archiveEmpty");
    const past = Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (past.length === 0) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    const max = Math.max(1, ...past.map(([_, items]) => items.length));
    const dowsJa = ["日", "月", "火", "水", "木", "金", "土"];
    const dowsEn = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    list.innerHTML = past.map(([key, items]) => {
      const total = items.length;
      const segs = CATEGORIES.map(cat => {
        const ct = items.filter(i => i.category === cat).length;
        if (!ct) return "";
        const h = (ct / max) * 140; // px
        return `<span class="ab-${cat}" style="height:${h.toFixed(1)}px" title="${cat} ${ct}"></span>`;
      }).join("");
      const [y, m, d] = key.split("-");
      const dt = new Date(Date.UTC(+y, +m - 1, +d));
      const dow = (state.lang === "ja" ? dowsJa : dowsEn)[dt.getUTCDay()];
      const isToday = key === todayKey;
      return `
        <div class="archive-day${isToday ? ' is-today' : ''}">
          <span class="archive-day-total">${total}</span>
          <div class="archive-bar" aria-label="${key} total ${total}">
            ${segs}
          </div>
          <span class="archive-day-label">${m}.${d}<small>${dow}</small></span>
        </div>`;
    }).join("");
  }

  /* ============ Cards / Top story ============ */

  function cardHtml(item) {
    // Text-first: no images on regular cards. Category color via border-left.
    return `
      <a class="card ${item.category}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
        <div class="card-head">
          <span class="cat-badge ${item.category}">${escapeHtml(catLabel(item.category))}</span>
          <span class="time">${escapeHtml(relativeTime(item.published_at))}</span>
        </div>
        <h4>${escapeHtml(pickTitle(item) || "")}</h4>
        <div class="card-meta">
          <span class="src" title="${escapeHtml(item.source)}">${escapeHtml(item.source)}</span>
        </div>
      </a>`;
  }

  function renderTopStory(today) {
    const ts = document.querySelector("#topStory");
    const empty = document.querySelector("#todayEmpty");
    if (today.length === 0) {
      ts.hidden = true; empty.hidden = false; return;
    }
    ts.hidden = false; empty.hidden = true;
    const top = today[0];
    const p = jstParts(top.published_at);
    ts.querySelectorAll("[data-top-link],[data-top-link2]").forEach(a => a.href = top.url);
    ts.querySelector("[data-top-source]").textContent = top.source;
    ts.querySelector("[data-top-date]").textContent = p ? `${p.y}.${pad(p.m)}.${pad(p.d)}` : "";
    ts.querySelector("[data-top-title]").textContent = pickTitle(top) || "";
    ts.querySelector("[data-top-summary]").textContent = pickSummary(top) || "";
    const badge = ts.querySelector("[data-top-badge]");
    badge.className = `cat-badge ${top.category}`;
    badge.textContent = catLabel(top.category);
    // Always render a custom explanatory diagram for the top story.
    const cover = ts.querySelector("[data-top-cover]");
    cover.className = "ts-cover-inner ts-diagram";
    cover.removeAttribute("style");
    cover.innerHTML = topStoryDiagram(top);
  }

  function renderOtherToday(today) {
    const others = today.slice(1);
    document.querySelector("[data-other-count]").textContent = others.length;
    const grid = document.querySelector("#otherToday");
    grid.innerHTML = others.length
      ? others.map(cardHtml).join("")
      : `<p class="empty">${I18N[state.lang]["empty.none"]}</p>`;
  }

  function renderBookmarks() {
    const grid = document.querySelector("#bookmarks");
    const recent = state.items.slice(0, 28)
      .filter(i => state.category === "all" || i.category === state.category)
      .filter(i => matchesQuery(i, state.query));
    grid.innerHTML = recent.length
      ? recent.map(cardHtml).join("")
      : `<p class="empty">${I18N[state.lang]["empty.none"]}</p>`;
    document.querySelectorAll(".tab").forEach(t => {
      t.classList.toggle("is-active", t.dataset.cat === state.category);
    });
  }

  /* ============ Topics ============ */

  function topicItemTitle(it) {
    return state.lang === "ja" ? (it.title_ja || it.title_en) : (it.title_en || it.title_ja);
  }

  function topicTileHtml(t) {
    const items = (t.items || []).slice(0, 20);
    const visible = items.slice(0, 5);
    const extras = items.slice(5);
    const tag = t.is_company ? I18N[state.lang]["topic.tag.maker"]
                              : I18N[state.lang]["topic.tag.tech"];
    const name = state.lang === "ja" ? t.name_ja : t.name_en;
    const liHtml = (it, i, extra = false) => `
      <li class="${extra ? 'extra' : ''}">
        <a href="${escapeHtml(it.url)}" target="_blank" rel="noopener">
          <span class="num">${String(i + 1).padStart(2, '0')}</span>
          <span class="ta-body">
            <span class="ta-title">${escapeHtml(topicItemTitle(it) || "")}</span>
            <span class="ta-meta">
              <span>${escapeHtml((it.source || "").replace(/Google News.*?·\s*/, ""))}</span>
              <span>·</span>
              <span>${escapeHtml(relativeTime(it.published_at))}</span>
            </span>
          </span>
        </a>
      </li>`;
    const list = visible.map((it, i) => liHtml(it, i)).join("")
               + extras.map((it, i) => liHtml(it, i + 5, true)).join("");
    const moreLabel = I18N[state.lang]["topic.more"];
    const stockedLabel = I18N[state.lang]["topic.count"];
    return `
      <article class="topic-tile" style="--c:${escapeHtml(t.color || '#1A1340')}">
        <div class="topic-head">
          <span class="topic-pill">${escapeHtml(tag)}</span>
          <span class="topic-count">${items.length} ${escapeHtml(stockedLabel)}</span>
        </div>
        <h3>${escapeHtml(name || t.id)}</h3>
        <ol class="topic-articles">${list || `<li><span class="ta-title" style="opacity:.6">—</span></li>`}</ol>
        ${extras.length ? `<div class="topic-foot"><span></span><button class="more" type="button" data-topic-more="${escapeHtml(t.id)}">+ ${extras.length} ${escapeHtml(moreLabel)}</button></div>` : ''}
      </article>`;
  }

  function renderTopics() {
    const grid = document.querySelector("#topicGrid");
    if (!grid) return;
    let tlist = state.topics;
    if (state.topicFilter === "tech") tlist = tlist.filter(t => !t.is_company);
    else if (state.topicFilter === "makers") tlist = tlist.filter(t => t.is_company);
    grid.innerHTML = tlist.length
      ? tlist.map(topicTileHtml).join("")
      : `<p class="empty">${I18N[state.lang]["empty.none"]}</p>`;
    // counts
    const all = state.topics.length;
    const tech = state.topics.filter(t => !t.is_company).length;
    const makers = state.topics.filter(t => t.is_company).length;
    document.querySelector('[data-topic-count="all"]').textContent = all;
    document.querySelector('[data-topic-count="tech"]').textContent = tech;
    document.querySelector('[data-topic-count="makers"]').textContent = makers;
    // wire expand buttons
    grid.querySelectorAll("[data-topic-more]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        const tile = btn.closest(".topic-tile");
        tile.classList.toggle("expanded");
        btn.textContent = tile.classList.contains("expanded")
          ? "− " + (state.lang === "ja" ? "閉じる" : "Collapse")
          : btn.textContent.replace(/^−\s.*/, "");
      });
    });
    // tab active states
    document.querySelectorAll(".topic-tab").forEach(t => {
      t.classList.toggle("is-active", t.dataset.filter === state.topicFilter);
    });
  }

  /* ============ Main render ============ */

  function refreshAndRender() {
    state.items = state.rawItems.filter(i =>
      i.lang === state.lang && CATEGORIES.includes(i.category)
    );

    const counts = { all: state.items.length };
    for (const c of CATEGORIES) counts[c] = state.items.filter(i => i.category === c).length;
    document.querySelectorAll("[data-stat]").forEach(el => {
      const k = el.getAttribute("data-stat");
      if (counts[k] != null) el.textContent = counts[k];
    });
    document.querySelectorAll("[data-tab-count]").forEach(el => {
      const k = el.getAttribute("data-tab-count");
      if (counts[k] != null) el.textContent = counts[k];
    });

    const byDate = {};
    for (const it of state.items) {
      const p = jstParts(it.published_at);
      if (!p) continue;
      (byDate[p.key] ||= []).push(it);
    }
    const sortedKeys = Object.keys(byDate).sort().reverse();
    const todayKey = sortedKeys[0] || null;
    const today = todayKey ? byDate[todayKey] : [];

    const todayCounts = CATEGORIES.reduce((acc, c) => {
      acc[c] = today.filter(i => i.category === c).length;
      return acc;
    }, {});
    renderDonut(todayCounts);
    renderBars(byDate);

    renderTopStory(today);
    renderOtherToday(today);
    renderBookmarks();
    renderArchive(byDate, todayKey);
    renderTopics();
  }

  function wireEvents() {
    document.querySelectorAll(".tab").forEach(t => {
      t.addEventListener("click", () => {
        state.category = t.dataset.cat;
        renderBookmarks();
      });
    });
    document.querySelector("#search").addEventListener("input", e => {
      state.query = e.target.value;
      renderBookmarks();
    });
    document.querySelector("#langToggle").addEventListener("click", () => {
      state.lang = state.lang === "ja" ? "en" : "ja";
      localStorage.setItem("lang", state.lang);
      applyI18n();
      refreshAndRender();
    });
    document.querySelectorAll(".topic-tab").forEach(t => {
      t.addEventListener("click", () => {
        state.topicFilter = t.dataset.filter;
        renderTopics();
      });
    });
  }

  async function init() {
    applyI18n();
    wireEvents();
    try {
      const [newsRes, topicsRes] = await Promise.all([
        fetch(`data/news.json?ts=${Date.now()}`),
        fetch(`data/topics.json?ts=${Date.now()}`).catch(() => null),
      ]);
      const data = await newsRes.json();
      state.rawItems = (data.items || [])
        .filter(i => CATEGORIES.includes(i.category))
        .sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
      if (topicsRes && topicsRes.ok) {
        try {
          const topicsData = await topicsRes.json();
          state.topics = topicsData.topics || [];
        } catch { /* ignore */ }
      }
      document.querySelector("[data-updated]").textContent = formatUpdated(data.updated_at);
      document.querySelector("#buildTag").textContent = formatBuild(data.updated_at);
      refreshAndRender();
    } catch (e) {
      document.querySelector("#bookmarks").innerHTML =
        `<p class="empty">${state.lang === "ja" ? "データの読み込みに失敗しました" : "Failed to load data"}</p>`;
      console.error(e);
    }
  }

  init();
})();
