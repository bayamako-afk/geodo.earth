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
- 現在の課題:
  - 拡張構造は整ったが、まだ 5th city pack を実際に追加して検証していない
  - city registry / loader / UI / scoring / map / onboarding / result が、本当に新都市でつながるかは未実証
- 対象URL:
  - `https://geodo.earth/gunos_v1/`

## Main Objective
- 新しい都市を1つ実際に追加する
- その追加作業を通じて、
  - 必要データ
  - 必要設定
  - UI 連携
  - score / result / city compare 連携
  - map 表示
  が既存構造だけでどこまで対応できるかを検証する

## City Selection
- まずは **追加しやすい都市を1つ選ぶ**
- 候補は、以下のような比較的わかりやすい鉄道ネットワーク都市が望ましい
  - Paris
  - Berlin
  - Madrid
  - Seoul
  - Taipei
  - Singapore
- 選定基準:
  - 路線構造が理解しやすい
  - データが比較的整理しやすい
  - GUNOS の既存4都市と並べて違和感が少ない
- もし候補選定で迷う場合は、
  **既存 city pack 構造に最も乗せやすい都市を優先すること**
- 追加都市を選んだ理由を結果報告に明記すること

## Constraints
- 既存4都市の動作を壊さない
- V1.1 および V1.2 Task 01〜05 の成果を維持する
- 今回は「5th city pack 実地検証」が目的
- 追加都市の完成度は MVP レベルでよいが、最低限ゲームとして成立すること
- 大規模リライトは避ける
- city-specific 分岐を増やしすぎない
- できるだけ Task 05 の city pack 構造に沿って追加する
- キャッシュバスター更新が必要なら更新箇所を明示する

## Preferred Direction
- 追加都市は、まず「動く最小構成」を目指す
- 完璧な都市再現より、
  **既存 city pack 追加手順で統合できること**
  を重視する
- 次の要素が最低限揃うことが望ましい
  1. city registry 登録
  2. map 表示
  3. station / line データ読込
  4. Route+ / Hub+ / station score の最低限動作
  5. city compare / onboarding / result への自然な統合

## Work Items
1. 追加都市を1つ選定する
   - 候補比較を簡単に行い、採用理由を決める
   - 「なぜその都市が 5th city として適切か」を短く整理する

2. 必要データを揃える
   - lines master
   - station metrics
   - station-line mapping
   - map geometry / rendering data
   - city metadata
   - trait / display text
   など、Task 05 で定義した city pack 要件に沿って準備する

3. city registry に新都市を追加する
   - `city_registry.json` または現行 city metadata 管理箇所に登録する
   - City Compare / map descriptor / UI trait 連携が自然につながるようにする

4. map / score / UI 統合を確認する
   - map render
   - Route+ / Hub+
   - station score
   - result panel
   - onboarding / help
   - city comparison panel
   が壊れずに表示されるか確認する

5. city-specific な追加修正が必要なら最小限で実施する
   - どこで構造が足りなかったかを明記する
   - 必要なら city pack spec / checklist を更新する

6. 既存4都市との共存確認を行う
   - Tokyo / Osaka / London / NYC が壊れていないか確認する
   - 5都市切替が自然か確認する

7. 最低限の実ゲーム検証を行う
   - 新都市でゲーム開始できる
   - 数ターン以上進行する
   - GAME OVER まで到達できる
   - result 表示が成立する
   - コンソールエラー 0

## Expected Output
- 採用した 5th city 名
- 選定理由
- 変更ファイル一覧
- 追加した city pack 構成要素一覧
- 既存構造で足りた点 / 足りなかった点
- city pack spec / checklist の更新有無
- 5都市確認結果
- コンソールエラー件数
- 残課題
- 次タスク候補

## Completion Report に必ず書いてほしいこと
- なぜその都市を 5th city として選んだか
- 実際に追加するのに何が必要だったか
- Task 05 の extensibility prep がどこまで有効だったか
- どこで追加対応が必要になったか
- map / scoring / result / onboarding / city compare のどこがそのまま使えたか
- 既存4都市に副作用がなかったか
- 6th city 追加時にさらに改善すべき点は何か

## Success Criteria
- 5つ目の city pack が最低限動作する
- 既存4都市が壊れていない
- 新都市が city registry ベースで統合されている
- Route+ / Hub+ / result / city compare に自然につながる
- city pack spec / checklist が実運用目線で検証される
- コンソールエラー 0
