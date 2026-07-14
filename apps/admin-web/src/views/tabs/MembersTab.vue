<script setup lang="ts">
import { computed, h, ref } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import {
  NAvatar,
  NButton,
  NCard,
  NEmpty,
  NIcon,
  NInput,
  NInputNumber,
  NSelect,
  NDataTable,
  NSpace,
  NTag,
  NTooltip,
  useDialog,
  useMessage,
} from 'naive-ui';
import { Save, UserPlus, Search } from '@lucide/vue';
import type { MemberProfile } from '@member-platform/shared';
import { api, toAbsoluteImageUrl } from '@/api/client';
import { useDataStore } from '@/composables/useDataStore';
import { discountPercent, formatMoney } from '@/composables/useFormatters';

interface EditRow {
  nickname: string;
  remark: string;
  birthday: string;
  levelId: string;
  discountRate: number;
  balance: number;
  points: number;
}

const { members, levels, levelUsageCounts, loadAll } = useDataStore();
const message = useMessage();
const dialog = useDialog();

const keyword = ref('');
const creating = ref(false);
const savingId = ref('');

const memberForm = ref({
  id: '',
  nickname: '',
  remark: '',
  phone: '',
    birthday: '',
  levelId: '',
  discountRate: 1,
  balance: 0,
  points: 0,
});

const editRows = ref<Record<string, EditRow>>({});

function rowsKeyOf(id: string): EditRow {
  return editRows.value[id];
}

function syncEditRow(item: MemberProfile): EditRow {
  if (!editRows.value[item.id]) {
    editRows.value[item.id] = {
      nickname: item.nickname,
      remark: item.remark || '',
      birthday: normalizeBirthday(item.birthday),
      levelId: item.levelId,
      discountRate: item.discountRate,
      balance: item.balance,
      points: item.points,
    };
  }
  return editRows.value[item.id];
}

const levelOptions = computed(() =>
  levels.value.map((level) => ({
    label: `${level.name}（默认 ${discountPercent(level.discountRate)}）`,
    value: level.id,
  })),
);

const matchedMembers = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return members.value;
  return members.value.filter((member) => {
    const hay = `${member.nickname} ${member.id} ${member.openId} ${member.remark || ''}`.toLowerCase();
    return hay.includes(kw);
  });
});

function normalizeBirthday(value?: string): string {
  if (!value) return '';
  const match = /(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[1]}-${match[2]}` : value;
}

async function createMember() {
  if (creating.value) return;
  const nickname = memberForm.value.nickname.trim();
  if (!nickname) {
    message.warning('请填写会员昵称');
    return;
  }
  const levelId = memberForm.value.levelId || levels.value[0]?.id;
  if (!levelId) {
    message.warning('请先创建会员等级');
    return;
  }
  const discountRate = Number(memberForm.value.discountRate);
  if (discountRate < 0.1 || discountRate > 1) {
    message.warning('折扣须在 0.1 到 1 之间');
    return;
  }

  creating.value = true;
  try {
    await api.createMember({
      id: memberForm.value.id.trim() || undefined,
      nickname,
      remark: memberForm.value.remark.trim() || undefined,
      phone: memberForm.value.phone.trim() || undefined,
      birthday: memberForm.value.birthday.trim() || undefined,
      levelId,
      discountRate,
      balance: Number(memberForm.value.balance || 0),
      points: Number(memberForm.value.points || 0),
    });
    message.success('会员创建成功');
    resetForm();
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '创建失败');
  } finally {
    creating.value = false;
  }
}

function resetForm() {
  memberForm.value = {
    id: '',
    nickname: '',
    remark: '',
    phone: '',
    birthday: '',
    levelId: levels.value[0]?.id || '',
    discountRate: levels.value[0]?.discountRate || 1,
    balance: 0,
    points: 0,
  };
}

async function saveMember(originId: string) {
  const row = rowsKeyOf(originId);
  if (!row) return;
  savingId.value = originId;
  try {
    await api.updateMember(originId, {
      nickname: row.nickname.trim(),
      remark: row.remark.trim() || undefined,
      birthday: row.birthday || undefined,
      levelId: row.levelId,
      discountRate: Number(row.discountRate),
      balance: Number(row.balance),
      points: Number(row.points),
    });
    message.success('已保存');
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    savingId.value = '';
  }
}

function levelTagType(levelId: string): 'default' | 'success' | 'warning' | 'info' {
  // 给等级一些视觉差异（不强依赖具体等级名）
  const idx = levels.value.findIndex((level) => level.id === levelId);
  if (idx < 0) return 'default';
  const types: Array<'info' | 'success' | 'warning' | 'default'> = ['info', 'success', 'warning', 'default'];
  return types[idx % types.length];
}

const columns = computed<DataTableColumns<MemberProfile>>(() => [
  {
    title: '会员',
    key: 'identity',
    width: 280,
    render: (row) => {
      const editRow = syncEditRow(row);
      return h('div', { class: 'member-identity' }, [
        h(
          NAvatar,
          {
            round: true,
            size: 44,
            src: toAbsoluteImageUrl(row.avatarUrl),
          },
          { default: () => row.nickname.slice(0, 1) },
        ),
        h('div', { class: 'cell-identity' }, [
          h(NInput, {
            value: editRow.nickname,
            'onUpdate:value': (v: string) => (editRow.nickname = v),
            size: 'small',
            placeholder: '昵称',
          }),
          h('div', { class: 'cell-id' }, [
            h(NTooltip, null, {
              trigger: () =>
                h('span', { class: 'mono' }, row.id.length > 16 ? `${row.id.slice(0, 16)}…` : row.id),
              default: () => row.id,
            }),
          ]),
        ]),
      ]);
    },
  },
  {
    title: '等级',
    key: 'levelId',
    width: 200,
    render: (row) => {
      const editRow = syncEditRow(row);
      return h(NSelect, {
        value: editRow.levelId,
        size: 'small',
        options: levelOptions.value,
        'onUpdate:value': (v: string) => (editRow.levelId = v),
      });
    },
  },
  {
    title: '折扣',
    key: 'discountRate',
    width: 120,
    render: (row) => {
      const editRow = syncEditRow(row);
      return h(NInputNumber, {
        value: editRow.discountRate,
        size: 'small',
        step: 0.05,
        min: 0.1,
        max: 1,
        showButton: false,
        'onUpdate:value': (v: number | null) => (editRow.discountRate = v ?? 1),
      });
    },
  },
  {
    title: '余额',
    key: 'balance',
    width: 130,
    render: (row) => {
      const editRow = syncEditRow(row);
      return h(NInputNumber, {
        value: editRow.balance,
        size: 'small',
        step: 1,
        min: 0,
        showButton: false,
        'onUpdate:value': (v: number | null) => (editRow.balance = v ?? 0),
      });
    },
  },
  {
    title: '积分',
    key: 'points',
    width: 110,
    render: (row) => {
      const editRow = syncEditRow(row);
      return h(NInputNumber, {
        value: editRow.points,
        size: 'small',
        step: 1,
        min: 0,
        showButton: false,
        'onUpdate:value': (v: number | null) => (editRow.points = v ?? 0),
      });
    },
  },
  {
    title: '生日',
    key: 'birthday',
    width: 150,
    render: (row) => {
      const editRow = syncEditRow(row);
      return h(NInput, {
        value: editRow.birthday,
        size: 'small',
        type: 'text',
        placeholder: 'MM-DD',
        'onUpdate:value': (v: string) => (editRow.birthday = v),
      });
    },
  },
  {
    title: '备注',
    key: 'remark',
    minWidth: 180,
    render: (row) => {
      const editRow = syncEditRow(row);
      return h(NInput, {
        value: editRow.remark,
        size: 'small',
        placeholder: '备注（可选）',
        'onUpdate:value': (v: string) => (editRow.remark = v),
      });
    },
  },
  {
    title: '当前',
    key: 'snapshot',
    width: 120,
    render: (row) =>
      h('div', { class: 'cell-snapshot' }, [
        h(NTag, { type: levelTagType(row.levelId), bordered: false, size: 'small' }, () =>
          levels.value.find((l) => l.id === row.levelId)?.name || row.levelName || '未知',
        ),
        h('div', { class: 'mono dim' }, `¥${formatMoney(row.balance)} · ${row.points}积分`),
      ]),
  },
  {
    title: '操作',
    key: 'actions',
    width: 110,
    fixed: 'right',
    render: (row) =>
      h(
        NButton,
        {
          type: 'primary',
          size: 'small',
          loading: savingId.value === row.id,
          onClick: () => saveMember(row.id),
        },
        {
          icon: () => h(NIcon, null, { default: () => h(Save) }),
          default: () => '保存',
        },
      ),
  },
]);

function bulkCheckPending() {
  const dirtyCount = members.value.reduce((count, m) => {
    const row = editRows.value[m.id];
    if (!row) return count;
    const changed =
      row.nickname !== m.nickname ||
      (row.remark || '') !== (m.remark || '') ||
      (row.birthday || '') !== (m.birthday || '') ||
      row.levelId !== m.levelId ||
      Number(row.discountRate) !== Number(m.discountRate) ||
      Number(row.balance) !== Number(m.balance) ||
      Number(row.points) !== Number(m.points);
    return changed ? count + 1 : count;
  }, 0);
  if (!dirtyCount) {
    message.info('没有需要保存的改动');
    return;
  }
  dialog.info({
    title: '未保存的改动',
    content: `检测到 ${dirtyCount} 行还有未保存的改动。请逐行点击"保存"。`,
    positiveText: '我知道了',
  });
}
</script>

<template>
  <NSpace vertical :size="20">
    <NCard title="新增会员" :bordered="false" class="surface">
      <div class="form-grid">
        <NInput v-model:value="memberForm.nickname" placeholder="昵称 *" />
        <NInput v-model:value="memberForm.id" placeholder="会员号（留空自动生成）" />
        <NInput v-model:value="memberForm.phone" placeholder="手机号（可选）" />
        <NSelect
          v-model:value="memberForm.levelId"
          :options="levelOptions"
          placeholder="选择等级"
        />
        <NInputNumber
          v-model:value="memberForm.discountRate"
          :step="0.05"
          :min="0.1"
          :max="1"
          placeholder="折扣率"
        />
        <NInputNumber v-model:value="memberForm.balance" :min="0" :step="1" placeholder="初始余额" />
        <NInputNumber v-model:value="memberForm.points" :min="0" :step="1" placeholder="初始积分" />
        <NInput v-model:value="memberForm.birthday" maxlength="5" placeholder="生日月日（MM-DD）" clearable />
        <NInput v-model:value="memberForm.remark" placeholder="备注" />
        <NButton type="primary" :loading="creating" @click="createMember">
          <template #icon>
            <NIcon><UserPlus /></NIcon>
          </template>
          新增会员
        </NButton>
      </div>
    </NCard>

    <NCard :bordered="false" class="surface">
      <template #header>
        <div class="card-header">
          <span>会员列表（{{ members.length }}）</span>
          <NSpace :size="8">
            <NInput
              v-model:value="keyword"
              clearable
              size="small"
              placeholder="搜昵称 / ID / OpenID / 备注"
              style="width: 260px"
            >
              <template #prefix>
                <NIcon :size="14"><Search /></NIcon>
              </template>
            </NInput>
            <NButton size="small" secondary @click="bulkCheckPending">检查未保存</NButton>
          </NSpace>
        </div>
      </template>

      <NDataTable
        :columns="columns"
        :data="matchedMembers"
        :bordered="false"
        :single-line="false"
        :scroll-x="1300"
        size="small"
        striped
      >
        <template #empty>
          <NEmpty description="还没有匹配的会员" />
        </template>
      </NDataTable>
    </NCard>
  </NSpace>
</template>

<style scoped>
.surface {
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 8px -2px rgba(0, 0, 0, 0.04);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

:deep(.cell-identity) {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 4px;
}

:deep(.member-identity) {
  display: flex;
  align-items: center;
  gap: 10px;
}

:deep(.cell-id) {
  font-size: 11px;
  color: var(--color-text-muted);
}

:deep(.cell-snapshot) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:deep(.mono) {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 12px;
}

:deep(.mono.dim) {
  color: var(--color-text-muted);
}
</style>
