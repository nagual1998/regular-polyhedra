# Regular Polyhedra Wireframe Demo

Three.js で5つの正多面体を表示するシンプルな3Dデモです。ワイヤーフレームと陰影付きの塗りつぶし表示を切り替えられます。

表示する正多面体:

- Tetrahedron: 正四面体
- Cube: 正六面体
- Octahedron: 正八面体
- Dodecahedron: 正十二面体
- Icosahedron: 正二十面体

## Features

- 5つの正多面体を横並びで3D表示
- 白っぽい背景上で見やすい色付きワイヤーフレーム
- 各正多面体は画面中央付近に位置固定
- 下部ラベルをクリックすると対応する正多面体の自動回転を開始/停止
- 正多面体をドラッグすると、ドラッグ方向にその場で手動回転
- 上部ボタンで5つの正多面体の表示を「ワイヤーフレーム」「面に色」に一括切り替え
- 正多面体をダブルクリックすると、その図形だけを中央に拡大表示し、ほかの図形を非表示にする
- 拡大した図形を再度ダブルクリックすると、元の5つの配置に戻る
- 表示モードや拡大表示を切り替えても、回転角度と自動回転の設定を保持
- デスクトップ/モバイル幅に対応したレイアウト

## Requirements

- Node.js

Three.js 0.166.1 は `src/vendor/three.module.js` に同梱しています。起動・操作時にインターネット接続は不要です。ローカルサーバーは引き続き必要です。

Three.js の MIT ライセンスは `src/vendor/three.LICENSE.txt` を参照してください。

## How to Run

PowerShell で以下を実行します。

```powershell
cd C:\Codex\regular-polyhedra\src
node dev-server.mjs
```

起動後、ブラウザで以下を開きます。

```text
http://127.0.0.1:4181/
```

別のポートを使う場合は `PORT` を指定できます。

```powershell
cd C:\Codex\regular-polyhedra\src
$env:PORT=4200
node dev-server.mjs
```

この場合は以下を開きます。

```text
http://127.0.0.1:4200/
```

## Controls

- 「ワイヤーフレーム」ボタン: 5つの正多面体を線で表示（初期状態）
- 「面に色」ボタン: 5つの正多面体を陰影付きの色付き面で表示
- 下部ラベルをクリック: 対応する正多面体の自動回転を開始/停止
- 正多面体をドラッグ: ドラッグ方向にその場で回転
- 正多面体をダブルクリック: その図形だけ中央に拡大表示
- 拡大中の正多面体を再度ダブルクリック: 元の5つの配置に戻す

拡大表示中もドラッグや自動回転、表示モードの切り替えができます。非表示の図形はドラッグの対象になりません。自動回転が有効な図形は、非表示中も回転を続けます。

## Files

```text
src/
  index.html      # 画面構造
  styles.css      # レイアウトと見た目
  main.js         # Three.js の描画、回転、ドラッグ操作
  dev-server.mjs  # ローカル開発用の静的サーバー
  vendor/
    three.module.js    # Three.js 0.166.1（ローカル読み込み）
    three.LICENSE.txt  # MIT ライセンス
```
