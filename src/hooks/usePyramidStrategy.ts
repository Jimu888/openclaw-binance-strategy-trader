import { useState, useEffect, useCallback } from 'react';
import { binanceService } from '../services/binanceService';

interface PyramidBuyConfig {
  baseAmount: number;
  scaleFactor: number;
  priceDropThreshold: number;
  maxLevels: number;
  maxTotalAmount: number;
}

interface PyramidLevel {
  level: number;
  triggerPrice: number;
  amount: number;
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

export const usePyramidStrategy = (config: PyramidBuyConfig, basePrice: number) => {
  const [pyramidLevels, setPyramidLevels] = useState<PyramidLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [totalInvested, setTotalInvested] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // 初始化金字塔层级
  const initializePyramid = useCallback(() => {
    if (!basePrice) return;
    
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
    
    setPyramidLevels(levels);
    setCurrentLevel(null);
    setTotalInvested(0);
  }, [config, basePrice]);

  // 检查触发条件
  const checkTriggers = useCallback(async () => {
    if (!basePrice || pyramidLevels.length === 0) return;
    
    try {
      const ticker = await binanceService.getTicker('BTCFDUSD');
      const currentPrice = parseFloat(ticker.price);
      
      // 找到当前应该触发的层级
      const triggeredLevel = pyramidLevels.find(level => 
        !level.executed && currentPrice <= level.triggerPrice
      );
      
      if (triggeredLevel) {
        setCurrentLevel(triggeredLevel.level);
      }
    } catch (error) {
      console.error('检查触发条件失败:', error);
    }
  }, [basePrice, pyramidLevels]);

  // 执行特定层级
  const executeLevel = useCallback(async (level: number, dryRun: boolean = true): Promise<ExecutionResult> => {
    setLoading(true);
    
    try {
      const targetLevel = pyramidLevels.find(l => l.level === level);
      if (!targetLevel || targetLevel.executed) {
        throw new Error('层级无效或已执行');
      }
      
      const ticker = await binanceService.getTicker('BTCFDUSD');
      const currentPrice = parseFloat(ticker.price);
      
      if (currentPrice > targetLevel.triggerPrice) {
        throw new Error('价格未达到触发条件');
      }
      
      const quantity = targetLevel.amount / currentPrice;
      
      if (dryRun) {
        // 模拟执行
        const updatedLevels = pyramidLevels.map(l => 
          l.level === level ? {
            ...l,
            executed: true,
            executedAt: new Date(),
            executedPrice: currentPrice,
            executedQuantity: quantity,
          } : l
        );
        
        setPyramidLevels(updatedLevels);
        setTotalInvested(prev => prev + targetLevel.amount);
        
        return {
          success: true,
          message: `模拟执行成功: 第${level}层`,
          trade: {
            quantity,
            price: currentPrice,
          },
        };
      }
      
      // 实际交易
      const orderResult = await binanceService.placeOrder({
        symbol: 'BTCFDUSD',
        side: 'BUY',
        type: 'MARKET',
        quoteOrderQty: targetLevel.amount,
      });
      
      const executedQuantity = parseFloat(orderResult.executedQty);
      const executedPrice = parseFloat(orderResult.fills[0]?.price || currentPrice.toString());
      
      // 更新层级状态
      const updatedLevels = pyramidLevels.map(l => 
        l.level === level ? {
          ...l,
          executed: true,
          executedAt: new Date(),
          executedPrice,
          executedQuantity,
        } : l
      );
      
      setPyramidLevels(updatedLevels);
      setTotalInvested(prev => prev + targetLevel.amount);
      
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
  }, [pyramidLevels]);

  // 重置金字塔
  const resetPyramid = useCallback(() => {
    setPyramidLevels([]);
    setCurrentLevel(null);
    setTotalInvested(0);
  }, []);

  // 初始化和配置变化时重新计算
  useEffect(() => {
    initializePyramid();
  }, [initializePyramid]);

  // 定期检查触发条件
  useEffect(() => {
    const interval = setInterval(() => {
      checkTriggers();
    }, 10000); // 每10秒检查一次
    
    return () => clearInterval(interval);
  }, [checkTriggers]);

  return {
    pyramidLevels,
    currentLevel,
    totalInvested,
    executeLevel,
    resetPyramid,
    loading,
  };
};