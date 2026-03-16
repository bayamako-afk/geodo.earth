# Task
GUNOS V1.2 Task 05 — City Pack Extensibility Prep

## Goal
- 新しい都市パックを今後追加しやすくするため、都市依存部分の構造を整理する
- Tokyo / Osaka / London / NYC の既存対応を壊さず、city pack の拡張性を高める
- 「新都市を追加する時に何を揃えればよいか」が明確な状態に近づける

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
- 現在の特徴:
  - 4都市（Tokyo / Osaka / London / NYC）で動作
  - Route / Hub / Station score / result / onboarding / mobile / result drama まで一通り整備済み
- 現在の課題:
  - 都市追加時に必要なデータ・設定・表示条件がどこに分散しているか分かりにくい可能性がある
  - city-specific な条件分岐や暗黙の前提が残っている可能性がある
  - 新都市追加の手順がまだ明文化されていない
- 対象URL:
  - `https://geodo.earth/gunos_v1/`
- 想定対象ファイル:
  - city config / lines master / station metrics / station lines / map rendering 関連ファイル
  - `src/app/main.js`
  - `src/ui/map_canvas.js`
  - `src/ui/score_panel.js`
  - `src/ui/result_panel.js`
  - `src/ui/city_compare_panel.js`
  - `src/game/game_session.js`
  - 必要に応じて data loading / config 関連 JS
  - 必要に応じて docs

## Problem Statement
- 現在は4都市対応できているが、今後さらに都市を増やすときに
  - どのファイルを用意すればよいか
  - どこを書き換えればよいか
  - どこに都市依存の前提があるか
  が見えにくい可能性がある
- つまり今回の主題は、
  **「新都市追加をしやすくするための構造整理と明文化」**
- 今回は新都市を実際に1つ追加することより、
  **追加しやすい形に整える準備**
  を優先する

## Constraints
- 既存4都市の動作を壊さない
- V1.1 および V1.2 Task 01〜04 の成果を維持する
- 今回は city pack extensibility の準備が主目的
- 大規模リライトは避ける
- 既存ロジックを全面抽象化しすぎない
- 「今後の追加が楽になる」範囲で整理する
- 新規ドキュメント追加は歓迎
- キャッシュバスター更新が必要なら更新箇所を明示する

## Preferred Direction
- まず「都市追加に必要な要素」を洗い出して整理する
- 可能なら city-specific 前提を config / data 側へ寄せる
- コード内のハードコードや個別分岐を減らす
- 最低限、次のどれかを成果として残したい
  1. city pack 構成要件の明文化
  2. data/config loading の整理
  3. city-specific 分岐の削減
  4. 新都市追加チェックリストの作成

## Work Items
1. 現在の city pack 依存箇所を洗い出す
   - Tokyo / Osaka / London / NYC 対応のためにどのデータ・設定・分岐が必要か整理する
   - map
   - scoring
   - UI
   - onboarding/result/city compare
   の各観点で確認する

2. 新都市追加に必要な最小構成を定義する
   - 例:
     - lines master
     - station metrics
     - station-line mapping
     - map geometry / rendering data
     - city metadata
     - labels / traits / UI text
   - 実際の現行構造に合わせて整理する

3. city-specific なハードコードや暗黙依存を点検する
   - ファイル名直書き
   - city name による条件分岐
   - score normalization や label threshold の都市別特殊処理
   - UI 上の city 固有文言
   を確認する

4. 可能なら構造整理を行う
   - config オブジェクト化
   - city metadata の集中管理
   - data loading の整理
   - UI 側の都市参照の統一
   など、過剰でない範囲で改善する

5. 新都市追加のためのドキュメントを作る
   - 例:
     - `docs/city_pack_spec.md`
     - `docs/add_city_checklist.md`
     - `docs/city_pack_notes.md`
   - 少なくとも
     - 必要ファイル
     - 必要設定
     - テスト観点
     が分かるようにする

6. 既存4都市で再確認する
   - Tokyo / Osaka / London / NYC が従来どおり動くこと
   - city compare / onboarding / result / score panel が壊れていないこと
   - コンソールエラー 0

## Expected Output
- 変更ファイル一覧
- city pack extensibility 上の問題点整理
- 何を構造化 / 明文化したか
- 新都市追加時に必要なものの一覧
- 追加したドキュメント一覧
- 4都市確認結果
- コンソールエラー件数
- 残課題
- 次タスク候補

## Completion Report に必ず書いてほしいこと
- 現在の city pack が何で構成されていると整理したか
- どの city-specific 依存を見つけたか
- 今回どこまで整理できたか
- 新都市追加時の最小要件をどう定義したか
- ドキュメントを何作ったか
- 既存4都市に副作用がなかったか
- 次に本当に新都市を追加するなら何が必要か

## Success Criteria
- 新都市追加に必要な構成が以前より明確になる
- city-specific な依存が整理される
- 少なくとも1つ以上、将来の都市追加に役立つドキュメントが残る
- 既存4都市の動作を壊していない
- コンソールエラー 0
