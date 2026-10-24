<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
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
  background: #3d4652;
  color: #f7f4ea;
  font-weight: 800;
}
</style>
