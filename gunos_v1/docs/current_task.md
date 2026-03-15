# Task
GUNOS V1.2 Task 02 — Gameplay Balance Tuning

**Status:** Completed
**Date:** 2026-03-14

## Goal
- 現在のスコア構造とゲーム進行バランスを点検し、戦略の偏りや極端な取り得を減らす
- Route+ / Hub+ / Station score の関係を整理し、プレイヤーにとって「何を狙うべきか」がより納得感ある形になるよう調整する
- 4都市で同じルールを使っても破綻しにくい、より安定したゲームバランスに近づける

## Completion Details
- **Station Score Normalization:** London / NYC のスコアスケールが小さすぎる問題（平均1.1-1.4）を解決するため、`_computeStationScore` に `TARGET_AVG` (6.0) に向けたスケールファクターを導入しました。これにより全都市で Station Score が同等の重みを持つようになりました。
- **Hub+ Bonus Redesign:** パーセンタイルベース（p90/p75/p50）から相対スコアベース（`score / max_score`）に変更しました。これにより London/NYC で Hub+ がスコアの70%以上を占める問題が解消され、真のハブ駅のみがボーナスを得るようになりました。
- **Route+ Eased:** Route+ の partial 閾値を 50% から 33% に緩和し、4〜5駅の短路線にもボーナスを追加しました。これにより、標準的なターン数でも Route+ が現実的な戦略目標として機能するようになりました。
- **Testing:** 全4都市でテストを行い、コンソールエラーなし、かつスコアバランスが正常化されたことを確認しました。

## Next Steps
Proceed to **V1.2 Task 03: Onboarding & Tutorial Layer**.
