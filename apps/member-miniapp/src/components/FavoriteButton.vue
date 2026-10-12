<template>
  <button class="favorite" :class="{ saved }" :disabled="busy" @click.stop="toggle">{{ saved ? '已收藏' : '收藏' }}</button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FavoriteProduct } from '@/utils/favorite-products';
import { isFavorite, toggleFavorite } from '@/utils/favorite-products';
import { ensureReadyMemberAccess } from '@/utils/member';

const props = defineProps<{ product: FavoriteProduct }>();
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
</style>
