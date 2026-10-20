<template>
  <view class="action-bar">
    <FavoriteButton :product="product" appearance="detail" />
    <button class="book-button" :class="{ 'is-busy': busy }" hover-class="book-pressed" :hover-stay-time="100" :disabled="busy" @click="emit('book')">{{ busy ? '正在准备预约…' : '预约此款' }}<text v-if="!busy" class="book-arrow">→</text></button>
  </view>
</template>

<script setup lang="ts">
import type { CatalogProduct } from '@member-platform/shared';
import FavoriteButton from '@/components/FavoriteButton.vue';
defineProps<{ product: CatalogProduct; busy: boolean }>();
const emit = defineEmits<{ (event: 'book'): void }>();
</script>

<style scoped>
.action-bar { position: fixed; z-index: 10; left: 0; right: 0; bottom: 0; display: flex; align-items: stretch; gap: 16px; padding: 16px 24px calc(16px + env(safe-area-inset-bottom)); background: var(--detail-surface); border-top: 1px solid var(--detail-border); }
.book-button { display: flex; align-items: center; justify-content: center; gap: 16px; flex: 1; min-width: 0; min-height: 48px; margin: 0; padding: 12px 16px; border-radius: 12px; background: var(--detail-primary); color: var(--detail-on-primary); font-size: 16px; font-weight: 500; line-height: 1.5; transition: opacity var(--detail-press), transform var(--detail-press); }
.book-button::after { border: 0; }
.book-button.is-busy { background: var(--detail-primary); color: var(--detail-on-primary); opacity: .65; }
.book-pressed { opacity: .8; transform: scale(.98); }
.book-arrow { font-size: 20px; line-height: 1; }
@media (max-width: 359px) { .action-bar { gap: 8px; padding-left: 16px; padding-right: 16px; } }
@media (prefers-reduced-motion: reduce) { .book-pressed { transform: none; } }
</style>
