# Task
GUNOS V1.2 Task 04 — Result Drama & Feedback Enhancement

## Goal
- GAME OVER 時の結果表示を、より分かりやすく、気持ちよく、記憶に残るものにする
- プレイヤーが「なぜ勝った / 負けたか」を直感的に理解できるようにする
- 現在の result panel を土台に、演出・比較・要点整理を強化する

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
- 現在の特徴:
  - Route / Network visibility は強化済み
  - Route+ / Hub+ live score は4都市で稼働済み
  - result panel の基本整理は済んでいる
  - onboarding により初見理解も改善済み
- 現在の課題:
  - GAME OVER 時の印象がまだ機能説明寄りで、ドラマ性や達成感はこれから
  - 勝因 / 敗因は読めるが、もう少し一目で伝わる余地がある
  - 「今回の勝負の特徴」が短く印象づく形にはまだなっていない
- 対象URL:
  - `https://geodo.earth/gunos_v1/`
- 想定対象ファイル:
  - `src/ui/result_panel.js`
  - `src/ui/score_panel.js`（必要なら）
  - `index.html`
  - 必要に応じて `src/ui/layout.js`
  - 必要に応じて `src/app/main.js`

## Problem Statement
- 現在の結果表示は情報としては読めるが、ゲーム体験としての締めはまだ強化余地がある
- 特に以下を改善したい
  - 勝者がすぐ分かる
  - 勝因 / 敗因が短く伝わる
  - Route+ / Hub+ / Station score のどれが効いたかが印象に残る
  - もう一度遊びたくなる終わり方になる
- 今回の主題は、
  **結果を “表示する” から “体験として締める” へ進めること**

## Constraints
- 既存ゲームロジックは壊さない
- V1.1 および V1.2 Task 01〜03 の成果を維持する
- 今回の中心は result panel / end-of-game feedback の強化
- 過剰に重いアニメーションや大規模演出は避ける
- PC / mobile の両方で破綻しないこと
- 読みやすさを損なわずに演出を足すこと
- 勝因説明は短く、説明過多にしないこと
- キャッシュバスター更新が必要なら更新箇所を明示する

## Preferred Direction
- 結果画面を「情報の羅列」ではなく「勝負の要約」として見せる
- 例えば以下の強化が望ましい
  1. winner headline の強化
  2. score difference の見せ方改善
  3. 勝因の short summary
  4. best route / top hub / key station などのハイライト
  5. rematch を押したくなる見せ方
- 特に、以下が短く伝わるとよい
  - 誰が勝ったか
  - 何で勝ったか
  - どれくらい差がついたか
  - 今回の対戦の特徴は何だったか

## Work Items
1. 現在の result panel を確認する
   - どの情報がすでにあるか
   - どこが説明的すぎるか
   - どこが印象に残りにくいか整理する

2. winner 表示を強化する
   - 勝者名 / プレイヤー名 / 勝利見出しを分かりやすくする
   - 必要なら “close win” など短いラベルも検討してよい

3. score difference の見せ方を改善する
   - 総得点差
   - 主要スコア差
   - 接戦 / 圧勝の印象
   が直感的に分かるようにする

4. 勝因 / 敗因の short summary を追加する
   - Route+ が効いた
   - Hub+ が効いた
   - Station score が積み上がった
   など、結果の特徴を短文で表現する
   - 長すぎる説明は避ける

5. result panel のハイライト要素を強化する
   - Best route
   - top hub contribution
   - key station influence
   - city trait との関係
   など、印象に残る情報を1〜2個強調する

6. mobile でも読みやすいことを確認する
   - 見出しが大きすぎないか
   - 情報量が多すぎないか
   - ボタンや再プレイ導線が押しやすいか

7. 4都市で確認する
   - Tokyo / Osaka / London / NYC
   - 都市差があっても result drama が破綻しないこと
   - コンソールエラー 0

## Expected Output
- 変更ファイル一覧
- 追加した result drama / feedback 要素の要約
- 勝因 / 敗因をどう見せるようにしたか
- mobile への配慮内容
- 4都市確認結果
- コンソールエラー件数
- 残課題
- 次タスク候補

## Completion Report に必ず書いてほしいこと
- result panel のどこをどう強化したか
- winner / score gap / victory reason をどう整理したか
- Route+ / Hub+ / Station score の勝因表現をどう作ったか
- mobile での見やすさにどう配慮したか
- 演出を強くしすぎず軽量に保つために何を制限したか
- 4都市でどのような勝負の見え方になったか
- 次に強化するなら city extensibility / polish / online 準備のどれが自然か

## Success Criteria
- GAME OVER 時に勝者と勝因が一目で分かる
- 結果表示が前より印象に残る
- Route+ / Hub+ / Station score の意味が結果画面で伝わる
- mobile でも読みやすい
- 既存 UI / onboarding / balance を壊していない
- コンソールエラー 0
