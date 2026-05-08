import { bindWechatPhone, getMyProfile, wechatLoginWithProfile } from '@/utils/api';
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

export async function loginWithWechat(): Promise<void> {
  const code = await requestLoginCode();
  const profile = await requestUserProfile();
  const response = await wechatLoginWithProfile({
    code,
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl,
  });
  setLoginSession(response);
  setProfile(await getMyProfile());
}

export async function registerWithWechatPhone(phoneCode: string, mockPhone?: string): Promise<void> {
  await loginWithWechat();
  if (!sessionState.userId) {
    throw new Error('微信登录失败');
  }
  setProfile(await bindWechatPhone({ code: phoneCode, mockPhone }));
}

export async function bindCurrentWechatPhone(phoneCode: string, mockPhone?: string): Promise<void> {
  if (!sessionState.userId) {
    throw new Error('请先登录');
  }
  setProfile(await bindWechatPhone({ code: phoneCode, mockPhone }));
}

export function requireLogin(): boolean {
  if (sessionState.userId) {
    return true;
  }
  uni.showToast({ title: '请先注册登录', icon: 'none' });
  return false;
}

export function requireRegistered(): boolean {
  if (!requireLogin()) {
    return false;
  }
  if (sessionState.profile?.phone) {
    return true;
  }

  uni.showToast({ title: '请先完成手机号注册', icon: 'none' });
  setTimeout(() => {
    uni.navigateTo({ url: '/pages/account/account' });
  }, 500);
  return false;
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
        reject(new Error('微信登录未返回 code'));
      },
      fail: (error) => reject(new Error(error.errMsg || '微信登录失败')),
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
