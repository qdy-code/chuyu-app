import { onScopeDispose, ref, shallowRef, watch } from 'vue';
import { restoreSession, sessionState } from '@/store/session';
import { readableErrorMessage } from '@/utils/api';
import { refreshSessionProfile } from '@/utils/member';

export function useMemberRecords<T>(fetchRecords: () => Promise<T[]>) {
  const records = shallowRef<T[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const errorMessage = ref('');
  let revision = 0;

  function invalidate() {
    revision += 1;
    records.value = [];
    loading.value = false;
    loaded.value = false;
    errorMessage.value = sessionState.userId ? '' : '请重新登录后查看记录';
  }

  watch(() => [sessionState.userId, sessionState.token], invalidate, { flush: 'sync' });
  onScopeDispose(invalidate);

  async function refresh() {
    restoreSession();
    const request = ++revision;
    loading.value = true;
    loaded.value = false;
    errorMessage.value = '';
    records.value = [];
    try {
      const ready = await refreshSessionProfile();
      if (request !== revision) return;
      if (!ready || !sessionState.userId) {
        errorMessage.value = '请重新登录后查看记录';
        return;
      }
      const result = await fetchRecords();
      if (request !== revision) return;
      records.value = result;
      loaded.value = true;
    } catch (error) {
      if (request === revision) errorMessage.value = readableErrorMessage(error, '记录加载失败，请重试');
    } finally {
      if (request === revision) loading.value = false;
    }
  }

  return { records, loading, loaded, errorMessage, refresh };
}
