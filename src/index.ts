import { Context, Schema } from 'koishi'
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { buildLeaderboardHtml, TemplateRecord } from './template'

export const name = 'credit'
export const inject = {
  required: ['database'],
  optional: ['puppeteer'],
}

export interface Config {
  minPoints: number
  maxPoints: number
  luckPrompt: string
  enableLog: boolean
  useImage: boolean
  showPoints: boolean
  barColorFromAvatar: boolean
  useBackground: boolean
  backgroundDir: string
  imageWidth: number
  imageHeight: number
}

export const Config = Schema.intersect([
  // ========== 基础设置（始终显示） ==========
  Schema.object({
    minPoints: Schema.number().default(20).description('签到随机点数的最小值'),
    maxPoints: Schema.number().default(35).description('签到随机点数的最大值'),
    luckPrompt: Schema.string().default('运气爆棚！').description('获得较高点数时的额外提示文本'),
    enableLog: Schema.boolean().default(true).description('是否在控制台显示签到/查询日志'),
    useImage: Schema.boolean().default(true).description('使用图片发送排行榜（需要安装并启用 puppeteer 插件）'),
  }).description('基础设置'),

  // ========== 排行榜图片设置（仅 useImage = true 时折叠显示） ==========
  Schema.union([
    Schema.intersect([
      Schema.object({
        useImage: Schema.const(true),
        showPoints: Schema.boolean().default(true).description('排行榜中显示当前点数'),
        barColorFromAvatar: Schema.boolean().default(true).description('柱状图颜色取自用户头像印象色'),
        useBackground: Schema.boolean().default(false).description('使用自定义背景图'),
        imageWidth: Schema.number().default(800).description('排行榜图片宽度（px）'),
        imageHeight: Schema.number().default(0).description('排行榜图片高度（px，0 表示自适应内容）'),
      }).description('排行榜图片设置'),

      // ========== 背景图路径（仅 useBackground = true 时折叠显示） ==========
      Schema.union([
        Schema.object({
          useBackground: Schema.const(true).required(),
          backgroundDir: Schema.string().default('').description('背景图片目录的绝对路径'),
        }).description('背景图路径'),
        Schema.object({}),
      ]),
    ]),
    Schema.object({}),
  ]),
]) as Schema<Config>

// 数据库表字段类型
declare module 'koishi' {
  interface Tables {
    credits: CreditsRecord
  }
}

export interface CreditsRecord {
  id: number
  platform: string
  userId: string
  userName: string
  counts: number
  signDays: number
  signDate: string  // YYYY-MM-DD
}

// ==================== 辅助函数 ====================

/** 获取 yyyy-mm-dd hh:mm:ss 格式时间戳 */
function formatNow(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 获取今天的日期字符串（中国时区 UTC+8） */
function todayStr(): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format().replace(/\//g, '-')
}

/** 获取 QQ 头像的 base64 数据 URL */
async function fetchAvatarAsBase64(userId: string): Promise<string> {
  try {
    const url = `http://q.qlogo.cn/headimg_dl?dst_uin=${userId}&spec=640`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer())
      return `data:image/jpeg;base64,${buf.toString('base64')}`
    }
  } catch {
    // 静默失败，后续使用占位色
  }
  return ''
}

/** 从背景目录中随机选取一张图片，转为 base64 数据 URL */
function getRandomBackground(backgroundDir: string): string {
  try {
    const files = readdirSync(backgroundDir).filter(f =>
      /\.(png|jpg|jpeg|gif|webp)$/i.test(f),
    )
    if (!files.length) return ''
    const picked = files[Math.floor(Math.random() * files.length)]
    const fullPath = resolve(backgroundDir, picked)
    const ext = picked.split('.').pop()?.toLowerCase() || 'png'
    const mime = ext === 'jpg' ? 'jpeg' : ext
    const buf = readFileSync(fullPath)
    return `data:image/${mime};base64,${buf.toString('base64')}`
  } catch {
    return ''
  }
}

// ==================== 排行榜图片渲染 ====================

/**
 * 使用 puppeteer 渲染排行榜图片
 * @returns h 元素的字符串（可直接用于回复）
 */
async function renderLeaderboardImage(
  ctx: Context,
  records: TemplateRecord[],
  config: Config,
  _atText: string,
): Promise<string> {
  const logger = ctx.logger('credit')

  // 1. 获取背景图
  let bgBase64 = ''
  if (config.useBackground && config.backgroundDir) {
    bgBase64 = getRandomBackground(config.backgroundDir)
  }

  // 2. 并发获取所有用户头像
  const avatarResults = await Promise.allSettled(
    records.map(r => fetchAvatarAsBase64(r.userId)),
  )
  const avatars: string[] = avatarResults.map(r =>
    r.status === 'fulfilled' ? r.value : '',
  )

  // 3. 计算柱状图比例
  const maxDays = Math.max(...records.map(r => r.signDays), 1)

  // 4. 生成 HTML
  const html = buildLeaderboardHtml(records, config, {
    avatars,
    backgroundBase64: bgBase64,
    imageWidth: config.imageWidth,
  }, maxDays)

  // 5. 使用 puppeteer 渲染，通过回调设置视口尺寸
  const puppeteer = (ctx as any).puppeteer
  return await puppeteer.render(html, async (page: any, next: any) => {
    const deviceScaleFactor = 2
    const height = config.imageHeight > 0 ? config.imageHeight : undefined
    await page.setViewport({
      width: config.imageWidth,
      height: height ?? 768,
      deviceScaleFactor,
    })
    const handle = await page.$('body')
    return next(handle)
  })
}

// ==================== 插件入口 ====================

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('credit')

  // 扩展数据库，建立 credits 表
  ctx.model.extend('credits', {
    id: { type: 'unsigned' },
    platform: 'string',
    userId: 'string',
    userName: 'string',
    counts: { type: 'integer', initial: 0 },
    signDays: { type: 'integer', initial: 0 },
    signDate: { type: 'string', initial: '' },
  }, {
    primary: 'id',
    autoInc: true,
    unique: [['platform', 'userId']],
  })

  // ==================== sign 签到 ====================
  ctx.command('sign', '每日签到')
    .alias('签到')
    .action(async ({ session }) => {
      try {
        if (!session) return '无法获取会话信息~'
        const platform = session.platform
        const userId = session.userId
        const userName = session.username || '未知用户'
        const today = todayStr()

        // 查找或创建记录
        let record = await ctx.database.get('credits', { platform, userId })
        if (!record.length) {
          record = [await ctx.database.create('credits', {
            platform, userId, userName,
            counts: 0, signDays: 0, signDate: '',
          })]
        }
        const user = record[0]
        const atText = `<at id="${userId}"/>`

        if (user.signDate === today) {
          return `${atText} 你今天已经签到过了喵~`
        }

        const range = config.maxPoints - config.minPoints + 1
        const bonus = Math.floor(Math.random() * range) + config.minPoints

        await ctx.database.set('credits', { platform, userId }, {
          counts: user.counts + bonus,
          signDays: user.signDays + 1,
          signDate: today,
          userName,
        })

        const totalCounts = user.counts + bonus
        const totalSignDays = user.signDays + 1

        let result = `${atText} 签到成功~
今日收获点数${bonus}点，当前总计${totalCounts}点
一共签到了${totalSignDays}天喵`

        if (bonus > config.minPoints + (config.maxPoints - config.minPoints) * 0.8) {
          result = `${atText} ${config.luckPrompt}
今日收获点数${bonus}点，当前总计${totalCounts}点
一共签到了${totalSignDays}天喵`
        }

        if (config.enableLog) {
          logger.info(`${formatNow()} ${userName}(${userId})签到成功~ 一共签到${totalSignDays}天`)
        }

        return result
      } catch (e) {
        logger.error(`签到处理异常: ${e instanceof Error ? e.message : String(e)}`)
        return `签到处理出现异常，请联系管理员~`
      }
    })

  // ==================== credit 查看点数 ====================
  ctx.command('credit', '查看我的积分')
    .alias('点数')
    .action(async ({ session }) => {
      try {
        if (!session) return '无法获取会话信息~'
        const platform = session.platform
        const userId = session.userId
        const userName = session.username || '未知用户'
        const today = todayStr()
        const atText = `<at id="${userId}"/>`

        const record = await ctx.database.get('credits', { platform, userId })
        if (!record.length) {
          return `${atText} 你还没有签到记录哦，发送"签到"开始吧~`
        }

        const user = record[0]
        const signedToday = user.signDate === today ? '已' : '未'

        if (config.enableLog) {
          logger.info(`${userName}(${userId})查看了自己的点数~`)
        }

        return `${atText} 当前拥有${user.counts}点数~
一共签到了${user.signDays}天，今日${signedToday}签到哦`
      } catch (e) {
        logger.error(`查看点数异常: ${e instanceof Error ? e.message : String(e)}`)
        return `查看点数出现异常，请联系管理员~`
      }
    })

  // ==================== creditsBoard 排行榜 ====================
  ctx.command('creditsBoard [count:number]', '查看打卡排行榜')
    .option('global', '-g  查看全局排行榜（默认在当前群内排行）')
    .alias('排行榜')
    .action(async ({ session, options }, count = 10) => {
      try {
        if (!session) return '无法获取会话信息~'
        count = Math.min(Math.max(1, count), 20)
        const userId = session.userId
        const userName = session.username || '未知用户'
        const atText = `<at id="${userId}"/>`

        // 判断作用域：私聊 / 显式 -g  → 全局；群聊且无 -g → 群内
        const isGlobal = options?.global || !session.guildId
        const guildId = session.guildId

        let records: CreditsRecord[] = []

        if (isGlobal) {
          // —— 全局排行榜 ——
          records = await ctx.database.get('credits', {}, {
            sort: { signDays: 'desc' },
            limit: count,
          })
        } else {
          // —— 群内排行榜：获取该群成员列表，筛选在本群有签到记录的用户 ——
          let memberIds: string[] = []
          try {
            const bot = session.bot as any
            if (!bot?.internal) throw new Error('当前适配器不支持群成员查询')
            const groupMembers: Array<{ user_id: number }> =
              await bot.internal.getGroupMemberList(Number(guildId))
            memberIds = groupMembers.map(m => String(m.user_id))
          } catch (e) {
            logger.error(`获取群成员列表失败: ${e instanceof Error ? e.message : String(e)}`)
            // 降级：显示全部
            memberIds = []
          }

          if (memberIds.length) {
            // 取出所有记录后按群成员过滤
            const all = await ctx.database.get('credits', {}, {
              sort: { signDays: 'desc' },
            })
            records = all.filter(r => memberIds.includes(r.userId)).slice(0, count)
          } else {
            // 获取群成员失败，回退到全局
            records = await ctx.database.get('credits', {}, {
              sort: { signDays: 'desc' },
              limit: count,
            })
          }
        }

        if (!records.length) {
          return `${atText} 还没有任何签到记录呢~`
        }

        const scopeLabel = isGlobal ? '全局' : '本群'
        if (config.enableLog) {
          logger.info(`${userName}(${userId})查看了${scopeLabel}点数排行榜~`)
        }

        // === 判断是否使用图片模式 ===
        const puppeteerAvailable = !!(ctx as any).puppeteer
        if (config.useImage && puppeteerAvailable) {
          // 发送等待消息
          await session.send(`${atText} 正在生成${scopeLabel}排行榜图片，请稍候~`)

          try {
            // 渲染排行榜图片
            const imageOutput = await renderLeaderboardImage(ctx, records, config, atText)
            return imageOutput
          } catch (renderErr) {
            logger.error(`排行榜图片渲染失败: ${renderErr instanceof Error ? renderErr.message : String(renderErr)}`)
            // 图片渲染失败，降级到文本模式
            const lines = records.map(r => `${r.userName}　${r.signDays}天`)
            return `${scopeLabel}排行榜图片生成失败了，这是文字版~\n签到排行榜 TOP${records.length}\n${lines.join('\n')}`
          }
        }

        // === 文本模式（降级） ===
        const lines = records.map(r => `${r.userName}　${r.signDays}天`)
        return `${scopeLabel}签到排行榜 TOP${records.length}\n${lines.join('\n')}`
      } catch (e) {
        logger.error(`查看排行榜异常: ${e instanceof Error ? e.message : String(e)}`)
        return `查看排行榜出现异常，请联系管理员~`
      }
    })
}
