---
title: GraalVM Native
sidebar:
  order: 18.5
---

MyBatis-Plus は GraalVM Native Image をサポートし、条件を満たすプロジェクトで起動が速く、実行時メモリ使用量の少ないネイティブ実行ファイルを構築できます。

## 機能概要

- **Native Image ビルド**: GraalVM Native Image と連携し、アプリケーションをプラットフォーム固有のネイティブ実行ファイルへコンパイルできます。
- **Spring AOT 連携**: Spring Boot 3 AOT のシナリオで、実行時に必要なリフレクションやリソースアクセスなどのヒント登録と連携します。
- **デプロイ形態の簡素化**: 生成物は完全な JVM 起動フローを経ずに直接実行でき、クラウドネイティブ、Serverless、コンテナ、起動時間が重要な場面に適しています。

## 前提条件

- GraalVM JDK など、Native Image をサポートする JDK を使用します。
- プロジェクトが Spring Boot 3.x、または GraalVM Native Image に対応したビルド体系を使用していること。
- MyBatis-Plus のバージョンが GraalVM Native Image サポートを含んでいること。

:::note

Native Image はビルド時にクローズドワールド分析を行います。カスタムリフレクション、動的プロキシ、リソースファイル、Mapper XML、シリアライズ対象型など、フレームワークの自動登録範囲外にある内容は、GraalVM または Spring AOT の仕様に従って追加設定が必要になる場合があります。

:::

## ビルド例

Maven プロジェクトでは Spring Boot Native Build Tools を使用できます。

```bash
mvn -Pnative native:compile
```

ビルド成功後、生成されたネイティブ実行ファイルを直接起動できます。

```bash
./target/demo
```

コンテナイメージを構築する場合は、Spring Boot プラグインを使用できます。

```bash
mvn -Pnative spring-boot:build-image
```

## 注意事項

- ネイティブイメージのビルド時間は通常の JVM Jar ビルドより長くなるため、CI では個別のビルドタスクとして設定することを推奨します。
- 動的 SQL、XML Mapper、カスタム TypeHandler、カスタムインターセプターなどは引き続き使用できますが、関連するクラスやリソースが AOT 分析対象になるか、明示的に登録されていることを確認してください。
- ネイティブ実行ファイルは対象 OS と CPU アーキテクチャに依存するため、対応する環境でビルドしてください。
- 開発時のデバッグには通常の JVM モードを使い、リリース検証で Native Image ビルドを実行することを推奨します。
