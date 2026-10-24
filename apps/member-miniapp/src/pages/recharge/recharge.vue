<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view class="header-card">
      <text class="header-title">充值记录</text>
      <text class="header-desc">余额与积分分别记录</text>
      <text v-if="sessionState.profile?.pospal" class="record-meta">显示最近 100 条收银系统充值记录</text>
      <text v-if="loadedAt" class="record-meta">记录读取时间：{{ formatDate(loadedAt) }}，到店充值后可手动刷新</text>
      <button class="refresh-records" :disabled="loading" @click="refreshMoney">{{ loading ? '加载中...' : '刷新充值记录' }}</button>
    </view>

    <view class="card">
      <text class="section-title">充值记录</text>
      <view v-if="loading" class="empty-line">正在加载充值记录...</view>
      <view v-else-if="errorMessage" class="empty-line">
        <text>{{ errorMessage }}</text>
        <button @click="refreshMoney">重新加载</button>
      </view>
      <view v-else-if="loaded && records.length === 0" class="empty-line">暂无充值记录</view>
      <view v-for="item in records" :key="item.id" class="record">
        <view class="record-top">
          <text class="record-title">充值 ¥{{ formatMoney(item.amount) }}</text>
          <text class="status" :class="statusClass(item.status)">{{ rechargeStatusText(item) }}</text>
        </view>
        <text class="record-meta">充值单号：{{ item.id }}</text>
        <text class="record-meta">时间：{{ formatDate(item.createdAt) }}</text>
        <text v-if="item.giftAmount" class="record-meta">赠送金额：¥{{ formatMoney(item.giftAmount) }}</text>
        <text v-if="item.rejectReason" class="reject">拒绝原因：{{ item.rejectReason }}</text>
      </view>
    </view>

    <view v-if="!sessionState.profile?.pospal" class="card">
      <text class="section-title">积分明细</text>
      <view v-if="pointsLoading" class="empty-line">正在加载积分明细...</view>
      <view v-else-if="pointsError" class="empty-line">
        <text>{{ pointsError }}</text>
        <button @click="refreshPoints">重新加载</button>
      </view>
      <view v-else-if="pointsLoaded && pointsRecords.length === 0" class="empty-line">暂无积分变动记录</view>
      <view v-for="item in pointsRecords" :key="item.id" class="record">
        <view class="record-top">
          <text class="record-title">{{ item.reason }}</text>
          <text class="points-change">{{ item.changePoints > 0 ? '+' : '' }}{{ item.changePoints }} 积分</text>
        </view>
        <text class="record-meta">变动后：{{ item.afterPoints }} 积分</text>
        <text class="record-meta">时间：{{ formatDate(item.createdAt) }}</text>
        <text v-if="item.relatedOrderId" class="record-meta">关联单号：{{ item.relatedOrderId }}</text>
      </view>
    </view>
    <view v-if="sessionState.profile?.pospal" class="card">当前积分从收银系统同步；积分变动明细请联系门店查询。</view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { listMyRecharges, listMyPointsLedger } from '@/utils/api';
import { formatMoney, statusClass } from '@/utils/member';
import { rechargeStatusText } from '@/utils/member-display';
import { MEMBER_RECORD_CACHE_MS, useMemberRecords } from '@/utils/use-member-records';
import { sessionState } from '@/store/session';

const { records, loading, loaded, loadedAt, errorMessage, load: loadMoney, refresh: refreshMoney } = useMemberRecords(listMyRecharges, { cacheMs: MEMBER_RECORD_CACHE_MS });
const { records: pointsRecords, loading: pointsLoading, loaded: pointsLoaded,
  errorMessage: pointsError, refresh: refreshPoints } = useMemberRecords(listMyPointsLedger);

function formatDate(value: string): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

onShow(async () => {
  await loadMoney();
  if (!sessionState.profile?.pospal) await refreshPoints();
});
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

.refresh-records { margin: 18rpx 0 0; border-radius: 999rpx; background: #fff; color: #3d4652; font-size: 25rpx; }
.refresh-records::after { border: 0; }

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
  flex-wrap: wrap;
  gap: 12rpx;
}

.points-change { color: #3d4652; font-size: 28rpx; font-weight: 700; }

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
