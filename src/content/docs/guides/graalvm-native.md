---
title: GraalVM Native
sidebar:
  order: 18.5
---

MyBatis-Plus 新增支持 `GraalVM Native Image`，可在符合条件的项目中构建原生可执行文件，从而获得更快的启动速度和更低的运行时内存占用。

## 功能概述

- **原生镜像构建**：支持配合 `GraalVM Native Image` 将应用编译为平台相关的原生可执行文件。
- **Spring AOT 适配**：在 `Spring Boot 3 AOT` 场景下，配合框架完成运行期所需的反射、资源等提示信息注册。
- **部署形态简化**：构建产物可直接运行，不再依赖完整 `JVM` 启动流程，适合云原生、`Serverless`、容器镜像等启动敏感场景。

## 使用前提

- 使用支持 `Native Image` 的 `JDK`，例如 [GraalVM JDK](https://www.graalvm.org/downloads)。
- 项目已接入 `Spring Boot 3.x` 或其他支持 `GraalVM Native Image` 的构建体系。
- MyBatis-Plus 版本需包含 `GraalVM Native Image` 支持。

:::note

Native Image 会在构建期封闭分析应用代码。项目中的自定义反射、动态代理、资源文件、Mapper XML、序列化类型等，如果不属于框架自动注册范围，仍需按 GraalVM 或 Spring AOT 规范补充配置。

:::

## 构建示例

示例工程 `mybatis-plus-native-image-demo` 

- [国内 Gitee 下载](https://gitee.com/baomidou/mybatis-plus-native-image-demo)
- [国外 Github 下载](https://gitee.com/baomidou/mybatis-plus-native-image-demo)

[Maven](https://maven.apache.org/download.cgi) 项目可使用 Spring Boot Native Build Tools 构建：

```bash
mvn -Pnative native:compile
```

构建成功后，可直接运行生成的原生可执行文件：

```bash
./target/demo
```

如果使用容器镜像构建，可以通过 Spring Boot 插件生成 Native Image 镜像：

```bash
mvn -Pnative spring-boot:build-image
```

## 注意事项

- 原生镜像构建时间通常明显长于普通 JVM Jar 构建，建议在 CI 环境中单独配置构建任务。
- 动态 SQL、XML Mapper、自定义 TypeHandler、自定义拦截器等扩展能力可以继续使用，但需要确认相关类和资源能被 AOT 分析或显式注册。
- 原生可执行文件与目标操作系统和 CPU 架构相关，需要在匹配的构建环境中产出对应平台的可执行文件。
- 开发阶段仍建议优先使用普通 JVM 模式调试，发布阶段再执行 Native Image 构建验证。
