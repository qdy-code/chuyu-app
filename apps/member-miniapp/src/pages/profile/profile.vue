<template>
  <view class="page">
    <view class="card">
      <text class="title">账户资料已拆分</text>
      
      <button class="primary-btn" @click="goAccount">进入账户资料</button>
    </view>
  </view>
</template>

<script setup lang="ts">
function goAccount() {
  uni.redirectTo({ url: '/pages/account/account' });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f7f4ef;
}

.card {
  margin-top: 160rpx;
  border-radius: 30rpx;
  padding: 32rpx;
  background: #fff;
  text-align: center;
}

.title {
  display: block;
  color: #111827;
  font-size: 34rpx;
  font-weight: 900;
}


.primary-btn {
  margin-top: 28rpx;
  border-radius: 999rpx;
  background: #d72d2d;
  color: #fff;
  font-weight: 800;
}
</style>
