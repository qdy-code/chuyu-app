import { ref, shallowRef, watch } from 'vue';
import type { BusinessType, CatalogProduct } from '@member-platform/shared';
import { sessionState } from '@/store/session';

export type FavoriteProduct = Pick<CatalogProduct, 'id' | 'businessType' | 'name' | 'images'>;
const storagePrefix = 'member-miniapp-favorites-v1:';
export const favoriteProducts = shallowRef<FavoriteProduct[]>([]);
export const favoriteStorageError = ref('');

export function favoriteKey(product: Pick<FavoriteProduct, 'id' | 'businessType'>): string {
  return `${product.businessType}:${product.id}`;
}

export function normalizeFavorites(value: unknown): FavoriteProduct[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap(item => {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name ||
      !(['NAIL', 'ACCESSORY', 'FLOWER'] as BusinessType[]).includes(item.businessType)) return [];
    const key = favoriteKey(item);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ id: item.id, businessType: item.businessType, name: item.name,
      images: Array.isArray(item.images) ? item.images.filter((url: unknown) => typeof url === 'string').slice(0, 20) : [] }];
  }).slice(0, 200);
}

export function restoreFavorites(): void {
  favoriteProducts.value = [];
  favoriteStorageError.value = '';
  if (!sessionState.userId || !sessionState.token) return;
  try {
    favoriteProducts.value = normalizeFavorites(uni.getStorageSync(storagePrefix + sessionState.userId));
  } catch {
    favoriteStorageError.value = '收藏暂未读取，请重试';
  }
}

watch(() => [sessionState.userId, sessionState.token], restoreFavorites, { immediate: true, flush: 'sync' });

export function isFavorite(product: Pick<FavoriteProduct, 'id' | 'businessType'>): boolean {
  return favoriteProducts.value.some(item => favoriteKey(item) === favoriteKey(product));
}

export function toggleFavorite(product: FavoriteProduct): boolean {
  if (!sessionState.userId || !sessionState.token) throw new Error('请登录后收藏');
  if (favoriteStorageError.value) throw new Error(favoriteStorageError.value);
  const adding = !isFavorite(product);
  if (adding && favoriteProducts.value.length >= 200) throw new Error('收藏已满，请先取消部分收藏');
  const next = adding ? normalizeFavorites([product, ...favoriteProducts.value])
    : favoriteProducts.value.filter(item => favoriteKey(item) !== favoriteKey(product));
  try {
    uni.setStorageSync(storagePrefix + sessionState.userId, next);
  } catch {
    throw new Error('收藏未保存，请重试');
  }
  favoriteProducts.value = next;
  return adding;
}
