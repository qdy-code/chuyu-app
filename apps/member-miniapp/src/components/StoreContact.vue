<template>
  <view class="store-contact">
    <text class="store-title">到店与联系</text>
    <text v-if="storeContact.address" class="store-copy" selectable>{{ storeContact.address }}</text>
    <text v-if="storeContact.hours" class="store-copy">营业时间：{{ storeContact.hours }}</text>
    <text v-if="!storeContact.phone && !storeContact.address" class="store-copy">到店地址、款式咨询或预约变更，可留言联系门店。</text>
    <view class="store-actions">
      <button v-if="storeContact.phone" class="store-action" @click="callStore">致电门店</button>
      <button v-if="storeContact.address || storeContact.latitude !== undefined" class="store-action" @click="navigateToStore">{{ storeContact.latitude !== undefined ? '导航到店' : '复制地址' }}</button>
      <button class="store-action" @click="leaveStoreMessage">留言给门店</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { storeContact, callStore, navigateToStore, leaveStoreMessage } from '@/utils/store-contact';
</script>

<style scoped>
.store-contact { position: relative; z-index: 1; margin-top: 24rpx; padding: 26rpx; border-radius: 28rpx; background: rgba(255,255,255,.94); border: 2rpx solid #edf0f3; }
.store-title { display: block; color: #3d4652; font-size: 28rpx; font-weight: 800; }
.store-copy { display: block; margin-top: 12rpx; color: #667085; font-size: 24rpx; line-height: 1.6; white-space: pre-wrap; }
.store-actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 18rpx; }
.store-action { flex: 1; min-width: 150rpx; margin: 0; padding: 8rpx 16rpx; border-radius: 999rpx; background: #edf2f4; color: #3d4652; font-size: 24rpx; }
.store-action::after { border: 0; }
</style>
