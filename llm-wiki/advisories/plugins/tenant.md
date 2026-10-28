## 安全修复（3.5.18）

> 本段为本站补充说明，官方文档尚未收录。

3.5.18 修复了原 `WHERE` 条件包含 `XOR` 时，租户条件未加括号而被短路的问题。建议升级至 **3.5.18.1 或更高版本**。

以原 SQL `SELECT * FROM user WHERE 1 XOR 0` 为例，修复前插件会拼接为：

```sql
SELECT * FROM user WHERE 1 XOR 0 AND tenant_id = ?
```

由于 `AND` 的优先级高于 `XOR`，实际按 `1 XOR (0 AND tenant_id = ?)` 计算，租户条件被短路，查询、更新或删除可能跨租户生效。

3.5.18 起，`XOR` 与 `OR` 等低优先级条件会先加括号，再追加租户条件：

```sql
SELECT * FROM user WHERE (1 XOR 0) AND tenant_id = ?
```

升级后建议检查自定义 SQL 中的 `XOR` 用法，并开启 SQL 日志确认拼接结果。
