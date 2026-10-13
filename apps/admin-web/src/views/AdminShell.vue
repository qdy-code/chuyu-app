<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { Component, VNodeChild } from 'vue';
import {
  NBadge,
  NButton,
  NIcon,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NLayoutSider,
  NMenu,
  NSpace,
  NSpin,
  NTooltip,
  useDialog,
  useMessage,
} from 'naive-ui';
import type { MenuOption } from 'naive-ui';
import {
  Activity,
  Bell,
  BellRing,
  ChartNoAxesCombined,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  History,
  LogOut,
  RefreshCw,
  Users,
  Wallet,
  Receipt,
  Layers,
  PackageSearch,
  MessageSquareText,
} from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useDataStore } from '@/composables/useDataStore';

import MembersTab from './tabs/MembersTab.vue';
import LevelsTab from './tabs/LevelsTab.vue';
import RechargesTab from './tabs/RechargesTab.vue';
import OrdersTab from './tabs/OrdersTab.vue';
import AppointmentsTab from './tabs/AppointmentsTab.vue';
import ProductCatalogsTab from './tabs/ProductCatalogsTab.vue';
import LogsTab from './tabs/LogsTab.vue';
import RevenueTab from './tabs/RevenueTab.vue';
import MessagesTab from './tabs/MessagesTab.vue';
import PospalTab from './tabs/PospalTab.vue';

type TabKey = 'members' | 'levels' | 'catalogs' | 'recharges' | 'orders' | 'revenue' | 'appointments' | 'messages' | 'logs' | 'pospal';

const { logout } = useAuth();
const {
  appointments,
  loadAll,
  refreshAppointments,
  loading,
  error,
  pendingAppointmentCount,
  memberMessages,
  pospalAccounts,
  refreshMemberMessages,
} = useDataStore();
const message = useMessage();
const dialog = useDialog();

const activeKey = ref<TabKey>('members');
const collapsed = ref(false);
const reminderEnabled = ref(localStorage.getItem('appointment-reminder-enabled') === 'true');
const latestReminder = ref<{ id: string; label: string } | null>(null);
const checkingAppointments = ref(false);
let knownPendingIds = new Set<string>();
let reminderReady = false;
let reminderTimer: number | undefined;
let audioContext: AudioContext | null = null;

const tabComponents: Record<TabKey, Component> = {
  members: MembersTab,
  levels: LevelsTab,
  catalogs: ProductCatalogsTab,
  recharges: RechargesTab,
  orders: OrdersTab,
  revenue: RevenueTab,
  appointments: AppointmentsTab,
  messages: MessagesTab,
  logs: LogsTab,
  pospal: PospalTab,
};

const tabTitles: Record<TabKey, { title: string; desc: string }> = {
  members: { title: '会员管理', desc: '管理会员档案、等级与备注' },
  levels: { title: '等级管理', desc: '调整会员等级门槛与折扣' },
  catalogs: { title: '产品库', desc: '管理美甲、饰品、鲜花展示内容' },
  recharges: { title: '充值', desc: '为顾客账户充值金额和积分' },
  orders: { title: '消费订单', desc: '查看与录入门店消费明细' },
  revenue: { title: '营收统计', desc: '按日与月份核对门店营业账目' },
  appointments: { title: '预约排期', desc: '日历视图查看到店预约' },
  messages: { title: '会员留言', desc: '查看顾客留言并及时回复' },
  logs: { title: '审计日志', desc: '追溯所有后台操作' },
  pospal: { title: '银豹连接', desc: '验证收银系统连接，核对会员余额和积分' },
};

const currentComponent = shallowRef<Component>(tabComponents.members);

watch(activeKey, (key) => {
  currentComponent.value = tabComponents[key];
});

function renderIcon(icon: Component): () => VNodeChild {
  return () => h(NIcon, null, { default: () => h(icon) });
}

function rightExtra(count: number | undefined): (() => VNodeChild) | undefined {
  if (!count) return undefined;
  return () =>
    h(NBadge, {
      value: count,
      max: 99,
      type: 'warning',
      style: 'margin-right: 6px;',
    });
}

const menuOptions = computed<MenuOption[]>(() => [
  { label: '会员管理', key: 'members', icon: renderIcon(Users) },
  { label: '等级管理', key: 'levels', icon: renderIcon(Layers) },
  { label: '产品库', key: 'catalogs', icon: renderIcon(PackageSearch) },
  { label: '充值', key: 'recharges', icon: renderIcon(Wallet) },
  { label: '消费订单', key: 'orders', icon: renderIcon(Receipt) },
  { label: '营收统计', key: 'revenue', icon: renderIcon(ChartNoAxesCombined) },
  {
    label: '预约排期',
    key: 'appointments',
    icon: renderIcon(CalendarDays),
    extra: rightExtra(pendingAppointmentCount.value),
  },
  { label: '会员留言', key: 'messages', icon: renderIcon(MessageSquareText), extra: rightExtra(memberMessages.value.length) },
  { label: '审计日志', key: 'logs', icon: renderIcon(History) },
  { label: '银豹连接', key: 'pospal', icon: renderIcon(Activity) },
].filter((item) => !pospalAccounts.value || !['levels', 'recharges', 'orders', 'revenue'].includes(String(item.key))));

const currentMeta = computed(() => tabTitles[activeKey.value]);

async function refresh() {
  await loadAll();
  if (!error.value) {
    message.success('数据已刷新', { duration: 1200 });
  }
}

async function toggleAppointmentReminder() {
  if (reminderEnabled.value) {
    reminderEnabled.value = false;
    localStorage.removeItem('appointment-reminder-enabled');
    message.info('新预约提醒已关闭');
    return;
  }

  audioContext ||= new AudioContext();
  void audioContext.resume();

  reminderEnabled.value = true;
  localStorage.setItem('appointment-reminder-enabled', 'true');
  message.success('新预约提醒已开启');

  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission().then((permission) => {
      if (permission !== 'granted') {
        message.info('系统通知未授权，站内提醒和提示音仍然有效');
      }
    });
  }
}

async function checkNewAppointments() {
  if (checkingAppointments.value) return;
  checkingAppointments.value = true;
  try {
    await refreshAppointments();
    await refreshMemberMessages('unread');
    const pending = appointments.value.filter((item) => item.status === 'PENDING');
    const nextIds = new Set(pending.map((item) => item.id));
    if (reminderReady && reminderEnabled.value) {
      pending
        .filter((item) => !knownPendingIds.has(item.id))
        .forEach(notifyNewAppointment);
    }
    knownPendingIds = nextIds;
    reminderReady = true;
  } finally {
    checkingAppointments.value = false;
  }
}

function notifyNewAppointment(item: (typeof appointments.value)[number]) {
  const businessName = {
    NAIL: '美甲',
    ACCESSORY: '饰品',
    FLOWER: '鲜花',
  }[item.businessType];
  const productText = item.productName ? ` · ${item.productName}` : '';
  const summary = `${businessName}${productText}，${item.appointmentDate} ${item.startTime}`;
  latestReminder.value = {
    id: item.id,
    label: `新预约：${item.memberNickname}`,
  };

  message.warning(`新预约：${item.memberNickname}，${summary}`, {
    duration: 10000,
    closable: true,
  });
  playReminderSound();

  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('Moonisle 收到新预约', {
      body: `${item.memberNickname}：${summary}`,
      tag: item.id,
    });
    notification.onclick = () => {
      window.focus();
      activeKey.value = 'appointments';
      notification.close();
    };
  }
}

function openLatestAppointment() {
  activeKey.value = 'appointments';
  latestReminder.value = null;
}

function playReminderSound() {
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gain.gain.setValueAtTime(0.12, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.22);
  } catch {
    // 站内提醒仍然可用。
  }
}

function confirmLogout() {
  dialog.warning({
    title: '退出登录',
    content: '确定要退出当前会话吗？',
    positiveText: '退出',
    negativeText: '取消',
    onPositiveClick: () => {
      logout();
      message.info('已退出登录');
    },
  });
}

watch(error, (msg) => {
  if (msg) message.error(msg, { duration: 4000 });
});

onMounted(async () => {
  await loadAll();
  await refreshMemberMessages('unread');
  knownPendingIds = new Set(
    appointments.value.filter((item) => item.status === 'PENDING').map((item) => item.id),
  );
  reminderReady = true;
  reminderTimer = window.setInterval(() => {
    void checkNewAppointments();
  }, 10000);
});

onBeforeUnmount(() => {
  if (reminderTimer !== undefined) {
    window.clearInterval(reminderTimer);
  }
  void audioContext?.close();
});

// ICP / 公安备案号（从 .env 读取）
const rawIcpRecord = (import.meta.env.VITE_ICP_RECORD as string | undefined)?.trim();
const icpRecord = rawIcpRecord && !/X{4,}|请填写|示例/i.test(rawIcpRecord) ? rawIcpRecord : undefined;
const publicSecurityRecord = import.meta.env.VITE_PUBLIC_SECURITY_RECORD as string | undefined;
const publicSecurityLink = import.meta.env.VITE_PUBLIC_SECURITY_LINK as string | undefined;
</script>

<template>
  <NLayout class="admin-layout" has-sider>
    <NLayoutSider
      bordered
      :collapsed="collapsed"
      :collapsed-width="68"
      :width="220"
      collapse-mode="width"
      :show-trigger="false"
      class="admin-sider"
    >
      <div class="sider-brand" :class="{ 'is-collapsed': collapsed }">
        <div class="brand-mark">M</div>
        <transition name="fade">
          <div v-if="!collapsed" class="brand-text">
            <strong>Moonisle</strong>
            <small>Admin v1</small>
          </div>
        </transition>
      </div>

      <NMenu
        :value="activeKey"
        :options="menuOptions"
        :collapsed="collapsed"
        :collapsed-width="68"
        :collapsed-icon-size="20"
        :indent="18"
        :root-indent="14"
        class="admin-menu"
        @update:value="(v: TabKey) => (activeKey = v)"
      />

      <div class="sider-footer">
        <NTooltip placement="right" :show="collapsed ? undefined : false">
          <template #trigger>
            <NButton
              quaternary
              block
              :focusable="false"
              class="collapse-btn"
              @click="collapsed = !collapsed"
            >
              <template #icon>
                <NIcon>
                  <component :is="collapsed ? ChevronsRight : ChevronsLeft" />
                </NIcon>
              </template>
              <span v-if="!collapsed">收起边栏</span>
            </NButton>
          </template>
          展开边栏
        </NTooltip>
      </div>
    </NLayoutSider>

    <NLayout class="admin-main" content-style="display: flex; flex-direction: column; height: 100%;">
      <NLayoutHeader bordered class="admin-header">
        <div class="header-title">
          <h1>{{ currentMeta.title }}</h1>
          <p>{{ currentMeta.desc }}</p>
        </div>

        <NSpace :size="10" align="center">
          <NButton
            v-if="latestReminder"
            size="small"
            type="warning"
            secondary
            @click="openLatestAppointment"
          >
            <template #icon>
              <NIcon><BellRing /></NIcon>
            </template>
            {{ latestReminder.label }}
          </NButton>
          <NButton
            size="small"
            :type="reminderEnabled ? 'primary' : 'default'"
            :secondary="reminderEnabled"
            @click="toggleAppointmentReminder"
          >
            <template #icon>
              <NIcon>
                <BellRing v-if="reminderEnabled" />
                <Bell v-else />
              </NIcon>
            </template>
            {{ reminderEnabled ? '提醒已开启' : '预约提醒' }}
          </NButton>
          <NButton :loading="loading" size="small" secondary @click="refresh">
            <template #icon>
              <NIcon><RefreshCw /></NIcon>
            </template>
            刷新
          </NButton>
          <NButton size="small" quaternary @click="confirmLogout">
            <template #icon>
              <NIcon><LogOut /></NIcon>
            </template>
            退出
          </NButton>
        </NSpace>
      </NLayoutHeader>

      <NLayoutContent class="admin-content" :native-scrollbar="false">
        <div class="content-inner">
          <NSpin :show="loading" description="正在加载数据">
            <component :is="currentComponent" />
          </NSpin>

          <footer class="site-footer">
            <span>
              <NIcon style="vertical-align: -3px"><Activity :size="14" /></NIcon>
              © {{ new Date().getFullYear() }} Moonisle
            </span>
            <a v-if="icpRecord" href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer noopener">
              {{ icpRecord }}
            </a>
            <a
              v-if="publicSecurityRecord"
              :href="publicSecurityLink || 'https://beian.mps.gov.cn/'"
              target="_blank"
              rel="noreferrer noopener"
            >
              {{ publicSecurityRecord }}
            </a>
          </footer>
        </div>
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>

<style scoped>
.admin-layout {
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}

.admin-sider {
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.admin-sider :deep(.n-layout-sider-scroll-container) {
  display: flex;
  flex-direction: column;
  padding: 16px 12px 12px;
}

.sider-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px 22px 8px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 14px;
  transition: padding 0.2s;
}

.sider-brand.is-collapsed {
  justify-content: center;
  padding: 6px 0 22px 0;
}

.brand-mark {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #d8514f, #a93432);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -1px;
  box-shadow: 0 6px 14px -6px rgba(216, 81, 79, 0.5);
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.brand-text strong {
  font-size: 15px;
  color: var(--color-text);
}

.brand-text small {
  font-size: 11px;
  color: var(--color-text-muted);
}

.admin-menu {
  flex: 1;
}

.sider-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.collapse-btn {
  justify-content: flex-start;
  color: var(--color-text-muted);
}

.admin-header {
  flex: 0 0 auto;
  z-index: 10;
  padding: 16px 28px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  background: #fff;
}

.header-title h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.2px;
}

.header-title p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.admin-content {
  flex: 1 1 auto;
  min-height: 0;
  background: var(--color-bg);
}

.admin-main {
  height: 100%;
  min-width: 0;
}

.content-inner {
  min-width: 0;
  padding: 24px 28px 16px;
  max-width: 1480px;
  margin: 0 auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .admin-header {
    padding: 14px 16px;
    flex-direction: column;
    align-items: stretch;
  }
  .content-inner {
    padding: 16px;
  }
}
</style>
