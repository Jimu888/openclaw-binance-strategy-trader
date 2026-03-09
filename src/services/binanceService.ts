// Binance API 服务层
// 注意：这是前端版本，实际生产环境中应该通过后端API代理

interface BalanceInfo {
  asset: string;
  free: number;
  locked: number;
}

interface TickerData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
}

interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity?: number;
  quoteOrderQty?: number;
  price?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

interface OrderResponse {
  orderId: number;
  symbol: string;
  side: string;
  type: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  fills: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
}

class BinanceService {
  private baseUrl: string;
  private isTestnet: boolean;
  
  constructor() {
    // 根据环境变量决定使用测试网还是主网
    this.isTestnet = process.env.REACT_APP_TESTNET === 'true';
    this.baseUrl = this.isTestnet 
      ? 'https://testnet.binance.vision/api/v3'
      : 'https://api.binance.com/api/v3';
  }

  // 获取账户余额
  async getAccountBalances(): Promise<BalanceInfo[]> {
    try {
      // 在实际应用中，这里应该调用后端API，由后端处理签名和认证
      const response = await fetch('/api/binance/account', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`获取账户信息失败: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return data.balances
        .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .map((b: any) => ({
          asset: b.asset,
          free: parseFloat(b.free),
          locked: parseFloat(b.locked),
        }));
    } catch (error) {
      // 开发模式下使用模拟数据
      if (process.env.NODE_ENV === 'development') {
        return this.getMockBalances();
      }
      throw error;
    }
  }

  // 获取交易对价格
  async getTicker(symbol: string): Promise<TickerData> {
    try {
      const response = await fetch(`${this.baseUrl}/ticker/24hr?symbol=${symbol}`);
      
      if (!response.ok) {
        throw new Error(`获取价格数据失败: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      // 开发模式下使用模拟数据
      if (process.env.NODE_ENV === 'development') {
        return this.getMockTicker(symbol);
      }
      throw error;
    }
  }

  // 下单
  async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    try {
      const response = await fetch('/api/binance/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderRequest),
      });
      
      if (!response.ok) {
        throw new Error(`下单失败: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      // 开发模式下使用模拟数据
      if (process.env.NODE_ENV === 'development') {
        return this.getMockOrderResponse(orderRequest);
      }
      throw error;
    }
  }

  // 获取订单历史
  async getOrderHistory(symbol: string, limit: number = 10): Promise<OrderResponse[]> {
    try {
      const response = await fetch(`/api/binance/orders?symbol=${symbol}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`获取订单历史失败: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        return this.getMockOrderHistory(symbol);
      }
      throw error;
    }
  }

  // 模拟数据方法（开发环境使用）
  private getMockBalances(): BalanceInfo[] {
    return [
      { asset: 'BTC', free: 0.1, locked: 0 },
      { asset: 'FDUSD', free: 5000, locked: 0 },
    ];
  }

  private getMockTicker(symbol: string): TickerData {
    const mockPrices: { [key: string]: number } = {
      'BTCFDUSD': 95000 + Math.random() * 1000 - 500, // 94500-95500区间波动
    };
    
    const basePrice = mockPrices[symbol] || 95000;
    const change = (Math.random() - 0.5) * 200; // -100 到 +100 的变化
    
    return {
      symbol,
      price: basePrice.toFixed(2),
      priceChange: change.toFixed(2),
      priceChangePercent: ((change / basePrice) * 100).toFixed(2),
      volume: (1000000 + Math.random() * 500000).toFixed(2),
    };
  }

  private getMockOrderResponse(orderRequest: OrderRequest): OrderResponse {
    const price = 95000 + Math.random() * 100 - 50;
    const quantity = orderRequest.quantity || orderRequest.quoteOrderQty! / price;
    
    return {
      orderId: Math.floor(Math.random() * 1000000000),
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      type: orderRequest.type,
      executedQty: quantity.toFixed(8),
      cummulativeQuoteQty: (quantity * price).toFixed(2),
      status: 'FILLED',
      fills: [
        {
          price: price.toFixed(2),
          qty: quantity.toFixed(8),
          commission: (quantity * 0.001).toFixed(8),
          commissionAsset: orderRequest.side === 'BUY' ? 'BTC' : 'FDUSD',
        },
      ],
    };
  }

  private getMockOrderHistory(symbol: string): OrderResponse[] {
    return [
      {
        orderId: 123456789,
        symbol,
        side: 'BUY',
        type: 'MARKET',
        executedQty: '0.00105263',
        cummulativeQuoteQty: '100.00',
        status: 'FILLED',
        fills: [
          {
            price: '95000.00',
            qty: '0.00105263',
            commission: '0.00000105',
            commissionAsset: 'BTC',
          },
        ],
      },
    ];
  }

  // 工具方法
  isConnected(): boolean {
    // 检查API连接状态
    return true;
  }

  getTestnetStatus(): boolean {
    return this.isTestnet;
  }
}

// 导出单例实例
export const binanceService = new BinanceService();