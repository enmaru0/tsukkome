# tsukkome

ボケのお題に対してツッコミを練習する Web アプリ。

## 機能

- 50個のお題からランダム出題
- ⌨ テキスト入力 / 🎤 音声入力（Web Speech API、日本語）
- 🔊 お題の自動読み上げ（Web Speech Synthesis API）
- 30秒のカウントダウンタイマー
- 模範ツッコミ例の表示
- 練習履歴の記録

## 開発

```bash
npm install
npm run dev
```

http://localhost:5173/ で起動します。

## ビルド

```bash
npm run build
```

## 技術スタック

- Vite + React + TypeScript
- Web Speech API（音声認識・音声合成）
- 静的サイトのみ（バックエンド・APIなし）

## 動作環境

- 音声入力: Chrome / Safari（HTTPS必須）
- iOS Safari は SpeechRecognition 未対応
