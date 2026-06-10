// ==================== 辅助函数 ====================

/** 转义 HTML 特殊字符 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ==================== 类型定义 ====================

export interface TemplateRecord {
  userName: string
  userId: string
  counts: number
  signDays: number
}

export interface TemplateConfig {
  showPoints: boolean
  barColorFromAvatar: boolean
}

export interface TemplateAssets {
  /** 每位用户头像的 base64 数据 URL 数组，顺序与 records 一致，空串表示无头像 */
  avatars: string[]
  /** 背景图片的 base64 数据 URL，空串表示不使用背景图 */
  backgroundBase64: string
  /** 排行榜图片宽度（px） */
  imageWidth: number
}

// ==================== 模板生成 ====================

/**
 * 生成排行榜 HTML
 * @param records  排行榜数据（已按签到天数降序排列）
 * @param config   模板配置
 * @param assets   图片资源
 * @param maxDays  最大签到天数（用于柱状图比例计算）
 * @returns 完整的 HTML 字符串
 */
export function buildLeaderboardHtml(
  records: TemplateRecord[],
  config: TemplateConfig,
  assets: TemplateAssets,
  maxDays: number,
): string {
  const { avatars, backgroundBase64: bgBase64, imageWidth } = assets
  const scale = imageWidth / 800 // 以 800px 为基准的缩放系数

  // — 列定义 —
  const headerCols = config.showPoints
    ? `grid-template-columns: 44px 60px 1fr minmax(140px, 2.5fr) 70px 70px`
    : `grid-template-columns: 44px 60px 1fr minmax(140px, 2.5fr) 70px`

  // — 行 HTML —
  const rowsHtml = records
    .map((r, i) => {
      const pct = ((r.signDays / maxDays) * 100).toFixed(1)
      const avatarDataUrl = avatars[i] || ''
      const barId = `bar-${i}`
      const avatarId = `avatar-${i}`

      let rankClass = 'rank'
      if (i === 0) rankClass += ' rank-gold'
      else if (i === 1) rankClass += ' rank-silver'
      else if (i === 2) rankClass += ' rank-bronze'

      const pointsCell = config.showPoints
        ? `<div class="points">${r.counts}</div>`
        : ''

      return `
      <div class="row">
        <div class="${rankClass}">${i + 1}</div>
        <div class="avatar-wrapper">
          <img id="${avatarId}" class="avatar" src="${avatarDataUrl}" onerror="this.style.display='none'" crossorigin="anonymous">
        </div>
        <div class="name" title="${escapeHtml(r.userName)}">${escapeHtml(r.userName)}</div>
        <div class="bar-wrapper">
          <div class="bar-fill" id="${barId}" style="width: ${pct}%"></div>
        </div>
        <div class="days">${r.signDays}天</div>
        ${pointsCell}
      </div>`
    })
    .join('')

  // — 背景样式 —
  const bgStyle = bgBase64
    ? `
    background-image: url('${bgBase64}');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;`
    : 'background: linear-gradient(135deg, #dbeafe 0%, #ede9fe 50%, #fce7f3 100%);'

  // — 头像取色脚本 —
  const colorExtractScript = config.barColorFromAvatar
    ? `
  <script>
  async function extractColor(imgEl, barId) {
    try {
      const c = document.createElement('canvas');
      c.width = 40; c.height = 40;
      const cx = c.getContext('2d');
      cx.drawImage(imgEl, 0, 0, 40, 40);
      const d = cx.getImageData(0, 0, 40, 40).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
      if (!n) return;
      r = Math.round(r/n); g = Math.round(g/n); b = Math.round(b/n);
      const max = Math.max(r,g,b);
      if (max > 0) { const f = Math.min(255/max, 1.3); r = Math.min(255, Math.round(r*f)); g = Math.min(255, Math.round(g*f)); b = Math.min(255, Math.round(b*f)); }
      const bar = document.getElementById(barId);
      if (bar) bar.style.background = \`linear-gradient(90deg, rgb(\${r},\${g},\${b}) 0%, rgb(\${Math.min(255,r+50)},\${Math.min(255,g+50)},\${Math.min(255,b+50)}) 100%)\`;
    } catch(e) {}
  }
  document.querySelectorAll('.avatar').forEach(img => {
    if (img.complete) extractColor(img, img.id.replace('avatar-', 'bar-'));
    else img.onload = function() { extractColor(this, this.id.replace('avatar-', 'bar-')); };
  });
  </script>`
    : ''

  // — 默认柱状图样式（非头像取色时） —
  const defaultBarStyle = config.barColorFromAvatar ? '' : `
  <style>
    .bar-fill { background: linear-gradient(90deg, #667eea 0%, #764ba2 100%) !important; }
  </style>`

  // — 卡片样式 —
  const cardStyle = bgBase64
    ? `
    background: rgba(255, 255, 255, 0.85);
    border: 2px solid rgba(255, 255, 255, 0.35);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);`
    : `
    background: #fefcf5;
    border: 1px solid rgba(0, 0, 0, 0.06);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);`

  const baseFontSize = Math.round(16 * scale * 10) / 10

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html {
    min-height: 100%;
    ${bgStyle}
  }
  body {
    font-family: -apple-system, "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
    margin: 0;
    padding: ${Math.round(30 * scale)}px;
    font-size: ${baseFontSize}px;
    width: ${imageWidth}px;
  }
  .container {
    width: 100%;
    border-radius: ${Math.round(20 * scale)}px;
    padding: ${Math.round(30 * scale)}px ${Math.round(30 * scale)}px ${Math.round(10 * scale)}px;
    ${cardStyle}
  }
  .title {
    text-align: center;
    font-size: ${Math.round(30 * scale)}px;
    font-weight: 800;
    color: #1a1a2e;
    padding: ${Math.round(18 * scale)}px 0 ${Math.round(22 * scale)}px;
    letter-spacing: 2px;
    border-bottom: 2px solid rgba(0,0,0,0.06);
  }
  .title .highlight {
    background: linear-gradient(135deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .header-row {
    display: grid;
    ${headerCols};
    gap: ${Math.round(10 * scale)}px;
    align-items: center;
    padding: ${Math.round(14 * scale)}px ${Math.round(16 * scale)}px;
    font-weight: 600;
    font-size: ${Math.round(13 * scale)}px;
    color: #8899aa;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 2px solid rgba(0,0,0,0.06);
  }
  .row {
    display: grid;
    ${headerCols};
    gap: ${Math.round(10 * scale)}px;
    align-items: center;
    padding: ${Math.round(11 * scale)}px ${Math.round(16 * scale)}px;
    border-bottom: 1px solid rgba(0,0,0,0.04);
    transition: background 0.2s;
  }
  .row:last-child { border-bottom: none; }
  .row:hover { background: rgba(102,126,234,0.04); }
  .rank {
    font-size: ${Math.round(15 * scale)}px;
    font-weight: 700;
    color: #8899aa;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .rank-gold { color: #f1c40f; font-size: ${Math.round(18 * scale)}px; }
  .rank-silver { color: #a0b0c0; font-size: ${Math.round(17 * scale)}px; }
  .rank-bronze { color: #e67e22; font-size: ${Math.round(17 * scale)}px; }
  .avatar-wrapper {
    width: ${Math.round(44 * scale)}px;
    height: ${Math.round(44 * scale)}px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(0,0,0,0.06);
    flex-shrink: 0;
    background: #f0f2f5;
  }
  .avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .name {
    font-size: ${Math.round(14 * scale)}px;
    font-weight: 600;
    color: #1a1a2e;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: ${Math.round(4 * scale)}px;
  }
  .bar-wrapper {
    height: ${Math.round(20 * scale)}px;
    background: rgba(0,0,0,0.06);
    border-radius: ${Math.round(10 * scale)}px;
    overflow: hidden;
    position: relative;
  }
  .bar-fill {
    height: 100%;
    border-radius: ${Math.round(10 * scale)}px;
    transition: width 0.8s ease;
    position: relative;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  }
  .bar-fill::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background:
      /* 右端极淡收束竖线 — 比底色稍深一点标记柱状图终点，不抢眼 */
      linear-gradient(to top, transparent ${Math.round(3 * scale)}px, rgba(0,0,0,0.06) ${Math.round(3 * scale)}px, rgba(0,0,0,0.06) calc(100% - ${Math.round(3 * scale)}px), transparent calc(100% - ${Math.round(3 * scale)}px)) no-repeat right center / ${Math.round(1.5 * scale)}px 100%,
      /* 原有光泽覆盖层 */
      linear-gradient(90deg, rgba(255,255,255,0.25) 0%, transparent 40%, rgba(0,0,0,0.08) 100%);
    border-radius: ${Math.round(10 * scale)}px;
  }
  .days {
    font-size: ${Math.round(15 * scale)}px;
    font-weight: 700;
    color: #1a1a2e;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .points {
    font-size: ${Math.round(15 * scale)}px;
    font-weight: 700;
    color: #8e44ad;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .footer {
    text-align: center;
    padding: ${Math.round(16 * scale)}px 0 ${Math.round(6 * scale)}px;
    font-size: ${Math.round(12 * scale)}px;
    color: #a0b0c0;
  }
</style>
${defaultBarStyle}
</head>
<body>
<div class="container">
  <div class="title">🏆 <span class="highlight">签到排行榜</span> TOP ${records.length}</div>
  <div class="header-row">
    <div style="text-align:center">#</div>
    <div></div>
    <div>用户</div>
    <div>活跃度</div>
    <div style="text-align:right">天数</div>
    ${config.showPoints ? '<div style="text-align:right">点数</div>' : ''}
  </div>
  ${rowsHtml}
  <div class="footer">— 每日签到 · 持之以恒 —</div>
</div>
${colorExtractScript}
</body>
</html>`
}
