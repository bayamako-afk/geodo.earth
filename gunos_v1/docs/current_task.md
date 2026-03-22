# GUNOS V1.4 Task 01 — Station Value Hint Panel

## Objective
GUNOS を「地図が動くUI」から一段進め、  
**駅選定に意味があるゲーム** であることが伝わる UI を追加する。

本タスクでは、現在のターンやイベント通知だけでなく、  
**今の駅選択・路線接続・Hub / Route+ の価値** が少し分かる  
**Station Value Hint Panel** を実装する。

---

## Background
V1.3 までで、以下はかなり改善された。

- 地図主役の map-first HUD 基盤
- smartphone landscape 最適化
- lightweight overlay info による状況把握
- Route+ / Hub+ / score / recent event の見えやすさ向上

一方で、初見ユーザーにはまだ以下が十分には伝わらない。

- どの駅を取ると有利なのか
- なぜその駅が重要なのか
- Hub や Route+ がどのように勝負に効くのか
- 何を狙うゲームなのか

そのため V1.4 では、まず  
**駅選定の意味を軽く可視化する UI** を追加し、  
ゲーム性の理解を前進させる。

---

## Scope
今回のタスクで行うこと。

1. 地図上または HUD 内に station value hint 表示を追加する
2. 現在注目されている駅や直近に取得した駅の意味を簡潔に示す
3. Route+ / Hub+ / 接続 / 制覇 / 得点などとの関係が少し分かるようにする
4. PC / スマホ横 / スマホ縦で破綻しにくい軽量UIにする
5. 既存 gameplay や map-first 方針を壊さない

---

## Out of Scope
今回まだやらないもの。

- 採点ロジックの全面見直し
- AI 対戦や戦略推薦
- チュートリアル全文表示
- 大型の説明パネル
- 派手なアニメーション
- result overlay の全面再設計
- 駅データベースの全面刷新

今回はあくまで  
**「駅の意味を見せる軽量ヒントUI」** を実装する。

---

## Required Design Direction

### Core concept
- 地図を隠さない
- 情報は短く、意味は強く
- ルール全文ではなく「ヒント」を見せる
- 初見でも「この駅は強そう」「ここを取る意味がある」と感じられる
- スマホ横でも圧迫感を出さない

### UX intention
ユーザーが画面を見たときに、少なくとも次のどれかが伝わること。

- この駅は Hub に関係する
- この駅は Route+ に関係する
- この駅を取ると接続や制覇が進む
- この駅取得がスコアやリードに効いている
- 駅選定に理由がある

---

## Required UI Elements

以下のいずれか、または複合で成立させること。

### A. Station Hint Panel
現在注目中または直近取得駅について、短い説明を出す。

候補:
- station name
- line / route context
- hub relevance
- route bonus relevance
- capture / chain / connection value
- short tag labels

例:
- Hub candidate
- Route+ chain
- Connection gain
- Score chance
- Lead swing point

### B. Short Reason Labels
駅やイベントに対して、短い理由ラベルを出す。

例:
- `Hub`
- `Route+`
- `Connect`
- `Capture`
- `Lead+`
- `Bonus`

### C. Compact Explanation Text
必要なら 1 行だけ説明を出す。

例:
- “This station extends the current route.”
- “This hub can improve bonus potential.”
- “Capturing this station increases area control.”
- “This move can reduce the leader gap.”

※ 英語・日本語は現行UIに合わせてよい。  
重要なのは短く意味が伝わること。

---

## Placement Guidance

推奨配置:
- bottom-center current info 付近
- map overlay info の下または近接位置
- top-right score summary の補助領域
- selected / recent station に近い位置

避けること:
- 地図中央を大きく塞ぐ
- 長文説明を常設する
- スマホ横で横幅を使いすぎる
- Task 04 で削った情報量をまた戻すこと

---

## Implementation Tasks

### 1. Add station hint container
現行 HUD / overlay 構造に自然に乗る形で、  
station value hint 用のコンテナを追加すること。

例:
- `#station-hint-panel`
- `#station-value-overlay`
- `#current-station-hint`

命名は既存構造に合わせてよいが、  
役割が明確であること。

---

### 2. Select a station context to describe
以下のいずれかを対象に、意味ヒントを表示すること。

優先候補:
- 現在処理中の駅
- 直近に取得した駅
- スコア変動を起こした駅
- Route+ / Hub+ に関係した駅

完全な戦略AIは不要。  
まずは既存 state / event / score 情報から拾える範囲でよい。

---

### 3. Show short value hints
駅の価値を短く表示すること。

最低限候補:
- short tags
- short reason line
- bonus relation
- leader gap relation
- capture / route / hub relation

表示は短く、読みやすさ優先。

---

### 4. Connect hint to gameplay meaning
ヒントが単なる飾りにならないよう、  
score / event / route / hub のどれかと結びつけること。

目的:
- なぜその駅が重要かが少し分かる
- GUNOS が「駅選定の意味を読むゲーム」だと感じられる
- 直近イベントと駅価値がつながる

---

### 5. Responsive handling
レスポンシブ必須。

#### PC
- 少し情報多めでも可
- HUDや地図と競合しないこと

#### Smartphone landscape
- 最重要ターゲット
- 1〜2行＋短いタグ程度で十分
- map-first を壊さないこと

#### Smartphone portrait
- さらに簡略化してよい
- 常設しすぎない
- 操作系を邪魔しないこと

---

## Constraints
以下を守ること。

- Task 04 / Task 05 の map-first 成果を壊さない
- 地図面積を圧迫しない
- Leaflet / map 操作を妨げない
- 既存 scoring / Route+ / Hub+ ロジックを壊さない
- 長文説明にしない
- 完成された戦略評価ではなく、まずは「意味の見える化」を優先する

---

## Acceptance Criteria
以下を満たすこと。

1. station value hint UI が追加されている
2. 駅選定に意味があることが以前より伝わる
3. Route+ / Hub+ / 接続 / capture / score のどれかとの関係が見える
4. 初見でも「何を狙うゲームか」が少し分かりやすくなる
5. スマホ横で地図主役が維持されている
6. PC / スマホ横 / スマホ縦で致命的に崩れない
7. 既存 gameplay が正常に動く

---

## Verification Checklist
以下を確認すること。

- station hint panel が自然に見える
- map overlay / score summary / event toast と競合しない
- ヒントが短く読みやすい
- 単なる駅名表示でなく、価値や理由が少し伝わる
- スマホ横で邪魔にならない
- START から GAME OVER まで基本動作に問題ない
- console error が出ない

---

## Deliverables
以下を提出すること。

1. 実装内容の要約
2. 変更ファイル一覧
3. station hint UI の説明
4. PC / スマホ横 / スマホ縦 の表示確認結果
5. 既知の制約
6. 必要ならスクリーンショット
7. commit hash

---

## Expected Result
このタスク完了時点で、GUNOS はまだ最終UIでなくてよい。  
ただし少なくとも、

- 駅選定に意味があることが見え始め
- Route+ / Hub+ / score との関係が少し伝わり
- GUNOS が「駅と路線の価値を読むゲーム」へ近づく

状態になることを期待する。

---

## Suggested next tasks
次候補としては以下が想定される。

- Task 02: Score reason breakdown
- Task 03: Hub / Route+ meaning badges
- Task 04: Selected station detail card
- Task 05: Beginner onboarding hints
- Task 06: Result screen game meaning polish

---

## Instruction to Manus
現行コードを確認し、V1.3 で整備した map-first HUD と smartphone landscape 最適化を維持したまま、  
**station choice meaning** が少し伝わる軽量 UI を追加してください。

情報を増やすことより、  
**「この駅を取る意味がある」ことを短く伝えること** を優先してください。
