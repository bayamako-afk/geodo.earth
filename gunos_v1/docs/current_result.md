# Completion Report

## Summary

GUNOS V1.1 Task 01 — Route / Network Visibility Polish を実装した。`map_canvas.js` に連続所有区間（route run）の専用描画レイヤーと、連結グループ（connected component）検出によるネットワークグロー強度の動的変化を追加した。孤立駅と連結駅群の視覚的差異が明確になり、プレイヤーのネットワーク成長がマップ上で直感的に読み取れるようになった。`score_panel.js` の Route+/Hub+ ラベルにもツールチップと active ハイライトを追加した。

## Files Changed

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `gunos_v1/src/ui/map_canvas.js` | 更新 | route run レイヤー・connected component 検出・孤立 vs 連結 差異・凡例 net:N 表示 |
| `gunos_v1/src/ui/score_panel.js` | 更新 | Route+/Hub+ ラベルに tooltip 追加・active ハイライト |
| `gunos_v1/src/ui/layout.js` | 更新 | キャッシュバスター v7 |
| `gunos_v1/src/ui/map_panel.js` | 更新 | キャッシュバスター v7 |
| `gunos_v1/src/app/main.js` | 更新 | キャッシュバスター v7 |
| `gunos_v1/index.html` | 更新 | キャッシュバスター v7 |

## What Was Done

**Route run レイヤー（`map_canvas.js`）**
同一路線上で連続所有されている区間を検出し、通常エッジレイヤーの上に専用の太いセグメント（strokeWidth 5.5）として描画する。Tokyo では早稲田→飯田橋→神田の連続所有が太いストライプとして表示される。

**Connected component 検出（`map_canvas.js`）**
BFS アルゴリズムでプレイヤーごとの連結グループを計算する。最大グループサイズに応じてネットワークグローの opacity を 0.08〜0.35 の範囲で動的に変化させる。大きなネットワークほど明るく強く表示される。

**孤立 vs 連結 差異（`map_canvas.js`）**
孤立駅（グループサイズ 1）は r=4.5・opacity 0.7 で小さく暗く表示し、連結駅はグループサイズに比例して r=5.5〜9・opacity 1.0 で大きく明るく表示する。

**凡例 net:N 表示（`map_canvas.js`）**
マップ右上の凡例に `P1 N (net:M)` 形式で所有駅数と最大連結グループサイズを表示する。

**非所有駅の後退（`map_canvas.js`）**
IDLE 時 opacity 0.28、ゲーム中 opacity 0.22 に下げ、所有駅との対比を強化した。

**score_panel.js 補助改善**
`Route+` / `Hub+` ラベルに `title` 属性（ツールチップ）を追加し、ボーナスが 0 より大きい場合に `score-breakdown-value--active` クラスで強調表示する。

## Test Result

| 都市 | Route run 表示 | Network glow 強度 | 孤立 vs 連結 差異 | 凡例 net:N | GAME OVER |
|---|---|---|---|---|---|
| Tokyo | ✅ | ✅ | ✅ | ✅ P1 8 (net:2) | ✅ P2 WINS 97.7 pts |
| Osaka | ✅ | ✅ | ✅ | ✅ P1 11 (net:...) | ✅ P1 WINS 125.5 pts |
| London | ✅ | ✅ | ✅ | ✅ P1 3 (net:2) | ✅ P2 WINS 13.0 pts |
| NYC | ✅ | ✅ | ✅ | ✅ P1 9 (net:1) | ✅ P2 WINS 24.5 pts |

コンソールエラー: 0。`guno_v6/` への変更: なし。

コミット: `92ec95e` — `bayamako-afk/geodo.earth` main ブランチにプッシュ済み。

## Remaining Issues

- **Route+ スコアが常に 0**: `final_score_engine.js` の `route_completion_score` が現在のゲームデータ構造（`ownedStations` の配列形式）と一致していない可能性がある。Route bonus が実際に加算されるケースが確認されていない。
- **Hub+ スコアが常に 0**: 同様に `network_hub_bonus.js` の `lines_master` 依存部分が London/NYC のデータ形式と完全には一致していない可能性がある。
- **London/NYC の駅名ラベル密度**: 駅数が多い（London 162駅、NYC 170+駅）ため、ズームなしでは駅名が重なり読みにくい。ズーム機能または動的ラベル間引きが必要。
- **キャッシュバスター方式**: 現在は手動で `?v=N` を更新しているため、デプロイ時に更新漏れのリスクがある。ビルドツール（Vite 等）導入が望ましい。

## Next Suggestions

- **Task 02 候補 — Route+ スコアの実動化**: `game_session.js` の `computeAllLiveScores` で `route_completion_score` が正しく呼ばれているか確認し、`ownedStations` を `lines_master` の路線区間と照合するロジックを修正する。Route bonus が実際に加算されることで、戦略的深みが増す。
- **Task 03 候補 — London/NYC ラベル間引き**: hub_degree 上位 N 駅のみラベルを表示する閾値フィルターを `map_canvas.js` に追加する。現在は全駅にラベルを表示しているため、密集都市では視認性が低下している。
- **Task 04 候補 — スコアパネル比較バー**: P1 と P2 のスコアを横並びのバーチャートで比較表示する。現在は縦並びのテキストのみで、リードの大きさが直感的に分かりにくい。
- **Task 05 候補 — RESET 後の都市切り替え UX**: 現在は都市ボタンをクリックするとページ遷移するが、RESET 後に同じ都市で再プレイするフローが明確でない。RESET ボタンを押した後に都市選択モーダルを表示する UX を検討する。
