# 增删改查映射语句

MyBatis 通过 `<select>`、`<insert>`、`<update>`、`<delete>` 四个标签映射 SQL 语句，每个标签对应一种 CRUD 操作。

> 来源: https://mybatis.org/mybatis-3/zh_CN/sqlmap-xml.html

## select 查询

查询语句是 MyBatis 中最常用的元素之一。`<select>` 标签支持丰富的属性来控制查询行为。

### 基本用法

```xml
<select id="selectById" resultType="com.example.entity.User">
  SELECT id, name, age, email
  FROM user
  WHERE id = #{id}
</select>
```

### 全部属性

```xml
<select
  id="selectUserList"
  parameterType="com.example.dto.UserQuery"
  resultType="com.example.entity.User"
  resultMap="userResultMap"
  flushCache="false"
  useCache="true"
  timeout="10000"
  fetchSize="256"
  statementType="PREPARED"
  resultSetType="FORWARD_ONLY"
  databaseId="mysql"
  resultOrdered="false"
  resultSets="users,roles">
  <!-- SQL 语句 -->
</select>
```

### 属性说明

| 属性 | 说明 |
|---|---|
| `id` | 命名空间中的唯一标识符，用来引用这条语句 |
| `parameterType` | 传入参数的完全限定类名或别名（可选，MyBatis 可自动推断） |
| `resultType` | 返回值的类名或别名。注意：如果返回集合，应设置为集合包含的类型，而非集合本身 |
| `resultMap` | 对外部 resultMap 的命名引用，与 resultType 二选一 |
| `flushCache` | 设为 `true` 后，语句被调用时会导致本地缓存和二级缓存被清空，默认 `false` |
| `useCache` | 设为 `true` 后，语句结果将被二级缓存，默认 `true`（select 专属） |
| `timeout` | 抛出异常前等待数据库返回请求结果的秒数，默认未设置（依赖驱动） |
| `fetchSize` | 每次批量返回的行数，等于 JDBC 的 `Statement.setFetchSize()` |
| `statementType` | `STATEMENT`、`PREPARED`（默认）或 `CALLABLE`，对应 JDBC 的三种 Statement |
| `resultSetType` | `FORWARD_ONLY`、`SCROLL_SENSITIVE`、`SCROLL_INSENSITIVE` 或 `DEFAULT`，默认未设置（依赖驱动） |
| `databaseId` | 配置了 databaseIdProvider 后，MyBatis 会加载所有不带 databaseId 或匹配当前数据库的语句；如果带和不带的都有，则不带的会被忽略 |
| `resultOrdered` | 仅对嵌套结果 select 有效，设为 `true` 则假设结果集已排序，减少内存消耗，默认 `false` |
| `resultSets` | 多结果集时列出名称，逗号分隔 |
| `parameterMap` | **已废弃**，老式参数映射，请使用行内参数映射和 parameterType |
| `affectData` | 当编写返回数据的 INSERT/UPDATE/DELETE 语句时（如 PostgreSQL RETURNING），设为 `true` 以正确控制事务。默认 `false`（since 3.5.12） |

### resultType vs resultMap

- **resultType**：当数据库列名与 Java 属性名一致（或配置了驼峰映射）时使用，简单直接

```xml
<select id="selectAll" resultType="User">
  SELECT id, user_name as userName, create_time as createTime
  FROM user
</select>
```

- **resultMap**：当列名与属性名不一致，或需要复杂映射（关联、集合）时使用

```xml
<resultMap id="userResultMap" type="User">
  <id property="id" column="id"/>
  <result property="userName" column="user_name"/>
  <result property="createTime" column="create_time"/>
</resultMap>

<select id="selectAll" resultMap="userResultMap">
  SELECT id, user_name, create_time FROM user
</select>
```

## insert 新增

### 基本用法

```xml
<insert id="insertUser" parameterType="com.example.entity.User">
  INSERT INTO user (name, age, email)
  VALUES (#{name}, #{age}, #{email})
</insert>
```

### 主键回填

数据库自动生成主键时，通过 `useGeneratedKeys` 和 `keyProperty` 将主键回填到 Java 对象：

```xml
<insert id="insertUser" parameterType="com.example.entity.User"
        useGeneratedKeys="true" keyProperty="id" keyColumn="id">
  INSERT INTO user (name, age, email)
  VALUES (#{name}, #{age}, #{email})
</insert>
```

- `useGeneratedKeys`：设为 `true` 启用主键回填（要求 JDBC 驱动支持 `getGeneratedKeys`）
- `keyProperty`：主键回填到 Java 对象的哪个属性
- `keyColumn`：数据库中的主键列名（当主键列不是第一个列时需要指定）

执行后，传入的 `User` 对象的 `id` 字段会被自动设置：

```java
User user = new User();
user.setName("张三");
mapper.insertUser(user);
Long id = user.getId(); // 主键已回填
```

### selectKey 元素

当数据库不支持 `useGeneratedKeys`（如 Oracle 序列），使用 `<selectKey>` 获取主键：

```xml
<insert id="insertUser" parameterType="com.example.entity.User">
  <selectKey keyProperty="id" resultType="long" order="BEFORE">
    SELECT SEQ_USER.NEXTVAL FROM DUAL
  </selectKey>
  INSERT INTO user (id, name, age, email)
  VALUES (#{id}, #{name}, #{age}, #{email})
</insert>
```

`<selectKey>` 属性：

| 属性 | 说明 |
|---|---|
| `keyProperty` | selectKey 语句结果应被设置到的目标属性 |
| `keyColumn` | 目标列名（与 keyProperty 对应） |
| `resultType` | 结果类型，通常与 keyProperty 的类型一致 |
| `order` | `BEFORE`（先查主键再执行 INSERT）或 `AFTER`（先 INSERT 再查主键） |
| `statementType` | `STATEMENT`、`PREPARED`（默认）或 `CALLABLE` |

MySQL 下用 `AFTER` + `LAST_INSERT_ID()` 也可以：

```xml
<insert id="insertUser" parameterType="com.example.entity.User">
  <selectKey keyProperty="id" resultType="long" order="AFTER">
    SELECT LAST_INSERT_ID()
  </selectKey>
  INSERT INTO user (name, age, email)
  VALUES (#{name}, #{age}, #{email})
</insert>
```

## update 修改

```xml
<update id="updateUser" parameterType="com.example.entity.User">
  UPDATE user
  SET name = #{name}, age = #{age}, email = #{email}
  WHERE id = #{id}
</update>
```

### insert / update / delete 属性

| 属性 | 说明 |
|---|---|
| `id` | 命名空间中的唯一标识符 |
| `parameterType` | 传入参数的完全限定类名或别名（可选，可自动推断） |
| `parameterMap` | **已废弃**，老式参数映射 |
| `flushCache` | 设为 `true` 后，语句调用时清空本地缓存和二级缓存，默认 `true`（insert/update/delete） |
| `timeout` | 抛出异常前等待的秒数，默认未设置（依赖驱动） |
| `statementType` | `STATEMENT`、`PREPARED`（默认）或 `CALLABLE` |
| `useGeneratedKeys` | （仅 insert/update）使用 JDBC `getGeneratedKeys` 获取数据库生成的主键，默认 `false` |
| `keyProperty` | （仅 insert/update）主键回填的目标属性，多个用逗号分隔 |
| `keyColumn` | （仅 insert/update）生成键在表中的列名，主键列不是第一列时需指定 |
| `databaseId` | 配置了 databaseIdProvider 后，匹配当前数据库的语句优先加载 |

`<update>` 支持的属性与 `<insert>` 类似，也支持 `useGeneratedKeys` / `keyProperty`。

返回值是受影响的行数：

```java
int rows = mapper.updateUser(user); // 返回更新的行数
```

## delete 删除

```xml
<delete id="deleteById">
  DELETE FROM user WHERE id = #{id}
</delete>
```

同样返回受影响的行数。

## 批量操作

### 批量插入

利用 `foreach` 动态拼接 VALUES 子句：

```xml
<insert id="batchInsert" parameterType="java.util.List">
  INSERT INTO user (name, age, email)
  VALUES
  <foreach collection="list" item="user" separator=",">
    (#{user.name}, #{user.age}, #{user.email})
  </foreach>
</insert>
```

### 批量更新（case-when 方式）

```xml
<update id="batchUpdate" parameterType="java.util.List">
  UPDATE user
  SET name = CASE id
    <foreach collection="list" item="user">
      WHEN #{user.id} THEN #{user.name}
    </foreach>
  END
  WHERE id IN
  <foreach collection="list" item="user" open="(" separator="," close=")">
    #{user.id}
  </foreach>
</update>
```

> **注意**：批量操作拼接的 SQL 可能很长，需关注数据库的 SQL 长度限制（MySQL `max_allowed_packet`，Oracle 绑定变量数量限制等）。大量数据建议分批执行或使用 `BatchExecutor`。
