<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  NAlert,
  NButton,
  NCalendar,
  NCard,
  NAvatar,
  NDatePicker,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NIcon,
  NImage,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NTag,
  NTimePicker,
  useDialog,
  useMessage,
} from 'naive-ui';
import {
  CalendarOff,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Pencil,
  RotateCcw,
  Trash2,
  UserRound,
  XCircle,
} from '@lucide/vue';
import { BUSINESS_TYPE } from '@member-platform/shared';
import type {
  Appointment,
  AppointmentAvailabilityScope,
  AppointmentStatus,
  AppointmentUnavailableDate,
  BusinessType,
} from '@member-platform/shared';
import { api, toAbsoluteImageUrl } from '@/api/client';
import { useDataStore } from '@/composables/useDataStore';
import {
  appointmentActionText,
  appointmentStatusText,
  appointmentStatusType,
  appointmentTimeText,
} from '@/composables/useFormatters';

const { appointments, members, catalogProducts, loadAll } = useDataStore();
const message = useMessage();
const dialog = useDialog();

const calendarTimestamp = ref(Date.now());
const selectedDate = ref('');

const memberKeyword = ref('');
const showModal = ref(false);
const editingId = ref('');
const submitting = ref(false);
const detailMemberId = ref('');
const reviewItem = ref<Appointment | null>(null);
const reviewSubmitting = ref(false);
const unavailableDates = ref<AppointmentUnavailableDate[]>([]);
const unavailableLoading = ref(false);
const unavailableSubmitting = ref(false);
const showUnavailableModal = ref(false);
const unavailableForm = ref<{
  appointmentDate: number;
  businessType: AppointmentAvailabilityScope;
  reason: string;
}>({
  appointmentDate: Date.now(),
  businessType: 'ALL',
  reason: '当日预约已满',
});
const reviewForm = ref({
  appointmentDate: Date.now(),
  startTime: timeToTimestamp('09:00'),
});

interface FormShape {
  userId: string;
  businessType: BusinessType;
  productId: string;
  appointmentDate: number;
  startTime: number;
  status: AppointmentStatus;
  remark: string;
  adminRemark: string;
}

const form = ref<FormShape>({
  userId: '',
  businessType: BUSINESS_TYPE.NAIL,
  productId: '',
  appointmentDate: Date.now(),
  startTime: timeToTimestamp('09:00'),
  status: 'CONFIRMED',
  remark: '',
  adminRemark: '',
});

function dateString(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeString(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeToTimestamp(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function parseDate(d: string): number {
  return new Date(`${d}T00:00:00`).getTime();
}

const memberOptions = computed(() =>
  members.value
    .filter((m) => {
      const kw = memberKeyword.value.trim().toLowerCase();
      if (!kw) return true;
      const hay = `${m.nickname} ${m.id} ${m.phone || ''} ${m.remark || ''}`.toLowerCase();
      return hay.includes(kw);
    })
    .map((m) => ({ label: `${m.nickname}（${m.id}）`, value: m.id })),
);

const businessOptions = [
  { label: '美甲', value: BUSINESS_TYPE.NAIL },
  { label: '饰品', value: BUSINESS_TYPE.ACCESSORY },
  { label: '鲜花', value: BUSINESS_TYPE.FLOWER },
];

const availabilityScopeOptions = [
  { label: '全部业务', value: 'ALL' },
  ...businessOptions,
];

const businessText: Record<BusinessType, string> = {
  [BUSINESS_TYPE.NAIL]: '美甲',
  [BUSINESS_TYPE.ACCESSORY]: '饰品',
  [BUSINESS_TYPE.FLOWER]: '鲜花',
};

const productOptions = computed(() => [
  { label: form.value.businessType === BUSINESS_TYPE.ACCESSORY ? '请选择饰品' : '不关联产品', value: '' },
  ...catalogProducts.value
    .filter((item) => item.businessType === form.value.businessType && item.isActive)
    .map((item) => ({ label: `${item.name}${item.referencePrice === undefined ? '' : ` ¥${item.referencePrice}`}`, value: item.id })),
]);

const appointmentsByDate = computed(() =>
  appointments.value.reduce<Record<string, Appointment[]>>((groups, item) => {
    (groups[item.appointmentDate] = groups[item.appointmentDate] || []).push(item);
    return groups;
  }, {}),
);

const selectedDateAppointments = computed(() =>
  (appointmentsByDate.value[selectedDate.value] || [])
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime)),
);

const unavailableByDate = computed(() =>
  unavailableDates.value.reduce<Record<string, AppointmentUnavailableDate[]>>((groups, item) => {
    (groups[item.appointmentDate] = groups[item.appointmentDate] || []).push(item);
    return groups;
  }, {}),
);

const pendingCount = computed(
  () => appointments.value.filter((a) => a.status === 'PENDING').length,
);

const detailMember = computed(() => members.value.find((item) => item.id === detailMemberId.value));
const reviewMember = computed(() => members.value.find((item) => item.id === reviewItem.value?.userId));

function statusCounts(date: string): Record<AppointmentStatus, number> {
  return (appointmentsByDate.value[date] || []).reduce(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    { PENDING: 0, CONFIRMED: 0, CANCELLED: 0, COMPLETED: 0 } as Record<AppointmentStatus, number>,
  );
}

function pickDate(timestamp: number) {
  selectedDate.value = dateString(timestamp);
}

function calendarDateKey(year: number, month: number, date: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

function availabilityScopeText(scope: AppointmentAvailabilityScope): string {
  return scope === 'ALL' ? '全部业务' : businessText[scope];
}

function isPastDate(timestamp: number): boolean {
  return dateString(timestamp) < dateString(Date.now());
}

function openUnavailableDateModal(dateStr?: string) {
  unavailableForm.value = {
    appointmentDate: dateStr ? parseDate(dateStr) : calendarTimestamp.value,
    businessType: 'ALL',
    reason: '当日预约已满',
  };
  showUnavailableModal.value = true;
}

async function loadUnavailableDates() {
  unavailableLoading.value = true;
  try {
    unavailableDates.value = await api.listAppointmentUnavailableDates();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '不可预约日期加载失败');
  } finally {
    unavailableLoading.value = false;
  }
}

async function submitUnavailableDate() {
  if (unavailableSubmitting.value) return;
  unavailableSubmitting.value = true;
  try {
    await api.createAppointmentUnavailableDate({
      appointmentDate: dateString(unavailableForm.value.appointmentDate),
      businessType: unavailableForm.value.businessType,
      reason: unavailableForm.value.reason.trim() || undefined,
    });
    message.success('已设置为不可预约日期');
    showUnavailableModal.value = false;
    await loadUnavailableDates();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '设置失败');
  } finally {
    unavailableSubmitting.value = false;
  }
}

function confirmRestoreDate(item: AppointmentUnavailableDate) {
  dialog.warning({
    title: '恢复顾客预约',
    content: `确定恢复 ${item.appointmentDate} 的${availabilityScopeText(item.businessType)}预约吗？`,
    positiveText: '恢复预约',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.deleteAppointmentUnavailableDate(item.id);
        message.success('该日期已恢复预约');
        await loadUnavailableDates();
      } catch (error) {
        message.error(error instanceof Error ? error.message : '恢复失败');
      }
    },
  });
}

function openCreate(dateStr?: string) {
  editingId.value = '';
  memberKeyword.value = '';
  form.value = {
    userId: members.value[0]?.id || '',
    businessType: BUSINESS_TYPE.NAIL,
    productId: '',
    appointmentDate: dateStr ? parseDate(dateStr) : Date.now(),
    startTime: timeToTimestamp('09:00'),
    status: 'CONFIRMED',
    remark: '',
    adminRemark: '',
  };
  showModal.value = true;
}

function openEdit(item: Appointment) {
  editingId.value = item.id;
  memberKeyword.value = '';
  form.value = {
    userId: item.userId,
    businessType: item.businessType || BUSINESS_TYPE.NAIL,
    productId: item.productId || '',
    appointmentDate: parseDate(item.appointmentDate),
    startTime: timeToTimestamp(item.startTime),
    status: item.status,
    remark: item.remark || '',
    adminRemark: item.adminRemark || '',
  };
  showModal.value = true;
}

async function submitForm() {
  if (!form.value.userId) {
    message.warning('请选择会员');
    return;
  }
  submitting.value = true;
  const payload = {
    userId: form.value.userId,
    businessType: form.value.businessType,
    productId: form.value.productId || undefined,
    appointmentDate: dateString(form.value.appointmentDate),
    startTime: timeString(form.value.startTime),
    endTime: timeString(form.value.startTime),
    status: form.value.status,
    remark: form.value.remark.trim() || undefined,
    adminRemark: form.value.adminRemark.trim() || undefined,
  };
  try {
    if (editingId.value) {
      await api.updateAppointment(editingId.value, payload);
      message.success('已保存');
    } else {
      await api.createAppointment(payload);
      message.success('已创建预约');
    }
    showModal.value = false;
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '提交失败');
  } finally {
    submitting.value = false;
  }
}

const reasonModal = ref(false);
const reasonInput = ref('');
let reasonResolver: ((value: string) => void) | null = null;

function promptReason(callback: (value: string) => void) {
  reasonInput.value = '';
  reasonModal.value = true;
  reasonResolver = (v: string) => callback(v);
}

function submitReason() {
  if (!reasonInput.value.trim()) {
    message.warning('请填写拒绝原因');
    return;
  }
  reasonModal.value = false;
  reasonResolver?.(reasonInput.value.trim());
}

async function updateStatus(id: string, status: AppointmentStatus, reason?: string) {
  try {
    await api.updateAppointment(id, {
      status,
      adminRemark: status === 'CANCELLED' ? reason : undefined,
    });
    message.success(`已${appointmentActionText(status)}`);
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败');
  }
}

function openMemberDetail(userId: string) {
  detailMemberId.value = userId;
}

function openReview(item: Appointment) {
  reviewItem.value = item;
  reviewForm.value = {
    appointmentDate: parseDate(item.appointmentDate),
    startTime: timeToTimestamp(item.startTime),
  };
}

async function acceptAppointment() {
  if (!reviewItem.value || reviewSubmitting.value) return;
  reviewSubmitting.value = true;
  try {
    await api.updateAppointment(reviewItem.value.id, {
      appointmentDate: dateString(reviewForm.value.appointmentDate),
      startTime: timeString(reviewForm.value.startTime),
      endTime: timeString(reviewForm.value.startTime),
      status: 'CONFIRMED',
    });
    message.success('预约已接受，预约时间已保存');
    reviewItem.value = null;
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败');
  } finally {
    reviewSubmitting.value = false;
  }
}

function rejectReviewedAppointment() {
  const appointmentId = reviewItem.value?.id;
  if (!appointmentId) return;
  promptReason((value) => {
    reviewItem.value = null;
    void updateStatus(appointmentId, 'CANCELLED', value);
  });
}

function birthdayText(value?: string): string {
  if (!value) return '未填写';
  const match = /(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(value);
  return match ? `${Number(match[1])}月${Number(match[2])}日` : value;
}

function appointmentProductImage(item: Appointment): string {
  const image = item.productImages?.[0];
  return image ? toAbsoluteImageUrl(image) : '';
}

function confirmDeleteAppointment(item: Appointment) {
  dialog.warning({
    title: '删除预约排期',
    content: `确定删除 ${item.appointmentDate} ${item.startTime} 的${businessText[item.businessType]}预约吗？删除后不可恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.deleteAppointment(item.id);
        message.success('预约排期已删除');
        await loadAll();
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除失败');
      }
    },
  });
}

watch(
  () => form.value.businessType,
  () => {
    form.value.productId = '';
  },
);

onMounted(loadUnavailableDates);
</script>

<template>
  <NSpace vertical :size="20">
    <NCard :bordered="false" class="surface">
      <template #header>
        <div class="card-header">
          <span>预约排期表</span>
          <NSpace align="center" :size="10">
            <NTag :bordered="false" type="warning">待处理 {{ pendingCount }}</NTag>
            <NButton size="small" secondary @click="openUnavailableDateModal()">
              <template #icon>
                <NIcon><CalendarOff /></NIcon>
              </template>
              设置不可预约日
            </NButton>
            <NButton type="primary" size="small" @click="openCreate()">
              <template #icon>
                <NIcon><CalendarPlus /></NIcon>
              </template>
              新增预约
            </NButton>
          </NSpace>
        </div>
      </template>

      <NCalendar
        v-model:value="calendarTimestamp"
        #="{ year, month, date }"
        @update:value="pickDate"
      >
        <div class="day-cell" @click="pickDate(new Date(year, month - 1, date).getTime())">
          <div
            v-if="unavailableByDate[calendarDateKey(year, month, date)]"
            class="day-unavailable"
          >
            停约
          </div>
          <template
            v-if="appointmentsByDate[calendarDateKey(year, month, date)]"
          >
            <div class="day-row" v-for="item in (appointmentsByDate[calendarDateKey(year, month, date)] || []).slice(0, 2)" :key="item.id">
              <span class="day-time">{{ item.startTime }}</span>
              <span class="day-business">{{ businessText[item.businessType] }}</span>
              <span class="day-name">{{ item.memberNickname }}</span>
              <NTag size="tiny" :bordered="false" :type="appointmentStatusType(item.status)">
                {{ appointmentStatusText(item.status) }}
              </NTag>
            </div>
            <div
              class="day-more"
              v-if="(appointmentsByDate[calendarDateKey(year, month, date)] || []).length > 2"
            >
              共 {{ (appointmentsByDate[calendarDateKey(year, month, date)] || []).length }} 个预约
            </div>
          </template>
        </div>
      </NCalendar>
    </NCard>

    <NCard :bordered="false" class="surface">
      <template #header>
        <div class="card-header">
          <div>
            <span>不可预约日期</span>
            <div class="dim">停用后顾客端不可提交，已有预约不受影响</div>
          </div>
          <NButton size="small" secondary @click="openUnavailableDateModal()">
            <template #icon><NIcon><CalendarOff /></NIcon></template>
            添加日期
          </NButton>
        </div>
      </template>

      <NEmpty v-if="!unavailableLoading && unavailableDates.length === 0" description="暂无不可预约日期" />
      <div v-else class="unavailable-list">
        <div v-for="item in unavailableDates" :key="item.id" class="unavailable-row">
          <div class="unavailable-info">
            <strong>{{ item.appointmentDate }}</strong>
            <NTag size="small" :bordered="false" type="warning">
              {{ availabilityScopeText(item.businessType) }}
            </NTag>
            <span>{{ item.reason || '暂停预约' }}</span>
          </div>
          <NButton size="small" type="success" secondary @click="confirmRestoreDate(item)">
            <template #icon><NIcon><RotateCcw /></NIcon></template>
            恢复预约
          </NButton>
        </div>
      </div>
    </NCard>

    <!-- 当日详情模态 -->
    <NModal
      :show="!!selectedDate"
      preset="card"
      :title="`${selectedDate} 预约详情`"
      style="width: 720px; max-width: calc(100vw - 32px)"
      :bordered="false"
      @update:show="(v: boolean) => !v && (selectedDate = '')"
    >
      <template #header-extra>
        <NSpace :size="8">
          <NButton size="small" secondary @click="openUnavailableDateModal(selectedDate)">
            <template #icon><NIcon><CalendarOff /></NIcon></template>
            停止顾客预约
          </NButton>
          <NButton size="small" type="primary" @click="openCreate(selectedDate)">
            <template #icon>
              <NIcon><CalendarPlus /></NIcon>
            </template>
            新增当日预约
          </NButton>
        </NSpace>
      </template>

      <NAlert
        v-if="unavailableByDate[selectedDate]?.length"
        type="warning"
        :bordered="false"
        style="margin-bottom: 14px"
      >
        顾客端已暂停：{{ unavailableByDate[selectedDate].map((item) => availabilityScopeText(item.businessType)).join('、') }}
      </NAlert>

      <NEmpty v-if="!selectedDateAppointments.length" description="当日没有预约" />

      <NSpace v-else vertical :size="14">
        <NCard
          v-for="item in selectedDateAppointments"
          :key="item.id"
          size="small"
          :class="`appt-card status-${item.status.toLowerCase()}`"
          :bordered="false"
        >
          <div class="appt-head">
            <div>
              <strong class="appt-time">{{ appointmentTimeText(item) }}</strong>
              <div class="appt-member">
                {{ businessText[item.businessType] }}
                <span v-if="item.productName"> · {{ item.productName }}</span>
                <span class="dim">（{{ item.memberNickname }} / {{ item.userId }}）</span>
              </div>
            </div>
            <div class="appt-side">
              <NTag :bordered="false" :type="appointmentStatusType(item.status)">
                {{ appointmentStatusText(item.status) }}
              </NTag>
              <NImage
                v-if="appointmentProductImage(item)"
                class="appt-product-image"
                :src="appointmentProductImage(item)"
                :preview-src="appointmentProductImage(item)"
                width="72"
                height="72"
                object-fit="cover"
              />
            </div>
          </div>

          <NDescriptions :column="2" size="small" label-placement="top" style="margin-top: 8px">
            <NDescriptionsItem label="会员备注">{{ item.remark || '无' }}</NDescriptionsItem>
            <NDescriptionsItem label="业务">{{ businessText[item.businessType] }}</NDescriptionsItem>
            <NDescriptionsItem label="产品">{{ item.productName || '未关联' }}</NDescriptionsItem>
            <NDescriptionsItem v-if="item.adminRemark" label="处理备注">{{ item.adminRemark }}</NDescriptionsItem>
            <NDescriptionsItem label="提交时间">{{ item.createdAt }}</NDescriptionsItem>
            <NDescriptionsItem label="更新时间">{{ item.updatedAt }}</NDescriptionsItem>
          </NDescriptions>

          <NSpace :size="8" style="margin-top: 12px">
            <NButton size="small" secondary @click="openMemberDetail(item.userId)">
              <template #icon>
                <NIcon><UserRound /></NIcon>
              </template>
              查看用户
            </NButton>
            <NButton size="small" secondary @click="openEdit(item)">
              <template #icon>
                <NIcon><Pencil /></NIcon>
              </template>
              修改
            </NButton>
            <NButton
              v-if="item.status === 'PENDING'"
              size="small"
              type="primary"
              @click="openReview(item)"
            >
              <template #icon>
                <NIcon><CheckCircle2 /></NIcon>
              </template>
              接受
            </NButton>
            <NButton
              v-if="item.status === 'PENDING'"
              size="small"
              type="error"
              secondary
              @click="promptReason((v) => updateStatus(item.id, 'CANCELLED', v))"
            >
              <template #icon>
                <NIcon><XCircle /></NIcon>
              </template>
              拒绝
            </NButton>
            <NButton
              v-if="item.status === 'CONFIRMED'"
              size="small"
              type="primary"
              secondary
              @click="updateStatus(item.id, 'COMPLETED')"
            >
              标记完成
            </NButton>
            <NButton size="small" type="error" secondary @click="confirmDeleteAppointment(item)">
              <template #icon>
                <NIcon><Trash2 /></NIcon>
              </template>
              删除
            </NButton>
          </NSpace>
        </NCard>
      </NSpace>
    </NModal>

    <!-- 审核预约 -->
    <NModal
      :show="!!reviewItem"
      preset="card"
      title="审核预约"
      style="width: 620px; max-width: calc(100vw - 32px)"
      :bordered="false"
      @update:show="(value: boolean) => !value && (reviewItem = null)"
    >
      <template v-if="reviewItem">
        <div class="member-summary">
          <NAvatar
            round
            :size="48"
            :src="reviewMember?.avatarUrl ? toAbsoluteImageUrl(reviewMember.avatarUrl) : ''"
          >
            {{ (reviewMember?.nickname || reviewItem.memberNickname).slice(0, 1) }}
          </NAvatar>
          <div>
            <strong>{{ reviewMember?.nickname || reviewItem.memberNickname }}</strong>
            <div class="dim">{{ reviewItem.userId }}</div>
          </div>
          <NButton text type="primary" @click="openMemberDetail(reviewItem.userId)">
            查看完整资料
          </NButton>
        </div>

        <NDescriptions :column="2" size="small" label-placement="top" class="review-details">
          <NDescriptionsItem label="手机号">{{ reviewMember?.phone || '未填写' }}</NDescriptionsItem>
          <NDescriptionsItem label="生日">{{ birthdayText(reviewMember?.birthday) }}</NDescriptionsItem>
          <NDescriptionsItem label="会员等级">{{ reviewMember?.levelName || '未设置' }}</NDescriptionsItem>
          <NDescriptionsItem label="业务 / 产品">
            {{ businessText[reviewItem.businessType] }} / {{ reviewItem.productName || '未关联产品' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="用户备注">{{ reviewItem.remark || '无' }}</NDescriptionsItem>
        </NDescriptions>

        <div class="form-grid">
          <div>
            <label>确认预约日期</label>
            <NDatePicker v-model:value="reviewForm.appointmentDate" type="date" style="width: 100%" />
          </div>
          <div>
            <label>确认预约时间</label>
            <NTimePicker v-model:value="reviewForm.startTime" format="HH:mm" style="width: 100%" />
          </div>
        </div>
      </template>

      <template #footer>
        <NSpace justify="space-between">
          <NButton
            v-if="reviewItem"
            type="error"
            secondary
            @click="rejectReviewedAppointment"
          >
            拒绝预约
          </NButton>
          <NSpace>
            <NButton @click="reviewItem = null">取消</NButton>
            <NButton type="primary" :loading="reviewSubmitting" @click="acceptAppointment">
              <template #icon>
                <NIcon><Clock3 /></NIcon>
              </template>
              接受并保存时间
            </NButton>
          </NSpace>
        </NSpace>
      </template>
    </NModal>

    <!-- 预约用户资料 -->
    <NModal
      :show="!!detailMemberId"
      preset="card"
      title="预约用户资料"
      style="width: 560px; max-width: calc(100vw - 32px)"
      :bordered="false"
      @update:show="(value: boolean) => !value && (detailMemberId = '')"
    >
      <template v-if="detailMember">
        <div class="member-summary">
          <NAvatar round :size="56" :src="toAbsoluteImageUrl(detailMember.avatarUrl)">
            {{ detailMember.nickname.slice(0, 1) }}
          </NAvatar>
          <div>
            <strong>{{ detailMember.nickname }}</strong>
            <div class="dim">{{ detailMember.id }}</div>
          </div>
        </div>
        <NDescriptions :column="2" size="small" label-placement="top" class="review-details">
          <NDescriptionsItem label="手机号">{{ detailMember.phone || '未填写' }}</NDescriptionsItem>
          <NDescriptionsItem label="生日">{{ birthdayText(detailMember.birthday) }}</NDescriptionsItem>
          <NDescriptionsItem label="会员等级">{{ detailMember.levelName }}</NDescriptionsItem>
          <NDescriptionsItem label="折扣">{{ Math.round(detailMember.discountRate * 100) / 10 }} 折</NDescriptionsItem>
          <NDescriptionsItem label="账户余额">¥{{ detailMember.balance.toFixed(2) }}</NDescriptionsItem>
          <NDescriptionsItem label="积分">{{ detailMember.points }}</NDescriptionsItem>
          <NDescriptionsItem label="门店备注">{{ detailMember.remark || '无' }}</NDescriptionsItem>
        </NDescriptions>
      </template>
      <NEmpty v-else description="未找到该会员资料" />
    </NModal>

    <!-- 新建/编辑预约 -->
    <NModal
      v-model:show="showModal"
      preset="card"
      :title="editingId ? '修改预约' : '新增预约'"
      style="width: 620px; max-width: calc(100vw - 32px)"
      :bordered="false"
    >
      <NSpace vertical :size="14">
        <div class="form-row">
          <label>检索会员</label>
          <NInput v-model:value="memberKeyword" placeholder="按昵称 / 会员号 / 手机号 / 备注过滤" clearable />
        </div>
        <div class="form-row">
          <label>选择会员</label>
          <NSelect v-model:value="form.userId" :options="memberOptions" filterable />
        </div>
        <div class="form-grid">
          <div>
            <label>业务类型</label>
            <NSelect v-model:value="form.businessType" :options="businessOptions" />
          </div>
          <div>
            <label>关联产品</label>
            <NSelect v-model:value="form.productId" :options="productOptions" filterable />
          </div>
        </div>
        <div class="form-grid">
          <div>
            <label>预约日期</label>
            <NDatePicker v-model:value="form.appointmentDate" type="date" style="width: 100%" />
          </div>
          <div>
            <label>预约时间</label>
            <NTimePicker v-model:value="form.startTime" format="HH:mm" style="width: 100%" />
          </div>
        </div>
        <div class="form-row">
          <label>状态</label>
          <NSelect
            v-model:value="form.status"
            :options="[
              { label: '待处理', value: 'PENDING' },
              { label: '已接受', value: 'CONFIRMED' },
              { label: '已拒绝', value: 'CANCELLED' },
              { label: '已结束', value: 'COMPLETED' },
            ]"
          />
        </div>
        <div class="form-row">
          <label>用户端备注</label>
          <NInput v-model:value="form.remark" placeholder="会同步给会员看到" />
        </div>
        <div class="form-row">
          <label>处理说明 / 拒绝原因</label>
          <NInput v-model:value="form.adminRemark" type="textarea" :rows="2" placeholder="拒绝预约时必填" />
        </div>
      </NSpace>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="showModal = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitForm">确认提交</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      v-model:show="showUnavailableModal"
      preset="card"
      title="设置不可预约日期"
      style="width: 520px; max-width: calc(100vw - 32px)"
      :bordered="false"
    >
      <NSpace vertical :size="14">
        <NAlert type="info" :bordered="false">
          仅阻止顾客提交新预约，后台仍可补录，当天已有预约不会删除。
        </NAlert>
        <div class="form-row">
          <label>不可预约日期</label>
          <NDatePicker
            v-model:value="unavailableForm.appointmentDate"
            type="date"
            :clearable="false"
            :is-date-disabled="isPastDate"
            style="width: 100%"
          />
        </div>
        <div class="form-row">
          <label>影响范围</label>
          <NSelect v-model:value="unavailableForm.businessType" :options="availabilityScopeOptions" />
        </div>
        <div class="form-row">
          <label>门店备注</label>
          <NInput
            v-model:value="unavailableForm.reason"
            :maxlength="120"
            show-count
            placeholder="例如：当日预约已满、店休"
          />
        </div>
      </NSpace>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showUnavailableModal = false">取消</NButton>
          <NButton type="primary" :loading="unavailableSubmitting" @click="submitUnavailableDate">
            确认停止预约
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="reasonModal" preset="card" title="拒绝原因" style="width: 460px" :bordered="false">
      <NInput v-model:value="reasonInput" type="textarea" :rows="3" placeholder="请输入拒绝原因（会同步给会员）" />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="reasonModal = false">取消</NButton>
          <NButton type="error" @click="submitReason">确认拒绝</NButton>
        </NSpace>
      </template>
    </NModal>
  </NSpace>
</template>

<style scoped>
.surface {
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 8px -2px rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.day-cell {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 56px;
}

.day-unavailable {
  align-self: flex-start;
  padding: 1px 6px;
  border-radius: 4px;
  color: #9b3e3b;
  background: #f9e6e4;
  font-size: 10px;
  font-weight: 600;
}

.day-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
  background: rgba(216, 81, 79, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
}

.day-time {
  font-weight: 600;
  color: var(--color-brand);
}

.day-business {
  color: var(--color-text-muted);
}

.day-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-more {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.unavailable-list {
  display: flex;
  flex-direction: column;
  max-height: 320px;
  overflow-y: auto;
}

.unavailable-row {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 2px;
  border-bottom: 1px solid var(--color-border);
}

.unavailable-row:last-child {
  border-bottom: 0;
}

.unavailable-info {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.unavailable-info span {
  color: var(--color-text-muted);
  font-size: 13px;
}

.appt-card {
  border-left: 4px solid var(--color-border);
  background: #fff;
  transition: border-color 0.2s;
}

.appt-card.status-pending { border-left-color: #e2934a; }
.appt-card.status-confirmed { border-left-color: #3fa66e; }
.appt-card.status-cancelled { border-left-color: #d45852; }
.appt-card.status-completed { border-left-color: #999; }

.appt-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.appt-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex: 0 0 auto;
}

.appt-product-image {
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 8px 18px rgba(17, 24, 39, 0.08);
}

.appt-time {
  font-size: 16px;
  color: var(--color-text);
}

.appt-member {
  margin-top: 2px;
  font-size: 13px;
  color: var(--color-text);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

label {
  font-size: 13px;
  color: var(--color-text-muted);
}

.dim {
  color: var(--color-text-muted);
  font-size: 12px;
}

.member-summary {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-summary > div:nth-child(2) {
  flex: 1;
  min-width: 0;
}

.review-details {
  margin: 18px 0;
  padding: 14px;
  background: #f7f8fa;
  border-radius: 8px;
}

@media (max-width: 640px) {
  .unavailable-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
