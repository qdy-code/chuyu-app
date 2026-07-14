<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view class="header-card">
      <text class="header-title">充值记录</text>
      <text class="header-desc">账户充值由门店后台处理，顾客端仅展示记录。</text>
    </view>

    <view class="card">
      <text class="section-title">充值记录</text>
      <view v-if="records.length === 0" class="empty-line">暂无充值记录</view>
      <view v-for="item in records" :key="item.id" class="record">
        <view class="record-top">
          <text class="record-title">充值 ¥{{ formatMoney(item.amount) }}</text>
          <text class="status" :class="statusClass(item.status)">{{ statusText(item.status) }}</text>
        </view>
        <text class="record-meta">申请单号：{{ item.id }}</text>
        <text class="record-meta">提交时间：{{ formatDate(item.createdAt) }}</text>
        <text v-if="item.rejectReason" class="reject">拒绝原因：{{ item.rejectReason }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { RechargeOrder } from '@member-platform/shared';
import { listMyRecharges } from '@/utils/api';
import { sessionState } from '@/store/session';
import { formatMoney, refreshSessionProfile, statusClass, statusText } from '@/utils/member';

const records = ref<RechargeOrder[]>([]);

async function refresh() {
  await refreshSessionProfile();
  if (!sessionState.userId) {
    return;
  }
  records.value = await listMyRecharges();
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

onShow(refresh);
</script>

<style scoped>
.page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  padding: 24rpx;
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

.page > view {
  position: relative;
  z-index: 1;
}

.header-card,
.card {
  border-radius: 30rpx;
  padding: 30rpx;
  background: #fff;
  box-shadow: 0 12rpx 38rpx rgba(31, 41, 55, 0.06);
}

.header-card {
  background: #edf2f4;
  color: #3d4652;
}

.header-title,
.section-title {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
}

.header-desc {
  display: block;
  margin-top: 12rpx;
  color: #667085;
  font-size: 24rpx;
  line-height: 1.5;
}

.card {
  margin-top: 22rpx;
}

.record {
  border-top: 1px solid #eef2f6;
  padding: 22rpx 0;
}

.record-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.record-title {
  color: #111827;
  font-size: 28rpx;
  font-weight: 900;
}

.record-meta,
.empty-line,
.reject {
  display: block;
  margin-top: 8rpx;
  color: #667085;
  font-size: 24rpx;
}

.reject {
  color: #b42318;
}

.status {
  border-radius: 999rpx;
  padding: 6rpx 16rpx;
  font-size: 22rpx;
}

.status-pending {
  background: #fffaeb;
  color: #b54708;
}

.status-approved {
  background: #ecfdf3;
  color: #027a48;
}

.status-rejected {
  background: #fef3f2;
  color: #b42318;
}
</style>
