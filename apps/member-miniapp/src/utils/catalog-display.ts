import { toAbsoluteImageUrl } from '@/utils/api';

export function productImageUrls(images: readonly string[]): string[] {
  return [...new Set(images.filter(source => source.trim()).map(source => source.startsWith('/static/') ? source : toAbsoluteImageUrl(source)))];
}

export function referencePriceText(value?: number): string {
  return value === undefined || !Number.isFinite(Number(value)) ? '参考价到店确认' : `参考价 ¥${Number(value).toFixed(2)}`;
}
