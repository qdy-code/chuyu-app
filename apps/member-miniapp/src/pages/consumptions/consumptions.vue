<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view class="header-card">
      <image class="header-bg" src="/static/brand/consumption-record-bg.jpg" mode="aspectFill" />
      <text class="header-title">消费记录</text>
    </view>

    <view v-if="records.length === 0" class="empty-card">
      <text class="empty-title">暂无消费记录</text>
    </view>

    <view v-for="item in records" :key="item.id" class="record-card">
      <view class="record-top">
        <view>
          <text class="record-title">{{ item.title }}</text>
          <text class="record-meta">订单号：{{ item.orderNo }}</text>
        </view>
        <text class="price">¥{{ formatMoney(item.finalPrice) }}</text>
      </view>
      <view class="detail-grid">
        <text>类型：{{ item.productType || '未填写' }}</text>
        <text>原价：¥{{ formatMoney(item.originalPrice) }}</text>
        <text>折扣：{{ discountText(item.discountRate) }}</text>
        <text>日期：{{ item.orderDate }}</text>
      </view>
      <view v-if="item.effectImages.length > 0" class="image-list">
        <image
          v-for="imageUrl in item.effectImages"
          :key="imageUrl"
          :src="toAbsoluteImageUrl(imageUrl)"
          class="thumb"
          mode="aspectFill"
          @click="previewImages(item.effectImages, imageUrl)"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { ConsumptionOrder } from '@member-platform/shared';
import { listMyConsumptions, toAbsoluteImageUrl } from '@/utils/api';
import { sessionState } from '@/store/session';
import { discountText, formatMoney, refreshSessionProfile } from '@/utils/member';

const records = ref<ConsumptionOrder[]>([]);

async function refresh() {
  await refreshSessionProfile();
  if (!sessionState.userId) {
    return;
  }
  records.value = await listMyConsumptions();
}

function previewImages(images: string[], current: string) {
  uni.previewImage({
    urls: images.map((item) => toAbsoluteImageUrl(item)),
    current: toAbsoluteImageUrl(current),
  });
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
.record-card,
.empty-card {
  border-radius: 30rpx;
  padding: 30rpx;
  background: #fff;
  box-shadow: 0 12rpx 38rpx rgba(31, 41, 55, 0.06);
}

.header-card {
  position: relative;
  overflow: hidden;
  min-height: 168rpx;
  background: #edf2f4;
  color: #3d4652;
}

.header-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.header-title {
  position: relative;
  z-index: 1;
}

.header-title,
.empty-title {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
}


.empty-card,
.record-card {
  margin-top: 22rpx;
}

.record-top {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
}

.record-title {
  display: block;
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}

.record-meta,
.detail-grid {
  color: #667085;
  font-size: 24rpx;
}

.record-meta {
  display: block;
  margin-top: 8rpx;
}

.price {
  color: #3d4652;
  font-size: 32rpx;
  font-weight: 900;
}

.detail-grid {
  margin-top: 20rpx;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}

.thumb {
  width: 156rpx;
  height: 156rpx;
  border-radius: 18rpx;
  background: #e5e7eb;
}
</style>
