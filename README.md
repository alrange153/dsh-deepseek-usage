# dsh-deepseek-usage

DeepSeek API 用量仪表盘插件（dsh web profile 双面插件），界面风格参考 [Ychris12138/dsh-usage-stats](https://github.com/Ychris12138/dsh-usage-stats)：

- **账户余额卡** —— 实时查询 `api.deepseek.com/user/balance`（Bearer = `DEEPSEEK_API_KEY` 凭据），DeepSeek 品牌卡片：状态徽标、大号余额、充值/赠送拆分与可用状态。
- **用量概览** —— 今日 / 本月 / 累计 Token，以及今日缓存命中率。
- **月历热力图** —— Codex 风格蓝色热力图（颜色深浅 = Token 用量），按月浏览（‹ › / 今天），点击日期下钻查看当天分模型明细（Token 占比条 + 输入/输出/缓存 + 缓存命中率）。
- **最近 14 天** —— 带用量条与缓存命中率的日历日列表，点击同样下钻。
- **时间段统计** —— 24小时 / 7天 / 30天 / 本月 / 上月 / 全部，请求次数 / 消耗金额 / Token 消耗 / 输出 Token 四卡，均带**与上一等长周期的变化率**（Δ%），下方为分模型分布条。
- **请求量趋势图** —— 纯 SVG 面积图，可在 **消耗金额 / 请求次数 / Token 消耗** 三个指标间切换，支持悬停查看单桶数值。
- **侧边栏徽标** —— 侧边栏底部「用量」按钮（窄栏为图标），宽栏附带今日 Token 计数，实时更新。
- **可拖动悬浮窗口** —— 拖动标题栏移动，拖右边/下边/右下角调整大小（右下角斜纹手柄），`▁` 收起 / `×` 关闭 / `↻` 刷新；滚动条隐藏（滚轮/触摸可滚动）；位置、大小、收起与开关状态记入 localStorage，打开时每 60 秒自动刷新。设置页里的完整页面同样保留。

## 数据来源

| 数据 | 来源 |
|---|---|
| 余额 | 官方 `user/balance` 接口（API Key），30 秒缓存 |
| 请求数 / Token（精确） | DSH 自身持久化会话日志：每次完成的 LLM 调用都是一条带 `usage` 的 `assistant/message` 事件（提供方上报的 input / cache-read / output / reasoning 分桶与模型路由），经 `ctx.sessionPersistence` 折叠 |
| 费用 | 按模型单价表（¥/百万 token）× token 估算；配置了平台 Token 后改用平台账单（见下） |

### 平台模式（可选，更准确）

DeepSeek 开放平台还有一组**私有**用量接口（`platform.deepseek.com/api/v0/usage/amount|cost?month=&year=`），返回账户维度的请求数、各类 token 与真实费用，但需要平台的登录会话 Token（浏览器登录 platform.deepseek.com 后 `localStorage.userToken`）。

若在 DSH 凭据中配置了该 Token，插件自动优先使用平台模式（费用即为平台账单）：

```yaml
# $DSH_HOME/.credentials.yaml 追加（也可用环境变量）
DEEPSEEK_PLATFORM_TOKEN: <你的 platform.deepseek.com userToken>
```

未配置时使用本地记录模式，界面上会标注「本地记录 · 估算费用」。

## 安装

1. 确保 `dsh` 在 PATH（本机位于 `...\_npx\1e7f6d9597241db0\node_modules\.bin`）。
2. 插件已装入 web profile（`$DSH_HOME/profiles/web`）：
   - 包体位于 `$DSH_HOME/profiles/node_modules/dsh-deepseek-usage/`（已随本仓库手动同步）；
   - `cordis.patch.yml` 已插入 `deepseek-usage` 行；
   - `package.json` 已记录 `file:` 依赖。

> 注意：插件行在进程启动时组合，**已运行的 `dsh web` 需要重启后仪表盘才会出现**（client-modules 的包元数据在启动时缓存）。重启方式：结束当前 `dsh web` 进程后重新 `dsh web`。

如果之后在 profile 里执行过 `pnpm install` 导致包被移除，重新安装：

```sh
dsh plugin --profile web add C:/Users/g/Desktop/dsh_token_usage/plugins/dsh-deepseek-usage
```

## 使用

重启后打开 Web GUI（http://127.0.0.1:3080）：

- **快捷方式**：侧边栏底部点击「📊 用量」按钮（窄栏为图标，宽栏附带今日 Token 计数），打开可拖动的悬浮仪表盘窗口。拖动标题栏移动；拖**右边 / 下边 / 右下角**调整窗口大小（右下角斜纹手柄，最小 340×300，最大不超过视口）；`↻` 刷新，`▁` 收起，`×` 关闭。窗口无滚动条（内容仍可用滚轮/触摸滚动），位置与大小会被记住，打开时每 60 秒自动刷新。点击热力图日期（或最近 14 天某一天）可下钻查看当天分模型明细，‹ 返回。
- **完整页面**：**设置**（Settings）→ 左侧导航 **「DeepSeek 用量」** 分区。

## 配置（可选）

可在 `cordis.patch.yml` 的插件行上覆盖默认值：

```yaml
- id: deepseek-usage
  name: 'dsh-deepseek-usage'
  config:
    apiKeyEnv: 'DEEPSEEK_API_KEY'          # 余额接口使用的凭据引用
    platformTokenEnv: 'DEEPSEEK_PLATFORM_TOKEN'  # 平台模式凭据引用
    currency: 'CNY'                        # 展示币种符号
    pricing:                               # ¥/百万 token；models 键按模型名覆盖
      fallback: { input: 2, cacheHit: 0.5, output: 8 }
      models:
        deepseek-v4-flash: { input: 2, cacheHit: 0.5, output: 8 }
```

## HTTP 路由（仅供插件自身 UI 使用）

- `GET /deepseek-usage/api/state` —— 能力探测（凭据是否配置、用量是否可用）
- `GET /deepseek-usage/api/balance` —— 余额
- `GET /deepseek-usage/api/overview?from=<ms>&to=<ms>&bucket=auto|hour|day&source=auto|local|platform` —— 聚合概览（totals / perModel / series / deltas / previous）
- `GET /deepseek-usage/api/calendar` —— 按本地日/模型聚合的全量用量（热力图、最近 14 天、日下钻），含缓存命中率与累计值，15 秒缓存

## 已知限制

- 本地模式费用为估算值（按单价表），实际金额以平台账单为准。
- 平台模式的私有接口未公开、可能随时变化；失败时自动回退本地记录并在界面标注。
- 「全部」时间段在平台模式下扫描上限为最近 36 个月。
- 每个会话的日志折叠按事件时间计入时间段；跨时间段的超长会话按请求发生时刻归属。
