<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <BookingReceipt v-if="submittedAppointment" :appointment="submittedAppointment" />
    <view v-if="pageError" class="card">
      <text class="remark">{{ pageError }}</text>
      <button class="booking-button" @click="refreshPage">重新加载</button>
    </view>
    <view class="card calendar-card">
      <view class="section-head">
        <view>
          <text class="eyebrow">预约日历</text>
          <text class="title">{{ calendarTitle }}</text>
        </view>
        <view class="month-actions">
          <button class="month-btn" @click="changeMonth(-1)">‹</button>
          <button class="month-btn" @click="changeMonth(1)">›</button>
        </view>
      </view>

      <view class="week-grid">
        <text v-for="week in weekLabels" :key="week" class="week-label">{{ week }}</text>
      </view>

      <view class="day-grid">
        <view
          v-for="day in calendarDays"
          :key="day.key"
          class="day-cell"
          :class="{ muted: !day.inMonth, selected: day.date === form.appointmentDate, today: day.date === today, disabled: day.disabled, unavailable: day.unavailable }"
          @click="selectDate(day.date)"
        >
          <text class="day-number">{{ day.day }}</text>
          <text v-if="day.unavailable" class="day-closed">已满</text>
          <text v-else-if="appointmentCountByDate[day.date]" class="day-dot">{{ appointmentCountByDate[day.date] }}</text>
        </view>
      </view>

      <view class="booking-inline">
        <view>
          <text class="inline-label">已选日期</text>
          <text class="inline-date">{{ form.appointmentDate }}</text>
        </view>
        <button class="booking-button" @click="openBookingPanel">预约到店</button>
      </view>
    </view>

    <view v-if="activeAppointments.length > 0" class="card active-card">
      <view class="section-head">
        <view>
          <text class="eyebrow">我的预约</text>
          <text class="title">当前到店安排</text>
        </view>
        <text class="pill">{{ activeAppointments.length }} 个</text>
      </view>

      <view v-for="item in activeAppointments" :key="item.id" class="active-item">
        <view class="appointment-row">
          <view class="appointment-info">
            <text class="business">{{ appointmentBusinessText(item) }}</text>
            <text class="date">{{ item.appointmentDate }}</text>
            <text class="time">{{ appointmentTimeText(item) }}</text>
            <text class="status" :class="item.status.toLowerCase()">{{ statusText(item.status) }}</text>
            <text v-if="item.productName" class="remark">产品：{{ item.productName }}</text>
            <text v-if="item.remark" class="remark">备注：{{ item.remark }}</text>
            <text v-if="item.adminRemark" class="remark">处理说明：{{ item.adminRemark }}</text>
          </view>
          <image
            v-if="appointmentImageSrc(item)"
            class="appointment-thumb"
            :src="appointmentImageSrc(item)"
            mode="aspectFill"
            @click.stop="previewAppointmentProduct(item)"
          />
        </view>
      </view>
    </view>

    <StoreContact />

    <view class="card record-summary-card" @click="openRecordsPanel">
      <view class="section-head compact">
        <view>
          <text class="eyebrow">全部预约记录</text>
          <text class="title">查看历史预约</text>
        </view>
        <text class="pill">{{ appointments.length }} 条</text>
      </view>
      <text class="record-summary-text">{{ appointments.length === 0 ? '暂无预约记录' : '点击查看全部预约记录列表' }}</text>
    </view>

    <view v-if="showBookingPanel" class="panel-mask booking-mask" @click="closeBookingPanel">
      <view class="booking-panel detail-theme" @click.stop>
        <view class="section-head panel-head">
          <view>
            <text class="eyebrow">新预约</text>
            <text class="title">{{ form.appointmentDate }}</text>
          </view>
          <button class="close-btn" @click="closeBookingPanel">×</button>
        </view>

        <view v-if="selectedProduct" class="selected-summary">
          <text class="label">已选款式</text>
          <text class="summary-text">{{ selectedProduct.name }}</text>
          <button class="clear-style" @click="selectedProduct = undefined">不选款式，直接预约</button>
        </view>
        <text class="remark">提交的是预约申请，请等待门店确认后再到店。</text>

        <BookingTimePicker v-model="selectedTime" :date="form.appointmentDate" :booked-slots="bookedSlots" :loading="slotsLoading" :ready="slotsReady" :error-message="slotsError" :unavailable="isSelectedDateUnavailable" @retry="retryBookedSlots" />

        <view class="selected-summary" :class="{ disabled: isSelectedTimeBooked || isSelectedDateUnavailable }">
          <text class="label">到店时间</text>
          <text class="summary-text">{{ selectedSlotSummary }}</text>
          <text v-if="isSelectedDateUnavailable" class="summary-warning">当日预约已满，请选择其他日期</text>
          <text v-else-if="isSelectedTimeBooked" class="summary-warning">该时间已有确认预约，请换一个时间</text>
          <text v-else-if="isSelectedTimePast" class="summary-warning">不可选择已过去的到店时间</text>
        </view>

        <view class="field">
          <text class="label">备注</text>
          <input v-model="form.remark" class="input" placeholder="可填写到店需求" />
        </view>

        <button class="submit" :disabled="submitting || !slotsReady || slotsLoading || isSelectedDateUnavailable || isSelectedTimeBooked || isSelectedTimePast" @click="confirmSubmitAppointment">
          {{ submitting ? '提交中...' : '提交预约申请' }}
        </button>
      </view>
    </view>

    <view v-if="showRecordsPanel" class="panel-mask" @click="closeRecordsPanel">
      <view class="records-panel" @click.stop>
        <view class="section-head panel-head">
          <view>
            <text class="eyebrow">全部预约记录</text>
            <text class="title">{{ appointments.length }} 条记录</text>
          </view>
          <button class="close-btn" @click="closeRecordsPanel">×</button>
        </view>

        <view v-if="appointments.length === 0" class="empty records-empty">暂无预约</view>
        <scroll-view v-else class="records-list" scroll-y>
          <view v-for="item in appointments" :key="item.id" class="appointment-item">
            <view class="appointment-row">
              <view class="appointment-info">
                <text class="business">{{ appointmentBusinessText(item) }}</text>
                <text class="date">{{ item.appointmentDate }}</text>
                <text class="time">{{ appointmentTimeText(item) }}</text>
                <text class="status" :class="item.status.toLowerCase()">{{ statusText(item.status) }}</text>
                <text v-if="item.productName" class="remark">产品：{{ item.productName }}</text>
                <text v-if="item.remark" class="remark">备注：{{ item.remark }}</text>
                <text v-if="item.adminRemark" class="remark">处理说明：{{ item.adminRemark }}</text>
              </view>
              <image
                v-if="appointmentImageSrc(item)"
                class="appointment-thumb"
                :src="appointmentImageSrc(item)"
                mode="aspectFill"
                @click.stop="previewAppointmentProduct(item)"
              />
            </view>
            <button v-if="item.status === 'COMPLETED'" class="repeat-button" :disabled="repeating" @click="repeatBooking(item)">再次预约</button>
          </view>
        </scroll-view>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import BookingReceipt from '@/components/BookingReceipt.vue';
import BookingTimePicker from '@/components/BookingTimePicker.vue';
import StoreContact from '@/components/StoreContact.vue';
import { useRepeatBooking } from '@/utils/repeat-booking';
import { createImagePreviewReturnGuard } from '@/utils/image-preview-return';
import { appointmentTimeConflicts, appointmentTimePast, nextFutureAppointmentTime, storeDateKey } from '@/utils/appointment-availability';
import { useBookedSlots } from '@/utils/use-booked-slots';
import { rememberBooking, takePendingBooking } from '@/utils/booking-flow';
import type { BookingIntent } from '@/utils/booking-flow';
import type {
  Appointment,
  AppointmentStatus,
  AppointmentUnavailableDate,
} from '@member-platform/shared';
import {
  createAppointment,
  listAppointmentUnavailableDates,
  listMyAppointments,
  toAbsoluteImageUrl,
} from '@/utils/api';
import { sessionState } from '@/store/session';
import { ensureReadyMemberAccess, loadSessionProfile } from '@/utils/member';

type CalendarDay = {
  key: string;
  date: string;
  day: number;
  inMonth: boolean;
  disabled: boolean;
  unavailable: boolean;
};

const weekLabels = ['日', '一', '二', '三', '四', '五', '六'];
const today = ref(storeDateKey());
const currentMonth = ref(today.value.slice(0, 7));
const submitting = ref(false);
const selectedProduct = ref<BookingIntent['product']>();
const submittedAppointment = ref<Appointment | null>(null);
const pageError = ref('');
const showBookingPanel = ref(false);
const showRecordsPanel = ref(false);
const appointments = ref<Appointment[]>([]);
const { repeating, repeatBooking } = useRepeatBooking();
const imagePreview = createImagePreviewReturnGuard();
watch(() => [sessionState.userId, sessionState.token], () => {
  submittedAppointment.value = null;
  appointments.value = [];
}, { flush: 'sync' });
const unavailableDates = ref<AppointmentUnavailableDate[]>([]);
const selectedTime = ref('10:00');
const nowTick = ref(Date.now());
const form = ref({
  appointmentDate: today.value,
  remark: '',
});

const { slots: bookedSlots, loading: slotsLoading, ready: slotsReady, errorMessage: slotsError, refresh: refreshBookedSlots } = useBookedSlots('NAIL', () => form.value.appointmentDate);

const calendarTitle = computed(() => {
  const [year, month] = currentMonth.value.split('-');
  return `${year}年${Number(month)}月`;
});

const activeAppointments = computed(() =>
  appointments.value.filter((item) => item.status === 'PENDING' || item.status === 'CONFIRMED'),
);

const appointmentCountByDate = computed(() =>
  appointments.value.reduce<Record<string, number>>((counts, item) => {
    counts[item.appointmentDate] = (counts[item.appointmentDate] || 0) + 1;
    return counts;
  }, {}),
);

const unavailableDateSet = computed(() =>
  new Set(unavailableDates.value.map((item) => item.appointmentDate)),
);

const calendarDays = computed<CalendarDay[]>(() => {
  const [year, month] = currentMonth.value.split('-').map((value) => Number(value));
  const firstDay = new Date(year, month - 1, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const value = formatDate(date);
    const unavailable = unavailableDateSet.value.has(value);
    return {
      key: `${value}-${index}`,
      date: value,
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
      disabled: value < today.value || unavailable,
      unavailable,
    };
  });
});

const selectedArrivalTime = computed(() => selectedTime.value);
const isSelectedTimeBooked = computed(() => appointmentTimeConflicts(selectedTime.value, bookedSlots.value));
const isSelectedDatePast = computed(() => form.value.appointmentDate < today.value);
const isSelectedDateUnavailable = computed(() => unavailableDateSet.value.has(form.value.appointmentDate));
const isSelectedTimePast = computed(() => {
  nowTick.value;
  return appointmentTimePast(form.value.appointmentDate, selectedTime.value, new Date(nowTick.value));
});

const selectedSlotSummary = computed(() => selectedArrivalTime.value);

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextAvailableDate(startDate = today.value): string {
  const date = new Date(`${startDate}T00:00:00`);
  for (let offset = 0; offset < 366; offset += 1) {
    const value = formatDate(date);
    if (value >= today.value && !unavailableDateSet.value.has(value)) return value;
    date.setDate(date.getDate() + 1);
  }
  return startDate;
}

function changeMonth(offset: number) {
  const [year, month] = currentMonth.value.split('-').map((value) => Number(value));
  const next = new Date(year, month - 1 + offset, 1);
  const nextMonth = formatDate(next).slice(0, 7);
  if (nextMonth < today.value.slice(0, 7)) {
    uni.showToast({ title: '不可选择过去月份', icon: 'none' });
    return;
  }
  currentMonth.value = nextMonth;
}

async function selectDate(date: string) {
  if (submitting.value) return;
  if (date < today.value) {
    uni.showToast({ title: '不可选择过去日期', icon: 'none' });
    return;
  }
  if (unavailableDateSet.value.has(date)) {
    uni.showToast({ title: '当日预约已满', icon: 'none' });
    return;
  }
  form.value.appointmentDate = date;
  currentMonth.value = date.slice(0, 7);
  ensureFutureTimeSelection();
  try { await loadBookedSlots(); } catch { pageError.value = '预约时间加载失败，请重试。'; }
}

function appointmentTimeText(item: Appointment): string {
  return item.endTime && item.endTime !== item.startTime ? `${item.startTime}-${item.endTime}` : item.startTime;
}

function appointmentBusinessText(item: Appointment): string {
  const map: Record<Appointment['businessType'], string> = {
    NAIL: '美甲预约',
    ACCESSORY: '饰品预约',
    FLOWER: '鲜花预约',
  };
  return map[item.businessType] || '预约';
}

function appointmentImageSrc(item: Appointment): string {
  const image = item.productImages?.[0];
  return image ? toAbsoluteImageUrl(image) : '';
}

function previewAppointmentProduct(item: Appointment) {
  const urls = (item.productImages || []).map((image) => toAbsoluteImageUrl(image));
  if (urls.length === 0) return;
  imagePreview.start();
  uni.previewImage({
    current: urls[0],
    urls,
    fail: () => { imagePreview.cancel(); uni.showToast({ title: '图片预览失败，请重试', icon: 'none' }); },
  });
}

function statusText(status: AppointmentStatus): string {
  const map: Record<AppointmentStatus, string> = {
    PENDING: '待门店确认',
    CONFIRMED: '预约已确认',
    CANCELLED: '预约未能安排',
    COMPLETED: '服务已完成',
  };
  return map[status] || status;
}

async function loadAppointments() {
  if (!sessionState.userId) return;
  const userId = sessionState.userId;
  const token = sessionState.token;
  const records = await listMyAppointments();
  if (sessionState.userId === userId && sessionState.token === token) appointments.value = records;
}

async function loadBookedSlots() {
  if (!sessionState.userId) return;
  if (!(await refreshBookedSlots())) throw new Error(slotsError.value || '预约时间加载失败');
}

function retryBookedSlots() { void refreshBookedSlots(); }

async function loadUnavailableDates() {
  unavailableDates.value = await listAppointmentUnavailableDates('NAIL', today.value);
}

async function openBookingPanel() {
  if (!(await ensureReadyMemberAccess(rememberCurrentBooking))) return;
  try {
    await loadUnavailableDates();
    if (form.value.appointmentDate < today.value) {
      form.value.appointmentDate = today.value;
      currentMonth.value = today.value.slice(0, 7);
    }
    if (isSelectedDateUnavailable.value) {
      form.value.appointmentDate = nextAvailableDate(form.value.appointmentDate);
      currentMonth.value = form.value.appointmentDate.slice(0, 7);
    }
    ensureFutureTimeSelection();
    await loadBookedSlots();
    showBookingPanel.value = true;
  } catch {
    pageError.value = '预约时间加载失败，请重新加载后选择时间。';
  }
}

function closeBookingPanel() {
  if (submitting.value) return;
  showBookingPanel.value = false;
}

function openRecordsPanel() {
  showRecordsPanel.value = true;
}

function closeRecordsPanel() {
  showRecordsPanel.value = false;
}

async function confirmSubmitAppointment() {
  if (submitting.value) return;
  if (!(await ensureReadyMemberAccess(rememberCurrentBooking))) return;
  if (!slotsReady.value || slotsLoading.value) {
    uni.showToast({ title: '请先加载预约时段', icon: 'none' });
    return;
  }
  if (isSelectedDateUnavailable.value) {
    uni.showToast({ title: '当日预约已满，请选择其他日期', icon: 'none' });
    return;
  }
  if (isSelectedTimeBooked.value) {
    uni.showToast({ title: '该时间已有确认预约', icon: 'none' });
    return;
  }
  if (isSelectedDatePast.value || isSelectedTimePast.value) {
    uni.showToast({ title: '不可选择过往时间', icon: 'none' });
    ensureFutureTimeSelection();
    return;
  }

  uni.showModal({
    title: '确认预约',
    content: `${selectedProduct.value ? `${selectedProduct.value.name}\n` : ''}${form.value.appointmentDate} ${selectedSlotSummary.value}\n提交预约申请后，需等待门店确认。`,
    confirmText: '确认提交',
    success: (result) => {
      if (result.confirm) {
        void submitAppointment();
      }
    },
  });
}

async function submitAppointment() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await loadUnavailableDates();
    if (isSelectedDateUnavailable.value) {
      uni.showToast({ title: '当日预约已满，请选择其他日期', icon: 'none' });
      return;
    }
    await loadBookedSlots();
    if (isSelectedTimeBooked.value) {
      uni.showToast({ title: '该时间已有确认预约', icon: 'none' });
      return;
    }
    if (isSelectedDatePast.value || isSelectedTimePast.value) {
      uni.showToast({ title: '不可选择过往时间', icon: 'none' });
      ensureFutureTimeSelection();
      return;
    }

    const userId = sessionState.userId;
    const token = sessionState.token;
    const created = await createAppointment({
      businessType: 'NAIL',
      productId: selectedProduct.value?.id,
      appointmentDate: form.value.appointmentDate,
      startTime: selectedArrivalTime.value,
      remark: form.value.remark || undefined,
    });
    if (sessionState.userId !== userId || sessionState.token !== token) return;
    submittedAppointment.value = created;
    form.value.remark = '';
    showBookingPanel.value = false;
    uni.showToast({ title: '已提交，待门店确认', icon: 'none' });
    try {
      await Promise.all([loadAppointments(), loadBookedSlots()]);
    } catch {
      pageError.value = '预约申请已提交，但记录刷新失败，请重新加载查看。';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '预约失败';
    uni.showToast({ title: message.slice(0, 18), icon: 'none' });
  } finally {
    submitting.value = false;
  }
}

function rememberCurrentBooking() {
  rememberBooking({
    businessType: 'NAIL', product: selectedProduct.value,
    date: form.value.appointmentDate, time: selectedArrivalTime.value, remark: form.value.remark,
  });
}

onLoad((query) => { showRecordsPanel.value = query?.records === '1'; });

async function refreshPage() {
  nowTick.value = Date.now();
  today.value = storeDateKey();
  pageError.value = '';
  try {
    await loadSessionProfile();
    const intent = takePendingBooking('NAIL');
    if (intent) {
      selectedProduct.value = intent.product;
      form.value.appointmentDate = intent.date || today.value;
      form.value.remark = intent.remark || '';
      currentMonth.value = form.value.appointmentDate.slice(0, 7);
      if (intent.time) selectedTime.value = intent.time;
    }
    await Promise.all([loadAppointments(), loadUnavailableDates()]);
    if (isSelectedDateUnavailable.value) {
      form.value.appointmentDate = nextAvailableDate(form.value.appointmentDate);
      currentMonth.value = form.value.appointmentDate.slice(0, 7);
    }
    await loadBookedSlots();
    if (intent) await openBookingPanel();
  } catch {
    pageError.value = '预约记录或时间加载失败，请重新加载。';
  }
}

onShow(() => { if (!imagePreview.consumeReturn()) return refreshPage(); });

function ensureFutureTimeSelection() {
  nowTick.value = Date.now();
  today.value = storeDateKey();
  if (!isSelectedDatePast.value && !isSelectedTimePast.value) return;
  const next = nextFutureAppointmentTime(new Date(nowTick.value), [...unavailableDateSet.value], form.value.appointmentDate);
  if (!next) return;
  form.value.appointmentDate = next.date;
  currentMonth.value = next.date.slice(0, 7);
  selectedTime.value = next.time;
}
</script>

<style>
@import '@/styles/product-detail.css';
</style>
<style scoped>
.repeat-button { margin: 20rpx 0 0; border-radius: 999rpx; background: #edf2f4; color: #3d4652; font-size: 25rpx; }
.repeat-button::after { border: 0; }
.page {
  position: relative;
  min-height: 100vh;
  padding: 28rpx 24rpx;
  background: #f6f3ea;
}

.page-bg {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

.card {
  position: relative;
  z-index: 1;
  margin-bottom: 24rpx;
  padding: 30rpx;
  border-radius: 30rpx;
  background: #fff;
  box-shadow: 0 12rpx 38rpx rgba(31, 41, 55, 0.06);
}

.calendar-card {
  margin-top: 0;
}

.active-card {
  border: 2rpx solid rgba(111, 127, 138, 0.16);
  background: linear-gradient(180deg, #fff, #f8fbfc);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22rpx;
}

.section-head.compact {
  margin-bottom: 12rpx;
}

.eyebrow {
  display: block;
  margin-bottom: 8rpx;
  color: #6f7f8a;
  font-size: 22rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
}

.title {
  display: block;
  color: #111827;
  font-size: 36rpx;
  font-weight: 900;
}

.pill,

.month-actions {
  display: flex;
  gap: 12rpx;
}

.month-btn,
.close-btn {
  width: 72rpx;
  height: 72rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  background: #f8fafc;
  color: #3d4652;
  font-size: 44rpx;
  line-height: 72rpx;
}

.close-btn {
  color: #667085;
}

.week-grid,
.day-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.week-label {
  padding-bottom: 14rpx;
  text-align: center;
  color: #98a2b3;
  font-size: 24rpx;
}

.day-cell {
  position: relative;
  height: 78rpx;
  margin: 4rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  color: #111827;
}

.day-cell.muted {
  color: #cbd5e1;
  background: #fbfbfb;
}

.day-cell.disabled {
  color: #d0d5dd;
  background: #f2f4f7;
  opacity: 0.55;
}

.day-cell.unavailable {
  color: #9b5a57;
  background: #f4e9e7;
  opacity: 1;
}

.day-cell.today {
  border: 1px solid #b8c4cc;
}

.day-cell.selected {
  background: #3d4652;
  color: #f7f4ea;
  font-weight: 900;
}

.day-number {
  font-size: 28rpx;
}

.day-dot {
  position: absolute;
  right: 8rpx;
  top: 6rpx;
  min-width: 28rpx;
  height: 28rpx;
  border-radius: 999rpx;
  background: #f59e0b;
  color: #fff;
  font-size: 18rpx;
  line-height: 28rpx;
  text-align: center;
}

.day-closed {
  position: absolute;
  right: 4rpx;
  bottom: 4rpx;
  color: #a64b47;
  font-size: 16rpx;
  font-weight: 800;
}

.booking-inline {
  margin-top: 26rpx;
  border-radius: 26rpx;
  padding: 22rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18rpx;
  background: #f8fafc;
}

.inline-label,
.inline-date {
  display: block;
}

.inline-label {
  color: #6f7f8a;
  font-size: 22rpx;
  font-weight: 800;
}

.inline-date {
  margin-top: 8rpx;
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.active-item,
.appointment-item {
  padding: 22rpx 0;
  border-bottom: 1px solid #edf0f3;
}

.active-item:last-child,
.appointment-item:last-child {
  border-bottom: 0;
}

.date,
.time,
.status,
.business,
.remark {
  display: block;
}

.appointment-row {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.appointment-info {
  flex: 1;
  min-width: 0;
}

.appointment-thumb {
  width: 138rpx;
  height: 138rpx;
  flex: 0 0 138rpx;
  border-radius: 22rpx;
  background: #edf2f4;
  box-shadow: 0 12rpx 28rpx rgba(17, 24, 39, 0.08);
}

.business {
  margin-bottom: 6rpx;
  color: #6f7f8a;
  font-size: 24rpx;
  font-weight: 900;
}

.date {
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.time,
.remark {
  margin-top: 6rpx;
  color: #667085;
  font-size: 26rpx;
}

.status {
  margin-top: 10rpx;
  color: #6f7f8a;
  font-size: 26rpx;
  font-weight: 800;
}

.status.confirmed {
  color: #079455;
}

.status.cancelled {
  color: #98a2b3;
}

.status.completed {
  color: #175cd3;
}

.empty {
  margin-top: 18rpx;
  color: #98a2b3;
  font-size: 28rpx;
}

.record-summary-card {
  cursor: pointer;
}

.record-summary-text {
  display: block;
  color: #667085;
  font-size: 26rpx;
  line-height: 1.6;
}

.booking-button,
.submit {
  margin: 0;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #56616f, #3d4652);
  color: #f7f4ea;
  font-weight: 900;
  box-shadow: 0 18rpx 36rpx rgba(18, 24, 38, 0.18);
}

.booking-button {
  min-width: 210rpx;
  height: 82rpx;
  line-height: 82rpx;
  font-size: 28rpx;
}

.submit {
  margin-top: 18rpx;
}

.submit[disabled] {
  opacity: 0.45;
}

.panel-mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 34rpx 24rpx;
  background: rgba(17, 24, 39, 0.42);
  box-sizing: border-box;
}

.booking-panel,
.records-panel {
  width: 100%;
  max-width: 690rpx;
  max-height: 86vh;
  overflow-y: auto;
  padding: 30rpx 26rpx calc(30rpx + env(safe-area-inset-bottom));
  border-radius: 34rpx;
  background: #fff;
  box-shadow: 0 30rpx 80rpx rgba(17, 24, 39, 0.22);
  box-sizing: border-box;
}

.records-panel {
  max-height: 78vh;
}

.panel-head {
  margin-bottom: 18rpx;
}

.records-list {
  max-height: 58vh;
}

.records-empty {
  padding: 40rpx 0 20rpx;
  text-align: center;
}

.selected-summary {
  margin-top: 20rpx;
  margin-bottom: 20rpx;
  border-radius: 22rpx;
  padding: 20rpx;
  background: #fff7ed;
}

.label {
  display: block;
  margin-bottom: 10rpx;
  color: #667085;
  font-size: 26rpx;
}

.summary-text {
  display: block;
  color: #c2410c;
  font-size: 26rpx;
  line-height: 1.5;
}

.field {
  margin-top: 18rpx;
}

.input {
  min-height: 84rpx;
  border-radius: 18rpx;
  padding: 0 22rpx;
  background: #f8fafc;
  color: #111827;
  font-size: 30rpx;
}
.clear-style { margin: 14rpx 0 0; padding: 8rpx 18rpx; border-radius: 999rpx; background: #edf2f4; color: #3d4652; font-size: 23rpx; }
.clear-style::after { border: 0; }
.booking-mask { align-items: flex-end; padding: 16px 0 0; }
.booking-panel { max-width: 520px; max-height: 88vh; padding: 24px 24px calc(24px + env(safe-area-inset-bottom)); border-radius: 24px 24px 0 0; background: var(--detail-surface); box-shadow: none; }
.booking-panel .close-btn { width: 48px; height: 48px; min-width: 48px; padding: 0; line-height: 48px; font-size: 28px; border-radius: 12px; background: var(--detail-subtle); color: var(--detail-muted); }
.booking-panel .selected-summary { margin: 16px 0; padding: 16px; border-radius: 12px; background: var(--detail-subtle); }
.booking-panel .summary-text { color: var(--detail-text); }
.booking-panel .clear-style { min-height: 48px; margin-top: 8px; padding: 12px 8px; line-height: 24px; font-size: 14px; color: var(--detail-muted); background: var(--detail-surface); border-radius: 12px; }
.booking-panel .submit { min-height: 48px; border-radius: 12px; }
@media (max-width: 359px) { .booking-panel { padding-left: 16px; padding-right: 16px; } }
/* A short visual entrance; closing remains immediate so it cannot delay navigation. */
.booking-panel { animation: booking-panel-in 220ms ease-out; }
@keyframes booking-panel-in { from { opacity: .5; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .booking-panel { animation: none; } }
</style>
