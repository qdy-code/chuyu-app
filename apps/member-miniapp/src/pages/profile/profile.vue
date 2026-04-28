<template>
  <view class="page">
    <view class="card">
      <text class="title">个人信息</text>
      <text v-if="!sessionState.profile">请先在首页登录</text>
      <template v-else>
        <text>会员ID：{{ sessionState.profile.id }}</text>
        <text>手机号：{{ sessionState.profile.phone || '未绑定' }}</text>
        <text>昵称：{{ sessionState.profile.nickname }}</text>
        <text>生日：{{ birthday || '未设置' }}</text>
        <text>当前余额：{{ sessionState.profile.balance }}</text>
        <view class="row">
          <input v-model.trim="phone" type="number" maxlength="11" placeholder="填写手机号作为会员ID" class="input" />
          <button class="btn ghost-btn" @click="savePhone">绑定手机号</button>
        </view>
        <view class="row">
          <picker mode="date" :value="birthday" @change="handleBirthdayChange">
            <view class="picker">{{ birthday || '请选择生日日期' }}</view>
          </picker>
          <button class="btn ghost-btn" @click="saveBirthday">保存生日</button>
        </view>
        <view class="row">
          <input v-model.number="amount" type="number" placeholder="充值金额" class="input" />
          <button class="btn" @click="submitRecharge">提交充值申请</button>
        </view>
      </template>
    </view>

    <view class="card">
      <text class="title">充值申请记录</text>
      <text v-if="rechargeRecords.length === 0">暂无记录</text>
      <view v-for="item in rechargeRecords" :key="item.id" class="item">
        <text>ID: {{ item.id }}</text>
        <text>金额: {{ item.amount }}</text>
        <text>状态: {{ item.status }}</text>
      </view>
    </view>

    <view class="card">
      <text class="title">消费记录</text>
      <text v-if="consumptionRecords.length === 0">暂无消费记录</text>
      <view v-for="item in consumptionRecords" :key="item.id" class="item">
        <text>订单号: {{ item.orderNo }}</text>
        <text>产品类型: {{ item.productType || '未填写' }}</text>
        <text>标题: {{ item.title }}</text>
        <text>原价: {{ item.originalPrice }}</text>
        <text>会员价: {{ item.finalPrice }}</text>
        <text>折扣: {{ item.discountRate }}</text>
        <text>日期: {{ item.orderDate }}</text>
        <text v-if="item.effectImages.length > 0">效果图片: {{ item.effectImages.length }} 张</text>
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
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import {
  applyRecharge,
  getMyProfile,
  listMyConsumptions,
  listMyRecharges,
  toAbsoluteImageUrl,
  updateMyProfile,
} from '@/utils/api';
import { sessionState } from '@/store/session';
import type { ConsumptionOrder, RechargeOrder } from '@member-platform/shared';

const amount = ref(100);
const phone = ref('');
const birthday = ref('');
const rechargeRecords = ref<RechargeOrder[]>([]);
const consumptionRecords = ref<ConsumptionOrder[]>([]);

async function refresh() {
  if (!sessionState.userId) {
    return;
  }
  sessionState.profile = await getMyProfile(sessionState.userId);
  sessionState.userId = sessionState.profile.id;
  phone.value = sessionState.profile.phone || (/^1[3-9]\d{9}$/.test(sessionState.profile.id) ? sessionState.profile.id : '');
  birthday.value = sessionState.profile.birthday || '';
  rechargeRecords.value = await listMyRecharges(sessionState.userId);
  consumptionRecords.value = await listMyConsumptions(sessionState.userId);
}

async function submitRecharge() {
  if (!sessionState.userId) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  if (amount.value <= 0) {
    uni.showToast({ title: '金额必须大于0', icon: 'none' });
    return;
  }

  await applyRecharge(sessionState.userId, { amount: amount.value });
  uni.showToast({ title: '申请已提交', icon: 'success' });
  await refresh();
}

async function savePhone() {
  if (!sessionState.userId) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(phone.value)) {
    uni.showToast({ title: '请输入正确手机号', icon: 'none' });
    return;
  }

  try {
    sessionState.profile = await updateMyProfile(sessionState.userId, { phone: phone.value });
    sessionState.userId = sessionState.profile.id;
    uni.showToast({ title: '手机号已绑定', icon: 'success' });
    await refresh();
  } catch (error) {
    const message = error instanceof Error ? error.message : '绑定失败';
    uni.showToast({ title: message.includes('phone already') ? '手机号已被绑定' : '绑定失败', icon: 'none' });
  }
}

function handleBirthdayChange(event: { detail: { value: string } }) {
  birthday.value = event.detail.value;
}

async function saveBirthday() {
  if (!sessionState.userId) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  if (!birthday.value) {
    uni.showToast({ title: '请选择生日', icon: 'none' });
    return;
  }

  sessionState.profile = await updateMyProfile(sessionState.userId, { birthday: birthday.value });
  uni.showToast({ title: '生日已保存', icon: 'success' });
  await refresh();
}

function previewImages(images: string[], current: string) {
  uni.previewImage({
    urls: images.map((item) => toAbsoluteImageUrl(item)),
    current: toAbsoluteImageUrl(current),
  });
}

onMounted(refresh);
onShow(refresh);
</script>

<style scoped>
.page {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.title {
  font-size: 30rpx;
  font-weight: 700;
}

.row {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.input {
  flex: 1;
  border: 1px solid #d0d5dd;
  border-radius: 10rpx;
  padding: 14rpx;
}

.btn {
  background: #0f766e;
  color: #fff;
}

.ghost-btn {
  background: #e2e8f0;
  color: #0f172a;
}

.item {
  border: 1px solid #eaecf0;
  border-radius: 12rpx;
  padding: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 8rpx;
}

.thumb {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background: #e5e7eb;
}

.picker {
  min-width: 280rpx;
  border: 1px solid #d0d5dd;
  border-radius: 10rpx;
  padding: 14rpx;
  background: #fff;
}
</style>
