<template>
  <view class="page">
    <view class="top-bar">
      <view>
        <text class="brand">初屿会员</text>
        <text class="hello">{{ sessionState.profile ? sessionState.profile.nickname : '会员中心' }}</text>
      </view>
      <button v-if="!sessionState.userId" class="login-btn" @click="handleLogin" :disabled="loading">
        {{ loading ? '登录中' : '微信登录' }}
      </button>
    </view>

    <view class="hero-card" @click="openPage('/pages/card/card')">
      <view class="hero-left">
        <text class="hero-label">我的会员卡</text>
        <text class="hero-title">{{ sessionState.profile?.levelName || '立即登录' }}</text>
        <text v-if="sessionState.profile" class="hero-desc">ID：{{ sessionState.profile.id }}</text>
      </view>
      <view class="hero-badge">
        <text class="badge-value">{{ sessionState.profile ? discountText(sessionState.profile.discountRate) : 'JOIN' }}</text>
        <text class="badge-label">会员折扣</text>
      </view>
    </view>

    <view class="stats-card" v-if="sessionState.profile">
      <view class="stat">
        <text class="stat-value">¥{{ formatMoney(sessionState.profile.balance) }}</text>
        <text class="stat-label">余额</text>
      </view>
      <view class="divider" />
      <view class="stat">
        <text class="stat-value">{{ sessionState.profile.points }}</text>
        <text class="stat-label">积分</text>
      </view>
      <view class="divider" />
      <view class="stat">
        <text class="stat-value">{{ sessionState.profile.phone ? '已绑定' : '未绑定' }}</text>
        <text class="stat-label">手机号</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">常用服务</text>
      <view class="module-grid">
        <view class="module module-card" @click="openPage('/pages/card/card')">
          <text class="module-icon">👑</text>
          <text class="module-title">会员卡</text>
        </view>
        <view class="module module-recharge" @click="openPage('/pages/recharge/recharge')">
          <text class="module-icon">💳</text>
          <text class="module-title">充值</text>
        </view>
        <view class="module module-orders" @click="openPage('/pages/consumptions/consumptions')">
          <text class="module-icon">🧾</text>
          <text class="module-title">消费记录</text>
        </view>
        <view class="module module-appointment" @click="openPage('/pages/appointment/appointment')">
          <text class="module-icon">📅</text>
          <text class="module-title">预约到店</text>
        </view>
        <view class="module module-account" @click="openPage('/pages/account/account')">
          <text class="module-icon">👤</text>
          <text class="module-title">账户资料</text>
        </view>
      </view>
    </view>
</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { sessionState } from '@/store/session';
import { discountText, formatMoney, loginWithWechat, refreshSessionProfile, requireLogin } from '@/utils/member';

const loading = ref(false);

async function handleLogin() {
  loading.value = true;
  try {
    await loginWithWechat();
    uni.showToast({ title: '登录成功', icon: 'success' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '登录失败';
    uni.showToast({ title: message.slice(0, 18), icon: 'none' });
    console.error('login error:', error);
  } finally {
    loading.value = false;
  }
}

function openPage(url: string) {
  if (!requireLogin()) {
    return;
  }
  uni.navigateTo({ url });
}

onShow(refreshSessionProfile);
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx 24rpx;
  background: linear-gradient(180deg, #fff6ef 0%, #f7f4ef 38%, #f7f7f7 100%);
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24rpx;
}

.brand {
  display: block;
  color: #c52424;
  font-size: 28rpx;
  font-weight: 800;
}

.hello {
  display: block;
  margin-top: 8rpx;
  color: #1f2937;
  font-size: 38rpx;
  font-weight: 900;
}

.login-btn {
  margin: 0;
  border-radius: 999rpx;
  background: #d72d2d;
  color: #fff;
  font-weight: 800;
}

.hero-card {
  margin-top: 32rpx;
  min-height: 300rpx;
  border-radius: 40rpx;
  padding: 38rpx;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  background: linear-gradient(135deg, #da2f2f, #8f1414);
  color: #fff;
  box-shadow: 0 28rpx 70rpx rgba(197, 36, 36, 0.28);
}

.hero-label,
.hero-desc,
.badge-label,
.stat-label {
  font-size: 24rpx;
  opacity: 0.78;
}

.hero-title {
  display: block;
  margin-top: 18rpx;
  font-size: 44rpx;
  font-weight: 900;
}

.hero-desc {
  display: block;
  margin-top: 18rpx;
  max-width: 440rpx;
}

.hero-badge {
  width: 148rpx;
  height: 148rpx;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(255, 244, 215, 0.16);
  border: 1px solid rgba(255, 244, 215, 0.28);
}

.badge-value {
  font-size: 32rpx;
  font-weight: 900;
  color: #ffe1a6;
}

.stats-card,
.section {
  margin-top: 24rpx;
  border-radius: 30rpx;
  padding: 28rpx;
  background: #fff;
  box-shadow: 0 12rpx 38rpx rgba(31, 41, 55, 0.06);
}

.stats-card {
  display: flex;
  align-items: center;
}

.stat {
  flex: 1;
  text-align: center;
}

.stat-value {
  display: block;
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}

.stat-label {
  display: block;
  margin-top: 8rpx;
  color: #667085;
}

.divider {
  width: 1px;
  height: 56rpx;
  background: #edf0f3;
}

.section-title {
  display: block;
  color: #111827;
  font-size: 34rpx;
  font-weight: 900;
}

.module-grid {
  margin-top: 22rpx;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
}

.module {
  min-height: 168rpx;
  border-radius: 28rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.module-icon {
  font-size: 40rpx;
}

.module-title {
  margin-top: 12rpx;
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}


.module-card {
  background: #fff3e0;
}

.module-recharge {
  background: #ffecec;
}

.module-orders {
  background: #eef6ff;
}

.module-appointment {
  background: #fff7ed;
}

.module-account {
  background: #eef8f2;
}

</style>
