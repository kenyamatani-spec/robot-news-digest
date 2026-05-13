# ロボットニュース / Robot News Digest

ロボット業界のニュースを **産業 / 軍事 / サービス / 家庭** の 4 カテゴリで毎日集計する静的サイト。GitHub Actions が RSS を取得し Claude API で分類・日英要約、GitHub Pages で配信する。

## 構成

```
├─ index.html              # トップページ
├─ assets/{css,js}         # 静的アセット
├─ data/
│   ├─ news.json           # フロントが読む最新データ
│   └─ sources.yml         # RSS ソース一覧
├─ scripts/                # RSS 取得 + LLM 分類パイプライン
└─ .github/workflows/      # 日次 cron
```

## ローカル開発

```bash
# データ更新（要 GEMINI_API_KEY）
python -m venv .venv && source .venv/bin/activate
pip install -r scripts/requirements.txt
export GEMINI_API_KEY=AIza...
python scripts/build.py

# プレビュー
python -m http.server 8000
# → http://localhost:8000
```

API キーは Google AI Studio (https://aistudio.google.com/app/apikey) で無料取得可能。
モデルは `gemini-2.5-flash-lite` を既定で使用（環境変数 `GEMINI_MODEL` で変更可）。

## デプロイ

1. GitHub にリポジトリを作成し push
2. Settings → Pages → `Branch: main / root` を選択
3. Settings → Secrets → `GEMINI_API_KEY` を登録
4. Actions タブで `Update news` を `Run workflow` 起動
