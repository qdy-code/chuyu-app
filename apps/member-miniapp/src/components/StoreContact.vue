<template>
  <view class="store-contact" :class="{ 'store-detail': appearance === 'detail', 'store-compact': appearance === 'compact' }">
    <text v-if="appearance !== 'compact'" class="store-title">到店与联系</text>
    <text v-if="storeContact.address" class="store-copy" selectable>{{ storeContact.address }}</text>
    <text v-if="storeContact.hours" class="store-copy">营业时间：{{ storeContact.hours }}</text>
    <text v-if="!appearance && !storeContact.phone && !storeContact.address" class="store-copy">到店地址、款式咨询或预约变更，可留言联系门店。</text>
    <view class="store-actions">
      <button v-if="storeContact.phone" class="store-action" @click="callStore">致电门店</button>
      <button v-if="storeContact.address || storeContact.latitude !== undefined" class="store-action" @click="navigateToStore">{{ storeContact.latitude !== undefined ? '导航到店' : '复制地址' }}</button>
      <button class="store-action" @click="leaveStoreMessage">留言给门店</button>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{ appearance?: 'detail' | 'compact' }>();
import { storeContact, callStore, navigateToStore, leaveStoreMessage } from '@/utils/store-contact';
</script>

<style scoped>
.store-contact { position: relative; z-index: 1; margin-top: 24rpx; padding: 26rpx; border-radius: 28rpx; background: rgba(255,255,255,.94); border: 2rpx solid #edf0f3; }
.store-title { display: block; color: #3d4652; font-size: 28rpx; font-weight: 800; }
.store-copy { display: block; margin-top: 12rpx; color: #667085; font-size: 24rpx; line-height: 1.6; white-space: pre-wrap; }
.store-actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 18rpx; }
.store-action { flex: 1; min-width: 150rpx; margin: 0; padding: 8rpx 16rpx; border-radius: 999rpx; background: #edf2f4; color: #3d4652; font-size: 24rpx; }
.store-action::after { border: 0; }
.store-detail { margin: 0; padding: 24px 0 0; border-radius: 0; border: 0; border-top: 1px solid var(--detail-border); background: transparent; }
.store-detail .store-title { font-size: 18px; font-weight: 600; line-height: 1.5; color: var(--detail-text); }
.store-detail .store-copy { margin-top: 16px; font-size: 14px; line-height: 1.8; color: var(--detail-muted); }
.store-detail .store-actions { gap: 8px; margin-top: 16px; }
.store-detail .store-action { min-width: 96px; min-height: 48px; padding: 12px 16px; border-radius: 12px; background: var(--detail-subtle); color: var(--detail-text); font-size: 14px; line-height: 24px; }
.store-compact { margin-top: 8px; padding: 0; border: 0; border-radius: 0; background: transparent; }
.store-compact .store-copy { font-size: 14px; line-height: 1.7; }
.store-compact .store-actions { justify-content: center; gap: 8px; margin: 0; }
.store-compact .store-action { flex: 0 1 auto; min-width: 96px; min-height: 48px; padding: 12px 16px; background: transparent; font-size: 14px; line-height: 24px; color: #667085; }
</style>
