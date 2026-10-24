import {
  getMyProfile,
  getMyCachedProfile,
  isSessionExpiredError,
  readableErrorMessage,
  wechatLoginWithProfile,
} from '@/utils/api';
import { clearSession, restoreSession, sessionState, setLoginSession, setProfile } from '@/store/session';
import type { RechargeStatus } from '@member-platform/shared';
import { reactive, watch } from 'vue';

export const LEGAL_CONSENT_VERSION = '2026-10-23-member-password';
const LEGAL_CONSENT_STORAGE_KEY = 'member-miniapp-legal-consent';
let memberAccessInFlight: Promise<boolean> | null = null;
export const profileRefreshState = reactive({ loading: false, fresh: false, errorMessage: '' });
let profileRevision = 0;
let profileInFlight: Promise<boolean> | null = null;
let cachedProfileInFlight: Promise<boolean> | null = null;
let cachedProfileRequestId = 0;
let profileValidatedAt = 0;
const PROFILE_CACHE_MS = 5 * 60 * 1000;

watch(() => [sessionState.userId, sessionState.token], () => {
  profileRevision += 1;
  profileInFlight = null;
  cachedProfileInFlight = null;
  cachedProfileRequestId += 1;
  profileValidatedAt = 0;
  profileRefreshState.loading = false;
  profileRefreshState.fresh = false;
  profileRefreshState.errorMessage = '';
}, { flush: 'sync' });

export function hasLegalConsent(): boolean {
  return uni.getStorageSync(LEGAL_CONSENT_STORAGE_KEY) === LEGAL_CONSENT_VERSION;
}

export function isMemberEntryReady(): boolean {
  return !!(sessionState.token && sessionState.userId && (sessionState.profile?.phone || sessionState.loginMethod === 'password') && hasLegalConsent());
}

export function setLegalConsent(accepted: boolean): void {
  if (accepted) {
    uni.setStorageSync(LEGAL_CONSENT_STORAGE_KEY, LEGAL_CONSENT_VERSION);
  } else {
    uni.removeStorageSync(LEGAL_CONSENT_STORAGE_KEY);
  }
}

export async function refreshSessionProfile(): Promise<boolean> {
  restoreSession();
  if (!sessionState.token || !sessionState.userId) {
    return false;
  }

  if (profileInFlight) return profileInFlight;
  const revision = ++profileRevision;
  profileRefreshState.loading = true;
  profileRefreshState.fresh = false;
  profileRefreshState.errorMessage = '';
  const task: Promise<boolean> = (async () => {
    try {
      const profile = await getMyProfile();
      if (revision !== profileRevision) return false;
      setProfile(profile);
      profileValidatedAt = Date.now();
      profileRefreshState.fresh = true;
      return true;
    } catch (error) {
      if (revision !== profileRevision) return false;
      if (isSessionExpiredError(error)) {
        clearSession();
        return false;
      }
      profileRefreshState.errorMessage = readableErrorMessage(error, '请稍后重试');
      return Boolean(sessionState.profile);
    } finally {
      if (revision === profileRevision) {
        profileRefreshState.loading = false;
        profileInFlight = null;
      }
    }
  })();
  profileInFlight = task;
  return task;
}

// 页面浏览与身份检查只读取已保存的资料，不触发银豹付费查询。
export async function loadSessionProfile(force = false): Promise<boolean> {
  restoreSession();
  if (!sessionState.token || !sessionState.userId) return false;
  if (profileInFlight) return profileInFlight;
  if (cachedProfileInFlight) return cachedProfileInFlight;
  profileRefreshState.fresh = false;
  if (force !== true && sessionState.profile && sessionState.profile.pospal?.state !== 'UNLINKED' &&
    profileValidatedAt && Date.now() - profileValidatedAt < PROFILE_CACHE_MS) return true;
  const revision = ++profileRevision;
  const requestId = ++cachedProfileRequestId;
  const task: Promise<boolean> = (async () => {
    try {
      const profile = await getMyCachedProfile();
      if (revision !== profileRevision) return false;
      setProfile(profile);
      profileValidatedAt = Date.now();
      profileRefreshState.errorMessage = '';
      return true;
    } catch (error) {
      if (revision !== profileRevision) return false;
      if (isSessionExpiredError(error)) {
        clearSession();
        return false;
      }
      profileRefreshState.errorMessage = readableErrorMessage(error, '请稍后重试');
      return Boolean(sessionState.profile);
    } finally {
      if (requestId === cachedProfileRequestId) cachedProfileInFlight = null;
    }
  })();
  cachedProfileInFlight = task;
  return task;
}

export async function loginWithWechat(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const code = await requestLoginCode();
      const openIdHint = import.meta.env.VITE_ENABLE_DEV_LOGIN_FALLBACK === 'true'
        ? localMockOpenIdHint()
        : undefined;
      const response = await wechatLoginWithProfile({
        code,
        ...(openIdHint ? { openIdHint } : {}),
      });
      setLoginSession(response);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 0 && isRetriableLoginError(error)) continue;
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('登录未完成');
}

export async function ensureReadyMemberAccess(onSetupRequired?: () => void): Promise<boolean> {
  if (memberAccessInFlight) return false;
  memberAccessInFlight = resolveReadyMemberAccess(onSetupRequired);
  try {
    return await memberAccessInFlight;
  } finally {
    memberAccessInFlight = null;
  }
}

export function requireLogin(): boolean {
  restoreSession();
  if (sessionState.token && sessionState.userId) {
    return true;
  }
  void ensureReadyMemberAccess();
  return false;
}

export function requireReadyMember(): boolean {
  if (!requireLogin()) {
    return false;
  }
  if (!sessionState.profile?.phone && sessionState.loginMethod !== 'password') {
    void promptPhoneSetup();
    return false;
  }
  return true;
}

export function requireRegistered(): boolean {
  return requireReadyMember();
}

async function resolveReadyMemberAccess(onSetupRequired?: () => void): Promise<boolean> {
  if (await loadSessionProfile()) {
    if (!sessionState.profile?.phone && sessionState.loginMethod !== 'password') {
      await promptPhoneSetup(onSetupRequired);
      return false;
    }
    if (!hasLegalConsent()) {
      onSetupRequired?.();
      uni.switchTab({ url: '/pages/index/index' });
      return false;
    }
    return true;
  }

  const confirmed = await showConfirm({
    title: '需要登录',
    content: '登录后可提交预约、查看会员卡和个人记录。',
    confirmText: '立即登录',
  });
  if (!confirmed) return false;

  // Phone authorization needs a direct button tap; let the member page perform
  // WeChat authentication and phone binding together after that authorization.
  onSetupRequired?.();
  uni.switchTab({ url: '/pages/index/index' });
  return false;
}

function isRetriableLoginError(error: unknown): boolean {
  const message = readableErrorMessage(error, '');
  return (
    message.includes('登录凭证已过期') ||
    message.includes('网络连接不稳定') ||
    message.includes('服务暂时不可用') ||
    message.includes('登录未启动')
  );
}

async function promptPhoneSetup(onSetupRequired?: () => void): Promise<void> {
  const confirmed = await showConfirm({
    title: '手机号授权登录',
    content: '提交预约或关联门店会员需要手机号，方便门店核对和联系。浏览作品无需提供手机号。',
    confirmText: '去登录',
  });
  if (confirmed) {
    onSetupRequired?.();
    uni.switchTab({ url: '/pages/index/index' });
  }
}

function showConfirm(options: { title: string; content: string; confirmText: string }): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      ...options,
      cancelText: '稍后',
      success: (result) => resolve(Boolean(result.confirm)),
      fail: () => resolve(false),
    });
  });
}

export function formatMoney(value: number | undefined): string {
  return Number(value || 0).toFixed(2);
}

export function discountText(rate: number | undefined): string {
  const value = Number(rate || 1);
  return value >= 1 ? '无折扣' : `${Number((value * 10).toFixed(2))}折`;
}

export function statusClass(status: RechargeStatus): string {
  return `status-${status.toLowerCase()}`;
}

function requestLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (result) => {
        if (result.code) {
          resolve(result.code);
          return;
        }
        const fallbackCode = devLoginFallbackCode();
        if (fallbackCode) {
          resolve(fallbackCode);
          return;
        }
        reject(new Error('登录未返回 code'));
      },
      fail: (error) => {
        const fallbackCode = devLoginFallbackCode();
        if (fallbackCode) {
          resolve(fallbackCode);
          return;
        }
        reject(new Error(error.errMsg || '登录未启动'));
      },
    });
  });
}

function devLoginFallbackCode(): string {
  if (import.meta.env.VITE_ENABLE_DEV_LOGIN_FALLBACK !== 'true') {
    return '';
  }

  const storageKey = 'member-miniapp-dev-login-code';
  const cached = uni.getStorageSync(storageKey);
  if (typeof cached === 'string' && cached) {
    return cached;
  }

  const code = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  uni.setStorageSync(storageKey, code);
  return code;
}

function localMockOpenIdHint(): string {
  const storageKey = 'member-miniapp-local-open-id';
  const cached = uni.getStorageSync(storageKey);
  if (typeof cached === 'string' && cached) {
    return cached;
  }

  const hint = `mock-local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  uni.setStorageSync(storageKey, hint);
  return hint;
}
