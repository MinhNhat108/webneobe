export function formatNumber(val: number | null | undefined, decimals = 2, fallback = '-'): string {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function formatPercent(val: number | null | undefined, decimals = 1, fallback = '-'): string {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  return `${(val * 100).toFixed(decimals)}%`;
}
