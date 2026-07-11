# 缓存机制

MyBatis 内置了两级缓存机制：一级缓存（SqlSession 级别）和二级缓存（Mapper 级别）。合理使用缓存可以显著减少数据库压力，但需要理解其工作原理以避免脏读。

> 来源: https://mybatis.org/mybatis-3/zh_CN/sqlmap-xml.html

## 两级缓存架构

```
┌─────────────────────────────────────┐
│           SqlSession A              │
│  ┌─────────────────────────────┐    │
│  │     一级缓存（Local Cache）  │    │  ← SqlSession 级别，默认开启
│  │  ┌──────┐  ┌──────┐         │    │
│  │  │Entry1│  │Entry2│  ...    │    │
│  │  └──────┘  └──────┘         │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
          │  一级缓存未命中
          ▼
┌─────────────────────────────────────┐
│         二级缓存（Mapper 级别）       │  ← 跨 SqlSession 共享，需显式开启
│  ┌─────────────────────────────┐    │
│  │  namespace: UserMapper       │    │
│  │  ┌──────┐  ┌──────┐         │    │
│  │  │Entry1│  │Entry2│  ...    │    │
│  │  └──────┘  └──────┘         │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  namespace: OrderMapper      │    │
│  │  ┌──────┐  ┌──────┐         │    │
│  │  │Entry1│  │Entry2│  ...    │    │
│  │  └──────┘  └──────┘         │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
          │  二级缓存未命中
          ▼
┌─────────────────────────────────────┐
│            数据库                     │
└─────────────────────────────────────┘
```

查询顺序：二级缓存 → 一级缓存 → 数据库。

## 一级缓存

一级缓存是 SqlSession 级别的缓存，**默认开启**，无法关闭（可将 `localCacheScope` 设为 `STATEMENT` 禁用）。

### 工作机制

同一个 SqlSession 中，相同的查询（相同 SQL + 相同参数）只会执行一次，后续命中缓存：

```java
SqlSession session = sqlSessionFactory.openSession();
UserMapper mapper = session.getMapper(UserMapper.class);

User user1 = mapper.selectById(1L);  // 执行 SQL，结果存入一级缓存
User user2 = mapper.selectById(1L);  // 命中缓存，不执行 SQL

System.out.println(user1 == user2);  // true，返回同一个对象
```

### 缓存失效条件

以下情况会导致一级缓存被清空：

1. **SqlSession 关闭**：`session.close()` 后缓存消失
2. **执行增删改**：任何 `insert`/`update`/`delete` 操作会清空整个 SqlSession 的一级缓存
3. **手动清空**：`session.clearCache()`
4. **`flushCache="true"`**：查询语句设置了 `flushCache="true"`，每次执行前清空缓存

```xml
<!-- 每次查询都清空缓存（强制查数据库） -->
<select id="selectLatest" resultType="User" flushCache="true">
  SELECT * FROM user ORDER BY create_time DESC LIMIT 1
</select>
```

### Spring 中的行为

在 Spring/Spring Boot 中，默认每次方法调用使用不同的 SqlSession（方法结束后关闭），因此一级缓存几乎不生效。只有在同一事务内（`@Transactional`），Spring 会复用同一个 SqlSession，一级缓存才有效。

### 禁用一级缓存

```xml
<settings>
  <!-- STATEMENT: 每条语句结束后清空一级缓存（相当于禁用） -->
  <setting name="localCacheScope" value="STATEMENT"/>
  <!-- SESSION（默认）: SqlSession 级别缓存 -->
</settings>
```

## 二级缓存

二级缓存是 Mapper（namespace）级别的缓存，跨 SqlSession 共享。需要显式开启。

### 开启步骤

**第一步**：全局开关（`mybatis-config.xml`）

```xml
<settings>
  <setting name="cacheEnabled" value="true"/>
</settings>
```

Spring Boot 中默认为 `true`，无需额外配置。

**第二步**：Mapper 中声明 `<cache/>`

```xml
<mapper namespace="com.example.mapper.UserMapper">

  <!-- 开启当前 namespace 的二级缓存 -->
  <cache/>

  <select id="selectById" resultType="User" useCache="true">
    SELECT * FROM user WHERE id = #{id}
  </select>

</mapper>
```

### cache 标签属性

```xml
<cache
  type="org.apache.ibatis.cache.impl.PerpetualCache"
  eviction="LRU"
  flushInterval="60000"
  size="512"
  readOnly="false"/>
```

| 属性 | 说明 | 默认值 |
|---|---|---|
| `type` | 缓存实现类 | `PerpetualCache` |
| `eviction` | 回收策略：`LRU`（最近最少使用）、`FIFO`（先进先出）、`SOFT`（软引用）、`WEAK`（弱引用） | `LRU` |
| `flushInterval` | 刷新间隔（毫秒），不设置则仅在增删改时刷新 | 不设置 |
| `size` | 缓存最大对象数 | 1024 |
| `readOnly` | 是否只读。`true` 返回同一引用（性能高但可能并发问题）；`false` 返回副本（安全但有序列化开销） | `false` |

### 缓存回收策略

| 策略 | 说明 |
|---|---|
| `LRU` | 移除最长时间未被使用的对象（默认） |
| `FIFO` | 按对象进入缓存的顺序移除最旧的对象 |
| `SOFT` | 基于垃圾回收器状态和软引用规则移除对象 |
| `WEAK` | 更积极地基于垃圾回收器状态和弱引用规则移除对象 |

### 缓存生效条件

```java
SqlSession session1 = sqlSessionFactory.openSession();
SqlSession session2 = sqlSessionFactory.openSession();

UserMapper mapper1 = session1.getMapper(UserMapper.class);
UserMapper mapper2 = session2.getMapper(UserMapper.class);

User user1 = mapper1.selectById(1L);  // 查数据库，存入二级缓存
session1.close();                      // 必须 close/commit 后，二级缓存才对其他 session 可见

User user2 = mapper2.selectById(1L);  // 命中二级缓存，不查数据库
```

> **关键**：一级缓存中的数据在 SqlSession `close()` 或 `commit()` 后才会被提升到二级缓存。

### cache-ref 引用其他缓存

多个 Mapper 操作同一张表时，使用 `<cache-ref>` 共享缓存，保证一致性：

```xml
<!-- UserMapper.xml -->
<mapper namespace="com.example.mapper.UserMapper">
  <cache/>
</mapper>

<!-- UserExtMapper.xml -->
<mapper namespace="com.example.mapper.UserExtMapper">
  <!-- 共享 UserMapper 的缓存 -->
  <cache-ref namespace="com.example.mapper.UserMapper"/>
</mapper>
```

### 不适合二级缓存的场景

1. **多表关联查询**：查询涉及多张表，其中一张表被其他 Mapper 修改时，缓存不会自动失效
2. **对数据实时性要求高**：二级缓存的粒度是 namespace，更新不够精细
3. **高并发写多读少**：频繁的增删改不断清空缓存，缓存命中率低
4. **分布式环境**：MyBatis 二级缓存是本地缓存，多实例间不共享。分布式场景应使用 Redis 等外部缓存

### 语句级缓存控制

```xml
<!-- 不使用二级缓存（每次查数据库） -->
<select id="selectCount" resultType="int" useCache="false">
  SELECT COUNT(*) FROM user
</select>

<!-- 执行前清空缓存（保证查到最新数据） -->
<select id="selectLatest" resultType="User" flushCache="true">
  SELECT * FROM user ORDER BY create_time DESC LIMIT 1
</select>
```

## 自定义缓存

实现 `org.apache.ibatis.cache.Cache` 接口可自定义缓存（如集成 Redis）：

```java
public class RedisCache implements Cache {

  private final String id;  // namespace

  public RedisCache(String id) {
    this.id = id;
  }

  @Override
  public String getId() {
    return id;
  }

  @Override
  public void putObject(Object key, Object value) {
    // 存入 Redis
    RedisUtil.set(key.toString(), value);
  }

  @Override
  public Object getObject(Object key) {
    // 从 Redis 读取
    return RedisUtil.get(key.toString());
  }

  @Override
  public Object removeObject(Object key) {
    // 从 Redis 删除
    return RedisUtil.del(key.toString());
  }

  @Override
  public void clear() {
    // 清空当前 namespace 的所有缓存
    RedisUtil.delByPattern(id + ":*");
  }

  @Override
  public int getSize() {
    return RedisUtil.count(id + ":*");
  }
}
```

在 Mapper 中使用：

```xml
<cache type="com.example.cache.RedisCache"/>
```

可向自定义缓存传递属性：

```xml
<cache type="com.example.cache.RedisCache">
  <property name="host" value="localhost"/>
  <property name="port" value="6379"/>
</cache>
```

> **注意**：上文中的清除策略（eviction）、readOnly 等配置不适用于自定义缓存。

从 3.4.2 开始，自定义缓存可实现 `org.apache.ibatis.builder.InitializingObject` 接口，在所有属性设置完毕后调用初始化方法：

```java
public interface InitializingObject {
  void initialize() throws Exception;
}
```

## 与 MyBatis-Plus 的关系

MyBatis-Plus 完全兼容 MyBatis 原生缓存机制。`BaseMapper` 的查询方法同样使用一级和二级缓存：

```java
// 这些方法也受缓存控制
userMapper.selectById(1L);
userMapper.selectList(null);
userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getId, 1L));
```

> **建议**：在 Spring Boot + MyBatis-Plus 项目中，通常不在 MyBatis 层使用二级缓存，而是通过 Spring Cache + Redis 在业务层控制缓存，灵活性和可控性更高。
