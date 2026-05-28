<script setup lang="ts">
import { computed, h, ref } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import {
  NButton,
  NCard,
  NDataTable,
  NIcon,
  NInput,
  NInputNumber,
  NSpace,
  NTag,
  useDialog,
  useMessage,
} from 'naive-ui';
import { PlusCircle, Save, Trash2 } from 'lucide-vue-next';
import type { MemberLevel } from '@member-platform/shared';
import { api } from '@/api/client';
import { useDataStore } from '@/composables/useDataStore';
import { discountPercent } from '@/composables/useFormatters';

interface EditRow {
  name: string;
  minPoints: number;
  discountRate: number;
}

const { levels, levelUsageCounts, loadAll } = useDataStore();
const message = useMessage();
const dialog = useDialog();

const newLevel = ref({ name: '', minPoints: 0, discountRate: 1 });
const editRows = ref<Record<string, EditRow>>({});
const savingId = ref('');
const creating = ref(false);

function syncEditRow(item: MemberLevel): EditRow {
  if (!editRows.value[item.id]) {
    editRows.value[item.id] = {
      name: item.name,
      minPoints: item.minPoints,
      discountRate: item.discountRate,
    };
  }
  return editRows.value[item.id];
}

async function createLevel() {
  if (creating.value) return;
  const name = newLevel.value.name.trim();
  const discount = Number(newLevel.value.discountRate);
  if (!name) {
    message.warning('请填写等级名称');
    return;
  }
  if (discount < 0.1 || discount > 1) {
    message.warning('折扣须在 0.1 到 1 之间');
    return;
  }
  creating.value = true;
  try {
    await api.createLevel({
      name,
      minPoints: Number(newLevel.value.minPoints),
      discountRate: discount,
    });
    newLevel.value = { name: '', minPoints: 0, discountRate: 1 };
    message.success('已新增等级');
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '创建失败');
  } finally {
    creating.value = false;
  }
}

async function saveLevel(levelId: string) {
  const row = editRows.value[levelId];
  if (!row) return;
  const name = row.name.trim();
  const discount = Number(row.discountRate);
  if (!name) {
    message.warning('请填写等级名称');
    return;
  }
  if (discount < 0.1 || discount > 1) {
    message.warning('折扣须在 0.1 到 1 之间');
    return;
  }
  savingId.value = levelId;
  try {
    await api.updateLevel(levelId, {
      name,
      minPoints: Number(row.minPoints),
      discountRate: discount,
    });
    message.success('已保存');
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    savingId.value = '';
  }
}

function deleteLevel(level: MemberLevel) {
  const used = levelUsageCounts.value[level.id] || 0;
  if (used > 0) {
    message.warning(`该等级已有 ${used} 个会员使用，请先调整后再删除`);
    return;
  }
  dialog.warning({
    title: '删除等级',
    content: `确定删除等级「${level.name}」？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.deleteLevel(level.id);
        message.success('已删除');
        await loadAll();
      } catch (e) {
        message.error(e instanceof Error ? e.message : '删除失败');
      }
    },
  });
}

const columns = computed<DataTableColumns<MemberLevel>>(() => [
  {
    title: '等级名称',
    key: 'name',
    minWidth: 160,
    render: (row) => {
      const editRow = syncEditRow(row);
      return h(NInput, {
        value: editRow.name,
        size: 'small',
        'onUpdate:value': (v: string) => (editRow.name = v),
      });
    },
  },
  {
    title: '最低积分',
    key: 'minPoints',
    width: 160,
    render: (row) => {
      const editRow = syncEditRow(row);
      return h(NInputNumber, {
        value: editRow.minPoints,
        size: 'small',
        min: 0,
        step: 100,
        'onUpdate:value': (v: number | null) => (editRow.minPoints = v ?? 0),
      });
    },
  },
  {
    title: '默认折扣',
    key: 'discountRate',
    width: 180,
    render: (row) => {
      const editRow = syncEditRow(row);
      return h('div', { class: 'cell-discount' }, [
        h(NInputNumber, {
          value: editRow.discountRate,
          size: 'small',
          min: 0.1,
          max: 1,
          step: 0.05,
          'onUpdate:value': (v: number | null) => (editRow.discountRate = v ?? 1),
        }),
        h('span', { class: 'discount-percent' }, discountPercent(editRow.discountRate)),
      ]);
    },
  },
  {
    title: '使用会员数',
    key: 'usage',
    width: 130,
    render: (row) =>
      h(
        NTag,
        { type: (levelUsageCounts.value[row.id] || 0) > 0 ? 'success' : 'default', bordered: false, size: 'small' },
        () => `${levelUsageCounts.value[row.id] || 0} 人`,
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 6 }, () => [
        h(
          NButton,
          {
            type: 'primary',
            size: 'small',
            loading: savingId.value === row.id,
            onClick: () => saveLevel(row.id),
          },
          {
            icon: () => h(NIcon, null, { default: () => h(Save) }),
            default: () => '保存',
          },
        ),
        h(
          NButton,
          {
            size: 'small',
            secondary: true,
            type: 'error',
            disabled: (levelUsageCounts.value[row.id] || 0) > 0,
            onClick: () => deleteLevel(row),
          },
          {
            icon: () => h(NIcon, null, { default: () => h(Trash2) }),
          },
        ),
      ]),
  },
]);
</script>

<template>
  <NSpace vertical :size="20">
    <NCard title="新增等级" :bordered="false" class="surface">
      <NSpace :size="12" wrap>
        <NInput v-model:value="newLevel.name" placeholder="等级名称（例如 黑钻）" style="width: 200px" />
        <NInputNumber
          v-model:value="newLevel.minPoints"
          :min="0"
          :step="100"
          placeholder="最低积分"
          style="width: 180px"
        />
        <NInputNumber
          v-model:value="newLevel.discountRate"
          :min="0.1"
          :max="1"
          :step="0.05"
          placeholder="折扣率"
          style="width: 180px"
        />
        <NButton type="primary" :loading="creating" @click="createLevel">
          <template #icon>
            <NIcon><PlusCircle /></NIcon>
          </template>
          新增等级
        </NButton>
      </NSpace>
    </NCard>

    <NCard title="等级列表" :bordered="false" class="surface">
      <NDataTable
        :columns="columns"
        :data="levels"
        :bordered="false"
        :single-line="false"
        :scroll-x="900"
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

:deep(.cell-discount) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.discount-percent) {
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
