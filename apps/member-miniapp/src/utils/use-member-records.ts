import { onScopeDispose, ref, shallowRef, watch } from 'vue';
import { restoreSession, sessionState } from '@/store/session';
import { readableErrorMessage } from '@/utils/api';
import { loadSessionProfile } from '@/utils/member';

export const MEMBER_RECORD_CACHE_MS = 5 * 60 * 1000;
type RecordSnapshot = { records: unknown[]; loadedAt: string; storedAt: number };
const recordCache = new Map<() => Promise<unknown[]>, { snapshot?: RecordSnapshot; pending?: Promise<RecordSnapshot> }>();
let cacheRevision = 0;
watch(() => [sessionState.userId, sessionState.token, sessionState.profile?.pospal?.state, sessionState.profile?.pospal?.customerNumber], () => {
  cacheRevision += 1;
  recordCache.clear();
}, { flush: 'sync' });

async function readRecords<T>(fetchRecords: () => Promise<T[]>, cacheMs: number, force: boolean): Promise<RecordSnapshot> {
  if (!cacheMs) return { records: await fetchRecords(), loadedAt: new Date().toISOString(), storedAt: Date.now() };
  const existing = recordCache.get(fetchRecords);
  if (existing?.pending) return existing.pending;
  if (!force && existing?.snapshot && Date.now() - existing.snapshot.storedAt < cacheMs) return existing.snapshot;
  const revision = cacheRevision;
  const entry: { snapshot?: RecordSnapshot; pending?: Promise<RecordSnapshot> } = {};
  const pending = (async () => {
    try {
      const records = await fetchRecords();
      const snapshot = { records, loadedAt: new Date().toISOString(), storedAt: Date.now() };
      if (revision === cacheRevision && recordCache.get(fetchRecords) === entry) entry.snapshot = snapshot;
      return snapshot;
    } catch (error) {
      if (recordCache.get(fetchRecords) === entry) recordCache.delete(fetchRecords);
      throw error;
    } finally {
      entry.pending = undefined;
    }
  })();
  entry.pending = pending;
  recordCache.set(fetchRecords, entry);
  return pending;
}

export function useMemberRecords<T>(fetchRecords: () => Promise<T[]>, options: { cacheMs?: number } = {}) {
  const records = shallowRef<T[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const errorMessage = ref('');
  const loadedAt = ref('');
  let revision = 0;

  function invalidate() {
    revision += 1;
    records.value = [];
    loadedAt.value = '';
    loading.value = false;
    loaded.value = false;
    errorMessage.value = sessionState.userId ? '' : '请重新登录后查看记录';
  }

  watch(() => [sessionState.userId, sessionState.token], invalidate, { flush: 'sync' });
  onScopeDispose(invalidate);

  async function read(force: boolean) {
    restoreSession();
    const request = ++revision;
    loading.value = true;
    loaded.value = false;
    errorMessage.value = '';
    records.value = [];
    try {
      const ready = await loadSessionProfile();
      if (request !== revision) return;
      if (!ready || !sessionState.userId) {
        errorMessage.value = '请重新登录后查看记录';
        return;
      }
      const result = await readRecords(fetchRecords, options.cacheMs || 0, force);
      if (request !== revision) return;
      records.value = result.records as T[];
      loadedAt.value = result.loadedAt;
      loaded.value = true;
    } catch (error) {
      if (request === revision) errorMessage.value = readableErrorMessage(error, '记录加载失败，请重试');
    } finally {
      if (request === revision) loading.value = false;
    }
  }

  return { records, loading, loaded, errorMessage, loadedAt,
    load: () => read(false), refresh: () => read(true) };
}
