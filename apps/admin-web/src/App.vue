<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api, toAbsoluteImageUrl } from '@/api/client';
import type {
  Appointment,
  AppointmentStatus,
  AuditLog,
  ConsumptionOrder,
  MemberLevel,
  MemberProfile,
  ProductType,
  RechargeOrder,
} from '@member-platform/shared';

type Tab = 'members' | 'levels' | 'recharges' | 'orders' | 'appointments' | 'logs';

const currentTab = ref<Tab>('members');
const loading = ref(false);
const creatingMember = ref(false);
const error = ref('');

const members = ref<MemberProfile[]>([]);
const memberEditRows = ref<
  Record<
    string,
    {
      id: string;
      nickname: string;
      remark: string;
      birthday: string;
      levelId: string;
      discountRate: number;
      balance: number;
      points: number;
    }
  >
>({});
const levels = ref<MemberLevel[]>([]);
const levelEditRows = ref<Record<string, { name: string; minPoints: number; discountRate: number }>>({});
const levelSaveStatus = ref<Record<string, 'saving' | 'saved'>>({});
const productTypes = ref<ProductType[]>([]);
const recharges = ref<RechargeOrder[]>([]);
const orders = ref<ConsumptionOrder[]>([]);
const appointments = ref<Appointment[]>([]);
const logs = ref<AuditLog[]>([]);

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
const levelForm = ref({ name: '', minPoints: 0, discountRate: 1 });
const rejectReason = ref('资料不完整');

const showOrderModal = ref(false);
const showSubmitBubble = ref(false);
const uploadingImages = ref(false);
const memberKeyword = ref('');
const orderFilterUserId = ref('all');
const newProductTypeName = ref('');
const customProductType = ref('');
const appointmentMonth = ref(new Date().toISOString().slice(0, 7));
const showAppointmentModal = ref(false);
const editingAppointmentId = ref('');
const appointmentConfirmBubble = ref(false);
const appointmentMemberKeyword = ref('');

const orderForm = ref({
  userId: '',
  productType: '',
  title: '门店消费',
  originalPrice: 100,
  discountRate: 1,
  effectImages: [] as string[],
  orderDate: new Date().toISOString().slice(0, 10),
  remark: '',
});
const appointmentForm = ref({
  userId: '',
  appointmentDate: new Date().toISOString().slice(0, 10),
  startTime: '09:00',
  status: 'CONFIRMED' as AppointmentStatus,
  remark: '',
  adminRemark: '',
});

const appointmentEditRows = ref<Record<string, { status: AppointmentStatus; adminRemark: string }>>({});
const selectedAppointmentDate = ref('');
const appointmentAction = ref<{
  id: string;
  status: Extract<AppointmentStatus, 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'>;
  reason: string;
} | null>(null);

const matchedMembers = computed(() => {
  const keyword = memberKeyword.value.trim().toLowerCase();
  if (!keyword) return members.value;
  return members.value.filter((member) => {
    const hay = `${member.nickname} ${member.id} ${member.openId} ${member.remark || ''}`.toLowerCase();
    return hay.includes(keyword);
  });
});
const matchedAppointmentMembers = computed(() => {
  const keyword = appointmentMemberKeyword.value.trim().toLowerCase();
  if (!keyword) return members.value;
  return members.value.filter((member) => {
    const hay = `${member.nickname} ${member.id} ${member.openId} ${member.phone || ''} ${member.remark || ''}`.toLowerCase();
    return hay.includes(keyword);
  });
});

const selectedMember = computed(() => members.value.find((item) => item.id === orderForm.value.userId));
const selectedLevel = computed(() =>
  selectedMember.value ? levels.value.find((level) => level.id === selectedMember.value?.levelId) : undefined,
);
const memberDiscountRate = computed(() => selectedMember.value?.discountRate ?? selectedLevel.value?.discountRate ?? 1);
const finalPrice = computed(() => Math.round(orderForm.value.originalPrice * orderForm.value.discountRate * 100) / 100);
const levelUsageCounts = computed(() => {
  const counts: Record<string, number> = {};
  members.value.forEach((member) => {
    counts[member.levelId] = (counts[member.levelId] || 0) + 1;
  });
  return counts;
});
const pendingAppointmentCount = computed(
  () => appointments.value.filter((appointment) => appointment.status === 'PENDING').length,
);
const weekLabels = ['日', '一', '二', '三', '四', '五', '六'];
const scheduleSlots = Array.from({ length: 24 }, (_, index) => {
  const startMinutes = 9 * 60 + index * 30;
  const endMinutes = startMinutes + 30;
  return {
    start: formatMinutes(startMinutes),
    end: formatMinutes(endMinutes),
    label: `${formatMinutes(startMinutes)}-${formatMinutes(endMinutes)}`,
  };
});
const appointmentCalendarDays = computed(() => {
  const [year, month] = appointmentMonth.value.split('-').map((value) => Number(value));
  const firstDay = new Date(year, month - 1, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const value = formatDate(date);
    return {
      key: `${value}-${index}`,
      date: value,
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
    };
  });
});
const appointmentCalendarTitle = computed(() => {
  const [year, month] = appointmentMonth.value.split('-');
  return `${year}年${Number(month)}月`;
});
const appointmentsByDate = computed(() =>
  appointments.value.reduce<Record<string, Appointment[]>>((groups, item) => {
    groups[item.appointmentDate] = groups[item.appointmentDate] || [];
    groups[item.appointmentDate].push(item);
    return groups;
  }, {}),
);
const selectedDateAppointments = computed(() =>
  (appointmentsByDate.value[selectedAppointmentDate.value] || []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime)),
);
const appointmentEndTime = computed(() => appointmentForm.value.startTime);

const auditActionLabels: Record<string, string> = {
  'seed.init': '系统初始化',
  'auth.wechat.login': '会员微信登录',
  'recharge.apply': '提交充值申请',
  'recharge.approve': '通过充值申请',
  'recharge.reject': '拒绝充值申请',
  'member.create': '新增会员',
  'member.update': '修改会员资料',
  'member.self.update': '会员自助修改资料',
  'member_level.create': '新增会员等级',
  'member_level.update': '修改会员等级',
  'member_level.delete': '删除会员等级',
  'product_type.create': '新增产品类型',
  'product_type.update': '修改产品类型',
  'product_type.delete': '删除产品类型',
  'consumption.create': '创建消费订单',
  'appointment.create': '会员提交预约',
  'appointment.update': '处理预约',
};

const auditFieldLabels: Record<string, string> = {
  originMemberId: '原会员 ID',
  openId: 'OpenID',
  userId: '会员 ID',
  phone: '手机号',
  productType: '产品类型',
  originalPrice: '原价',
  discountRate: '折扣率',
  finalPrice: '会员价',
  message: '说明',
  comment: '备注',
  reason: '原因',
  balance: '余额',
  points: '积分',
  nickname: '昵称',
  remark: '会员备注',
  birthday: '生日',
  levelId: '等级 ID',
  levelName: '等级名称',
  appointmentDate: '预约日期',
  startTime: '开始时间',
  endTime: '结束时间',
  status: '状态',
  adminRemark: '后台备注',
  id: '会员 ID',
  changes: '变更明细',
};

function getAuditActionLabel(action: string): string {
  return auditActionLabels[action] || action;
}

function formatAuditValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return String(value);
}

function formatAuditMetadata(metadata: AuditLog['metadata']): string[] {
  if (!metadata) return ['无详情'];

  const lines: string[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'changes' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [field, detail] of Object.entries(value as Record<string, unknown>)) {
        const fieldLabel = auditFieldLabels[field] || field;
        if (detail && typeof detail === 'object' && 'from' in detail && 'to' in detail) {
          const change = detail as { from?: unknown; to?: unknown };
          lines.push(`${fieldLabel}：${formatAuditValue(change.from)} → ${formatAuditValue(change.to)}`);
        } else {
          lines.push(`${fieldLabel}：${formatAuditValue(detail)}`);
        }
      }
      continue;
    }

    if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
      const change = value as { from?: unknown; to?: unknown };
      lines.push(`${auditFieldLabels[key] || key}：${formatAuditValue(change.from)} → ${formatAuditValue(change.to)}`);
      continue;
    }

    lines.push(`${auditFieldLabels[key] || key}：${formatAuditValue(value)}`);
  }

  return lines;
}

function appointmentStatusText(status: AppointmentStatus): string {
  const map: Record<AppointmentStatus, string> = {
    PENDING: '待处理',
    CONFIRMED: '已接受',
    CANCELLED: '已拒绝',
    COMPLETED: '已结束',
  };
  return map[status] || status;
}

function appointmentTimeText(item: Appointment): string {
  return item.endTime && item.endTime !== item.startTime ? `${item.startTime}-${item.endTime}` : item.startTime;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function changeAppointmentMonth(offset: number) {
  const [year, month] = appointmentMonth.value.split('-').map((value) => Number(value));
  const next = new Date(year, month - 1 + offset, 1);
  appointmentMonth.value = formatDate(next).slice(0, 7);
}

function getSlotAppointments(date: string, startTime: string): Appointment[] {
  return (appointmentsByDate.value[date] || []).filter((item) => item.startTime === startTime);
}

function getBookedSlots(date: string) {
  return scheduleSlots
    .map((slot) => ({
      slot,
      items: getSlotAppointments(date, slot.start),
    }))
    .filter((group) => group.items.length > 0);
}

function getAppointmentStatusCounts(date: string): Record<AppointmentStatus, number> {
  return (appointmentsByDate.value[date] || []).reduce(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    { PENDING: 0, CONFIRMED: 0, CANCELLED: 0, COMPLETED: 0 } as Record<AppointmentStatus, number>,
  );
}

function openAppointmentDay(date: string) {
  if (!appointmentsByDate.value[date]?.length) return;
  selectedAppointmentDate.value = date;
  appointmentAction.value = null;
}

function closeAppointmentDay() {
  selectedAppointmentDate.value = '';
  appointmentAction.value = null;
}

function openCreateAppointmentModal(date?: string) {
  editingAppointmentId.value = '';
  appointmentConfirmBubble.value = false;
  appointmentMemberKeyword.value = '';
  appointmentForm.value = {
    userId: members.value[0]?.id || '',
    appointmentDate: date || selectedAppointmentDate.value || new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    status: 'CONFIRMED',
    remark: '',
    adminRemark: '',
  };
  showAppointmentModal.value = true;
}

function openEditAppointmentModal(item: Appointment) {
  editingAppointmentId.value = item.id;
  appointmentConfirmBubble.value = false;
  appointmentMemberKeyword.value = '';
  appointmentForm.value = {
    userId: item.userId,
    appointmentDate: item.appointmentDate,
    startTime: item.startTime,
    status: item.status,
    remark: item.remark || '',
    adminRemark: item.adminRemark || '',
  };
  showAppointmentModal.value = true;
}

function closeAppointmentModal() {
  showAppointmentModal.value = false;
  appointmentConfirmBubble.value = false;
  editingAppointmentId.value = '';
}

async function submitAppointmentForm() {
  error.value = '';
  if (!appointmentForm.value.userId) {
    error.value = '请选择会员';
    return;
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentForm.value.startTime)) {
    error.value = '预约时间请输入 HH:mm 格式，例如 10:17';
    return;
  }

  const payload = {
    userId: appointmentForm.value.userId,
    appointmentDate: appointmentForm.value.appointmentDate,
    startTime: appointmentForm.value.startTime,
    endTime: appointmentEndTime.value,
    status: appointmentForm.value.status,
    remark: appointmentForm.value.remark.trim() || undefined,
    adminRemark: appointmentForm.value.adminRemark.trim() || undefined,
  };

  try {
    if (editingAppointmentId.value) {
      await api.updateAppointment(editingAppointmentId.value, payload);
    } else {
      await api.createAppointment(payload);
    }
    closeAppointmentModal();
    await loadAll();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

function beginAppointmentAction(
  item: Appointment,
  status: Extract<AppointmentStatus, 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'>,
) {
  appointmentAction.value = {
    id: item.id,
    status,
    reason: status === 'CANCELLED' ? item.adminRemark || '' : '',
  };
}

function appointmentActionText(status: AppointmentStatus): string {
  const map: Record<AppointmentStatus, string> = {
    PENDING: '处理',
    CONFIRMED: '接受',
    CANCELLED: '拒绝',
    COMPLETED: '结束',
  };
  return map[status] || status;
}

async function confirmAppointmentAction() {
  if (!appointmentAction.value) return;
  const action = appointmentAction.value;
  const reason = action.reason.trim();
  if (action.status === 'CANCELLED' && !reason) {
    error.value = '拒绝预约需要填写拒绝原因';
    return;
  }

  await api.updateAppointment(action.id, {
    status: action.status,
    adminRemark: action.status === 'CANCELLED' ? reason : undefined,
  });
  appointmentAction.value = null;
  await loadAll();
}

async function loadAll() {
  loading.value = true;
  error.value = '';
  try {
    const [memberList, levelList, productTypeList, rechargeList, orderList, appointmentList, auditList] =
      await Promise.all([
        api.listMembers(),
        api.listLevels(),
        api.listProductTypes(),
        api.listRecharges(),
        api.listConsumptionOrders(),
        api.listAppointments(),
        api.listAuditLogs(),
      ]);

    members.value = memberList;
    memberEditRows.value = Object.fromEntries(
      memberList.map((item) => [
        item.id,
        {
          id: item.id,
          nickname: item.nickname,
          remark: item.remark || '',
          birthday: item.birthday || '',
          levelId: item.levelId,
          discountRate: item.discountRate,
          balance: item.balance,
          points: item.points,
        },
      ]),
    );

    levels.value = levelList;
    if (!memberForm.value.levelId && levelList.length > 0) {
      memberForm.value.levelId = levelList[0].id;
      memberForm.value.discountRate = levelList[0].discountRate;
    }
    levelEditRows.value = Object.fromEntries(
      levelList.map((item) => [
        item.id,
        {
          name: item.name,
          minPoints: item.minPoints,
          discountRate: item.discountRate,
        },
      ]),
    );

    productTypes.value = productTypeList;
    recharges.value = rechargeList;
    orders.value = orderList;
    appointments.value = appointmentList;
    appointmentEditRows.value = Object.fromEntries(
      appointmentList.map((item) => [
        item.id,
        {
          status: item.status,
          adminRemark: item.adminRemark || '',
        },
      ]),
    );
    logs.value = auditList;

    if (!orderForm.value.userId && memberList.length > 0) {
      orderForm.value.userId = memberList[0].id;
      orderForm.value.discountRate = memberList[0].discountRate;
    }
    if (!appointmentForm.value.userId && memberList.length > 0) {
      appointmentForm.value.userId = memberList[0].id;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function saveMember(originId: string) {
  const row = memberEditRows.value[originId];
  if (!row) return;

  await api.updateMember(originId, {
    id: row.id.trim(),
    nickname: row.nickname.trim(),
    remark: row.remark.trim() || undefined,
    birthday: row.birthday || undefined,
    levelId: row.levelId,
    discountRate: Number(row.discountRate),
    balance: Number(row.balance),
    points: Number(row.points),
  });
  await loadAll();
}

async function createMember() {
  if (creatingMember.value) return;
  error.value = '';
  const nickname = memberForm.value.nickname.trim();
  if (!nickname) {
    error.value = '请填写会员昵称';
    return;
  }

  const levelId = memberForm.value.levelId || levels.value[0]?.id;
  if (!levelId) {
    error.value = '请先创建会员等级';
    return;
  }

  const selected = levels.value.find((level) => level.id === levelId);
  const discountRate = Number(memberForm.value.discountRate || selected?.discountRate || 1);
  if (discountRate < 0.1 || discountRate > 1) {
    error.value = '折扣必须在 0.1 到 1 之间';
    return;
  }

  creatingMember.value = true;
  try {
    await api.createMember({
      id: memberForm.value.id.trim() || undefined,
      nickname,
      remark: memberForm.value.remark.trim() || undefined,
      phone: memberForm.value.phone.trim() || undefined,
      birthday: memberForm.value.birthday || undefined,
      levelId,
      discountRate,
      balance: Number(memberForm.value.balance || 0),
      points: Number(memberForm.value.points || 0),
    });
    memberForm.value = {
      id: '',
      nickname: '',
      remark: '',
      phone: '',
      birthday: '',
      levelId,
      discountRate: selected?.discountRate || 1,
      balance: 0,
      points: 0,
    };
    await loadAll();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    creatingMember.value = false;
  }
}

async function createLevel() {
  error.value = '';
  const name = levelForm.value.name.trim();
  const discountRate = Number(levelForm.value.discountRate);
  if (!name) {
    error.value = '请填写等级名称';
    return;
  }
  if (discountRate < 0.1 || discountRate > 1) {
    error.value = '折扣必须在 0.1 到 1 之间';
    return;
  }

  try {
    await api.createLevel({
      name,
      minPoints: Number(levelForm.value.minPoints),
      discountRate,
    });
    levelForm.value = { name: '', minPoints: 0, discountRate: 1 };
    await loadAll();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function saveLevel(levelId: string) {
  error.value = '';
  const row = levelEditRows.value[levelId];
  if (!row) return;
  const name = row.name.trim();
  const discountRate = Number(row.discountRate);
  if (!name) {
    error.value = '请填写等级名称';
    return;
  }
  if (discountRate < 0.1 || discountRate > 1) {
    error.value = '折扣必须在 0.1 到 1 之间';
    return;
  }

  levelSaveStatus.value[levelId] = 'saving';
  try {
    await api.updateLevel(levelId, {
      name,
      minPoints: Number(row.minPoints),
      discountRate,
    });
    levelSaveStatus.value[levelId] = 'saved';
    await loadAll();
  } catch (e) {
    delete levelSaveStatus.value[levelId];
    error.value = e instanceof Error ? e.message : String(e);
  }
}

function clearLevelSaveStatus(levelId: string) {
  delete levelSaveStatus.value[levelId];
}

async function deleteLevel(level: MemberLevel) {
  error.value = '';
  const usedCount = levelUsageCounts.value[level.id] || 0;
  if (usedCount > 0) {
    error.value = `该等级已有 ${usedCount} 个会员使用，请先调整会员等级后再删除`;
    return;
  }

  if (!window.confirm(`确定删除等级「${level.name}」吗？此操作不可恢复。`)) {
    return;
  }

  try {
    await api.deleteLevel(level.id);
    await loadAll();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function createProductType() {
  const name = newProductTypeName.value.trim();
  if (!name) {
    error.value = '请填写产品类型名称';
    return;
  }
  try {
    await api.createProductType({ name, sortOrder: productTypes.value.length * 10 + 10 });
    newProductTypeName.value = '';
    await loadAll();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function deleteProductType(item: ProductType) {
  if (!window.confirm(`确定删除产品类型「${item.name}」吗？历史订单不会被删除。`)) {
    return;
  }
  try {
    await api.deleteProductType(item.id);
    if (orderForm.value.productType === item.name) {
      orderForm.value.productType = '';
    }
    await loadAll();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function approve(id: string) {
  await api.approveRecharge(id);
  await loadAll();
}

async function reject(id: string) {
  await api.rejectRecharge(id, { reason: rejectReason.value.trim() || '未提供原因' });
  await loadAll();
}

function openCreateOrderModal() {
  showOrderModal.value = true;
  showSubmitBubble.value = false;
  memberKeyword.value = '';
  customProductType.value = '';
  orderForm.value.orderDate = new Date().toISOString().slice(0, 10);
  if (!orderForm.value.userId && members.value.length > 0) {
    orderForm.value.userId = members.value[0].id;
  }
  orderForm.value.discountRate = memberDiscountRate.value;
}

function closeCreateOrderModal() {
  showOrderModal.value = false;
  showSubmitBubble.value = false;
}

function useCustomProductType() {
  orderForm.value.productType = customProductType.value.trim();
}

async function uploadEffectImages(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (!files.length) return;

  uploadingImages.value = true;
  try {
    const urls = await api.uploadImages(files);
    orderForm.value.effectImages.push(...urls);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    uploadingImages.value = false;
    input.value = '';
  }
}

function removeImage(index: number) {
  orderForm.value.effectImages.splice(index, 1);
}

async function confirmCreateOrder() {
  await api.createConsumptionOrder({
    userId: orderForm.value.userId,
    productType: orderForm.value.productType || undefined,
    title: orderForm.value.title.trim(),
    originalPrice: Number(orderForm.value.originalPrice),
    discountRate: Number(orderForm.value.discountRate),
    effectImages: orderForm.value.effectImages,
    orderDate: orderForm.value.orderDate,
    remark: orderForm.value.remark || undefined,
  });

  closeCreateOrderModal();
  showSubmitBubble.value = false;
  await loadAll();
}

async function loadFilteredOrders() {
  if (orderFilterUserId.value === 'all') {
    orders.value = await api.listConsumptionOrders();
    return;
  }
  orders.value = await api.listMemberConsumptionOrders(orderFilterUserId.value);
}

async function saveAppointment(id: string) {
  const row = appointmentEditRows.value[id];
  if (!row) return;
  await api.updateAppointment(id, {
    status: row.status,
    adminRemark: row.adminRemark || undefined,
  });
  await loadAll();
}

async function quickSetAppointment(id: string, status: AppointmentStatus) {
  const row = appointmentEditRows.value[id];
  if (!row) return;
  row.status = status;
  await saveAppointment(id);
}

watch(
  () => orderForm.value.userId,
  () => {
    orderForm.value.discountRate = memberDiscountRate.value;
  },
);

onMounted(loadAll);
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <h1>会员后台 v1</h1>
      <button class="nav-item" :class="{ active: currentTab === 'members' }" @click="currentTab = 'members'">
        会员管理
      </button>
      <button class="nav-item" :class="{ active: currentTab === 'levels' }" @click="currentTab = 'levels'">
        等级管理
      </button>
      <button class="nav-item" :class="{ active: currentTab === 'recharges' }" @click="currentTab = 'recharges'">
        充值审核
      </button>
      <button class="nav-item" :class="{ active: currentTab === 'orders' }" @click="currentTab = 'orders'">
        消费订单
      </button>
      <button class="nav-item" :class="{ active: currentTab === 'appointments' }" @click="currentTab = 'appointments'">
        预约排期
        <span v-if="pendingAppointmentCount" class="nav-badge">{{ pendingAppointmentCount }}</span>
      </button>
      <button class="nav-item" :class="{ active: currentTab === 'logs' }" @click="currentTab = 'logs'">
        审计日志
      </button>
    </aside>

    <main class="main">
      <div class="card inline" style="justify-content: space-between">
        <div>
          <strong>演示管理员：</strong>admin-001
          <small style="margin-left: 12px">{{ loading ? '加载中...' : '已连接 API' }}</small>
        </div>
        <button class="primary" @click="loadAll">刷新数据</button>
      </div>

      <div v-if="error" class="card" style="border-color: #fecaca; color: #b42318">{{ error }}</div>

      <section v-if="currentTab === 'members'" class="card">
        <h2>会员列表</h2>
        <div class="create-panel">
          <input v-model="memberForm.id" placeholder="会员ID（可选）" />
          <input v-model="memberForm.nickname" placeholder="会员昵称" />
          <input v-model="memberForm.remark" placeholder="备注（可选）" />
          <input v-model="memberForm.phone" placeholder="手机号（可选）" />
          <input v-model="memberForm.birthday" type="date" />
          <select v-model="memberForm.levelId">
            <option v-for="level in levels" :key="level.id" :value="level.id">
              {{ level.name }}
            </option>
          </select>
          <input v-model.number="memberForm.discountRate" type="number" step="0.01" min="0.1" max="1" placeholder="折扣" />
          <input v-model.number="memberForm.balance" type="number" step="0.01" min="0" placeholder="余额" />
          <input v-model.number="memberForm.points" type="number" step="1" min="0" placeholder="积分" />
          <button class="primary" :disabled="creatingMember" @click="createMember">
            {{ creatingMember ? '新增中...' : '新增会员' }}
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>会员 ID</th>
              <th>昵称</th>
              <th>备注</th>
              <th>生日</th>
              <th>等级</th>
              <th>折扣</th>
              <th>余额</th>
              <th>积分</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in members" :key="item.id">
              <td><input v-model="memberEditRows[item.id].id" /></td>
              <td><input v-model="memberEditRows[item.id].nickname" /></td>
              <td><input v-model="memberEditRows[item.id].remark" placeholder="备注" /></td>
              <td><input v-model="memberEditRows[item.id].birthday" type="date" /></td>
              <td>
                <select v-model="memberEditRows[item.id].levelId">
                  <option v-for="level in levels" :key="level.id" :value="level.id">
                    {{ level.name }}
                  </option>
                </select>
              </td>
              <td>
                <input v-model.number="memberEditRows[item.id].discountRate" type="number" step="0.01" min="0.1" max="1" />
              </td>
              <td><input v-model.number="memberEditRows[item.id].balance" type="number" step="0.01" min="0" /></td>
              <td><input v-model.number="memberEditRows[item.id].points" type="number" step="1" min="0" /></td>
              <td><button class="primary" @click="saveMember(item.id)">保存</button></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="currentTab === 'levels'" class="card">
        <h2>会员等级</h2>
        <div class="inline" style="margin-bottom: 12px">
          <input v-model="levelForm.name" placeholder="等级名称" />
          <input v-model.number="levelForm.minPoints" type="number" min="0" placeholder="最低积分" />
          <input v-model.number="levelForm.discountRate" type="number" step="0.01" min="0.1" max="1" placeholder="折扣" />
          <button class="primary" @click="createLevel">新增等级</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>最低积分</th>
              <th>折扣</th>
              <th>使用会员</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="level in levels" :key="level.id">
              <td><input v-model="levelEditRows[level.id].name" @input="clearLevelSaveStatus(level.id)" /></td>
              <td>
                <input v-model.number="levelEditRows[level.id].minPoints" type="number" min="0" @input="clearLevelSaveStatus(level.id)" />
              </td>
              <td>
                <input
                  v-model.number="levelEditRows[level.id].discountRate"
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1"
                  @input="clearLevelSaveStatus(level.id)"
                />
              </td>
              <td>{{ levelUsageCounts[level.id] || 0 }}</td>
              <td>
                <div class="inline">
                  <button
                    class="primary"
                    :class="{ success: levelSaveStatus[level.id] === 'saved' }"
                    :disabled="levelSaveStatus[level.id] === 'saving'"
                    @click="saveLevel(level.id)"
                  >
                    {{ levelSaveStatus[level.id] === 'saving' ? '保存中...' : levelSaveStatus[level.id] === 'saved' ? '已保存' : '保存' }}
                  </button>
                  <button class="danger" :disabled="(levelUsageCounts[level.id] || 0) > 0" @click="deleteLevel(level)">
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="currentTab === 'recharges'" class="card">
        <h2>充值审核</h2>
        <div class="inline" style="margin-bottom: 12px">
          <small>拒绝理由：</small>
          <input v-model="rejectReason" placeholder="填写拒绝原因" />
        </div>
        <table>
          <thead>
            <tr>
              <th>订单 ID（日期编号）</th>
              <th>会员 ID</th>
              <th>金额</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in recharges" :key="order.id">
              <td>{{ order.id }}</td>
              <td>{{ order.userId }}</td>
              <td>{{ order.amount }}</td>
              <td>{{ order.status }}</td>
              <td class="inline">
                <button class="primary" @click="approve(order.id)" :disabled="order.status !== 'PENDING'">通过</button>
                <button class="danger" @click="reject(order.id)" :disabled="order.status !== 'PENDING'">拒绝</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="currentTab === 'orders'" class="card">
        <div class="inline" style="justify-content: space-between; margin-bottom: 12px">
          <h2 style="margin: 0">用户消费记录</h2>
          <button class="primary" @click="openCreateOrderModal">创建订单</button>
        </div>

        <div class="inline" style="margin-bottom: 12px">
          <small>按会员筛选：</small>
          <select v-model="orderFilterUserId" @change="loadFilteredOrders">
            <option value="all">全部会员</option>
            <option v-for="member in members" :key="member.id" :value="member.id">
              {{ member.nickname }} ({{ member.id }})
            </option>
          </select>
          <button class="primary" @click="loadFilteredOrders">查询</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>订单号（日期编号）</th>
              <th>会员 ID</th>
              <th>产品类型</th>
              <th>标题</th>
              <th>原价</th>
              <th>会员价</th>
              <th>折扣</th>
              <th>效果图片</th>
              <th>订单日期</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id">
              <td>{{ order.orderNo }}</td>
              <td>{{ order.userId }}</td>
              <td>{{ order.productType || '-' }}</td>
              <td>{{ order.title }}</td>
              <td>{{ order.originalPrice }}</td>
              <td>{{ order.finalPrice }}</td>
              <td>{{ order.discountRate }}</td>
              <td>
                <div v-if="order.effectImages.length > 0" class="thumb-list in-table">
                  <a v-for="img in order.effectImages" :key="img" :href="toAbsoluteImageUrl(img)" target="_blank" rel="noreferrer">
                    <img :src="toAbsoluteImageUrl(img)" alt="效果图" />
                  </a>
                </div>
                <span v-else>-</span>
              </td>
              <td>{{ order.orderDate }}</td>
              <td>{{ order.remark || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="currentTab === 'appointments'" class="card">
        <div class="inline" style="justify-content: space-between; margin-bottom: 12px">
          <h2 style="margin: 0">预约排期表</h2>
          <div class="inline">
            <span class="pill">待处理 {{ pendingAppointmentCount }}</span>
            <button class="primary" @click="openCreateAppointmentModal()">新增预约</button>
          </div>
        </div>

        <div class="schedule-toolbar">
          <button class="ghost-btn" @click="changeAppointmentMonth(-1)">上个月</button>
          <strong>{{ appointmentCalendarTitle }}</strong>
          <button class="ghost-btn" @click="changeAppointmentMonth(1)">下个月</button>
        </div>

        <div class="admin-calendar">
          <div v-for="week in weekLabels" :key="week" class="admin-calendar-week">{{ week }}</div>
          <div
            v-for="day in appointmentCalendarDays"
            :key="day.key"
            class="admin-calendar-day"
            :class="{ muted: !day.inMonth, clickable: appointmentsByDate[day.date]?.length }"
            @click="openAppointmentDay(day.date)"
          >
            <div class="admin-calendar-date">
              <strong>{{ day.day }}</strong>
              <span v-if="appointmentsByDate[day.date]?.length" class="pill mini-pill">
                {{ appointmentsByDate[day.date].length }}
              </span>
            </div>

            <div v-if="!appointmentsByDate[day.date]?.length" class="schedule-empty">无预约</div>
            <div v-else class="day-summary">
              <div class="summary-row" v-for="item in appointmentsByDate[day.date].slice(0, 3)" :key="item.id">
                <span>{{ item.startTime }}</span>
                <strong>{{ item.memberNickname }}</strong>
                <em :class="`status-text status-${item.status.toLowerCase()}`">
                  {{ appointmentStatusText(item.status) }}
                </em>
              </div>
              <div class="summary-badges">
                <span v-if="getAppointmentStatusCounts(day.date).PENDING" class="count-badge pending">
                  待 {{ getAppointmentStatusCounts(day.date).PENDING }}
                </span>
                <span v-if="getAppointmentStatusCounts(day.date).CONFIRMED" class="count-badge confirmed">
                  接 {{ getAppointmentStatusCounts(day.date).CONFIRMED }}
                </span>
                <span v-if="getAppointmentStatusCounts(day.date).CANCELLED" class="count-badge cancelled">
                  拒 {{ getAppointmentStatusCounts(day.date).CANCELLED }}
                </span>
                <span v-if="getAppointmentStatusCounts(day.date).COMPLETED" class="count-badge completed">
                  结 {{ getAppointmentStatusCounts(day.date).COMPLETED }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="currentTab === 'logs'" class="card">
        <h2>审计日志</h2>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>行为</th>
              <th>操作者</th>
              <th>对象</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td>{{ log.createdAt }}</td>
              <td>{{ getAuditActionLabel(log.action) }}</td>
              <td>{{ log.actorId }} ({{ log.actorRole }})</td>
              <td>{{ log.targetType }} / {{ log.targetId }}</td>
              <td class="metadata-cell">
                <div v-for="(line, index) in formatAuditMetadata(log.metadata)" :key="`${log.id}-${index}`">
                  {{ line }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  </div>

  <div v-if="selectedAppointmentDate" class="modal-mask" @click.self="closeAppointmentDay">
    <div class="modal-card appointment-modal">
      <div class="inline" style="justify-content: space-between; margin-bottom: 12px">
        <div>
          <h3 style="margin: 0">{{ selectedAppointmentDate }} 预约详情</h3>
          <small>共 {{ selectedDateAppointments.length }} 个预约</small>
        </div>
        <div class="inline">
          <button class="primary" @click="openCreateAppointmentModal(selectedAppointmentDate)">新增当日预约</button>
          <button class="ghost-btn" @click="closeAppointmentDay">关闭</button>
        </div>
      </div>

      <div v-for="item in selectedDateAppointments" :key="item.id" class="appointment-detail-card" :class="`status-${item.status.toLowerCase()}`">
        <div class="appointment-detail-head">
          <div>
            <strong>{{ appointmentTimeText(item) }}</strong>
            <span>{{ item.memberNickname }}（{{ item.userId }}）</span>
          </div>
          <em :class="`status-text status-${item.status.toLowerCase()}`">{{ appointmentStatusText(item.status) }}</em>
        </div>

        <div class="detail-grid">
          <span>会员备注：{{ item.remark || '无' }}</span>
          <span v-if="item.adminRemark">处理备注：{{ item.adminRemark }}</span>
          <span>提交时间：{{ item.createdAt }}</span>
          <span>更新时间：{{ item.updatedAt }}</span>
        </div>

        <div class="inline appointment-actions">
          <button class="ghost-btn mini" @click="openEditAppointmentModal(item)">修改</button>
          <button v-if="item.status === 'PENDING'" class="primary mini" @click="beginAppointmentAction(item, 'CONFIRMED')">
            接受
          </button>
          <button v-if="item.status === 'PENDING'" class="danger mini" @click="beginAppointmentAction(item, 'CANCELLED')">
            拒绝
          </button>
          <button v-if="item.status === 'CONFIRMED'" class="primary mini" @click="beginAppointmentAction(item, 'COMPLETED')">
            已结束
          </button>
        </div>

        <div v-if="appointmentAction?.id === item.id" class="action-bubble">
          <strong>确认{{ appointmentActionText(appointmentAction.status) }}这个预约？</strong>
          <label v-if="appointmentAction.status === 'CANCELLED'" class="field-label">拒绝原因（会同步给用户）</label>
          <textarea
            v-if="appointmentAction.status === 'CANCELLED'"
            v-model="appointmentAction.reason"
            placeholder="请输入拒绝原因"
          ></textarea>
          <div class="inline" style="margin-top: 8px">
            <button class="primary mini" @click="confirmAppointmentAction">
              确认{{ appointmentActionText(appointmentAction.status) }}
            </button>
            <button class="ghost-btn mini" @click="appointmentAction = null">再检查一下</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showAppointmentModal" class="modal-mask" @click.self="closeAppointmentModal">
    <div class="modal-card">
      <h3>{{ editingAppointmentId ? '修改预约' : '新增预约' }}</h3>

      <label class="field-label">检索会员</label>
      <input v-model="appointmentMemberKeyword" placeholder="输入会员昵称 / 会员 ID / 手机号 / 备注" />

      <label class="field-label">选择会员</label>
      <select v-model="appointmentForm.userId">
        <option v-for="member in matchedAppointmentMembers" :key="member.id" :value="member.id">
          {{ member.nickname }} ({{ member.id }}) {{ member.remark ? `- ${member.remark}` : '' }}
        </option>
      </select>

      <div class="inline-grid">
        <div>
          <label class="field-label">预约日期</label>
          <input v-model="appointmentForm.appointmentDate" type="date" />
        </div>
        <div>
          <label class="field-label">预约时间</label>
          <input v-model="appointmentForm.startTime" type="time" step="60" placeholder="例如 10:17" />
        </div>
      </div>

      <label class="field-label">状态</label>
      <select v-model="appointmentForm.status">
        <option value="PENDING">待处理</option>
        <option value="CONFIRMED">已接受</option>
        <option value="CANCELLED">已拒绝</option>
        <option value="COMPLETED">已结束</option>
      </select>

      <label class="field-label">用户端备注</label>
      <input v-model="appointmentForm.remark" placeholder="会同步显示给用户" />

      <label class="field-label">处理说明 / 拒绝原因</label>
      <textarea v-model="appointmentForm.adminRemark" placeholder="拒绝预约时必须填写，会同步显示给用户"></textarea>

      <div class="modal-actions">
        <button class="ghost-btn" @click="closeAppointmentModal">取消</button>
        <div class="submit-wrap">
          <button class="primary" @click="appointmentConfirmBubble = !appointmentConfirmBubble">
            {{ editingAppointmentId ? '保存修改' : '创建预约' }}
          </button>
          <div v-if="appointmentConfirmBubble" class="submit-bubble">
            <div>确认{{ editingAppointmentId ? '保存本次修改' : '创建这条预约' }}并同步到小程序？</div>
            <div class="inline" style="margin-top: 8px">
              <button class="primary" @click="submitAppointmentForm">确认提交</button>
              <button class="ghost-btn" @click="appointmentConfirmBubble = false">再检查一下</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showOrderModal" class="modal-mask" @click.self="closeCreateOrderModal">
    <div class="modal-card">
      <h3>创建消费订单</h3>

      <label class="field-label">模糊查询会员</label>
      <input v-model="memberKeyword" placeholder="输入会员昵称 / 会员 ID / 备注" />

      <label class="field-label">选择会员</label>
      <select v-model="orderForm.userId">
        <option v-for="member in matchedMembers" :key="member.id" :value="member.id">
          {{ member.nickname }} ({{ member.id }}) {{ member.remark ? `- ${member.remark}` : '' }}
        </option>
      </select>

      <label class="field-label">产品类型（可选）</label>
      <div class="inline">
        <select v-model="orderForm.productType">
          <option value="">未选择</option>
          <option v-for="item in productTypes" :key="item.id" :value="item.name">{{ item.name }}</option>
        </select>
        <input v-model="customProductType" placeholder="自定义类型" @input="useCustomProductType" />
      </div>

      <div class="product-type-panel">
        <div class="inline">
          <input v-model="newProductTypeName" placeholder="新增预设类型" />
          <button class="primary" @click="createProductType">新增预设</button>
        </div>
        <div class="chip-list">
          <span v-for="item in productTypes" :key="item.id" class="chip">
            {{ item.name }}
            <button class="chip-delete" @click="deleteProductType(item)">×</button>
          </span>
        </div>
      </div>

      <label class="field-label">订单标题</label>
      <input v-model="orderForm.title" placeholder="例如：肩颈理疗" />

      <div class="inline-grid">
        <div>
          <label class="field-label">订单原价</label>
          <input v-model.number="orderForm.originalPrice" type="number" step="0.01" min="0.01" />
        </div>
        <div>
          <label class="field-label">折扣率</label>
          <input v-model.number="orderForm.discountRate" type="number" step="0.01" min="0.1" max="1" />
        </div>
      </div>

      <div class="inline-grid">
        <div>
          <label class="field-label">会员最终价（自动）</label>
          <input :value="finalPrice" readonly />
        </div>
        <div>
          <label class="field-label">会员默认折扣</label>
          <input :value="memberDiscountRate" readonly />
        </div>
      </div>

      <div class="inline-grid">
        <div>
          <label class="field-label">当前余额</label>
          <input :value="selectedMember?.balance ?? 0" readonly />
        </div>
        <div>
          <label class="field-label">下单后余额（预估）</label>
          <input :value="Math.max(0, Math.round(((selectedMember?.balance ?? 0) - finalPrice) * 100) / 100)" readonly />
        </div>
      </div>

      <small>
        当前下单折扣：{{ orderForm.discountRate }}
        <span v-if="selectedLevel">（{{ selectedLevel.name }}）</span>
      </small>

      <label class="field-label">订单日期</label>
      <input v-model="orderForm.orderDate" type="date" />

      <label class="field-label">效果图片（上传）</label>
      <input type="file" accept="image/*" multiple @change="uploadEffectImages" />
      <small v-if="uploadingImages">图片上传中...</small>
      <div v-if="orderForm.effectImages.length > 0" class="thumb-list">
        <div v-for="(img, index) in orderForm.effectImages" :key="img" class="thumb-item">
          <img :src="toAbsoluteImageUrl(img)" alt="effect" />
          <button class="danger mini" @click="removeImage(index)">删除</button>
        </div>
      </div>

      <label class="field-label">备注</label>
      <input v-model="orderForm.remark" placeholder="可选备注" />

      <div class="modal-actions">
        <button class="ghost-btn" @click="closeCreateOrderModal">取消</button>
        <div class="submit-wrap">
          <button class="primary" @click="showSubmitBubble = !showSubmitBubble">提交订单</button>
          <div v-if="showSubmitBubble" class="submit-bubble">
            <div>确认创建订单并扣减余额？</div>
            <div class="inline" style="margin-top: 8px">
              <button class="primary" @click="confirmCreateOrder">确认提交</button>
              <button class="ghost-btn" @click="showSubmitBubble = false">再检查一下</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
