# Task
GUNOS V1.1 Task 05 — Responsive Score / Info Panel Polish + City Comparison Mini-panel

## Goal
- スコア関連UIをスマホ・狭幅画面でも読みやすく整理する
- 既存の live score / Route progress / Hub badge / result panel を壊さず、情報過密を緩和する
- あわせて、都市ごとのスコア傾向が分かる軽量な City Comparison Mini-panel を追加する
- PC では情報量を維持し、スマホでは優先順位の高い情報が先に見える状態にする

## Current State
- プロジェクト: `geodo.earth/gunos_v1`
- 現在の状況:
  - V1 milestone 完了
  - V1.1 backlog 作成済み
  - Task 01 完了
  - Task 02 完了
  - Task 03 完了
  - Task 04 完了
- 直近の成果:
  - Task 02 で Route+ / Hub+ live score を全4都市で実動化
  - Task 03 で Route progress / result panel 表示を整理
  - Task 04 で London / NYC のラベル可読性を改善
- 現在の課題:
  - UI が PC 前提寄りで、スマホや狭幅画面で情報が詰まりやすい可能性が高い
  - score panel に Route progress / Hub badge / live score が増え、縦横ともに密度が高い
  - 都市間で Station スコアの絶対値が異なるが、その前提が UI 上で分かりにくい
- 対象URL:
  - `https://geodo.earth/gunos_v1/`
- 想定対象ファイル:
  - `index.html`
  - `src/ui/score_panel.js`
  - `src/ui/result_panel.js`
  - レイアウト系CSS
  - 必要に応じて `src/app/main.js`
- 前提メモ:
  - 今回はゲームロジックの大改修ではなく、UI/UX の整理を主対象とする
  - Route+ / Hub+ / map readability の既存成果は維持する

## Problem Statement
- 現在の UI は情報追加を重ねてきたため、狭い画面では以下が起こるおそれがある
  - スコア欄が詰まる
  - Route progress が長すぎる
  - Hub badge が折り返して見づらい
  - 都市比較の文脈が UI 上で伝わりにくい
- 特にスマホでは「全部見せる」より「大事なものから順に見せる」設計が必要

## Constraints
- 既存機能を壊さない
- Task 01〜04 の表示・挙動を維持する
- スコア計算ロジックには原則触れない
- 今回の中心は UI レスポンシブ整理と情報の優先順位付け
- 大規模なフレームワーク導入はしない
- PC 版の見た目を大きく悪化させない
- スマホ専用の別UIを作るより、既存UIのレスポンシブ改善を優先する
- キャッシュバスターを更新した場合は更新箇所を明示する

## Preferred Direction
- score panel と result panel にレスポンシブ整理を入れる
- スマホでは以下を優先して見せる
  1. 現在の総合スコア
  2. Route+ / Hub+ の要点
  3. Route progress の上位数件
  4. 必要なら補足情報を折りたたみ or 省略表示
- City Comparison Mini-panel は軽量にする
  - 例:
    - city average station score
    - city scale / node count
    - “high-density network” などの短い特性
- スマホで横にはみ出す長い行やバッジ群を抑える
- Route progress はスマホ時に件数制限や簡略表示を検討してよい

## Work Items
1. 現在の score panel / result panel の DOM 構造と CSS を確認する  
   - 狭幅画面で崩れやすい箇所を特定する
2. スマホ幅を想定した表示確認を行う  
   - 目安: 390px 前後
   - どの要素が詰まるかを確認する
3. score panel をレスポンシブ化する  
   - 縦積み化
   - 間隔調整
   - フォント・バッジ・バーの縮小
   - 必要なら情報優先度に応じて簡略表示
4. Route progress 表示を狭幅向けに調整する  
   - 上位N件のみ表示
   - バー高さ調整
   - 路線名省略
   - N/M 表示の見直し
   などを検討する
5. Hub badge 群を狭幅で破綻しにくくする  
   - 折り返し改善
   - 件数制限
   - “+N more” 表示などを検討してよい
6. result panel も狭幅で見やすく整理する  
   - Best route / Route+ / Hub+ の順序整理
   - 長文の簡略化
   - 行間・余白調整
7. City Comparison Mini-panel を追加する  
   - 都市ごとのスコア前提が分かる軽量な補助情報
   - 例:
     - average station score
     - node count / hub density
     - short city trait text
   - score panel か result panel の近くに自然に置く
8. PC / スマホ相当の両方で確認する  
   - PC で情報不足になっていないか
   - スマホで詰まりすぎていないか
9. Tokyo / Osaka / London / NYC の4都市で表示確認する
10. コンソールエラー 0 を確認する

## Expected Output
- 変更ファイル一覧
- スマホ向けに何をどう整理したか
- City Comparison Mini-panel の内容
- PC / スマホそれぞれでの見え方の要約
- 4都市確認結果
- コンソールエラー件数
- 残課題
- 次タスク候補

## Completion Report に必ず書いてほしいこと
- どの画面幅を想定してレスポンシブ調整したか
- score panel で何を優先表示にしたか
- Route progress と Hub badge をスマホでどう簡略化したか
- City Comparison Mini-panel に何を表示したか
- Tokyo / Osaka / London / NYC で表示上の差がどう見えたか
- PC 表示をどこまで維持できたか
- 今後さらにスマホ最適化するなら何が必要か

## Success Criteria
- 狭幅画面でも score panel / result panel が読みやすい
- Route progress / Hub badge が破綻しにくい
- City Comparison Mini-panel が都市差の理解に役立つ
- PC 表示の完成度を大きく損なわない
- Task 01〜04 を壊していない
- コンソールエラー 0
