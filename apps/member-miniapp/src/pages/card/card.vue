<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view v-if="!sessionState.profile" class="empty-card">
      <text class="empty-title">请先登录</text>
      <button class="primary-btn" @click="goHome">返回首页</button>
    </view>

    <template v-else>
      <view class="member-card">
        <image class="card-bg" src="/static/brand/member-card-bg.jpg" mode="aspectFill" />
        <text class="card-label">MOONSTONE ISLE MEMBER</text>
        <text class="nickname">{{ sessionState.profile.nickname }}</text>
        <text class="level">{{ sessionState.profile.levelName }}</text>
        <view class="code-box">
          <text class="code-title">会员号</text>
          <text class="member-id">{{ sessionState.profile.pospal?.customerNumber || sessionState.profile.id }}</text>
        </view>
      </view>

      <view class="stats-card">
        <view class="stat">
          <text class="stat-value">{{ sessionState.profile.pospal?.state === 'UNLINKED' ? '待关联' : `¥${formatMoney(sessionState.profile.balance)}` }}</text>
          <text class="stat-label">账户余额</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ sessionState.profile.pospal?.state === 'UNLINKED' ? '待关联' : sessionState.profile.points }}</text>
          <text class="stat-label">当前积分</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ discountText(sessionState.profile.discountRate) }}</text>
          <text class="stat-label">会员折扣</text>
        </view>
      </view>
      <view v-if="sessionState.profile.pospal" class="empty-card">
        <text>{{ sessionState.profile.pospal.state === 'LINKED' ? '余额和积分已从门店收银系统同步' : '请联系门店关联收银系统会员卡' }}</text>
        <text v-if="sessionState.profile.pospal.syncedAt">上次同步：{{ new Date(sessionState.profile.pospal.syncedAt).toLocaleString() }}</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { sessionState } from '@/store/session';
import { discountText, formatMoney, refreshSessionProfile } from '@/utils/member';

function goHome() {
  uni.navigateBack({ fail: () => uni.redirectTo({ url: '/pages/index/index' }) });
}

onShow(refreshSessionProfile);
</script>

<style scoped>
.page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  padding: 32rpx 24rpx;
  background: #f6f3ea;
}

.page-bg {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

.page > view {
  position: relative;
  z-index: 1;
}

.member-card {
  position: relative;
  overflow: hidden;
  min-height: 460rpx;
  border-radius: 42rpx;
  padding: 42rpx;
  display: flex;
  flex-direction: column;
  background: #edf2f4;
  color: #3d4652;
  box-shadow: 0 28rpx 70rpx rgba(87, 101, 116, 0.16);
}

.card-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.96;
}

.card-label,
.nickname,
.level,
.code-box {
  position: relative;
  z-index: 1;
}

.card-label {
  color: #6f7f8a;
  font-size: 24rpx;
  letter-spacing: 4rpx;
}

.nickname {
  margin-top: 28rpx;
  font-size: 48rpx;
  font-weight: 900;
}

.level {
  margin-top: 12rpx;
  color: #6f7f8a;
  font-size: 28rpx;
}

.code-box {
  margin-top: auto;
  border-radius: 28rpx;
  padding: 28rpx;
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.62);
}

.code-title {
  display: block;
  color: #7d8792;
  font-size: 24rpx;
}

.member-id {
  display: block;
  margin-top: 10rpx;
  font-size: 30rpx;
  font-weight: 800;
  word-break: break-all;
}

.stats-card,
.empty-card {
  margin-top: 24rpx;
  border-radius: 30rpx;
  padding: 28rpx;
  background: #fff;
  box-shadow: 0 12rpx 38rpx rgba(31, 41, 55, 0.06);
}

.stats-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.stat {
  border-radius: 22rpx;
  padding: 22rpx 10rpx;
  background: #fafafa;
  text-align: center;
}

.stat-value {
  display: block;
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.stat-label {
  display: block;
  margin-top: 8rpx;
  color: #667085;
  font-size: 24rpx;
}

.empty-title {
  display: block;
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}


.primary-btn {
  margin-top: 24rpx;
  border-radius: 999rpx;
  background: #3d4652;
  color: #f7f4ea;
  font-weight: 800;
}
</style>
