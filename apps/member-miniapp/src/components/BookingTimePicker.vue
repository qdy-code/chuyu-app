<template>
  <view class="time-picker">
    <text class="label">选择到店时间</text>
    <text class="help">以下为可申请时段，提交后仍需门店确认。</text>
    <view v-if="loading" class="state">正在更新时段...</view>
    <view v-else-if="errorMessage || !ready" class="state">
      <text>时段暂未加载，请重试后选择。</text>
      <button class="retry" @click="$emit('retry')">重新加载时段</button>
    </view>
    <view v-else-if="unavailable" class="state">当日预约已满，请选择其他日期</view>
    <view v-else>
      <text v-if="!visibleChoices.length" class="warning">当日已无可申请时间，请选择其他日期。</text>
      <scroll-view v-else scroll-y class="time-scroll" :scroll-into-view="scrollTarget">
        <view class="time-grid">
          <button v-for="item in visibleChoices" :id="slotId(item.time)" :key="item.time" class="time-choice" :class="{ selected: modelValue === item.time, disabled: item.disabled }" :disabled="item.disabled" @click="$emit('update:modelValue', item.time)">
            <text>{{ item.time }}</text><text class="reason">{{ item.reason || '可申请' }}</text>
          </button>
        </view>
      </scroll-view>
      <picker v-if="visibleChoices.length" mode="time" start="09:00" end="21:00" :value="modelValue" @change="chooseCustomTime">
        <view class="custom-time">其他到店时间：{{ modelValue }} <text>调整 ›</text></view>
      </picker>
      <text v-if="selectionInvalid" class="warning">所选时间已过或与确认预约重叠，请重新选择。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { BookedAppointmentSlot } from '@member-platform/shared';
import { appointmentTimeChoices, appointmentTimeConflicts, appointmentTimeFocus, appointmentTimePast } from '@/utils/appointment-availability';
const props = defineProps<{ date: string; modelValue: string; bookedSlots: BookedAppointmentSlot[]; loading: boolean; ready: boolean; errorMessage: string; unavailable?: boolean }>();
const emit = defineEmits<{ (event: 'update:modelValue', time: string): void; (event: 'retry'): void }>();
const nowTick = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => { timer = setInterval(() => { nowTick.value = Date.now(); }, 30000); });
onUnmounted(() => { if (timer) clearInterval(timer); });
const choices = computed(() => appointmentTimeChoices(props.date, props.bookedSlots, new Date(nowTick.value)));
const visibleChoices = computed(() => choices.value.filter(choice => choice.reason !== '已过'));
const scrollTarget = ref('');
let focusRevision = 0;
function slotId(time: string): string { return `time-${time.replace(':', '-')}`; }
async function focusTime() {
  const request = ++focusRevision;
  scrollTarget.value = '';
  if (!props.ready || props.loading || props.errorMessage || props.unavailable) return;
  const target = appointmentTimeFocus(choices.value, props.modelValue);
  await nextTick();
  if (request === focusRevision && target) scrollTarget.value = slotId(target);
}
watch(() => [props.date, props.ready, props.loading, props.errorMessage, props.unavailable, props.bookedSlots], focusTime, { immediate: true });
const selectionInvalid = computed(() => appointmentTimePast(props.date, props.modelValue, new Date(nowTick.value)) || appointmentTimeConflicts(props.modelValue, props.bookedSlots));
function chooseCustomTime(event: { detail: { value: string } }) {
  const time = event.detail.value;
  if (appointmentTimePast(props.date, time) || appointmentTimeConflicts(time, props.bookedSlots)) {
    uni.showToast({ title: '该时间不可预约，请重新选择', icon: 'none' });
    return;
  }
  emit('update:modelValue', time);
  void nextTick().then(focusTime);
}
</script>

<style scoped>
.time-picker { margin-top: 24rpx; }
.label, .help, .warning { display: block; }
.label { color: #667085; font-size: 25rpx; font-weight: 800; }
.help { margin: 10rpx 0 18rpx; color: #72818d; font-size: 23rpx; line-height: 1.5; }
.time-scroll { height: 320rpx; }
.time-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12rpx; padding-bottom: 10rpx; }
.time-choice { width: 100%; margin: 0; padding: 14rpx 0; border-radius: 18rpx; line-height: 1.4; font-size: 27rpx; background: #edf2f4; color: #3d4652; }
.time-choice::after, .retry::after { border: 0; }
.time-choice.selected { background: #3d4652; color: #f7f4ef; }
.time-choice.disabled { background: #f2f4f7; color: #b0b6bf; }
.reason { display: block; margin-top: 4rpx; font-size: 20rpx; }
.custom-time { display: flex; justify-content: space-between; margin-top: 18rpx; padding: 20rpx; border-radius: 18rpx; background: #f8fafc; color: #3d4652; font-size: 25rpx; }
.state { padding: 22rpx; border-radius: 18rpx; background: #f8fafc; color: #667085; font-size: 25rpx; }
.retry { margin-top: 14rpx; font-size: 24rpx; border-radius: 999rpx; background: #edf2f4; color: #3d4652; }
.warning { margin-top: 14rpx; font-size: 23rpx; color: #a64b47; }
</style>
