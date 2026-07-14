<script setup lang="ts">
import { ref } from 'vue';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NAlert,
  NSpace,
  useMessage,
} from 'naive-ui';
import { LockKeyhole, ShieldCheck } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';

const { authError, login } = useAuth();
const message = useMessage();

const password = ref('');
const loading = ref(false);

async function handleLogin() {
  if (!password.value.trim()) {
    message.warning('请输入管理密码');
    return;
  }
  loading.value = true;
  try {
    await login(password.value);
    password.value = '';
  } catch (error) {
    message.error(error instanceof Error ? error.message : '登录失败，请重试');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-art" aria-hidden="true">
      <div class="login-art-orb orb-1" />
      <div class="login-art-orb orb-2" />
      <div class="login-art-grid" />
    </div>

    <NCard class="login-card" :bordered="false">
      <div class="login-brand">
        <div class="brand-mark">
          <ShieldCheck :size="22" />
        </div>
        <div>
          <h1 class="brand-title">月光石屿 · 管理后台</h1>
          <p class="brand-subtitle">门店运营、会员维护、预约排期</p>
        </div>
      </div>

      <NAlert v-if="authError" type="warning" :show-icon="false" class="login-alert">
        {{ authError }}
      </NAlert>

      <NForm @submit.prevent="handleLogin">
        <NFormItem label="管理密码" :show-feedback="false">
          <NInput
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="输入你的管理密码"
            size="large"
            :disabled="loading"
            @keyup.enter="handleLogin"
          >
            <template #prefix>
              <LockKeyhole :size="16" />
            </template>
          </NInput>
        </NFormItem>

        <NSpace vertical :size="12" class="login-actions">
          <NButton
            type="primary"
            size="large"
            block
            :loading="loading"
            @click="handleLogin"
          >
            登录
          </NButton>
          <p class="login-hint">仅限运营人员使用 · 请妥善保管密码</p>
        </NSpace>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  overflow: hidden;
  background: linear-gradient(180deg, #fdf8f3 0%, #faf6ef 60%, #f7f4ed 100%);
}

.login-art {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.login-art-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.55;
}

.orb-1 {
  width: 480px;
  height: 480px;
  top: -180px;
  right: -120px;
  background: radial-gradient(circle at 30% 30%, #f3b0ad, transparent 70%);
}

.orb-2 {
  width: 360px;
  height: 360px;
  bottom: -140px;
  left: -100px;
  background: radial-gradient(circle at 60% 40%, #e9d4bf, transparent 70%);
}

.login-art-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(31, 29, 27, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(31, 29, 27, 0.04) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(circle at 50% 40%, #000 0%, transparent 65%);
}

.login-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  border-radius: 18px;
  box-shadow: 0 20px 60px -20px rgba(120, 60, 50, 0.25),
    0 4px 12px -4px rgba(0, 0, 0, 0.05);
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #d8514f, #a93432);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 18px -8px rgba(216, 81, 79, 0.6);
}

.brand-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.2px;
}

.brand-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.login-alert {
  margin-bottom: 14px;
}

.login-actions {
  margin-top: 6px;
}

.login-hint {
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
