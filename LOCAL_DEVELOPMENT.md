# ローカル検証手順

この作業コピーは、本番の Firebase データへ誤って書き込まないよう、ローカル検証時だけ Emulator Suite へ接続します。

## 起動

```sh
npm run dev:local
```

起動後に `http://127.0.0.1:3040/` を開きます。

- アプリ: 3040
- Authentication Emulator: 9106
- Firestore Emulator: 8086
- Storage Emulator: 9206
- Emulator UI: 4011

3000番と3010番は使用しません。

## 終了

起動したターミナルで `Control + C` を1回押します。アプリと各エミュレータがまとめて終了します。

## Firebase権限テスト

アプリとエミュレータを起動したまま、別のターミナルで次を実行します。

```sh
npm run test:emulator
```

匿名ゲスト投稿、公開・非公開の読み分け、投稿者以外の変更拒否、画像保存領域の分離を自動確認します。権限ルールを変更した場合は、先にローカル環境を終了して `npm run dev:local` で起動し直してください。

## 注意

- 通常の `npm run dev` は本番 Firebase の設定を使用するため、開発確認では使いません。
- `firebase deploy` は、検証完了とレビューが済むまで実行しません。
