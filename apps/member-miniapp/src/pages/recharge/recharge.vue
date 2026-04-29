<template>
  <view class="page">
    <view class="header-card">
      <text class="header-title">充值中心</text>
    </view>

    <view class="card">
      <text class="section-title">申请充值</text>
      <view class="amount-grid">
        <view
          v-for="item in amountOptions"
          :key="item"
          class="amount-option"
          :class="{ active: amount === item }"
          @click="amount = item"
        >
          ¥{{ item }}
        </view>
      </view>
      <input v-model.number="amount" type="number" placeholder="输入自定义金额" class="input" />
      <button class="primary-btn" @click="submitRecharge" :disabled="submitting">
        {{ submitting ? '提交中...' : '提交' }}
      </button>
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
import { applyRecharge, listMyRecharges } from '@/utils/api';
import { sessionState } from '@/store/session';
import { formatMoney, refreshSessionProfile, requireLogin, statusClass, statusText } from '@/utils/member';

const amountOptions = [100, 300, 500, 1000];
const amount = ref(100);
const records = ref<RechargeOrder[]>([]);
const submitting = ref(false);

async function refresh() {
  await refreshSessionProfile();
  if (!sessionState.userId) {
    return;
  }
  records.value = await listMyRecharges(sessionState.userId);
}

async function submitRecharge() {
  if (!requireLogin()) {
    return;
  }
  if (!amount.value || amount.value <= 0) {
    uni.showToast({ title: '请输入有效金额', icon: 'none' });
    return;
  }

  submitting.value = true;
  try {
    await applyRecharge(sessionState.userId, { amount: amount.value });
    uni.showToast({ title: '申请已提交', icon: 'success' });
    await refresh();
  } finally {
    submitting.value = false;
  }
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

onShow(refresh);
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f7f4ef;
}

.header-card,
.card {
  border-radius: 30rpx;
  padding: 30rpx;
  background: #fff;
  box-shadow: 0 12rpx 38rpx rgba(31, 41, 55, 0.06);
}

.header-card {
  background: linear-gradient(135deg, #cf2c2c, #9b1717);
  color: #fff;
}

.header-title,
.section-title {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
}


.card {
  margin-top: 22rpx;
}

.amount-grid {
  margin-top: 22rpx;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14rpx;
}

.amount-option {
  border-radius: 20rpx;
  padding: 22rpx 0;
  background: #fff5f0;
  color: #9b1717;
  text-align: center;
  font-weight: 900;
}

.amount-option.active {
  background: #cf2c2c;
  color: #fff;
}

.input {
  margin-top: 18rpx;
  border: 1px solid #d0d5dd;
  border-radius: 20rpx;
  padding: 20rpx;
}

.primary-btn {
  margin-top: 20rpx;
  border-radius: 999rpx;
  background: #d72d2d;
  color: #fff;
  font-weight: 800;
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
