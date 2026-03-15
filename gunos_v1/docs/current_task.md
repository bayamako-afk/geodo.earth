# Task
GUNOS V1.2 Task 02 — Gameplay Balance Tuning

## Goal
- 現在のスコア構造とゲーム進行バランスを点検し、戦略の偏りや極端な取り得を減らす
- Route+ / Hub+ / Station score の関係を整理し、プレイヤーにとって「何を狙うべきか」がより納得感ある形になるよう調整する
- 4都市で同じルールを使っても破綻しにくい、より安定したゲームバランスに近づける

## Current State
- プロジェクト: `geodo.earth/gunos_v1`
- フェーズ:
  - V1 milestone 完了
  - V1.1 完了
  - V1.2 進行中
- 完了済み:
  - V1.2 Task 01 — Mobile-First Interaction Polish 完了
- 現状の特徴:
  - Route / Network visibility は強化済み
  - Route+ / Hub+ live score は4都市で稼働済み
  - result panel や readability は整理済み
  - mobile-first interaction の基礎改善も完了
- 現在の論点:
  - Route+ がどの程度の頻度で実際に成立するのか不明瞭
  - Hub+ と station score の比重が都市や局面によって偏っている可能性がある
  - Tokyo / Osaka と London / NYC のスコア感覚に差がある可能性がある
  - プレイヤーが「一番強い戦略」を選び続ける単調な状態になっていないか確認が必要
- 対象URL:
  - `https://geodo.earth/gunos_v1/`
- 想定対象ファイル:
  - `src/game/game_session.js`
  - `src/game/final_score_engine.js`
  - `src/game/network_hub_bonus.js`
  - Route score 関連ファイル
  - station metrics / lines master / city config 関連ファイル
  - 必要に応じて `src/ui/score_panel.js`
  - 必要に応じて `src/ui/result_panel.js`

## Problem Statement
- 現在の GUNOS は UI 面の完成度が上がった一方、得点設計そのものの最適化はまだこれから
- 特に以下を検証したい
  - Route+ は達成しづらすぎないか
  - Hub+ が強すぎる / 弱すぎる局面はないか
  - station score の絶対値が支配的すぎないか
  - 都市によって「勝ちやすい形」が偏っていないか
- つまり今回の主題は、
  **見た目の改善ではなく、遊びの中身の納得感を上げること**

## Constraints
- 既存 UI 改善を壊さない
- V1.1 および V1.2 Task 01 の成果を維持する
- 今回は主に scoring / balance / parameter 調整に集中する
- 必要なら軽い表示補助は加えてよいが、UI 大改修はしない
- ルールを根本から別ゲーム化する変更は避ける
- 4都市共通で説明しやすいロジックを優先する
- 特定都市専用の場当たり調整は最小限にする
- キャッシュバスター更新が必要なら更新箇所を明示する

## Work Items
1. 現在の得点構造を整理する
   - Station score
   - Route+
   - Hub+
   - final result の内訳
   を確認し、どの要素が勝敗に効きやすいか把握する

2. Route+ の成立しやすさを確認する
   - 4都市で Route completion がどの程度起きるか確認する
   - 1駅路線や小規模路線が過剰に有利になっていないか確認する
   - 逆に、通常プレイでほぼ達成不能になっていないか確認する

3. Hub+ の効き方を確認する
   - relative threshold が都市差をうまく吸収しているか確認する
   - top hub の価値が高すぎて他の戦略を圧迫していないか確認する
   - Hub+ が視覚的には目立つが得点的に弱すぎる、またはその逆でないか確認する

4. Station score の支配度を確認する
   - station score が強すぎて Route+ / Hub+ が飾りになっていないか確認する
   - 逆に bonus 系が強すぎて station base の意味が薄れていないか確認する

5. 4都市でのスコア感覚を比較する
   - Tokyo / Osaka / London / NYC で final score 構造が極端にズレていないか確認する
   - 都市差として許容すべき違いと、補正すべき違いを切り分ける

6. 必要に応じてパラメータ調整を行う
   - Route+ の閾値 / 配点
   - Hub+ の段階
   - final aggregation の重み
   などを調整してよいが、変更理由を説明可能な形にすること

7. 調整後に4都市で再確認する
   - 少なくとも Tokyo / Osaka / London / NYC で挙動確認
   - コンソールエラー 0
   - スコア内訳の説明がしやすくなっていること

## Expected Output
- 変更ファイル一覧
- 現状のバランス上の問題点の要約
- 何をどう調整したか
- 調整理由
- 4都市比較結果
- コンソールエラー件数
- 残課題
- 次タスク候補

## Completion Report に必ず書いてほしいこと
- Route+ / Hub+ / Station score のどれが強すぎた / 弱すぎたか
- どの都市でどんな偏りが見えたか
- 今回の調整で何を改善したかったのか
- 具体的にどの閾値・配点・ロジックを変更したか
- 調整後、プレイ感がどう変わったか
- まだ残るバランス課題は何か
- 次タスク候補として onboarding / result drama / city extensibility のどれが自然か

## Success Criteria
- Route+ / Hub+ / Station score の役割分担が以前より明確になる
- 特定の1要素だけが勝敗を支配しにくくなる
- 4都市でのスコア構造が極端に破綻しない
- UI や mobile 改善を壊していない
- コンソールエラー 0
