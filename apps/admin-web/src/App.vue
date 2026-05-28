<script setup lang="ts">
import { computed } from 'vue';
import {
  NConfigProvider,
  NDialogProvider,
  NLoadingBarProvider,
  NMessageProvider,
  NNotificationProvider,
  zhCN,
  dateZhCN,
} from 'naive-ui';
import { themeOverrides } from '@/theme';
import { useAuth } from '@/composables/useAuth';
import LoginView from '@/views/LoginView.vue';
import AdminShell from '@/views/AdminShell.vue';

const { isLoggedIn } = useAuth();

const currentView = computed(() => (isLoggedIn.value ? AdminShell : LoginView));
</script>

<template>
  <NConfigProvider
    :theme-overrides="themeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
    inline-theme-disabled
  >
    <NLoadingBarProvider>
      <NDialogProvider>
        <NMessageProvider>
          <NNotificationProvider>
            <component :is="currentView" />
          </NNotificationProvider>
        </NMessageProvider>
      </NDialogProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
