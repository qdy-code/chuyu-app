<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  NButton,
  NCalendar,
  NCard,
  NDatePicker,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NIcon,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NTag,
  NTimePicker,
  useMessage,
} from 'naive-ui';
import { CalendarPlus, CheckCircle2, Pencil, XCircle } from 'lucide-vue-next';
import type { Appointment, AppointmentStatus } from '@member-platform/shared';
import { api } from '@/api/client';
import { useDataStore } from '@/composables/useDataStore';
import {
  appointmentActionText,
  appointmentStatusText,
  appointmentStatusType,
  appointmentTimeText,
} from '@/composables/useFormatters';

const { appointments, members, loadAll } = useDataStore();
const message = useMessage();

const calendarTimestamp = ref(Date.now());
const selectedDate = ref('');

const memberKeyword = ref('');
const showModal = ref(false);
const editingId = ref('');
const submitting = ref(false);

interface FormShape {
  userId: string;
  appointmentDate: number;
  startTime: number;
  status: AppointmentStatus;
  remark: string;
  adminRemark: string;
}

const form = ref<FormShape>({
  userId: '',
  appointmentDate: Date.now(),
  startTime: timeToTimestamp('09:00'),
  status: 'CONFIRMED',
  remark: '',
  adminRemark: '',
});

function dateString(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeString(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeToTimestamp(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function parseDate(d: string): number {
  return new Date(`${d}T00:00:00`).getTime();
}

const memberOptions = computed(() =>
  members.value
    .filter((m) => {
      const kw = memberKeyword.value.trim().toLowerCase();
      if (!kw) return true;
      const hay = `${m.nickname} ${m.id} ${m.phone || ''} ${m.remark || ''}`.toLowerCase();
      return hay.includes(kw);
    })
    .map((m) => ({ label: `${m.nickname}（${m.id}）`, value: m.id })),
);

const appointmentsByDate = computed(() =>
  appointments.value.reduce<Record<string, Appointment[]>>((groups, item) => {
    (groups[item.appointmentDate] = groups[item.appointmentDate] || []).push(item);
    return groups;
  }, {}),
);

const selectedDateAppointments = computed(() =>
  (appointmentsByDate.value[selectedDate.value] || [])
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime)),
);

const pendingCount = computed(
  () => appointments.value.filter((a) => a.status === 'PENDING').length,
);

function statusCounts(date: string): Record<AppointmentStatus, number> {
  return (appointmentsByDate.value[date] || []).reduce(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    { PENDING: 0, CONFIRMED: 0, CANCELLED: 0, COMPLETED: 0 } as Record<AppointmentStatus, number>,
  );
}

function pickDate(timestamp: number) {
  selectedDate.value = dateString(timestamp);
}

function openCreate(dateStr?: string) {
  editingId.value = '';
  memberKeyword.value = '';
  form.value = {
    userId: members.value[0]?.id || '',
    appointmentDate: dateStr ? parseDate(dateStr) : Date.now(),
    startTime: timeToTimestamp('09:00'),
    status: 'CONFIRMED',
    remark: '',
    adminRemark: '',
  };
  showModal.value = true;
}

function openEdit(item: Appointment) {
  editingId.value = item.id;
  memberKeyword.value = '';
  form.value = {
    userId: item.userId,
    appointmentDate: parseDate(item.appointmentDate),
    startTime: timeToTimestamp(item.startTime),
    status: item.status,
    remark: item.remark || '',
    adminRemark: item.adminRemark || '',
  };
  showModal.value = true;
}

async function submitForm() {
  if (!form.value.userId) {
    message.warning('请选择会员');
    return;
  }
  submitting.value = true;
  const payload = {
    userId: form.value.userId,
    appointmentDate: dateString(form.value.appointmentDate),
    startTime: timeString(form.value.startTime),
    endTime: timeString(form.value.startTime),
    status: form.value.status,
    remark: form.value.remark.trim() || undefined,
    adminRemark: form.value.adminRemark.trim() || undefined,
  };
  try {
    if (editingId.value) {
      await api.updateAppointment(editingId.value, payload);
      message.success('已保存');
    } else {
      await api.createAppointment(payload);
      message.success('已创建预约');
    }
    showModal.value = false;
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '提交失败');
  } finally {
    submitting.value = false;
  }
}

const reasonModal = ref(false);
const reasonInput = ref('');
let reasonResolver: ((value: string) => void) | null = null;

function promptReason(callback: (value: string) => void) {
  reasonInput.value = '';
  reasonModal.value = true;
  reasonResolver = (v: string) => callback(v);
}

function submitReason() {
  if (!reasonInput.value.trim()) {
    message.warning('请填写拒绝原因');
    return;
  }
  reasonModal.value = false;
  reasonResolver?.(reasonInput.value.trim());
}

async function updateStatus(id: string, status: AppointmentStatus, reason?: string) {
  try {
    await api.updateAppointment(id, {
      status,
      adminRemark: status === 'CANCELLED' ? reason : undefined,
    });
    message.success(`已${appointmentActionText(status)}`);
    await loadAll();
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败');
  }
}
</script>

<template>
  <NSpace vertical :size="20">
    <NCard :bordered="false" class="surface">
      <template #header>
        <div class="card-header">
          <span>预约排期表</span>
          <NSpace align="center" :size="10">
            <NTag :bordered="false" type="warning">待处理 {{ pendingCount }}</NTag>
            <NButton type="primary" size="small" @click="openCreate()">
              <template #icon>
                <NIcon><CalendarPlus /></NIcon>
              </template>
              新增预约
            </NButton>
          </NSpace>
        </div>
      </template>

      <NCalendar
        v-model:value="calendarTimestamp"
        #="{ year, month, date }"
        @update:value="pickDate"
      >
        <div class="day-cell" @click="pickDate(new Date(year, month - 1, date).getTime())">
          <template
            v-if="appointmentsByDate[`${year}-${String(month).padStart(2,'0')}-${String(date).padStart(2,'0')}`]"
          >
            <div class="day-row" v-for="item in (appointmentsByDate[`${year}-${String(month).padStart(2,'0')}-${String(date).padStart(2,'0')}`] || []).slice(0, 2)" :key="item.id">
              <span class="day-time">{{ item.startTime }}</span>
              <span class="day-name">{{ item.memberNickname }}</span>
              <NTag size="tiny" :bordered="false" :type="appointmentStatusType(item.status)">
                {{ appointmentStatusText(item.status) }}
              </NTag>
            </div>
            <div
              class="day-more"
              v-if="(appointmentsByDate[`${year}-${String(month).padStart(2,'0')}-${String(date).padStart(2,'0')}`] || []).length > 2"
            >
              共 {{ (appointmentsByDate[`${year}-${String(month).padStart(2,'0')}-${String(date).padStart(2,'0')}`] || []).length }} 个预约
            </div>
          </template>
        </div>
      </NCalendar>
    </NCard>

    <!-- 当日详情模态 -->
    <NModal
      :show="!!selectedDate"
      preset="card"
      :title="`${selectedDate} 预约详情`"
      style="width: 720px; max-width: calc(100vw - 32px)"
      :bordered="false"
      @update:show="(v: boolean) => !v && (selectedDate = '')"
    >
      <template #header-extra>
        <NButton size="small" type="primary" @click="openCreate(selectedDate)">
          <template #icon>
            <NIcon><CalendarPlus /></NIcon>
          </template>
          新增当日预约
        </NButton>
      </template>

      <NEmpty v-if="!selectedDateAppointments.length" description="当日没有预约" />

      <NSpace v-else vertical :size="14">
        <NCard
          v-for="item in selectedDateAppointments"
          :key="item.id"
          size="small"
          :class="`appt-card status-${item.status.toLowerCase()}`"
          :bordered="false"
        >
          <div class="appt-head">
            <div>
              <strong class="appt-time">{{ appointmentTimeText(item) }}</strong>
              <div class="appt-member">{{ item.memberNickname }} <span class="dim">（{{ item.userId }}）</span></div>
            </div>
            <NTag :bordered="false" :type="appointmentStatusType(item.status)">
              {{ appointmentStatusText(item.status) }}
            </NTag>
          </div>

          <NDescriptions :column="2" size="small" label-placement="top" style="margin-top: 8px">
            <NDescriptionsItem label="会员备注">{{ item.remark || '无' }}</NDescriptionsItem>
            <NDescriptionsItem v-if="item.adminRemark" label="处理备注">{{ item.adminRemark }}</NDescriptionsItem>
            <NDescriptionsItem label="提交时间">{{ item.createdAt }}</NDescriptionsItem>
            <NDescriptionsItem label="更新时间">{{ item.updatedAt }}</NDescriptionsItem>
          </NDescriptions>

          <NSpace :size="8" style="margin-top: 12px">
            <NButton size="small" secondary @click="openEdit(item)">
              <template #icon>
                <NIcon><Pencil /></NIcon>
              </template>
              修改
            </NButton>
            <NButton
              v-if="item.status === 'PENDING'"
              size="small"
              type="primary"
              @click="updateStatus(item.id, 'CONFIRMED')"
            >
              <template #icon>
                <NIcon><CheckCircle2 /></NIcon>
              </template>
              接受
            </NButton>
            <NButton
              v-if="item.status === 'PENDING'"
              size="small"
              type="error"
              secondary
              @click="promptReason((v) => updateStatus(item.id, 'CANCELLED', v))"
            >
              <template #icon>
                <NIcon><XCircle /></NIcon>
              </template>
              拒绝
            </NButton>
            <NButton
              v-if="item.status === 'CONFIRMED'"
              size="small"
              type="primary"
              secondary
              @click="updateStatus(item.id, 'COMPLETED')"
            >
              标记完成
            </NButton>
          </NSpace>
        </NCard>
      </NSpace>
    </NModal>

    <!-- 新建/编辑预约 -->
    <NModal
      v-model:show="showModal"
      preset="card"
      :title="editingId ? '修改预约' : '新增预约'"
      style="width: 620px; max-width: calc(100vw - 32px)"
      :bordered="false"
    >
      <NSpace vertical :size="14">
        <div class="form-row">
          <label>检索会员</label>
          <NInput v-model:value="memberKeyword" placeholder="按昵称 / ID / 手机号 / 备注 过滤" clearable />
        </div>
        <div class="form-row">
          <label>选择会员</label>
          <NSelect v-model:value="form.userId" :options="memberOptions" filterable />
        </div>
        <div class="form-grid">
          <div>
            <label>预约日期</label>
            <NDatePicker v-model:value="form.appointmentDate" type="date" style="width: 100%" />
          </div>
          <div>
            <label>预约时间</label>
            <NTimePicker v-model:value="form.startTime" format="HH:mm" style="width: 100%" />
          </div>
        </div>
        <div class="form-row">
          <label>状态</label>
          <NSelect
            v-model:value="form.status"
            :options="[
              { label: '待处理', value: 'PENDING' },
              { label: '已接受', value: 'CONFIRMED' },
              { label: '已拒绝', value: 'CANCELLED' },
              { label: '已结束', value: 'COMPLETED' },
            ]"
          />
        </div>
        <div class="form-row">
          <label>用户端备注</label>
          <NInput v-model:value="form.remark" placeholder="会同步给会员看到" />
        </div>
        <div class="form-row">
          <label>处理说明 / 拒绝原因</label>
          <NInput v-model:value="form.adminRemark" type="textarea" :rows="2" placeholder="拒绝预约时必填" />
        </div>
      </NSpace>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="showModal = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitForm">确认提交</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="reasonModal" preset="card" title="拒绝原因" style="width: 460px" :bordered="false">
      <NInput v-model:value="reasonInput" type="textarea" :rows="3" placeholder="请输入拒绝原因（会同步给会员）" />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="reasonModal = false">取消</NButton>
          <NButton type="error" @click="submitReason">确认拒绝</NButton>
        </NSpace>
      </template>
    </NModal>
  </NSpace>
</template>

<style scoped>
.surface {
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 8px -2px rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.day-cell {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 56px;
}

.day-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
  background: rgba(216, 81, 79, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
}

.day-time {
  font-weight: 600;
  color: var(--color-brand);
}

.day-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-more {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.appt-card {
  border-left: 4px solid var(--color-border);
  background: #fff;
  transition: border-color 0.2s;
}

.appt-card.status-pending { border-left-color: #e2934a; }
.appt-card.status-confirmed { border-left-color: #3fa66e; }
.appt-card.status-cancelled { border-left-color: #d45852; }
.appt-card.status-completed { border-left-color: #999; }

.appt-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.appt-time {
  font-size: 16px;
  color: var(--color-text);
}

.appt-member {
  margin-top: 2px;
  font-size: 13px;
  color: var(--color-text);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

label {
  font-size: 13px;
  color: var(--color-text-muted);
}

.dim {
  color: var(--color-text-muted);
  font-size: 12px;
}
</style>
