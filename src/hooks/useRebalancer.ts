import { useState, useCallback } from 'react';
import { binanceService } from '../services/binanceService';

export interface RebalanceConfig {
  strategy: 'constant-mix' | 'pyramid-buy' | 'pyramid-tp';
  config: any;
  dryRun: boolean;
}

export interface EstimatedTrade {
  side: 'BUY' | 'SELL';
  quantity: number;
  estimatedPrice: number;
  estimatedAmount: number;
}

export interface ExecutionResult {
  success: boolean;
  message: string;
  trade?: {
    side: string;
    quantity: number;
    price: number;
    orderId?: string;
  };
  timestamp: string;
}

export const useRebalancer = () => {
  const [loading, setLoading] = useState(false);
  const [lastExecution, setLastExecution] = useState<ExecutionResult | null>(null);
  const [estimatedTrade, setEstimatedTrade] = useState<EstimatedTrade | null>(null);

  const calculateRebalanceTrade = useCallback(async (
    currentBtcRatio: number,
    targetBtcRatio: number,
    totalValue: number,
    btcPrice: number
  ): Promise<EstimatedTrade | null> => {
    const deviation = currentBtcRatio - targetBtcRatio;
    
    if (Math.abs(deviation) < 0.01) {
      return null; // 偏差太小，不需要交易
    }
    
    const targetRebalanceValue = Math.abs(deviation) * totalValue;
    const side = deviation > 0 ? 'SELL' : 'BUY';
    const quantity = targetRebalanceValue / btcPrice;
    
    return {
      side,
      quantity,
      estimatedPrice: btcPrice,
      estimatedAmount: targetRebalanceValue,
    };
  }, []);

  const executeRebalance = useCallback(async (params: RebalanceConfig): Promise<ExecutionResult> => {
    setLoading(true);
    
    try {
      // 这里实现具体的再平衡逻辑
      if (params.strategy === 'constant-mix') {
        return await executeConstantMixRebalance(params);
      }
      
      throw new Error(`不支持的策略: ${params.strategy}`);
    } catch (error) {
      const result: ExecutionResult = {
        success: false,
        message: error instanceof Error ? error.message : '执行失败',
        timestamp: new Date().toISOString(),
      };
      setLastExecution(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const executeConstantMixRebalance = async (params: RebalanceConfig): Promise<ExecutionResult> => {
    const { config, dryRun } = params;
    
    try {
      // 获取当前余额和价格
      const balances = await binanceService.getAccountBalances();
      const btcBalance = balances.find(b => b.asset === 'BTC')?.free || 0;
      const fdusdBalance = balances.find(b => b.asset === 'FDUSD')?.free || 0;
      
      const ticker = await binanceService.getTicker('BTCFDUSD');
      const btcPrice = parseFloat(ticker.price);
      
      // 计算投资组合
      const btcValue = btcBalance * btcPrice;
      const totalValue = btcValue + fdusdBalance;
      const currentBtcRatio = totalValue > 0 ? btcValue / totalValue : 0;
      
      // 计算需要的交易
      const estimatedTrade = await calculateRebalanceTrade(
        currentBtcRatio,
        config.targetBtcRatio,
        totalValue,
        btcPrice
      );
      
      if (!estimatedTrade) {
        const result: ExecutionResult = {
          success: true,
          message: '投资组合已平衡，无需交易',
          timestamp: new Date().toISOString(),
        };
        setLastExecution(result);
        return result;
      }
      
      setEstimatedTrade(estimatedTrade);
      
      if (dryRun) {
        const result: ExecutionResult = {
          success: true,
          message: `模拟模式: ${estimatedTrade.side} ${estimatedTrade.quantity.toFixed(8)} BTC`,
          trade: {
            side: estimatedTrade.side,
            quantity: estimatedTrade.quantity,
            price: estimatedTrade.estimatedPrice,
          },
          timestamp: new Date().toISOString(),
        };
        setLastExecution(result);
        return result;
      }
      
      // 执行实际交易
      const orderResult = await binanceService.placeOrder({
        symbol: 'BTCFDUSD',
        side: estimatedTrade.side,
        type: 'MARKET',
        quantity: estimatedTrade.quantity,
      });
      
      const result: ExecutionResult = {
        success: true,
        message: `交易成功: ${orderResult.side} ${orderResult.executedQty} BTC`,
        trade: {
          side: orderResult.side,
          quantity: parseFloat(orderResult.executedQty),
          price: parseFloat(orderResult.fills[0]?.price || '0'),
          orderId: orderResult.orderId.toString(),
        },
        timestamp: new Date().toISOString(),
      };
      
      setLastExecution(result);
      return result;
      
    } catch (error) {
      throw new Error(`再平衡执行失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return {
    executeRebalance,
    loading,
    lastExecution,
    estimatedTrade,
    calculateRebalanceTrade,
  };
};