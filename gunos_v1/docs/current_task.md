# Task
GUNOS V1.2 Task 01 — Mobile-First Interaction Polish

## Goal
- スマホ・狭幅画面での実際の操作感を改善する
- V1.1 で整えた responsive layout を、実プレイしやすい touch-first UI に進化させる
- 既存の route / score / result / city comparison 表示を壊さず、操作ストレスを減らす

## Current State
- プロジェクト: `geodo.earth/gunos_v1`
- フェーズ:
  - V1 milestone 完了
  - V1.1 完了
  - V1.2 backlog 作成済み
- V1.2 のテーマ:
  - `UX / Balance Expansion`
- V1.2 backlog の推奨最初タスク:
  - `Task 01 — Mobile-First Interaction Polish`
- backlog 上の主眼:
  - START / PLAY / AUTO など主要操作の touch target 拡大
  - map pan / zoom のタッチ操作改善
  - narrow screen での縦方向 spacing / scrolling 改善
  - hand panel と card selection の片手操作性向上
- 対象URL:
  - `https://geodo.earth/gunos_v1/`
- 想定対象ファイル:
  - `index.html`
  - `src/ui/layout.js`
  - `src/ui/score_panel.js`
  - `src/ui/result_panel.js`
  - `src/ui/map_canvas.js`
  - 必要に応じて入力処理関連 JS
  - 必要に応じて `src/app/main.js`

## Problem Statement
- 現在の UI は responsive にはなってきているが、スマホでの実操作までは最適化されていない可能性がある
- 特に以下の点で friction が残っているおそれがある
  - ボタンが小さい / 押しづらい
  - hand panel や card selection が狭く誤操作しやすい
  - map pan / zoom が touch 操作で扱いにくい
  - 縦スクロールとゲーム操作が競合しやすい
  - 狭幅画面で重要情報と操作領域の優先順位がまだ弱い

## Constraints
- 既存ゲームロジックは壊さない
- V1.1 の成果を維持する
  - Route+ / Hub+ live score
  - result panel refinement
  - London / NYC readability tuning
  - responsive score/info panel
  - city comparison mini-panel
- 今回は主に interaction / layout / touch usability の改善に集中する
- 大規模な UI 全面刷新はしない
- PC 表示の完成度を大きく損なわない
- 必要なら mobile 条件分岐を入れてよい
- キャッシュバスターを更新した場合は更新箇所を明示する

## Work Items
1. 現在のスマホ相当表示を確認する
   - 目安: 幅 390px 前後
   - START / PLAY / AUTO ボタン
   - hand panel
   - card selection
   - map interaction
   - score / result panel
   の実操作しづらい箇所を特定する

2. 主要ボタンの touch target を改善する
   - START / PLAY / AUTO など主要操作ボタンのサイズ・余白・間隔を見直す
   - 誤タップを減らす
   - 押下感や active state が分かるならよりよい

3. hand panel / card selection の操作性を改善する
   - タップしやすいカード間隔にする
   - 狭幅画面でのカード重なりや選択しづらさを軽減する
   - 片手操作でも極端にストレスがない状態を目指す

4. map の touch interaction を改善する
   - pan / zoom の扱いやすさを確認する
   - タッチ操作時に UI と競合していないか点検する
   - 必要なら pointer-events や gesture まわりを調整する

5. narrow screen の縦レイアウトを改善する
   - 重要操作がファーストビューで見えるか確認する
   - スクロール量を減らせるなら減らす
   - 情報の優先順位を再確認する

6. score / result / city comparison が mobile で邪魔になっていないか確認する
   - 必要なら spacing / collapse / ordering を微調整する
   - ただし今回の主役は interaction 改善であり、情報パネル大改修はしない

7. Tokyo / Osaka / London / NYC の4都市で確認する
   - UI が都市差で壊れないか確認する
   - コンソールエラー 0 を確認する

## Expected Output
- 変更ファイル一覧
- モバイル操作改善の要約
- どの操作がどのように改善されたか
- PC への影響有無
- 4都市確認結果
- コンソールエラー件数
- 残課題
- 次タスク候補

## Completion Report に必ず書いてほしいこと
- どの画面幅・端末相当を前提に確認したか
- 主要ボタンの touch target をどう改善したか
- hand panel / card selection をどう改善したか
- map touch interaction で何を確認・調整したか
- score / result / city comparison との干渉がどう変わったか
- PC 表示に副作用がなかったか
- 今後さらに mobile-first 化するなら何が必要か

## Success Criteria
- スマホ幅で START / PLAY / AUTO が明確に押しやすい
- hand panel / card selection が誤操作しにくい
- map の touch 操作が扱いやすい
- 縦スクロールとゲーム操作のストレスが減る
- V1.1 の UI 改善を壊していない
- コンソールエラー 0
