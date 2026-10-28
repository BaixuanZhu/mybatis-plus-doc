## 3.5.18 安全修复

> 本段为本站补充说明，官方文档尚未收录。

3.5.18 修复了两个可能导致越权读写的问题，建议升级至 **3.5.18.1 或更高版本**（3.5.18 的 `OR` 组合条件存在空指针问题，已在 3.5.18.1 修复）。

### 全表操作校验可被常量条件绕过（BlockAttackInnerInterceptor）

`BlockAttackInnerInterceptor` 此前只识别 `1=1`、`1<>2` 等简单常量比较，`WHERE 1`、`1 <= 1`、`2 > 1`、`'a' = 'a'`、`NOT 1 = 2`、`1 XOR 0` 等写法可绕过校验，执行全表更新或删除。3.5.18 起按数据库真值语义计算常量表达式，上述条件会被拦截。

### 租户/数据权限条件在 XOR 下被短路（TenantLineInnerInterceptor、DataPermissionInterceptor）

原 `WHERE` 条件为 `XOR` 表达式时，插件追加 `AND tenant_id = ?` 或权限条件时未加括号。由于 `AND` 优先级更高，条件被短路，可能读写租户或权限范围之外的数据。3.5.18 起 `OR`、`XOR` 等低优先级条件都会先加括号再追加。

详细说明与示例见本站文档 `plugins/block-attack.md`、`plugins/tenant.md`、`plugins/data-permission.md` 的“安全修复（3.5.18）”一节。
