---
name: mybatis-plus-dev
description: >-
  MyBatis-Plus（baomidou）Java ORM 增强框架开发助手。
  适用于：项目已使用 MyBatis-Plus 依赖（mybatis-plus-boot-starter /
  mybatis-plus-spring-boot3-starter）、BaseMapper/IService 继承体系、
  QueryWrapper/LambdaQueryWrapper 条件构造、分页插件（PaginationInnerInterceptor）、
  逻辑删除（@TableLogic）、自动填充（MetaObjectHandler）、乐观锁（@Version）、
  枚举映射（@EnumValue/IEnum）、@TableId/@TableField 字段映射、saveBatch 批量、
  MyBatis XML Mapper 编写、事务管理（@Transactional/事务失效排查），
  以及 null 不更新、分页失效、SQL 注入、字段映射错误等问题排查。
  不适用于：JPA/Hibernate、数据库表结构设计/DDL、纯 SQL 性能调优。
  纯 MyBatis 原生项目仅 XML Mapper 和事务章节部分适用。
agent_created: true
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

## 常见任务速查

| 任务 | 先读 | 同时警告 |
|------|------|---------|
| 集成 + 分页跑不通 | `01-start.md` | 需引 `mybatis-plus-jsqlparser`（v3.5.9+） |
| 单表 CRUD | `04-crud.md` | null 不更新；优先父类方法 |
| 条件查询 | `05-wrapper.md` | Wrapper 不可复用；`apply` 用 `{0}` 占位 |
| 联表查询 | `10-xml.md` | 别用 Wrapper 硬堆 join |
| 事务 / 不回滚 | `11-transaction.md` | rollbackFor 必须显式；自调用不走代理 |
| 逻辑删除 | `02-config.md` | 推荐 0+时间戳；唯一索引含 deleted |
| 枚举映射 | `03-entity.md` | @EnumValue + @JsonValue + XML typeHandler |
| 字段策略配置 | `02-config.md` §7 | 全局改 `ALWAYS` 会误清数据，用字段级覆盖 |

## 主动行为触发

| 代码模式 | 主动提醒 |
|---------|---------|
| `selectPage` / `page` | 确认引了 `jsqlparser` + 注册了 `PaginationInnerInterceptor` |
| `updateById` + null 字段 | null 不更新，需置空用 `UpdateWrapper.set()` |
| `@Transactional` 无 `rollbackFor` | 显式指定 `rollbackFor = Exception.class` |
| `apply()` 字符串拼接 | 改用 `{0}` 占位 + `SqlInjectionUtils.check()` |
| Wrapper 被多次复用 | 不可复用，每次 new |
| XML 枚举字段 | 每处都要 `typeHandler=MybatisEnumTypeHandler` |
| Wrapper 硬堆 join | 改写 XML |
| `saveBatch` 当高性能批量 | 默认非 BATCH executor |

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

| 需求场景 | 读取文件 |
|---|---|
| 依赖、starter 选择、最小配置、基础 CRUD 跑通 | `references/01-start.md` |
| 全局配置：分页插件、逻辑删除全局、乐观锁、自动填充、防全表、**字段策略(insertStrategy/updateStrategy/whereStrategy)**、DbConfig/Configuration 速查 | `references/02-config.md` |
| 实体映射：@TableId 策略、@TableField(字段策略/null/JSON)、**枚举映射(@EnumValue/IEnum/@JsonValue)**、@Version、@TableLogic | `references/03-entity.md` |
| BaseMapper vs IService、继承范式、优先父类方法、saveBatch、null 不更新 | `references/04-crud.md` |
| QueryWrapper vs LambdaQueryWrapper、条件构造、apply 防注入、空值语义 | `references/05-wrapper.md` |
| 分页：Page/IPage、自定义 count、联表分页 XML | `references/06-page.md` |
| 插件：逻辑删除/自动填充/乐观锁/多租户/动态表名/数据权限/防全表 | `references/07-plugin.md` |
| **Agent 常见错误与最佳实践（重点看）** | `references/08-antipattern.md` |
| SQL 日志开启、常见异常与分页失效排查 | `references/09-troubleshoot.md` |
| **MyBatis XML Mapper 编写（mapper-locations / resultMap / 动态 SQL / 联表 / 联表分页）** | `references/10-xml.md` |
| **事务管理（@Transactional / 事务失效 / saveBatch 事务 / 多数据源 / 编程式事务）** | `references/11-transaction.md` |

> **多场景交叉优先级**：当需求同时命中多个 references 时，按下表确定阅读顺序：
>
> | 组合场景 | 先读 | 再读 | 原因 |
> |---------|------|------|------|
> | 分页 + 联表 XML | `06-page.md` | `10-xml.md` | 先确认 IPage 分页机制，再写联表 SQL |
> | 枚举 + XML 自定义查询 | `03-entity.md` | `10-xml.md` | 先确认枚举映射策略，再在 XML 声明 typeHandler |
> | 逻辑删除 + 多租户 | `07-plugin.md` | `02-config.md` | 先确认插件顺序，再配全局逻辑删除 |
> | 批量插入 + 事务 | `04-crud.md` | `11-transaction.md` | 先确认 saveBatch 语义，再查事务配置与失效排查 |
> | 事务 + 多数据源 | `11-transaction.md` | `02-config.md` | 先确认事务边界与 @DS 陷阱，再查数据源配置 |
> | 事务回滚排查 | `11-transaction.md` | `08-antipattern.md` | 先确认事务失效场景，再对照 antipattern §18-§21 纠偏 |

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
