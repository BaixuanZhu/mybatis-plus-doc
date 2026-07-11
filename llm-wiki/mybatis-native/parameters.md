# 参数映射

MyBatis 的参数映射是 SQL 执行的基础。理解 `#{}` 与 `${}` 的区别、多参数传递方式以及类型处理器的工作原理，是正确使用 MyBatis 的关键。

> 来源: https://mybatis.org/mybatis-3/zh_CN/sqlmap-xml.html

## #{} 与 ${}

### #{} 预编译参数

`#{}` 生成 PreparedStatement 的占位符 `?`，参数通过 `setXxx()` 方法传入，安全且支持类型转换：

```xml
<select id="selectById" resultType="User">
  SELECT * FROM user WHERE id = #{id}
</select>
```

实际执行的 SQL：`SELECT * FROM user WHERE id = ?`（通过 `ps.setLong(1, id)` 传值）

### ${} 字符串替换

`${}` 将参数直接作为字符串拼接到 SQL 中，不经过预编译：

```xml
<select id="selectByTable" resultType="User">
  SELECT * FROM ${tableName} WHERE id = #{id}
</select>
```

如果 `tableName = "user"`，实际 SQL：`SELECT * FROM user WHERE id = ?`

### 核心区别

| 对比项 | `#{}` | `${}` |
|---|---|---|
| 底层机制 | PreparedStatement 占位符 `?` | 字符串直接拼接 |
| SQL 注入 | 安全（预编译） | **有注入风险** |
| 类型转换 | 自动（typeHandler） | 无，原样拼接 |
| 性能 | 支持预编译缓存 | 每次生成新 SQL |
| 适用场景 | 参数值（WHERE 值、INSERT 值等） | 结构性替换（表名、列名、ORDER BY） |

> **原则**：能用 `#{}` 就不用 `${}`。`${}` 仅用于表名、列名、排序字段等结构性替换，且必须通过白名单校验。

### #{} 高级用法

`#{}` 支持指定 JDBC 类型和类型处理器：

```xml
<!-- 指定 jdbcType（处理 null 值时有用） -->
INSERT INTO user (name, age) VALUES (#{name}, #{age, jdbcType=INTEGER})

<!-- 指定 typeHandler -->
INSERT INTO user (config) VALUES (#{config, typeHandler=com.example.handler.JsonTypeHandler})

<!-- 指定 numericScale（小数精度） -->
INSERT INTO product (price) VALUES (#{price, numericScale=2})

<!-- 组合使用 -->
INSERT INTO user (data) VALUES (#{data, jdbcType=VARCHAR, typeHandler=com.example.handler.JsonTypeHandler})
```

`jdbcType` 在以下场景特别重要：

```xml
<!-- 当参数可能为 null 时，某些 JDBC 驱动需要明确类型 -->
<insert id="insertUser">
  INSERT INTO user (name, age, email)
  VALUES (#{name}, #{age, jdbcType=INTEGER}, #{email, jdbcType=VARCHAR})
</insert>
```

如果 `age` 为 `null`，不指定 `jdbcType` 可能导致 `SQLException`（某些驱动不支持将 null 设置到未知类型）。

### mode 属性（存储过程参数）

`#{}` 支持 `mode` 属性，用于存储过程的 IN/OUT/INOUT 参数：

```xml
<!-- OUT 参数：调用存储过程，返回 CURSOR 结果集 -->
#{department, mode=OUT, jdbcType=CURSOR, javaType=ResultSet, resultMap=departmentResultMap}

<!-- INOUT 参数 -->
#{id, mode=INOUT, jdbcType=INTEGER}
```

- `mode=IN` — 输入参数（默认）
- `mode=OUT` — 输出参数
- `mode=INOUT` — 输入输出参数
- 当 `mode=OUT` 或 `INOUT`，且 `jdbcType=CURSOR`（Oracle REFCURSOR）时，必须指定 `resultMap`
- `javaType` 在 `jdbcType=CURSOR` 时会自动设为 `ResultSet`，可省略

### STRUCT 类型参数

```xml
#{middleInitial, mode=OUT, jdbcType=STRUCT, jdbcTypeName=MY_TYPE, resultMap=departmentResultMap}
```

### numericScale 数值精度

```xml
#{height, javaType=double, jdbcType=NUMERIC, numericScale=2}
```

### 完整参数语法

```
#{property,javaType=...,jdbcType=...,mode=...,numericScale=...,typeHandler=...,jdbcTypeName=...,resultMap=...}
```

大多数情况下只需简单写 `#{propertyName}` 或 `#{propertyName,jdbcType=VARCHAR}`。

### 支持的 JDBC 类型

MyBatis 支持以下 JDBC 类型（`jdbcType` 取值）：

```
BIT       FLOAT     CHAR        TIMESTAMP   OTHER      UNDEFINED
TINYINT   REAL      VARCHAR     BINARY      BLOB       NVARCHAR
SMALLINT  DOUBLE    LONGVARCHAR VARBINARY   CLOB       NCHAR
INTEGER   NUMERIC   DATE        LONGVARBINARY BOOLEAN   NCLOB
BIGINT    DECIMAL   TIME        NULL        CURSOR     ARRAY
```

## 多参数传递

### 方式一：@Param 注解（推荐）

通过 `@Param` 为每个参数命名，XML 中直接引用：

```java
List<User> selectByNameAndAge(
    @Param("name") String name,
    @Param("age") Integer age
);
```

```xml
<select id="selectByNameAndAge" resultType="User">
  SELECT * FROM user
  WHERE name = #{name} AND age = #{age}
</select>
```

### 方式二：JavaBean 参数

传入一个对象，XML 中直接引用对象属性：

```java
UserQuery query = new UserQuery();
query.setName("张三");
query.setAge(25);
List<User> users = mapper.selectByCondition(query);
```

```xml
<select id="selectByCondition" parameterType="com.example.dto.UserQuery" resultType="User">
  SELECT * FROM user
  WHERE name = #{name} AND age = #{age}
</select>
```

### 方式三：Map 参数

传入 Map，XML 中用 key 引用：

```java
Map<String, Object> params = new HashMap<>();
params.put("name", "张三");
params.put("age", 25);
List<User> users = mapper.selectByCondition(params);
```

```xml
<select id="selectByCondition" resultType="User">
  SELECT * FROM user
  WHERE name = #{name} AND age = #{age}
</select>
```

### 方式四：混合参数

`@Param` + JavaBean / Map 组合：

```java
List<User> selectByCondition(
    @Param("query") UserQuery query,
    @Param("offset") int offset,
    @Param("limit") int limit
);
```

```xml
<select id="selectByCondition" resultType="User">
  SELECT * FROM user
  WHERE name = #{query.name}
  ORDER BY id DESC
  LIMIT #{offset}, #{limit}
</select>
```

### 参数对照表

| 传参方式 | XML 引用方式 | 说明 |
|---|---|---|
| 单参数 + `@Param("name")` | `#{name}` | 推荐 |
| 单参数无 `@Param`（基本类型） | `#{param1}` 或 `#{任意名}` | 不推荐，可读性差 |
| 单参数无 `@Param`（JavaBean） | `#{属性名}` | 可用 |
| 单参数无 `@Param`（Map） | `#{key}` | 可用 |
| 多参数 + `@Param` | `#{paramName}` | 推荐 |
| 多参数无 `@Param` | `#{param1}`, `#{param2}` | 不推荐 |

## parameterType

`parameterType` 可省略，MyBatis 会自动推断参数类型。显式指定时使用全限定类名或别名：

```xml
<!-- 显式指定 -->
<select id="selectByCondition" parameterType="com.example.dto.UserQuery" resultType="User">
  SELECT * FROM user WHERE name = #{name}
</select>

<!-- 省略（推荐，MyBatis 自动推断） -->
<select id="selectByCondition" resultType="User">
  SELECT * FROM user WHERE name = #{name}
</select>
```

### 常用类型别名

| 别名 | Java 类型 |
|---|---|
| `int` | `int` / `Integer` |
| `long` | `long` / `Long` |
| `string` | `String` |
| `boolean` | `boolean` / `Boolean` |
| `date` | `Date` |
| `map` | `Map` |
| `list` | `List` |
| `object` | `Object` |

## typeHandler 类型处理器

typeHandler 负责 Java 类型与 JDBC 类型之间的转换。MyBatis 内置了常用类型的处理器，也支持自定义。

### 内置 typeHandler 示例

当数据库存储 JSON 字符串，Java 侧需要对象时，可指定 typeHandler：

```xml
<!-- 在语句级别指定 -->
<resultMap id="userResultMap" type="User">
  <id property="id" column="id"/>
  <result property="config" column="config"
          typeHandler="com.example.handler.JsonTypeHandler"/>
</resultMap>
```

### 自定义 typeHandler

```java
@MappedTypes(MyEnum.class)
@MappedJdbcTypes(JdbcType.VARCHAR)
public class MyEnumTypeHandler extends BaseTypeHandler<MyEnum> {

  @Override
  public void setNonNullParameter(PreparedStatement ps, int i,
      MyEnum parameter, JdbcType jdbcType) throws SQLException {
    ps.setString(i, parameter.getCode());
  }

  @Override
  public MyEnum getNullableResult(ResultSet rs, String columnName)
      throws SQLException {
    String code = rs.getString(columnName);
    return MyEnum.fromCode(code);
  }

  @Override
  public MyEnum getNullableResult(ResultSet rs, int columnIndex)
      throws SQLException {
    String code = rs.getString(columnIndex);
    return MyEnum.fromCode(code);
  }

  @Override
  public MyEnum getNullableResult(CallableStatement cs, int columnIndex)
      throws SQLException {
    String code = cs.getString(columnIndex);
    return MyEnum.fromCode(code);
  }
}
```

注册方式：

```xml
<!-- mybatis-config.xml -->
<typeHandlers>
  <typeHandler handler="com.example.handler.MyEnumTypeHandler"/>
</typeHandlers>
```

```yaml
# Spring Boot
mybatis:
  type-handlers-package: com.example.handler
```

## MyBatis-Plus 中的参数处理

MyBatis-Plus 的 `BaseMapper` 方法已封装了参数传递，自定义 XML 中仍遵循原生规则：

```java
// BaseMapper 内置方法（无需 XML）
userMapper.selectById(1L);
userMapper.selectList(new LambdaQueryWrapper<User>().eq(User::getName, "张三"));

// 自定义方法（使用 @Param）
@Select("SELECT * FROM user WHERE name = #{name} AND age > #{age}")
List<User> findByNameAndAge(@Param("name") String name, @Param("age") int age);
```

当用注解 SQL + 动态 SQL 时，可用 `<script>` 标签：

```java
@Select("<script>" +
        "SELECT * FROM user" +
        "<where>" +
        "  <if test='name != null'>AND name = #{name}</if>" +
        "  <if test='age != null'>AND age = #{age}</if>" +
        "</where>" +
        "</script>")
List<User> selectByCondition(@Param("name") String name, @Param("age") Integer age);
```
