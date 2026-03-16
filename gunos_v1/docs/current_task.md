# Task
GUNOS V1.2 Task 06 — 5th City Pack Implementation Validation

## Goal
- 5つ目の city pack を実際に追加し、V1.2 Task 05 で整えた拡張構造が実運用で機能するか検証する
- 新都市追加が「個別対応の職人作業」ではなく、「定義済みの city pack 手順」で進められることを確認する
- 既存4都市を壊さず、5都市目を最小追加コストで統合する

## Current State
- プロジェクト: `geodo.earth/gunos_v1`
- フェーズ:
  - V1 milestone 完了
  - V1.1 完了
  - V1.2 進行中
- 完了済み:
  - V1.2 Task 01 — Mobile-First Interaction Polish
  - V1.2 Task 02 — Gameplay Balance Tuning
  - V1.2 Task 03 — Onboarding / Tutorial Layer
  - V1.2 Task 04 — Result Drama & Feedback Enhancement
  - V1.2 Task 05 — City Pack Extensibility Prep
  - **V1.2 Task 06 — 5th City Pack Implementation Validation (Paris)** ✅
- Task 05 の成果:
  - `city_registry.json` 中心の city metadata 整理
  - city-specific ハードコード削減
  - `docs/city_pack_spec.md`
  - `docs/add_city_checklist.md`
- 現在の対応都市:
  - Tokyo
  - Osaka
  - London
  - NYC
  - **Paris** (New!)
- 対象URL:
  - `https://geodo.earth/gunos_v1/`

## Main Objective (Completed)
- 新しい都市（Paris）を1つ実際に追加する
- その追加作業を通じて、
  - 必要データ
  - 必要設定
  - UI 連携
  - score / result / city compare 連携
  - map 表示
  が既存構造だけでどこまで対応できるかを検証した。

## Next Suggested Task
**V1.2 Task 07**: Final Polish & Release Prep
- V1.2 の全タスク（01〜06）を通した総合テスト
- モバイル表示、パフォーマンス、キャッシュ戦略の最終確認
- V1.2 のリリースノート作成と本番デプロイの準備
