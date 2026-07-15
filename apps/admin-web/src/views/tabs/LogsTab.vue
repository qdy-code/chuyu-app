<script setup lang="ts">
import { computed, h, ref } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import { NButton, NCard, NDataTable, NDatePicker, NEmpty, NSpace, NTag } from 'naive-ui';
import type { AuditLog } from '@member-platform/shared';
import { useDataStore } from '@/composables/useDataStore';
import { formatAuditMetadata, getAuditActionLabel } from '@/composables/useFormatters';

const { logs } = useDataStore();
const dateRange = ref<[number, number] | null>(null);

function localDateKey(value: number | string | Date): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const filteredLogs = computed(() => {
  if (!dateRange.value) return logs.value;
  const [start, end] = dateRange.value.map(localDateKey);
  return logs.value.filter((log) => {
    const createdDate = localDateKey(log.createdAt);
    return createdDate >= start && createdDate <= end;
  });
});

function actionType(action: string): 'info' | 'success' | 'warning' | 'error' | 'default' {
  if (action.startsWith('recharge.approve') || action.startsWith('appointment.update')) return 'success';
  if (action.startsWith('recharge.reject') || action.includes('delete')) return 'error';
  if (action.startsWith('appointment.create') || action.startsWith('member.create')) return 'info';
  if (action.startsWith('auth.')) return 'default';
  return 'default';
}

const columns = computed<DataTableColumns<AuditLog>>(() => [
  {
    title: '时间',
    key: 'createdAt',
    width: 180,
    render: (row) => h('span', { class: 'mono dim' }, new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false })),
  },
  {
    title: '行为',
    key: 'action',
    width: 180,
    render: (row) => h(NTag, { bordered: false, type: actionType(row.action), size: 'small' }, () => getAuditActionLabel(row.action)),
  },
  {
    title: '操作者',
    key: 'actor',
    width: 200,
    render: (row) =>
      h('div', { class: 'actor-cell' }, [
        h('span', { class: 'actor-id' }, row.actorId),
        h('small', { class: 'dim' }, row.actorRole),
      ]),
  },
  {
    title: '对象',
    key: 'target',
    width: 220,
    render: (row) =>
      h('div', { class: 'actor-cell' }, [
        h('span', { class: 'mono' }, row.targetType),
        h('small', { class: 'dim mono' }, row.targetId),
      ]),
  },
  {
    title: '详情',
    key: 'metadata',
    minWidth: 360,
    render: (row) =>
      h(
        'div',
        { class: 'detail-cell' },
        formatAuditMetadata(row.metadata).map((line) => h('div', { class: 'detail-line' }, line)),
      ),
  },
]);
</script>

<template>
  <NCard :bordered="false" class="surface sticky-header-card">
    <template #header>
      <div class="card-header">
        <span>审计日志（{{ filteredLogs.length }} / {{ logs.length }}）</span>
        <NSpace :size="8" align="center">
          <NDatePicker
            v-model:value="dateRange"
            type="daterange"
            clearable
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 300px"
          />
          <NButton v-if="dateRange" secondary @click="dateRange = null">清除日期</NButton>
        </NSpace>
      </div>
    </template>
    <NDataTable
      :columns="columns"
      :data="filteredLogs"
      :bordered="false"
      :scroll-x="1180"
      :single-line="false"
      size="small"
      striped
    >
      <template #empty>
        <NEmpty :description="dateRange ? '所选日期内暂无日志记录' : '暂无日志记录'" />
      </template>
    </NDataTable>
  </NCard>
</template>

<style scoped>
.surface {
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 8px -2px rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

:deep(.mono) {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 12px;
}

:deep(.dim) {
  color: var(--color-text-muted);
}

:deep(.actor-cell) {
  display: flex;
  flex-direction: column;
}

:deep(.actor-id) {
  font-size: 13px;
  color: var(--color-text);
}

:deep(.detail-cell) {
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.7;
}

:deep(.detail-line) {
  padding: 1px 0;
}
</style>
