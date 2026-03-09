import { useState, useEffect, useCallback } from 'react';
import { binanceService } from '../services/binanceService';

interface PyramidTpConfig {
  basePercentage: number;
  scaleFactor: number;
  priceRiseThreshold: number;
  maxLevels: number;
  minHoldAmount: number;
}

interface TakeProfitLevel {
  level: number;
  triggerPrice: number;
  sellPercentage: number;
  sellAmount: number;
  executed: boolean;
  executedAt?: Date;
  executedPrice?: number;
  executedQuantity?: number;
}

interface ExecutionResult {
  success: boolean;
  message: string;
  trade?: {
    quantity: number;
    price: number;
    orderId?: string;
  };
}

export const usePyramidTakeProfit = (config: PyramidTpConfig, basePrice: number) => {
  const [takeProfitLevels, setTakeProfitLevels] = useState<TakeProfitLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [totalSold, setTotalSold] = useState<number>(0);
  const [remainingBtc, setRemainingBtc] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // 初始化止盈层级
  const initializeTakeProfit = useCallback(async () => {
    if (!basePrice) return;
    
    try {
      // 获取当前BTC余额
      const balances = await binanceService.getAccountBalances();
      const btcBalance = balances.find(b => b.asset === 'BTC')?.free || 0;
      
      if (btcBalance <= config.minHoldAmount) {
        setTakeProfitLevels([]);
        return;
      }
      
      const levels: TakeProfitLevel[] = [];
      let availableForSale = btcBalance;
      
      for (let i = 0; i < config.maxLevels; i++) {
        const level = i + 1;
        const priceRiseRatio = config.priceRiseThreshold * level;
        const triggerPrice = basePrice * (1 + priceRiseRatio);
        
        // 计算卖出比例和数量
        const sellPercentage = config.basePercentage * Math.pow(config.scaleFactor, i);
        const maxSellable = availableForSale - config.minHoldAmount;
        
        if (maxSellable <= 0) break;
        
        const sellAmount = Math.min(maxSellable * sellPercentage, maxSellable);
        
        if (sellAmount <= 0) break;
        
        levels.push({
          level,
          triggerPrice,
          sellPercentage: sellPercentage * 100,
          sellAmount,
          executed: false,
        });
        
        availableForSale -= sellAmount;
      }
      
      setTakeProfitLevels(levels);
      setRemainingBtc(availableForSale);
      setCurrentLevel(null);
      setTotalSold(0);
    } catch (error) {
      console.error('初始化止盈层级失败:', error);
    }
  }, [config, basePrice]);

  // 检查触发条件
  const checkTriggers = useCallback(async () => {
    if (!basePrice || takeProfitLevels.length === 0) return;
    
    try {
      const ticker = await binanceService.getTicker('BTCFDUSD');
      const currentPrice = parseFloat(ticker.price);
      
      // 找到当前应该触发的层级（从低到高按顺序执行）
      const triggeredLevel = takeProfitLevels.find(level => 
        !level.executed && currentPrice >= level.triggerPrice
      );
      
      if (triggeredLevel) {
        setCurrentLevel(triggeredLevel.level);
      }
    } catch (error) {
      console.error('检查触发条件失败:', error);
    }
  }, [basePrice, takeProfitLevels]);

  // 执行特定层级
  const executeLevel = useCallback(async (level: number, dryRun: boolean = true): Promise<ExecutionResult> => {
    setLoading(true);
    
    try {
      const targetLevel = takeProfitLevels.find(l => l.level === level);
      if (!targetLevel || targetLevel.executed) {
        throw new Error('层级无效或已执行');
      }
      
      const ticker = await binanceService.getTicker('BTCFDUSD');
      const currentPrice = parseFloat(ticker.price);
      
      if (currentPrice < targetLevel.triggerPrice) {
        throw new Error('价格未达到触发条件');
      }
      
      // 检查当前BTC余额是否足够
      const balances = await binanceService.getAccountBalances();
      const currentBtcBalance = balances.find(b => b.asset === 'BTC')?.free || 0;
      
      if (currentBtcBalance < targetLevel.sellAmount) {
        throw new Error('BTC余额不足');
      }
      
      if (dryRun) {
        // 模拟执行
        const updatedLevels = takeProfitLevels.map(l => 
          l.level === level ? {
            ...l,
            executed: true,
            executedAt: new Date(),
            executedPrice: currentPrice,
            executedQuantity: targetLevel.sellAmount,
          } : l
        );
        
        setTakeProfitLevels(updatedLevels);
        setTotalSold(prev => prev + targetLevel.sellAmount);
        setRemainingBtc(prev => prev - targetLevel.sellAmount);
        
        return {
          success: true,
          message: `模拟执行成功: 第${level}层`,
          trade: {
            quantity: targetLevel.sellAmount,
            price: currentPrice,
          },
        };
      }
      
      // 实际交易
      const orderResult = await binanceService.placeOrder({
        symbol: 'BTCFDUSD',
        side: 'SELL',
        type: 'MARKET',
        quantity: targetLevel.sellAmount,
      });
      
      const executedQuantity = parseFloat(orderResult.executedQty);
      const executedPrice = parseFloat(orderResult.fills[0]?.price || currentPrice.toString());
      
      // 更新层级状态
      const updatedLevels = takeProfitLevels.map(l => 
        l.level === level ? {
          ...l,
          executed: true,
          executedAt: new Date(),
          executedPrice,
          executedQuantity,
        } : l
      );
      
      setTakeProfitLevels(updatedLevels);
      setTotalSold(prev => prev + executedQuantity);
      setRemainingBtc(prev => prev - executedQuantity);
      
      return {
        success: true,
        message: `执行成功: 第${level}层`,
        trade: {
          quantity: executedQuantity,
          price: executedPrice,
          orderId: orderResult.orderId.toString(),
        },
      };
      
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '执行失败',
      };
    } finally {
      setLoading(false);
    }
  }, [takeProfitLevels]);

  // 重置止盈
  const resetTakeProfit = useCallback(() => {
    setTakeProfitLevels([]);
    setCurrentLevel(null);
    setTotalSold(0);
    setRemainingBtc(0);
  }, []);

  // 初始化和配置变化时重新计算
  useEffect(() => {
    initializeTakeProfit();
  }, [initializeTakeProfit]);

  // 定期检查触发条件
  useEffect(() => {
    const interval = setInterval(() => {
      checkTriggers();
    }, 10000); // 每10秒检查一次
    
    return () => clearInterval(interval);
  }, [checkTriggers]);

  return {
    takeProfitLevels,
    currentLevel,
    totalSold,
    remainingBtc,
    executeLevel,
    resetTakeProfit,
    loading,
  };
};