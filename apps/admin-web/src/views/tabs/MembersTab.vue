<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
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
import { ClipboardList, KeyRound, Save, Search, Trash2, UserPlus } from '@lucide/vue';
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
const photoInput = ref<HTMLInputElement | null>(null);
const photoOrder = ref<ConsumptionOrder | null>(null);
const photoBusy = ref('');
const photoError = ref('');

function chooseConsumptionPhotos(order: ConsumptionOrder) {
  if (photoBusy.value) return;
  photoOrder.value = order;
  photoError.value = '';
  photoInput.value?.click();
}

async function refreshConsumptionPhotos(memberId: string) {
  const orders = await api.listMemberConsumptionOrders(memberId);
  if (historyOpen.value && historyMember.value?.id === memberId) historyOrders.value = orders;
}

async function uploadConsumptionPhotos(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = '';
  const memberId = historyMember.value?.id;
  const order = photoOrder.value;
  if (!memberId || !order || !files.length || photoBusy.value) return;
  photoBusy.value = order.id;
  photoError.value = '';
  let saved = false;
  try {
    await api.uploadConsumptionPhotos(memberId, order.id, files);
    saved = true;
    message.success('美甲图已保存，顾客刷新消费记录即可查看');
    await refreshConsumptionPhotos(memberId);
  } catch (error) {
    photoError.value = saved ? '图片已保存，但列表刷新失败，请重新打开使用记录查看，避免重复上传。' : error instanceof Error ? error.message : '图片上传失败，请重试';
  } finally { photoBusy.value = ''; }
}

function removeConsumptionPhoto(order: ConsumptionOrder, photoId: string) {
  const memberId = historyMember.value?.id;
  if (!memberId || photoBusy.value) return;
  dialog.warning({
    title: '移除这张美甲图', content: '移除后，顾客将无法在消费记录中查看这张图片。', positiveText: '移除图片', negativeText: '取消',
    onPositiveClick: async () => {
      photoBusy.value = order.id;
      photoError.value = '';
      try { await api.removeConsumptionPhoto(memberId, order.id, photoId); await refreshConsumptionPhotos(memberId); message.success('图片已移除'); }
      catch (error) { photoError.value = error instanceof Error ? error.message : '移除失败，请重试'; }
      finally { photoBusy.value = ''; }
    },
  });
}
const credentialMember = ref<MemberProfile | null>(null);
const credentialForm = ref({ username: '', password: '' });
const credentialStatus = ref<{ username: string | null; enabled: boolean } | null>(null);
const credentialLoading = ref(false);
const credentialBusy = ref(false);
const credentialError = ref('');
let credentialRequest = 0;

async function openCredential(member: MemberProfile) {
  const requestId = ++credentialRequest;
  credentialMember.value = member;
  credentialForm.value = { username: '', password: '' };
  credentialStatus.value = null;
  credentialError.value = '';
  credentialLoading.value = true;
  try {
    const status = await api.getMemberCredential(member.id);
    if (requestId !== credentialRequest) return;
    credentialStatus.value = status;
    credentialForm.value.username = status.username ?? '';
  } catch (error) {
    if (requestId === credentialRequest) credentialError.value = error instanceof Error ? error.message : '无法读取账号状态';
  } finally {
    if (requestId === credentialRequest) credentialLoading.value = false;
  }
}

function closeCredential() {
  if (credentialBusy.value) return;
  credentialRequest += 1;
  credentialForm.value.password = '';
  credentialMember.value = null;
}

async function saveCredential() {
  const member = credentialMember.value;
  const username = credentialForm.value.username.trim();
  const password = credentialForm.value.password;
  if (!member || !credentialStatus.value || credentialBusy.value) return;
  if (!/^[a-zA-Z0-9_]{4,32}$/.test(username)) {
    credentialError.value = '账号须为 4–32 位英文字母、数字或下划线';
    return;
  }
  if (password.length < 12 || password.length > 128 || !password.trim()) {
    credentialError.value = '请输入 12–128 位字符的新密码';
    return;
  }
  credentialBusy.value = true;
  credentialError.value = '';
  try {
    await api.setMemberCredential(member.id, username, password);
    message.success('账号密码已保存，可用小程序的账号密码入口登录');
    credentialBusy.value = false;
    closeCredential();
  } catch (error) {
    credentialError.value = error instanceof Error ? error.message : '保存失败，请重试';
  } finally {
    credentialBusy.value = false;
  }
}

function confirmDisableCredential() {
  const member = credentialMember.value;
  if (!member || !credentialStatus.value?.enabled || credentialBusy.value) return;
  dialog.warning({
    title: '停用账号密码登录',
    content: `停用后，${member.nickname}（${member.id}）的账号密码登录会退出，微信登录仍可继续使用。`,
    positiveText: '停用',
    negativeText: '取消',
    onPositiveClick: async () => {
      credentialBusy.value = true;
      credentialError.value = '';
      try {
        await api.disableMemberCredential(member.id);
        credentialStatus.value = { username: credentialStatus.value?.username ?? null, enabled: false };
        credentialForm.value.password = '';
        message.success('账号密码登录已停用');
      } catch (error) {
        credentialError.value = error instanceof Error ? error.message : '停用失败，请重试';
      } finally {
        credentialBusy.value = false;
      }
    },
  });
}

const memberForm = ref({
  id: '',
  nickname: '',
  remark: '',
  phone: '',
  identityVerified: false,
  birthday: '',
  levelId: '',
  discountRate: 1,
  balance: 0,
  points: 0,
});

const editRows = ref<Record<string, EditRow>>({});
watch(() => memberForm.value.phone, () => { memberForm.value.identityVerified = false; });

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
  if (pospalAccounts.value && memberForm.value.phone.trim() && !memberForm.value.identityVerified) {
    message.warning('请先确认已核实顾客本人身份及手机号');
    return;
  }
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
      identityVerified: !!memberForm.value.phone.trim() && memberForm.value.identityVerified,
      birthday: memberForm.value.birthday.trim() || undefined,
      levelId,
      discountRate,
      balance: Number(memberForm.value.balance || 0),
      points: Number(memberForm.value.points || 0),
    });
    message.success(pospalAccounts.value && memberForm.value.phone.trim() ? '会员已创建，已加入银豹同步队列' : '会员创建成功');
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
    identityVerified: false,
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
  historyOrders.value = [];
  historyAppointments.value = [];
  photoError.value = '';
  try {
    const [orders, appointments] = await Promise.all([
      api.listMemberConsumptionOrders(member.id),
      api.listAppointments(),
    ]);
    if (historyOpen.value && historyMember.value?.id === member.id) {
      historyOrders.value = orders;
      historyAppointments.value = appointments.filter((item) => item.userId === member.id);
    }
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
            h(NButton, {
              size: 'small', secondary: true, onClick: () => void openMemberHistory(row),
            }, { icon: () => h(NIcon, null, { default: () => h(ClipboardList) }), default: () => '使用记录' }),
            h(NButton, {
              size: 'small', secondary: true, onClick: () => void openCredential(row),
            }, { icon: () => h(NIcon, null, { default: () => h(KeyRound) }), default: () => '账号密码' }),
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
      <NCheckbox v-if="pospalAccounts && memberForm.phone.trim()" v-model:checked="memberForm.identityVerified">
        已核实顾客本人身份及手机号，同步到银豹（已有同手机号会员时需核对关联）
      </NCheckbox>
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

    <NModal
      :show="!!credentialMember"
      preset="card"
      title="编辑账号密码"
      style="width: 460px; max-width: calc(100vw - 32px)"
      :mask-closable="!credentialBusy"
      :close-on-esc="!credentialBusy"
      :closable="!credentialBusy"
      @update:show="(value: boolean) => { if (!value) closeCredential(); }"
    >
      <NSpin :show="credentialLoading">
        <NSpace v-if="credentialMember" vertical :size="14">
          <div>{{ credentialMember.nickname }}（{{ credentialMember.id }}）</div>
          <NAlert v-if="credentialError" type="error" role="alert">{{ credentialError }}</NAlert>
          <form v-if="credentialStatus" autocomplete="off" @submit.prevent="saveCredential">
            <NFormItem label="登录账号" label-for="member-credential-username">
              <NInput v-model:value="credentialForm.username" maxlength="32" placeholder="4–32 位英文字母、数字或下划线"
                :input-props="{ id: 'member-credential-username', autocomplete: 'off' }" :disabled="credentialBusy" />
            </NFormItem>
            <NFormItem label="新密码" label-for="member-credential-password">
              <NInput v-model:value="credentialForm.password" type="password" show-password-on="click" maxlength="128"
                placeholder="12–128 位字符" :input-props="{ id: 'member-credential-password', autocomplete: 'new-password' }" :disabled="credentialBusy" />
            </NFormItem>
            <NSpace justify="space-between" align="center">
              <NButton v-if="credentialStatus.enabled" type="error" secondary :disabled="credentialBusy" @click="confirmDisableCredential">停用密码登录</NButton>
              <span v-else class="dim">{{ credentialStatus.username ? '密码登录已停用' : '尚未开通密码登录' }}</span>
              <NSpace>
                <NButton :disabled="credentialBusy" @click="closeCredential">取消</NButton>
                <NButton type="primary" attr-type="submit" :loading="credentialBusy">保存账号密码</NButton>
              </NSpace>
            </NSpace>
          </form>
        </NSpace>
      </NSpin>
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
            <input ref="photoInput" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple hidden @change="uploadConsumptionPhotos" />
            <NAlert v-if="photoError" type="error" class="photo-error" role="alert">{{ photoError }}</NAlert>
            <NEmpty v-if="historyOrders.length === 0" description="暂无消费记录" />
            <div v-else class="history-list">
              <div v-for="item in historyOrders" :key="item.id" class="history-row">
                <div class="history-main">
                  <strong>{{ item.title }}</strong>
                  <span class="dim">{{ item.orderDate }} · {{ item.orderNo }} · 实扣 ¥{{ formatMoney(item.finalPrice) }}</span>
                  <NSpace v-if="item.effectImages.length" :size="6">
                    <div v-for="image in item.effectImages" :key="image" class="consumption-photo">
                      <NImage width="80" height="80" object-fit="cover" :src="toAbsoluteImageUrl(image)" :preview-src="toAbsoluteImageUrl(image)" alt="本次消费美甲图" />
                      <NButton v-if="item.consumptionPhotos?.some(photo => photo.url === image)" size="tiny" quaternary :disabled="!!photoBusy" @click="removeConsumptionPhoto(item, item.consumptionPhotos!.find(photo => photo.url === image)!.id)">移除图片</NButton>
                    </div>
                  </NSpace>
                </div>
                <NSpace>
                  <NButton size="small" :loading="photoBusy === item.id" :disabled="!!photoBusy || item.effectImages.length >= 9" @click="chooseConsumptionPhotos(item)">上传美甲图</NButton>
                  <NButton v-if="item.source !== 'POSPAL'" type="error" secondary size="small" :loading="historyDeletingId === item.id" @click="confirmDeleteHistory('order', item.id)">作废并退回</NButton>
                </NSpace>
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
.consumption-photo { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.photo-error { margin-bottom: 12px; }
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
