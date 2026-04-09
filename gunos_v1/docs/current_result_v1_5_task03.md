# GUNOS V1.5 Task 03: Readability & Cleanup Pass

## 概要
HUD、オーバーレイ、ヒントパネル、サマリーなどの情報密度と余白を整理し、全体的な読みやすさと視認性を向上させるクリーンアップを実施しました。特にモバイルデバイス（横向き・縦向き）での情報過多を解消し、より洗練された UI 体験を提供します。

## 実施内容

### 1. 情報密度の削減（JS）
各パネルに表示されるタグの最大数を制限し、説明文（reason）をより簡潔な表現に修正しました。

- **Station Hint Panel (`station_hint.js`)**
  - タグの最大表示数を **3 → 2** に削減
  - 説明文を短縮（例: "Strong hub station for route control." → "Major hub"）
- **Candidate Indicator (`candidate_indicator.js`)**
  - 各候補のタグ最大表示数を **2 → 1** に削減
  - 説明文を短縮
- **Score Reason Panel (`score_reason.js`)**
  - タグの最大表示数を **3 → 2** に削減
  - 説明文を短縮

### 2. 余白と間隔の最適化（CSS）
パネル内の余白（padding）や要素間の間隔（gap）を詰め、フォントサイズを微調整することで、地図領域の視認性を確保しました。

- **全体的な調整**
  - 各パネルの `max-width` を縮小（220px → 200px 等）
  - `padding` と `gap` を 1〜2px 削減し、コンパクトなレイアウトに統一
  - フォントサイズを 1px 縮小し、行間（line-height）を調整
- **Onboarding Hints**
  - バブルの `padding` とフォントサイズを縮小し、より軽量な表示に改善
- **Result Strategy Summary**
  - 余白を詰め、ヘッダーとタグの間隔を整理

### 3. モバイル（Landscape / Portrait）の最適化
画面の高さや幅が限られる環境での情報圧を大幅に削減しました。

- **Landscape（横向き）**
  - Candidate Panel の最大表示件数を **2件 → 1件** に制限
  - Candidate Panel の説明文（reason）を非表示化
  - Result Strategy Summary の2行目の説明文を非表示化
- **Portrait（縦向き）**
  - Candidate Panel の最大表示件数を **2件 → 1件** に制限（Landscape と同様）
  - 各パネルの `max-width` をさらに縮小（155px 程度）

## 検証結果
PC、スマートフォン横向き、スマートフォン縦向きの3パターンで動作検証を実施し、以下の改善を確認しました。

- 地図上の重なりや視覚的なノイズが減少し、プレイ中の没入感が向上しました。
- 重要な情報（Hub、Score、Lead など）がより素早く認識できるようになりました。
- モバイル環境でも UI が画面を占有しすぎず、快適にプレイできる状態が確保されています。

---
**ステータス**: 完了
**コミット**: `main` ブランチにプッシュ済み
