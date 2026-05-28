<script setup lang="ts">
import { computed, h, ref } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import {
  NButton,
  NCard,
  NDataTable,
  NIcon,
  NInput,
  NSpace,
  NTag,
  useDialog,
  useMessage,
} from 'naive-ui';
import { Check, X } from 'lucide-vue-next';
import type { RechargeOrder, RechargeStatus } from '@member-platform/shared';
import { api } from '@/api/client';
import { useDataStore } from '@/composables/useDataStore';
import { formatMoney } from '@/composables/useFormatters';

const { recharges, loadAll } = useDataStore();
const message = useMessage();
const dialog = useDialog();

const rejectReason = ref('资料不完整');
const busyId = ref('');

function statusTag(status: RechargeStatus) {
  const map: Record<RechargeStatus, { type: 'warning' | 'success' | 'error'; text: string }> = {
    PENDING: { type: 'warning', text: '待处理' },
    APPROVED: { type: 'success', text: '已通过' },
    REJECTED: { type: 'error', text: '已拒绝' },
  };
  return map[status];
}

async function approve(id: string) {
  busyId.value = id;
  try {
    await api.approveRecharge(id);
    message.success('已通过');
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败');
  } finally {
    busyId.value = '';
  }
}

function confirmReject(id: string) {
  const reason = rejectReason.value.trim() || '未提供原因';
  dialog.warning({
    title: '拒绝充值',
    content: `确认拒绝订单 ${id}？原因将同步给会员。`,
    positiveText: '确认拒绝',
    negativeText: '取消',
    onPositiveClick: async () => {
      busyId.value = id;
      try {
        await api.rejectRecharge(id, { reason });
        message.success('已拒绝');
        await loadAll();
      } catch (e) {
        message.error(e instanceof Error ? e.message : '操作失败');
      } finally {
        busyId.value = '';
      }
    },
  });
}

const columns = computed<DataTableColumns<RechargeOrder>>(() => [
  {
    title: '订单号',
    key: 'id',
    width: 220,
    render: (row) => h('span', { class: 'mono' }, row.id),
  },
  { title: '会员 ID', key: 'userId', width: 280, render: (row) => h('span', { class: 'mono' }, row.userId) },
  {
    title: '金额',
    key: 'amount',
    width: 130,
    render: (row) =>
      h('strong', { class: 'amount tabular-num' }, `¥${formatMoney(row.amount)}`),
  },
  {
    title: '状态',
    key: 'status',
    width: 110,
    render: (row) => {
      const meta = statusTag(row.status);
      return h(NTag, { type: meta.type, bordered: false, size: 'small' }, () => meta.text);
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    fixed: 'right',
    render: (row) =>
      row.status === 'PENDING'
        ? h(NSpace, { size: 6 }, () => [
            h(
              NButton,
              {
                type: 'primary',
                size: 'small',
                loading: busyId.value === row.id,
                onClick: () => approve(row.id),
              },
              {
                icon: () => h(NIcon, null, { default: () => h(Check) }),
                default: () => '通过',
              },
            ),
            h(
              NButton,
              {
                secondary: true,
                type: 'error',
                size: 'small',
                loading: busyId.value === row.id,
                onClick: () => confirmReject(row.id),
              },
              {
                icon: () => h(NIcon, null, { default: () => h(X) }),
                default: () => '拒绝',
              },
            ),
          ])
        : h('span', { class: 'dim' }, '—'),
  },
]);

const pendingCount = computed(() => recharges.value.filter((r) => r.status === 'PENDING').length);
</script>

<template>
  <NSpace vertical :size="20">
    <NCard :bordered="false" class="surface">
      <template #header>
        <div class="card-header">
          <span>充值申请（待处理 {{ pendingCount }}）</span>
          <NSpace :size="8" align="center">
            <span class="hint">默认拒绝理由：</span>
            <NInput v-model:value="rejectReason" size="small" style="width: 240px" placeholder="填写拒绝原因" />
          </NSpace>
        </div>
      </template>

      <NDataTable
        :columns="columns"
        :data="recharges"
        :bordered="false"
        :scroll-x="1000"
        :single-line="false"
        size="small"
      />
    </NCard>
  </NSpace>
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

.hint {
  font-size: 13px;
  color: var(--color-text-muted);
}

.amount {
  color: var(--color-brand);
}

:deep(.mono) {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--color-text-muted);
}

:deep(.dim) {
  color: var(--color-text-muted);
}
</style>
