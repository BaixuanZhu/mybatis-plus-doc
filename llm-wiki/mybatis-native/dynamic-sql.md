# 动态 SQL

动态 SQL 是 MyBatis 最强大的特性之一。它允许在 XML 中根据条件拼接 SQL，解决 JDBC 中手动拼字符串繁琐且易错的问题。MyBatis 动态 SQL 使用基于 OGNL 的表达式。

> 来源: https://mybatis.org/mybatis-3/zh_CN/dynamic-sql.html

## if 条件判断

`<if>` 是最基础的动态标签，当条件为 true 时拼接内容：

```xml
<select id="selectByCondition" resultType="User">
  SELECT * FROM user
  WHERE status = 'ACTIVE'
  <if test="name != null and name != ''">
    AND name LIKE CONCAT('%', #{name}, '%')
  </if>
  <if test="age != null">
    AND age = #{age}
  </if>
  <if test="email != null and email != ''">
    AND email = #{email}
  </if>
  ORDER BY id DESC
</select>
```

### OGNL 表达式

`<if test="...">` 中的条件使用 OGNL 语法：

| 表达式 | 含义 |
|---|---|
| `name != null` | name 不为 null |
| `name != ''` | name 不为空字符串 |
| `name != null and name != ''` | name 非空（and 也可用 &&） |
| `age > 18` | age 大于 18 |
| `type == 'admin'` | type 等于 admin（字符串用单引号） |
| `list != null and list.size() > 0` | list 非空且有元素 |
| `list != null and !list.isEmpty()` | 同上 |
| `role != null and role.name != null` | 嵌套属性判断 |

> **注意**：OGNL 中字符串比较用 `==` 而非 `equals()`，单引号包裹字符串字面量。

## choose / when / otherwise

`<choose>` 类似 Java 的 `switch-case`，按顺序匹配第一个满足条件的分支：

```xml
<select id="selectUser" resultType="User">
  SELECT * FROM user
  WHERE status = 'ACTIVE'
  <choose>
    <when test="id != null">
      AND id = #{id}
    </when>
    <when test="name != null and name != ''">
      AND name = #{name}
    </when>
    <otherwise>
      AND create_time > #{defaultDate}
    </otherwise>
  </choose>
</select>
```

- `<when>` — 条件分支，类似 `case`
- `<otherwise>` — 默认分支，类似 `default`，最多一个
- 至多匹配一个 `<when>`，都不匹配时走 `<otherwise>`

## trim / where / set

### where

`<where>` 解决 AND/OR 前缀问题。它会自动：

1. 去掉首条多余的 `AND` 或 `OR`
2. 当所有条件都不满足时不拼接 `WHERE`

```xml
<select id="selectByCondition" resultType="User">
  SELECT * FROM user
  <where>
    <if test="name != null and name != ''">
      AND name LIKE CONCAT('%', #{name}, '%')
    </if>
    <if test="age != null">
      AND age = #{age}
    </if>
  </where>
</select>
```

如果两个条件都为 null，生成 `SELECT * FROM user`（无 WHERE）。
如果只有 name 条件满足，生成 `SELECT * FROM user WHERE name LIKE ...`（自动去掉 AND）。

### set

`<set>` 用于 UPDATE 语句，自动去掉末尾多余的逗号：

```xml
<update id="updateUser">
  UPDATE user
  <set>
    <if test="name != null">name = #{name},</if>
    <if test="age != null">age = #{age},</if>
    <if test="email != null">email = #{email},</if>
  </set>
  WHERE id = #{id}
</update>
```

如果三个条件都满足，生成 `UPDATE user SET name = ?, age = ?, email = ? WHERE id = ?`（自动去掉最后一个逗号）。

### trim

`<trim>` 是 `<where>` 和 `<set>` 的通用版本，可自定义前缀和后缀的处理：

```xml
<!-- 等价于 <where> -->
<trim prefix="WHERE" prefixOverrides="AND |OR ">
  <if test="name != null">AND name = #{name}</if>
  <if test="age != null">AND age = #{age}</if>
</trim>

<!-- 等价于 <set> -->
<trim prefix="SET" suffixOverrides=",">
  <if test="name != null">name = #{name},</if>
  <if test="age != null">age = #{age},</if>
</trim>
```

`<trim>` 属性：

| 属性 | 说明 |
|---|---|
| `prefix` | 给整个内容添加前缀（仅当内容非空时） |
| `suffix` | 给整个内容添加后缀（仅当内容非空时） |
| `prefixOverrides` | 去掉内容开头匹配的字符串（`|` 分隔多个） |
| `suffixOverrides` | 去掉内容末尾匹配的字符串（`|` 分隔多个） |

## foreach 遍历

`<foreach>` 遍历集合，常用于 `IN` 查询和批量操作。

### IN 查询

```xml
<select id="selectByIds" resultType="User">
  SELECT * FROM user
  WHERE id IN
  <foreach collection="ids" item="id" open="(" separator="," close=")">
    #{id}
  </foreach>
</select>
```

生成：`SELECT * FROM user WHERE id IN (?, ?, ?)`

### 批量插入

```xml
<insert id="batchInsert">
  INSERT INTO user (name, age) VALUES
  <foreach collection="list" item="user" separator=",">
    (#{user.name}, #{user.age})
  </foreach>
</insert>
```

生成：`INSERT INTO user (name, age) VALUES (?, ?), (?, ?), (?, ?)`

### foreach 属性

| 属性 | 说明 |
|---|---|
| `collection` | 集合参数名。List 类型用 `list`，数组用 `array`，Map 用对应 key，也可用 `@Param` 指定 |
| `item` | 当前元素的变量名，在标签内通过 `#{item}` 引用 |
| `index` | 索引变量名。List 时是下标（0,1,2...），Map 时是 key |
| `open` | 整个循环开始处添加的字符串 |
| `close` | 整个循环结束处添加的字符串 |
| `separator` | 每次循环之间的分隔符 |
| `nullable` | 可为 `true` 或 `false`，指定集合是否允许为 null |

> **提示**：可以将任何可迭代对象（List、Set 等）、Map 对象或数组对象传给 `foreach`。使用可迭代对象或数组时，`index` 是当前序号，`item` 是本次迭代的元素。使用 Map 时，`index` 是键，`item` 是值。

### collection 名称规则

```java
// 1. 单个 List 参数，未加 @Param → collection="list"
List<User> selectByIds(List<Long> ids);

// 2. 单个数组参数，未加 @Param → collection="array"
List<User> selectByIds(Long[] ids);

// 3. 使用 @Param → collection="参数名"
List<User> selectByIds(@Param("ids") List<Long> ids);
// → collection="ids"

// 4. 多参数中包含集合
List<User> selectByCondition(@Param("name") String name, @Param("ids") List<Long> ids);
// → collection="ids"
```

## script 注解中使用动态 SQL

在带注解的 Mapper 接口中使用动态 SQL，用 `<script>` 元素包裹：

```java
@Update("<script>" +
    "UPDATE user" +
    "  <set>" +
    "    <if test='name != null'>name=#{name},</if>" +
    "    <if test='age != null'>age=#{age},</if>" +
    "  </set>" +
    "WHERE id=#{id}" +
    "</script>")
void updateUser(User user);
```

## bind 绑定变量

`<bind>` 在 OGNL 上下文中创建变量并绑定值，可在后续 SQL 中引用：

```xml
<select id="selectByName" resultType="User">
  <bind name="pattern" value="'%' + name + '%'" />
  SELECT * FROM user
  WHERE name LIKE #{pattern}
</select>
```

常用于跨数据库拼接（如 Oracle 的 `||` vs MySQL 的 `CONCAT`），将拼接逻辑统一到 OGNL：

```xml
<select id="searchUser" resultType="User">
  <bind name="keyword" value="'%' + keyword + '%'" />
  SELECT * FROM user
  WHERE name LIKE #{keyword}
  <if test="email != null">
    OR email LIKE #{keyword}
  </if>
</select>
```

## 多数据库支持 databaseId

结合 `databaseIdProvider`，动态 SQL 中可以根据数据库类型编写不同分支：

```xml
<select id="selectCurrentTime" resultType="string">
  <if test="_databaseId == 'mysql'">
    SELECT NOW()
  </if>
  <if test="_databaseId == 'oracle'">
    SELECT SYSDATE FROM DUAL
  </if>
</select>
```

`_databaseId` 是 MyBatis 内置变量，无需手动传入。

## 内置参数

动态 SQL 中可使用的内置参数：

| 参数 | 说明 |
|---|---|
| `_parameter` | 当前方法的参数。单参数时为该参数本身，多参数时为封装的 ParamMap |
| `_databaseId` | 当前数据库标识（需配置 databaseIdProvider） |

## 实践建议

1. **优先用 where/set**：比手写 trim 更简洁，且自动处理边界情况
2. **foreach 防注入**：`#{item}` 是预编译参数，安全；`${item}` 是字符串拼接，有注入风险
3. **批量操作分批**：`foreach` 拼接的 SQL 不宜过长，建议每批 500-1000 条
4. **复杂条件提取为 sql 片段**：重复的 WHERE 条件可抽取为 `<sql>` 片段复用
