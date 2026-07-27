---
name: mybatis-plus-dev
description: >-
  MyBatis-Plus（baomidou）Java ORM 增强框架开发助手。
  适用于：项目已使用 MyBatis-Plus 依赖（mybatis-plus-boot-starter 及 mybatis-plus-spring-boot*-starter 系列，覆盖 SpringBoot 2/3/4）、BaseMapper/IService 继承体系、
  QueryWrapper/LambdaQueryWrapper 条件构造、分页插件（PaginationInnerInterceptor）、
  逻辑删除（@TableLogic）、自动填充（MetaObjectHandler）、乐观锁（@Version）、
  枚举映射（@EnumValue/IEnum）、@TableId/@TableField 字段映射、saveBatch 批量、
  MyBatis XML Mapper 编写、事务管理（@Transactional/事务失效排查），
  以及 null 不更新、分页失效、SQL 注入、字段映射错误等问题排查。
  不适用于：JPA/Hibernate、数据库表结构设计/DDL、纯 SQL 性能调优。
  纯 MyBatis 原生项目仅 XML Mapper 和事务章节部分适用。
agent_created: true
version: 2.0.0
slug: mybatis-plus-dev
displayName: MyBatis-Plus 开发助手
---

# MyBatis-Plus 开发助手

面向日常 Java 开发的 MyBatis-Plus 编码助手。推荐 **3.5.17**（3.5.x 最新线，2026），**3.5.x 全线适用**，3.4.x 大部分兼容（差异处已注明）。
采用**完全本地自包含**策略：所有知识沉淀于本地 `references/`，运行时不依赖任何外部文档站点。

## 版本与依赖（先判 SpringBoot 版本）

| SpringBoot | starter 坐标 |
|---|---|
| 2.x | `mybatis-plus-boot-starter` |
| 3.x | `mybatis-plus-spring-boot3-starter` |
| 4.x (^3.5.13) | `mybatis-plus-spring-boot4-starter` |

- **切勿**同时引入 `mybatis` / `mybatis-spring-boot-starter` / `mybatis-spring`，会与 MP 版本冲突。
- **分页必引** `mybatis-plus-jsqlparser`（自 v3.5.9 起 `PaginationInnerInterceptor` 已从核心拆分，单独成依赖；否则分页静默失效）。JDK8 项目用 `mybatis-plus-jsqlparser-4.9`。

## 何时使用本技能

| 信号 | 判定 |
|------|------|
| 依赖含 `mybatis-plus-*` / 代码 `extends BaseMapper` / `extends ServiceImpl` / 使用 Wrapper / `IService` / `saveBatch` / `selectPage` | 激活 |
| 提到 `@TableLogic` / `@TableField` / `@EnumValue` / `@Version` / `@TableId` / "MyBatis-Plus" / "MP" / "baomidou" | 激活 |
| 纯 MyBatis 原生（无 MP），仅问 XML / 事务 | 部分适用（仅 `references/10-xml.md` + `11-transaction.md`） |
| JPA / Hibernate / 表结构设计 / DDL / 纯 SQL 调优 | 不适用 |

> **检查点**：判定为「不适用」→ 告知用户当前问题不在 MyBatis-Plus 范围，建议退出本技能。判定为「部分适用」→ 告知仅 `10-xml.md` + `11-transaction.md` 可参考，其余不适用，让用户确认是否继续。

## 主动行为触发（见到这些代码模式时主动提醒）

- `selectPage` / `page` → 确认引了 `mybatis-plus-jsqlparser` + 注册 `PaginationInnerInterceptor`（否则分页静默失效）
- `@Transactional` 无 `rollbackFor` → 显式指定 `rollbackFor = Exception.class`
- `saveBatch` 当高性能批量 → 默认非 BATCH executor，量大需配 `BatchExecutor`（见 `04-crud.md`）
- 其余触发（null 不更新 / `apply` 注入 / Wrapper 复用 / XML 枚举 typeHandler / join 改写 XML）→ 见上方「核心强约束」#3/#4/#7/#8/#9 与下方「使用流程」自检清单

## 核心强约束（Agent 必须遵守）

1. **继承范式**：`XxxMapper extends BaseMapper<T>`；Service 接口 `extends IService<T>`；实现类 `extends ServiceImpl<XxxMapper, T>`。
2. **优先用父类方法**：单表 CRUD 直接用 `BaseMapper` / `IService` 提供的方法（`selectList` / `selectById` / `save` / `updateById` / `page` …），**不要手撸冗余 CRUD 或重复 XML**。
3. **复杂 / 联表 SQL 进 XML 或 `@Select`**：不要用 Wrapper 硬堆多表 join；MP 擅长单表，复杂查询交给 XML。
4. **null 不更新**：`updateById(entity)` 中 entity 的 `null` 字段默认**不参与更新**（根因：全局 `updateStrategy` 默认 `NOT_NULL`，见 `references/02-config.md` §7）；要显式置空用 `UpdateWrapper.set(...)` 或字段级 `@TableField(updateStrategy = FieldStrategy.ALWAYS)`。
5. **逻辑删除**：推荐 0+时间戳方案（`Long` 字段，`logic-not-delete-value: 0`，`logic-delete-value: "UNIX_TIMESTAMP(now())"`）；用全局 `logic-delete-field` 或字段 `@TableLogic`；启用后查询自动过滤已删除行。
6. **分页插件最后添加**：`MybatisPlusInterceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL))` 必须放在插件链**最后**；多数据源务必指定 `DbType`。
7. **SQL 注入防护**：`Wrapper.apply` 用 `{0}` 占位符（PreparedStatement 参数化）+ 前置 `SqlInjectionUtils.check(...)` 校验，**禁止字符串拼接** SQL 片段。`check` 返回 boolean 并抛异常，不返回安全值。
8. **Wrapper 不可复用**：同一 `Wrapper` 实例多次使用会叠加条件；每次查询 `new` 一个新的。
9. **枚举映射**：枚举值字段标 `@EnumValue`（或实现 `IEnum`），JSON 序列化标 `@JsonValue`；XML 自定义查询中枚举字段的**每个位置**（resultMap、条件 `#{}`、插入 `#{}`）都要声明 `typeHandler=MybatisEnumTypeHandler`。

## 决策路由（全部本地，无在线 fetch）

| 需求场景 | 读取文件 | 关键提醒 |
|---|---|---|
| 依赖、starter 选择、最小配置、基础 CRUD 跑通 | `references/01-start.md` | SB3 用 `spring-boot3-starter`；分页必引 `mybatis-plus-jsqlparser`（v3.5.9+，否则静默失效） |
| 全局配置：分页插件、逻辑删除全局、乐观锁、自动填充、防全表、**字段策略(insertStrategy/updateStrategy/whereStrategy)**、DbConfig/Configuration 速查 | `references/02-config.md` | 逻辑删除推荐 0+时间戳；唯一索引含 deleted；字段策略全局改 `ALWAYS` 会误清数据 |
| 实体映射：@TableId 策略、@TableField(字段策略/null/JSON)、**枚举映射(@EnumValue/IEnum/@JsonValue)**、@Version、@TableLogic | `references/03-entity.md` | 枚举 @EnumValue+@JsonValue；XML 每处 typeHandler |
| BaseMapper vs IService、继承范式、优先父类方法、saveBatch、null 不更新 | `references/04-crud.md` | 优先父类方法；null 不更新用 `UpdateWrapper.set` |
| QueryWrapper vs LambdaQueryWrapper、条件构造、apply 防注入、空值语义 | `references/05-wrapper.md` | Wrapper 不可复用；`apply` 用 `{0}` 占位 + `SqlInjectionUtils.check` |
| 分页：Page/IPage、自定义 count、联表分页 XML | `references/06-page.md` | IPage 非 null 非 List；ORDER BY 写 XML |
| 插件：逻辑删除/自动填充/乐观锁/多租户/动态表名/数据权限/防全表 | `references/07-plugin.md` | 插件顺序：分页最后 |
| **Agent 常见错误与最佳实践（重点看）** | `references/08-antipattern.md` | — |
| SQL 日志开启、常见异常与分页失效排查 | `references/09-troubleshoot.md` | — |
| **MyBatis XML Mapper 编写（mapper-locations / resultMap / 动态 SQL / 联表 / 联表分页）** | `references/10-xml.md` | 联表别用 Wrapper 硬堆 join |
| **事务管理（@Transactional / 事务失效 / saveBatch 事务 / 多数据源 / 编程式事务）** | `references/11-transaction.md` | rollbackFor 必须显式；自调用不走代理；多数据源单 `@Transactional` 限单库 |

> **组合场景阅读顺序**：先读机制类（`01`/`02`/`03`/`04`/`05`/`06`/`07`），再读落地/纠偏类（`08`/`09`/`10`/`11`）。例：分页+联表→先 `06` 后 `10`；枚举+XML→先 `03` 后 `10`；逻辑删除+多租户→先 `07` 后 `02`；批量+事务→先 `04` 后 `11`；事务+多数据源→先 `11` 后 `02`；事务回滚排查→先 `11` 后 `08`。

## 使用流程

1. **确认 MP 适用性**：看依赖 / Mapper 继承 / Wrapper 使用。不适用 → 告知用户并建议退出；部分适用 → 告知范围并让用户确认；正常 → 继续。
2. **定位 reference**：查上方「决策路由」表，读对应文件。
3. **编码遵循强约束**：先看 9 条核心强约束，再读 reference 给代码。
4. **遇异常先查排错**：`references/09-troubleshoot.md` + `references/08-antipattern.md`。
5. **输出前自检（7 项）**：
   - [ ] starter 坐标对应 SpringBoot 版本？（2.x / 3.x / 4.x）
   - [ ] 分页场景引了 `mybatis-plus-jsqlparser`？
   - [ ] `updateById` 需置 null？→ 改用 `UpdateWrapper.set()`
   - [ ] XML 中枚举字段每处 `#{}` 都声明了 `typeHandler=MybatisEnumTypeHandler`？
   - [ ] Wrapper 每次 `new` 新实例？
   - [ ] `@Transactional` 显式写了 `rollbackFor = Exception.class`？
   - [ ] 事务方法无自调用？

## 版本注意
- 依赖坐标 `com.baomidou:mybatis-plus-*`，本地 references 基于 3.5.17 整理，**3.5.x 全线适用**。
- `v3.5.9+` 插件拆分为可选依赖（分页需额外引 `mybatis-plus-jsqlparser`）。
- 若用户环境为 3.4.x 旧版，`PaginationInterceptor` 已被 `MybatisPlusInterceptor` 取代（3.4.0 起），相关章节已注明。
