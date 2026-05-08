<template>
  <view class="page">
    <view class="top-bar">
      <view>
        <text class="brand">初屿会员</text>
        <text class="hello">{{ welcomeText }}</text>
      </view>
      <button v-if="sessionState.userId" class="account-chip" @click="openAccount">账户</button>
    </view>

    <view v-if="!isRegistered" class="register-card">
      <view class="register-copy">
        <text class="register-kicker">正式会员注册</text>
        <text class="register-title">手机号快捷登录，成为初屿会员</text>
        <text class="register-desc">手机号将作为会员ID，用于查询余额、积分、预约和消费记录。</text>
      </view>
      <button
        class="register-btn"
        open-type="getPhoneNumber"
        @getphonenumber="handleRegisterPhone"
        :disabled="registering"
      >
        {{ registering ? '注册中...' : registerButtonText }}
      </button>
    </view>

    <view class="hero-card" @click="openPage('/pages/card/card')">
      <view class="hero-left">
        <text class="hero-label">我的会员卡</text>
        <text class="hero-title">{{ sessionState.profile?.levelName || '初屿会员' }}</text>
        <text v-if="sessionState.profile" class="hero-desc">ID：{{ sessionState.profile.id }}</text>
        <text v-else class="hero-desc">完成手机号授权后自动生成正式会员档案</text>
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
        <text class="stat-value">{{ sessionState.profile.phone ? '已注册' : '待注册' }}</text>
        <text class="stat-label">状态</text>
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
import { discountText, formatMoney, refreshSessionProfile, registerWithWechatPhone, requireRegistered } from '@/utils/member';

type PhoneNumberEvent = {
  detail: {
    code?: string;
    errMsg?: string;
    errno?: number;
    errorCode?: number;
  };
};

const registering = ref(false);

const isRegistered = computed(() => Boolean(sessionState.profile?.phone));
const welcomeText = computed(() => sessionState.profile?.nickname || '会员中心');
const registerButtonText = computed(() => (sessionState.userId ? '完成手机号绑定' : '手机号快捷登录'));

async function handleRegisterPhone(event: PhoneNumberEvent) {
  if (registering.value) return;

  const phoneCode = event.detail.code;
  if (!phoneCode) {
    await handlePhoneAuthorizeFail(event);
    return;
  }

  registering.value = true;
  try {
    await registerWithWechatPhone(phoneCode);
    uni.showToast({ title: '注册成功', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: errorMessage(error), icon: 'none' });
  } finally {
    registering.value = false;
  }
}

async function handlePhoneAuthorizeFail(event: PhoneNumberEvent) {
  const errorCode = event.detail.errorCode ?? event.detail.errno;
  const errMsg = event.detail.errMsg || '';
  const isDevtoolsSystemError = errorCode === -10000 || errMsg.includes('-10000');

  if (isDevtoolsSystemError && import.meta.env.VITE_ENABLE_MOCK_PHONE === 'true') {
    const confirmed = await showModal({
      title: '模拟手机号注册',
      content: '当前已开启模拟手机号，是否使用测试手机号完成注册？',
      confirmText: '模拟注册',
    });
    if (!confirmed) return;

    registering.value = true;
    try {
      await registerWithWechatPhone('mock-phone-code', '13800138000');
      uni.showToast({ title: '模拟注册成功', icon: 'success' });
    } finally {
      registering.value = false;
    }
    return;
  }

  uni.showToast({
    title: phoneAuthorizeFailText(errorCode, errMsg),
    icon: 'none',
  });
}

function openPage(url: string) {
  if (!requireRegistered()) {
    return;
  }
  uni.navigateTo({ url });
}

function openAccount() {
  if (!sessionState.userId) {
    uni.showToast({ title: '请先完成注册', icon: 'none' });
    return;
  }
  uni.navigateTo({ url: '/pages/account/account' });
}

function showModal(options: { title: string; content: string; confirmText: string }): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      ...options,
      cancelText: '取消',
      success: (result) => resolve(Boolean(result.confirm)),
      fail: () => resolve(false),
    });
  });
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '登录失败';
  if (message.includes('phone already')) return '手机号已被绑定';
  if (message.includes('url not in domain list')) return '接口域名未配置';
  if (message.includes('request:fail')) return '网络请求失败';
  if (message.includes('invalid code') || message.includes('40029') || message.includes('Internal server error') || message.includes('500')) {
    return '登录票据已过期，请重试';
  }
  return message.slice(0, 18) || '登录失败';
}

function phoneAuthorizeFailText(errorCode: number | undefined, errMsg: string): string {
  if (errorCode === -10000 || errMsg.includes('-10000')) {
    return '请用手机预览授权手机号';
  }
  if (errorCode === 102 || errMsg.includes('no permission') || errMsg.includes('has no permission')) {
    return '小程序未开通手机号能力';
  }
  if (errMsg.includes('user deny') || errMsg.includes('cancel')) {
    return '已取消手机号授权';
  }
  return `手机号授权失败${errorCode ? `:${errorCode}` : ''}`;
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
