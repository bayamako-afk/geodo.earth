# Task
GUNOS V1.1 Task 01 — Route / Network Visibility Polish

## Goal
- GUNOS V1 の main runtime で、`route` と `network` の成長がプレイ中にもっと分かるようにする
- 地図を見ただけで「どこがつながっているか」「どの route が伸びているか」が理解しやすい状態にする
- V1 の既存構造を壊さず、V1.1 の最初の改善タスクとして実装する

完了条件:
- 地図上で、孤立駅と接続済み駅群の差が今より明確に見える
- route の進行が今より視覚的に分かる
- network のつながりが今より視覚的に分かる
- Tokyo / Osaka / London / NYC の4都市で破綻せず動く
- `guno_v6/` は無変更のまま維持する

## Current State
- プロジェクト:
  - `guno_v6/` = source-of-truth engine / data environment
  - `gunos_v1/` = platform-facing playable runtime
- 現在の状況:
  - GUNOS V1 milestone は完成済み
  - Phase 1〜6 まで完了済み
  - map-first runtime は存在する
  - score/result UX も存在する
  - 4都市（Tokyo / Osaka / London / NYC）で main runtime が動作する
- 既知課題:
  - route / network の live visibility は都市によって見え方にムラがある
  - 特に dense city では connected group と isolated station の差が直感的に見えにくい
  - 「今 route が育っている」「network が広がっている」が視覚的にもう一段ほしい
- 対象URL:
  - `http://localhost:8080/gunos_v1/`
  - `http://localhost:8080/gunos_v1/?city=tokyo`
  - `http://localhost:8080/gunos_v1/?city=osaka`
  - `http://localhost:8080/gunos_v1/?city=london`
  - `http://localhost:8080/gunos_v1/?city=nyc`
- 関連ファイル:
  - `gunos_v1/src/ui/map_canvas.js`
  - `gunos_v1/src/ui/map_panel.js`
  - `gunos_v1/src/ui/score_panel.js`
  - `gunos_v1/src/app/main.js`
  - `gunos_v1/src/game/game_session.js`
  - `gunos_v1/src/state/store.js`
  - `gunos_v1/index.html`
- 参考にする既存版:
  - 現在の GUNOS V1 main runtime
  - `guno_v6/` 側の source-of-truth データ / engine
- 前提メモ:
  - V1.1 backlog の最優先は Playability 改善
  - その最初の具体タスクとして Route / Network visibility polish を実施する
  - 大きなアーキテクチャ変更は不要

## Constraints
- 触ってよい範囲:
  - `gunos_v1/src/ui/`
  - `gunos_v1/src/app/`
  - `gunos_v1/src/game/`
  - `gunos_v1/src/state/`
  - `gunos_v1/index.html`
  - 必要最小限の CSS
- 触らない範囲:
  - `guno_v6/` の engine / data / docs
  - 既存 city package のデータ内容
  - online architecture
  - scoring system 自体の再設計
- デザイン維持条件:
  - map-first の構成を維持する
  - product-like な UI を維持する
  - debug viewer っぽい見た目に戻さない
- 既存機能を壊さない:
  - city switching
  - START / RESET / PLAY 1 / AUTO
  - GAME OVER / result panel
  - 4都市対応
- 今回やらないこと:
  - special cards
  - replay system
  - online stabilization
  - city comparison dashboard の新設
  - score engine のロジック変更

## Work Items
1. `map_canvas.js` の route / network 可視化を強化する
   - connected owned stations を今より明確に見せる
   - isolated owned stations と connected group の見た目差を大きくする
   - route 上で成長している部分を今より認識しやすくする
   - 必要ならレイヤー強調・線の太さ・opacity・glow を調整する

2. 「route growth」が分かる最小限の視覚表現を追加する
   - 同一路線で連続的に所有されている区間を分かりやすくする
   - route completion UI 全面実装までは不要
   - まずは map 上の視認性を上げることを優先する

3. 「network growth」が分かる最小限の視覚表現を追加する
   - connected ownership chain が見えるようにする
   - network が伸びた時にプレイヤーに気づける表現にする
   - recent play highlight と干渉しないように整理する

4. `score_panel.js` 側で route / network の存在感を少し補強する
   - score logic 自体は変えない
   - route / network が map 上の変化と結びついて見えるように、表示の見出し・ラベル・視認性を軽く改善する
   - ただし今回は score panel 全面改修ではなく補助レベルでよい

5. 4都市で確認する
   - Tokyo / Osaka / London / NYC の4都市で、
     - 起動
     - START
     - PLAY 1
     - AUTO
     - GAME OVER
     を確認する
   - cityごとに route / network の見え方が破綻していないか確認する

6. 実装は小さく、効果は見やすく
   - architecture rewrite はしない
   - 既存レイヤー構造を活かす
   - Phase 6 完了状態を壊さずに、V1.1 の最初の polish として成立させる

## Expected Output
- 変更ファイル一覧
- route visibility で何を改善したか
- network visibility で何を改善したか
- score panel 側で何を補助したか
- Tokyo / Osaka / London / NYC の確認結果
- コンソールエラー有無
- 未解決点
- 次の推奨アクション
