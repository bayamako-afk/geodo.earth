# Task
GUNOS V1.1 Task 03 — Route+ Completion Bonus Result Panel Verification

## Goal
- `Route+` の完成ボーナスが live score だけでなく result panel にも正しく反映されることを確認・修正する
- 特に NYC の 1駅路線のような極端なケースでも、路線完成判定と最終集計が破綻しない状態にする
- `computeRouteScoreSync` の出力が `computeFinalResults()` に正しく受け渡され、UI 上で確認できる状態にする

## Current State
- プロジェクト: `geodo.earth/gunos_v1`
- 現在の状況:
  - V1 milestone 完了
  - V1.1 backlog 作成済み
  - Task 01 完了
  - Task 02 完了
- 最新結果:
  - `docs/current_result.md` は `GUNOS V1.1 Task 02 — Route+ / Hub+ Live Score Activation`
  - commit は `679dc4c`
- 現在の実装状況:
  - `Route+` は live score 上では実動化済み
  - `Hub+` は全4都市（Tokyo / Osaka / London / NYC）で動作済み
  - score panel に Route 進捗バーと Hub 駅名バッジは追加済み
- 残課題:
  - NYC の `4 Train 2/1` のように、所有駅数が路線総駅数を超えて見えるケースがある
  - `Route+` の完成ボーナスが result panel に最終反映されているか未確認
  - `computeRouteScoreSync` と `computeFinalResults()` の接続確認が必要
- 対象URL:
  - `https://geodo.earth/gunos_v1/`
- 関連ファイル候補:
  - `src/game/game_session.js`
  - `src/game/final_score_engine.js`
  - `src/game/network_hub_bonus.js`
  - `src/ui/score_panel.js`
  - `src/ui/result_panel.js` または result panel 関連ファイル
  - `src/app/main.js`
  - `index.html`
- 前提メモ:
  - Task 02 では `computeRouteScoreSync` を `game_session.js` に直接 import して live score 側を実動化済み
  - 今回は「Route+ の完成ボーナスが result panel に正しく載るか」の検証と修正が主目的
  - 必要なら NYC の 1駅路線データも含めて原因を追うこと

## Constraints
- 既存機能を壊さない
- Task 02 で完成した live score / Hub+ / Route progress 表示は壊さない
- UI 全体のデザイン変更は最小限にする
- 今回の主対象は `Route+` の最終集計と result panel 反映
- London / NYC のラベル可読性改善やスコア正規化は今回やらない
- 指定のない範囲は極力触らない
- キャッシュバスターを更新した場合は、更新箇所を明示する

## Work Items
1. `Route+` の live score 計算系と final result 計算系の経路を整理する  
   - `computeRouteScoreSync`
   - `computeFinalResults()`
   - result panel 表示処理
   のつながりを確認する
2. `Route+` の完成ボーナスが最終結果に含まれていない場合、どこで欠落しているか特定する  
   - 計算自体はできているが UI に出ていないのか
   - そもそも final result 側で再計算されていないのか
   - データ引き渡し時に欠落しているのか
   を切り分ける
3. NYC の 1駅路線ケースを重点確認する  
   - `4 Train 2/1`
   - `7 Train 1/1`
   のような表示がなぜ起きるか確認する
4. 路線進捗の分母・分子の整合性を確認する  
   - 路線総駅数
   - プレイヤー所有駅数
   - 重複カウント
   - 同一駅の複数路線所属
   を点検する
5. 必要に応じて `computeRouteScoreSync` 側または result 集計側を修正する  
   - 1駅路線でも正しく完成判定できること
   - 同一駅の重複加算で分子が分母を不自然に超えないこと
   - result panel に `Route+` が正しく表示されること
6. result panel に `Route+` の値が見える形で反映されているか確認する  
   - プレイヤー別に Route+ が判読できること
   - live score と final result の解釈が大きくズレないこと
7. Tokyo / Osaka / London / NYC の4都市で再テストする  
   - 少なくともコンソールエラー 0
   - result panel 表示破綻なし
   - Task 02 の UI 要素が維持されていること

## Expected Output
- 変更ファイル一覧
- 変更内容要約
- `Route+` が result panel に反映されたかどうかの明記
- NYC の 1駅路線ケースの原因と対処内容
- 4都市テスト結果
- コンソールエラー件数
- 未解決点
- 次の推奨アクション

## Completion Report に必ず書いてほしいこと
- `Route+` の live score と result panel の関係をどう整理したか
- `computeRouteScoreSync` と `computeFinalResults()` の接続をどう確認・修正したか
- NYC の `4 Train 2/1` が
  - 表示上の問題なのか
  - データ構造上の問題なのか
  - カウントロジック上の問題なのか
  を明記すること
- 修正後、result panel 上で `Route+` が確認できた具体例を1つ以上書くこと
- 次タスク候補があれば `Task 04` 以降として提案すること
