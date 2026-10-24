<script setup lang="ts">
import { computed, h, ref } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import {
  NAvatar,
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NFormItem,
  NModal,
  NEmpty,
  NIcon,
  NInput,
  NInputNumber,
  NImage,
  NSelect,
  NDataTable,
  NSpace,
  NSpin,
  NTag,
  NTooltip,
  useDialog,
  useMessage,
} from 'naive-ui';
import { ClipboardList, Link2, Save, Search, Trash2, UserPlus } from '@lucide/vue';
import type { Appointment, ConsumptionOrder, MemberProfile } from '@member-platform/shared';
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
  baseBalance: number;
  basePoints: number;
  adjustmentReason: string;
}

const { members, levels, levelUsageCounts, loadAll, pospalAccounts } = useDataStore();
const message = useMessage();
const dialog = useDialog();

const keyword = ref('');
const creating = ref(false);
const savingId = ref('');
const deletingId = ref('');
const historyMember = ref<MemberProfile | null>(null);
const historyOpen = ref(false);
const historyLoading = ref(false);
const historyDeletingId = ref('');
const historyOrders = ref<ConsumptionOrder[]>([]);
const historyAppointments = ref<Appointment[]>([]);
const linkingMember = ref<MemberProfile | null>(null);
const linkModalOpen = ref(false);
const linking = ref(false);
const linkForm = ref({ code: '', phone: '', verified: false });

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
      baseBalance: item.balance,
      basePoints: item.points,
      adjustmentReason: '',
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
    const hay = `${member.nickname} ${member.id} ${member.phone || ''} ${member.openId} ${member.remark || ''}`.toLowerCase();
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
  const balanceChanged = Number(row.balance) !== row.baseBalance;
  const pointsChanged = Number(row.points) !== row.basePoints;
  if ((balanceChanged || pointsChanged) && !row.adjustmentReason.trim()) {
    message.warning('修改余额或积分需要填写调账原因');
    return;
  }
  savingId.value = originId;
  try {
    await api.updateMember(originId, {
      nickname: row.nickname.trim(),
      remark: row.remark.trim() || undefined,
      birthday: row.birthday || undefined,
      ...(!pospalAccounts.value ? { levelId: row.levelId, discountRate: Number(row.discountRate) } : {}),
      ...(balanceChanged ? { balance: Number(row.balance), expectedBalance: row.baseBalance } : {}),
      ...(pointsChanged ? { points: Number(row.points), expectedPoints: row.basePoints } : {}),
      adjustmentReason: row.adjustmentReason.trim() || undefined,
    });
    message.success('已保存');
    delete editRows.value[originId];
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    savingId.value = '';
  }
}

function openLinkMember(member: MemberProfile) {
  linkForm.value = { code: '', phone: '', verified: false };
  linkingMember.value = member;
  linkModalOpen.value = true;
}

async function confirmWechatLink() {
  const member = linkingMember.value;
  if (!member || linking.value) return;
  if (!/^\d{8}$/.test(linkForm.value.code) || !/^1[3-9]\d{9}$/.test(linkForm.value.phone) || !linkForm.value.verified) {
    message.warning('请填写顾客关联码、预留手机号，并确认身份核验');
    return;
  }
  linking.value = true;
  try {
    await api.confirmMemberLink(member.id, { code: linkForm.value.code, verifiedPhone: linkForm.value.phone, identityVerified: true });
    linkingMember.value = null;
    linkModalOpen.value = false;
    delete editRows.value[member.id];
    await loadAll();
    message.success('微信已关联，原会员号及资产保持不变');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '关联失败');
  } finally {
    linking.value = false;
  }
}

function confirmDeleteMember(member: MemberProfile) {
  dialog.warning({
    title: '删除会员',
    content: `确定删除会员“${member.nickname}”（${member.id}）吗？历史消费、充值及已结束预约记录会继续保留用于对账。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      deletingId.value = member.id;
      try {
        await api.deleteMember(member.id);
        delete editRows.value[member.id];
        message.success('会员已删除，历史业务记录已保留');
        await loadAll();
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除失败');
      } finally {
        deletingId.value = '';
      }
    },
  });
}

async function openMemberHistory(member: MemberProfile) {
  historyMember.value = member;
  historyOpen.value = true;
  historyLoading.value = true;
  try {
    const [orders, appointments] = await Promise.all([
      api.listMemberConsumptionOrders(member.id),
      api.listAppointments(),
    ]);
    historyOrders.value = orders;
    historyAppointments.value = appointments.filter((item) => item.userId === member.id);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '使用记录加载失败');
  } finally {
    historyLoading.value = false;
  }
}

function closeMemberHistory() {
  historyOpen.value = false;
  historyMember.value = null;
  historyOrders.value = [];
  historyAppointments.value = [];
}

function businessText(value: string) {
  return value === 'ACCESSORY' ? '饰品' : value === 'FLOWER' ? '鲜花' : '美甲';
}

function confirmDeleteHistory(kind: 'order' | 'appointment', id: string) {
  const title = kind === 'order' ? '作废消费记录' : '删除预约记录';
  const content = kind === 'order'
    ? '作废后会退回本单实际扣除的余额，并保留审计记录。确定继续吗？'
    : '删除后预约不再占用排期，但操作会保留在审计日志。确定继续吗？';
  dialog.warning({
    title,
    content,
    positiveText: '确认处理',
    negativeText: '取消',
    onPositiveClick: async () => {
      historyDeletingId.value = id;
      try {
        if (kind === 'order') await api.deleteConsumptionOrder(id);
        else await api.deleteAppointment(id);
        message.success(kind === 'order' ? '消费记录已作废并退回余额' : '预约记录已删除');
        await loadAll();
        const refreshedMember = historyMember.value
          ? members.value.find((item) => item.id === historyMember.value?.id)
          : undefined;
        if (refreshedMember) await openMemberHistory(refreshedMember);
      } catch (error) {
        message.error(error instanceof Error ? error.message : '处理失败');
      } finally {
        historyDeletingId.value = '';
      }
    },
  });
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
          h('div', { class: 'cell-id' }, row.phone || '未填写手机号'),
        ]),
      ]);
    },
  },
  {
    title: '等级',
    key: 'levelId',
    width: 200,
    render: (row) => {
      if (pospalAccounts.value) return h('span', row.pospal?.state === 'LINKED' ? row.levelName : '待关联');
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
        disabled: pospalAccounts.value,
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
        value: row.pospal?.state === 'UNLINKED' ? null : editRow.balance,
        placeholder: row.pospal?.state === 'UNLINKED' ? '待关联' : undefined,
        disabled: pospalAccounts.value,
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
        value: row.pospal?.state === 'UNLINKED' ? null : editRow.points,
        placeholder: row.pospal?.state === 'UNLINKED' ? '待关联' : undefined,
        disabled: pospalAccounts.value,
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
    title: '调账原因',
    key: 'adjustmentReason',
    minWidth: 180,
    render: row => h(NInput, {
      value: syncEditRow(row).adjustmentReason, size: 'small', placeholder: '修改余额或积分时必填',
      'onUpdate:value': (value: string) => { syncEditRow(row).adjustmentReason = value; },
    }),
  },
  {
    title: '操作',
    key: 'actions',
    width: 390,
    fixed: 'right',
    render: (row) =>
      h(
        NSpace,
        { size: 8, wrap: false },
        {
          default: () => [
            ...(row.phone ? [h(NButton, {
              size: 'small', secondary: true, onClick: () => openLinkMember(row),
            }, { icon: () => h(NIcon, null, { default: () => h(Link2) }), default: () => '关联微信' })] : []),
            h(NButton, {
              size: 'small', secondary: true, onClick: () => void openMemberHistory(row),
            }, { icon: () => h(NIcon, null, { default: () => h(ClipboardList) }), default: () => '使用记录' }),
            h(
              NButton,
              {
                type: 'primary',
                size: 'small',
                loading: savingId.value === row.id,
                disabled: deletingId.value === row.id,
                onClick: () => saveMember(row.id),
              },
              {
                icon: () => h(NIcon, null, { default: () => h(Save) }),
                default: () => '保存',
              },
            ),
            h(
              NButton,
              {
                type: 'error',
                secondary: true,
                size: 'small',
                loading: deletingId.value === row.id,
                disabled: savingId.value === row.id,
                onClick: () => confirmDeleteMember(row),
              },
              {
                icon: () => h(NIcon, null, { default: () => h(Trash2) }),
                default: () => '删除',
              },
            ),
          ],
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
    <NAlert v-if="pospalAccounts" type="info">余额与积分由银豹统一管理，列表显示最近同步的数值。充值、消费和积分调整请在银豹操作。</NAlert>
    <NCard title="新增会员" :bordered="false" class="surface">
      <div class="form-grid">
        <NInput v-model:value="memberForm.nickname" placeholder="昵称 *" />
        <NInput v-model:value="memberForm.id" placeholder="会员号（留空自动生成）" />
        <NInput v-model:value="memberForm.phone" placeholder="手机号（可选）" />
        <NSelect
          v-model:value="memberForm.levelId"
          :disabled="pospalAccounts"
          :options="levelOptions"
          placeholder="选择等级"
        />
        <NInputNumber
          v-model:value="memberForm.discountRate"
          :disabled="pospalAccounts"
          :step="0.05"
          :min="0.1"
          :max="1"
          placeholder="折扣率"
        />
        <NInputNumber v-model:value="memberForm.balance" :disabled="pospalAccounts" :min="0" :step="1" placeholder="初始余额" />
        <NInputNumber v-model:value="memberForm.points" :disabled="pospalAccounts" :min="0" :step="1" placeholder="初始积分" />
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

    <NCard :bordered="false" class="surface sticky-header-card">
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

    <NModal v-model:show="linkModalOpen" preset="card" title="关联微信会员" style="width: 440px">
      <NSpace v-if="linkingMember" vertical :size="14">
        <div>当前会员：{{ linkingMember.nickname }}（{{ linkingMember.id }}）</div>
        <div class="text-sm">仅更换微信登录绑定，原会员号、余额、积分和历史记录保持不变；原微信登录会失效。</div>
        <NFormItem label="顾客关联码">
          <NInput v-model:value="linkForm.code" maxlength="8" placeholder="顾客小程序显示的 8 位关联码" />
        </NFormItem>
        <NFormItem label="预留手机号">
          <NInput v-model:value="linkForm.phone" maxlength="11" placeholder="与后台会员资料一致的手机号" />
        </NFormItem>
        <NCheckbox v-model:checked="linkForm.verified">我已核对顾客本人身份、预留手机号及原会员记录，确认更换微信绑定</NCheckbox>
        <NSpace justify="end">
          <NButton @click="linkModalOpen = false">取消</NButton>
          <NButton type="primary" :loading="linking" @click="confirmWechatLink">确认关联</NButton>
        </NSpace>
      </NSpace>
    </NModal>

    <NModal
      :show="historyOpen"
      preset="card"
      :title="historyMember ? `${historyMember.nickname}的使用记录` : '会员使用记录'"
      style="width: 760px; max-width: calc(100vw - 32px)"
      @update:show="(value: boolean) => { if (!value) closeMemberHistory(); }"
    >
      <NSpin :show="historyLoading">
        <NSpace vertical :size="18">
          <div v-if="historyMember" class="history-summary">
            <NAvatar round :size="44" :src="toAbsoluteImageUrl(historyMember.avatarUrl)">{{ historyMember.nickname.slice(0, 1) }}</NAvatar>
            <div>
              <strong>{{ historyMember.nickname }}</strong>
              <div class="dim">{{ historyMember.id }} · 余额 ¥{{ formatMoney(historyMember.balance) }} · {{ historyMember.points }} 积分</div>
            </div>
          </div>

          <NCard size="small" :bordered="false" title="消费记录">
            <NEmpty v-if="historyOrders.length === 0" description="暂无消费记录" />
            <div v-else class="history-list">
              <div v-for="item in historyOrders" :key="item.id" class="history-row">
                <div class="history-main">
                  <strong>{{ item.title }}</strong>
                  <span class="dim">{{ item.orderDate }} · {{ item.orderNo }} · 实扣 ¥{{ formatMoney(item.finalPrice) }}</span>
                  <NSpace v-if="item.effectImages.length" :size="6">
                    <NImage v-for="image in item.effectImages" :key="image" width="48" height="48" object-fit="cover" :src="toAbsoluteImageUrl(image)" :preview-src="toAbsoluteImageUrl(image)" />
                  </NSpace>
                </div>
                <NButton type="error" secondary size="small" :loading="historyDeletingId === item.id" @click="confirmDeleteHistory('order', item.id)">作废并退回</NButton>
              </div>
            </div>
          </NCard>

          <NCard size="small" :bordered="false" title="预约记录">
            <NEmpty v-if="historyAppointments.length === 0" description="暂无预约记录" />
            <div v-else class="history-list">
              <div v-for="item in historyAppointments" :key="item.id" class="history-row">
                <div class="history-main">
                  <strong>{{ businessText(item.businessType) }} · {{ item.appointmentDate }} {{ item.startTime }}</strong>
                  <span class="dim">{{ item.status }}<span v-if="item.productName"> · {{ item.productName }}</span></span>
                </div>
                <NButton type="error" secondary size="small" :loading="historyDeletingId === item.id" @click="confirmDeleteHistory('appointment', item.id)">删除预约</NButton>
              </div>
            </div>
          </NCard>
        </NSpace>
      </NSpin>
    </NModal>
  </NSpace>
</template>

<style scoped>
.surface {
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 8px -2px rgba(0, 0, 0, 0.04);
}

.history-summary { display: flex; align-items: center; gap: 12px; }
.history-list { display: flex; flex-direction: column; gap: 10px; }
.history-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; border-bottom: 1px solid #edf0f2; }
.history-main { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.history-main strong { color: var(--color-text); }
.dim { color: var(--color-text-muted); font-size: 12px; }
@media (max-width: 640px) { .history-row { align-items: flex-start; flex-direction: column; } }

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
