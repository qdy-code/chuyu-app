<template>
  <view class="receipt">
    <text class="receipt-title">预约申请已提交，待门店确认</text>
    <text v-if="appointment.productName" class="receipt-copy">{{ appointment.productName }}</text>
    <text class="receipt-copy">{{ appointment.appointmentDate }} {{ appointment.startTime }}</text>
    <text class="receipt-copy">门店确认后再按约到店，请在“我的预约”查看处理结果。</text>
    <button class="receipt-button" @click="openRecords">查看我的预约</button>
  </view>
</template>

<script setup lang="ts">
import type { Appointment } from '@member-platform/shared';
defineProps<{ appointment: Appointment }>();
function openRecords() {
  uni.navigateTo({ url: '/pages/appointment/appointment?records=1' });
}
</script>

<style scoped>
.receipt { position: relative; z-index: 1; margin-top: 22rpx; margin-bottom: 22rpx; padding: 28rpx; border-radius: 28rpx; background: #f5f8f7; border: 2rpx solid #dce7e1; }
.receipt-title { display: block; color: #527d68; font-size: 30rpx; font-weight: 800; }
.receipt-copy { display: block; margin-top: 12rpx; color: #667085; font-size: 25rpx; line-height: 1.6; }
.receipt-button { margin: 20rpx 0 0; border-radius: 999rpx; background: #edf2f4; color: #3d4652; font-size: 25rpx; }
.receipt-button::after { border: 0; }
</style>
