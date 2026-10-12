import {
  getMyProfile,
  isSessionExpiredError,
  readableErrorMessage,
  wechatLoginWithProfile,
} from '@/utils/api';
import { clearSession, restoreSession, sessionState, setLoginSession, setProfile } from '@/store/session';
import type { RechargeStatus } from '@member-platform/shared';

export const LEGAL_CONSENT_VERSION = '2026-10-11';
const LEGAL_CONSENT_STORAGE_KEY = 'member-miniapp-legal-consent';
let memberAccessInFlight: Promise<boolean> | null = null;

export function hasLegalConsent(): boolean {
  return uni.getStorageSync(LEGAL_CONSENT_STORAGE_KEY) === LEGAL_CONSENT_VERSION;
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

  try {
    setProfile(await getMyProfile());
    return true;
  } catch (error) {
    if (!sessionState.token || !sessionState.userId || isSessionExpiredError(error)) {
      clearSession();
      return false;
    }
    console.warn('[member profile refresh failed]', error);
    return Boolean(sessionState.profile);
  }
}

export async function ensureSession(): Promise<boolean> {
  const restored = await refreshSessionProfile();
  if (restored) return true;
  await loginWithWechat();
  if (!sessionState.userId) {
    throw new Error('登录未完成');
  }
  return true;
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

export async function ensureReadyMemberAccess(): Promise<boolean> {
  if (memberAccessInFlight) return false;
  memberAccessInFlight = resolveReadyMemberAccess();
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
  if (!sessionState.profile?.phone) {
    void promptPhoneSetup();
    return false;
  }
  return true;
}

export function requireRegistered(): boolean {
  return requireReadyMember();
}

async function resolveReadyMemberAccess(): Promise<boolean> {
  if (await refreshSessionProfile()) {
    if (!sessionState.profile?.phone) {
      await promptPhoneSetup();
      return false;
    }
    return true;
  }

  const confirmed = await showConfirm({
    title: '需要登录',
    content: '登录后可提交预约、查看会员卡和个人记录。',
    confirmText: '微信登录',
  });
  if (!confirmed) return false;

  if (!hasLegalConsent()) {
    const goToConsent = await showConfirm({
      title: '请先确认服务条款',
      content: '首次登录前，请在“我的”页面阅读并同意用户协议与隐私政策。',
      confirmText: '去查看',
    });
    if (goToConsent) uni.switchTab({ url: '/pages/index/index' });
    return false;
  }

  uni.showLoading({ title: '登录中', mask: true });
  try {
    await loginWithWechat();
  } catch (error) {
    uni.hideLoading();
    await showNotice('登录失败', readableErrorMessage(error, '登录未完成'));
    return false;
  }
  uni.hideLoading();

  if (!sessionState.profile?.phone) {
    await promptPhoneSetup();
    return false;
  }
  uni.showToast({ title: '登录成功', icon: 'success' });
  return true;
}

function isRetriableLoginError(error: unknown): boolean {
  const message = readableErrorMessage(error, '');
  return (
    message.includes('登录凭证已过期') ||
    message.includes('网络连接不稳定') ||
    message.includes('服务暂时不可用') ||
    message.includes('微信登录未启动')
  );
}

async function promptPhoneSetup(): Promise<void> {
  const confirmed = await showConfirm({
    title: '完善手机号',
    content: '首次使用请先授权或填写手机号，方便门店确认预约。',
    confirmText: '去填写',
  });
  if (confirmed) uni.switchTab({ url: '/pages/index/index' });
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

function showNotice(title: string, content: string): Promise<void> {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      content,
      showCancel: false,
      confirmText: '知道了',
      complete: () => resolve(),
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

export function statusText(status: RechargeStatus): string {
  const map: Record<RechargeStatus, string> = {
    PENDING: '审核中',
    APPROVED: '已通过',
    REJECTED: '已拒绝',
  };
  return map[status] || status;
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
        reject(new Error(error.errMsg || '微信登录未启动'));
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
