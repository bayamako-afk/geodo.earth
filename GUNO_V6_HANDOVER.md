# GUNO V6 オンライン版開発 引き継ぎ書

**作成日:** 2026年3月6日  
**作成者:** Manus AI

## 1. はじめに

本ドキュメントは、既存のローカル完成版 `guno_v5` から、オンライン対戦機能を備えた `guno_v6` へと開発を移行するための引き継ぎ書です。指示書 `manus向け_git_hub直接実装_指示書（guno_v_6_online）.md` の内容と、`guno_v5` の最終実装状況を統合し、V6開発をスムーズに開始するための情報を網羅しています。

## 2. V5とV6の役割分担

指示書の方針に基づき、V5とV6の役割を明確に分離します。

| バージョン | 位置づけ | 主な役割 |
|---|---|---|
| **guno_v5** | **ローカル完成版** | ・ルール検証・ゲームバランス調整のベース<br>・公開デモ<br>・**機能追加・破壊的変更は行わない** |
| **guno_v6** | **オンライン対応版** | ・オンライン対戦機能の追加<br>・GUNO Pack v1.0 への完全対応<br>・将来的なランキング・ログ機能の基盤 |

**最重要方針：** `guno_v5` の安定動作を維持するため、V6の開発は新規ディレクトリ `guno_v6/` で行い、V5のコードを直接変更・拡張することは避けます。

## 3. V5最終実装状況のサマリー

V6開発のベースとなるV5の最終実装状況です。

### 3.1. ファイル構成

V5は単一の `index.html` と複数のJSファイルで構成されるモノリシックなフロントエンドアプリケーションです。

- **`guno_v5/src/index.html`**: ゲーム画面のメインHTML
- **`guno_v5/src/js/guno_v5.js`**: ゲームロジック、UI制御、状態管理の大部分が実装されたコアファイル
- **`guno_v5/src/js/map.js`**: Leafletによる地図描画・路線表示ロジック
- **`guno_v5/src/editor/`**: GUNO Packを作成・編集するためのコースエディター
- **`guno_v5/src/gos/`**: GUNO Packの読み書き・操作を行うライブラリ群（`io.js`が中心）
- **`guno_v5/src/geojson/`**: 路線・駅の地理データ
- **`guno_v5/tools/`**: GUNO Pack変換用CLIスクリプト `build_guno_pack_v1.py`

### 3.2. ゲームロジック (`guno_v5.js`)

ゲームの進行は、`guno_v5.js` 内のグローバルな `state` オブジェクトと、それを操作する多数の関数によって管理されています。DOM操作とゲームロジックが密結合しており、V6ではこの分離が主要な課題となります。

- **状態管理:** `state` オブジェクト（`deck`, `players`, `mapState`, `turnIndex` など）
- **主要な関数:**
  - `startGame()`: ゲームの初期化
  - `playCard()`: カードを出す処理（UIイベントから直接呼ばれる）
  - `drawCard()`: カードを引く処理
  - `checkGuno()`: GUNO（路線完成）の判定
  - `endGame()`: ゲーム終了処理
- **UI更新:** `renderAll()` が `state` に基づいてUI全体を再描画する

### 3.3. GUNO Pack 仕様 (v1.0)

V5の最終段階で、GUNO Packはv1.0仕様に対応済みです。V6ではこのv1.0を標準フォーマットとして扱います。

- **`pack_version: "1.0"`**
- **Hub計算:**
  - `hub_degree_global`, `hub_bonus_global`, `hub_rank_global` (現実世界の乗換規模)
  - `hub_degree_deck`, `hub_bonus_deck`, `hub_rank_deck` (デッキ内路線での乗換規模)
- **CLIツール:** `build_guno_pack_v1.py` により、v0.2からv1.0への変換とHub値の付与が可能
- **エディター:** エクスポート時に自動でv1.0形式（Hub値含む）で出力

## 4. V6開発計画（指示書統合版）

指示書で示されたフェーズとブランチ戦略に基づき、V5の現状を踏まえた具体的な開発計画を以下に示します。

### Phase 1: v6-foundation (基盤構築)

- **ブランチ:** `feature/v6-foundation`
- **目的:** `guno_v6/` の雛形を作成し、V5から分離した開発環境を確立する。
- **タスク:**
  1. `guno_v6/` ディレクトリをリポジトリ直下に作成。
  2. 指示書で提案されたディレクトリ構成（`src/app`, `src/core`, `src/data`, `src/ui`, `src/net`, `src/shared`）を作成。
  3. `guno_v6/index.html` と `guno_v6/src/app/main.js` を最小構成で作成（例：「GUNO V6」と表示されるだけのページ）。
  4. `guno_v6/README_v6.md` を作成し、V6の目的、V5との違い、開発中であることを明記。
- **PR名:** `feat: scaffold guno_v6 foundation`

### Phase 2: Pack v1.0 ローダー

- **ブランチ:** `feature/v6-pack-loader`
- **目的:** V6がGUNO Pack v1.0を標準データとして扱えるようにする。
- **タスク:**
  1. `guno_v6/src/data/pack_loader.js` を作成。
  2. v1.0形式のJSONを読み込み、ゲームで利用可能な形式のデータオブジェクトを返す関数を実装。
  3. `entities` から駅情報、`collections` から路線情報を抽出し、特に `hub_degree_deck` などのゲームバランスに影響する値を正しく解釈できるようにする。
  4. V5の `gos/core/io.js` の `parsePack` を参考にしつつ、v1.0に特化したクリーンな実装を目指す。
- **PR名:** `feat: add GUNO Pack v1.0 loader for v6`

### Phase 3: Core Game Engine 分離

- **ブランチ:** `feature/v6-core-engine`
- **目的:** V5の `guno_v5.js` に混在するロジックから、UIに依存しない純粋なゲームエンジンを抽出する。
- **タスク:**
  1. `guno_v6/src/core/game_engine.js` を作成。
  2. ゲームの状態（State）をクラスまたはオブジェクトとして定義。
  3. 以下の操作を、Stateを受け取り新しいStateを返す純粋な関数として実装する。
     - `initGame(pack, playerNum)`
     - `playCard(state, playerId, cardIndex)`
     - `drawCard(state, playerId)`
  4. `guno_v5.js` の `makeDeck`, `getPlayableIndices`, `executePlay` などのロジックを移植・整理。
  5. `guno_v6/src/core/rules.js` に、カードプレイ可否判定などのルールを分離。
  6. `guno_v6/src/core/serializers.js` に、StateをJSONにシリアライズ／デシリアライズする処理を実装（オンライン同期の基礎）。
- **PR名:** `feat: extract pure game engine for v6`

### Phase 4: Scoring 分離

- **ブランチ:** `feature/v6-scoring`
- **目的:** 得点計算ロジックをゲームエンジンから分離し、独立して管理できるようにする。
- **タスク:**
  1. `guno_v6/src/core/scoring.js` を作成。
  2. `calculateScore(state, playerId)` 関数を実装。
  3. V5の `calculateScore` をベースに、路線制覇、駅制覇、GUNOボーナスなどを計算。
  4. **ゲーム内スコアには `hub_bonus_deck` を使用**し、`hub_bonus_global` は統計情報としてのみ扱うことを徹底する。
- **PR名:** `feat: add scoring module with deck hub support`

### Phase 5: v6-local 最小UI

- **ブランチ:** `feature/v6-local-ui`
- **目的:** 分離したコアエンジンを使い、ブラウザ上で最低限のローカル対戦ができるUIを構築する。
- **タスク:**
  1. `guno_v6/src/app/main.js` でコアエンジンを初期化し、UIと接続。
  2. `guno_v6/src/ui/` 以下に、手札（`hand.js`）、盤面（`board.js`）、ログ（`log.js`）などのUIコンポーネントを作成。
  3. UIコンポーネントは、エンジンから渡されたStateを描画することに専念する。
  4. ユーザーのアクション（カードクリックなど）をエンジンに通知し、エンジンが返した新しいStateでUIを更新する、という単方向データフローを確立する。
- **PR名:** `feat: implement v6 local playable prototype`

### Phase 6: Online-demo ルーム基盤

- **ブランチ:** `feature/v6-online-room`, `feature/v6-supabase-sync`
- **目的:** Supabaseを利用して、2〜3人でのオンライン対戦のプロトタイプを実装する。
- **タスク:**
  1. Supabaseプロジェクトをセットアップし、APIキーなどを環境変数として設定。
  2. `guno_v6/src/net/transport_supabase.js` に、SupabaseのRealtime機能を使ったメッセージ送受信処理を実装。
  3. `guno_v6/src/net/room_client.js` に、ルーム作成・参加・状態同期のロジックを実装。
  4. 同期モデルは **host-authoritative** を採用。Hostがゲームの正状態を保持し、他プレイヤーのアクションを処理して結果をブロードキャストする。
  5. `guno_v6/src/ui/room_panel.js` に、ルームIDの表示や参加ボタンなどのUIを作成。
- **PR名:** `feat: add online room and supabase sync for v6 demo`

## 5. 不足情報と推奨事項

指示書の内容に加え、V6開発を円滑に進めるために以下の点を補足します。

- **ビルドツール/バンドラーの導入:** V6ではファイルが細分化されるため、ViteやWebpackなどのモジュールバンドラーの導入を推奨します。これにより、ESM（`import/export`）構文の利用、開発サーバー、本番用ビルドの最適化などが容易になります。
- **リンター/フォーマッターの導入:** ESLintやPrettierを導入し、コード品質とフォーマットを自動で統一することで、複数人での開発や長期的なメンテナンス性が向上します。
- **状態管理ライブラリの検討:** ゲームが複雑化する場合、ReduxやZustandのような状態管理ライブラリの導入を検討する価値があります。ただし、初期段階ではコアエンジンが返すStateをそのまま使うシンプルなアプローチで十分です。
- **テスト:** コアエンジンやルール、スコアリングなど、UIに依存しない純粋なロジックには、Jestなどを使った単体テストを導入することを強く推奨します。これにより、リファクタリングや機能追加を安全に行えるようになります。

## 6. 最初のステップ

指示書の通り、最初のタスクとして **Phase 1: v6-foundation** に着手します。
`feature/v6-foundation` ブランチを作成し、`guno_v6/` のディレクトリ構造と雛形ファイルを作成するPRを提出することが、次の具体的なアクションとなります。
