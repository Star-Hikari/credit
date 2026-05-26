# koishi-plugin-credit

[![npm](https://img.shields.io/npm/v/@starhikari/koishi-plugin-credit?style=flat-square)](https://www.npmjs.com/package/@starhikari/koishi-plugin-credit)

为 Koishi 机器人提供签到、积分查看和排行榜功能的点数系统。

## 安装

```text
# 在插件市场搜索「credit」并安装，或直接在终端执行
npm install koishi-plugin-@starhikari/credit
```

然后将插件添加到 `koishi.yml`：

```yaml
plugins:
  credit: {}
```

## 配置项

### 基础配置

```yaml
plugins:
  credit:
    minPoints: 20      # 签到随机点数的最小值，默认 20
    maxPoints: 35      # 签到随机点数的最大值，默认 35
    luckPrompt: 运气爆棚！  # 获得较高点数时的额外提示文本，默认「运气爆棚！」
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `minPoints` | `number` | `20` | 签到随机获得点数的最小值 |
| `maxPoints` | `number` | `35` | 签到随机获得点数的最大值 |
| `luckPrompt` | `string` | `'运气爆棚！'` | 获得较高点数时的额外提示文本 |

> 当签到获得的点数超过 `minPoints + (maxPoints - minPoints) * 0.8` 时，会触发额外提示。

## 指令列表

### `sign` / `签到`

每日签到，随机获得一定数量的点数。

- **别名：** `签到`
- **输出示例：**
  ```
  <at id="123456789"/> 签到成功~
  今日收获点数28点，当前总计128点
  一共签到了5天喵
  ```

### `credit` / `点数`

查看当前用户的积分和签到天数。

- **别名：** `点数`
- **输出示例：**
  ```
  <at id="123456789"/> 当前拥有128点数~
  一共签到了5天，今日已签到哦
  ```

### `creditsBoard` / `排行榜`

查看签到天数排行榜。

- **别名：** `排行榜`
- **参数：** `[count:number]` — 显示前几名，范围 1~20，默认 10
- **输出示例：**
  ```
  🏆 签到排行榜 TOP3
  用户A　15天
  用户B　12天
  用户C　8天
  ```

## 数据库

插件会自动创建 `credits` 数据表，无需手动操作。表中包含以下字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | `unsigned` | 自增主键 |
| `platform` | `string` | 机器人平台 |
| `userId` | `string` | 用户 ID |
| `userName` | `string` | 用户昵称 |
| `counts` | `integer` | 累积点数 |
| `signDays` | `integer` | 累计签到天数 |
| `signDate` | `string` | 最近签到日期 (YYYY-MM-DD) |

## 更新日志

- **1.0.0** — 初始版本，支持签到、积分查看、排行榜功能
- **1.0.1** — 添加了日志开关，支持控制台显示签到成功的消息
