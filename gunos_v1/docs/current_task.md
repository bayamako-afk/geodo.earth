# Task
GUNOS V1.1 Task 02 — Live Route / Hub Score Integration

## Goal
- GUNOS V1 main runtime で、`Route+` と `Hub+` が見た目だけでなく **実際の live score として動作する状態** にする
- score panel / result panel / current game state の数値整合を取る
- Task 01 で改善した route / network visibility と、score 側の意味づけを一致させる

完了条件:
- `Route+` が live score として非ゼロで変化し得る
- `Hub+` が live score として非ゼロで変化し得る
- score panel に表示される `Station / Route / Hub / Total` が current owned state と整合する
- result panel の最終内訳が live score と矛盾しない
- Tokyo / Osaka / London / NYC の4都市で破綻せず動く
- `guno_v6/` は無変更のまま維持する

## Current State
- プロジェクト:
  - `guno_v6/` = source-of-truth engine / data environment
  - `gunos_v1/` = platform-facing playable runtime
- 現在の状況:
  - GUNOS V1 milestone は完成済み
  - V1.1 Task 01 で route / network visibility polish を実施済み
  - `current_result.md` 上では、route/network の見え方は改善された
  - ただし、`Route+` / `Hub+` の live score は未解決の可能性がある
- 既知課題:
  - score panel 上の `Route+` / `Hub+` が 0 固定、または実状態と乖離している可能性
  - result panel の最終内訳と in-game live score の関係が十分明確でない
  - 都市ごとの score schema 差異があるため、adapter 層での吸収が必要
- 対象URL:
  - `http://localhost:8080/gunos_v1/`
  - `http://localhost:8080/gunos_v1/?city=tokyo`
  - `http://localhost:8080/gunos_v1/?city=osaka`
  - `http://localhost:8080/gunos_v1/?city=london`
  - `http://localhost:8080/gunos_v1/?city=nyc`
- 関連ファイル:
  - `gunos_v1/src/game/game_session.js`
  - `gunos_v1/src/ui/score_panel.js`
  - `gunos_v1/src/ui/result_panel.js`
  - `gunos_v1/src/app/main.js`
  - `gunos_v1/src/state/store.js`
  - 必要なら `gunos_v1/src/ui/map_panel.js`（scoreとの対応確認用）
- 参照元:
  - `guno_v6/` 側の scoring / engine ロジック
  - `gunos_v1/docs/current_result.md`
- 前提メモ:
  - scoring truth は `guno_v6/` 側を優先する
  - GUNOS V1 側で parallel scoring system を新設しない
  - 必要なら `game_session.js` に adapter を追加して bridge する

## Constraints
- 触ってよい範囲:
  - `gunos_v1/src/game/`
  - `gunos_v1/src/ui/`
  - `gunos_v1/src/app/`
  - `gunos_v1/src/state/`
  - 必要最小限の CSS
- 触らない範囲:
  - `guno_v6/` の engine / scoring / city data / docs
  - online architecture
  - city package データ自体
- デザイン維持条件:
  - 既存の map-first UI を壊さない
  - product-like layout を維持する
  - score panel は見やすく、debug化しすぎない
- 既存機能を壊さない:
  - city switching
  - START / RESET / PLAY 1 / AUTO
  - GAME OVER / result panel
  - 4都市対応
- 今回やらないこと:
  - score engine の大幅再設計
  - replay
  - online stabilization
  - city comparison dashboard
  - special cards
  - 新しい gameplay rule 追加

## Work Items
1. `game_session.js` で live score 計算の source を整理する
   - `Station`
   - `Route`
   - `Hub`
   - `Network`
   - `Total`
   の current values を、現在の owned state から取得できるようにする
   - scoring truth は既存 `guno_v6/` ロジックを優先する
   - 必要なら adapter 関数を追加する
   - 4都市スキーマ差異をここで吸収する

2. `Route+` の live score を実動化する
   - current owned state に応じて route contribution が非ゼロで出るか確認する
   - 0固定になっている場合は原因を特定し、V1 側 adapter で安全に修正する
   - live score と final result の route contribution が矛盾しないようにする

3. `Hub+` の live score を実動化する
   - current owned state に応じて hub contribution が非ゼロで出るか確認する
   - 0固定や city差異がある場合は原因を整理する
   - Tokyo / Osaka / London / NYC のメトリクス差異を adapter 側で吸収する

4. `score_panel.js` を live score 前提で整理する
   - `Station / Route / Hub / Network / Total` を current state に応じて表示する
   - 値が変化したときに panel が自然に更新されるようにする
   - どのプレイヤーが何でリードしているか分かりやすくする
   - ただし全面 redesign ではなく、既存UIの延長でよい

5. `result_panel.js` との整合を取る
   - GAME OVER 時の最終スコア内訳と、live score の最終状態が大きく矛盾しないようにする
   - winner explanation に `Route+` / `Hub+` が本当に効いているなら、それが読めるようにする
   - “why won” 表示が実数値と一致するようにする

6. 4都市で検証する
   - Tokyo
   - Osaka
   - London
   - NYC
   で、
   - START
   - PLAY 1
   - AUTO
   - GAME OVER
   を確認する
   - `Route+` / `Hub+` がずっと 0 のままではないか確認する
   - コンソールエラーがないか確認する

7. `current_result.md` に対応した実測の整合を取る
   - Task 01 の残課題だった `Route+ / Hub+ unresolved` を今回解消できたか明記できるようにする
   - もし一部都市でまだ制約が残るなら、正直に残課題として整理する

## Expected Output
- 変更ファイル一覧
- live score の計算元をどう整理したか
- `Route+` の問題の原因と修正内容
- `Hub+` の問題の原因と修正内容
- `score_panel.js` でどう見せ方を改善したか
- `result_panel.js` との整合をどう取ったか
- Tokyo / Osaka / London / NYC の確認結果
- コンソールエラー有無
- 未解決点
- 次の推奨アクション
