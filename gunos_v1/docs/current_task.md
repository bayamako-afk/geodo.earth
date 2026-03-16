# Task
GUNOS V1.3 Task 01 — DOM Structure Inversion & Base HUD Layout

## Goal
- 現行の「分割パネル方式（Split Panels）」から「地図全画面 + HUDオーバーレイ方式」へ移行するステップ1を実施する
- `#map-area` を `position: absolute; inset: 0` で全画面化し、最背面に配置する
- `#hud-layer`（`pointer-events: none`）を作成し、既存のパネルをそこに格納する
- 各パネルに `pointer-events: auto` を付与し、操作性を確保する
- この時点ではパネルのデザイン（背景色や枠）はそのまま維持する
- 既存の5都市・全ゲームロジックへの影響ゼロを確認する

## Current State
- プロジェクト: `geodo.earth/gunos_v1`
- フェーズ:
  - V1 milestone 完了
  - V1.1 完了
  - V1.2 完了
  - V1.3 進行中
- 完了済み:
  - V1.2 Task 01 — Mobile-First Interaction Polish
  - V1.2 Task 02 — Gameplay Balance Tuning
  - V1.2 Task 03 — Onboarding / Tutorial Layer
  - V1.2 Task 04 — Result Drama & Feedback Enhancement
  - V1.2 Task 05 — City Pack Extensibility Prep
  - V1.2 Task 06 — 5th City Pack Implementation Validation (Paris)
- 対応都市:
  - Tokyo, Osaka, London, NYC, Paris
- 対象URL:
  - `https://geodo.earth/gunos_v1/`

## V1.3 設計方針（レイアウト刷新レポートより）
- 推奨案: **レイアウト案B（統合HUD案）**
- 段階的移行ステップ:
  1. **ステップ1（本タスク）**: DOM構造の反転とベースHUD化
  2. ステップ2: パネルの解体とエッジ配置（CSS改修）
  3. ステップ3: スマホ縦向き向けのトグル化（レスポンシブ対応）

## Main Objective (V1.3 Task 01)
- `index.html` の DOM 構造を改修:
  - `#app-body` を `position: relative` にする
  - `#map-area` を `position: absolute; inset: 0` で全画面化（最背面）
  - `#hud-layer` を新設（`position: absolute; inset: 0; pointer-events: none`）
  - 既存の `#bottom-area` と `#app-header` を HUD レイヤー上に配置
  - 各パネルに `pointer-events: auto` を付与
- CSS 調整:
  - `#app-body` の `flex` レイアウトから `position: relative` ベースへ移行
  - `#map-area` の `height: 45vh` 制限を撤廃し、全画面化
  - `#bottom-area` を HUD レイヤー内の下部に固定配置
  - モバイルでのスクロール問題を HUD 方式で根本解決
- 既存機能の保持:
  - マップのパン・ズーム操作（`touch-action: none` 維持）
  - 手札パネル、スコアパネル、都市比較パネルの操作性
  - HELP モーダル、GAME OVER 演出
  - 5都市すべての動作

## Next Suggested Task
**V1.3 Task 02**: Panel Design Refinement — HUD化後のパネルデザイン刷新
- パネルの背景色・ボーダーを半透明化（`backdrop-filter: blur`）
- ヘッダーを画面上部にオーバーレイ
- 手札を画面下部中央にドック化
- スコアパネルを右エッジに配置
