# GUNO V6 - オンライン対戦版

> **開発中** - このディレクトリは GUNO V6 オンライン版の実装場所です。

## 概要

`guno_v6` は、ローカル完成版 `guno_v5` をベースに、**Supabase Realtime** を用いたオンライン対戦機能を追加したバージョンです。

## V5 との違い

| 項目 | guno_v5 | guno_v6 |
|------|---------|---------|
| 対戦形式 | ローカル（同一端末） | オンライン（複数端末） |
| バックエンド | なし | Supabase (PostgreSQL + Realtime) |
| 状態管理 | DOM 直結 | host-authoritative モデル |
| アーキテクチャ | モノリシック | モジュール分離 |

## ディレクトリ構成

```
guno_v6/
├── config.js          # Supabase 接続設定（自動生成）
├── index.html         # メイン HTML（予定）
├── README_v6.md       # このファイル
└── src/
    ├── app/           # アプリケーション初期化・エントリーポイント
    ├── core/          # ゲームエンジン（UIに非依存）
    ├── data/          # GUNO Pack v1.0 ローダー
    ├── net/           # Supabase 通信・ルーム管理
    ├── shared/        # 共通ユーティリティ
    └── ui/            # UI コンポーネント
```

## Supabase スキーマ

### `rooms` テーブル

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID | プライマリキー |
| `room_code` | TEXT | 人間が読めるルームコード |
| `host_id` | TEXT | ホストの匿名セッション ID |
| `status` | TEXT | `waiting` / `playing` / `finished` |
| `max_players` | INTEGER | 最大プレイヤー数（2〜4） |
| `player_count` | INTEGER | 現在のプレイヤー数 |
| `pack_name` | TEXT | 使用する GUNO Pack 名 |
| `created_at` | TIMESTAMPTZ | 作成日時 |
| `updated_at` | TIMESTAMPTZ | 更新日時（自動） |

### `game_states` テーブル

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | UUID | プライマリキー |
| `room_id` | UUID | `rooms.id` への外部キー |
| `state_json` | JSONB | シリアライズされたゲーム状態全体 |
| `turn_index` | INTEGER | 現在のターンプレイヤーインデックス |
| `turn_count` | INTEGER | 総ターン数 |
| `direction` | INTEGER | 進行方向（1 or -1） |
| `game_over` | BOOLEAN | ゲーム終了フラグ |
| `last_action` | TEXT | 最後のアクション種別 |
| `last_actor_id` | TEXT | 最後にアクションしたプレイヤーの ID |
| `version` | INTEGER | 競合検出用バージョン番号 |
| `created_at` | TIMESTAMPTZ | 作成日時 |
| `updated_at` | TIMESTAMPTZ | 更新日時（自動） |

## RLS ポリシー

- **rooms**: SELECT は全員可、INSERT は全員可、UPDATE/DELETE はホストのみ
- **game_states**: SELECT は全員可、INSERT/UPDATE/DELETE はルームのホストのみ

## 開発フェーズ

引き継ぎ書 `GUNO_V6_HANDOVER.md` に従い、以下のフェーズで実装を進めます：

1. **Phase 1**: v6-foundation（基盤構築）← 現在
2. **Phase 2**: Pack v1.0 ローダー
3. **Phase 3**: Core Game Engine 分離
4. **Phase 4**: Scoring 分離
5. **Phase 5**: v6-local 最小 UI
6. **Phase 6**: Online-demo ルーム基盤（Supabase 連携）
