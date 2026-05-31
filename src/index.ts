import { Context, Schema } from 'koishi'

export const name = 'credit'
export const inject = {
  required: ['database']
}

export interface Config {
  minPoints: number
  maxPoints: number
  luckPrompt: string
  enableLog: boolean
}

export const Config: Schema<Config> = Schema.object({
  minPoints: Schema.number().default(20).description('签到随机点数的最小值'),
  maxPoints: Schema.number().default(35).description('签到随机点数的最大值'),
  luckPrompt: Schema.string().default('运气爆棚！').description('获得较高点数时的额外提示文本'),
  enableLog: Schema.boolean().default(true).description('是否在控制台显示签到/查询日志'),
})

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

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('credit')

  // 格式化时间为 yyyy-mm-dd hh:mm:ss
  function formatNow(): string {
    const d = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  // 扩展数据库，建立 credits 表
  ctx.model.extend('credits', {
    id: {
      type: 'unsigned',
    },
    platform: 'string',
    userId: 'string',
    userName: 'string',
    counts: {
      type: 'integer',
      initial: 0,
    },
    signDays: {
      type: 'integer',
      initial: 0,
    },
    signDate: {
      type: 'string',
      initial: '',
    },
  }, {
    primary: 'id',
    autoInc: true,
    unique: [['platform', 'userId']],
  })

  // 获取今天的日期字符串
  function todayStr(): string {
    return new Date().toISOString().slice(0, 10)
  }

  // 指令：sign 打卡
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
        // 没有记录，创建新记录
        if (!record.length) {
          record = [await ctx.database.create('credits', {
            platform,
            userId,
            userName,
            counts: 0,
            signDays: 0,
            signDate: '',
          })]
        }
        const user = record[0]
        // 构造 @用户 文本
        let atText = `<at id="${userId}"/>`

        // 检查今天是否已打卡
        if (user.signDate === today) {
          return `${atText} 你今天已经签到过了喵~`
        }

        // 随机获得积分（范围由配置项控制）
        const range = config.maxPoints - config.minPoints + 1
        const bonus = Math.floor(Math.random() * range) + config.minPoints

        // 更新数据
        await ctx.database.set('credits', { platform, userId }, {
          counts: user.counts + bonus,
          signDays: user.signDays + 1,
          signDate: today,
          userName, // 每次更新用户名，保持同步
        })

        const totalCounts = user.counts + bonus
        const totalSignDays = user.signDays + 1


        if (bonus > config.minPoints + (config.maxPoints - config.minPoints) * 0.8) {
          atText += ' ' + config.luckPrompt
        }

        // 输出签到成功日志
        if (config.enableLog) {
          logger.info(`${formatNow()} ${userName}(${userId})签到成功~ 一共签到了${totalSignDays}天~`)
        }

        return `${atText} 签到成功~
今日收获点数${bonus}点，当前总计${totalCounts}点
一共签到了${totalSignDays}天喵`
      } catch (e) {
        logger.error(`签到处理异常: ${e instanceof Error ? e.message : String(e)}`)
        return `签到处理出现异常，请联系管理员~`
      }
    })

  // 指令：credit 查看点数
  ctx.command('credit', '查看我的积分')
    .alias('点数')
    .action(async ({ session }) => {
      try {
        if (!session) return '无法获取会话信息~'
        const platform = session.platform
        const userId = session.userId
        const userName = session.username || '未知用户'
        const today = todayStr()

        // 构造 @用户 文本
        let atText = `<at id="${userId}"/>`

        const record = await ctx.database.get('credits', { platform, userId })
        if (!record.length) {
          return `${atText} 你还没有签到记录哦，发送“签到”开始吧~`
        }

        const user = record[0]
        const signedToday = user.signDate === today ? '已' : '未'

        // 输出查看点数日志
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

  // 指令：creditsBoard 排行榜
  ctx.command('creditsBoard [count:number]', '查看打卡排行榜')
    .alias('排行榜')
    .action(async ({ session }, count = 10) => {
      try {
        if (!session) return '无法获取会话信息~'
        // 限制最大查询数量为 20
        count = Math.min(Math.max(1, count), 20)
        // 构造 @用户 文本
        const userId = session.userId
        const userName = session.username || '未知用户'
        let atText = `<at id="${userId}"/>`

        const records = await ctx.database.get('credits', {}, {
          sort: { signDays: 'desc' },
          limit: count,
        })

        if (!records.length) {
          return `${atText} 还没有任何签到记录呢~`
        }

        // 输出查看排行榜日志
        if (config.enableLog) {
          logger.info(`${userName}(${userId})查看了点数排行榜~`)
        }

        const lines = records.map(r => `${r.userName}　${r.signDays}天`)
        return `签到排行榜 TOP${records.length}\n${lines.join('\n')}`
      } catch (e) {
        logger.error(`查看排行榜异常: ${e instanceof Error ? e.message : String(e)}`)
        return `查看排行榜出现异常，请联系管理员~`
      }
    })

}
