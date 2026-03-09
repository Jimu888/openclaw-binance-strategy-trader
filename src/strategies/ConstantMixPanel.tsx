import React, { useState, useEffect } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { useRebalancer } from '../hooks/useRebalancer';

interface ConstantMixConfig {
  targetBtcRatio: number; // 目标BTC比例 (0.5 = 50%)
  rebalanceThreshold: number; // 再平衡阈值 (0.05 = 5%)
  maxTradeAmount: number; // 最大单次交易金额 (FDUSD)
  minTradeAmount: number; // 最小单次交易金额 (FDUSD)
  cooldownHours: number; // 交易冷却时间 (小时)
}

const DEFAULT_CONFIG: ConstantMixConfig = {
  targetBtcRatio: 0.5,
  rebalanceThreshold: 0.05,
  maxTradeAmount: 1000,
  minTradeAmount: 10,
  cooldownHours: 1,
};

const ConstantMixPanel: React.FC = () => {
  const [config, setConfig] = useState<ConstantMixConfig>(DEFAULT_CONFIG);
  const [isEnabled, setIsEnabled] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  
  const { portfolio, loading: portfolioLoading, refreshPortfolio } = usePortfolio();
  const { 
    executeRebalance, 
    loading: rebalanceLoading, 
    lastExecution,
    estimatedTrade 
  } = useRebalancer();

  // 计算当前偏差
  const currentDeviation = portfolio ? 
    Math.abs(portfolio.btcRatio - config.targetBtcRatio) : 0;
  
  const needsRebalance = currentDeviation > config.rebalanceThreshold;

  // 执行再平衡
  const handleRebalance = async () => {
    if (!portfolio) return;
    
    const result = await executeRebalance({
      strategy: 'constant-mix',
      config,
      dryRun
    });
    
    if (result.success) {
      await refreshPortfolio();
    }
  };

  return (
    <div className="constant-mix-panel">
      <div className="panel-header">
        <h2>恒定比例再平衡策略</h2>
        <p>维持BTC和FDUSD的固定比例，当偏差超过阈值时自动调整</p>
      </div>

      {/* 投资组合状态 */}
      <div className="portfolio-section">
        <h3>当前投资组合</h3>
        {portfolioLoading ? (
          <div className="loading">加载中...</div>
        ) : portfolio ? (
          <div className="portfolio-grid">
            <div className="portfolio-item">
              <span>BTC余额:</span>
              <span>{portfolio.btcBalance.toFixed(8)} BTC</span>
            </div>
            <div className="portfolio-item">
              <span>FDUSD余额:</span>
              <span>{portfolio.fdusdBalance.toFixed(2)} FDUSD</span>
            </div>
            <div className="portfolio-item">
              <span>BTC比例:</span>
              <span className={needsRebalance ? 'warning' : 'normal'}>
                {(portfolio.btcRatio * 100).toFixed(2)}%
              </span>
            </div>
            <div className="portfolio-item">
              <span>总价值:</span>
              <span>{portfolio.totalValue.toFixed(2)} FDUSD</span>
            </div>
            <div className="portfolio-item">
              <span>偏差:</span>
              <span className={needsRebalance ? 'warning' : 'normal'}>
                {(currentDeviation * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="error">无法获取投资组合数据</div>
        )}
      </div>

      {/* 策略配置 */}
      <div className="config-section">
        <h3>策略配置</h3>
        <div className="config-grid">
          <div className="config-item">
            <label>目标BTC比例 (%):</label>
            <input
              type="number"
              value={config.targetBtcRatio * 100}
              onChange={(e) => setConfig({
                ...config,
                targetBtcRatio: Number(e.target.value) / 100
              })}
              min="10"
              max="90"
              step="5"
            />
          </div>
          <div className="config-item">
            <label>再平衡阈值 (%):</label>
            <input
              type="number"
              value={config.rebalanceThreshold * 100}
              onChange={(e) => setConfig({
                ...config,
                rebalanceThreshold: Number(e.target.value) / 100
              })}
              min="1"
              max="20"
              step="1"
            />
          </div>
          <div className="config-item">
            <label>最大交易金额 (FDUSD):</label>
            <input
              type="number"
              value={config.maxTradeAmount}
              onChange={(e) => setConfig({
                ...config,
                maxTradeAmount: Number(e.target.value)
              })}
              min="100"
              max="10000"
              step="100"
            />
          </div>
          <div className="config-item">
            <label>冷却时间 (小时):</label>
            <input
              type="number"
              value={config.cooldownHours}
              onChange={(e) => setConfig({
                ...config,
                cooldownHours: Number(e.target.value)
              })}
              min="0.5"
              max="24"
              step="0.5"
            />
          </div>
        </div>
      </div>

      {/* 交易预估 */}
      {needsRebalance && estimatedTrade && (
        <div className="estimated-trade">
          <h3>预估交易</h3>
          <div className="trade-info">
            <p>
              <strong>{estimatedTrade.side === 'BUY' ? '买入' : '卖出'}</strong> 
              {estimatedTrade.quantity.toFixed(8)} BTC
            </p>
            <p>预估价格: {estimatedTrade.estimatedPrice.toFixed(2)} FDUSD</p>
            <p>交易金额: {estimatedTrade.estimatedAmount.toFixed(2)} FDUSD</p>
          </div>
        </div>
      )}

      {/* 控制面板 */}
      <div className="control-section">
        <div className="control-row">
          <div className="toggle-group">
            <label>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
              模拟模式 (不实际交易)
            </label>
            <label>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
              />
              启用自动再平衡
            </label>
          </div>
        </div>
        
        <div className="action-buttons">
          <button 
            onClick={refreshPortfolio}
            disabled={portfolioLoading}
          >
            刷新数据
          </button>
          <button 
            onClick={handleRebalance}
            disabled={rebalanceLoading || !needsRebalance}
            className={needsRebalance ? 'primary' : 'disabled'}
          >
            {rebalanceLoading ? '执行中...' : '立即再平衡'}
          </button>
        </div>
      </div>

      {/* 最近执行记录 */}
      {lastExecution && (
        <div className="execution-history">
          <h3>最近执行</h3>
          <div className="execution-info">
            <p>时间: {new Date(lastExecution.timestamp).toLocaleString()}</p>
            <p>结果: {lastExecution.success ? '成功' : '失败'}</p>
            {lastExecution.trade && (
              <>
                <p>操作: {lastExecution.trade.side} {lastExecution.trade.quantity} BTC</p>
                <p>价格: {lastExecution.trade.price} FDUSD</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConstantMixPanel;