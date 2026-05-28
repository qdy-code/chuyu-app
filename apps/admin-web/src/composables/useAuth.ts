import { ref, readonly } from 'vue';
import { adminLogin as apiAdminLogin, clearAdminToken, getAdminToken } from '@/api/client';

const isLoggedIn = ref(Boolean(getAdminToken()));
const authError = ref('');

function bindWindowEvents(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('admin-auth-expired', () => {
    isLoggedIn.value = false;
    authError.value = '登录已过期，请重新登录';
  });
}

bindWindowEvents();

async function login(password: string): Promise<void> {
  authError.value = '';
  await apiAdminLogin(password);
  isLoggedIn.value = true;
}

function logout(): void {
  clearAdminToken();
  isLoggedIn.value = false;
  authError.value = '';
}

export function useAuth() {
  return {
    isLoggedIn: readonly(isLoggedIn),
    authError: readonly(authError),
    login,
    logout,
  };
}
