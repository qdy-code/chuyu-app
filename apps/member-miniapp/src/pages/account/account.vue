<template>
  <view class="page">
    <view class="header-card">
      <text class="header-title">账户资料</text>
    </view>

    <view v-if="!sessionState.profile" class="card">
      <text class="empty-title">请先登录</text>
      <button class="primary-btn" @click="goHome">返回首页</button>
    </view>

    <template v-else>
      <view class="card">
        <text class="section-title">手机号</text>
        <view class="info-row">
          <text class="info-label">手机号</text>
          <text class="info-value">{{ sessionState.profile.phone || '未绑定' }}</text>
        </view>
        <button
          class="primary-btn"
          open-type="getPhoneNumber"
          @getphonenumber="handlePhoneNumber"
          :disabled="phoneLoading"
        >
          {{ phoneLoading ? '绑定中...' : sessionState.profile.phone ? '更新手机号' : '绑定手机号' }}
        </button>
      </view>

      <view class="card">
        <text class="section-title">生日</text>
        <view class="info-row">
          <text class="info-label">生日</text>
          <picker mode="date" :value="birthday" @change="handleBirthdayChange">
            <view class="picker">{{ birthday || '请选择生日' }}</view>
          </picker>
        </view>
        <button class="secondary-btn" @click="saveBirthday" :disabled="birthdaySaving">
          {{ birthdaySaving ? '保存中...' : '保存生日' }}
        </button>
      </view>

      <view class="card">
        <text class="section-title">账户信息</text>
        <view class="info-row">
          <text class="info-label">会员ID</text>
          <text class="info-value wrap">{{ sessionState.profile.id }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">会员等级</text>
          <text class="info-value">{{ sessionState.profile.levelName }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { bindWechatPhone, updateMyProfile } from '@/utils/api';
import { sessionState, setProfile } from '@/store/session';
import { refreshSessionProfile } from '@/utils/member';

type PhoneNumberEvent = {
  detail: {
    code?: string;
    errMsg?: string;
    errno?: number;
    errorCode?: number;
  };
};

const birthday = ref('');
const phoneLoading = ref(false);
const birthdaySaving = ref(false);

async function refresh() {
  await refreshSessionProfile();
  birthday.value = sessionState.profile?.birthday || '';
}

async function handlePhoneNumber(event: PhoneNumberEvent) {
  if (!sessionState.userId) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }

  const code = event.detail.code;
  if (!code) {
    await handlePhoneAuthorizeFail(event);
    return;
  }

  await submitPhoneBinding(code);
}

async function handlePhoneAuthorizeFail(event: PhoneNumberEvent) {
  const errorCode = event.detail.errorCode ?? event.detail.errno;
  const errMsg = event.detail.errMsg || '';
  const isDevtoolsSystemError = errorCode === -10000 || errMsg.includes('-10000');

  if (!isDevtoolsSystemError || !isLocalMockEnabled()) {
    uni.showToast({ title: '未获得手机号授权', icon: 'none' });
    return;
  }

  const confirmed = await showModal({
    title: '手机号绑定',
    content: '当前环境无法获取手机号，是否使用测试手机号？',
    confirmText: '模拟绑定',
  });

  if (confirmed) {
    await submitPhoneBinding('mock-phone-code', '13800138000');
  }
}

async function submitPhoneBinding(code: string, mockPhone?: string) {
  phoneLoading.value = true;
  try {
    setProfile(await bindWechatPhone(sessionState.userId, { code, mockPhone }));
    uni.showToast({ title: '手机号已绑定', icon: 'success' });
    await refresh();
  } catch (error) {
    const message = error instanceof Error ? error.message : '绑定失败';
    uni.showToast({ title: message.includes('phone already') ? '手机号已被绑定' : '绑定失败', icon: 'none' });
  } finally {
    phoneLoading.value = false;
  }
}

function handleBirthdayChange(event: { detail: { value: string } }) {
  birthday.value = event.detail.value;
}

async function saveBirthday() {
  if (!sessionState.userId) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  if (!birthday.value) {
    uni.showToast({ title: '请选择生日', icon: 'none' });
    return;
  }

  birthdaySaving.value = true;
  try {
    setProfile(await updateMyProfile(sessionState.userId, { birthday: birthday.value }));
    uni.showToast({ title: '生日已保存', icon: 'success' });
  } finally {
    birthdaySaving.value = false;
  }
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

function isLocalMockEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK_PHONE === 'true';
}

function goHome() {
  uni.navigateBack({ fail: () => uni.redirectTo({ url: '/pages/index/index' }) });
}

onShow(refresh);
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f7f4ef;
}

.header-card,
.card {
  border-radius: 30rpx;
  padding: 30rpx;
  background: #fff;
  box-shadow: 0 12rpx 38rpx rgba(31, 41, 55, 0.06);
}

.header-card {
  background: linear-gradient(135deg, #cf2c2c, #9b1717);
  color: #fff;
}

.header-title,
.section-title,
.empty-title {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
}


.card {
  margin-top: 22rpx;
}

.info-row {
  margin-top: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24rpx;
}

.info-label {
  color: #667085;
  font-size: 24rpx;
}

.info-value {
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
  text-align: right;
}

.wrap {
  max-width: 460rpx;
  word-break: break-all;
}

.picker {
  min-width: 280rpx;
  border: 1px solid #d0d5dd;
  border-radius: 18rpx;
  padding: 18rpx 20rpx;
  color: #111827;
}

.primary-btn,
.secondary-btn {
  margin-top: 24rpx;
  border-radius: 999rpx;
  font-weight: 800;
}

.primary-btn {
  background: #d72d2d;
  color: #fff;
}

.secondary-btn {
  background: #fff3e0;
  color: #9b1717;
}

</style>
