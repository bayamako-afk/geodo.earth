# GUNOS V1.3 Task 01 — Map-first HUD Layout Foundation

## Objective
GUNOS V1.2 までに実装された Route+, Hub+, Live Score, result panel などの機能を活かしつつ、UI の基本構造を「地図主役」のレイアウトへ移行する。

本タスクでは、完成形の演出実装までは求めない。  
まずは **地図コンテナを親にした HUD オーバーレイ基盤** を作り、既存 UI を段階移行できる状態にすることを目的とする。

---

## Background
現状の GUNOS は、機能面では V1.2 でかなり整理されてきた一方、今後さらに情報量が増えることを考えると、従来の別窓・分離レイアウトでは拡張性とスマホ適性に限界がある。

今後の方向性としては以下を重視する。

- 地図をゲーム盤の中心として見せる
- 情報表示を HUD 的にオーバーレイ配置する
- PC / スマホ横 / スマホ縦 の3パターンに耐える
- 既存機能をできるだけ壊さず段階移行する
- 将来の演出追加（通知、駅到達演出、結果オーバーレイ統合など）に備える

事前調査では、全面改修よりも **統合HUD案（段階移行）** が最適と判断された。  
そのため V1.3 Task 01 では、まず土台だけを安全に作る。

---

## Scope
今回のタスクで行うのは以下。

1. 地図コンテナを UI 全体の親ステージに再編する
2. HUD 用オーバーレイレイヤを追加する
3. 主要 UI を HUD として四隅・下辺に再配置できる構造へ変更する
4. PC / スマホ横 / スマホ縦で破綻しにくい基本レスポンシブを入れる
5. 現行機能が壊れていないことを確認する

---

## Out of Scope
今回まだやらないもの。

- 大規模な演出追加
- result overlay の最終デザイン完成
- 通知アニメーションの作り込み
- 手札 UI の完全リニューアル
- スコアパネルの情報最適化完成
- スマホ縦の完成版 UX 詰め
- 新ルール追加

今回はあくまで **レイアウト基盤の整備** が目的。

---

## Required Layout Direction
以下の思想で進めること。

### Core concept
- 地図 = 主役
- 各情報パネル = HUD
- 情報は「地図を隠さず、必要箇所に薄く置く」
- Leaflet との干渉を避ける
- 今後の追加要素を HUD に積めるようにする

### Target HUD zones
最低限、以下の配置枠を作る。

- top-left: ゲーム状態
- top-right: スコア / 順位
- bottom-left: ログ / イベント
- bottom-center: 現在情報または手札関連の受け皿
- bottom-right: 操作ボタン

※ この段階では中身を完璧に整えなくてよい。  
まずは「そこに置ける構造」を成立させることを優先する。

---

## Required Implementation Tasks

### 1. DOM / layout foundation refactor
現行レイアウトを確認し、地図周辺の DOM 構造を以下の思想に寄せること。

想定イメージ:

```html
<div id="map-stage">
  <div id="map"></div>

  <div id="hud-top-left" class="hud-panel"></div>
  <div id="hud-top-right" class="hud-panel"></div>
  <div id="hud-bottom-left" class="hud-panel"></div>
  <div id="hud-bottom-center" class="hud-panel"></div>
  <div id="hud-bottom-right" class="hud-panel"></div>
</div>
