import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

type StrategyMode = 'constant-mix' | 'pyramid-buy' | 'pyramid-tp';

type PyramidBuyConfig = {
  totalQuote: number; // FDUSD
  levels: number;
  highPrice: number; // start buy when price <= highPrice
  lowPrice: number; // last level
};

type PyramidTpConfig = {
  totalBase: number; // BTC to sell
  levels: number;
  lowPrice: number; // start sell when price >= lowPrice
  highPrice: number; // last level
};

type PyramidBuyLevel = { level: number; price: number; quoteAmount: number };

type PyramidTpLevel = { level: number; price: number; baseAmount: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatNumber(n: number, digits = 2) {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatInt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

function normalizeRange(a: number, b: number): { low: number; high: number } {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return { low, high };
}

/**
 * 金字塔建仓计划
 * - 价格：high -> low 等分
 * - 金额：按 scale 递增（越跌越买），归一化到 totalQuote
 */
function buildPyramidBuyPlan(params: {
  totalQuote: number;
  levels: number;
  highPrice: number;
  lowPrice: number;
  scale: number;
}): PyramidBuyLevel[] {
  const { totalQuote, levels, highPrice, lowPrice, scale } = params;
  const L = clamp(Math.floor(levels), 2, 20);

  const weights = Array.from({ length: L }, (_, i) => Math.pow(scale, i));
  const wSum = weights.reduce((a, b) => a + b, 0);

  const prices = Array.from({ length: L }, (_, i) => {
    const t = i / (L - 1);
    return highPrice + (lowPrice - highPrice) * t;
  });

  const plan: PyramidBuyLevel[] = prices.map((price, idx) => ({
    level: idx + 1,
    price,
    quoteAmount: (totalQuote * weights[idx]) / wSum,
  }));

  const sum = plan.reduce((acc, x) => acc + x.quoteAmount, 0);
  plan[plan.length - 1].quoteAmount += totalQuote - sum;
  return plan;
}

/**
 * 金字塔止盈计划
 * - 价格：low -> high 等分
 * - 数量：按 scale 递增（越涨卖越多），归一化到 totalBase
 */
function buildPyramidTpPlan(params: {
  totalBase: number;
  levels: number;
  lowPrice: number;
  highPrice: number;
  scale: number;
}): PyramidTpLevel[] {
  const { totalBase, levels, lowPrice, highPrice, scale } = params;
  const L = clamp(Math.floor(levels), 2, 20);

  const weights = Array.from({ length: L }, (_, i) => Math.pow(scale, i));
  const wSum = weights.reduce((a, b) => a + b, 0);

  const prices = Array.from({ length: L }, (_, i) => {
    const t = i / (L - 1);
    return lowPrice + (highPrice - lowPrice) * t;
  });

  const plan: PyramidTpLevel[] = prices.map((price, idx) => ({
    level: idx + 1,
    price,
    baseAmount: (totalBase * weights[idx]) / wSum,
  }));

  const sum = plan.reduce((acc, x) => acc + x.baseAmount, 0);
  plan[plan.length - 1].baseAmount += totalBase - sum;
  return plan;
}

function Modal(props: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!props.open) return null;
  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{props.title}</div>
          <button className="modal-close" onClick={props.onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{props.children}</div>
        {props.footer && <div className="modal-footer">{props.footer}</div>}
      </div>
    </div>
  );
}

const App: React.FC = () => {
  // 默认打开：金字塔建仓
  const [mode, setMode] = useState<StrategyMode>('pyramid-buy');

  // TODO: 接入实时价格/余额
  const btcBalance = 0.1;
  const ethBalance = 1.2;
  const bnbBalance = 10;

  // API status (from local backend)
  const [apiConfigured, setApiConfigured] = useState<boolean>(false);
  const [apiChecked, setApiChecked] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        setApiConfigured(Boolean(data.configured));
      } catch {
        setApiConfigured(false);
      } finally {
        setApiChecked(true);
      }
    })();
  }, []);

  const quoteAssets = ['USDT', 'USDC', 'FDUSD'] as const;
  type QuoteAsset = (typeof quoteAssets)[number];
  const baseAssets = ['BTC', 'ETH', 'BNB'] as const;
  type BaseAsset = (typeof baseAssets)[number];

  // mock prices by symbol
  const mockPrice = (base: BaseAsset, quote: QuoteAsset) => {
    const basePx: Record<BaseAsset, number> = { BTC: 95234.56, ETH: 4821.34, BNB: 612.78 };
    const quoteFx: Record<QuoteAsset, number> = { USDT: 1, USDC: 1, FDUSD: 1 };
    return basePx[base] * quoteFx[quote];
  };

  // -------- Pyramid Buy --------
  const [pbBase, setPbBase] = useState<BaseAsset>('BTC');
  const [pbQuote, setPbQuote] = useState<QuoteAsset>('USDT');
  const currentBuyPrice = mockPrice(pbBase, pbQuote);

  const [pbConfig, setPbConfig] = useState<PyramidBuyConfig>({
    totalQuote: 5000,
    levels: 5,
    highPrice: 90000,
    lowPrice: 70000,
  });
  const [pbPreviewConfig, setPbPreviewConfig] = useState<PyramidBuyConfig>(pbConfig);
  const [pbAllOpen, setPbAllOpen] = useState(false);
  const [pbConfirmOpen, setPbConfirmOpen] = useState(false);
  const [pbRiskOk, setPbRiskOk] = useState(false);

  const pbScale = 1.4; // 系统决定

  const pbPlan = useMemo(() => {
    const { low, high } = normalizeRange(pbPreviewConfig.lowPrice, pbPreviewConfig.highPrice);
    return buildPyramidBuyPlan({
      totalQuote: Math.max(1, pbPreviewConfig.totalQuote),
      levels: clamp(pbPreviewConfig.levels, 2, 20),
      highPrice: high,
      lowPrice: low,
      scale: pbScale,
    });
  }, [pbPreviewConfig]);

  const pbTop3 = pbPlan.slice(0, 3);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const pbAvgCost = useMemo(() => {
    const btc = pbPlan.reduce((acc, x) => acc + x.quoteAmount / x.price, 0);
    if (btc <= 0) return 0;
    return pbPlan.reduce((acc, x) => acc + x.quoteAmount, 0) / btc;
  }, [pbPlan]);

  // 校验：最高建仓价不能高于现价（否则会立即以更差价格成交）
  const pbHigh = Math.max(pbPreviewConfig.highPrice, pbPreviewConfig.lowPrice);
  const pbIsValidToExecute = pbHigh <= currentBuyPrice;

  // -------- Pyramid TP --------
  const [tpBase, setTpBase] = useState<BaseAsset>('BTC');
  const [tpQuote, setTpQuote] = useState<QuoteAsset>('USDT');
  const currentTpPrice = mockPrice(tpBase, tpQuote);

  const [tpConfig, setTpConfig] = useState<PyramidTpConfig>({
    totalBase: 0.08,
    levels: 4,
    lowPrice: 105000,
    highPrice: 140000,
  });
  const [tpPreviewConfig, setTpPreviewConfig] = useState<PyramidTpConfig>(tpConfig);
  const [tpAllOpen, setTpAllOpen] = useState(false);
  const [tpConfirmOpen, setTpConfirmOpen] = useState(false);
  const [tpRiskOk, setTpRiskOk] = useState(false);

  const tpScale = 1.3; // 系统决定

  const tpPlan = useMemo(() => {
    const { low, high } = normalizeRange(tpPreviewConfig.lowPrice, tpPreviewConfig.highPrice);
    return buildPyramidTpPlan({
      totalBase: Math.max(0.00000001, tpPreviewConfig.totalBase),
      levels: clamp(tpPreviewConfig.levels, 2, 20),
      lowPrice: low,
      highPrice: high,
      scale: tpScale,
    });
  }, [tpPreviewConfig]);

  const tpTop3 = tpPlan.slice(0, 3);

  // 校验：最低止盈价必须高于现价（否则会立刻卖出）
  const tpLow = Math.min(tpPreviewConfig.lowPrice, tpPreviewConfig.highPrice);
  const tpIsValidToExecute = tpLow > currentTpPrice;

  // 预计卖出总额（粗略：sum(baseAmount*price)）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const tpEstimatedQuote = useMemo(() => {
    return tpPlan.reduce((acc, x) => acc + x.baseAmount * x.price, 0);
  }, [tpPlan]);

  return (
    <div className="app">
      <div className="dashboard">
        <nav className="strategy-nav">
          <div className="nav-top-row">
            <h1>让我们用策略来交易</h1>
            <div className="nav-author">
              <a href="https://x.com/0xjimumu" target="_blank" rel="noreferrer">
                几木 @0xjimumu
              </a>
              <a href="https://www.binance.com/zh-CN/square/profile/0xjimumu" target="_blank" rel="noreferrer">
                几木-币安广场
              </a>
            </div>
          </div>
          <div className="nav-buttons">
            <button className={mode === 'pyramid-buy' ? 'active' : ''} onClick={() => setMode('pyramid-buy')}>
              金字塔建仓
            </button>
            <button className={mode === 'pyramid-tp' ? 'active' : ''} onClick={() => setMode('pyramid-tp')}>
              金字塔止盈
            </button>
            <button className={mode === 'constant-mix' ? 'active disabled' : 'disabled'} onClick={() => setMode('constant-mix')} disabled>
              恒定混合策略 <span className="soon">SOON</span>
            </button>
          </div>
        </nav>

        <main className="strategy-panel">
          {mode === 'constant-mix' && (
            <div className="strategy-content">
              <h3>🎯 恒定比例再平衡策略</h3>
              <p>维持BTC和FDUSD的固定比例，当偏差超过阈值时自动调整</p>

              <div className="portfolio-section">
                <h4>投资组合状态</h4>
                <div className="portfolio-grid">
                  <div className="portfolio-item">
                    <span>BTC余额:</span>
                    <span>{btcBalance.toFixed(8)} BTC</span>
                  </div>
                  <div className="portfolio-item">
                    <span>FDUSD余额:</span>
                    <span>5000.00 FDUSD</span>
                  </div>
                  <div className="portfolio-item">
                    <span>BTC比例:</span>
                    <span className="warning">65.52%</span>
                  </div>
                  <div className="portfolio-item">
                    <span>目标比例:</span>
                    <span>50.00%</span>
                  </div>
                  <div className="portfolio-item">
                    <span>偏差:</span>
                    <span className="warning">+15.52%</span>
                  </div>
                  <div className="portfolio-item">
                    <span>建议操作:</span>
                    <span style={{ color: '#FF9500' }}>卖出 BTC</span>
                  </div>
                </div>
              </div>

              <div className="config-section">
                <h4>策略配置</h4>
                <div className="config-grid">
                  <div className="config-item">
                    <label>目标BTC比例 (%):</label>
                    <input type="number" defaultValue="50" min="10" max="90" step="5" />
                  </div>
                  <div className="config-item">
                    <label>再平衡阈值 (%):</label>
                    <input type="number" defaultValue="5" min="1" max="20" step="1" />
                  </div>
                  <div className="config-item">
                    <label>最大交易金额 (FDUSD):</label>
                    <input type="number" defaultValue="1000" min="100" max="10000" step="100" />
                  </div>
                  <div className="config-item">
                    <label>检查频率:</label>
                    <select defaultValue="6h">
                      <option value="1h">每1小时</option>
                      <option value="2h">每2小时</option>
                      <option value="4h">每4小时</option>
                      <option value="6h">每6小时</option>
                      <option value="8h">每8小时</option>
                      <option value="12h">每12小时</option>
                      <option value="daily">每天</option>
                      <option value="weekly">每周</option>
                      <option value="monthly">每月</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="action-buttons">
                <button className="primary" onClick={() => alert('执行恒定比例策略（演示）')}>
                  执行策略并开始挂单
                </button>
              </div>
            </div>
          )}

          {mode === 'pyramid-buy' && (
            <div className="strategy-content">
              <h3>📈 金字塔建仓策略</h3>

              <div className="status-section">
                <h4>当前价格</h4>
                <div className="status-grid">
                  <div className="status-item">
                    <span>BTC价格:</span>
                    <span>{formatNumber(mockPrice('BTC', pbQuote), 2)} {pbQuote}</span>
                  </div>
                  <div className="status-item">
                    <span>ETH价格:</span>
                    <span>{formatNumber(mockPrice('ETH', pbQuote), 2)} {pbQuote}</span>
                  </div>
                  <div className="status-item">
                    <span>BNB价格:</span>
                    <span>{formatNumber(mockPrice('BNB', pbQuote), 2)} {pbQuote}</span>
                  </div>
                </div>
              </div>

              <div className="config-section">
                <div className="section-header-row">
                  <h4>建仓配置</h4>
                  <div className="section-header-actions">
                    <div className="inline-selects">
                      <label className="inline-label">
                        币种
                        <select value={pbBase} onChange={(e) => setPbBase(e.target.value as any)}>
                          {baseAssets.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="inline-label">
                        计价
                        <select value={pbQuote} onChange={(e) => setPbQuote(e.target.value as any)}>
                          {quoteAssets.map((q) => (
                            <option key={q} value={q}>
                              {q}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setPbPreviewConfig(pbConfig)}>
                      预览计划
                    </button>
                  </div>
                </div>

                <div className="config-grid">
                  <div className="config-item">
                    <label>总投入金额 (FDUSD)</label>
                    <input
                      type="number"
                      value={pbConfig.totalQuote}
                      onChange={(e) => setPbConfig((p) => ({ ...p, totalQuote: Number(e.target.value || 0) }))}
                      min={100}
                      step={100}
                    />
                  </div>
                  <div className="config-item">
                    <label>分成层数</label>
                    <input
                      type="number"
                      value={pbConfig.levels}
                      onChange={(e) => setPbConfig((p) => ({ ...p, levels: Number(e.target.value || 0) }))}
                      min={2}
                      max={20}
                      step={1}
                    />
                  </div>
                  <div className="config-item">
                    <label>最高建仓价（第1层限价）</label>
                    <input
                      type="number"
                      value={pbConfig.highPrice}
                      onChange={(e) => setPbConfig((p) => ({ ...p, highPrice: Number(e.target.value || 0) }))}
                      step={100}
                    />
                    <small>要求 ≤ 当前价，否则会立刻成交</small>
                  </div>
                  <div className="config-item">
                    <label>最低建仓价（最后一层限价）</label>
                    <input
                      type="number"
                      value={pbConfig.lowPrice}
                      onChange={(e) => setPbConfig((p) => ({ ...p, lowPrice: Number(e.target.value || 0) }))}
                      step={100}
                    />
                  </div>
                </div>
              </div>

              <div className="pyramid-preview">
                <div className="section-header-row">
                  <div>
                    <h4 style={{ marginBottom: 4 }}>层级明细（前3层）</h4>
                    <div style={{ color: '#666', fontSize: 13 }}>
                      交易对 {pbBase}{pbQuote} · 总投入 {formatInt(pbPreviewConfig.totalQuote)} {pbQuote} · {pbPlan.length} 层 · {formatInt(pbHigh)} → {formatInt(Math.min(pbPreviewConfig.highPrice, pbPreviewConfig.lowPrice))}
                    </div>
                  </div>
                  <div className="section-header-actions">
                    {pbPlan.length > 3 && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setPbAllOpen(true)}>
                        查看全部
                      </button>
                    )}
                  </div>
                </div>

                <div className="pyramid-table">
                  <div className="table-header">
                    <span>层级</span>
                    <span>限价</span>
                    <span>金额({pbQuote})</span>
                    <span>数量({pbBase})</span>
                  </div>
                  {pbTop3.map((x) => (
                    <div className="table-row" key={x.level}>
                      <span>第{x.level}层</span>
                      <span>{formatInt(x.price)}</span>
                      <span>{formatInt(x.quoteAmount)}</span>
                      <span>
                        {(x.quoteAmount / x.price).toFixed(6)} {pbBase}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pyramid-summary" style={{ marginTop: 12 }}>
                  <p>
                    <strong>成本价(估算)：</strong> {formatInt(pbAvgCost)} {pbQuote}/{pbBase}
                  </p>
                  <p>
                    <strong>建仓详情预览：</strong> 上表为前 3 层；点击右上角“查看全部”可查看完整挂单明细。
                  </p>
                </div>
              </div>

              <div className="risk-row">
                <label className="risk-check">
                  <input type="checkbox" checked={pbRiskOk} onChange={(e) => setPbRiskOk(e.target.checked)} />
                  我已确认风险 / 我理解会下单
                </label>
              </div>

              <div className="action-buttons center">
                <button
                  className="btn btn-primary"
                  disabled={!pbRiskOk}
                  onClick={() => {
                    if (!pbRiskOk) return;
                    // 二次确认前先确保预览是最新的
                    setPbPreviewConfig(pbConfig);
                    const high = Math.max(pbConfig.highPrice, pbConfig.lowPrice);
                    if (high > currentBuyPrice) {
                      alert(`错误：你设置的最高建仓价高于现价（${formatInt(high)} > ${formatInt(currentBuyPrice)}），会导致限价单立刻成交。请把最高建仓价调低到当前价以下。`);
                      return;
                    }
                    setPbConfirmOpen(true);
                  }}
                >
                  执行策略并开始挂单
                </button>
              </div>

              <Modal
                title="确认提交限价买单"
                open={pbConfirmOpen}
                onClose={() => setPbConfirmOpen(false)}
                footer={
                  <div className="modal-footer-actions">
                    <button className="btn btn-secondary" onClick={() => setPbConfirmOpen(false)}>
                      取消
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        if (!apiConfigured) {
                          alert('错误：API 未设置，无法下单。请先在运行 OpenClaw 的机器上配置 BINANCE_API_KEY / BINANCE_SECRET_KEY。');
                          return;
                        }
                        if (!pbIsValidToExecute) {
                          alert('错误：最高建仓价仍高于现价，请修改后再提交。');
                          return;
                        }
                        try {
                          const symbol = `${pbBase}${pbQuote}`;
                          const orders = pbPlan.map((x) => ({
                            price: x.price,
                            quantity: x.quoteAmount / x.price,
                          }));
                          const res = await fetch('/api/orders', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ symbol, side: 'BUY', orders }),
                          });
                          const data = await res.json();
                          if (!res.ok || !data.ok) {
                            throw new Error(data.error || '下单失败');
                          }
                          alert(`已提交：${data.results?.length || orders.length} 笔限价买单`);
                          setPbConfirmOpen(false);
                        } catch (e: any) {
                          alert(`下单失败：${e?.message || '未知错误'}`);
                        }
                      }}
                    >
                      确认提交
                    </button>
                  </div>
                }
              >
                <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
                  你确认按照以下计划提交 <strong>{pbPlan.length}</strong> 笔 <strong>{pbBase}{pbQuote}</strong> <strong>限价买单</strong> 吗？
                </div>
                <div className="pyramid-table">
                  <div className="table-header">
                    <span>层级</span>
                    <span>限价</span>
                    <span>金额({pbQuote})</span>
                    <span>数量({pbBase})</span>
                  </div>
                  {pbPlan.map((x) => (
                    <div className="table-row" key={x.level}>
                      <span>第{x.level}层</span>
                      <span>{formatInt(x.price)}</span>
                      <span>{formatInt(x.quoteAmount)}</span>
                      <span>{(x.quoteAmount / x.price).toFixed(6)} {pbBase}</span>
                    </div>
                  ))}
                </div>
              </Modal>

              <Modal title="全部建仓细节" open={pbAllOpen} onClose={() => setPbAllOpen(false)}>
                <div className="pyramid-table">
                  <div className="table-header">
                    <span>层级</span>
                    <span>限价</span>
                    <span>金额({pbQuote})</span>
                    <span>数量({pbBase})</span>
                  </div>
                  {pbPlan.map((x) => (
                    <div className="table-row" key={x.level}>
                      <span>第{x.level}层</span>
                      <span>{formatInt(x.price)}</span>
                      <span>{formatInt(x.quoteAmount)}</span>
                      <span>{(x.quoteAmount / x.price).toFixed(6)} {pbBase}</span>
                    </div>
                  ))}
                </div>
              </Modal>
            </div>
          )}

          {mode === 'pyramid-tp' && (
            <div className="strategy-content">
              <h3>💰 金字塔止盈策略</h3>

              <div className="status-section">
                <h4>当前价格</h4>
                <div className="status-grid">
                  <div className="status-item">
                    <span>BTC价格:</span>
                    <span>{formatNumber(mockPrice('BTC', tpQuote), 2)} {tpQuote}</span>
                  </div>
                  <div className="status-item">
                    <span>ETH价格:</span>
                    <span>{formatNumber(mockPrice('ETH', tpQuote), 2)} {tpQuote}</span>
                  </div>
                  <div className="status-item">
                    <span>BNB价格:</span>
                    <span>{formatNumber(mockPrice('BNB', tpQuote), 2)} {tpQuote}</span>
                  </div>
                </div>
              </div>

              <div className="config-section">
                <div className="section-header-row">
                  <h4>止盈配置</h4>
                  <div className="section-header-actions">
                    <div className="inline-selects">
                      <label className="inline-label">
                        币种
                        <select value={tpBase} onChange={(e) => setTpBase(e.target.value as any)}>
                          {baseAssets.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="inline-label">
                        计价
                        <select value={tpQuote} onChange={(e) => setTpQuote(e.target.value as any)}>
                          {quoteAssets.map((q) => (
                            <option key={q} value={q}>
                              {q}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setTpPreviewConfig(tpConfig)}>
                      预览计划
                    </button>
                  </div>
                </div>

                <div className="config-grid">
                  <div className="config-item">
                    <label>卖出总数量 ({tpBase})</label>
                    <input
                      type="number"
                      value={tpConfig.totalBase}
                      onChange={(e) => setTpConfig((p) => ({ ...p, totalBase: Number(e.target.value || 0) }))}
                      min={0.0001}
                      step={0.001}
                    />
                    <small>应 ≤ {tpBase}余额</small>
                  </div>
                  <div className="config-item">
                    <label>分成层数</label>
                    <input
                      type="number"
                      value={tpConfig.levels}
                      onChange={(e) => setTpConfig((p) => ({ ...p, levels: Number(e.target.value || 0) }))}
                      min={2}
                      max={20}
                      step={1}
                    />
                  </div>
                  <div className="config-item">
                    <label>最低止盈价（第1层限价）</label>
                    <input
                      type="number"
                      value={tpConfig.lowPrice}
                      onChange={(e) => setTpConfig((p) => ({ ...p, lowPrice: Number(e.target.value || 0) }))}
                      step={100}
                    />
                    <small>要求 &gt; 当前价，否则会立刻成交</small>
                  </div>
                  <div className="config-item">
                    <label>最高止盈价（最后一层限价）</label>
                    <input
                      type="number"
                      value={tpConfig.highPrice}
                      onChange={(e) => setTpConfig((p) => ({ ...p, highPrice: Number(e.target.value || 0) }))}
                      step={100}
                    />
                  </div>
                </div>
              </div>

              <div className="pyramid-preview">
                <div className="section-header-row">
                  <div>
                    <h4 style={{ marginBottom: 4 }}>层级明细（前3层）</h4>
                    <div style={{ color: '#666', fontSize: 13 }}>
                      交易对 {tpBase}{tpQuote} · 总卖出 {tpPreviewConfig.totalBase} {tpBase} · {tpPlan.length} 层 · {formatInt(tpLow)} → {formatInt(Math.max(tpPreviewConfig.lowPrice, tpPreviewConfig.highPrice))}
                    </div>
                  </div>
                  <div className="section-header-actions">
                    {tpPlan.length > 3 && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setTpAllOpen(true)}>
                        查看全部
                      </button>
                    )}
                  </div>
                </div>

                <div className="pyramid-table">
                  <div className="table-header">
                    <span>层级</span>
                    <span>限价</span>
                    <span>数量({tpBase})</span>
                    <span>预估{tpQuote}</span>
                  </div>
                  {tpTop3.map((x) => (
                    <div className="table-row" key={x.level}>
                      <span>第{x.level}层</span>
                      <span>{formatInt(x.price)}</span>
                      <span>{x.baseAmount.toFixed(6)}</span>
                      <span>{formatInt(x.baseAmount * x.price)}</span>
                    </div>
                  ))}
                </div>

                <div className="pyramid-summary" style={{ marginTop: 12 }}>
                  <p>
                    <strong>止盈详情预览：</strong> 上表为前 3 层；点击右上角“查看全部”可查看完整挂单明细。
                  </p>
                </div>
              </div>

              <div className="risk-row">
                <label className="risk-check">
                  <input type="checkbox" checked={tpRiskOk} onChange={(e) => setTpRiskOk(e.target.checked)} />
                  我已确认风险 / 我理解会下单
                </label>
              </div>

              <div className="action-buttons center">
                <button
                  className="btn btn-primary"
                  disabled={!tpRiskOk}
                  onClick={() => {
                    if (!tpRiskOk) return;
                    setTpPreviewConfig(tpConfig);
                    const bal = tpBase === 'BTC' ? btcBalance : tpBase === 'ETH' ? ethBalance : bnbBalance;
                    if (tpConfig.totalBase > bal) {
                      alert(`错误：卖出总数量超过${tpBase}余额。`);
                      return;
                    }
                    const low = Math.min(tpConfig.lowPrice, tpConfig.highPrice);
                    if (low <= currentTpPrice) {
                      alert(`错误：你设置的最低止盈价不高于现价（${formatInt(low)} ≤ ${formatInt(currentTpPrice)}），会导致限价卖单立刻成交。请把最低止盈价调高到当前价之上。`);
                      return;
                    }
                    setTpConfirmOpen(true);
                  }}
                >
                  执行策略并开始挂单
                </button>
              </div>

              <Modal
                title="确认提交限价卖单"
                open={tpConfirmOpen}
                onClose={() => setTpConfirmOpen(false)}
                footer={
                  <div className="modal-footer-actions">
                    <button className="btn btn-secondary" onClick={() => setTpConfirmOpen(false)}>
                      取消
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        if (!apiConfigured) {
                          alert('错误：API 未设置，无法下单。请先在运行 OpenClaw 的机器上配置 BINANCE_API_KEY / BINANCE_SECRET_KEY。');
                          return;
                        }
                        if (!tpIsValidToExecute) {
                          alert('错误：最低止盈价仍不高于现价，请修改后再提交。');
                          return;
                        }
                        try {
                          const symbol = `${tpBase}${tpQuote}`;
                          const orders = tpPlan.map((x) => ({
                            price: x.price,
                            quantity: x.baseAmount,
                          }));
                          const res = await fetch('/api/orders', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ symbol, side: 'SELL', orders }),
                          });
                          const data = await res.json();
                          if (!res.ok || !data.ok) {
                            throw new Error(data.error || '下单失败');
                          }
                          alert(`已提交：${data.results?.length || orders.length} 笔限价卖单`);
                          setTpConfirmOpen(false);
                        } catch (e: any) {
                          alert(`下单失败：${e?.message || '未知错误'}`);
                        }
                      }}
                    >
                      确认提交
                    </button>
                  </div>
                }
              >
                <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
                  你确认按照以下计划提交 <strong>{tpPlan.length}</strong> 笔 <strong>{tpBase}{tpQuote}</strong> <strong>限价卖单</strong> 吗？
                </div>
                <div className="pyramid-table">
                  <div className="table-header">
                    <span>层级</span>
                    <span>限价</span>
                    <span>数量({tpBase})</span>
                    <span>预估{tpQuote}</span>
                  </div>
                  {tpPlan.map((x) => (
                    <div className="table-row" key={x.level}>
                      <span>第{x.level}层</span>
                      <span>{formatInt(x.price)}</span>
                      <span>{x.baseAmount.toFixed(6)}</span>
                      <span>{formatInt(x.baseAmount * x.price)}</span>
                    </div>
                  ))}
                </div>
              </Modal>

              <Modal title="全部止盈细节" open={tpAllOpen} onClose={() => setTpAllOpen(false)}>
                <div className="pyramid-table">
                  <div className="table-header">
                    <span>层级</span>
                    <span>限价</span>
                    <span>数量({tpBase})</span>
                    <span>预估{tpQuote}</span>
                  </div>
                  {tpPlan.map((x) => (
                    <div className="table-row" key={x.level}>
                      <span>第{x.level}层</span>
                      <span>{formatInt(x.price)}</span>
                      <span>{x.baseAmount.toFixed(6)}</span>
                      <span>{formatInt(x.baseAmount * x.price)}</span>
                    </div>
                  ))}
                </div>
              </Modal>
            </div>
          )}
        </main>

        <footer className="system-status">
          <div className="status-item">
            <span>API状态:</span>
            {apiChecked ? (
              apiConfigured ? (
                <span style={{ color: '#34C759', fontWeight: 800 }}>已设置</span>
              ) : (
                <span style={{ color: '#FF3B30', fontWeight: 800 }}>未设置</span>
              )
            ) : (
              <span style={{ color: '#6b7280', fontWeight: 700 }}>检测中...</span>
            )}
          </div>
          <div className="status-item">
            <span>当前页面:</span>
            <span>
              {mode === 'pyramid-buy'
                ? `建仓 ${pbBase}${pbQuote}`
                : mode === 'pyramid-tp'
                  ? `止盈 ${tpBase}${tpQuote}`
                  : '恒定混合策略'}
            </span>
          </div>
          <div className="status-item">
            <span>挂单数量:</span>
            <span>
              {mode === 'pyramid-buy'
                ? `${pbPlan.length} 笔限价买单`
                : mode === 'pyramid-tp'
                  ? `${tpPlan.length} 笔限价卖单`
                  : '—'}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
