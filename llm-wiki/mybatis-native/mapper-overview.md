# Mapper XML 概述

MyBatis 的真正强大之处在于它的映射语句，这也是它的魔力所在。由于它的异常强大，映射器的 XML 文件就显得相对简单。如果拿它跟具有相同功能的 JDBC 代码进行对比，你会立即发现省掉了将近 95% 的代码。MyBatis 为聚焦于 SQL 而构建，以尽可能地为你减少麻烦。

> 来源: https://mybatis.org/mybatis-3/zh_CN/sqlmap-xml.html

## SQL 映射文件

SQL 映射文件只有很少的几个顶级元素（按照应被定义的顺序列出）：

- `cache` — 该命名空间的缓存配置
- `cache-ref` — 引用其他命名空间缓存配置
- `resultMap` — 最复杂、最强大的元素，用来描述如何从数据库结果集中加载对象
- `sql` — 可被其他语句引用的可重用语句块
- `insert` — 映射插入语句
- `update` — 映射更新语句
- `delete` — 映射删除语句
- `select` — 映射查询语句

## 文件结构

一个完整的 Mapper XML 文件骨架如下：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper
  PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
  "http://mybatis.org/dtd/mybatis-3-mapper.dtd">

<mapper namespace="com.example.mapper.UserMapper">

  <!-- 缓存配置 -->
  <cache/>

  <!-- SQL 片段 -->
  <sql id="userColumns">id, name, age, email</sql>

  <!-- 查询 -->
  <select id="selectUser" resultType="com.example.entity.User">
    SELECT <include refid="userColumns"/>
    FROM user
    WHERE id = #{id}
  </select>

  <!-- 新增 -->
  <insert id="insertUser" parameterType="com.example.entity.User">
    INSERT INTO user (name, age, email)
    VALUES (#{name}, #{age}, #{email})
  </insert>

  <!-- 修改 -->
  <update id="updateUser" parameterType="com.example.entity.User">
    UPDATE user SET name = #{name} WHERE id = #{id}
  </update>

  <!-- 删除 -->
  <delete id="deleteUser">
    DELETE FROM user WHERE id = #{id}
  </delete>

</mapper>
```

## namespace

`namespace` 是 Mapper XML 的命名空间，有两个作用：

1. **隔离语句**：不同 Mapper 中的同名语句不会冲突
2. **绑定接口**：当 `namespace` 与 Java 接口全限定名一致时，MyBatis 会自动将语句绑定到接口方法上

```java
// 接口全限定名 = namespace
package com.example.mapper;

public interface UserMapper {
  User selectUser(Long id);    // 方法名 = select 标签的 id
  int insertUser(User user);
  int updateUser(User user);
  int deleteUser(Long id);
}
```

绑定后，调用接口方法即可执行对应 SQL：

```java
UserMapper mapper = sqlSession.getMapper(UserMapper.class);
User user = mapper.selectUser(1L);
```

## DOCTYPE 声明

每个 Mapper XML 文件必须包含 DOCTYPE 声明，MyBatis 通过它验证 XML 结构的正确性：

```xml
<!DOCTYPE mapper
  PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
  "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
```

## 在配置中注册 Mapper

Mapper XML 文件需要被 MyBatis 配置加载。`mybatis-config.xml` 中的 `<mappers>` 标签用于注册：

```xml
<mappers>
  <!-- 方式一：按资源路径注册 -->
  <mapper resource="com/example/mapper/UserMapper.xml"/>

  <!-- 方式二：按 URL 注册 -->
  <mapper url="file:///var/mappers/UserMapper.xml"/>

  <!-- 方式三：按接口类注册（要求 XML 与接口同名且在同一包下） -->
  <mapper class="com.example.mapper.UserMapper"/>

  <!-- 方式四：批量注册包下所有接口 -->
  <package name="com.example.mapper"/>
</mappers>
```

在 Spring Boot 中，通常通过配置自动扫描：

```yaml
mybatis:
  mapper-locations: classpath*:mapper/**/*.xml
```

```properties
mybatis.mapper-locations=classpath*:mapper/**/*.xml
```

## 注意事项

- **标签顺序**：`cache` > `cache-ref` > `resultMap` > `sql` > `insert/update/delete/select`，DTD 强制了这个顺序，颠倒会报错
- **namespace 唯一**：每个 Mapper 的 namespace 必须唯一，否则绑定冲突
- **id 唯一**：同一 namespace 下每个语句的 id 必须唯一
- **接口绑定**：使用接口绑定时，方法名必须与 XML 中的 id 完全一致，参数类型也要匹配
