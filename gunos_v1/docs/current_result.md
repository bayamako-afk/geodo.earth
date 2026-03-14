# Completion Report

## Summary

**Task**: GUNOS V1.1 Task 02 — Route+ / Hub+ Live Score Activation

Route+ と Hub+ のライブスコアを実動化した。Phase 5 では Tokyo のみ Hub+ が機能し、London / NYC では `composite_score` の値域（0〜5）が Tokyo の `score_total`（4〜18）と異なるため Hub+ が常に 0 になっていた。今回の修正で全4都市で Hub+ が正常に計算・表示されるようになった。また Route 進捗バーとハブ駅名バッジをスコアパネルに追加した。

## Files Changed

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/game/game_session.js` | 修正 | 相対閾値 Hub ボーナス計算 `_computeHubBonusRelative()` 追加、`computeRouteScoreSync` を直接 import して Route+ を実動化 |
| `src/ui/score_panel.js` | 修正 | Route 進捗バー（路線名・N/M 表示・カラーバー）とハブ駅名バッジを追加 |
| `index.html` | 更新 | Task 02 CSS（`.score-route-progress`・`.score-route-bar`・`.score-hub-name`）追加、キャッシュバスター `?v=8` |
| `src/app/main.js` | 更新 | キャッシュバスター `?v=8` |

## What Was Done

**根本原因の特定**: London / NYC の `station_metrics` は `score_total` フィールドを持たず、`composite_score`（値域 0〜5）を使用している。既存の `_normalizeMetrics` は `score_total` を補完していたが、Hub ボーナス閾値（≥8, ≥10, ≥12）に該当する駅が 0 件になっていた。

**Hub+ 修正**: `_computeHubBonusRelative()` を新規実装。各都市の `score_total` 分布を分析し、top 10% / top 25% / top 50% の相対閾値でボーナスを計算する。これにより Tokyo（score 4〜18）と London/NYC（score 0〜5）の両方で均等にボーナスが発生する。

**Route+ 修正**: `_getRouteScoreSync()` が `null` を返していた問題を修正。`computeRouteScoreSync` を `game_session.js` の先頭で直接 import し、`_session.stationLines` と `_session.linesMaster` を正しく渡すよう修正した。

**Route 進捗バー**: `score_panel.js` の `updateLiveScores()` に Route 進捗セクションを追加。各プレイヤーが所有する駅が含まれる路線について、路線名・現在の所有駅数・路線総駅数・達成率バーを表示する。完成（≥50%）は緑、進行中（≥25%）は黄、それ以外は白で色分け。

**ハブ駅名バッジ**: Hub+ ボーナス対象となった駅名をオレンジバッジで表示する。

## Test Result

| 都市 | Hub+ 動作 | Hub 駅名 | Route 進捗バー | コンソールエラー |
|---|---|---|---|---|
| Tokyo | ✅ P1 13.0 / P2 12.0 | 日本橋・銀座 / 大手町・上野 | Ginza 2/18, Marunouchi 2/20 | 0 |
| Osaka | ✅ P1 15.0 / P2 12.0 | 天王寺・梅田 / 長居・淀屋橋 | Midosuji 3/20, Hankyu 1/17 | 0 |
| London | ✅ P1 15.0 / P2 16.0 | Hammersmith / Gloucester Road | Circle 3/31, Piccadilly 2/43 | 0 |
| NYC | ✅ P1 16.0 / P2 21.0 | Queensboro Plaza / Grand Central | 4 Train 2/1, 7 Train 1/1 | 0 |

## Remaining Issues

- **Route+ 完成ボーナスの最終確認**: NYC の「4 Train 2/1」は路線全駅（1駅）を超えた所有を示しているが、Route+ ボーナスの数値が result panel に反映されているか未確認。`computeRouteScoreSync` の閾値設定と `_session.linesMaster` の整合性を次タスクで確認することが望ましい。
- **London / NYC のスコール差**: Hub+ は相対化されたが、Station スコアの絶対値が Tokyo / Osaka（50〜150 pts）に対して London / NYC（10〜30 pts）と大きく異なる。都市間比較を行う場合は正規化が必要。
- **キャッシュバスター方式**: 現在は手動で `?v=N` を更新しているため、デプロイ時に更新漏れのリスクがある。ビルドツール導入が望ましい。

## Next Suggestions

- **Task 03**: Route+ 完成ボーナスの result panel 反映確認。NYC の 1 駅路線（4 Train 1/1 完成）で Route+ が result panel に表示されることを確認し、`computeRouteScoreSync` の出力を `computeFinalResults()` に正しく渡す。
- **Task 04**: London / NYC のマップ可読性改善。駅が密集している中心部（London: King's Cross 周辺、NYC: Times Sq 周辺）でのラベル重複を軽減するため、hub_degree 上位 N 駅のみラベルを表示する閾値フィルターを `map_canvas.js` に追加する。
- **Task 05**: スコアパネルの Station スコア都市間正規化（オプション）。都市特性テキストに「avg station score」を追加し、プレイヤーが都市スケールを把握できるようにする。
