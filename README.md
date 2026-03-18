# 让我们用策略来交易

> 本工具使用 OpenClaw 搭建可视化金字塔建仓/止盈策略，通过 Binance 官方 spot skill 提交现货限价单，并提供最小权限建议、IP 白名单提示、二次确认等安全围栏，降低 AI 代理交易风险。

作者：
- X：<https://x.com/0xjimumu>
- 币安广场：<https://www.binance.com/zh-CN/square/profile/0xjimumu>

> ⚠️ 风险提示：本工具会提交真实限价单。请自行承担交易风险。

---

## 项目说明（参赛资料）

### 1) 项目概述
本项目是一个面向 OpenClaw 用户的可视化策略交易工具，聚焦于“策略 → 计算 → 预览 → 风险确认 → 通过 Binance Spot 提交挂单”的完整链路，让普通用户也能以低门槛使用机构/量化团队常用的策略。

交易执行基于 Binance 官方 Skills（spot），并在 UI 与文档中强调最小权限、IP 白名单、二次确认等安全围栏，降低 AI 代理交易风险。

此外，本项目提供两种使用方式：
- 可视化界面（UI）：适合快速配置与策略预览
- 提示词（Prompt）在 Agent 内使用：适合自动化工作流与展示“Agent + Skills”的能力

### 2) 策略列表（项目编号）
1. 金字塔建仓策略（分层限价买单）
2. 金字塔止盈策略（分层限价卖单）
3. 恒定混合策略（Constant Mix / 再平衡）

### 3) 适用场景与价值
- 适合希望用纪律化策略执行分层挂单的交易者（减少情绪化交易）
- 可视化输入把复杂拆单计算变成低门槛操作
- 让普通用户也能使用机构/量化团队常用的策略（分层建仓、分层止盈、恒定混合再平衡），不需要写代码也能上手
- 通过 OpenClaw + Binance Skills 形成“策略工具 + Agent 工作流”的一体化体验

### 4) 支持资产与交易对
- Base：BTC / ETH / BNB
- Quote：默认 USDT，可选 USDC / FDUSD

### 5) Prompt/Agent 用法（示例提示词）
示例 1（生成策略计划 / 纯计算）：
- “帮我生成 BNB 的金字塔建仓计划：在 520~560 区间，用 6 份资金分 40 层挂单；输出每层限价/金额/数量，并在执行前让我二次确认。”

示例 2（执行挂单 / spot skill 下单）：
- “我已确认风险。请通过 Binance spot skill 为 BTCUSDT 按以下计划提交 5 笔 GTC LIMIT BUY 挂单，返回每笔订单的 orderId 和状态。”

示例 3（恒定混合策略建议 / 可选执行）：
- “读取我现货账户 BTC 与 USDT 持仓（spot skill /api/v3/account），按 BTC 50%/USDT 50% 目标计算偏离；若偏离超过 5%，给出建议买卖方向与数量，并询问我是否确认下单。”

### 6) 安全设计（参赛重点）
- 最小权限建议：只开现货交易 +（可选）读取，禁止提现
- IP 白名单提示：强烈建议开启，降低密钥泄露风险
- 二次确认：风险勾选 + 弹窗确认后才提交挂单
- 密钥不进入前端：不写入 UI、.env、仓库；详见 SECURITY.md

---

## 安装 & 运行（本地）

### 1) 安装依赖

```bash
npm install
```

### 2) 安装币安官方 Skills（必需）

本工具下单依赖 **Binance 官方 skills-hub 的 `spot` skill**。

- 安装 skills-hub / spot skill 的方式以你当前 OpenClaw 环境为准（不同部署可能不同）。
- 如果你已经在 OpenClaw 里能使用 `spot` 技能（现货下单/查询），说明这一项已满足。

### 3) 设置 Binance API（永久环境变量，推荐）

你需要：
- `BINANCE_API_KEY`
- `BINANCE_SECRET_KEY`

#### Windows（永久写入）

```powershell
setx BINANCE_API_KEY "你的key"
setx BINANCE_SECRET_KEY "你的secret"
```

> 设置完成后：重新打开终端 / 重启相关进程，新的环境变量才会生效。

#### Windows（仅当前终端临时）

```powershell
$env:BINANCE_API_KEY="你的key"
$env:BINANCE_SECRET_KEY="你的secret"
```

#### macOS / Linux（永久写入，bash/zsh）

把下面内容追加到 `~/.zshrc` 或 `~/.bashrc`：

```bash
export BINANCE_API_KEY="你的key"
export BINANCE_SECRET_KEY="你的secret"
```

然后执行：

```bash
source ~/.zshrc  # 或 source ~/.bashrc
```

#### macOS / Linux（仅当前终端临时）

```bash
export BINANCE_API_KEY="你的key"
export BINANCE_SECRET_KEY="你的secret"
```


### 4) 启动本地下单服务（必需）

```bash
npm run server
```

默认监听：`http://localhost:3001`

### 5) 启动前端 UI

```bash
npm start
```

默认：`http://localhost:3002`

---

## API 安全注意事项（必读）

请务必阅读：[`SECURITY.md`](./SECURITY.md)

最重要的几点：

1. **强烈建议开启 IP 白名单**（Binance API 管理后台设置）
2. **权限最小化**：只开现货交易 + 读取（如需要），不要开提现
3. **密钥不进入前端**：不要写进 React、不要写进 `.env`、不要提交 GitHub
4. 本项目的下单服务仅供本机使用，**不要对公网暴露**

---

## 常见问题

### Q1：设置环境变量后，需要重启什么？

- 你需要重启「读取环境变量的进程」。
- 如果你用的是本项目的下单服务：重启 `npm run server` 即可。

### Q2：为什么 UI 显示 API 未设置？

- 请确认 `npm run server` 正在运行。
- 请确认环境变量在启动 server 的那个终端会话里可见。

---

## 开源与贡献

- 请不要提交任何包含密钥的文件。
- 建议使用独立的 Binance API key。

