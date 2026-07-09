---
title: GraalVM Native
sidebar:
  order: 18.5
---

MyBatis-Plus adds support for GraalVM Native Image, allowing eligible projects to build native executables with faster startup and lower runtime memory usage.

## Feature Overview

- **Native Image build**: Works with GraalVM Native Image to compile an application into a platform-specific native executable.
- **Spring AOT integration**: In Spring Boot 3 AOT scenarios, framework runtime hints such as reflection and resource access can be registered during build analysis.
- **Simplified deployment**: The generated artifact can run directly without the full JVM startup flow, making it suitable for cloud native, Serverless, container, and startup-sensitive workloads.

## Prerequisites

- Use a JDK that supports Native Image, such as GraalVM JDK.
- The project uses Spring Boot 3.x or another build system that supports GraalVM Native Image.
- The MyBatis-Plus version includes GraalVM Native Image support.

:::note

Native Image performs closed-world analysis at build time. Custom reflection, dynamic proxies, resource files, Mapper XML files, serialization types, and similar project-specific code may still need extra configuration if they are outside the framework's automatic registration scope.

:::

## Build Example

For Maven projects, use Spring Boot Native Build Tools:

```bash
mvn -Pnative native:compile
```

After a successful build, run the generated native executable directly:

```bash
./target/demo
```

To build a container image, use the Spring Boot plugin:

```bash
mvn -Pnative spring-boot:build-image
```

## Notes

- Native image builds usually take much longer than regular JVM Jar builds. Consider configuring a separate CI build task.
- Dynamic SQL, XML Mapper files, custom TypeHandlers, and custom interceptors can still be used, but make sure the related classes and resources can be analyzed by AOT or explicitly registered.
- Native executables are tied to the target operating system and CPU architecture, so build them in a matching environment.
- During development, JVM mode is still recommended for debugging. Run Native Image builds as part of release verification.
