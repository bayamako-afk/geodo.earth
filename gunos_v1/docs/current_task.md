GUNOS V1.4 Task 02 — Next Candidate Indicators
Objective
GUNOS のゲーム性をさらに分かりやすくするため、
次に狙う候補駅の価値 を軽く可視化する
Next Candidate Indicators を実装する。

本タスクでは、すべての駅に詳細情報を出すのではなく、
現在の局面に対して 有力そうな候補駅 に短い指標や理由を付けることで、
「次に何を狙うゲームか」が伝わる UI を追加する。

Background
V1.4 Task 01 では、直近に取得した駅に対して
Hub / Route+ / Chain / Lead+ / Score などの短い価値タグと理由文を表示し、
取った駅に意味がある ことが見え始めた。

一方で、プレイ中にはまだ以下が十分には伝わらない。

次にどの駅が有力候補なのか
なぜその駅を狙う価値があるのか
Route+ / Hub+ / 接続 / リード差 との関係
プレイヤーが何を考えて駅を選ぶゲームなのか
そのため V1.4 Task 02 では、
地図上または近接HUD上に Next Candidate Indicators を追加し、
GUNOS をさらに「駅選定の意味を読むゲーム」に近づける。

Scope
今回のタスクで行うこと。

次候補駅を示す軽量 indicator UI を追加する
候補駅に短い価値タグや簡易理由を付ける
現在の局面に対して有力候補が少し分かるようにする
PC / スマホ横 / スマホ縦で破綻しにくい軽量表示にする
map-first 方針を維持する
Out of Scope
今回まだやらないもの。

完全な最適戦略AI
全駅のリアルタイム評価一覧
重いヒートマップ演出
ルールやスコアロジックの全面変更
チュートリアル全文説明
大型サイドパネルの追加
result screen の全面刷新
今回はあくまで
「候補駅に軽い意味付けを与えるUI」 に留める。

Required Design Direction
Core concept
地図を隠さない
候補を出しすぎない
情報は短く、意味は強く
初見でも「次はここが良さそう」が伝わる
スマホ横向きでも邪魔にならない
UX intention
ユーザーが画面を見たときに、少なくとも次のどれかが伝わること。

この駅は次の有力候補
この駅は Hub / Route+ / 接続に効く
この駅を取るとリード差やスコアに影響しそう
GUNOS は候補の価値を読んで選ぶゲーム
Candidate Selection Direction
完全な最適解でなくてよい。
まずは既存 state / score / route / station_details から拾える範囲で
候補駅を 1〜3 件程度 出すことを目標にする。

候補の例:

現在の route chain を伸ばせる駅
Hub 関連ボーナスに寄与しそうな駅
score gain が期待できる駅
leader gap を縮めそうな駅
capture / connection の意味が強い駅
Required UI Elements
以下のいずれか、または複合で成立させること。

A. Candidate Markers on Map
候補駅の近くに小さな indicator を出す。

候補:

小型バッジ
ドットやリング
短いタグ（Hub / Route+ / Score など）
過度に派手でないハイライト
B. Candidate Summary Panel
地図上または HUD 内に、候補駅を短く一覧表示する。

候補:

station name
short value tag
short reason line
例:

Shinjuku — Hub+
Otemachi — Route+
Ikebukuro — Lead+
C. Compact Reason Labels
各候補に短い理由ラベルを付ける。

例:

Hub
Hub+
Route+
Chain
Connect
Lead+
Score
Value
Placement Guidance
推奨:

地図上の候補駅近くに軽い indicator
top-right score summary の補助表示
bottom-center current info 周辺に候補要約
station hint panel と競合しない位置
避けること:

地図中央を大きく塞ぐ
候補を大量表示する
スマホ横で視界を圧迫する
Task 04/05 の map-first を後退させること
Implementation Tasks
1. Add next candidate indicator layer
現行の map / HUD 構造に自然に乗る形で、
候補駅 indicator 用の表示レイヤを追加すること。

例:

candidate_indicator.js
#candidate-indicators
#next-candidate-layer
命名は既存構造に合わせてよいが、
役割が分かること。

2. Select and rank a small set of candidates
現在局面に応じて、候補駅を少数抽出すること。

要件:

1〜3件程度で十分
完全最適でなくてよい
既存データから説明可能な理由を付けられること
候補がゼロでも壊れないこと
3. Show short candidate value tags
候補駅に短いタグを付けること。

最低限候補:

Hub
Hub+
Route+
Chain
Connect
Lead+
Score
Value
タグは短く、視認性優先。
長文は不要。

4. Show short candidate reason
候補駅について、短い理由を示すこと。

例:

“extends current route”
“improves hub potential”
“helps reduce leader gap”
“strong score chance”
“supports connection growth”
英語・日本語は現行UIに合わせてよい。
重要なのは短く意味が伝わること。

5. Keep station hint and candidate hint compatible
Task 01 の station value hint と競合しないようにすること。

期待する状態:

直近取得駅の意味は Task 01 側で見える
次候補駅の意味は Task 02 側で見える
両方合わせて「取った意味」と「次の狙い」がつながる
6. Responsive handling
レスポンシブ必須。

PC
1〜3件の候補表示で可
HUD と地図が両立すること
Smartphone landscape
最重要ターゲット
地図上 indicator は小さく
要約テキストは短く
map-first を壊さないこと
Smartphone portrait
候補数を減らしてよい
要約だけでもよい
操作系を邪魔しないこと
Constraints
以下を守ること。

Task 04 / Task 05 / V1.4 Task 01 の成果を壊さない
地図面積を圧迫しない
Leaflet 操作を妨げない
既存 scoring / Route+ / Hub+ / station hint ロジックを壊さない
候補を出しすぎない
完璧な推薦より「意味の見える化」を優先する
Acceptance Criteria
以下を満たすこと。

next candidate indicator UI が追加されている
次に狙う候補駅が以前より分かりやすい
候補駅に短い価値タグまたは理由が付いている
Route+ / Hub+ / 接続 / score / lead gap のどれかとの関係が見える
初見でも「次を読むゲーム」に近づいたと感じられる
スマホ横で地図主役が維持されている
PC / スマホ横 / スマホ縦で致命的に崩れない
既存 gameplay が正常に動く
Verification Checklist
以下を確認すること。

candidate indicator が自然に見える
station hint panel / score summary / event toast と競合しない
候補数が多すぎない
候補理由が短く読みやすい
map-first を壊していない
スマホ横で邪魔にならない
START から GAME OVER まで問題ない
console error が出ない
Deliverables
以下を提出すること。

実装内容の要約
変更ファイル一覧
candidate selection / indicator UI の説明
PC / スマホ横 / スマホ縦 の表示確認結果
既知の制約
必要ならスクリーンショット
commit hash
Expected Result
このタスク完了時点で、GUNOS はまだ最終UIでなくてよい。
ただし少なくとも、

直近取得駅の意味だけでなく
次に狙う候補駅の意味も少し見え
プレイヤーが何を考えて選ぶゲームかが前より伝わる
状態になることを期待する。

Suggested next tasks
次候補としては以下が想定される。

Task 03: Score reason breakdown
Task 04: Route+ / Hub+ meaning badges
Task 05: Selected station detail card
Task 06: Beginner onboarding hint flow
Task 07: Result screen strategy summary
Instruction to Manus
現行コードを確認し、V1.3 と V1.4 Task 01 で整備した
map-first HUD / station hint の流れを維持したまま、
next candidate meaning が伝わる軽量 indicator UI を追加してください。

情報を増やしすぎず、
「次はここを狙う価値がある」 と感じられることを優先してください。