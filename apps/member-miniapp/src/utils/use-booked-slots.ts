import { onScopeDispose, ref, watch } from 'vue';
import type { BookedAppointmentSlot, BusinessType } from '@member-platform/shared';
import { sessionState } from '@/store/session';
import { listBookedAppointmentSlots, readableErrorMessage } from '@/utils/api';

export function useBookedSlots(businessType: BusinessType, date: () => string) {
  const slots = ref<BookedAppointmentSlot[]>([]);
  const loading = ref(false);
  const ready = ref(false);
  const errorMessage = ref('');
  let revision = 0;
  function invalidate() {
    revision++;
    slots.value = [];
    ready.value = false;
    loading.value = false;
    errorMessage.value = '';
  }
  watch(() => [date(), sessionState.userId, sessionState.token], invalidate, { flush: 'sync' });
  onScopeDispose(invalidate);
  async function refresh(): Promise<boolean> {
    const request = ++revision;
    ready.value = false;
    errorMessage.value = '';
    if (!sessionState.userId || !sessionState.token) return false;
    loading.value = true;
    try {
      const result = await listBookedAppointmentSlots(date(), businessType);
      if (request !== revision) return false;
      slots.value = result;
      ready.value = true;
      return true;
    } catch (error) {
      if (request === revision) errorMessage.value = readableErrorMessage(error, '时段加载失败，请重试');
      return false;
    } finally {
      if (request === revision) loading.value = false;
    }
  }
  return { slots, loading, ready, errorMessage, refresh };
}
