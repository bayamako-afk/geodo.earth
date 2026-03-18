# GUNOS V1.4 Task 01 — Result Overlay Polish

## Objective
V1.3で完成したHUDレイアウトに合わせて、ゲーム終了時の **Result Overlay** を洗練させ、勝敗結果や最終スコアがよりドラマチックかつ明確に伝わるようにする。

本タスクでは、ログ常設や大型パネル復帰は行わず、  
**地図上に軽量な情報オーバーレイを追加する** ことで、  
プレイ中の状況理解を補強することを目的とする。

---

## Background
V1.3では地図主役のHUDレイアウトが完成し、ゲーム中の状況は Map Overlay Info Panel により把握しやすくなった。しかし、ゲーム終了時の結果表示は依然として下部の小さな STATUS パネルに限定されており、勝敗のインパクトが薄い状態となっている。

その結果、
- 地図視認性
- 操作性
- モバイル横向きの成立性

は大きく改善したが、一方で
- 今なにが起きたのか
- なぜスコアが動いたのか
- 何を狙うゲームなのか

がやや伝わりにくくなる余地がある。

そのため次段階として、  
地図の上に **小さく・邪魔にならず・状況理解に効く情報パネル** を追加し、  
GUNOS を「地図が動くUI」から「意味の見えるゲームUI」へ一段進める。

---

## Scope
今回のタスクで行うこと。

1. ゲーム終了時に画面中央に表示される Result Overlay の実装
2. 勝者、スコア差、勝因（Route/Hubボーナス等）の視覚的強調
3. REMATCH ボタンへのスムーズな導線
4. PC / スマホ横 / スマホ縦でのレスポンシブ対応

---

## Out of Scope
今回まだやらないもの。

- 大型ログパネルの復活
- 派手なアニメーション演出
- result overlay の最終仕上げ
- 完全なチュートリアルUI
- ルール変更や採点ロジック変更
- 手札UIのフル刷新
- すべての詳細情報の常設表示

今回はあくまで  
**「状況が伝わる軽量オーバーレイ」** の追加に留める。

---

## Required Design Direction

### Core concept
- 地図を隠さない
- 情報は少なく、意味は強く
- 常設情報は最小限
- 「何が起きたか」「何を競うか」が伝わる
- スマホ横向きでも圧迫感が出ない

### UX intention
ユーザーが画面を見たときに、少なくとも以下が読み取れる状態を目指す。

- 今のターンやプレイヤー
- 直近で何が起きたか
- スコアや順位が動く理由のヒント
- 駅・Route+・Hub+ の意味づけの入口

---

## Required Overlay Elements
最低限、以下のいずれか、または複合で成立させること。

### A. Current Situation Panel
地図上の小型パネルとして、現在状況を表示する。

候補:
- current turn
- current player
- current city / mode
- simple score delta or status
- current target / current route context（可能なら）

### B. Recent Event Panel
直近イベントを 1〜3 件程度だけ見せる軽量表示。

候補:
- reached station
- Route+ activated
- Hub connected
- score +X
- player takes lead

※ 長いログ一覧ではなく、短く要点だけ出す。

### C. Game Meaning Hint
GUNOS が何を狙うゲームかを少し伝える情報。

候補:
- stations captured
- current leader
- score gap
- route bonus active
- hub bonus active

※ 情報は少なくてよいが、  
「ただの地図表示ではなく競っている」と分かることが重要。

---

## Placement Guidance
地図主役を維持しながら、以下のいずれかの配置で実装すること。

### Preferred options
- top-center に細い status bar
- upper-middle に小型 toast / info box
- bottom-center に current info を薄く重ねる
- top-right existing HUD の補助として小型追加表示

### Avoid
- 大きすぎる常設パネル
- 地図中心を長時間塞ぐ表示
- スマホ横で横幅を大きく使いすぎる配置
- 既存 bottom area を再び重くすること

---

## Implementation Tasks

### 1. Add overlay info container
現行の map-stage / HUD 構造に自然に乗る形で、  
overlay info panel 用のコンテナを追加すること。

例:
- `#map-overlay-info`
- `#event-toast`
- `#current-situation-panel`

命名は既存構造に合わせてよいが、  
役割が分かる形にすること。

---

### 2. Show current situation summary
常設または準常設で、現在の局面を短く表示すること。

最低限候補:
- Turn number
- Current player
- Current leader or ranking summary
- Active status (Route+ / Hub+ / Live if available)

表示は 1〜3 行程度の簡潔さを優先する。

---

### 3. Show recent event / action feedback
プレイ中の直近イベントが分かる軽量な表示を追加すること。

要件:
- 常時大きく出し続けない
- 直近 1〜3 件程度でよい
- ログ全件表示ではなく要約型
- スマホ横でも邪魔にならない

可能なら簡易 toast 的な挙動でもよいが、  
凝ったアニメーションは不要。

---

### 4. Reinforce game meaning
スコアや制覇の意味が少し伝わるようにすること。

最低限、以下のいずれかを入れること。
- leader / rank summary
- stations captured summary
- score delta
- route / hub bonus indicator
- short explanation-like labels

目的は、初見でも  
「駅や路線の取り方に意味がある」と感じられること。

---

### 5. Responsive handling
レスポンシブ必須。  
以下を意識すること。

#### PC
- 情報量は少し多めでも可
- 地図主役維持
- 既存 HUD と競合しない

#### Smartphone landscape
- 最重要ターゲット
- 情報量は最小〜中程度
- 視界を塞がない
- 常設は細く軽く

#### Smartphone portrait
- 常設をさらに減らしてよい
- 必要なら短い表示のみ
- 操作系と干渉しないこと

---

## Constraints
以下を守ること。

- Task 04 のスマホ横向き最適化を壊さない
- 地図面積を再び圧迫しない
- Leaflet操作を妨げない
- 既存スコア・Route+・Hub+ ロジックを壊さない
- 情報量を増やしすぎない
- 「見た目を足す」より「意味を伝える」を優先する

---

## Acceptance Criteria
以下を満たすこと。

1. 地図上に軽量な info overlay が追加されている
2. 今の局面が以前より分かりやすい
3. 直近イベントやスコア変動の意味が少し伝わる
4. GUNOS が「何を競うゲームか」が少し見えやすくなる
5. スマホ横で地図主役が維持されている
6. PC / スマホ横 / スマホ縦で致命的に崩れない
7. Task 04 の改善を後退させていない
8. 既存機能が正常に動く

---

## Verification Checklist
以下を確認すること。

- overlay info panel が map-stage 上で自然に見える
- HUD と競合していない
- 地図中心が塞がれすぎていない
- recent event が読みやすい
- current situation が短く分かりやすい
- score / leader / route / hub の意味が少し伝わる
- スマホ横で操作しにくくなっていない
- GAME START から GAME OVER まで基本動作が問題ない

---

## Deliverables
以下を提出すること。

1. 実装内容の要約
2. 変更ファイル一覧
3. 追加した overlay info 要素の説明
4. PC / スマホ横 / スマホ縦 の表示確認結果
5. 既知の制約
6. 必要ならスクリーンショット
7. commit hash

---

## Expected Result
このタスク完了時点で、GUNOS はまだ最終UIでなくてよい。  
ただし少なくとも、

- 地図主役を維持したまま
- 何が起きているかが少し分かりやすくなり
- スコアや駅選定の意味が少し伝わり
- 「何をするゲームか」が前より見えやすい

状態になっていることを期待する。

---

## Suggested next tasks
次候補としては以下が想定される。

- Task 06: Station / route meaning reinforcement panel
- Task 07: Hand dock refinement
- Task 08: Result overlay polish
- Task 09: Event toast animation / highlight polish
- Task 10: Beginner readability / onboarding hints

---

## Instruction to Manus
現行コードを確認し、Task 04 のスマホ横向き最適化を維持したまま、  
**small, readable, meaningful overlay info** を追加してください。

大きな情報パネルを戻すのではなく、  
**地図を主役にしたままゲームの意味が伝わるUI補強** を優先してください。
