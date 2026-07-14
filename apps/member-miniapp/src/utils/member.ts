import { getMyProfile, wechatLoginWithProfile } from '@/utils/api';
import { clearSession, restoreSession, sessionState, setLoginSession, setProfile } from '@/store/session';
import type { RechargeStatus } from '@member-platform/shared';

export async function refreshSessionProfile(): Promise<boolean> {
  restoreSession();
  if (!sessionState.userId) {
    return false;
  }

  try {
    setProfile(await getMyProfile());
    return true;
  } catch {
    clearSession();
    return false;
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
  const code = await requestLoginCode();
  const openIdHint = import.meta.env.VITE_ENABLE_DEV_LOGIN_FALLBACK === 'true'
    ? localMockOpenIdHint()
    : undefined;
  const response = await wechatLoginWithProfile({
    code,
    ...(openIdHint ? { openIdHint } : {}),
  });
  setLoginSession(response);
  setProfile(await getMyProfile());
}

export function requireLogin(): boolean {
  if (sessionState.userId) {
    return true;
  }
  uni.showModal({
    title: '需要登录',
    content: '登录后可提交预约、查看会员卡和个人记录。',
    confirmText: '去登录',
    cancelText: '稍后',
    success: (result) => {
      if (result.confirm) {
        uni.switchTab({ url: '/pages/index/index' });
      }
    },
  });
  return false;
}

export function requireReadyMember(): boolean {
  if (!requireLogin()) {
    return false;
  }
  if (!sessionState.profile?.phone) {
    uni.showModal({
      title: '完善手机号',
      content: '首次使用请先填写手机号，方便门店确认预约。',
      confirmText: '去填写',
      cancelText: '稍后',
      success: (result) => {
        if (result.confirm) {
          uni.switchTab({ url: '/pages/index/index' });
        }
      },
    });
    return false;
  }
  return true;
}

export function requireRegistered(): boolean {
  return requireReadyMember();
}

export function formatMoney(value: number | undefined): string {
  return Number(value || 0).toFixed(2);
}

export function discountText(rate: number | undefined): string {
  const value = Number(rate || 1);
  return value >= 1 ? '无折扣' : `${Math.round(value * 100)}折`;
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
