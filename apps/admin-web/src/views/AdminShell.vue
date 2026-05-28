<script setup lang="ts">
import { computed, h, onMounted, ref, shallowRef, watch } from 'vue';
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
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useDataStore } from '@/composables/useDataStore';

import MembersTab from './tabs/MembersTab.vue';
import LevelsTab from './tabs/LevelsTab.vue';
import RechargesTab from './tabs/RechargesTab.vue';
import OrdersTab from './tabs/OrdersTab.vue';
import AppointmentsTab from './tabs/AppointmentsTab.vue';
import LogsTab from './tabs/LogsTab.vue';

type TabKey = 'members' | 'levels' | 'recharges' | 'orders' | 'appointments' | 'logs';

const { logout } = useAuth();
const { loadAll, loading, error, pendingAppointmentCount, pendingRechargeCount } = useDataStore();
const message = useMessage();
const dialog = useDialog();

const activeKey = ref<TabKey>('members');
const collapsed = ref(false);

const tabComponents: Record<TabKey, Component> = {
  members: MembersTab,
  levels: LevelsTab,
  recharges: RechargesTab,
  orders: OrdersTab,
  appointments: AppointmentsTab,
  logs: LogsTab,
};

const tabTitles: Record<TabKey, { title: string; desc: string }> = {
  members: { title: '会员管理', desc: '管理会员档案、等级与备注' },
  levels: { title: '等级管理', desc: '调整会员等级门槛与折扣' },
  recharges: { title: '充值审核', desc: '处理会员充值申请，确认到账' },
  orders: { title: '消费订单', desc: '查看与录入门店消费明细' },
  appointments: { title: '预约排期', desc: '日历视图查看到店预约' },
  logs: { title: '审计日志', desc: '追溯所有后台操作' },
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
  {
    label: '充值审核',
    key: 'recharges',
    icon: renderIcon(Wallet),
    extra: rightExtra(pendingRechargeCount.value),
  },
  { label: '消费订单', key: 'orders', icon: renderIcon(Receipt) },
  {
    label: '预约排期',
    key: 'appointments',
    icon: renderIcon(CalendarDays),
    extra: rightExtra(pendingAppointmentCount.value),
  },
  { label: '审计日志', key: 'logs', icon: renderIcon(History) },
]);

const currentMeta = computed(() => tabTitles[activeKey.value]);

async function refresh() {
  await loadAll();
  if (!error.value) {
    message.success('数据已刷新', { duration: 1200 });
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

onMounted(loadAll);

// ICP / 公安备案号（从 .env 读取）
const icpRecord = import.meta.env.VITE_ICP_RECORD as string | undefined;
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
        <div class="brand-mark">初</div>
        <transition name="fade">
          <div v-if="!collapsed" class="brand-text">
            <strong>初屿会员</strong>
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

    <NLayout class="admin-main">
      <NLayoutHeader bordered class="admin-header">
        <div class="header-title">
          <h1>{{ currentMeta.title }}</h1>
          <p>{{ currentMeta.desc }}</p>
        </div>

        <NSpace :size="10" align="center">
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
              © {{ new Date().getFullYear() }} 初屿会员
            </span>
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer noopener">
              {{ icpRecord || '皖ICP备2026004340号' }}
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
  min-height: 100vh;
}

.admin-sider {
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
  background: var(--color-bg);
}

.content-inner {
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
