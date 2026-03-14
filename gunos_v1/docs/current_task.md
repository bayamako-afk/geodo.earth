# Task
GUNOS V1.1 Task 04 — London / NYC Readability Tuning (Map Label Filter)

## Goal
- 駅が密集している巨大都市（London / NYC）のマップにおいて、テキストラベルが重なって可読性が低下する問題を解決する
- 全ての駅名を表示するのではなく、路線の交差点となる主要ハブ駅（`hub_degree` が一定以上の駅）に限定してラベルを表示するフィルターを導入する
- プレイヤーが「どの駅がネットワーク上の重要拠点か」を視覚的に把握しやすくする

## Current State
- プロジェクト: `geodo.earth/gunos_v1`
- 現在の状況:
  - V1 milestone 完了
  - V1.1 backlog 作成済み
  - Task 01 (Route/Network visibility polish) 完了
  - Task 02 (Score panel polish) 完了
  - Task 03 (Result panel polish) 完了
- 最新結果:
  - `docs/current_result.md` は `GUNOS V1.1 Task 03 — Route+ calculation cleanup and result panel refinement`
  - commit は `e731d06`
- 現在の実装状況:
  - `map_canvas.js` にてSVGマップを描画している
  - 現在はすべての駅（node）に対して一律にテキストラベル（`<text>`要素）を描画しているか、CSSホバーでのみ表示している可能性がある（要調査）
  - Tokyo / Osaka は比較的見やすいが、London / NYC は駅数が多く密集しているため可読性が低い
- 対象URL:
  - `https://geodo.earth/gunos_v1/`
- 関連ファイル候補:
  - `src/ui/map_canvas.js`
  - `index.html` (CSS調整が必要な場合)

## Constraints
- 既存機能を壊さない（Task 01〜03で追加したRoute progressやHub+機能など）
- Tokyo / Osaka のような小〜中規模ネットワークでは、引き続き適度なラベル表示が維持されること
- パフォーマンスを低下させないこと（SVGの描画要素数を減らす方向になるため、基本的には向上するはず）
- `guno_v6/` ディレクトリ内のファイルは読み取り専用であり、直接変更しないこと

## Work Items
1. `src/ui/map_canvas.js` のラベル描画ロジックを調査する
   - 現在どのように駅名テキストがSVGに追加されているか（またはHTMLオーバーレイか）を確認する
2. ラベル表示のフィルタリング条件を策定する
   - `node.hub_degree_global` または `node.degree` を基準にする
   - 例: `hub_degree >= 3` の駅のみラベルを常時表示する、など
   - 都市の規模（総駅数）に応じて閾値を動的に変えるか、固定値にするか検討する
3. `map_canvas.js` にフィルターロジックを実装する
   - フィルター条件を満たさない駅のラベルは描画しない（または非表示クラスを付与する）
   - ホバー時には、フィルター外の駅名も表示されるようにする（CSSの `:hover` などを活用）
4. 4都市（Tokyo / Osaka / London / NYC）すべてで表示テストを行う
   - London / NYC での密集・重なりが軽減されているか
   - Tokyo / Osaka で必要なラベルが消えすぎていないか
   - ホバー時に駅名が正しく確認できるか
5. 必要に応じてCSSを調整する
   - ラベルのフォントサイズや色、背景のドロップシャドウ（テキストの視認性向上）など

## Expected Output
- 変更ファイル一覧
- 実装したフィルタリング条件の解説
- 4都市テスト結果（各都市でのラベル表示感の比較）
- コンソールエラー件数（0であること）
- 未解決点
- 次の推奨アクション（Task 05 候補）

## Completion Report に必ず書いてほしいこと
- どのような閾値（`hub_degree` など）でラベルをフィルタリングしたか
- 都市間での見え方の違い（London/NYCの密集はどう解消されたか、Tokyo/Osakaはどう維持されたか）
- ホバー時の挙動（非表示駅の確認方法）をどう担保したか
- 次タスク候補（V1.1 Backlog に基づく）
