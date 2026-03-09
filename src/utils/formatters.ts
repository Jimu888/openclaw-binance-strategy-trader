// 数值格式化工具函数

export const formatCurrency = (value: number, currency: string = 'FDUSD'): string => {
  return `${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
};

export const formatCrypto = (value: number, symbol: string = 'BTC', decimals: number = 8): string => {
  return `${value.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${symbol}`;
};

export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

export const formatTime = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatShortTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  
  return date.toLocaleDateString('zh-CN');
};

export const formatPriceChange = (change: number, changePercent: number): {
  value: string;
  className: string;
} => {
  const isPositive = change >= 0;
  const prefix = isPositive ? '+' : '';
  
  return {
    value: `${prefix}${change.toFixed(2)} (${prefix}${changePercent.toFixed(2)}%)`,
    className: isPositive ? 'positive' : 'negative',
  };
};

export const truncateAddress = (address: string, startLength: number = 6, endLength: number = 4): string => {
  if (address.length <= startLength + endLength) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
};