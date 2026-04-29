<template>
  <view class="page">
    <view v-if="activeAppointments.length > 0" class="card active-card">
      <view class="section-head">
        <view>
          <text class="eyebrow">我的预约</text>
          <text class="title">当前到店安排</text>
        </view>
        <text class="pill">{{ activeAppointments.length }} 个</text>
      </view>

      <view v-for="item in activeAppointments" :key="item.id" class="active-item">
        <view>
          <text class="date">{{ item.appointmentDate }}</text>
          <text class="time">{{ appointmentTimeText(item) }}</text>
        </view>
        <text class="status" :class="item.status.toLowerCase()">{{ statusText(item.status) }}</text>
        <text v-if="item.remark" class="remark">备注：{{ item.remark }}</text>
        <text v-if="item.adminRemark" class="remark">处理说明：{{ item.adminRemark }}</text>
      </view>
    </view>

    <view class="card">
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
          :class="{ muted: !day.inMonth, selected: day.date === form.appointmentDate, today: day.date === today }"
          @click="selectDate(day.date)"
        >
          <text class="day-number">{{ day.day }}</text>
          <text v-if="appointmentCountByDate[day.date]" class="day-dot">{{ appointmentCountByDate[day.date] }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="title">全部预约记录</text>
      <view v-if="appointments.length === 0" class="empty">暂无预约</view>
      <view v-for="item in appointments" :key="item.id" class="appointment-item">
        <view>
          <text class="date">{{ item.appointmentDate }}</text>
          <text class="time">{{ appointmentTimeText(item) }}</text>
        </view>
        <text class="status" :class="item.status.toLowerCase()">{{ statusText(item.status) }}</text>
        <text v-if="item.remark" class="remark">备注：{{ item.remark }}</text>
        <text v-if="item.adminRemark" class="remark">处理说明：{{ item.adminRemark }}</text>
      </view>
    </view>

    <view class="bottom-safe"></view>
    <view class="booking-bar">
      <button class="booking-button" @click="openBookingPanel">预约到店</button>
    </view>

    <view v-if="showBookingPanel" class="panel-mask" @click="closeBookingPanel">
      <view class="booking-panel" @click.stop>
        <view class="panel-handle"></view>
        <view class="section-head panel-head">
          <view>
            <text class="eyebrow">新预约</text>
            <text class="title">{{ form.appointmentDate }}</text>
          </view>
          <button class="close-btn" @click="closeBookingPanel">×</button>
        </view>

        <view class="mini-calendar">
          <scroll-view class="date-strip" scroll-x :show-scrollbar="false">
            <view class="date-strip-inner">
              <view
                v-for="day in upcomingDays"
                :key="day.date"
                class="strip-day"
                :class="{ selected: day.date === form.appointmentDate, today: day.date === today }"
                @click="selectDate(day.date)"
              >
                <text class="strip-week">{{ day.week }}</text>
                <text class="strip-number">{{ day.day }}</text>
              </view>
            </view>
          </scroll-view>
        </view>

        <view class="slot-head">
          <text class="label">选择到店时间</text>
          <text class="selected-count">{{ selectedArrivalTime }}</text>
        </view>

        <view class="alarm-wheel">
          <view class="wheel-fade top"></view>
          <picker-view
            class="time-wheel"
            indicator-class="wheel-indicator"
            :value="[selectedHourIndex, selectedMinuteIndex]"
            @change="onTimeWheelChange"
          >
            <picker-view-column>
              <view v-for="hour in hourOptions" :key="hour" class="wheel-row single">
                <text class="wheel-time">{{ hour }}</text>
              </view>
            </picker-view-column>
            <picker-view-column>
              <view v-for="minute in minuteOptions" :key="minute" class="wheel-row single">
                <text class="wheel-time">{{ minute }}</text>
              </view>
            </picker-view-column>
          </picker-view>
          <text class="wheel-colon">:</text>
          <view class="wheel-fade bottom"></view>
        </view>

        <view class="selected-summary" :class="{ disabled: isSelectedTimeBooked }">
          <text class="label">到店时间</text>
          <text class="summary-text">{{ selectedSlotSummary }}</text>
          <text v-if="isSelectedTimeBooked" class="summary-warning">该时间已有确认预约，请换一个时间</text>
        </view>

        <view class="field">
          <text class="label">备注</text>
          <input v-model="form.remark" class="input" placeholder="可填写到店需求" />
        </view>

        <button class="submit" :disabled="submitting || isSelectedTimeBooked" @click="confirmSubmitAppointment">
          {{ submitting ? '提交中...' : '提交预约' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { Appointment, AppointmentStatus, BookedAppointmentSlot } from '@member-platform/shared';
import { createAppointment, listBookedAppointmentSlots, listMyAppointments } from '@/utils/api';
import { sessionState } from '@/store/session';
import { refreshSessionProfile, requireLogin } from '@/utils/member';

type CalendarDay = {
  key: string;
  date: string;
  day: number;
  inMonth: boolean;
};

type StripDay = {
  date: string;
  day: number;
  week: string;
};

const weekLabels = ['日', '一', '二', '三', '四', '五', '六'];
const today = formatDate(new Date());
const currentMonth = ref(today.slice(0, 7));
const submitting = ref(false);
const showBookingPanel = ref(false);
const appointments = ref<Appointment[]>([]);
const bookedSlots = ref<BookedAppointmentSlot[]>([]);
const selectedHourIndex = ref(1);
const selectedMinuteIndex = ref(0);
const form = ref({
  appointmentDate: today,
  remark: '',
});

const hourOptions = Array.from({ length: 13 }, (_, index) => String(index + 9).padStart(2, '0'));
const allMinuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

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

const calendarDays = computed<CalendarDay[]>(() => {
  const [year, month] = currentMonth.value.split('-').map((value) => Number(value));
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

const upcomingDays = computed<StripDay[]>(() =>
  Array.from({ length: 21 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      date: formatDate(date),
      day: date.getDate(),
      week: weekLabels[date.getDay()],
    };
  }),
);

const bookedSlotStarts = computed(() => new Set(bookedSlots.value.map((slot) => slot.startTime)));

const minuteOptions = computed(() => (hourOptions[selectedHourIndex.value] === '21' ? ['00'] : allMinuteOptions));

const selectedArrivalTime = computed(() => {
  const hour = hourOptions[selectedHourIndex.value] || '09';
  const minute = minuteOptions.value[selectedMinuteIndex.value] || '00';
  return `${hour}:${minute}`;
});

const isSelectedTimeBooked = computed(() => bookedSlotStarts.value.has(selectedArrivalTime.value));

const selectedSlotSummary = computed(() => selectedArrivalTime.value);

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function changeMonth(offset: number) {
  const [year, month] = currentMonth.value.split('-').map((value) => Number(value));
  const next = new Date(year, month - 1 + offset, 1);
  currentMonth.value = formatDate(next).slice(0, 7);
}

async function selectDate(date: string) {
  form.value.appointmentDate = date;
  currentMonth.value = date.slice(0, 7);
  await loadBookedSlots();
}

function onTimeWheelChange(event: { detail: { value: number[] } }) {
  selectedHourIndex.value = event.detail.value[0] || 0;
  selectedMinuteIndex.value = Math.min(event.detail.value[1] || 0, minuteOptions.value.length - 1);
}

function appointmentTimeText(item: Appointment): string {
  return item.endTime && item.endTime !== item.startTime ? `${item.startTime}-${item.endTime}` : item.startTime;
}

function statusText(status: AppointmentStatus): string {
  const map: Record<AppointmentStatus, string> = {
    PENDING: '待处理',
    CONFIRMED: '已接受',
    CANCELLED: '已拒绝',
    COMPLETED: '已结束',
  };
  return map[status] || status;
}

async function loadAppointments() {
  if (!sessionState.userId) return;
  appointments.value = await listMyAppointments(sessionState.userId);
}

async function loadBookedSlots() {
  if (!sessionState.userId) return;
  bookedSlots.value = await listBookedAppointmentSlots(sessionState.userId, form.value.appointmentDate);
  if (selectedMinuteIndex.value >= minuteOptions.value.length) {
    selectedMinuteIndex.value = Math.max(0, minuteOptions.value.length - 1);
  }
}

async function openBookingPanel() {
  if (!requireLogin()) return;
  showBookingPanel.value = true;
  await loadBookedSlots();
}

function closeBookingPanel() {
  if (submitting.value) return;
  showBookingPanel.value = false;
}

function confirmSubmitAppointment() {
  if (!requireLogin()) return;
  if (isSelectedTimeBooked.value) {
    uni.showToast({ title: '该时间已有确认预约', icon: 'none' });
    return;
  }

  uni.showModal({
    title: '确认预约',
    content: `确认预约 ${form.value.appointmentDate} ${selectedSlotSummary.value}？`,
    confirmText: '确认提交',
    success: (result) => {
      if (result.confirm) {
        void submitAppointment();
      }
    },
  });
}

async function submitAppointment() {
  submitting.value = true;
  try {
    await loadBookedSlots();
    if (isSelectedTimeBooked.value) {
      uni.showToast({ title: '该时间已有确认预约', icon: 'none' });
      return;
    }

    await createAppointment(sessionState.userId, {
      appointmentDate: form.value.appointmentDate,
      startTime: selectedArrivalTime.value,
      remark: form.value.remark || undefined,
    });
    form.value.remark = '';
    showBookingPanel.value = false;
    uni.showToast({ title: '预约已提交', icon: 'success' });
    await Promise.all([loadAppointments(), loadBookedSlots()]);
  } catch (error) {
    const message = error instanceof Error ? error.message : '预约失败';
    uni.showToast({ title: message.slice(0, 18), icon: 'none' });
  } finally {
    submitting.value = false;
  }
}

onShow(async () => {
  await refreshSessionProfile();
  await Promise.all([loadAppointments(), loadBookedSlots()]);
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 28rpx 24rpx;
  background: #f7f4ef;
}

.card {
  margin-bottom: 24rpx;
  padding: 30rpx;
  border-radius: 30rpx;
  background: #fff;
  box-shadow: 0 12rpx 38rpx rgba(31, 41, 55, 0.06);
}

.active-card {
  border: 2rpx solid rgba(215, 45, 45, 0.12);
  background: linear-gradient(180deg, #fff, #fff8f8);
}

.section-head,
.slot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22rpx;
}

.eyebrow {
  display: block;
  margin-bottom: 8rpx;
  color: #d72d2d;
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
.selected-count {
  border-radius: 999rpx;
  padding: 10rpx 18rpx;
  background: #fff1f1;
  color: #d72d2d;
  font-size: 24rpx;
  font-weight: 900;
}

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
  color: #d72d2d;
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

.day-cell.today {
  border: 1px solid #fca5a5;
}

.day-cell.selected {
  background: #d72d2d;
  color: #fff;
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
.remark {
  display: block;
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
  color: #d72d2d;
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

.bottom-safe {
  height: 132rpx;
}

.booking-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(247, 244, 239, 0.94);
  backdrop-filter: blur(18rpx);
}

.booking-button,
.submit {
  margin: 0;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #d72d2d, #a71919);
  color: #fff;
  font-weight: 900;
  box-shadow: 0 18rpx 36rpx rgba(215, 45, 45, 0.2);
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
  align-items: flex-end;
  background: rgba(17, 24, 39, 0.42);
}

.booking-panel {
  width: 100%;
  max-height: 88vh;
  padding: 18rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: 36rpx 36rpx 0 0;
  background: #fff;
  box-sizing: border-box;
}

.panel-handle {
  width: 76rpx;
  height: 8rpx;
  margin: 0 auto 22rpx;
  border-radius: 999rpx;
  background: #d0d5dd;
}

.panel-head {
  margin-bottom: 18rpx;
}

.mini-calendar {
  margin-bottom: 22rpx;
}

.date-strip {
  white-space: nowrap;
}

.date-strip-inner {
  display: inline-flex;
  gap: 14rpx;
  padding: 2rpx 2rpx 10rpx;
}

.strip-day {
  width: 92rpx;
  padding: 16rpx 0;
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f8fafc;
  color: #667085;
}

.strip-day.selected {
  background: #111827;
  color: #fff;
}

.strip-day.today:not(.selected) {
  color: #d72d2d;
}

.strip-week {
  font-size: 22rpx;
}

.strip-number {
  margin-top: 8rpx;
  font-size: 34rpx;
  font-weight: 900;
}

.alarm-wheel {
  position: relative;
  height: 430rpx;
  border-radius: 32rpx;
  overflow: hidden;
  background: linear-gradient(180deg, #f8fafc, #ffffff 48%, #f8fafc);
}

.time-wheel {
  position: relative;
  height: 430rpx;
}

.wheel-indicator {
  height: 92rpx;
  border-top: 1px solid rgba(17, 24, 39, 0.08);
  border-bottom: 1px solid rgba(17, 24, 39, 0.08);
}

.wheel-fade {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 2;
  height: 150rpx;
  pointer-events: none;
}

.wheel-fade.top {
  top: 0;
  background: linear-gradient(180deg, #f8fafc 0%, rgba(248, 250, 252, 0) 100%);
}

.wheel-fade.bottom {
  bottom: 0;
  background: linear-gradient(0deg, #f8fafc 0%, rgba(248, 250, 252, 0) 100%);
}

.wheel-row {
  height: 92rpx;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111827;
}

.wheel-time {
  min-width: 116rpx;
  text-align: center;
  font-size: 46rpx;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.wheel-colon {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 3;
  transform: translate(-50%, -50%);
  color: #111827;
  font-size: 48rpx;
  font-weight: 900;
  line-height: 1;
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
</style>
