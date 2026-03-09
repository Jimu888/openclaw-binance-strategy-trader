# 让我们用策略来交易

一个让 OpenClaw 用户通过**币安官方 Skills（spot）**使用的可视化「金字塔建仓 / 金字塔止盈」策略小工具（Binance Spot 限价单）。

> 本工具使用 OpenClaw 搭建可视化金字塔建仓/止盈策略，通过 Binance 官方 spot skill 提交现货限价单，并提供最小权限建议、IP 白名单提示、二次确认等安全围栏，降低 AI 代理交易风险。

- 恒定混合策略：即将支持（开发中……）

作者：
- X：<https://x.com/0xjimumu>
- 币安广场：<https://www.binance.com/zh-CN/square/profile/0xjimumu>

> ⚠️ 风险提示：本工具会提交真实限价单。请自行承担交易风险。

---

## 功能

- 金字塔建仓：输入总投入 / 层数 / 价格范围 → 自动生成分层限价买单 → 二次确认后批量挂单
- 金字塔止盈：输入卖出总数量 / 层数 / 价格范围 → 自动生成分层限价卖单 → 二次确认后批量挂单
- 支持币种：BTC / ETH / BNB
- 计价币（默认 USDT，可选）：USDT / USDC / FDUSD

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

