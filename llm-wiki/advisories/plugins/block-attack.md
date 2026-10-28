## 安全修复（3.5.18）

> 本段为本站补充说明，官方文档尚未收录。

3.5.18 修复了常量条件绕过全表更新/删除校验的问题。建议升级至 **3.5.18.1 或更高版本**：3.5.18 的 `OR` 组合条件存在空指针问题，已在 3.5.18.1 修复。

修复前，以下条件都会被误判为“存在更新条件”，从而绕过插件：

```sql
UPDATE user SET name = 'x' WHERE 1;
UPDATE user SET name = 'x' WHERE 1 <= 1;
UPDATE user SET name = 'x' WHERE 2 > 1;
UPDATE user SET name = 'x' WHERE 'a' = 'a';
UPDATE user SET name = 'x' WHERE NOT 1 = 2;
UPDATE user SET name = 'x' WHERE 1 XOR 0;
```

3.5.18 起，插件按数据库真值语义计算常量表达式，覆盖 `=`、`!=`、`<>`、`>`、`>=`、`<`、`<=`、`NOT`、`XOR` 以及裸数值常量（如 `WHERE 1`），上述语句会被拦截并抛出 `MybatisPlusException`。

该插件是兜底防护，不能替代接口鉴权；仍应避免前端传入 SQL 片段，并对写操作做权限校验。
