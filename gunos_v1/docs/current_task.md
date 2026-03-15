# Task
GUNOS V1.2 Task 01 — Mobile-First Interaction Polish

## Goal
- スマホ・狭幅画面での実際の操作感を改善する
- V1.1 で整えた responsive layout を、実プレイしやすい touch-first UI に進化させる
- 既存の route / score / result / city comparison 表示を壊さず、操作ストレスを減らす

## Current State
**Completed** (See `current_result_v1_2_task01.md` for details)

- プロジェクト: `geodo.earth/gunos_v1`
- フェーズ:
  - V1 milestone 完了
  - V1.1 完了
  - V1.2 backlog 作成済み
  - V1.2 Task 01 完了
- V1.2 のテーマ:
  - `UX / Balance Expansion`

## Key Achievements
1. **Touch Targets**: ボタンやカードのタッチターゲットを iOS HIG に準拠して拡大（min-height 44px 等）。
2. **Responsive Layout**: 画面幅 680px 以下での縦積みレイアウト、430px 以下でのコンパクトヘッダー表示を実装。
3. **Touch Feedback**: ボタンタップ時の `:active` 状態（縮小・半透明化）を追加。
4. **SVG Map Touch Controls**: `viewBox` ベースのパン（1本指）とピンチズーム（2本指）、ダブルタップリセットを実装。

## Next Task
**V1.2 Task 02: Gameplay Balance Tuning**
- スコア計算式の見直し（特に Hub+ ボーナスのインフレ抑制）
- カードのレアリティ分布と出現確率の調整
- ターン数とデッキ枚数のバランス調整
