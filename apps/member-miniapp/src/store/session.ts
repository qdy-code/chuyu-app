import { reactive } from 'vue';
import type { LoginResponse, MemberProfile } from '@member-platform/shared';

interface SessionState {
  token: string;
  userId: string;
  profile: MemberProfile | null;
}

const SESSION_STORAGE_KEY = 'member-miniapp-session';

export const sessionState = reactive<SessionState>({
  token: '',
  userId: '',
  profile: null,
});

export function restoreSession(): void {
  const cached = uni.getStorageSync(SESSION_STORAGE_KEY) as Partial<SessionState> | '';
  if (!cached || typeof cached !== 'object') {
    return;
  }

  sessionState.token = cached.token || '';
  sessionState.userId = cached.userId || '';
  sessionState.profile = cached.profile || null;
}

export function setLoginSession(response: LoginResponse): void {
  sessionState.token = response.token;
  sessionState.userId = response.user.id;
  sessionState.profile = response.user;
  persistSession();
}

export function setProfile(profile: MemberProfile): void {
  sessionState.userId = profile.id;
  sessionState.profile = profile;
  persistSession();
}

export function clearSession(): void {
  sessionState.token = '';
  sessionState.userId = '';
  sessionState.profile = null;
  uni.removeStorageSync(SESSION_STORAGE_KEY);
}

function persistSession(): void {
  uni.setStorageSync(SESSION_STORAGE_KEY, {
    token: sessionState.token,
    userId: sessionState.userId,
    profile: sessionState.profile,
  });
}
