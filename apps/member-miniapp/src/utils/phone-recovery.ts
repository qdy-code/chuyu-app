import { reactive, watch } from 'vue';
import type { MemberPhoneRecovery } from '@member-platform/shared';
import { sessionState } from '@/store/session';
import { PhoneConflictError } from '@/utils/phone-conflict';
export const phoneRecoveryState = reactive<{ userId: string; challenge: MemberPhoneRecovery | null }>({ userId: '', challenge: null });
export function clearPhoneRecovery() { phoneRecoveryState.challenge = null; phoneRecoveryState.userId = ''; }
watch(() => [sessionState.userId, sessionState.token], ([userId, token], [previousUserId]) => {
  if (userId !== previousUserId || !token) clearPhoneRecovery();
}, { flush: 'sync' });
export function beginPhoneRecovery(error: unknown): boolean {
  if (!(error instanceof PhoneConflictError)) return false;
  phoneRecoveryState.userId = sessionState.userId;
  phoneRecoveryState.challenge = error.recovery;
  return true;
}
