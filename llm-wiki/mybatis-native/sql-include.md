# SQL 片段复用

`<sql>` 和 `<include>` 是 MyBatis 提供的 SQL 复用机制。`<sql>` 定义可重用的 SQL 片段，`<include>` 在任意位置引用它，减少重复代码。

> 来源: https://mybatis.org/mybatis-3/zh_CN/sqlmap-xml.html

## 定义与引用

### 基本用法

```xml
<!-- 定义 SQL 片段 -->
<sql id="userColumns">
  id, name, age, email, create_time
</sql>

<!-- 引用 SQL 片段 -->
<select id="selectById" resultType="User">
  SELECT <include refid="userColumns"/>
  FROM user
  WHERE id = #{id}
</select>

<select id="selectAll" resultType="User">
  SELECT <include refid="userColumns"/>
  FROM user
  ORDER BY id DESC
</select>
```

生成结果：`SELECT id, name, age, email, create_time FROM user WHERE id = ?`

### refid 跨命名空间引用

`refid` 可以引用其他 Mapper 命名空间中的 SQL 片段，使用全限定名：

```xml
<!-- 在 com.example.mapper.CommonMapper 中定义 -->
<sql id="auditColumns">
  create_by, create_time, update_by, update_time
</sql>

<!-- 在 UserMapper 中引用 -->
<sql id="userColumns">
  id, name, age, <include refid="com.example.mapper.CommonMapper.auditColumns"/>
</sql>
```

## property 属性传参

`<include>` 支持通过 `<property>` 子标签向 SQL 片段传递参数，在片段内用 `${prop}` 引用：

```xml
<!-- 定义带占位符的片段 -->
<sql id="tablePrefix">
  ${prefix}.user
</sql>

<!-- 传入 prefix 值 -->
<select id="selectUsers" resultType="User">
  SELECT * FROM <include refid="tablePrefix">
    <property name="prefix" value="t"/>
  </include>
  WHERE status = 'ACTIVE'
</select>
```

生成结果：`SELECT * FROM t.user WHERE status = 'ACTIVE'`

> **注意**：`${}` 是字符串替换（非预编译），传入的值会直接拼接到 SQL 中。仅用于表名、列名等结构性替换，不可用于用户输入值，否则有 SQL 注入风险。

### 实际场景：动态表名 + 列名

```xml
<sql id="columnList">
  ${alias}.id, ${alias}.name, ${alias}.age
</sql>

<select id="selectWithAlias" resultType="User">
  SELECT
  <include refid="columnList">
    <property name="alias" value="u"/>
  </include>
  FROM user u
  WHERE u.id = #{id}
</select>
```

## 常见复用模式

### 1. 公共字段列表

```xml
<sql id="baseColumns">
  id, name, age, email, phone, status, create_time, update_time
</sql>
```

### 2. 公共 WHERE 条件

```xml
<sql id="activeCondition">
  WHERE status = 'ACTIVE'
  AND deleted = 0
</sql>

<select id="selectActive" resultType="User">
  SELECT <include refid="baseColumns"/>
  FROM user
  <include refid="activeCondition"/>
  ORDER BY id DESC
</select>
```

### 3. 公共 SET 子句

```xml
<sql id="updateSet">
  <set>
    <if test="name != null">name = #{name},</if>
    <if test="age != null">age = #{age},</if>
    <if test="email != null">email = #{email},</if>
  </set>
</sql>

<update id="updateUser">
  UPDATE user
  <include refid="updateSet"/>
  WHERE id = #{id}
</update>
```

### 4. 动态排序

```xml
<sql id="orderBy">
  ORDER BY ${column} ${direction}
</sql>

<select id="selectWithOrder" resultType="User">
  SELECT <include refid="baseColumns"/>
  FROM user
  <include refid="orderBy">
    <property name="column" value="create_time"/>
    <property name="direction" value="DESC"/>
  </include>
</select>
```

> **注意**：`${column}` 和 `${direction}` 是字符串替换，仅接受程序内部可控的值（如枚举、白名单），不可直接传入用户输入。

## 嵌套引用

SQL 片段支持嵌套引用（A 引用 B，B 引用 C）：

```xml
<sql id="idColumn">id</sql>

<sql id="baseColumns">
  <include refid="idColumn"/>, name, age
</sql>

<sql id="fullColumns">
  <include refid="baseColumns"/>, email, phone, create_time
</sql>
```

MyBatis 会递归展开所有引用。

## 与 MyBatis-Plus 的关系

MyBatis-Plus 提供了 `BaseMapper` 自动生成基础 CRUD，但当需要自定义 XML 时，`<sql>` 片段仍然有效：

```xml
<!-- UserMapper.xml，与 BaseMapper 共存 -->
<mapper namespace="com.example.mapper.UserMapper">

  <sql id="userVoColumns">
    u.id, u.name, u.age, d.name AS dept_name
  </sql>

  <!-- 自定义查询，补充 BaseMapper 不支持的功能 -->
  <select id="selectUserVoList" resultType="com.example.vo.UserVO">
    SELECT <include refid="userVoColumns"/>
    FROM user u
    LEFT JOIN department d ON u.dept_id = d.id
    <where>
      <if test="name != null and name != ''">
        AND u.name LIKE CONCAT('%', #{name}, '%')
      </if>
    </where>
  </select>

</mapper>
```

## 最佳实践

1. **按粒度拆分**：列名列表、公共条件、排序规则分别抽取，组合使用
2. **避免过度抽取**：只用一次的片段不抽取，可读性优先
3. **命名规范**：用 `xxxColumns`、`xxxCondition`、`xxxSet` 等后缀语义化命名
4. **`${}` 安全**：property 传参只用于表名/列名等结构替换，值类型参数用 `#{}`
