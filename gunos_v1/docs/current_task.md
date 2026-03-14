# Task
GUNOS V1.1 Task 04 — London / NYC Map Readability Improvement

## Goal
- London / NYC の駅密集エリアで発生しているラベル重複を軽減し、マップの可読性を改善する
- 既存の route / hub 可視化、live score、result panel の挙動は維持したまま、表示だけを整理する
- 特に中心部の過密表示を抑えつつ、「重要な駅は見える」状態を作る

## Current State
- プロジェクト: `geodo.earth/gunos_v1`
- 現在の状況:
  - V1 milestone 完了
  - V1.1 backlog 作成済み
  - Task 01 完了
  - Task 02 完了
  - Task 03 完了
- 直近の成果:
  - Task 02 で Route+ / Hub+ live score を4都市で実動化
  - Task 03 で Route+ result panel の見せ方を改善し、NYC の route progress 分母異常も修正
- 現在の残課題:
  - London / NYC の都心部で駅ラベルが密集し、可読性が低い
  - 特に主要ハブ周辺でラベル重なりが起きやすい
- 対象URL:
  - `https://geodo.earth/gunos_v1/`
- 想定対象ファイル:
  - `src/ui/map_canvas.js`
  - 必要に応じて `src/app/main.js`
  - 必要に応じて `index.html`
- 関連表示要素:
  - 駅ラベル
  - hub 駅強調
  - network / route 可視化レイヤー
- 前提メモ:
  - Task 01 で route / network 可視化は導入済み
  - Task 02 で score panel の Route progress / Hub badge は導入済み
  - Task 03 で result panel 側は整理済み
  - 今回は map readability 改善に集中する

## Problem Statement
- London / NYC は駅密度が高く、全駅ラベルを同条件で表示すると中心部で重なりが多い
- その結果、
  - 重要駅が読みにくい
  - route / hub 強調の視認性が落ちる
  - マップ全体の完成度が下がって見える
- ただし、単純に全部消すのではなく、ゲーム的に意味のある駅は残したい

## Constraints
- 既存機能を壊さない
- Task 01〜03 の成果を維持する
- スコア計算ロジックには原則触れない
- 今回は表示制御が主対象
- 東京 / 大阪の見え方を大きく悪化させない
- UI デザインの全面変更はしない
- ラベル非表示ロジックは、できるだけ説明可能で単純な条件にする
- キャッシュバスター更新が必要なら更新箇所を明示する

## Preferred Direction
- `map_canvas.js` にラベル表示の閾値制御を追加する
- 少なくとも London / NYC では、以下のいずれか、または組み合わせで可読性を上げる
  1. `hub_degree` 上位駅のみ常時ラベル表示
  2. 一定ズーム以上でラベル表示数を増やす
  3. 低重要度駅は初期表示でラベル非表示
  4. 近接駅のラベルを間引く
- 重要:
  - 「主要駅・ハブ駅は見える」
  - 「ズームすると情報量が増える」
  - 「初期表示はすっきり」
  の3点を意識すること

## Work Items
1. 現在のラベル描画ロジックを確認する  
   - 駅名ラベルがどこで生成されているか
   - 全駅一律表示か、すでに条件分岐があるかを確認する
2. London / NYC の過密箇所を再現し、原因を切り分ける  
   - 単純な駅数過多か
   - ズーム閾値不足か
   - hub 駅と一般駅が同条件表示か
3. ラベル表示制御の改善案を実装する  
   推奨は以下のどちらか:
   - A. `hub_degree` 上位 N 駅 + 一定ズーム以上で追加表示
   - B. 初期表示は主要駅のみ、ズームインで全体表示
4. London / NYC で可読性が改善したことを確認する
5. Tokyo / Osaka でも副作用がないか確認する  
   - 必要なら都市別条件分岐を検討してよい
6. route / network の線表示や hub 強調が視覚的に埋もれていないか確認する
7. コンソールエラー 0 を確認する
8. 完了内容を `docs/current_result.md` または運用中の結果ファイルに記録する

## Expected Output
- 変更ファイル一覧
- ラベル表示ルールの要約
- London / NYC で何が改善したかの説明
- Tokyo / Osaka への影響有無
- 4都市テスト結果
- コンソールエラー件数
- 残課題
- 次タスク候補

## Completion Report に必ず書いてほしいこと
- どの条件でラベルを表示 / 非表示にしたか
- `hub_degree`、ズーム閾値、近接間引きのどれを採用したか
- London / NYC のどのエリアで改善を確認したか
- Tokyo / Osaka に副作用がなかったか
- UI 上の見た目がどう変わったか
- 今後さらに改善するなら何が必要か

## Success Criteria
- London / NYC の初期表示でラベル重なりが目立って減る
- 主要駅や hub 駅は引き続き認識できる
- ズーム操作時に情報が自然に増える
- Task 01〜03 の動作を壊していない
- コンソールエラー 0
