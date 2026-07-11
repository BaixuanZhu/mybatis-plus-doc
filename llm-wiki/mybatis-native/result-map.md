# 结果映射 resultMap

`resultMap` 是 MyBatis 中最复杂、最强大的元素。它将数据库查询结果映射到 Java 对象，支持基本字段映射、构造器映射、一对一关联、一对多集合以及鉴别器。

> 来源: https://mybatis.org/mybatis-3/zh_CN/sqlmap-xml.html

## 基本字段映射

当数据库列名与 Java 属性名不一致时，通过 `resultMap` 建立映射关系：

```xml
<resultMap id="userResultMap" type="com.example.entity.User">
  <id property="id" column="id"/>
  <result property="userName" column="user_name"/>
  <result property="createTime" column="create_time"/>
  <result property="lastLogin" column="last_login"/>
</resultMap>

<select id="selectUser" resultMap="userResultMap">
  SELECT id, user_name, create_time, last_login
  FROM user
  WHERE id = #{id}
</select>
```

### id 与 result 的区别

- `<id>` — 标记主键字段，MyBatis 用它判断对象是否相同（一级/二级缓存、嵌套结果的合并都依赖它）
- `<result>` — 普通字段映射

两者属性相同：

| 属性 | 说明 |
|---|---|
| `property` | 映射到 Java 对象的属性名 |
| `column` | 数据库列名（或列别名） |
| `javaType` | Java 类型（通常可自动推断） |
| `jdbcType` | JDBC 类型，用于处理 null 值 |
| `typeHandler` | 自定义类型处理器 |

## 构造器映射

当 Java 类没有无参构造器，或希望通过构造器注入字段时，使用 `<constructor>`：

```java
public class User {
  public User(Long id, String name) {
    // 构造器
  }
}
```

```xml
<resultMap id="userResultMap" type="com.example.entity.User">
  <constructor>
    <idArg column="id" javaType="long"/>
    <arg column="name" javaType="string"/>
  </constructor>
  <result property="age" column="age"/>
</resultMap>
```

- `<idArg>` — 主键参数
- `<arg>` — 普通参数

constructor 子元素属性：

| 属性 | 说明 |
|---|---|
| `column` | 数据库列名或别名 |
| `javaType` | Java 类全限定名或别名 |
| `jdbcType` | JDBC 类型，仅在可能为空的列上指定 |
| `typeHandler` | 覆盖默认类型处理器 |
| `select` | 用于加载复杂类型属性的映射语句 ID |
| `resultMap` | 结果映射 ID，将嵌套结果集映射到对象树 |
| `name` | 构造方法形参名（since 3.4.3，通过指定参数名可以以任意顺序写入 arg 元素） |

> 如果存在名称和类型相同的可写属性，可以省略 `javaType`。

## resultMap 继承（extends）

`resultMap` 支持 `extends` 属性继承另一个 resultMap，自动继承其所有映射：

```xml
<resultMap id="baseUserMap" type="User">
  <id property="id" column="id"/>
  <result property="name" column="user_name"/>
</resultMap>

<!-- 继承 baseUserMap，扩展额外字段 -->
<resultMap id="fullUserMap" type="User" extends="baseUserMap">
  <result property="email" column="email"/>
  <result property="phone" column="phone"/>
</resultMap>
```

`fullUserMap` 会同时映射 `id`、`user_name`、`email`、`phone`。

## 一对一关联 association

`<association>` 处理 `has-a` 关系，如用户关联部门。

### 嵌套结果（JOIN 查询，推荐）

一次 JOIN 查询，通过 resultMap 嵌套映射：

```xml
<resultMap id="userWithDeptResultMap" type="com.example.entity.User">
  <id property="id" column="user_id"/>
  <result property="name" column="user_name"/>

  <association property="department" javaType="com.example.entity.Department">
    <id property="id" column="dept_id"/>
    <result property="name" column="dept_name"/>
  </association>
</resultMap>

<select id="selectUserWithDept" resultMap="userWithDeptResultMap">
  SELECT
    u.id AS user_id, u.name AS user_name,
    d.id AS dept_id, d.name AS dept_name
  FROM user u
  LEFT JOIN department d ON u.dept_id = d.id
  WHERE u.id = #{id}
</select>
```

### 嵌套查询（N+1，慎用）

分开查询，先查用户，再按需查关联：

```xml
<resultMap id="userWithDeptResultMap" type="com.example.entity.User">
  <id property="id" column="id"/>
  <result property="name" column="name"/>
  <association property="department" column="dept_id"
               select="com.example.mapper.DepartmentMapper.selectById"/>
</resultMap>

<select id="selectUserWithDept" resultMap="userWithDeptResultMap">
  SELECT id, name, dept_id FROM user WHERE id = #{id}
</select>
```

> **N+1 问题**：嵌套查询会导致查询 N 个用户时产生 N+1 次 SQL（1 次查用户 + N 次查关联），可通过 `lazyLoadingEnabled` 延迟加载或 `fetchType="lazy"` 缓解，但 JOIN 嵌套结果始终是更优方案。

### association 属性

**通用属性：**

| 属性 | 说明 |
|---|---|
| `property` | 映射到 Java 对象的属性名 |
| `javaType` | 关联对象的 Java 类型 |
| `jdbcType` | JDBC 类型 |
| `typeHandler` | 覆盖默认的类型处理器 |

**嵌套 Select 查询属性：**

| 属性 | 说明 |
|---|---|
| `column` | 传递给嵌套查询的列名。多列用 `column="{prop1=col1,prop2=col2}"` 语法 |
| `select` | 嵌套查询的语句 ID |
| `fetchType` | `lazy`（延迟加载）或 `eager`（立即加载），覆盖全局配置 |

**嵌套结果映射属性：**

| 属性 | 说明 |
|---|---|
| `resultMap` | 引用已定义的 resultMap，避免重复定义 |
| `columnPrefix` | 列名前缀，用于复用 resultMap（多表 JOIN 列名重叠时） |
| `notNullColumn` | 列不为空才创建关联对象，多个列用逗号分隔 |
| `autoMapping` | 覆盖全局 autoMappingBehavior，不能搭配 select 或 resultMap 使用 |

**多结果集属性：**

| 属性 | 说明 |
|---|---|
| `column` | 结果集中用于与 foreignColumn 匹配的列名 |
| `foreignColumn` | 外键对应的列名，与父类型中 column 匹配 |
| `resultSet` | 用于加载复杂类型的结果集名称 |

## 一对多集合 collection

`<collection>` 处理 `has-many` 关系，如用户拥有多个角色。

### 嵌套结果（JOIN 查询）

```xml
<resultMap id="userWithRolesResultMap" type="com.example.entity.User">
  <id property="id" column="user_id"/>
  <result property="name" column="user_name"/>

  <collection property="roles" ofType="com.example.entity.Role">
    <id property="id" column="role_id"/>
    <result property="name" column="role_name"/>
  </collection>
</resultMap>

<select id="selectUserWithRoles" resultMap="userWithRolesResultMap">
  SELECT
    u.id AS user_id, u.name AS user_name,
    r.id AS role_id, r.name AS role_name
  FROM user u
  LEFT JOIN user_role ur ON u.id = ur.user_id
  LEFT JOIN role r ON ur.role_id = r.id
  WHERE u.id = #{id}
</select>
```

注意 `<collection>` 用 `ofType` 而非 `javaType` 指定集合元素类型。

### 嵌套查询

```xml
<resultMap id="userWithRolesResultMap" type="com.example.entity.User">
  <id property="id" column="id"/>
  <result property="name" column="name"/>
  <collection property="roles" column="id"
              select="com.example.mapper.RoleMapper.selectByUserId"/>
</resultMap>
```

## columnPrefix 复用 resultMap

当多张表有相同列名结构时，通过 `columnPrefix` 复用同一个 resultMap：

```xml
<!-- 基础 resultMap -->
<resultMap id="addressResultMap" type="com.example.entity.Address">
  <id property="id" column="id"/>
  <result property="province" column="province"/>
  <result property="city" column="city"/>
</resultMap>

<!-- 复用：home_address_ 前缀 -->
<resultMap id="userWithAddressResultMap" type="com.example.entity.User">
  <id property="id" column="id"/>
  <result property="name" column="name"/>
  <association property="homeAddress" resultMap="addressResultMap"
               columnPrefix="home_"/>
  <association property="workAddress" resultMap="addressResultMap"
               columnPrefix="work_"/>
</resultMap>

<select id="selectUserWithAddress" resultMap="userWithAddressResultMap">
  SELECT
    u.id, u.name,
    ha.id AS home_id, ha.province AS home_province, ha.city AS home_city,
    wa.id AS work_id, wa.province AS work_province, wa.city AS work_city
  FROM user u
  LEFT JOIN address ha ON u.home_addr_id = ha.id
  LEFT JOIN address wa ON u.work_addr_id = wa.id
  WHERE u.id = #{id}
</select>
```

## 鉴别器 discriminator

`<discriminator>` 根据某列的值选择不同的 resultMap，类似 Java 中的 `switch`：

```xml
<resultMap id="vehicleResult" type="com.example.entity.Vehicle">
  <id property="id" column="id"/>
  <result property="vin" column="vin"/>
  <result property="type" column="type"/>
  <discriminator javaType="string" column="type">
    <case value="car" resultType="com.example.entity.Car">
      <result property="doorCount" column="door_count"/>
    </case>
    <case value="truck" resultType="com.example.entity.Truck">
      <result property="payload" column="payload"/>
    </case>
  </discriminator>
</resultMap>
```

当 `type` 列值为 `car` 时，使用 `Car` 类型并映射 `doorCount`；为 `truck` 时使用 `Truck` 类型。`case` 还可以通过 `resultMap` 属性引用外部 resultMap 实现更复杂的嵌套。

## 多结果集

某些存储过程返回多个结果集，可通过 `resultSets` 属性分别映射：

```xml
<select id="selectUserAndRoles" resultSets="users,roles"
        resultMap="userResultMap" statementType="CALLABLE">
  {call get_user_and_roles(#{id})}
</select>

<resultMap id="userResultMap" type="com.example.entity.User">
  <id property="id" column="id"/>
  <result property="name" column="name"/>
  <collection property="roles" ofType="com.example.entity.Role"
              resultSet="roles" column="id" foreignColumn="user_id"/>
</resultMap>
```

## 自动映射

MyBatis 支持自动将同名列映射到同名属性（开启驼峰转换后 `user_name` → `userName`）。`resultMap` 可通过 `autoMapping` 属性控制：

```xml
<!-- 全自动映射，只补充需要手动映射的字段 -->
<resultMap id="userResultMap" type="User" autoMapping="true">
  <association property="department" resultMap="deptResultMap"/>
</resultMap>

<!-- 完全禁用自动映射，所有字段必须显式声明 -->
<resultMap id="userResultMap" type="User" autoMapping="false">
  <id property="id" column="id"/>
  <result property="name" column="user_name"/>
</resultMap>
```

全局配置：

```xml
<settings>
  <!-- NONE: 禁用自动映射；PARTIAL（默认）: 自动映射，嵌套结果需手动；FULL: 全部自动 -->
  <setting name="autoMappingBehavior" value="PARTIAL"/>
  <!-- 开启驼峰命名转换 -->
  <setting name="mapUnderscoreToCamelCase" value="true"/>
</settings>
```
