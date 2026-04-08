# GUNOS V1.5 Task 01 — Beginner Onboarding Hints

## Objective
GUNOS を初めて見るユーザーが、  
**どこを見ればよいか / 何を狙うゲームか / なぜスコアが動くのか** を  
自然に理解しやすくするため、  
**Beginner Onboarding Hints** を実装する。

本タスクでは、長いルール説明や重いチュートリアルを追加するのではなく、  
既存の map-first HUD を維持したまま、  
**短く、邪魔にならず、視線を導くヒント表示** を追加することを目的とする。

---

## Background
V1.3 では map-first HUD foundation と smartphone landscape optimization が整備され、  
GUNOS は「地図主役」の UI 基盤を獲得した。

V1.4 ではその上に、
- captured station meaning
- next candidate meaning
- Hub / Route+ meaning badges
- score reason breakdown
- selected station detail card

が順に積み上がり、  
GUNOS は **駅と路線の価値を読むゲームUI** としてかなり輪郭が見えてきた。

一方で、初見ユーザーにはまだ以下が十分には伝わらない。

- 最初にどこを見ればよいか
- 何を狙って駅を選べばよいか
- Hub / Route+ / score がどうつながるか
- 画面内のどの情報が重要か
- 勝ち筋やプレイの流れをどう理解すればよいか

そのため V1.5 Task 01 では、  
**軽量なオンボーディングヒント** を追加し、  
「情報は揃っているが初見には少し難しい」状態を改善する。

---

## Scope
今回のタスクで行うこと。

1. beginner onboarding hint UI を追加する
2. 初見ユーザー向けに、見るべき場所や意味を短く案内する
3. 長文説明ではなく、短い段階的ヒントとして見せる
4. PC / スマホ横 / スマホ縦で破綻しにくい軽量UIにする
5. map-first 方針を維持する

---

## Out of Scope
今回まだやらないもの。

- 重いフルスクリーンチュートリアル
- 長文のルール説明ページ
- ルールブック化
- 採点ロジックの変更
- AI解説の全面導入
- 派手なアニメーション演出
- result screen の全面再設計

今回はあくまで  
**「最初の理解を助ける軽量ヒント」** を実装する。

---

## Required Design Direction

### Core concept
- 地図を隠さない
- 長文にしない
- 1回で全部教えない
- 既存HUDと既存意味表示を活かす
- 初見プレイヤーが「まず何を見ればいいか」を分かるようにする
- スマホ横でも邪魔にならない

### UX intention
ユーザーがゲーム開始直後から数ターンの間に、少なくとも次のどれかを理解できること。

- 地図が主役のゲーム画面である
- 駅には価値がある
- 次候補駅には狙う理由がある
- Hub / Route+ が重要な概念である
- スコアは理由を持って増減している

---

## Onboarding Strategy
オンボーディングは、  
**常設説明ではなく、短いヒントを段階的に出す方式** を基本とすること。

推奨パターン:
- 初回開始時に1つ目のヒント
- 数ターン進行後に2つ目のヒント
- 意味表示が出たタイミングで3つ目のヒント
- 以後は必要最小限

ヒントは多くても 3〜5 個程度で十分。  
情報を盛り込みすぎないこと。

---

## Required Hint Themes
最低限、以下のテーマのいずれかをカバーすること。

### A. Where to look first
例:
- “Check the map first.”
- “Watch the score summary at the top right.”
- “See candidate hints for possible next targets.”

### B. Why stations matter
例:
- “Captured stations have strategic value.”
- “Some stations improve Hub or Route+ potential.”

### C. Why scores move
例:
- “Score changes are explained near the score panel.”
- “Hub, Route+, and captures can affect the lead.”

### D. What to aim for
例:
- “Read station value and next candidates.”
- “Try to grow strong routes and useful connections.”

英語・日本語は現行UIに合わせてよい。  
重要なのは **短く、意味が伝わること**。

---

## Placement Guidance

推奨:
- map overlay 内の小型 hint bubble
- 既存 panel の近くに短く出す
- top-center か bottom-center の短い guidance
- 必要なら対象UI近くに 1 行だけ表示

避けること:
- 大型モーダル
- 地図中央を長時間塞ぐ表示
- 常時複数表示
- 左下情報群への詰め込みすぎ
- スマホ横で視界を圧迫する配置

---

## Implementation Tasks

### 1. Add onboarding hint container / controller
現行 HUD / overlay 構造に自然に乗る形で、  
onboarding hint 用のコンテナと制御を追加すること。

例:
- `onboarding_hints.js`
- `#onboarding-hint`
- `#beginner-guide-overlay`

命名は既存構造に合わせてよいが、  
役割が分かること。

---

### 2. Define a small sequence of onboarding hints
初見ユーザー向けに、  
短いヒント列を 3〜5 個程度定義すること。

期待するテーマ:
- 地図を見る
- 候補駅を見る
- Hub / Route+ に注目する
- スコア理由を見る
- 駅価値カードを見る

全部を必須にしなくてよいが、  
既存の V1.4 成果とつながる内容にすること。

---

### 3. Show hints at meaningful timing
ヒントは適切なタイミングで表示すること。

候補:
- game start
- first turn
- first station capture
- first candidate update
- first score change
- first Hub / Route+ related event

完全なイベント設計でなくてよい。  
まずは「今それを言うと理解に効く」タイミングを優先すること。

---

### 4. Keep hints short and dismissible
ヒントは短く、必要なら自然に消えるか、  
閉じられるようにすること。

期待すること:
- 1〜2行程度
- 自動消去 or 次のヒントへ進行
- 同時に大量表示しない
- うるさくしない

---

### 5. Reuse existing meaning system
V1.4 で整備した以下の流れと自然に接続すること。

- station hint
- candidate indicators
- Hub / Route+ meaning badges
- score reason breakdown
- selected station detail card

期待すること:
- ヒントが独立した説明文で終わらない
- 既存UIを「見るポイント」として案内する
- 今後の onboarding 拡張にもつながる

---

### 6. Responsive handling
レスポンシブ必須。

#### PC
- 少し情報多めでも可
- 邪魔にならず読みやすいこと

#### Smartphone landscape
- 最重要ターゲット
- 短く、細く、軽く
- map-first を壊さないこと

#### Smartphone portrait
- さらに簡略化してよい
- 1ヒントごとの情報量を減らしてよい
- 操作系と競合しないこと

---

## Constraints
以下を守ること。

- V1.3 / V1.4 までの成果を壊さない
- 地図面積を圧迫しない
- Leaflet 操作を妨げない
- 情報を増やしすぎない
- 長文チュートリアルにしない
- “教え込む” より “見る場所を導く” を優先する

---

## Acceptance Criteria
以下を満たすこと。

1. beginner onboarding hint UI が追加されている
2. 初見ユーザーがどこを見るべきか以前より分かりやすい
3. 既存の station hint / candidate / score reason / detail card への導線になっている
4. Hub / Route+ / score / station value の意味が少し理解しやすくなる
5. スマホ横で地図主役が維持されている
6. PC / スマホ横 / スマホ縦で致命的に崩れない
7. 既存 gameplay が正常に動く

---

## Verification Checklist
以下を確認すること。

- onboarding hints が自然に見える
- 既存パネルと競合しない
- ヒント文が短く読みやすい
- 出るタイミングが不自然でない
- スマホ横で邪魔にならない
- START から GAME OVER まで問題ない
- console error が出ない

---

## Deliverables
以下を提出すること。

1. 実装内容の要約
2. 変更ファイル一覧
3. onboarding hint sequence の説明
4. PC / スマホ横 / スマホ縦 の表示確認結果
5. 既知の制約
6. 必要ならスクリーンショット
7. commit hash

---

## Expected Result
このタスク完了時点で、GUNOS はまだ完全なチュートリアル付きゲームでなくてよい。  
ただし少なくとも、

- 初見ユーザーが見るべき場所を理解しやすくなり
- V1.4 で増えた情報の意味を追いやすくなり
- GUNOS が“駅価値を読む戦略ゲーム”として入りやすくなる

状態になることを期待する。

---

## Suggested next tasks
次候補としては以下が想定される。

- Task 02: Result screen strategy summary
- Task 03: Readability / cleanup pass
- Task 04: Optional map-side candidate markers
- Task 05: First-time player UX polish
- Task 06: Collapsible / movable HUD experiments

---

## Instruction to Manus
現行コードを確認し、V1.3 / V1.4 で整備した  
map-first HUD と意味可視化UI群を維持したまま、  
**Beginner onboarding hints** を追加してください。

表示を増やしすぎず、  
**初見ユーザーが「どこを見れば何が分かるか」を自然に理解できること** を優先してください。
