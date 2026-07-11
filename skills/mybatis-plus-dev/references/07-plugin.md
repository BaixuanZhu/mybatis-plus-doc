# 插件与进阶能力

> 本 skill 完全本地化，以下全部为内置知识，无在线 fetch。基础三件套（逻辑删除 / 自动填充 / 乐观锁）配置见 `02-config.md` 与 `03-entity.md`，此处补充进阶插件。

## 1. 逻辑删除 / 自动填充 / 乐观锁

- 逻辑删除：全局 `logic-delete-field` 或 `@TableLogic`（`02-config.md` §2 / `03-entity.md` §6）
- 自动填充：`MetaObjectHandler` + `@TableField(fill=...)`（`02-config.md` §4 / `03-entity.md` §3）
- 乐观锁：`@Version` + `OptimisticLockerInnerInterceptor`（`02-config.md` §3 / `03-entity.md` §5）

## 2. 多租户 TenantLineInnerInterceptor

```java
interceptor.addInnerInterceptor(new TenantLineInnerInterceptor(
    new TenantLineHandler() {
        @Override public Expression getTenantId() { return new LongValue(1L); }
        @Override public String getTenantIdColumn() { return "tenant_id"; }
        @Override public boolean ignoreTable(String tableName) { return "sys_config".equals(tableName); }
    }));
```
- 在插件链中**先于分页**添加。
- 个别 Mapper 方法用 `@InterceptorIgnore(tenantLine = "true")` 跳过。
- 注意与逻辑删除字段共存时的 SQL 改写顺序。

## 3. 动态表名 DynamicTableNameInnerInterceptor

```java
interceptor.addInnerInterceptor(new DynamicTableNameInnerInterceptor(
    tableName -> "user_" + LocalDate.now().getMonthValue()));  // 按月分表
```
- 用于分表路由；与多租户同用时要关注插件顺序（不做 SQL 改写的靠后）。

## 4. 数据权限 DataPermissionInterceptor

```java
interceptor.addInnerInterceptor(new DataPermissionInterceptor(
    new MultiDataPermissionHandler() { /* 按用户拼接 dept_id IN (...) */ }));
```
- 在 SQL 中自动追加数据范围条件，实现行级权限。

## 5. 防全表 / 非法 SQL

- `BlockAttackInnerInterceptor`：拦截无 WHERE 的 update/delete（见 `02-config.md` §5）。
- `IllegalSQLInnerInterceptor`：检查全表扫描、索引缺失等风险 SQL。
- 二者均在插件链中按需在分页之前添加。

> 插件顺序建议：多租户 / 动态表名 → 乐观锁 → 防全表 / 非法 SQL → **分页（最后）**。分页放最后是因为多租户 / 动态表名会改写 SQL，若在分页之后添加则 COUNT 语句不会被改写，导致总数不准。简单场景（仅乐观锁 + 防全表 + 分页）只需保证分页最后即可（见 `02-config.md` §1）。
