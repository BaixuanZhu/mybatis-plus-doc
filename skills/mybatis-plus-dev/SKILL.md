---
name: mybatis-plus-dev
description: >-
  MyBatis-Plus（baomidou）Java ORM 增强框架的开发助手。当涉及 MyBatis-Plus / MP 的集成依赖、
  SpringBoot starter 选择、全局配置、分页插件（MybatisPlusInterceptor / PaginationInnerInterceptor）、
  BaseMapper / IService / ServiceImpl 继承、CRUD、QueryWrapper / LambdaQueryWrapper 条件构造、
  逻辑删除（@TableLogic / logic-delete-field）、自动填充（MetaObjectHandler / @TableField fill）、
  乐观锁（@Version / OptimisticLockerInnerInterceptor）、@TableId / @TableField 字段映射与策略、
  枚举映射（@EnumValue / IEnum / MybatisEnumTypeHandler / @JsonValue / default-enum-type-handler）、
  saveBatch 批量、selectList / selectPage 分页查询、多租户 / 动态表名 / 数据权限插件、
  MyBatis XML Mapper 编写（mapper-locations / resultMap / 动态 SQL / 联表查询 / 联表分页 XML / #{} vs ${}），
  以及事务管理（@Transactional / rollbackFor / 事务传播行为 / 事务失效场景 / saveBatch 与事务 / 多数据源事务 / 编程式事务 / 逻辑删除与事务）、
  以及排查 null 不更新、分页失效、SQL 注入、字段映射错误、Invalid bound statement、事务不回滚 等问题时使用。
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

## 核心强约束（Agent 必须遵守）

1. **继承范式**：`XxxMapper extends BaseMapper<T>`；Service 接口 `extends IService<T>`；实现类 `extends ServiceImpl<XxxMapper, T>`。
2. **优先用父类方法**：单表 CRUD 直接用 `BaseMapper` / `IService` 提供的方法（`selectList` / `selectById` / `save` / `updateById` / `page` …），**不要手撸冗余 CRUD 或重复 XML**。
3. **复杂 / 联表 SQL 进 XML 或 `@Select`**：不要用 Wrapper 硬堆多表 join；MP 擅长单表，复杂查询交给 XML。
4. **null 不更新**：`updateById(entity)` 中 entity 的 `null` 字段默认**不参与更新**；要显式置空用 `UpdateWrapper.set(...)` 或字段策略 `FieldStrategy.IGNORED`。
5. **逻辑删除**：推荐 0+时间戳方案（`Long` 字段，`logic-not-delete-value: 0`，`logic-delete-value: "UNIX_TIMESTAMP(now())"`）；用全局 `logic-delete-field` 或字段 `@TableLogic`；启用后查询自动过滤已删除行。
6. **分页插件最后添加**：`MybatisPlusInterceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL))` 必须放在插件链**最后**；多数据源务必指定 `DbType`。
7. **SQL 注入防护**：`Wrapper.apply` 用 `{0}` 占位符（PreparedStatement 参数化）+ 前置 `SqlInjectionUtils.check(...)` 校验，**禁止字符串拼接** SQL 片段。`check` 返回 boolean 并抛异常，不返回安全值。
8. **Wrapper 不可复用**：同一 `Wrapper` 实例多次使用会叠加条件；每次查询 `new` 一个新的。
9. **枚举映射**：枚举值字段标 `@EnumValue`（或实现 `IEnum`），JSON 序列化标 `@JsonValue`；XML 自定义查询中枚举字段的**每个位置**（resultMap、条件 `#{}`、插入 `#{}`）都要声明 `typeHandler=MybatisEnumTypeHandler`。

## 决策路由（全部本地，无在线 fetch）

| 需求场景 | 读取文件 |
|---|---|
| 依赖、starter 选择、最小配置、基础 CRUD 跑通 | `references/01-start.md` |
| 全局配置：分页插件、逻辑删除全局、乐观锁、自动填充、防全表、驼峰 | `references/02-config.md` |
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

1. 判断需求属于哪个场景，读取对应 `references/*.md`。
2. 给代码时严格遵循「核心强约束」，使用 3.5.x API。
3. 复杂 / 联表查询优先写 XML（见 `10-xml.md`），而非强行 Wrapper。
4. 涉及易错点（null 更新、分页、注入、字段映射、XML 绑定）时，主动参照 `08-antipattern.md` 给出正确写法并说明原因。
5. **输出代码前自检（7 项）**：
   - [ ] SpringBoot 版本对应的 starter 坐标正确？（2.x / 3.x / 4.x）
   - [ ] 分页场景是否引入了 `mybatis-plus-jsqlparser` 依赖？
   - [ ] `updateById` 场景是否需要置 null？需要则改用 `UpdateWrapper.set()`
   - [ ] 枚举字段在 XML 中每个 `#{}` 位置都声明了 `typeHandler=MybatisEnumTypeHandler`？
   - [ ] Wrapper 是否每次 `new` 新实例？（不可复用）
   - [ ] `@Transactional` 是否显式写了 `rollbackFor = Exception.class`？
   - [ ] 事务方法是否存在自调用？（同类内部方法调用不走代理，事务失效）

## 版本注意
- 依赖坐标 `com.baomidou:mybatis-plus-*`，本地 references 基于 3.5.17 整理，**3.5.x 全线适用**。
- `v3.5.9+` 插件拆分为可选依赖（分页需额外引 `mybatis-plus-jsqlparser`）。
- 若用户环境为 3.4.x 旧版，`PaginationInterceptor` 已被 `MybatisPlusInterceptor` 取代（3.4.0 起），相关章节已注明。
