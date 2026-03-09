import React, { useState } from 'react';
import ConstantMixPanel from '../strategies/ConstantMixPanel';
import PyramidBuyPanel from '../strategies/PyramidBuyPanel';
import PyramidTpPanel from '../strategies/PyramidTpPanel';

type StrategyMode = 'constant-mix' | 'pyramid-buy' | 'pyramid-tp';

interface DashboardProps {
  defaultMode?: StrategyMode;
}

const Dashboard: React.FC<DashboardProps> = ({ defaultMode = 'constant-mix' }) => {
  const [mode, setMode] = useState<StrategyMode>(defaultMode);

  // 天然满足"页面只显示一个策略"，不会出现JSX嵌套地狱
  const renderPanel = () => {
    switch (mode) {
      case 'constant-mix':
        return <ConstantMixPanel />;
      case 'pyramid-buy':
        return <PyramidBuyPanel />;
      case 'pyramid-tp':
        return <PyramidTpPanel />;
      default:
        return <ConstantMixPanel />;
    }
  };

  return (
    <div className="dashboard">
      {/* 顶部导航 */}
      <nav className="strategy-nav">
        <h1>BTC/FDUSD 再平衡系统</h1>
        <div className="nav-buttons">
          <button
            className={mode === 'constant-mix' ? 'active' : ''}
            onClick={() => setMode('constant-mix')}
          >
            恒定比例
          </button>
          <button
            className={mode === 'pyramid-buy' ? 'active' : ''}
            onClick={() => setMode('pyramid-buy')}
          >
            金字塔建仓
          </button>
          <button
            className={mode === 'pyramid-tp' ? 'active' : ''}
            onClick={() => setMode('pyramid-tp')}
          >
            金字塔止盈
          </button>
        </div>
      </nav>

      {/* 当前策略面板 */}
      <main className="strategy-panel">
        {renderPanel()}
      </main>
    </div>
  );
};

export default Dashboard;