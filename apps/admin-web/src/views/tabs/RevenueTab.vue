<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NIcon,
  NSpace,
  NSpin,
  NStatistic,
  NTabPane,
  NTabs,
  useMessage,
} from 'naive-ui';
import { BadgePercent, ReceiptText, RefreshCw, TrendingUp, WalletCards } from '@lucide/vue';
import type { RevenueOverview, RevenuePeriodSummary } from '@member-platform/shared';
import { api } from '@/api/client';
import { formatMoney } from '@/composables/useFormatters';

const message = useMessage();
const selectedMonth = ref<number | null>(Date.now());
const loading = ref(false);
const overview = ref<RevenueOverview | null>(null);

const emptySummary: RevenuePeriodSummary = {
  period: '',
  consumptionAmount: 0,
  originalAmount: 0,
  discountAmount: 0,
  orderCount: 0,
  rechargeAmount: 0,
  rechargeCount: 0,
};

const monthSummary = computed(() => overview.value?.monthSummary || emptySummary);
const dailyRows = computed(() => (overview.value?.daily || []).slice().reverse());
const monthlyRows = computed(() => (overview.value?.monthly || []).slice().reverse());
const averageOrderAmount = computed(() =>
  monthSummary.value.orderCount > 0
    ? monthSummary.value.consumptionAmount / monthSummary.value.orderCount
    : 0,
);

function monthKey(value: number | null): string {
  const date = new Date(value || Date.now());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dayLabel(value: string): string {
  const [, month, day] = value.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

function monthLabel(value: string): string {
  const [year, month] = value.split('-');
  return `${year}年${Number(month)}月`;
}

function moneyCell(value: number, emphasized = false) {
  return h(
    emphasized ? 'strong' : 'span',
    { class: emphasized ? 'revenue-amount tabular-num' : 'tabular-num' },
    `¥${formatMoney(value)}`,
  );
}

const dailyColumns: DataTableColumns<RevenuePeriodSummary> = [
  { title: '日期', key: 'period', width: 110, render: (row) => dayLabel(row.period) },
  { title: '消费营业额', key: 'consumptionAmount', width: 130, render: (row) => moneyCell(row.consumptionAmount, true) },
  { title: '消费订单', key: 'orderCount', width: 100, render: (row) => `${row.orderCount} 笔` },
  {
    title: '客单价',
    key: 'average',
    width: 110,
    render: (row) => moneyCell(row.orderCount > 0 ? row.consumptionAmount / row.orderCount : 0),
  },
  { title: '原价合计', key: 'originalAmount', width: 120, render: (row) => moneyCell(row.originalAmount) },
  { title: '优惠金额', key: 'discountAmount', width: 110, render: (row) => moneyCell(row.discountAmount) },
  { title: '充值入账', key: 'rechargeAmount', width: 120, render: (row) => moneyCell(row.rechargeAmount) },
  { title: '充值笔数', key: 'rechargeCount', width: 100, render: (row) => `${row.rechargeCount} 笔` },
];

const monthlyColumns: DataTableColumns<RevenuePeriodSummary> = [
  { title: '月份', key: 'period', width: 120, render: (row) => monthLabel(row.period) },
  { title: '消费营业额', key: 'consumptionAmount', width: 140, render: (row) => moneyCell(row.consumptionAmount, true) },
  { title: '消费订单', key: 'orderCount', width: 100, render: (row) => `${row.orderCount} 笔` },
  {
    title: '月均客单价',
    key: 'average',
    width: 120,
    render: (row) => moneyCell(row.orderCount > 0 ? row.consumptionAmount / row.orderCount : 0),
  },
  { title: '原价合计', key: 'originalAmount', width: 120, render: (row) => moneyCell(row.originalAmount) },
  { title: '优惠金额', key: 'discountAmount', width: 120, render: (row) => moneyCell(row.discountAmount) },
  { title: '充值入账', key: 'rechargeAmount', width: 130, render: (row) => moneyCell(row.rechargeAmount) },
  { title: '充值笔数', key: 'rechargeCount', width: 100, render: (row) => `${row.rechargeCount} 笔` },
];

async function loadRevenue() {
  loading.value = true;
  try {
    overview.value = await api.getRevenueOverview(monthKey(selectedMonth.value));
  } catch (error) {
    message.error(error instanceof Error ? error.message : '营收数据加载失败');
  } finally {
    loading.value = false;
  }
}

watch(selectedMonth, () => {
  void loadRevenue();
});

onMounted(loadRevenue);
</script>

<template>
  <NSpace vertical :size="20">
    <NCard :bordered="false" class="surface toolbar-card">
      <div class="toolbar-content">
        <div>
          <strong>门店经营账目</strong>
          <p>消费营业额与充值入账分别统计</p>
        </div>
        <NSpace :size="10" align="center">
          <NDatePicker
            v-model:value="selectedMonth"
            type="month"
            :clearable="false"
            style="width: 170px"
          />
          <NButton secondary :loading="loading" @click="loadRevenue">
            <template #icon><NIcon><RefreshCw /></NIcon></template>
            刷新
          </NButton>
        </NSpace>
      </div>
    </NCard>

    <NSpin :show="loading" description="正在汇总账目">
      <div class="stats-grid">
        <div class="stat-card primary-stat">
          <div class="stat-icon"><TrendingUp /></div>
          <div>
            <span>本月消费营业额</span>
            <NStatistic :value="monthSummary.consumptionAmount" :precision="2" tabular-nums>
              <template #prefix>¥</template>
            </NStatistic>
            <small>客单价 ¥{{ formatMoney(averageOrderAmount) }}</small>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><WalletCards /></div>
          <div>
            <span>本月充值入账</span>
            <NStatistic :value="monthSummary.rechargeAmount" :precision="2" tabular-nums>
              <template #prefix>¥</template>
            </NStatistic>
            <small>{{ monthSummary.rechargeCount }} 笔，单独列账</small>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><ReceiptText /></div>
          <div>
            <span>消费订单</span>
            <NStatistic :value="monthSummary.orderCount" tabular-nums />
            <small>原价 ¥{{ formatMoney(monthSummary.originalAmount) }}</small>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><BadgePercent /></div>
          <div>
            <span>优惠金额</span>
            <NStatistic :value="monthSummary.discountAmount" :precision="2" tabular-nums>
              <template #prefix>¥</template>
            </NStatistic>
            <small>原价与实际消费差额</small>
          </div>
        </div>
      </div>

      <NCard :bordered="false" class="surface ledger-card">
        <NTabs type="line" animated>
          <NTabPane name="daily" tab="每日账目">
            <NDataTable
              :columns="dailyColumns"
              :data="dailyRows"
              :bordered="false"
              :single-line="false"
              :scroll-x="940"
              size="small"
            />
          </NTabPane>
          <NTabPane name="monthly" :tab="`${overview?.selectedMonth.slice(0, 4) || ''} 年月度汇总`">
            <NDataTable
              :columns="monthlyColumns"
              :data="monthlyRows"
              :bordered="false"
              :single-line="false"
              :scroll-x="980"
              size="small"
            />
          </NTabPane>
        </NTabs>
      </NCard>
    </NSpin>
  </NSpace>
</template>

<style scoped>
.surface {
  border-radius: 8px;
  border: 1px solid rgba(31, 41, 55, 0.07);
  box-shadow: 0 1px 4px rgba(31, 41, 55, 0.04);
}

.toolbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-content strong {
  display: block;
  font-size: 16px;
}

.toolbar-content p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.stat-card {
  min-height: 128px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid rgba(31, 41, 55, 0.08);
  background: #fff;
}

.stat-card span,
.stat-card small {
  display: block;
}

.stat-card span {
  margin-bottom: 6px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.stat-card small {
  margin-top: 7px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.stat-icon {
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #f2f4f6;
  color: #53606d;
}

.stat-icon :deep(svg) {
  width: 19px;
  height: 19px;
}

.primary-stat {
  border-color: rgba(183, 73, 72, 0.24);
}

.primary-stat .stat-icon {
  background: rgba(183, 73, 72, 0.1);
  color: var(--color-brand);
}

.ledger-card {
  min-height: 420px;
}

:deep(.revenue-amount) {
  color: var(--color-brand);
}

:deep(.tabular-num) {
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-content,
  .toolbar-content :deep(.n-space) {
    width: 100%;
  }
}
</style>
