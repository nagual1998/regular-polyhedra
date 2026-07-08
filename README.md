# Regular Polyhedra Wireframe Demo

Three.js で5つの正多面体をワイヤーフレーム表示するシンプルな3Dデモです。

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
- デスクトップ/モバイル幅に対応したレイアウト

## Requirements

- Node.js
- インターネット接続

Three.js は CDN から読み込んでいます。

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

- 下部ラベルをクリック: 対応する正多面体の自動回転を開始/停止
- 正多面体をドラッグ: ドラッグ方向にその場で回転

## Files

```text
src/
  index.html      # 画面構造
  styles.css      # レイアウトと見た目
  main.js         # Three.js の描画、回転、ドラッグ操作
  dev-server.mjs  # ローカル開発用の静的サーバー
```
