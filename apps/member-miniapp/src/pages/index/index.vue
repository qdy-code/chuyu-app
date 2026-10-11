<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view class="top-bar">
      <view class="brand-lockup" @click="openAccountFromHeader">
        <image class="brand-mark" :src="headerAvatarSrc" mode="aspectFill" />
        <view>
          <text class="brand">月光石屿MOONISLE</text>
          <text class="hello">{{ welcomeText }}</text>
        </view>
      </view>
    </view>

    <view v-if="!sessionState.userId" class="entry-card">
      <text class="entry-kicker">会员登录</text>
      <text class="entry-title">进入我的账户</text>
      <text class="entry-desc">登录后可查看会员卡、余额积分、消费记录和预约记录。</text>
      <view class="legal-consent">
        <checkbox-group @change="handleLegalConsentChange">
          <label class="consent-label">
            <checkbox value="accepted" :checked="legalAccepted" color="#3d4652" />
            <text>我已阅读并同意</text>
          </label>
        </checkbox-group>
        <view class="legal-links">
          <text class="legal-link" @click.stop="openTerms">《用户协议》</text>
          <text>与</text>
          <text class="legal-link" @click.stop="openPrivacy">《隐私政策》</text>
        </view>
      </view>
      <button class="primary-btn" :disabled="loggingIn || !legalAccepted" @click="handleEnter">
        {{ loggingIn ? '登录中...' : '微信登录' }}
      </button>
    </view>

    <view v-else-if="!legalAccepted" class="entry-card">
      <text class="entry-kicker">协议更新</text>
      <text class="entry-title">确认隐私与服务条款</text>
      <text class="entry-desc">继续使用前，请阅读并确认最新的隐私政策和用户协议。</text>
      <view class="legal-consent">
        <view class="legal-links">
          <text class="legal-link" @click="openTerms">《用户协议》</text>
          <text>与</text>
          <text class="legal-link" @click="openPrivacy">《隐私政策》</text>
        </view>
      </view>
      <button class="primary-btn" @click="acceptLegalTerms">同意并继续</button>
    </view>

    <view v-else-if="needsPhoneSetup" class="entry-card">
      <text class="entry-kicker">首次使用</text>
      <text class="entry-title">填写手机号</text>
      <text class="entry-desc">只需要填写手机号，方便门店确认预约和会员资料。</text>
      <view class="phone-field">
        <text class="field-label">手机号</text>
        <input
          v-model="phoneInput"
          class="phone-input"
          type="number"
          maxlength="11"
          placeholder="请输入 11 位手机号"
        />
      </view>
      <button class="primary-btn" :disabled="savingPhone" @click="submitPhone">
        {{ savingPhone ? '保存中...' : '完成并进入' }}
      </button>
      <view v-if="linkCode" class="member-link">
        <text class="field-label">等待门店核验</text>
        <text class="link-code" selectable>{{ linkCode.code }}</text>
        <text class="entry-desc">关联码 {{ linkExpiresText }} 失效，仅向门店工作人员出示。</text>
        <button class="primary-btn" :disabled="linkBusy" @click="refreshLinkedMember">{{ linkBusy ? '查询中...' : '门店已确认，刷新资料' }}</button>
        <button class="link-refresh" :disabled="linkBusy" @click="linkExistingMember">重新生成关联码</button>
      </view>
    </view>

    <template v-else>
      <view class="member-card" @click="openPage('/pages/card/card')">
        <image class="card-bg" src="/static/brand/member-card-bg.jpg" mode="aspectFill" />
        <view class="member-main">
          <text class="card-label">我的会员卡</text>
          <text class="card-title">{{ sessionState.profile?.levelName || '会员' }}</text>
          <text class="card-desc">会员号：{{ sessionState.profile?.id }}</text>
        </view>
        <view class="discount-badge">
          <text class="discount-value">{{ discountText(sessionState.profile?.discountRate) }}</text>
          <text class="discount-label">会员折扣</text>
        </view>
      </view>

      <view class="stats-card">
        <view class="stat">
          <text class="stat-value">¥{{ formatMoney(sessionState.profile?.balance) }}</text>
          <text class="stat-label">余额</text>
        </view>
        <view class="divider" />
        <view class="stat">
          <text class="stat-value">{{ sessionState.profile?.points || 0 }}</text>
          <text class="stat-label">积分</text>
        </view>
        <view class="divider" />
        <view class="stat">
          <text class="stat-value">{{ sessionState.profile?.phone || '-' }}</text>
          <text class="stat-label">手机号</text>
        </view>
      </view>

      <view class="section">
        <text class="section-title">我的服务</text>
        <view class="service-grid">
          <button class="service-item" @click="openPage('/pages/appointment/appointment')">我的预约</button>
          <button class="service-item" @click="openPage('/pages/consumptions/consumptions')">消费记录</button>
          <button class="service-item" @click="openPage('/pages/recharge/recharge')">充值记录</button>
          <button class="service-item" @click="openPage('/pages/account/account')">账户资料</button>
          <button class="service-item" @click="openPage('/pages/messages/messages')">留言给门店</button>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { sessionState } from '@/store/session';
import { createMemberLinkCode, readableErrorMessage, updateMyProfile } from '@/utils/api';
import type { MemberLinkCode } from '@member-platform/shared';
import { resolveImageForDisplay } from '@/utils/image-cache';
import {
  discountText,
  ensureSession,
  formatMoney,
  hasLegalConsent,
  refreshSessionProfile,
  requireReadyMember,
  setLegalConsent,
  loginWithWechat,
} from '@/utils/member';

const loggingIn = ref(false);
const savingPhone = ref(false);
const linkBusy = ref(false);
const linkCode = ref<MemberLinkCode | null>(null);
const linkExpiresText = computed(() => linkCode.value ? new Date(linkCode.value.expiresAt).toTimeString().slice(0, 5) : '');
const phoneInput = ref('');
const headerAvatarSrc = ref('/static/brand/logo-avatar-v2.png');
const legalAccepted = ref(hasLegalConsent());

const welcomeText = computed(() => sessionState.profile?.nickname || '我的');
const needsPhoneSetup = computed(() => Boolean(sessionState.userId && !sessionState.profile?.phone));

async function handleEnter() {
  if (loggingIn.value) return;
  if (!legalAccepted.value) {
    uni.showToast({ title: '请先阅读并同意协议', icon: 'none' });
    return;
  }
  loggingIn.value = true;
  try {
    await ensureSession();
    phoneInput.value = sessionState.profile?.phone || '';
  } catch (error) {
    console.error('[member login failed]', error);
    uni.showToast({ title: readableErrorMessage(error, '登录未完成').slice(0, 18), icon: 'none' });
  } finally {
    loggingIn.value = false;
  }
}

function handleLegalConsentChange(event: { detail: { value: string[] } }) {
  legalAccepted.value = event.detail.value.includes('accepted');
  setLegalConsent(legalAccepted.value);
}

function acceptLegalTerms() {
  legalAccepted.value = true;
  setLegalConsent(true);
}

async function submitPhone() {
  if (savingPhone.value || linkBusy.value) return;
  const phone = phoneInput.value.trim();
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    uni.showToast({ title: '请输入正确手机号', icon: 'none' });
    return;
  }
  savingPhone.value = true;
  try {
    await updateMyProfile({ phone });
    await refreshSessionProfile();
    uni.showToast({ title: '已完成', icon: 'success' });
  } catch (error) {
    const message = readableErrorMessage(error, '保存失败');
    if (message.includes('手机号已被其他会员使用')) {
      uni.showModal({
        title: '手机号已使用',
        content: message,
        confirmText: '关联老会员',
        cancelText: '稍后处理',
        success: (result) => { if (result.confirm) void linkExistingMember(); },
      });
    } else {
      uni.showToast({ title: message.slice(0, 18), icon: 'none' });
    }
  } finally {
    savingPhone.value = false;
  }
}

async function linkExistingMember() {
  if (linkBusy.value) return;
  linkBusy.value = true;
  try {
    linkCode.value = await createMemberLinkCode(phoneInput.value.trim());
  } catch (error) {
    uni.showModal({ title: '暂时无法关联', content: readableErrorMessage(error), showCancel: false });
  } finally {
    linkBusy.value = false;
  }
}

async function refreshLinkedMember() {
  if (linkBusy.value) return;
  linkBusy.value = true;
  try {
    await loginWithWechat();
    if (sessionState.profile?.phone) {
      linkCode.value = null;
      uni.showToast({ title: '已关联会员', icon: 'success' });
    } else {
      uni.showToast({ title: '等待门店确认', icon: 'none' });
    }
  } catch (error) {
    uni.showModal({ title: '查询未完成', content: readableErrorMessage(error), showCancel: false });
  } finally {
    linkBusy.value = false;
  }
}

function openPage(url: string) {
  if (!requireReadyMember()) return;
  uni.navigateTo({ url });
}

async function openAccountFromHeader() {
  if (!sessionState.userId) {
    await handleEnter();
    return;
  }
  if (!requireReadyMember()) return;
  uni.navigateTo({ url: '/pages/account/account' });
}

function openPrivacy() {
  uni.navigateTo({ url: '/pages/legal/privacy' });
}

function openTerms() {
  uni.navigateTo({ url: '/pages/legal/terms' });
}

onShow(async () => {
  legalAccepted.value = hasLegalConsent();
  if (linkCode.value && legalAccepted.value) await refreshLinkedMember();
  else await refreshSessionProfile();
  phoneInput.value = sessionState.profile?.phone || phoneInput.value;
  headerAvatarSrc.value = await resolveImageForDisplay(
    sessionState.profile?.avatarUrl,
    '/static/brand/logo-avatar-v2.png',
  );
});
</script>

<style scoped>
.page {
  position: relative;
  min-height: 100vh;
  padding: 32rpx 24rpx 48rpx;
  background: #f7f4ef;
}

.member-link {
  margin-top: 28rpx;
  padding-top: 28rpx;
  border-top: 1px solid #dbe1e5;
  text-align: center;
}

.link-code {
  display: block;
  margin-top: 16rpx;
  font-size: 48rpx;
  font-weight: 700;
  color: #273247;
}

.link-refresh {
  margin-top: 16rpx;
  background: transparent;
  color: #526675;
  font-size: 26rpx;
}

.link-refresh::after { border: 0; }

.page-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

.top-bar,
.entry-card,
.member-card,
.stats-card,
.section {
  position: relative;
  z-index: 1;
}

.top-bar,
.brand-lockup {
  display: flex;
  align-items: center;
}

.top-bar {
  justify-content: space-between;
}

.brand-lockup {
  gap: 18rpx;
  min-width: 0;
}

.brand-mark {
  width: 82rpx;
  height: 82rpx;
  flex: 0 0 82rpx;
  border-radius: 50%;
  box-shadow: 0 12rpx 30rpx rgba(18, 24, 38, 0.16);
}

.brand,
.hello {
  display: block;
}

.brand {
  color: #273247;
  font-size: 28rpx;
  font-weight: 800;
}

.hello {
  margin-top: 8rpx;
  color: #111827;
  font-size: 38rpx;
  font-weight: 900;
}

.entry-card,
.section,
.stats-card {
  margin-top: 30rpx;
  border-radius: 32rpx;
  padding: 34rpx;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18rpx 54rpx rgba(31, 41, 55, 0.08);
}

.entry-kicker {
  color: #72818d;
  font-size: 23rpx;
  font-weight: 900;
}

.entry-title {
  display: block;
  margin-top: 12rpx;
  color: #111827;
  font-size: 44rpx;
  font-weight: 900;
}

.entry-desc {
  display: block;
  margin-top: 14rpx;
  color: #667085;
  font-size: 27rpx;
  line-height: 1.55;
}

.phone-field {
  margin-top: 28rpx;
  border-radius: 24rpx;
  padding: 22rpx;
  background: #f8fafc;
}

.field-label,
.phone-input {
  display: block;
}

.field-label {
  color: #667085;
  font-size: 23rpx;
  font-weight: 900;
}

.phone-input {
  margin-top: 10rpx;
  width: 100%;
  color: #111827;
  font-size: 34rpx;
  font-weight: 900;
}

.primary-btn {
  margin-top: 30rpx;
  border-radius: 999rpx;
  background: #3d4652;
  color: #f7f4ef;
  font-weight: 900;
}

.legal-consent,
.legal-links,
.consent-label {
  display: flex;
  align-items: center;
}

.legal-consent {
  margin-top: 22rpx;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8rpx;
  color: #98a2b3;
  font-size: 22rpx;
}

.consent-label,
.legal-links {
  gap: 4rpx;
}

.consent-label checkbox {
  transform: scale(0.78);
}

.legal-link {
  color: #6f7f8a;
}

.member-card {
  overflow: hidden;
  margin-top: 32rpx;
  min-height: 300rpx;
  border-radius: 36rpx;
  padding: 38rpx;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
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

.member-main,
.discount-badge {
  position: relative;
  z-index: 1;
}

.card-label,
.card-desc,
.discount-label,
.stat-label {
  font-size: 24rpx;
  opacity: 0.78;
}

.card-title {
  display: block;
  margin-top: 18rpx;
  font-size: 44rpx;
  font-weight: 900;
}

.card-desc {
  display: block;
  margin-top: 18rpx;
}

.discount-badge {
  width: 148rpx;
  height: 148rpx;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.42);
}

.discount-value {
  font-size: 30rpx;
  font-weight: 900;
}

.stats-card {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
}

.stat {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.stat-value {
  display: block;
  color: #111827;
  font-size: 28rpx;
  font-weight: 900;
  word-break: break-all;
}

.stat-label {
  display: block;
  margin-top: 8rpx;
  color: #667085;
}

.divider {
  width: 1px;
  background: #edf2f4;
}

.section-title {
  display: block;
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}

.service-grid {
  margin-top: 20rpx;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
}

.service-item {
  margin: 0;
  border-radius: 24rpx;
  background: #f8fafc;
  color: #3d4652;
  font-size: 27rpx;
  font-weight: 900;
}
</style>
