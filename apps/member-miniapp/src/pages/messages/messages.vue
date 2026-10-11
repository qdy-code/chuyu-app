<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view class="header-card">
      <text class="eyebrow">Moonisle</text>
      <text class="title">留言给门店</text>
      <text class="desc">预约需求、服务建议或其他想告诉我们的内容，都可以写在这里。</text>
    </view>

    <view class="card composer-card">
      <textarea
        v-model="draft"
        class="textarea"
        maxlength="500"
        placeholder="请输入留言内容"
        :disabled="sending"
      />
      <view class="composer-foot">
        <text class="counter">{{ draft.length }}/500</text>
        <button class="submit" :disabled="sending || !draft.trim()" @click="submit">
          {{ sending ? '提交中...' : '提交留言' }}
        </button>
      </view>
    </view>

    <view class="section-title">我的留言</view>
    <view v-if="loading" class="card state-card">加载中...</view>
    <view v-else-if="messages.length === 0" class="card state-card">暂时还没有留言</view>
    <view v-else class="message-list">
      <view v-for="item in messages" :key="item.id" class="card message-card">
        <view class="message-meta">
          <text>{{ formatDate(item.createdAt) }}</text>
          <text :class="item.reply ? 'replied' : 'waiting'">{{ item.reply ? '门店已回复' : '等待回复' }}</text>
        </view>
        <text class="message-content">{{ item.content }}</text>
        <view v-if="item.reply" class="reply-box">
          <text class="reply-label">门店回复</text>
          <text class="reply-content">{{ item.reply }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { MemberMessage } from '@member-platform/shared';
import { createMyMessage, listMyMessages, readableErrorMessage } from '@/utils/api';
import { requireReadyMember } from '@/utils/member';
import { sessionState } from '@/store/session';

const messages = ref<MemberMessage[]>([]);
const draft = ref('');
const loading = ref(false);
const sending = ref(false);
let pendingRequestId = '';
let pendingContent = '';
let sessionRevision = 0;

watch(() => [sessionState.userId, sessionState.token], () => {
  sessionRevision += 1;
  messages.value = [];
  draft.value = '';
  pendingRequestId = '';
  pendingContent = '';
  loading.value = false;
  sending.value = false;
}, { flush: 'sync' });

function makeRequestId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function refresh() {
  if (!requireReadyMember()) return;
  const revision = sessionRevision;
  loading.value = true;
  try {
    const result = await listMyMessages();
    if (revision === sessionRevision) messages.value = result;
  } catch (error) {
    if (revision !== sessionRevision) return;
    uni.showToast({ title: readableErrorMessage(error, '留言加载失败').slice(0, 18), icon: 'none' });
  } finally {
    if (revision === sessionRevision) loading.value = false;
  }
}

async function submit() {
  if (!requireReadyMember()) return;
  const content = draft.value.trim();
  if (!content || sending.value) return;
  const revision = sessionRevision;
  sending.value = true;
  if (pendingContent !== content) {
    pendingRequestId = makeRequestId();
    pendingContent = content;
  }
  try {
    const created = await createMyMessage(content, pendingRequestId);
    if (revision !== sessionRevision) return;
    messages.value = [created, ...messages.value.filter((item) => item.id !== created.id)];
    draft.value = '';
    pendingRequestId = '';
    pendingContent = '';
    uni.showToast({ title: '留言已提交', icon: 'success' });
  } catch (error) {
    if (revision !== sessionRevision) return;
    uni.showToast({ title: readableErrorMessage(error, '留言提交失败').slice(0, 18), icon: 'none' });
  } finally {
    if (revision === sessionRevision) sending.value = false;
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

onShow(refresh);
</script>

<style scoped>
.page { position: relative; min-height: 100vh; padding: 24rpx; background: #f7f4ef; }
.page-bg { position: fixed; inset: 0; z-index: 0; width: 100vw; height: 100vh; pointer-events: none; }
.page > view { position: relative; z-index: 1; }
.header-card, .card { border-radius: 28rpx; background: rgba(255, 255, 255, .94); box-shadow: 0 12rpx 38rpx rgba(31, 41, 55, .06); }
.header-card { padding: 34rpx; }
.eyebrow, .section-title, .reply-label { color: #71808c; font-size: 23rpx; font-weight: 900; }
.title { display: block; margin-top: 10rpx; color: #111827; font-size: 42rpx; font-weight: 900; }
.desc { display: block; margin-top: 14rpx; color: #667085; font-size: 26rpx; line-height: 1.55; }
.composer-card { margin-top: 20rpx; padding: 24rpx; }
.textarea { width: 100%; min-height: 220rpx; color: #111827; font-size: 28rpx; line-height: 1.6; }
.composer-foot, .message-meta { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.counter, .message-meta { color: #98a2b3; font-size: 22rpx; }
.submit { margin: 0; border-radius: 999rpx; padding: 0 30rpx; background: #3d4652; color: #fff; font-size: 26rpx; font-weight: 900; }
.submit::after { border: 0; }
.submit[disabled] { opacity: .45; }
.section-title { margin: 30rpx 6rpx 14rpx; color: #344054; font-size: 28rpx; }
.state-card { padding: 40rpx 24rpx; text-align: center; color: #98a2b3; font-size: 26rpx; }
.message-list { display: flex; flex-direction: column; gap: 16rpx; }
.message-card { padding: 24rpx; }
.message-meta { padding-bottom: 14rpx; border-bottom: 1px solid #eef1f3; }
.replied { color: #527d68; }
.waiting { color: #9a7a45; }
.message-content, .reply-content { display: block; color: #344054; font-size: 28rpx; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
.message-content { padding-top: 16rpx; }
.reply-box { margin-top: 18rpx; padding: 18rpx; border-radius: 18rpx; background: #f5f8f7; }
.reply-label { display: block; margin-bottom: 8rpx; color: #527d68; }
.reply-content { font-size: 26rpx; }
</style>
