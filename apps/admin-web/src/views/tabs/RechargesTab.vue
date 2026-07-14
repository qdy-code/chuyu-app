<script setup lang="ts">
import { computed, h, ref } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import {
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NStatistic,
  useMessage,
} from 'naive-ui';
import type { AuditLog, MemberProfile } from '@member-platform/shared';
import { api } from '@/api/client';
import { useDataStore } from '@/composables/useDataStore';
import { formatMoney } from '@/composables/useFormatters';

const { members, logs, loadAll } = useDataStore();
const message = useMessage();

type RechargeRecord = {
  id: string;
  userId: string;
  amount: number;
  points: number;
  remark?: string;
  orderId?: string;
  createdAt: string;
};

const submitting = ref(false);
const memberKeyword = ref('');
const form = ref({
  userId: '',
  amount: 0,
  points: 0,
  remark: '',
});

const memberOptions = computed(() =>
  members.value
    .filter((member) => {
      const keyword = memberKeyword.value.trim().toLowerCase();
      if (!keyword) return true;
      return `${member.nickname} ${member.id} ${member.phone || ''} ${member.remark || ''}`
        .toLowerCase()
        .includes(keyword);
    })
    .map((member) => ({
      label: `${member.nickname} / ${member.id}${member.phone ? ` / ${member.phone}` : ''}`,
      value: member.id,
    })),
);

const selectedMember = computed<MemberProfile | undefined>(() =>
  members.value.find((member) => member.id === form.value.userId),
);

const nextBalance = computed(() =>
  Math.round(((selectedMember.value?.balance || 0) + Number(form.value.amount || 0)) * 100) / 100,
);

const nextPoints = computed(() =>
  Math.round(((selectedMember.value?.points || 0) + Number(form.value.points || 0)) * 100) / 100,
);

const rechargeRecords = computed<RechargeRecord[]>(() =>
  logs.value
    .filter((log) => log.action === 'member.recharge')
    .map((log) => toRechargeRecord(log))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
);

async function submitRecharge() {
  const amount = Number(form.value.amount || 0);
  const points = Number(form.value.points || 0);
  if (!form.value.userId) {
    message.warning('请选择顾客');
    return;
  }
  if (amount <= 0 && points <= 0) {
    message.warning('充值金额或积分至少填写一项');
    return;
  }

  submitting.value = true;
  try {
    await api.createRecharge({
      userId: form.value.userId,
      amount,
      points,
      remark: form.value.remark.trim() || undefined,
    });
    message.success('充值已到账');
    form.value.amount = 0;
    form.value.points = 0;
    form.value.remark = '';
    await loadAll();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '充值失败');
  } finally {
    submitting.value = false;
  }
}

function toRechargeRecord(log: AuditLog): RechargeRecord {
  const metadata = log.metadata || {};
  const balance = readChange(metadata.balance);
  const points = readChange(metadata.points);
  return {
    id: log.id,
    userId: log.targetId,
    amount: balance,
    points,
    remark: typeof metadata.remark === 'string' ? metadata.remark : undefined,
    orderId: typeof metadata.rechargeOrderId === 'string' ? metadata.rechargeOrderId : undefined,
    createdAt: log.createdAt,
  };
}

function readChange(value: unknown): number {
  if (!value || typeof value !== 'object' || !('change' in value)) {
    return 0;
  }
  const change = Number((value as { change?: unknown }).change || 0);
  return Number.isFinite(change) ? change : 0;
}

const columns = computed<DataTableColumns<RechargeRecord>>(() => [
  {
    title: '时间',
    key: 'createdAt',
    width: 190,
    render: (row) => new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false }),
  },
  {
    title: '会员号',
    key: 'userId',
    minWidth: 220,
    render: (row) => h('span', { class: 'mono' }, row.userId),
  },
  {
    title: '充值金额',
    key: 'amount',
    width: 140,
    render: (row) => h('strong', { class: 'amount tabular-num' }, `¥${formatMoney(row.amount)}`),
  },
  {
    title: '充值积分',
    key: 'points',
    width: 120,
    render: (row) => h('strong', { class: 'points tabular-num' }, String(row.points)),
  },
  {
    title: '备注',
    key: 'remark',
    minWidth: 180,
    render: (row) => row.remark || '—',
  },
  {
    title: '卡金流水号',
    key: 'orderId',
    width: 180,
    render: (row) => (row.orderId ? h('span', { class: 'mono' }, row.orderId) : '—'),
  },
]);
</script>

<template>
  <NSpace vertical :size="20">
    <NCard :bordered="false" class="surface">
      <template #header>
        <div class="card-header">
          <span>顾客充值</span>
          <span class="hint">金额计入卡金余额，积分单独计入会员积分</span>
        </div>
      </template>

      <NForm label-placement="top">
        <div class="form-grid">
          <NFormItem label="检索顾客">
            <NInput
              v-model:value="memberKeyword"
              clearable
              placeholder="昵称 / 会员号 / 手机号 / 备注"
            />
          </NFormItem>
          <NFormItem label="选择顾客">
            <NSelect
              v-model:value="form.userId"
              filterable
              clearable
              :options="memberOptions"
              placeholder="从检索结果中选择账号"
            />
          </NFormItem>
          <NFormItem label="充值金额">
            <NInputNumber v-model:value="form.amount" :min="0" :precision="2" :step="100" placeholder="输入金额" />
          </NFormItem>
          <NFormItem label="充值积分">
            <NInputNumber v-model:value="form.points" :min="0" :precision="0" :step="10" placeholder="输入积分" />
          </NFormItem>
        </div>

        <NFormItem label="备注">
          <NInput v-model:value="form.remark" type="textarea" :rows="2" placeholder="可填写本次充值说明" />
        </NFormItem>

        <div v-if="selectedMember" class="preview">
          <NDescriptions :column="4" size="small" label-placement="top">
            <NDescriptionsItem label="当前余额">
              <NStatistic :value="selectedMember.balance" :precision="2" tabular-nums prefix="¥" />
            </NDescriptionsItem>
            <NDescriptionsItem label="充值后余额">
              <NStatistic :value="nextBalance" :precision="2" tabular-nums prefix="¥" />
            </NDescriptionsItem>
            <NDescriptionsItem label="当前积分">
              <NStatistic :value="selectedMember.points" tabular-nums />
            </NDescriptionsItem>
            <NDescriptionsItem label="充值后积分">
              <NStatistic :value="nextPoints" tabular-nums />
            </NDescriptionsItem>
          </NDescriptions>
        </div>

        <NSpace justify="end">
          <NButton type="primary" :loading="submitting" @click="submitRecharge">确认充值</NButton>
        </NSpace>
      </NForm>
    </NCard>

    <NCard :bordered="false" class="surface">
      <template #header>
        <div class="card-header">
          <span>充值记录</span>
          <span class="hint">显示后台充值的金额和积分变化；卡金流水号仅金额充值生成</span>
        </div>
      </template>

      <NDataTable
        :columns="columns"
        :data="rechargeRecords"
        :bordered="false"
        :scroll-x="900"
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

.form-grid {
  display: grid;
  grid-template-columns: minmax(210px, 0.9fr) minmax(280px, 1.3fr) minmax(150px, 0.7fr) minmax(150px, 0.7fr);
  gap: 16px;
}

.preview {
  margin-bottom: 18px;
  border-radius: 10px;
  padding: 16px;
  background: #f8fafc;
}

.hint {
  font-size: 13px;
  color: var(--color-text-muted);
}

.amount {
  color: var(--color-brand);
}

.points {
  color: #0f766e;
}

:deep(.mono) {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--color-text-muted);
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
