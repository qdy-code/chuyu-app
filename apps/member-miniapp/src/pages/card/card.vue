<template>
  <view class="page">
    <view v-if="!sessionState.profile" class="empty-card">
      <text class="empty-title">请先登录</text>
      <button class="primary-btn" @click="goHome">返回首页</button>
    </view>

    <template v-else>
      <view class="member-card">
        <text class="card-label">CHUYU MEMBER</text>
        <text class="nickname">{{ sessionState.profile.nickname }}</text>
        <text class="level">{{ sessionState.profile.levelName }}</text>
        <view class="code-box">
          <text class="code-title">会员ID</text>
          <text class="member-id">{{ sessionState.profile.id }}</text>
        </view>
      </view>

      <view class="stats-card">
        <view class="stat">
          <text class="stat-value">¥{{ formatMoney(sessionState.profile.balance) }}</text>
          <text class="stat-label">账户余额</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ sessionState.profile.points }}</text>
          <text class="stat-label">当前积分</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ discountText(sessionState.profile.discountRate) }}</text>
          <text class="stat-label">会员折扣</text>
        </view>
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
  min-height: 100vh;
  padding: 32rpx 24rpx;
  background: #f7f4ef;
}

.member-card {
  min-height: 460rpx;
  border-radius: 42rpx;
  padding: 42rpx;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #cf2c2c, #861212);
  color: #fff;
  box-shadow: 0 28rpx 70rpx rgba(197, 36, 36, 0.28);
}

.card-label {
  color: #ffdba3;
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
  color: rgba(255, 255, 255, 0.78);
  font-size: 28rpx;
}

.code-box {
  margin-top: auto;
  border-radius: 28rpx;
  padding: 28rpx;
  background: rgba(255, 255, 255, 0.14);
}

.code-title {
  display: block;
  color: rgba(255, 255, 255, 0.72);
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
  background: #d72d2d;
  color: #fff;
  font-weight: 800;
}
</style>
