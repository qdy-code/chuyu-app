<template>
  <view v-if="sessionState.profile?.pospal" class="sync-status">
    <text class="sync-copy">{{ message }}</text>
    <text v-if="sessionState.profile.pospal.syncedAt" class="sync-time">上次同步：{{ new Date(sessionState.profile.pospal.syncedAt).toLocaleString('zh-CN', { hour12: false }) }}</text>
    <button v-if="sessionState.profile.pospal.state === 'LINKED'" class="sync-button" :disabled="profileRefreshState.loading" @click="refreshSessionProfile">
      {{ profileRefreshState.loading ? '更新中...' : '刷新余额与积分' }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { sessionState } from '@/store/session';
import { profileRefreshState, refreshSessionProfile } from '@/utils/member';

const message = computed(() => {
  if (sessionState.profile?.pospal?.state === 'UNLINKED') return '请到店由工作人员核验并关联会员账户，关联后可查看余额与积分。';
  if (profileRefreshState.loading) return '正在更新余额与积分，当前显示上次同步数据。';
  if (profileRefreshState.errorMessage) return `暂未更新，以下为上次同步数据。${profileRefreshState.errorMessage}`;
  return profileRefreshState.fresh ? '余额与积分已从门店收银系统更新。' : '当前显示上次同步数据，可点击刷新获取最新余额与积分。';
});
</script>

<style scoped>
.sync-status { position: relative; z-index: 1; margin-top: 22rpx; padding: 24rpx; border-radius: 24rpx; background: rgba(255, 255, 255, .94); }
.sync-copy, .sync-time { display: block; color: #667085; font-size: 24rpx; line-height: 1.6; }
.sync-time { margin-top: 8rpx; }
.sync-button { margin: 18rpx 0 0; border-radius: 999rpx; background: #edf2f4; color: #3d4652; font-size: 25rpx; }
.sync-button::after { border: 0; }
</style>
