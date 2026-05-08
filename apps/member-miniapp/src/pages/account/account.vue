<template>
  <view class="page">
    <view class="header-card">
      <text class="header-title">账户资料</text>
      <text class="header-desc">查看会员信息、维护生日并管理本机登录状态</text>
    </view>

    <view v-if="!sessionState.profile" class="card">
      <text class="empty-title">请先登录</text>
      <button class="primary-btn" @click="goHome">返回首页登录</button>
    </view>

    <template v-else>
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
        <text class="section-title">会员信息</text>
        <view class="info-row">
          <text class="info-label">会员ID</text>
          <text class="info-value wrap">{{ sessionState.profile.id }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">昵称</text>
          <text class="info-value">{{ sessionState.profile.nickname }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">会员等级</text>
          <text class="info-value">{{ sessionState.profile.levelName }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">联系手机号</text>
          <text class="info-value">{{ sessionState.profile.phone || '门店登记后显示' }}</text>
        </view>
        <text class="hint">手机号由门店管理员在到店时为你登记，无需在小程序内填写。</text>
      </view>

      <view class="card danger-zone">
        <text class="section-title">登录状态</text>
        <text class="hint">退出后会清除本机缓存的会员登录状态，下次进入会自动重新登录。</text>
        <button class="logout-btn" @click="confirmLogout">退出登录</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { updateMyProfile } from '@/utils/api';
import { clearSession, sessionState, setProfile } from '@/store/session';
import { refreshSessionProfile } from '@/utils/member';

const birthday = ref('');
const birthdaySaving = ref(false);

async function refresh() {
  await refreshSessionProfile();
  birthday.value = sessionState.profile?.birthday || '';
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
    setProfile(await updateMyProfile({ birthday: birthday.value }));
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

function goHome() {
  uni.reLaunch({ url: '/pages/index/index' });
}

async function confirmLogout() {
  const confirmed = await showModal({
    title: '退出登录',
    content: '确认清除当前会员登录状态吗？',
    confirmText: '退出',
  });
  if (!confirmed) return;

  clearSession();
  birthday.value = '';
  uni.showToast({ title: '已退出登录', icon: 'success' });
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/index/index' });
  }, 500);
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

.header-desc {
  display: block;
  margin-top: 10rpx;
  color: rgba(255, 255, 255, 0.82);
  font-size: 24rpx;
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

.danger-zone {
  border: 1px solid rgba(215, 45, 45, 0.14);
}

.hint {
  display: block;
  margin-top: 12rpx;
  color: #667085;
  font-size: 24rpx;
  line-height: 1.6;
}

.logout-btn {
  margin-top: 24rpx;
  border-radius: 999rpx;
  background: #fff1f1;
  color: #b42318;
  font-weight: 900;
}
</style>
