<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  NAvatar,
  NButton,
  NCard,
  NEmpty,
  NIcon,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  useMessage,
} from 'naive-ui';
import { Check, MessageCircle, Send } from '@lucide/vue';
import type { AdminMemberMessage } from '@member-platform/shared';
import { api, toAbsoluteImageUrl } from '@/api/client';

const message = useMessage();
const rows = ref<AdminMemberMessage[]>([]);
const filter = ref<'unread' | 'all'>('unread');
const keyword = ref('');
const loading = ref(false);
const selected = ref<AdminMemberMessage | null>(null);
const replyText = ref('');
const replying = ref(false);

const filterOptions = [
  { label: '未读留言', value: 'unread' },
  { label: '全部留言', value: 'all' },
];

const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return rows.value;
  return rows.value.filter((item) =>
    `${item.memberNickname} ${item.memberPhone || ''} ${item.content} ${item.reply || ''}`.toLowerCase().includes(kw),
  );
});

async function loadMessages() {
  loading.value = true;
  try {
    rows.value = await api.listMemberMessages(filter.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '留言加载失败');
  } finally {
    loading.value = false;
  }
}

async function openMessage(item: AdminMemberMessage) {
  selected.value = item;
  replyText.value = item.reply || '';
  if (!item.readAt) {
    try {
      const updated = await api.markMemberMessageRead(item.id);
      replaceRow(updated);
      selected.value = updated;
    } catch (error) {
      message.error(error instanceof Error ? error.message : '标记已读失败');
    }
  }
}

function replaceRow(updated: AdminMemberMessage) {
  const index = rows.value.findIndex((item) => item.id === updated.id);
  if (index >= 0) rows.value[index] = updated;
}

async function submitReply() {
  if (!selected.value || !replyText.value.trim() || replying.value) return;
  replying.value = true;
  try {
    const updated = await api.replyMemberMessage(selected.value.id, { reply: replyText.value.trim() });
    replaceRow(updated);
    selected.value = updated;
    replyText.value = updated.reply || '';
    message.success('回复已保存');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '回复失败');
  } finally {
    replying.value = false;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

onMounted(loadMessages);
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="surface">
      <div class="toolbar">
        <NSpace align="center" :size="10">
          <NSelect v-model:value="filter" :options="filterOptions" style="width: 124px" @update:value="loadMessages" />
          <NInput v-model:value="keyword" clearable placeholder="搜索会员、手机号或留言" style="width: 260px" />
        </NSpace>
        <NButton secondary :loading="loading" @click="loadMessages">
          <template #icon><NIcon><MessageCircle /></NIcon></template>
          刷新
        </NButton>
      </div>
    </NCard>

    <NSpin :show="loading">
      <NCard :bordered="false" class="surface message-list-card">
        <NEmpty v-if="!filteredRows.length" description="暂无留言" />
        <div v-else class="message-list">
          <button v-for="item in filteredRows" :key="item.id" type="button" class="message-row" @click="openMessage(item)">
            <NAvatar round :size="42" :src="toAbsoluteImageUrl(item.memberAvatarUrl)">
              {{ item.memberNickname.slice(0, 1) }}
            </NAvatar>
            <span class="message-main">
              <span class="message-title">
                <strong>{{ item.memberNickname }}</strong>
                <NTag v-if="!item.readAt" size="small" type="warning" :bordered="false">未读</NTag>
                <NTag v-if="item.reply" size="small" type="success" :bordered="false">已回复</NTag>
                <NTag v-if="item.memberDeleted" size="small" :bordered="false">会员已删除</NTag>
              </span>
              <span class="message-preview">{{ item.content }}</span>
              <span class="message-meta">{{ item.memberPhone || '未填写手机号' }} · {{ formatDate(item.createdAt) }}</span>
            </span>
            <NIcon :size="18" class="message-arrow"><Check v-if="item.reply" /><MessageCircle v-else /></NIcon>
          </button>
        </div>
      </NCard>
    </NSpin>

    <NModal :show="!!selected" preset="card" title="会员留言" style="width: 560px; max-width: calc(100vw - 32px)" @update:show="(value: boolean) => { if (!value) selected = null; }">
      <NSpace v-if="selected" vertical :size="16">
        <div class="member-line">
          <NAvatar round :size="42" :src="toAbsoluteImageUrl(selected.memberAvatarUrl)">{{ selected.memberNickname.slice(0, 1) }}</NAvatar>
          <div>
            <strong>{{ selected.memberNickname }}</strong>
            <div class="muted">{{ selected.memberPhone || '未填写手机号' }} · {{ formatDate(selected.createdAt) }}</div>
          </div>
        </div>
        <div class="message-content">{{ selected.content }}</div>
        <div class="reply-label">门店回复</div>
        <NInput v-model:value="replyText" type="textarea" :rows="4" maxlength="500" show-count placeholder="填写回复内容" />
        <NSpace justify="end">
          <NButton @click="selected = null">关闭</NButton>
          <NButton type="primary" :loading="replying" :disabled="!replyText.trim()" @click="submitReply">
            <template #icon><NIcon><Send /></NIcon></template>
            保存回复
          </NButton>
        </NSpace>
      </NSpace>
    </NModal>
  </NSpace>
</template>

<style scoped>
.surface { border-radius: 14px; box-shadow: 0 1px 8px rgba(17, 24, 39, 0.04); }
.toolbar, .message-title, .member-line { display: flex; align-items: center; }
.toolbar { justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.message-list { display: flex; flex-direction: column; }
.message-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px 4px; border: 0; border-bottom: 1px solid #edf0f2; background: transparent; text-align: left; cursor: pointer; }
.message-row:hover { background: #fafbfc; }
.message-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.message-title { gap: 8px; }
.message-preview { color: #344054; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.message-meta, .muted { color: #98a2b3; font-size: 12px; }
.message-arrow { color: #98a2b3; }
.member-line { gap: 12px; }
.message-content { padding: 16px; border-radius: 10px; background: #f7f8fa; color: #1d2939; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
.reply-label { color: #667085; font-size: 13px; }
@media (max-width: 640px) { .toolbar > * { width: 100%; } }
</style>
