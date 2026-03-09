import React, { useState, useEffect } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePyramidStrategy } from '../hooks/usePyramidStrategy';

interface PyramidBuyConfig {
  baseAmount: number; // 基础买入金额 (FDUSD)
  scaleFactor: number; // 缩放因子 (1.5 = 每次增加50%)
  priceDropThreshold: number; // 价格下跌触发点 (0.05 = 5%)
  maxLevels: number; // 最大金字塔层数
  maxTotalAmount: number; // 最大总投入金额
}

const DEFAULT_CONFIG: PyramidBuyConfig = {
  baseAmount: 100,
  scaleFactor: 1.5,
  priceDropThreshold: 0.05,
  maxLevels: 6,
  maxTotalAmount: 5000,
};

interface PyramidLevel {
  level: number;
  triggerPrice: number;
  amount: number;
  executed: boolean;
  executedAt?: Date;
  executedPrice?: number;
  executedQuantity?: number;
}

const PyramidBuyPanel: React.FC = () => {
  const [config, setConfig] = useState<PyramidBuyConfig>(DEFAULT_CONFIG);
  const [isEnabled, setIsEnabled] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [basePrice, setBasePrice] = useState<number>(0);
  
  const { portfolio, loading: portfolioLoading, refreshPortfolio } = usePortfolio();
  const { 
    pyramidLevels,
    currentLevel,
    totalInvested,
    executeLevel,
    resetPyramid,
    loading: strategyLoading 
  } = usePyramidStrategy(config, basePrice);

  // 设置基准价格
  const handleSetBasePrice = () => {
    if (portfolio?.btcPrice) {
      setBasePrice(portfolio.btcPrice);
    }
  };

  // 计算预期金字塔结构
  const generatePyramidLevels = (): PyramidLevel[] => {
    if (!basePrice) return [];
    
    const levels: PyramidLevel[] = [];
    let currentAmount = config.baseAmount;
    
    for (let i = 0; i < config.maxLevels; i++) {
      const level = i + 1;
      const priceDropRatio = config.priceDropThreshold * level;
      const triggerPrice = basePrice * (1 - priceDropRatio);
      
      levels.push({
        level,
        triggerPrice,
        amount: currentAmount,
        executed: false,
      });
      
      currentAmount *= config.scaleFactor;
    }
    
    return levels;
  };

  const plannedLevels = generatePyramidLevels();
  const totalPlannedAmount = plannedLevels.reduce((sum, level) => sum + level.amount, 0);

  // 执行单个层级
  const handleExecuteLevel = async (level: number) => {
    const result = await executeLevel(level, dryRun);
    if (result.success) {
      await refreshPortfolio();
    }
  };

  // 重置金字塔
  const handleReset = () => {
    resetPyramid();
    setBasePrice(0);
  };

  return (
    <div className="pyramid-buy-panel">
      <div className="panel-header">
        <h2>金字塔建仓策略</h2>
        <p>价格下跌时分层买入，越跌越买，降低平均成本</p>
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
              <span>已投入:</span>
              <span>{totalInvested.toFixed(2)} FDUSD</span>
            </div>
            <div className="status-item">
              <span>可用余额:</span>
              <span>{portfolio.fdusdBalance.toFixed(2)} FDUSD</span>
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
            重置金字塔
          </button>
        </div>
      </div>

      {/* 策略配置 */}
      <div className="config-section">
        <h3>策略配置</h3>
        <div className="config-grid">
          <div className="config-item">
            <label>基础金额 (FDUSD):</label>
            <input
              type="number"
              value={config.baseAmount}
              onChange={(e) => setConfig({
                ...config,
                baseAmount: Number(e.target.value)
              })}
              min="10"
              max="1000"
              step="10"
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
              min="1.1"
              max="3.0"
              step="0.1"
            />
          </div>
          <div className="config-item">
            <label>下跌阈值 (%):</label>
            <input
              type="number"
              value={config.priceDropThreshold * 100}
              onChange={(e) => setConfig({
                ...config,
                priceDropThreshold: Number(e.target.value) / 100
              })}
              min="1"
              max="10"
              step="0.5"
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
              max="10"
              step="1"
            />
          </div>
        </div>
      </div>

      {/* 金字塔结构预览 */}
      <div className="pyramid-preview">
        <h3>金字塔结构预览</h3>
        {plannedLevels.length > 0 ? (
          <div>
            <div className="pyramid-summary">
              <p>总计划投入: <strong>{totalPlannedAmount.toFixed(2)} FDUSD</strong></p>
              <p>层级间隔: <strong>{(config.priceDropThreshold * 100).toFixed(1)}%</strong></p>
            </div>
            <div className="pyramid-table">
              <div className="table-header">
                <span>层级</span>
                <span>触发价格</span>
                <span>投入金额</span>
                <span>累计下跌</span>
                <span>状态</span>
                <span>操作</span>
              </div>
              {plannedLevels.map((level) => {
                const dropPercent = ((basePrice - level.triggerPrice) / basePrice * 100);
                const isTriggered = portfolio?.btcPrice ? portfolio.btcPrice <= level.triggerPrice : false;
                const executed = pyramidLevels.find(p => p.level === level.level)?.executed;
                
                return (
                  <div key={level.level} className={`table-row ${executed ? 'executed' : isTriggered ? 'triggered' : ''}`}>
                    <span>第{level.level}层</span>
                    <span>{level.triggerPrice.toFixed(2)}</span>
                    <span>{level.amount.toFixed(0)} FDUSD</span>
                    <span>{dropPercent.toFixed(1)}%</span>
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
      {pyramidLevels.filter(l => l.executed).length > 0 && (
        <div className="execution-history">
          <h3>执行历史</h3>
          <div className="history-table">
            {pyramidLevels
              .filter(level => level.executed)
              .map((level) => (
                <div key={level.level} className="history-row">
                  <span>第{level.level}层</span>
                  <span>{level.executedAt?.toLocaleString()}</span>
                  <span>{level.executedPrice?.toFixed(2)} FDUSD</span>
                  <span>{level.executedQuantity?.toFixed(8)} BTC</span>
                  <span>{level.amount.toFixed(2)} FDUSD</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PyramidBuyPanel;