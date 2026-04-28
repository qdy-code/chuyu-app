<template>
  <view class="page">
    <view class="card">
      <text class="title">会员中心</text>
      <text class="desc">演示链路：微信登录 + 会员信息 + 充值申请 + 消费记录</text>
      <button class="btn" @click="handleLogin" :disabled="loading">
        {{ loading ? '登录中...' : '一键微信登录（演示）' }}
      </button>
      <button class="btn ghost" @click="goProfile" :disabled="!sessionState.userId">查看个人信息</button>
    </view>

    <view class="card" v-if="sessionState.profile">
      <text class="subtitle">当前会员</text>
      <text>昵称：{{ sessionState.profile.nickname }}</text>
      <text>生日：{{ sessionState.profile.birthday || '未设置' }}</text>
      <text>等级：{{ sessionState.profile.levelName }}</text>
      <text>余额：{{ sessionState.profile.balance }}</text>
      <text>积分：{{ sessionState.profile.points }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { getMyProfile, wechatLoginWithProfile } from '@/utils/api';
import { sessionState } from '@/store/session';

const loading = ref(false);
const OPEN_ID_HINT_KEY = 'member-open-id-hint';

function requestLoginCode(): Promise<string> {
  return new Promise((resolve) => {
    uni.login({
      provider: 'weixin',
      success: (result) => resolve(result.code || `demo-${Date.now()}`),
      fail: () => resolve(`demo-${Date.now()}`),
    });
  });
}

function requestUserProfile(): Promise<{ nickname?: string; avatarUrl?: string }> {
  return new Promise((resolve) => {
    const getUserProfile = (uni as typeof uni & {
      getUserProfile?: (options: {
        desc: string;
        success: (result: { userInfo?: { nickName?: string; avatarUrl?: string } }) => void;
        fail: () => void;
      }) => void;
    }).getUserProfile;

    if (!getUserProfile) {
      resolve({});
      return;
    }

    getUserProfile({
      desc: '用于完善会员昵称和头像',
      success: (result) => {
        resolve({
          nickname: result.userInfo?.nickName,
          avatarUrl: result.userInfo?.avatarUrl,
        });
      },
      fail: () => resolve({}),
    });
  });
}

function getStableOpenIdHint(): string {
  const cached = uni.getStorageSync(OPEN_ID_HINT_KEY);
  if (cached) {
    return cached;
  }
  const nextId = `wx-openid-${Date.now()}`;
  uni.setStorageSync(OPEN_ID_HINT_KEY, nextId);
  return nextId;
}

async function handleLogin() {
  loading.value = true;
  try {
    const [code, profile] = await Promise.all([requestLoginCode(), requestUserProfile()]);
    const response = await wechatLoginWithProfile({
      code,
      openIdHint: getStableOpenIdHint(),
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl,
    });
    sessionState.token = response.token;
    sessionState.userId = response.user.id;
    sessionState.profile = await getMyProfile(response.user.id);
    uni.showToast({ title: '登录成功', icon: 'success' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '登录失败';
    uni.showToast({ title: `登录失败: ${message.slice(0, 18)}`, icon: 'none' });
    console.error('login error:', error);
  } finally {
    loading.value = false;
  }
}

function goProfile() {
  uni.navigateTo({ url: '/pages/profile/profile' });
}
</script>

<style scoped>
.page {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.title {
  font-size: 40rpx;
  font-weight: 700;
}

.subtitle {
  font-size: 30rpx;
  font-weight: 600;
}

.desc {
  color: #475467;
  font-size: 24rpx;
}

.btn {
  margin-top: 8rpx;
  background: #0f766e;
  color: #fff;
}

.ghost {
  background: #e2e8f0;
  color: #0f172a;
}
</style>
