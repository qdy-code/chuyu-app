<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NAlert, NButton, NCard, NCheckbox, NDescriptions, NDescriptionsItem, NSelect, NSpace, NTable, useMessage } from 'naive-ui';
import type { PospalConfiguration, PospalConnectionCheck, PospalMemberPreview } from '@member-platform/shared';
import { api, readableErrorMessage } from '@/api/client';
import { useDataStore } from '@/composables/useDataStore';
import { formatMoney } from '@/composables/useFormatters';

const { members, loadAll } = useDataStore();
type SyncJob = { memberId: string; customerNumber: string; state: string; attempts: number; lastError: string | null };
const jobs = ref<SyncJob[]>([]);
const syncLabels: Record<string, string> = { PENDING: '待同步', RUNNING: '同步中', DONE: '已同步', REVIEW: '需核对', FAILED: '失败' };
async function loadJobs() { try { jobs.value = await api.listPospalSync(); } catch (error) { errorMessage.value = readableErrorMessage(error, '无法读取同步任务'); } }
async function retryJob(id: string) { try { await api.retryPospalSync(id); await loadJobs(); message.success('已加入同步队列'); } catch (error) { errorMessage.value = readableErrorMessage(error, '无法重试'); } }
const configuration = ref<PospalConfiguration | null>(null);
const connection = ref<PospalConnectionCheck | null>(null);
const selectedMember = ref<string | null>(null);
const preview = ref<PospalMemberPreview | null>(null);
const loading = ref(false);
const checking = ref(false);
const comparing = ref(false);
const errorMessage = ref('');
const identityVerified = ref(false);
const linking = ref(false);
const linkedNumber = ref('');
const queued = ref(false);
const message = useMessage();
const ready = computed(() => configuration.value?.enabled && configuration.value?.configured);
const busy = computed(() => loading.value || checking.value || comparing.value || linking.value);
const options = computed(() => members.value.map((member) => ({
  label: `${member.nickname} · ${member.id}${member.phone ? ` · ${member.phone}` : ''}`,
  value: member.id,
})));
const previewMessages = {
  NO_PHONE: '该会员没有预留手机号，请先完善资料。',
  NOT_FOUND: '银豹未查到相同手机号的会员。',
  AMBIGUOUS: '银豹存在多条同手机号记录，请核对具体会员，不能自动关联。',
  CANDIDATE: '已找到同手机号的候选会员。请核对身份；当前结果仅供查看，不会修改余额或积分。',
};

watch(selectedMember, () => { preview.value = null; errorMessage.value = ''; identityVerified.value = false; linkedNumber.value = ''; queued.value = false; });

async function loadStatus() {
  loading.value = true;
  errorMessage.value = '';
  configuration.value = null;
  connection.value = null;
  preview.value = null;
  try { configuration.value = await api.getPospalStatus(); }
  catch (error) { errorMessage.value = readableErrorMessage(error, '无法读取银豹连接状态'); }
  finally { loading.value = false; }
}

async function testConnection() {
  checking.value = true;
  errorMessage.value = '';
  connection.value = null;
  try { connection.value = await api.testPospalConnection(); }
  catch (error) { errorMessage.value = readableErrorMessage(error, '银豹连接测试失败'); }
  finally { checking.value = false; }
}

async function compareMember() {
  const memberId = selectedMember.value;
  if (!memberId) return;
  comparing.value = true;
  errorMessage.value = '';
  preview.value = null;
  identityVerified.value = false;
  linkedNumber.value = '';
  queued.value = false;
  try {
    const result = await api.previewPospalMember(memberId);
    if (selectedMember.value === memberId) preview.value = result;
  } catch (error) {
    if (selectedMember.value === memberId) errorMessage.value = readableErrorMessage(error, '会员核对失败');
  } finally { comparing.value = false; }
}

async function linkCandidate(customerUid: string) {
  const memberId = selectedMember.value;
  if (!memberId || !identityVerified.value) return;
  linking.value = true;
  errorMessage.value = '';
  try {
    const result = await api.linkPospalMember(memberId, customerUid);
    linkedNumber.value = result.customerNumber;
    await loadAll();
    message.success('银豹会员已关联');
  } catch (error) { errorMessage.value = readableErrorMessage(error, '银豹会员关联失败'); }
  finally { linking.value = false; }
}

async function queueMember() {
  const memberId = selectedMember.value;
  if (!memberId || !identityVerified.value || preview.value?.state !== 'NOT_FOUND') return;
  linking.value = true;
  errorMessage.value = '';
  try {
    await api.confirmPospalSync(memberId);
    queued.value = true;
    await loadJobs();
    message.success('已加入银豹同步队列');
  } catch (error) { errorMessage.value = readableErrorMessage(error, '无法提交银豹开户同步'); }
  finally { linking.value = false; }
}

onMounted(() => { void loadStatus(); void loadJobs(); });
</script>

<template>
  <NSpace vertical :size="20">
    <NAlert v-if="errorMessage" type="error">{{ errorMessage }}</NAlert>
    <NCard title="收银系统连接">
      <NSpace vertical :size="16">
        <NAlert v-if="configuration && !ready" type="info">
          {{ !configuration.enabled ? '银豹连接尚未启用，请由维护人员配置服务端连接。' : '银豹服务端凭证不完整，请联系维护人员。' }}
        </NAlert>
        <NSpace>
          <NButton :loading="loading" :disabled="busy" @click="loadStatus">刷新状态</NButton>
          <NButton type="primary" :loading="checking" :disabled="!ready || busy" @click="testConnection">测试连接</NButton>
        </NSpace>
        <p class="hint">测试连接和会员核对各调用一次银豹查询接口，通常各消耗 100 Token。</p>
        <NDescriptions v-if="connection" bordered :column="1">
          <NDescriptionsItem label="连接结果">查询成功</NDescriptionsItem>
          <NDescriptionsItem label="门店">{{ connection.stores.map((store) => store.company || store.userId).join('、') || '未返回门店' }}</NDescriptionsItem>
          <NDescriptionsItem label="测试时间">{{ new Date(connection.checkedAt).toLocaleString() }}</NDescriptionsItem>
        </NDescriptions>
        <p v-if="configuration?.accountSource === 'pospal'" class="hint">已使用银豹账务来源：关联会员后，小程序余额和积分从收银系统读取。</p>
      </NSpace>
    </NCard>
    <NCard title="会员同步">
      <NSpace vertical>
        <NAlert type="info">顾客微信授权手机号后，自动关联银豹中唯一、有效且未绑定的同号会员。后台手动建档如遇已有同号会员，请核对后关联。</NAlert>
        <p class="hint">{{ configuration?.memberSyncEnabled ? '后台会员同步已启用' : '后台会员同步尚未启用，任务会保留等待处理' }}</p>
        <NButton @click="loadJobs">刷新同步任务</NButton>
        <NTable v-if="jobs.length"><thead><tr><th>小程序会员</th><th>开户编号</th><th>状态</th><th>说明</th><th>处理</th></tr></thead>
          <tbody><tr v-for="job in jobs" :key="job.memberId"><td>{{ job.memberId }}</td><td>{{ job.customerNumber }}</td><td>{{ syncLabels[job.state] || job.state }}</td><td>{{ job.lastError || '—' }}</td><td><NButton v-if="['FAILED', 'REVIEW'].includes(job.state)" size="small" @click="retryJob(job.memberId)">重新核对并同步</NButton></td></tr></tbody>
        </NTable>
        <p v-else class="hint">暂无同步任务。已手动建档的会员可在下方核对后补同步。</p>
      </NSpace>
    </NCard>
    <NCard title="会员核对">
      <NSpace vertical :size="16">
        <NSelect v-model:value="selectedMember" filterable clearable :options="options" placeholder="选择要核对的会员" :disabled="busy" />
        <NButton :loading="comparing" :disabled="!ready || !selectedMember || busy" @click="compareMember">查询银豹会员</NButton>
        <NAlert v-if="preview" :type="preview.state === 'CANDIDATE' ? 'info' : 'warning'">{{ previewMessages[preview.state] }}</NAlert>
        <NTable v-if="preview?.candidates.length" :single-line="false">
          <thead><tr><th>银豹会员</th><th>总余额</th><th>其中赠送余额</th><th>积分</th><th>关联</th></tr></thead>
          <tbody><tr v-for="candidate in preview.candidates" :key="candidate.uid">
            <td>{{ candidate.name }} · {{ candidate.number }}</td>
            <td>¥{{ formatMoney(candidate.balance) }}</td>
            <td>¥{{ formatMoney(candidate.giftBalance) }}</td>
            <td>{{ candidate.points }}</td>
            <td><NButton size="small" :disabled="!identityVerified || busy || !!linkedNumber" @click="linkCandidate(candidate.uid)">关联此会员</NButton></td>
          </tr></tbody>
        </NTable>
        <NCheckbox v-if="preview?.candidates.length || preview?.state === 'NOT_FOUND'" v-model:checked="identityVerified" :disabled="busy || !!linkedNumber || queued">{{ preview?.state === 'NOT_FOUND' ? '已核实顾客本人身份及预留手机号，确认同步开户到银豹' : '已核实会员本人身份，并确认所选银豹会员属于该顾客' }}</NCheckbox>
        <NButton v-if="preview?.state === 'NOT_FOUND'" type="primary" :loading="linking" :disabled="!identityVerified || busy || queued" @click="queueMember">同步开户到银豹</NButton>
        <NAlert v-if="queued" type="success">已加入同步队列，请在上方刷新同步任务。同步前会再次核对银豹，避免重复开户。</NAlert>
        <NAlert v-if="linkedNumber" type="success">已关联银豹会员号 {{ linkedNumber }}。</NAlert>
        <NDescriptions v-if="preview?.difference" bordered :column="1">
          <NDescriptionsItem label="小程序当前余额">¥{{ formatMoney(preview.local.balance) }}</NDescriptionsItem>
          <NDescriptionsItem label="小程序当前积分">{{ preview.local.points }}</NDescriptionsItem>
          <NDescriptionsItem label="银豹余额减小程序余额">¥{{ formatMoney(preview.difference.balance) }}</NDescriptionsItem>
          <NDescriptionsItem label="银豹积分减小程序积分">{{ preview.difference.points }}</NDescriptionsItem>
        </NDescriptions>
      </NSpace>
    </NCard>
  </NSpace>
</template>

<style scoped>
.hint { margin: 0; color: #777; font-size: 13px; }
</style>
