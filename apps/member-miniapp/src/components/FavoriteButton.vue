<template>
  <button class="favorite" :class="{ saved, 'favorite-detail': appearance === 'detail', 'favorite-list': appearance === 'list' }" hover-class="favorite-pressed" :hover-stay-time="100" :disabled="busy" @click.stop="toggle">{{ saved ? '已收藏' : '收藏' }}</button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FavoriteProduct } from '@/utils/favorite-products';
import { isFavorite, toggleFavorite } from '@/utils/favorite-products';
import { ensureReadyMemberAccess } from '@/utils/member';

const props = defineProps<{ product: FavoriteProduct; appearance?: 'detail' | 'list' }>();
const busy = ref(false);
const saved = computed(() => isFavorite(props.product));
async function toggle() {
  if (busy.value) return;
  busy.value = true;
  try {
    if (!saved.value && !(await ensureReadyMemberAccess())) return;
    const added = toggleFavorite(props.product);
    uni.showToast({ title: added ? '已收藏' : '已取消收藏', icon: 'none' });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '收藏未保存，请重试', icon: 'none' });
  } finally { busy.value = false; }
}
</script>

<style scoped>
.favorite { margin: 0; padding: 0 24rpx; line-height: 2.8; border-radius: 999rpx; background: #edf2f4; color: #667085; font-size: 25rpx; flex-shrink: 0; }
.favorite.saved { background: #e6eeeb; color: #527d68; }
.favorite::after { border: 0; }
.favorite-detail { min-width: 88px; min-height: 48px; padding: 12px 16px; border-radius: 12px; font-size: 16px; line-height: 1.5; box-sizing: border-box; background: var(--detail-subtle); color: var(--detail-text); transition: background-color 160ms, transform var(--detail-press); }
.favorite-detail.saved { background: var(--detail-accent-surface); color: var(--detail-text); }
.favorite-detail.favorite-pressed { transform: scale(.98); opacity: .8; }
@media (prefers-reduced-motion: reduce) { .favorite-detail { transition: none; } .favorite-detail.favorite-pressed { transform: none; } }
.favorite-list { min-width: 64px; min-height: 48px; padding: 12px 8px; border-radius: 12px; background: transparent; color: #667085; font-size: 14px; line-height: 24px; box-sizing: border-box; }
.favorite-list.saved { background: #e6eeeb; color: #111827; }
.favorite-list.favorite-pressed { opacity: .7; }
</style>
