<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view class="header-card">
      <image class="header-bg" src="/static/brand/account-header.jpg" mode="aspectFill" />
      <view class="header-copy">
        <text class="header-kicker">MOONSTONE ISLE</text>
        <text class="header-title">{{ setupMode ? '完善会员资料' : '账户资料' }}</text>
        <text class="header-desc">{{ setupMode ? '选择微信头像和昵称，保存到门店会员后台；也可稍后完善。' : '修改头像和昵称，查看会员号并管理个人资料' }}</text>
      </view>
    </view>

    <view v-if="!sessionState.profile" class="card">
      <text class="empty-title">请先登录</text>
      <button class="primary-btn" @click="goHome">返回首页登录</button>
    </view>

    <template v-else>
      <view class="card avatar-card">
        <view class="section-heading">
          <text class="section-title">我的头像</text>
          <text class="required-pill">可修改</text>
        </view>
        <view class="avatar-setting">
          <button
            class="avatar-picker"
            open-type="chooseAvatar"
            :disabled="avatarSaving || nicknameSaving"
            @chooseavatar="handleWechatAvatar"
          >
            <image class="profile-avatar" :src="avatarSrc" mode="aspectFill" />
          </button>
          <view class="avatar-copy">
            <text class="avatar-title">{{ avatarSaving ? '头像上传中...' : '点击头像选择微信头像' }}</text>
            <text class="hint">保存后用于会员资料和预约信息。</text>
          </view>
        </view>
      </view>

      <form class="card" @submit="saveNickname">
        <view class="section-heading">
          <text class="section-title">我的昵称</text>
          <text class="required-pill">可修改</text>
        </view>
        <input
          v-model="nickname"
          class="input"
          type="nickname"
          name="nickname"
          maxlength="30"
          placeholder="点击选择微信昵称，也可自定义"
        />
        <text class="hint">昵称用于小程序内展示，可随时修改；会员号由系统生成且不可修改。</text>
        <button class="secondary-btn" form-type="submit" :disabled="nicknameSaving || avatarSaving">
          {{ nicknameSaving ? '保存中...' : setupMode ? '保存昵称并进入' : '保存昵称' }}
        </button>
      </form>

      <view v-if="setupMode" class="card">
        <text class="hint">头像选择后即上传保存，昵称点击保存后同步到会员后台。</text>
        <button class="secondary-btn" :disabled="nicknameSaving || avatarSaving" @click="goHome">稍后完善，进入会员中心</button>
      </view>

      <view v-if="!setupMode" class="card">
        <view class="section-heading">
          <text class="section-title">生日</text>
          <text v-if="!birthdayLocked" class="required-pill">可设置 · 月日</text>
        </view>
        <view class="info-row">
          <text class="info-label">生日日期</text>
          <picker
            mode="multiSelector"
            :range="birthdayPickerRange"
            :value="birthdayPickerValue"
            :disabled="birthdayLocked"
            @columnchange="handleBirthdayColumnChange"
            @change="handleBirthdayChange"
          >
            <view class="picker" :class="{ disabled: birthdayLocked }">{{ birthday || '请选择月日' }}</view>
          </picker>
        </view>
        <text class="hint">{{ birthdayLocked ? '生日日期已保存，顾客端不可再次修改。' : '生日仅记录月日，不包含年份，保存后顾客端仅可设置一次。' }}</text>
        <button class="secondary-btn" @click="saveBirthday" :disabled="birthdaySaving || birthdayLocked">
          {{ birthdayLocked ? '生日已锁定' : birthdaySaving ? '保存中...' : '保存生日日期' }}
        </button>
      </view>

      <view v-if="!setupMode" class="card">
        <text class="section-title">会员信息</text>
        <view class="info-row">
          <text class="info-label">会员号</text>
          <text class="info-value wrap">{{ memberNumber(sessionState.profile) }}</text>
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
          <text class="info-value">{{ sessionState.profile.phone || '未填写' }}</text>
        </view>
        <text class="hint">手机号由微信授权或主动填写，用于门店确认预约和会员资料。</text>
      </view>

      <view v-if="!setupMode" class="card danger-zone">
        <text class="section-title">登录状态</text>
        <text class="hint">退出后会清除本机缓存的会员登录状态，下次进入会自动重新登录。</text>
        <button class="logout-btn" @click="confirmLogout">退出登录</button>
      </view>
    </template>

    <view class="footer">
      <view class="legal-links">
        <text class="legal-link" @click="openPrivacy">隐私政策</text>
        <text class="legal-divider">·</text>
        <text class="legal-link" @click="openTerms">用户协议</text>
      </view>
      <text class="footer-line">© {{ year }} 月光石屿MOONISLE</text>
      <text v-if="icpRecord" class="footer-line">{{ icpRecord }}</text>
      <text v-if="publicSecurityRecord" class="footer-line">{{ publicSecurityRecord }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { memberNumber } from '@/utils/member-display';
import { clearPendingBooking } from '@/utils/booking-flow';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { readableErrorMessage, updateMyProfile, uploadMyAvatar } from '@/utils/api';
import { clearSession, sessionState, setProfile } from '@/store/session';
import { resolveImageForDisplay } from '@/utils/image-cache';
import { loadSessionProfile } from '@/utils/member';

const nickname = ref('');
const setupMode = ref(false);
const nicknameSaving = ref(false);
const avatarSaving = ref(false);
const avatarSrc = ref('/static/brand/logo-avatar-v2.png');
const birthday = ref('');
const birthdaySaving = ref(false);
const birthdayLocked = computed(() => Boolean(sessionState.profile?.birthday));
const monthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const birthdayPickerValue = ref([0, 0]);
const selectedMonth = computed(() => monthOptions[birthdayPickerValue.value[0]] || '01');
const dayOptions = computed(() => {
  const month = Number(selectedMonth.value);
  const maxDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 31;
  return Array.from({ length: maxDays }, (_, index) => String(index + 1).padStart(2, '0'));
});
const birthdayPickerRange = computed(() => [monthOptions, dayOptions.value]);
const year = new Date().getFullYear();
const rawIcpRecord = (import.meta.env.VITE_ICP_RECORD as string | undefined)?.trim();
const icpRecord = rawIcpRecord && !/X{4,}|请填写|示例/i.test(rawIcpRecord) ? rawIcpRecord : undefined;
const publicSecurityRecord = import.meta.env.VITE_PUBLIC_SECURITY_RECORD as string | undefined;

async function refresh() {
  await loadSessionProfile();
  const currentNickname = sessionState.profile?.nickname || '';
  nickname.value = setupMode.value && currentNickname === '微信用户' ? '' : currentNickname;
  birthday.value = toBirthdayMonthDay(sessionState.profile?.birthday);
  syncBirthdayPicker(birthday.value);
  avatarSrc.value = await resolveImageForDisplay(
    sessionState.profile?.avatarUrl,
    '/static/brand/logo-avatar-v2.png',
  );
}

function handleBirthdayColumnChange(event: { detail: { column: number; value: number } }) {
  if (birthdayLocked.value) return;

  const next = [...birthdayPickerValue.value];
  next[event.detail.column] = event.detail.value;
  if (event.detail.column === 0) {
    next[1] = Math.min(next[1], dayOptions.value.length - 1);
  }
  birthdayPickerValue.value = next;
}

function handleBirthdayChange(event: { detail: { value: number[] } }) {
  if (birthdayLocked.value) return;
  birthdayPickerValue.value = event.detail.value;
  const month = monthOptions[birthdayPickerValue.value[0]] || '01';
  const day = dayOptions.value[birthdayPickerValue.value[1]] || '01';
  birthday.value = `${month}-${day}`;
}

function openPrivacy() {
  uni.navigateTo({ url: '/pages/legal/privacy' });
}

function openTerms() {
  uni.navigateTo({ url: '/pages/legal/terms' });
}

async function handleWechatAvatar(event: { detail: { avatarUrl?: string } }) {
  if (avatarSaving.value || nicknameSaving.value) return;
  const filePath = event.detail.avatarUrl;
  if (filePath) {
    await saveAvatar(filePath);
  }
}

async function saveAvatar(filePath: string) {
  if (!sessionState.userId) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  const previousAvatar = avatarSrc.value;
  avatarSrc.value = filePath;
  avatarSaving.value = true;
  try {
    setProfile(await uploadMyAvatar(filePath));
    uni.showToast({ title: '头像已更新', icon: 'success' });
  } catch (error) {
    avatarSrc.value = previousAvatar;
    uni.showToast({ title: readableErrorMessage(error, '头像上传失败').slice(0, 18), icon: 'none' });
  } finally {
    avatarSaving.value = false;
  }
}

async function saveBirthday() {
  if (!sessionState.userId) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  if (birthdayLocked.value) {
    uni.showToast({ title: '生日不可再次修改', icon: 'none' });
    return;
  }
  if (!birthday.value) {
    uni.showToast({ title: '请选择生日日期', icon: 'none' });
    return;
  }

  birthdaySaving.value = true;
  try {
    setProfile(await updateMyProfile({ birthday: birthday.value }));
    birthday.value = toBirthdayMonthDay(sessionState.profile?.birthday);
    syncBirthdayPicker(birthday.value);
    uni.showToast({ title: '生日已保存', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: readableErrorMessage(error, '保存失败').slice(0, 18), icon: 'none' });
  } finally {
    birthdaySaving.value = false;
  }
}

async function saveNickname(event: { detail: { value: { nickname?: string } } }) {
  if (nicknameSaving.value || avatarSaving.value) return;
  if (!sessionState.userId) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  const nextNickname = (event.detail.value.nickname || '').trim();
  if (!nextNickname) {
    uni.showToast({ title: '请输入昵称', icon: 'none' });
    return;
  }
  nicknameSaving.value = true;
  try {
    setProfile(await updateMyProfile({ nickname: nextNickname }));
    nickname.value = sessionState.profile?.nickname || nextNickname;
    uni.showToast({ title: '昵称已保存', icon: 'success' });
    if (setupMode.value) goHome();
  } catch (error) {
    uni.showToast({ title: readableErrorMessage(error, '保存失败').slice(0, 18), icon: 'none' });
  } finally {
    nicknameSaving.value = false;
  }
}

function toBirthdayMonthDay(value?: string): string {
  if (!value) return '';
  const match = /^(?:\d{4}-)?(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);
  return match ? `${match[1]}-${match[2]}` : value;
}

function syncBirthdayPicker(value: string) {
  const normalized = toBirthdayMonthDay(value);
  const [month = '01', day = '01'] = normalized.split('-');
  const monthIndex = Math.max(0, monthOptions.indexOf(month));
  const maxDayIndex = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][monthIndex] - 1;
  const dayIndex = Math.min(Math.max(0, Number(day) - 1), maxDayIndex);
  birthdayPickerValue.value = [monthIndex, dayIndex];
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

  clearPendingBooking();
  clearSession();
  nickname.value = '';
  birthday.value = '';
  uni.showToast({ title: '已退出登录', icon: 'success' });
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/index/index' });
  }, 500);
}

onLoad((query) => { setupMode.value = query?.setup === '1'; });
onShow(refresh);
</script>

<style scoped>
.page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  padding: 24rpx;
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

.page > view,
.page > form {
  position: relative;
  z-index: 1;
}

.header-card,
.card {
  border-radius: 30rpx;
  padding: 30rpx;
  background: #fff;
  box-shadow: 0 12rpx 38rpx rgba(31, 41, 55, 0.06);
}

.header-card {
  position: relative;
  overflow: hidden;
  min-height: 260rpx;
  background: #edf2f4;
  color: #3d4652;
}

.header-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.header-copy {
  position: relative;
  z-index: 1;
}

.header-kicker {
  display: block;
  color: #6f7f8a;
  font-size: 22rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
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
  color: #6f7f8a;
  font-size: 24rpx;
}

.card {
  margin-top: 22rpx;
}

.avatar-setting {
  display: flex;
  align-items: center;
  gap: 26rpx;
  margin-top: 24rpx;
}

.avatar-picker {
  width: 132rpx;
  height: 132rpx;
  flex: 0 0 132rpx;
  margin: 0;
  border-radius: 50%;
  padding: 0;
  background: #edf2f4;
  box-shadow: 0 10rpx 28rpx rgba(31, 41, 55, 0.14);
  line-height: 1;
}

.avatar-picker::after {
  border: 0;
}

.profile-avatar {
  width: 132rpx;
  height: 132rpx;
  border-radius: 50%;
}

.avatar-copy {
  min-width: 0;
  flex: 1;
}

.avatar-title {
  display: block;
  color: #273247;
  font-size: 27rpx;
  font-weight: 900;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.required-pill {
  flex: 0 0 auto;
  border: 1px solid rgba(61, 70, 82, 0.22);
  border-radius: 999rpx;
  padding: 8rpx 16rpx;
  background: #edf2f4;
  color: #3d4652;
  font-size: 22rpx;
  font-weight: 900;
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

.input {
  width: 100%;
  min-height: 84rpx;
  margin-top: 20rpx;
  border-radius: 18rpx;
  padding: 0 22rpx;
  background: #f8fafc;
  color: #111827;
  font-size: 30rpx;
  box-sizing: border-box;
}

.input.disabled {
  color: #98a2b3;
}

.picker.disabled {
  color: #98a2b3;
  background: #f8fafc;
}

.primary-btn,
.secondary-btn {
  margin-top: 24rpx;
  border-radius: 999rpx;
  font-weight: 800;
}

.primary-btn {
  background: #3d4652;
  color: #f7f4ea;
}

.secondary-btn {
  background: #edf2f4;
  color: #3d4652;
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

.footer {
  margin-top: 40rpx;
  padding: 24rpx 0 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.footer-line {
  font-size: 22rpx;
  color: #98a2b3;
  line-height: 1.6;
}

.legal-links {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.legal-link {
  font-size: 24rpx;
  color: #6f7f8a;
}

.legal-divider {
  font-size: 24rpx;
  color: #d0d5dd;
}
</style>
