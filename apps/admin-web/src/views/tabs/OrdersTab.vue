<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NEmpty,
  NIcon,
  NImage,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  NStatistic,
  NTag,
  NUpload,
  useMessage,
} from 'naive-ui';
import { Plus, Trash2 } from 'lucide-vue-next';
import type { ConsumptionOrder, ProductType } from '@member-platform/shared';
import { api, toAbsoluteImageUrl } from '@/api/client';
import { useDataStore } from '@/composables/useDataStore';
import { formatMoney } from '@/composables/useFormatters';

const { members, levels, productTypes, orders, loadAll } = useDataStore();
const message = useMessage();

const filterUserId = ref<string | 'all'>('all');
const showCreate = ref(false);
const uploading = ref(false);
const submitting = ref(false);
const customProductType = ref('');
const memberKeyword = ref('');

const orderForm = ref({
  userId: '',
  productType: '',
  title: '门店消费',
  originalPrice: 100,
  discountRate: 1,
  effectImages: [] as string[],
  orderDate: Date.now(),
  remark: '',
});

const memberOptions = computed(() =>
  members.value
    .filter((m) => {
      const kw = memberKeyword.value.trim().toLowerCase();
      if (!kw) return true;
      const hay = `${m.nickname} ${m.id} ${m.openId} ${m.remark || ''}`.toLowerCase();
      return hay.includes(kw);
    })
    .map((m) => ({ label: `${m.nickname}（${m.id}）`, value: m.id })),
);

const productTypeOptions = computed(() => [
  { label: '不指定', value: '' },
  ...productTypes.value.map((p) => ({ label: p.name, value: p.name })),
]);

const filterOptions = computed(() => [
  { label: '全部会员', value: 'all' },
  ...members.value.map((m) => ({ label: `${m.nickname}（${m.id}）`, value: m.id })),
]);

const selectedMember = computed(() => members.value.find((m) => m.id === orderForm.value.userId));
const selectedLevel = computed(() => levels.value.find((l) => l.id === selectedMember.value?.levelId));

const memberDiscountRate = computed(
  () => selectedMember.value?.discountRate ?? selectedLevel.value?.discountRate ?? 1,
);

const finalPrice = computed(() =>
  Math.round(orderForm.value.originalPrice * orderForm.value.discountRate * 100) / 100,
);

const balanceAfter = computed(() => {
  const balance = selectedMember.value?.balance ?? 0;
  return Math.max(0, Math.round((balance - finalPrice.value) * 100) / 100);
});

const filteredOrders = computed(() =>
  filterUserId.value === 'all' ? orders.value : orders.value.filter((o) => o.userId === filterUserId.value),
);

watch(
  () => orderForm.value.userId,
  () => {
    orderForm.value.discountRate = memberDiscountRate.value;
  },
);

function openCreate() {
  showCreate.value = true;
  if (!orderForm.value.userId && members.value.length > 0) {
    orderForm.value.userId = members.value[0].id;
  }
  orderForm.value.discountRate = memberDiscountRate.value;
  orderForm.value.orderDate = Date.now();
  orderForm.value.effectImages = [];
  customProductType.value = '';
}

function timestampToDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function useCustomProductType() {
  orderForm.value.productType = customProductType.value.trim();
}

async function handleUpload(options: { file: { file: File | null } }) {
  const file = options.file.file;
  if (!file) return;
  uploading.value = true;
  try {
    const urls = await api.uploadImages([file]);
    orderForm.value.effectImages.push(...urls);
    message.success('图片已上传');
  } catch (e) {
    message.error(e instanceof Error ? e.message : '上传失败');
  } finally {
    uploading.value = false;
  }
}

function removeImage(index: number) {
  orderForm.value.effectImages.splice(index, 1);
}

async function submitOrder() {
  if (!orderForm.value.userId) {
    message.warning('请选择会员');
    return;
  }
  submitting.value = true;
  try {
    await api.createConsumptionOrder({
      userId: orderForm.value.userId,
      productType: orderForm.value.productType || undefined,
      title: orderForm.value.title.trim() || '门店消费',
      originalPrice: Number(orderForm.value.originalPrice),
      discountRate: Number(orderForm.value.discountRate),
      effectImages: orderForm.value.effectImages,
      orderDate: timestampToDate(orderForm.value.orderDate),
      remark: orderForm.value.remark || undefined,
    });
    message.success('订单已创建，已扣减余额');
    showCreate.value = false;
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '创建失败');
  } finally {
    submitting.value = false;
  }
}

async function createProductType() {
  const name = customProductType.value.trim();
  if (!name) {
    message.warning('请填写类型名称');
    return;
  }
  try {
    await api.createProductType({ name, sortOrder: productTypes.value.length * 10 + 10 });
    customProductType.value = '';
    message.success('已新增类型');
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '创建失败');
  }
}

async function deleteProductType(item: ProductType) {
  try {
    await api.deleteProductType(item.id);
    message.success('已删除类型');
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '删除失败');
  }
}

const columns = computed<DataTableColumns<ConsumptionOrder>>(() => [
  { title: '订单号', key: 'orderNo', width: 160, render: (row) => h('span', { class: 'mono' }, row.orderNo) },
  { title: '会员', key: 'userId', width: 220, render: (row) => h('span', { class: 'mono' }, row.userId) },
  { title: '类型', key: 'productType', width: 110, render: (row) => row.productType || '—' },
  { title: '标题', key: 'title', minWidth: 180 },
  { title: '原价', key: 'originalPrice', width: 100, render: (row) => `¥${formatMoney(row.originalPrice)}` },
  {
    title: '会员价',
    key: 'finalPrice',
    width: 110,
    render: (row) => h('strong', { class: 'amount tabular-num' }, `¥${formatMoney(row.finalPrice)}`),
  },
  {
    title: '折扣',
    key: 'discountRate',
    width: 80,
    render: (row) => `${Math.round(row.discountRate * 100)}%`,
  },
  {
    title: '效果图',
    key: 'effectImages',
    width: 160,
    render: (row) =>
      row.effectImages.length > 0
        ? h(
            'div',
            { class: 'table-thumbs' },
            row.effectImages.map((img) =>
              h(NImage, { src: toAbsoluteImageUrl(img), width: 48, height: 48, objectFit: 'cover' }),
            ),
          )
        : h('span', { class: 'dim' }, '—'),
  },
  { title: '日期', key: 'orderDate', width: 110 },
  { title: '备注', key: 'remark', minWidth: 140, render: (row) => row.remark || '—' },
]);
</script>

<template>
  <NSpace vertical :size="20">
    <NCard :bordered="false" class="surface">
      <template #header>
        <div class="card-header">
          <span>用户消费记录（{{ filteredOrders.length }}）</span>
          <NSpace :size="10" align="center">
            <NSelect
              v-model:value="filterUserId"
              :options="filterOptions"
              size="small"
              style="width: 240px"
              placeholder="筛选会员"
            />
            <NButton type="primary" size="small" @click="openCreate">
              <template #icon>
                <NIcon><Plus /></NIcon>
              </template>
              创建订单
            </NButton>
          </NSpace>
        </div>
      </template>

      <NDataTable
        :columns="columns"
        :data="filteredOrders"
        :bordered="false"
        :scroll-x="1280"
        :single-line="false"
        size="small"
      >
        <template #empty>
          <NEmpty description="还没有订单记录" />
        </template>
      </NDataTable>
    </NCard>

    <NModal
      v-model:show="showCreate"
      preset="card"
      title="创建消费订单"
      style="width: 720px; max-width: calc(100vw - 32px)"
      :bordered="false"
      :mask-closable="false"
    >
      <NSpace vertical :size="14">
        <div class="form-row">
          <label>会员搜索</label>
          <NInput v-model:value="memberKeyword" placeholder="按昵称 / ID / OpenID / 备注 过滤" clearable />
        </div>

        <div class="form-row">
          <label>选择会员</label>
          <NSelect
            v-model:value="orderForm.userId"
            :options="memberOptions"
            placeholder="选择会员"
            filterable
          />
        </div>

        <div class="form-grid">
          <div>
            <label>产品类型</label>
            <NSelect
              v-model:value="orderForm.productType"
              :options="productTypeOptions"
              placeholder="不指定"
            />
          </div>
          <div>
            <label>订单日期</label>
            <NDatePicker v-model:value="orderForm.orderDate" type="date" style="width: 100%" />
          </div>
          <div>
            <label>订单标题</label>
            <NInput v-model:value="orderForm.title" placeholder="例如 肩颈理疗" />
          </div>
          <div>
            <label>订单原价</label>
            <NInputNumber v-model:value="orderForm.originalPrice" :min="0.01" :step="10" style="width: 100%" />
          </div>
          <div>
            <label>折扣率</label>
            <NInputNumber
              v-model:value="orderForm.discountRate"
              :min="0.1"
              :max="1"
              :step="0.05"
              style="width: 100%"
            />
          </div>
          <div>
            <label>备注</label>
            <NInput v-model:value="orderForm.remark" placeholder="可选备注" />
          </div>
        </div>

        <NDivider style="margin: 4px 0" />

        <NDescriptions
          :column="3"
          label-placement="top"
          size="small"
          :bordered="false"
          class="summary"
        >
          <NDescriptionsItem label="会员价">
            <NStatistic :value="finalPrice" :precision="2" tabular-nums>
              <template #prefix>¥</template>
            </NStatistic>
          </NDescriptionsItem>
          <NDescriptionsItem label="当前余额">
            <NStatistic :value="selectedMember?.balance ?? 0" :precision="2" tabular-nums>
              <template #prefix>¥</template>
            </NStatistic>
          </NDescriptionsItem>
          <NDescriptionsItem label="下单后余额（预估）">
            <NStatistic :value="balanceAfter" :precision="2" tabular-nums>
              <template #prefix>¥</template>
            </NStatistic>
          </NDescriptionsItem>
        </NDescriptions>

        <div class="form-row">
          <label>效果图（可多张）</label>
          <NUpload
            multiple
            accept="image/*"
            :show-file-list="false"
            :default-upload="false"
            @change="handleUpload"
          >
            <NButton secondary :loading="uploading">点击上传图片</NButton>
          </NUpload>
        </div>

        <div v-if="orderForm.effectImages.length > 0" class="thumb-grid">
          <div v-for="(img, idx) in orderForm.effectImages" :key="img" class="thumb-cell">
            <NImage :src="toAbsoluteImageUrl(img)" width="80" height="80" object-fit="cover" />
            <NButton size="tiny" type="error" secondary @click="removeImage(idx)">
              <template #icon>
                <NIcon><Trash2 :size="14" /></NIcon>
              </template>
            </NButton>
          </div>
        </div>

        <NDivider style="margin: 4px 0" />
        <div>
          <label class="section-label">维护产品类型</label>
          <NSpace :size="8" wrap style="margin-top: 8px">
            <NInput v-model:value="customProductType" placeholder="新增预设类型" style="width: 180px" />
            <NButton size="small" secondary @click="createProductType">新增预设</NButton>
            <NButton size="small" tertiary @click="useCustomProductType">填入本次订单</NButton>
          </NSpace>
          <NSpace :size="6" wrap style="margin-top: 10px">
            <NTag
              v-for="item in productTypes"
              :key="item.id"
              closable
              :bordered="false"
              type="default"
              @close="deleteProductType(item)"
            >
              {{ item.name }}
            </NTag>
          </NSpace>
        </div>
      </NSpace>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreate = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitOrder">确认提交</NButton>
        </NSpace>
      </template>
    </NModal>
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

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

label {
  font-size: 13px;
  color: var(--color-text-muted);
}

.section-label {
  font-weight: 600;
  color: var(--color-text);
}

.summary {
  background: linear-gradient(135deg, #fff8ef, #fff);
  border: 1px solid #f4e9d8;
  border-radius: 10px;
  padding: 12px 14px;
}

.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 12px;
}

.thumb-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
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
