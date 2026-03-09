import React, { useState, useEffect } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePyramidTakeProfit } from '../hooks/usePyramidTakeProfit';

interface PyramidTpConfig {
  basePercentage: number; // 基础卖出比例 (0.2 = 20%)
  scaleFactor: number; // 缩放因子 (1.5 = 每次增加50%)
  priceRiseThreshold: number; // 价格上涨触发点 (0.1 = 10%)
  maxLevels: number; // 最大止盈层数
  minHoldAmount: number; // 最小保留BTC数量
}

const DEFAULT_CONFIG: PyramidTpConfig = {
  basePercentage: 0.2,
  scaleFactor: 1.2,
  priceRiseThreshold: 0.1,
  maxLevels: 5,
  minHoldAmount: 0.001,
};

interface TakeProfitLevel {
  level: number;
  triggerPrice: number;
  sellPercentage: number;
  sellAmount: number; // BTC数量
  executed: boolean;
  executedAt?: Date;
  executedPrice?: number;
  executedQuantity?: number;
}

const PyramidTpPanel: React.FC = () => {
  const [config, setConfig] = useState<PyramidTpConfig>(DEFAULT_CONFIG);
  const [isEnabled, setIsEnabled] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [basePrice, setBasePrice] = useState<number>(0);
  
  const { portfolio, loading: portfolioLoading, refreshPortfolio } = usePortfolio();
  const { 
    takeProfitLevels,
    currentLevel,
    totalSold,
    remainingBtc,
    executeLevel,
    resetTakeProfit,
    loading: strategyLoading 
  } = usePyramidTakeProfit(config, basePrice);

  // 设置基准价格
  const handleSetBasePrice = () => {
    if (portfolio?.btcPrice) {
      setBasePrice(portfolio.btcPrice);
    }
  };

  // 计算预期止盈结构
  const generateTakeProfitLevels = (): TakeProfitLevel[] => {
    if (!basePrice || !portfolio?.btcBalance) return [];
    
    const levels: TakeProfitLevel[] = [];
    let remainingBtc = portfolio.btcBalance;
    
    for (let i = 0; i < config.maxLevels; i++) {
      const level = i + 1;
      const priceRiseRatio = config.priceRiseThreshold * level;
      const triggerPrice = basePrice * (1 + priceRiseRatio);
      
      // 计算卖出比例和数量
      const sellPercentage = config.basePercentage * Math.pow(config.scaleFactor, i);
      const maxSellable = remainingBtc - config.minHoldAmount;
      const sellAmount = Math.min(maxSellable * sellPercentage, maxSellable);
      
      if (sellAmount <= 0) break;
      
      levels.push({
        level,
        triggerPrice,
        sellPercentage: sellPercentage * 100,
        sellAmount,
        executed: false,
      });
      
      remainingBtc -= sellAmount;
    }
    
    return levels;
  };

  const plannedLevels = generateTakeProfitLevels();
  const totalPlannedSell = plannedLevels.reduce((sum, level) => sum + level.sellAmount, 0);

  // 执行单个层级
  const handleExecuteLevel = async (level: number) => {
    const result = await executeLevel(level, dryRun);
    if (result.success) {
      await refreshPortfolio();
    }
  };

  // 重置止盈
  const handleReset = () => {
    resetTakeProfit();
    setBasePrice(0);
  };

  // 计算预期收益
  const calculateExpectedProfit = () => {
    if (!basePrice || plannedLevels.length === 0) return 0;
    
    return plannedLevels.reduce((profit, level) => {
      const saleValue = level.sellAmount * level.triggerPrice;
      const originalCost = level.sellAmount * basePrice;
      return profit + (saleValue - originalCost);
    }, 0);
  };

  const expectedProfit = calculateExpectedProfit();

  return (
    <div className="pyramid-tp-panel">
      <div className="panel-header">
        <h2>金字塔止盈策略</h2>
        <p>价格上涨时分层卖出，越涨卖越多，锁定收益</p>
      </div>

      {/* 当前状态 */}
      <div className="status-section">
        <h3>当前状态</h3>
        {portfolioLoading ? (
          <div className="loading">加载中...</div>
        ) : portfolio ? (
          <div className="status-grid">
            <div className="status-item">
              <span>当前BTC价格:</span>
              <span>{portfolio.btcPrice?.toFixed(2)} FDUSD</span>
            </div>
            <div className="status-item">
              <span>基准价格:</span>
              <span className={basePrice ? 'set' : 'unset'}>
                {basePrice ? basePrice.toFixed(2) : '未设置'} FDUSD
              </span>
            </div>
            <div className="status-item">
              <span>当前层级:</span>
              <span>{currentLevel || '未激活'}</span>
            </div>
            <div className="status-item">
              <span>已卖出:</span>
              <span>{totalSold.toFixed(8)} BTC</span>
            </div>
            <div className="status-item">
              <span>BTC余额:</span>
              <span>{portfolio.btcBalance.toFixed(8)} BTC</span>
            </div>
            <div className="status-item">
              <span>预期利润:</span>
              <span className="profit">{expectedProfit.toFixed(2)} FDUSD</span>
            </div>
          </div>
        ) : (
          <div className="error">无法获取投资组合数据</div>
        )}
      </div>

      {/* 基准价格设置 */}
      <div className="base-price-section">
        <h3>基准价格设置</h3>
        <div className="base-price-controls">
          <input
            type="number"
            value={basePrice || ''}
            onChange={(e) => setBasePrice(Number(e.target.value))}
            placeholder="设置基准价格"
            step="0.01"
          />
          <button onClick={handleSetBasePrice}>
            使用当前价格
          </button>
          <button onClick={handleReset} className="danger">
            重置止盈
          </button>
        </div>
      </div>

      {/* 策略配置 */}
      <div className="config-section">
        <h3>策略配置</h3>
        <div className="config-grid">
          <div className="config-item">
            <label>基础卖出比例 (%):</label>
            <input
              type="number"
              value={config.basePercentage * 100}
              onChange={(e) => setConfig({
                ...config,
                basePercentage: Number(e.target.value) / 100
              })}
              min="5"
              max="50"
              step="5"
            />
          </div>
          <div className="config-item">
            <label>缩放因子:</label>
            <input
              type="number"
              value={config.scaleFactor}
              onChange={(e) => setConfig({
                ...config,
                scaleFactor: Number(e.target.value)
              })}
              min="1.0"
              max="2.0"
              step="0.1"
            />
          </div>
          <div className="config-item">
            <label>上涨阈值 (%):</label>
            <input
              type="number"
              value={config.priceRiseThreshold * 100}
              onChange={(e) => setConfig({
                ...config,
                priceRiseThreshold: Number(e.target.value) / 100
              })}
              min="5"
              max="20"
              step="1"
            />
          </div>
          <div className="config-item">
            <label>最大层数:</label>
            <input
              type="number"
              value={config.maxLevels}
              onChange={(e) => setConfig({
                ...config,
                maxLevels: Number(e.target.value)
              })}
              min="2"
              max="8"
              step="1"
            />
          </div>
          <div className="config-item">
            <label>最小保留BTC:</label>
            <input
              type="number"
              value={config.minHoldAmount}
              onChange={(e) => setConfig({
                ...config,
                minHoldAmount: Number(e.target.value)
              })}
              min="0.001"
              max="0.1"
              step="0.001"
            />
          </div>
        </div>
      </div>

      {/* 止盈结构预览 */}
      <div className="takeprofit-preview">
        <h3>止盈结构预览</h3>
        {plannedLevels.length > 0 ? (
          <div>
            <div className="takeprofit-summary">
              <p>计划卖出: <strong>{totalPlannedSell.toFixed(8)} BTC</strong></p>
              <p>预期利润: <strong>{expectedProfit.toFixed(2)} FDUSD</strong></p>
              <p>保留数量: <strong>{(portfolio?.btcBalance || 0 - totalPlannedSell).toFixed(8)} BTC</strong></p>
            </div>
            <div className="takeprofit-table">
              <div className="table-header">
                <span>层级</span>
                <span>触发价格</span>
                <span>卖出比例</span>
                <span>卖出数量</span>
                <span>累计上涨</span>
                <span>预期收益</span>
                <span>状态</span>
                <span>操作</span>
              </div>
              {plannedLevels.map((level) => {
                const risePercent = ((level.triggerPrice - basePrice) / basePrice * 100);
                const levelProfit = (level.triggerPrice - basePrice) * level.sellAmount;
                const isTriggered = portfolio?.btcPrice ? portfolio.btcPrice >= level.triggerPrice : false;
                const executed = takeProfitLevels.find(p => p.level === level.level)?.executed;
                
                return (
                  <div key={level.level} className={`table-row ${executed ? 'executed' : isTriggered ? 'triggered' : ''}`}>
                    <span>第{level.level}层</span>
                    <span>{level.triggerPrice.toFixed(2)}</span>
                    <span>{level.sellPercentage.toFixed(1)}%</span>
                    <span>{level.sellAmount.toFixed(8)}</span>
                    <span>+{risePercent.toFixed(1)}%</span>
                    <span>+{levelProfit.toFixed(2)}</span>
                    <span>
                      {executed ? '已执行' : isTriggered ? '可执行' : '等待'}
                    </span>
                    <span>
                      {isTriggered && !executed && (
                        <button
                          onClick={() => handleExecuteLevel(level.level)}
                          disabled={strategyLoading}
                          className="execute-btn"
                        >
                          执行
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p>请先设置基准价格</p>
        )}
      </div>

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
                disabled={!basePrice}
              />
              启用自动执行
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
        </div>
      </div>

      {/* 执行历史 */}
      {takeProfitLevels.filter(l => l.executed).length > 0 && (
        <div className="execution-history">
          <h3>执行历史</h3>
          <div className="history-table">
            <div className="table-header">
              <span>层级</span>
              <span>执行时间</span>
              <span>执行价格</span>
              <span>卖出数量</span>
              <span>收益</span>
            </div>
            {takeProfitLevels
              .filter(level => level.executed)
              .map((level) => {
                const profit = level.executedPrice ? 
                  (level.executedPrice - basePrice) * (level.executedQuantity || 0) : 0;
                
                return (
                  <div key={level.level} className="history-row">
                    <span>第{level.level}层</span>
                    <span>{level.executedAt?.toLocaleString()}</span>
                    <span>{level.executedPrice?.toFixed(2)} FDUSD</span>
                    <span>{level.executedQuantity?.toFixed(8)} BTC</span>
                    <span className="profit">+{profit.toFixed(2)} FDUSD</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PyramidTpPanel;