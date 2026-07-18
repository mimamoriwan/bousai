# 開発環境の安全ルール

## 固定ポート

- Webアプリ: 3040
- Emulator UI: 4011
- Emulator Hub: 4411
- Emulator Logging: 4511
- Firestore: 8086
- Authentication: 9106
- Emulator Eventarc: 9156
- Storage: 9206

## 起動時のルール

- 起動前に、上記ポートが空いていることを確認する。
- ポートが使用中なら新しいアプリやEmulatorを起動せず、その状況を報告する。
- 既存プロセスを自動停止しない。`kill`、`pkill`などはユーザーの明示的な許可なしに実行しない。
- Viteは`strictPort`を有効にし、別ポートへの自動変更を許可しない。
- ポートを変更するときは、先にユーザーの承認を得て、関連設定と手順書を同時に更新する。

## ローカル検証

- 通常起動は`npm run dev:local`を使用し、本番Firebaseへ接続しない。
- 起動済みEmulatorにアプリだけ接続する場合は`npm run dev:local:app`を使用する。
- 本番デプロイは、検証とレビューが完了し、ユーザーが明示的に許可するまで実行しない。
