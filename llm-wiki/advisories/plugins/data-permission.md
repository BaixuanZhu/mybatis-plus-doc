## 安全修复（3.5.18）

> 本段为本站补充说明，官方文档尚未收录。

3.5.18 修复了原 `WHERE` 条件包含 `XOR` 时，权限条件未加括号而被短路的问题。建议升级至 **3.5.18.1 或更高版本**。

以原 SQL `SELECT * FROM user WHERE 1 XOR 0` 为例，修复前插件会拼接为：

```sql
SELECT * FROM user WHERE 1 XOR 0 AND dept_id = ?
```

由于 `AND` 的优先级高于 `XOR`，实际按 `1 XOR (0 AND dept_id = ?)` 计算，权限条件被短路，可能读取或修改权限范围之外的数据。

3.5.18 起，`XOR` 与 `OR` 等低优先级条件会先加括号，再追加权限条件：

```sql
SELECT * FROM user WHERE (1 XOR 0) AND dept_id = ?
```

该修复位于 `DataPermissionInterceptor` 与 `TenantLineInnerInterceptor` 共用的条件拼接逻辑中。升级后建议检查自定义 SQL 中的 `XOR` 用法，并开启 SQL 日志确认拼接结果。
