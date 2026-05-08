<template>
  <view class="page">
    <view class="top-bar">
      <view>
        <text class="brand">初屿会员</text>
        <text class="hello">{{ welcomeText }}</text>
      </view>
      <button v-if="sessionState.userId" class="account-chip" @click="openAccount">账户</button>
    </view>

    <view v-if="!sessionState.userId" class="register-card">
      <view class="register-copy">
        <text class="register-kicker">会员中心</text>
        <text class="register-title">{{ loggingIn ? '正在为你准备会员档案…' : '点击下方按钮进入会员中心' }}</text>
        <text class="register-desc">使用微信账号一键进入，无需填写手机号即可享受会员折扣、预约和消费记录服务。</text>
      </view>
      <button class="register-btn" :disabled="loggingIn" @click="handleEnter">
        {{ loggingIn ? '进入中...' : '进入会员中心' }}
      </button>
    </view>

    <view class="hero-card" @click="openPage('/pages/card/card')">
      <view class="hero-left">
        <text class="hero-label">我的会员卡</text>
        <text class="hero-title">{{ sessionState.profile?.levelName || '初屿会员' }}</text>
        <text v-if="sessionState.profile" class="hero-desc">ID：{{ sessionState.profile.id }}</text>
        <text v-else class="hero-desc">登录后自动生成会员档案</text>
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
        <text class="stat-value">{{ sessionState.profile.levelName || '会员' }}</text>
        <text class="stat-label">等级</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">常用服务</text>
      <view class="module-grid">
        <view class="module module-card" @click="openPage('/pages/card/card')">
          <text class="module-icon">👑</text>
          <text class="module-title">会员卡</text>
        </view>
        <view class="module module-orders" @click="openPage('/pages/consumptions/consumptions')">
          <text class="module-icon">🧾</text>
          <text class="module-title">消费记录</text>
        </view>
        <view class="module module-appointment" @click="openPage('/pages/appointment/appointment')">
          <text class="module-icon">📅</text>
          <text class="module-title">预约到店</text>
        </view>
        <view class="module module-account" @click="openAccount">
          <text class="module-icon">👤</text>
          <text class="module-title">账户资料</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { sessionState } from '@/store/session';
import { discountText, ensureSession, formatMoney, requireLogin } from '@/utils/member';

const loggingIn = ref(false);

const welcomeText = computed(() => sessionState.profile?.nickname || '会员中心');

async function handleEnter() {
  if (loggingIn.value) return;
  loggingIn.value = true;
  try {
    const ok = await ensureSession();
    if (!ok) {
      uni.showToast({ title: '登录失败，请重试', icon: 'none' });
    }
  } catch (error) {
    uni.showToast({ title: errorMessage(error), icon: 'none' });
  } finally {
    loggingIn.value = false;
  }
}

function openPage(url: string) {
  if (!requireLogin()) {
    return;
  }
  uni.navigateTo({ url });
}

function openAccount() {
  if (!requireLogin()) {
    return;
  }
  uni.navigateTo({ url: '/pages/account/account' });
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '登录失败';
  if (message.includes('url not in domain list')) return '接口域名未配置';
  if (message.includes('request:fail')) return '网络请求失败';
  if (message.includes('invalid code') || message.includes('40029') || message.includes('Internal server error') || message.includes('500')) {
    return '登录票据已过期，请重试';
  }
  return message.slice(0, 18) || '登录失败';
}

onShow(async () => {
  if (loggingIn.value) return;
  loggingIn.value = true;
  try {
    await ensureSession();
  } finally {
    loggingIn.value = false;
  }
});
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

.account-chip {
  margin: 0;
  min-width: 132rpx;
  border-radius: 999rpx;
  background: #fff;
  color: #9b1717;
  font-size: 26rpx;
  font-weight: 800;
  box-shadow: 0 10rpx 30rpx rgba(31, 41, 55, 0.08);
}

.register-card {
  margin-top: 30rpx;
  border-radius: 36rpx;
  padding: 34rpx;
  background: #fff;
  box-shadow: 0 20rpx 60rpx rgba(197, 36, 36, 0.12);
}

.register-kicker {
  display: block;
  color: #c52424;
  font-size: 24rpx;
  font-weight: 900;
}

.register-title {
  display: block;
  margin-top: 10rpx;
  color: #111827;
  font-size: 40rpx;
  font-weight: 900;
  line-height: 1.25;
}

.register-desc {
  display: block;
  margin-top: 14rpx;
  color: #667085;
  font-size: 26rpx;
  line-height: 1.55;
}

.register-btn {
  margin-top: 30rpx;
  border-radius: 999rpx;
  background: #d72d2d;
  color: #fff;
  font-weight: 900;
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
