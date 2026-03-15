# Task
GUNOS V1.2 Task 03 — Onboarding / Tutorial Layer

## Goal
- 初見プレイヤーが GUNOS の基本構造を短時間で理解できるようにする
- Route / Hub / Station score の意味を、プレイ前またはプレイ中に自然に学べる導線を作る
- 現在のゲーム体験を壊さず、軽量で分かりやすい onboarding / tutorial layer を追加する

## Current State
- プロジェクト: `geodo.earth/gunos_v1`
- フェーズ:
  - V1 milestone 完了
  - V1.1 完了
  - V1.2 進行中
- 完了済み:
  - V1.2 Task 01 — Mobile-First Interaction Polish
  - V1.2 Task 02 — Gameplay Balance Tuning
- 現在の特徴:
  - Route / Network visibility は強化済み
  - Route+ / Hub+ live score は4都市で稼働済み
  - result panel / readability / responsive は改善済み
  - mobile-first interaction の基礎も改善済み
  - gameplay balance の調整も進行済み
- 現在の課題:
  - 初見では「何をすると強いのか」がまだ直感的に伝わりにくい
  - Route+ / Hub+ / station score の役割分担を UI だけで理解するのは少し難しい
  - ルール説明がなくても触れる状態に近づけたい
- 対象URL:
  - `https://geodo.earth/gunos_v1/`
- 想定対象ファイル:
  - `index.html`
  - `src/ui/layout.js`
  - `src/ui/score_panel.js`
  - `src/ui/result_panel.js`
  - 必要に応じて onboarding / tutorial 用の新規 JS
  - 必要に応じて `src/app/main.js`

## Problem Statement
- 現在の GUNOS は、すでに playable で見た目もかなり整理されている
- ただし、初見プレイヤーにとっては以下がまだ分かりにくい可能性がある
  - 何を目指せばよいか
  - Route+ が何を意味するか
  - Hub+ が何を意味するか
  - station score と bonus の違い
  - map / score / result がどうつながっているか
- 今回の主題は、
  **説明書を読む前提ではなく、画面体験の中で自然に理解できる入口を作ること**

## Constraints
- 既存ゲームロジックは壊さない
- V1.1 および V1.2 Task 01 / 02 の成果を維持する
- 今回は onboarding / tutorial 導線の追加が主目的
- 重すぎるフルチュートリアルや長文説明は避ける
- 初回導入に適した軽量な UI を優先する
- PC / mobile の両方で破綻しないこと
- 既存の score panel / result panel / city comparison と競合しすぎないこと
- キャッシュバスター更新が必要なら更新箇所を明示する

## Preferred Direction
- 「最初に全部説明する」より、
  **短いガイドを段階的に見せる方式** を優先する
- 例えば以下のような軽量導線が望ましい
  1. Start前の short tip
  2. プレイ中の contextual hint
  3. 終了時の result explanation
- 特に、以下の3点が伝われば成功
  - 駅を集めるだけでなく、路線とハブが大事
  - score panel を見れば進捗が分かる
  - result panel を見れば勝因が分かる

## Work Items
1. 現在の UI を見て、初見で分かりにくい要素を整理する
   - START前
   - プレイ中
   - GAME OVER後
   の3段階で、理解の詰まりやすい箇所を洗い出す

2. 軽量な onboarding の導入方式を決める
   - 例:
     - welcome tip
     - help toggle
     - first-play overlay
     - small tutorial card
     - score panel hint
   - できるだけ軽く、邪魔になりすぎない方式を優先する

3. Start前の導線を追加する
   - 初見向けに
     - 何を目指すゲームか
     - Route / Hub / Score の基本
     を短く伝える

4. プレイ中の contextual hint を追加する
   - score panel や route progress の意味が分かる短い補足
   - 必要なら hover / tap / small badge / info icon などを活用してよい

5. 結果画面で「なぜ勝った / 負けたか」を補足する
   - Route+ / Hub+ / station score のどれが効いたか
   - Best route や主要スコアの意味が自然に伝わるよう補助する

6. mobile でも読みやすいことを確認する
   - テキスト量が多すぎない
   - overlay が重すぎない
   - 画面を塞ぎすぎない

7. Tokyo / Osaka / London / NYC の4都市で確認する
   - 都市差があっても onboarding の説明が破綻しないこと
   - コンソールエラー 0

## Expected Output
- 変更ファイル一覧
- 追加した onboarding / tutorial 要素の要約
- Start前 / プレイ中 / 結果画面で何を追加したか
- mobile への配慮内容
- 4都市確認結果
- コンソールエラー件数
- 残課題
- 次タスク候補

## Completion Report に必ず書いてほしいこと
- どの方式の onboarding を採用したか
- なぜその方式にしたか
- 初見プレイヤーに何を最優先で伝える設計にしたか
- Route+ / Hub+ / station score をどう説明したか
- mobile での見やすさにどう配慮したか
- 重すぎる説明を避けるために何を削ったか
- 次に強化するなら tutorial / result drama / city expansion のどれが自然か

## Success Criteria
- 初見プレイヤーが GUNOS の目的を把握しやすくなる
- Route / Hub / Score の関係が前より伝わる
- score panel / result panel の意味が理解しやすくなる
- 既存 UI や mobile 改善を壊していない
- 4都市で説明が破綻しない
- コンソールエラー 0
