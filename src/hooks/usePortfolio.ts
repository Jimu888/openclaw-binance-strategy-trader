import { useState, useEffect, useCallback } from 'react';
import { binanceService } from '../services/binanceService';

export interface Portfolio {
  btcBalance: number;
  fdusdBalance: number;
  btcPrice: number;
  btcValue: number;
  totalValue: number;
  btcRatio: number;
  lastUpdated: Date;
}

export const usePortfolio = () => {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 获取账户余额
      const balances = await binanceService.getAccountBalances();
      const btcBalance = balances.find(b => b.asset === 'BTC')?.free || 0;
      const fdusdBalance = balances.find(b => b.asset === 'FDUSD')?.free || 0;
      
      // 获取BTC价格
      const ticker = await binanceService.getTicker('BTCFDUSD');
      const btcPrice = parseFloat(ticker.price);
      
      // 计算投资组合数据
      const btcValue = btcBalance * btcPrice;
      const totalValue = btcValue + fdusdBalance;
      const btcRatio = totalValue > 0 ? btcValue / totalValue : 0;
      
      const portfolioData: Portfolio = {
        btcBalance,
        fdusdBalance,
        btcPrice,
        btcValue,
        totalValue,
        btcRatio,
        lastUpdated: new Date(),
      };
      
      setPortfolio(portfolioData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取投资组合数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPortfolio = useCallback(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  // 初始加载
  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  // 自动刷新 (每30秒)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchPortfolio();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchPortfolio, loading]);

  return {
    portfolio,
    loading,
    error,
    refreshPortfolio,
  };
};