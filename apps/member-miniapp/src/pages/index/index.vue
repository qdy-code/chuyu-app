<template>
  <view class="page">
    <image class="page-texture" src="/static/brand/app-bg.jpg" mode="aspectFill" aria-hidden="true" />
    <view v-if="!sessionState.userId || !legalAccepted || needsPhoneSetup" class="guest-brand">
      <image class="brand-mark" :src="brandAvatar" mode="aspectFill" />
      <text>月光石屿 MOONISLE</text>
    </view>

    <view v-if="!sessionState.userId" class="entry-card">
      <text class="entry-title">会员登录</text>
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
      <button
        class="primary-btn phone-login"
        open-type="getPhoneNumber|agreePrivacyAuthorization"
        :disabled="loggingIn || savingPhone || !legalAccepted"
        @getphonenumber="handleWechatPhone"
      >
        {{ savingPhone ? '登录中...' : '手机号授权登录' }}
      </button>
      <button class="link-refresh password-entry" :disabled="loggingIn || savingPhone" @click="showPasswordLogin = !showPasswordLogin">账号密码登录</button>
      <view v-if="showPasswordLogin" class="password-form">
        <input v-model="loginUsername" class="phone-input" maxlength="32" placeholder="请输入账号" :disabled="loggingIn || savingPhone" />
        <input v-model="loginPassword" class="phone-input" password maxlength="128" placeholder="请输入密码" :disabled="loggingIn || savingPhone" @confirm="handlePasswordLogin" />
        <text v-if="passwordError" class="password-error">{{ passwordError }}</text>
        <button class="primary-btn" :disabled="loggingIn || savingPhone || !legalAccepted" @click="handlePasswordLogin">{{ loggingIn ? '登录中...' : '登录账户' }}</button>
      </view>
      <button class="link-refresh" @click="browseCatalog">先浏览作品</button>
    </view>

    <view v-else-if="!legalAccepted" class="entry-card">
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
      <button class="link-refresh" @click="browseCatalog">先浏览作品</button>
    </view>

    <view v-else-if="needsPhoneSetup" class="entry-card">
      <text class="entry-title">完成登录</text>
      <button
        class="primary-btn phone-login"
        open-type="getPhoneNumber|agreePrivacyAuthorization"
        :disabled="loggingIn || savingPhone || !legalAccepted"
        @getphonenumber="handleWechatPhone"
      >
        {{ savingPhone ? '登录中...' : '手机号授权登录' }}
      </button>
      <view v-if="phoneRecovery" class="member-link">
        <text class="entry-title">手机号已有会员</text>
        <text class="entry-desc">已通过微信验证 {{ phoneRecovery.maskedPhone }}。</text>
        <template v-if="phoneRecovery.mode === 'SELF_SERVICE'">
          <text class="entry-desc">原账号没有余额、积分、业务记录或银豹关联。确认后将恢复原会员号，并更换为当前微信登录；原微信登录将失效。</text>
          <button class="primary-btn" :disabled="savingPhone" @click="confirmRecovery">确认找回并登录</button>
        </template>
        <text v-else class="entry-desc">这个手机号已有其他会员档案，请联系门店核对。</text>
        <button class="link-refresh" :disabled="savingPhone" @click="clearPhoneRecovery">返回</button>
      </view>
      <button class="link-refresh" :disabled="savingPhone" @click="showManualPhone = !showManualPhone">
        {{ showManualPhone ? '收起手动填写' : '手动填写手机号' }}
      </button>
      <view v-if="showManualPhone" class="phone-field">
        <text class="field-label">手机号</text>
        <input
          v-model="phoneInput"
          class="phone-input"
          type="number"
          maxlength="11"
          placeholder="请输入 11 位手机号"
        />
      </view>
      <button v-if="showManualPhone" class="primary-btn" :disabled="savingPhone" @click="submitPhone">
        {{ savingPhone ? '保存中...' : '完成并进入' }}
      </button>
      <button class="link-refresh password-entry" :disabled="savingPhone" @click="switchToPasswordLogin">账号密码登录</button>
      <button class="link-refresh" @click="browseCatalog">先浏览作品</button>
    </view>

    <template v-else>
      <view class="stats-card">
        <image class="stats-texture" src="/static/brand/member-card-bg.jpg" mode="aspectFill" aria-hidden="true" />
        <view class="stats-header">
          <button class="member-identity" hover-class="tap-feedback" @click="openAccountFromHeader">
            <image class="brand-mark" :src="headerAvatarSrc" mode="aspectFill" />
            <text class="hello">{{ welcomeText }}</text>
          </button>
          <button
            v-if="pospalLinked"
            class="refresh-button"
            hover-class="tap-feedback"
            :disabled="profileRefreshState.loading"
            aria-label="刷新余额与积分"
            @click="refreshSessionProfile"
          >{{ profileRefreshState.loading ? '刷新中' : '刷新' }}</button>
        </view>

        <view class="stats-values">
          <button class="stat" hover-class="tap-feedback" @click="openPage('/pages/card/card')">
            <text class="stat-label">余额</text>
            <text class="stat-value">
              <text v-if="!pospalUnlinked" class="stat-currency">¥</text>
              {{ pospalUnlinked ? '—' : formatMoney(sessionState.profile?.balance) }}
            </text>
          </button>
          <button class="stat" hover-class="tap-feedback" @click="openPage('/pages/card/card')">
            <text class="stat-label">积分</text>
            <text class="stat-value">{{ pospalUnlinked ? '—' : (sessionState.profile?.points ?? 0) }}</text>
          </button>
        </view>

        <text v-if="syncCaption" class="sync-caption">{{ syncCaption }}</text>
      </view>

      <view class="service-section">
        <view class="section-heading">
          <text class="section-title">我的服务</text>
          <view class="section-rule" aria-hidden="true" />
        </view>
        <view class="service-grid">
          <button
            v-for="service in services"
            :key="service.path"
            class="service-item"
            hover-class="tap-feedback"
            @click="openPage(service.path)"
          >
            <text>{{ service.label }}</text>
            <view class="service-chevron" aria-hidden="true" />
          </button>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { resumePendingBooking } from '@/utils/booking-flow';
import { onShow } from '@dcloudio/uni-app';
import { sessionState, setProfile, setLoginSession, clearSession } from '@/store/session';
import { beginPhoneRecovery, clearPhoneRecovery, phoneRecoveryState } from '@/utils/phone-recovery';
import { bindWechatPhone, confirmPhoneRecovery, memberPasswordLogin, readableErrorMessage, updateMyProfile } from '@/utils/api';
import { resolveImageForDisplay } from '@/utils/image-cache';
import {
  formatMoney,
  hasLegalConsent,
  loadSessionProfile,
  profileRefreshState,
  refreshSessionProfile,
  requireReadyMember,
  setLegalConsent,
  loginWithWechat,
} from '@/utils/member';

const phoneRecovery = computed(() => phoneRecoveryState.userId === sessionState.userId ? phoneRecoveryState.challenge : null);
const loggingIn = ref(false);
const showPasswordLogin = ref(false);
const loginUsername = ref('');
const loginPassword = ref('');
const passwordError = ref('');
const savingPhone = ref(false);
const phoneInput = ref('');
const showManualPhone = ref(false);
const brandAvatar = '/static/brand/logo-avatar-v2.png';
const headerAvatarSrc = ref(brandAvatar);
const legalAccepted = ref(hasLegalConsent());

const services = [
  { label: '我的预约', path: '/pages/appointment/appointment' },
  { label: '收藏与款式', path: '/pages/styles/styles' },
  { label: '消费记录', path: '/pages/consumptions/consumptions' },
  { label: '充值记录', path: '/pages/recharge/recharge' },
  { label: '账户资料', path: '/pages/account/account' },
  { label: '留言给门店', path: '/pages/messages/messages' },
];

watch(() => [sessionState.userId, sessionState.profile?.avatarUrl] as const, async ([, avatar], _previous, onCleanup) => {
  let current = true;
  onCleanup(() => { current = false; });
  headerAvatarSrc.value = brandAvatar;
  if (!avatar) return;
  const display = await resolveImageForDisplay(avatar, brandAvatar);
  if (current) headerAvatarSrc.value = display;
}, { immediate: true });

const welcomeText = computed(() => {
  const nickname = sessionState.profile?.nickname;
  return nickname && nickname !== '微信用户' ? nickname : '月光会员';
});
const needsPhoneSetup = computed(() => Boolean(sessionState.userId && !sessionState.profile?.phone && sessionState.loginMethod !== 'password'));
const pospalLinked = computed(() => sessionState.profile?.pospal?.state === 'LINKED');
const pospalUnlinked = computed(() => sessionState.profile?.pospal?.state === 'UNLINKED');
const syncCaption = computed(() => {
  const pospal = sessionState.profile?.pospal;
  if (pospalUnlinked.value) {
    const state = pospal?.memberSync?.state;
    return state === 'PENDING' || state === 'RUNNING' ? '会员同步中' : '会员待关联';
  }
  if (profileRefreshState.errorMessage) return '刷新失败，请重试';
  if (!pospal?.syncedAt) return '';
  const updatedAt = new Date(pospal.syncedAt);
  if (Number.isNaN(updatedAt.getTime())) return '';
  const hours = String(updatedAt.getHours()).padStart(2, '0');
  const minutes = String(updatedAt.getMinutes()).padStart(2, '0');
  return `更新于 ${updatedAt.getMonth() + 1}/${updatedAt.getDate()} ${hours}:${minutes}`;
});

function browseCatalog() {
  uni.switchTab({ url: '/pages/nail/nail' });
}

function switchToPasswordLogin() {
  clearSession();
  clearPhoneRecovery();
  showPasswordLogin.value = true;
  passwordError.value = '';
  loginPassword.value = '';
}

async function handlePasswordLogin() {
  if (loggingIn.value || savingPhone.value) return;
  passwordError.value = '';
  if (!legalAccepted.value) { passwordError.value = '请先阅读并同意协议'; return; }
  const username = loginUsername.value.trim();
  if (!/^[a-zA-Z0-9_]{4,32}$/.test(username) || !loginPassword.value) { passwordError.value = '请填写正确的账号和密码'; return; }
  loggingIn.value = true;
  try {
    const response = await memberPasswordLogin(username, loginPassword.value);
    setLoginSession(response);
    showPasswordLogin.value = false;
    loginUsername.value = '';
    resumePendingBooking();
  } catch (error) {
    passwordError.value = readableErrorMessage(error, '登录未完成');
  } finally { loginPassword.value = ''; loggingIn.value = false; }
}

function handleLegalConsentChange(event: { detail: { value: string[] } }) {
  legalAccepted.value = event.detail.value.includes('accepted');
  setLegalConsent(legalAccepted.value);
}

function acceptLegalTerms() {
  legalAccepted.value = true;
  setLegalConsent(true);
  resumePendingBooking();
}

function completeEntry() {
  resumePendingBooking();
}

async function handleWechatPhone(event: { detail: { code?: string; errMsg?: string; errno?: number } }) {
  if (loggingIn.value || savingPhone.value) return;
  if (!legalAccepted.value || !hasLegalConsent()) {
    uni.showToast({ title: '请先阅读并同意协议', icon: 'none' });
    return;
  }
  const { code, errMsg = '', errno } = event.detail;
  if (!code) {
    showManualPhone.value = Boolean(sessionState.userId);
    const content = /deny|cancel/i.test(errMsg)
      ? '你暂未授权手机号，可稍后重试，或使用下方账号密码登录。浏览作品无需登录。'
      : errno === 1400001
        ? '手机号授权暂不可用，请稍后重试或使用账号密码登录。'
        : '手机号授权未完成，请重新授权或使用账号密码登录。';
    uni.showModal({ title: '手机号授权登录', content, showCancel: false });
    return;
  }
  savingPhone.value = true;
  try {
    // Authenticate the current WeChat identity before using the one-time phone
    // code. Never reuse a cached password/other-member session for phone binding.
    await loginWithWechat();
    const profile = await bindWechatPhone(code);
    setProfile(profile);
    phoneInput.value = profile.phone || '';
    showManualPhone.value = false;
    clearPhoneRecovery();
    uni.showToast({ title: '登录成功', icon: 'success' });
    completeEntry();
  } catch (error) {
    if (beginPhoneRecovery(error)) { showManualPhone.value = false; return; }
    showManualPhone.value = Boolean(sessionState.userId);
    uni.showModal({ title: '登录未完成', content: readableErrorMessage(error, '请重新点击手机号授权登录后重试'), showCancel: false });
  } finally {
    savingPhone.value = false;
  }
}

async function confirmRecovery() {
  const challenge = phoneRecovery.value;
  if (!challenge || challenge.mode !== 'SELF_SERVICE' || savingPhone.value) return;
  savingPhone.value = true;
  try {
    const response = await confirmPhoneRecovery(challenge.code);
    setLoginSession(response);
    clearPhoneRecovery();
    phoneInput.value = response.user.phone || '';
    uni.showToast({ title: '已找回原会员', icon: 'success' });
    completeEntry();
  } catch (error) {
    clearPhoneRecovery();
    uni.showModal({ title: '找回未完成', content: readableErrorMessage(error, '请重新微信验证手机号，或联系门店核验'), showCancel: false });
  } finally { savingPhone.value = false; }
}

async function submitPhone() {
  if (savingPhone.value) return;
  const phone = phoneInput.value.trim();
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    uni.showToast({ title: '请输入正确手机号', icon: 'none' });
    return;
  }
  savingPhone.value = true;
  try {
    setProfile(await updateMyProfile({ phone }));
    await loadSessionProfile();
    uni.showToast({ title: '已完成', icon: 'success' });
    completeEntry();
  } catch (error) {
    const message = readableErrorMessage(error, '保存失败');
    if (message.includes('手机号已被其他会员使用')) {
      uni.showModal({
        title: '手机号已使用',
        content: '该手机号已有会员。请使用上方的手机号授权登录，按页面提示继续。',
        confirmText: '去微信验证',
        cancelText: '稍后处理',
        success: (result) => { if (result.confirm) { showManualPhone.value = false; clearPhoneRecovery(); } },
      });
    } else {
      uni.showToast({ title: message.slice(0, 18), icon: 'none' });
    }
  } finally {
    savingPhone.value = false;
  }
}

function openPage(url: string) {
  if (!requireReadyMember()) return;
  uni.navigateTo({ url });
}

async function openAccountFromHeader() {
  if (loggingIn.value || savingPhone.value) return;
  if (!sessionState.userId) {
    uni.showToast({ title: '请点击手机号授权登录', icon: 'none' });
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
  await loadSessionProfile();
  phoneInput.value = sessionState.profile?.phone || phoneInput.value;
  resumePendingBooking();
});
</script>

<style scoped>
.password-form { display: grid; gap: 20rpx; margin-top: 16rpx; }
.password-form .phone-input { box-sizing: border-box; width: 100%; height: 96rpx; padding: 20rpx 24rpx; border-radius: 16rpx; background: #f7f4ef; font-size: 28rpx; font-weight: 400; }
.password-error { color: #a33e3e; font-size: 24rpx; line-height: 1.6; }
.page {
  position: relative;
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx 28rpx 46rpx;
  background: linear-gradient(165deg, #fbf8f1 0%, #f7f4ef 54%, #edf0f1 100%);
}

.page-texture {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.27;
  pointer-events: none;
}

.guest-brand,
.entry-card,
.stats-card,
.service-section {
  position: relative;
}

.member-link {
  margin-top: 28rpx;
  padding-top: 28rpx;
  border-top: 1px solid #dbe1e5;
  text-align: center;
}

.link-refresh {
  margin-top: 16rpx;
  background: transparent;
  color: #526675;
  font-size: 26rpx;
}

.link-refresh::after { border: 0; }

.guest-brand {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 28rpx;
  color: #3d4652;
  font-size: 26rpx;
  font-weight: 600;
}

.brand-mark {
  width: 58rpx;
  height: 58rpx;
  flex: 0 0 58rpx;
  border-radius: 50%;
  background: #fff;
}

.entry-card {
  border-radius: 30rpx;
  padding: 30rpx;
  background: linear-gradient(145deg, #fffefa 0%, #faf7f1 100%);
  border: 1px solid #e8e0d3;
  box-shadow: 0 12rpx 30rpx rgba(75, 69, 57, 0.07);
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
  color: #596873;
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
  color: #475e6a;
}

.stats-card {
  padding: 18rpx 32rpx 28rpx;
  overflow: hidden;
  border: 1px solid #d7dddc;
  border-radius: 32rpx;
  background: linear-gradient(145deg, #fbf8ef 0%, #edf1f0 54%, #e3ebef 100%);
  box-shadow: 0 12rpx 30rpx rgba(63, 78, 84, 0.09);
}

.stats-texture {
  position: absolute;
  top: -5%;
  left: -5%;
  width: 110%;
  height: 110%;
  opacity: 0.43;
  pointer-events: none;
}

.stats-header,
.stats-values,
.sync-caption {
  position: relative;
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.member-identity,
.refresh-button,
.stat,
.service-item {
  margin: 0;
  padding: 0;
  color: #2b353b;
  line-height: 1.35;
  text-align: left;
  background: transparent;
  touch-action: manipulation;
}

.member-identity::after,
.refresh-button::after,
.stat::after,
.service-item::after { border: 0; }

.member-identity {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 14rpx;
  min-width: 0;
  min-height: 44px;
}

.hello {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 29rpx;
  font-weight: 600;
}

.refresh-button {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  min-height: 44px;
  border-radius: 18rpx;
  color: #465b62;
  font-size: 25rpx;
}
.refresh-button[disabled] { color: #52666d; background: transparent; }

.stats-values {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  margin-top: 12rpx;
  padding-top: 22rpx;
  border-top: 1px solid rgba(86, 104, 108, 0.17);
}

.stat {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 44px;
  border-radius: 12rpx;
}
.stat + .stat {
  padding-left: 28rpx;
  border-left: 1px solid rgba(86, 104, 108, 0.17);
  border-radius: 0 12rpx 12rpx 0;
}

.stat-label,
.stat-value { display: block; }
.stat-label { color: #4e6169; font-size: 25rpx; }
.stat-value {
  margin-top: 8rpx;
  color: #27363e;
  font-size: 46rpx;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.stat-currency { margin-right: 4rpx; font-size: 28rpx; }
.sync-caption { display: block; margin-top: 16rpx; color: #50636a; font-size: 23rpx; }

.service-section { margin-top: 35rpx; }
.section-heading {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin: 0 2rpx 18rpx;
}

.section-title {
  color: #2b353b;
  font-size: 31rpx;
  font-weight: 650;
}

.section-rule {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(164, 139, 91, 0.48), rgba(164, 139, 91, 0.05));
}

.service-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.service-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  box-sizing: border-box;
  width: 100%;
  min-height: 50px;
  padding: 20rpx 24rpx;
  border: 1px solid rgba(102, 122, 130, 0.22);
  border-radius: 24rpx;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.62), rgba(249, 251, 251, 0.16));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.76), 0 3rpx 10rpx rgba(51, 72, 83, 0.035);
  font-size: 27rpx;
  font-weight: 550;
}

.service-chevron {
  width: 9rpx;
  height: 9rpx;
  flex: 0 0 9rpx;
  border-top: 1px solid #677780;
  border-right: 1px solid #677780;
  transform: rotate(45deg);
}

.tap-feedback { background: rgba(70, 93, 101, 0.08); }
.service-item.tap-feedback { background: rgba(99, 129, 142, 0.16); }
</style>
