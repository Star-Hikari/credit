# @starhikari/koishi-plugin-credit

[![npm](https://img.shields.io/npm/v/@starhikari/koishi-plugin-credit?style=flat-square)](https://www.npmjs.com/package/@starhikari/koishi-plugin-credit)

为 Koishi 机器人提供每日签到、积分查看和排行榜功能的点数系统。支持文字与图片双模式渲染排行榜，可自定义背景与个性化样式。

## 安装

```text
# 在插件市场搜索「credit」并安装，或直接在终端执行
npm install @starhikari/koishi-plugin-credit
# 如需排行榜图片渲染功能，还需安装 puppeteer
npm install koishi-plugin-puppeteer
```

然后将插件添加到 `koishi.yml`：

```yaml
plugins:
  '@starhikari/credit': {}
  puppeteer: {}   # 可选，开启图片排行榜时需要
```

## 配置项

插件配置在 Koishi 控制台中分「基础设置」和「排行榜图片设置」两组展示，后者仅在开启图片模式时折叠显示。

### 基础设置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `minPoints` | `number` | `20` | 签到随机获得点数的最小值 |
| `maxPoints` | `number` | `35` | 签到随机获得点数的最大值 |
| `luckPrompt` | `string` | `'运气爆棚！'` | 获得较高点数时的额外提示文本 |
| `enableLog` | `boolean` | `true` | 是否在控制台显示签到/查询日志 |
| `useImage` | `boolean` | `true` | 使用图片发送排行榜（需安装 puppeteer 插件） |

> 当签到获得的点数超过 `minPoints + (maxPoints - minPoints) * 0.8` 时，会触发 `luckPrompt` 额外提示。

### 排行榜图片设置（`useImage = true` 时显示）

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `showPoints` | `boolean` | `true` | 排行榜中显示当前点数 |
| `barColorFromAvatar` | `boolean` | `true` | 柱状图颜色取自用户头像印象色 |
| `useBackground` | `boolean` | `false` | 使用自定义背景图 |
| `imageWidth` | `number` | `800` | 排行榜图片宽度（px） |
| `imageHeight` | `number` | `0` | 排行榜图片高度（px，0 表示自适应内容） |

**背景图路径**（`useBackground = true` 时显示）：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `backgroundDir` | `string` | `''` | 背景图片目录的绝对路径 |

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

查看签到天数排行榜。群聊中默认显示本群排行，私聊中默认显示全局排行。

- **别名：** `排行榜`
- **用法：**
  ```
  排行榜            → 本群排行（群聊）/ 全局排行（私聊）
  排行榜 5          → 显示前 5 名
  排行榜 -g         → 强制全局排行
  排行榜 5 -g       → 显示全局前 5 名
  ```
- **参数：** `[count:number]` — 显示前几名，范围 1~20，默认 10
- **选项：**
  - `-g, --global` — 查看全局排行榜

#### 图片模式（默认）

需安装并启用 `koishi-plugin-puppeteer`，发送排行榜时会生成一张精美的卡片图片：

```
🏆 签到排行榜 TOP 10
┌──────────────────────────────────────────────┐
│ #  头像  用户名      ████████████ 天数  点数  │
│ 1  [🖼]  喵喵        ████████████  15   200  │
│ 2  [🖼]  114514      ██████████    12   150  │
│ 3  [🖼]  UserName    ████████      10   120  │
│ ...                                          │
└──────────────────────────────────────────────┘
```

- 每行左侧显示排名（金/银/铜色）和圆形头像
- 柱状图颜色自动取自用户头像的印象色（可配置关闭）
- 可选显示点数列
- 支持自定义背景图片（自动降低透明度避免干扰内容）
- 所有元素随 `imageWidth` 配置等比例缩放
- 渲染过程中发送等待提示，失败自动降级为文字版

#### 文字模式（降级）

当未安装 puppeteer 或关闭 `useImage` 时使用：

```
本群签到排行榜 TOP3
喵喵　15天
114514　12天
UserName　10天
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

## 依赖

| 依赖 | 类型 | 说明 |
|------|------|------|
| `koishi` ^4.18.7 | peer | Koishi 框架 |
| `database` | required | 数据库服务 |
| `puppeteer` | optional | 排行榜图片渲染（需额外安装 koishi-plugin-puppeteer） |

## 更新日志

- **1.1.0** — 新增排行榜图片渲染（puppeteer）、群内/全局排行切换、卡片式设计、自定义背景、头像印象色、尺寸配置；重构模板分离
- **1.0.5** — 修复了日期判断逻辑
- **1.0.4** — 调整了文档部分内容
- **1.0.2** — 调整部分代码细节
- **1.0.1** — 添加了日志开关，支持控制台显示签到成功的消息
- **1.0.0** — 初始版本，支持签到、积分查看、排行榜功能