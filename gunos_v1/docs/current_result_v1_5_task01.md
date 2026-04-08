# V1.5 Task 01 オンボーディングヒント修正結果レポート

**作成者:** Manus AI
**作成日:** 2026年4月8日

## 概要

GUNOS V1 の V1.5 Task 01 において、オンボーディングヒントが表示されないバグの修正と、全ヒントトリガーの動作検証を完了しました。

## バグの根本原因

ヒントが表示されない問題は、CSS の `opacity` プロパティの制御方法の不一致が原因でした。

1. `onboarding_hints.js` では、インラインスタイル (`element.style.opacity = '1'`) を使用してヒントを表示しようとしていました。
2. しかし、CSS 側では `#onboarding-hint` に対して `opacity: 0` が設定されており、`ob-hint--visible` などの CSS クラスによって表示状態を制御する設計になっていました。
3. インラインスタイルと CSS transition の競合により、要素の computed opacity が 0 のまま維持され、画面に表示されない状態になっていました。

## 修正内容

`onboarding_hints.js` を書き換え、インラインスタイルの代わりに CSS クラスを使用して表示を制御するように変更しました。

- `style.opacity = '1'` を `classList.add('ob-hint--visible')` に変更
- `style.opacity = '0'` を `classList.remove('ob-hint--visible')` と `classList.add('ob-hint--fading')` に変更

これにより、CSS の transition が正しく機能し、ヒントがフェードイン・フェードアウトするようになりました。

## 検証結果

修正後、全5種類のヒントトリガーが正しいタイミングと順序で表示されることを確認しました。

| ヒントID | トリガー条件 | 表示テキスト | 状態 |
|---|---|---|---|
| `hint-map` | ゲーム開始時 (Turn 0) | "The map is your game board. Stations are your pieces." | 正常表示 |
| `hint-candidate` | Turn 1開始時 | "Bottom-left shows your next best targets..." | 正常表示 |
| `hint-hub` | Turn 1以降のカード取得時 | "Hub stations give bonus points. Route+ grows your network." | 正常表示 |
| `hint-score` | Turn 3以降のスコア変動時 | "Top-right shows why your score moved..." | 正常表示 |
| `hint-detail` | Turn 5開始時 | "Each station has a value card. Read it to plan your next move." | 正常表示 |

すべてのヒントは表示から5.5秒後に自動的にフェードアウトし、次のヒントが適切なタイミングで表示されるようになっています。

## 対応状況

修正内容は `main` ブランチにコミットおよびプッシュ済みです。
