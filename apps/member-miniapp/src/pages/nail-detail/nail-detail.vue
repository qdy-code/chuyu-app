<template>
  <view class="detail-page detail-theme">
    <view v-if="loading" class="loading-state">
      <view class="skeleton-image" /><view class="skeleton-line" /><view class="skeleton-line short" />
      <text class="state-copy">正在加载作品…</text>
    </view>
    <view v-else-if="error || !product" class="empty-state">
      <text class="state-kicker">MOONISLE</text>
      <text class="state-title">{{ error ? '暂时无法加载作品' : '这款作品暂不可预约' }}</text>
      <text class="state-copy">{{ error || '作品不存在或已下架，可以返回作品库继续浏览。' }}</text>
      <button v-if="error" class="state-button" hover-class="state-pressed" @click="loadProduct">重新加载</button>
      <button class="back-button" hover-class="state-pressed" @click="backToCatalog">返回作品库</button>
    </view>
    <view v-else class="loaded-content">
      <ProductGallery :images="product.images" appearance="detail" @preview-start="imagePreview.start" @preview-failed="imagePreview.cancel" />
      <ProductDetailContent :product="product" />
      <ProductActionBar :product="product" :busy="booking" @book="openAppointment" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import type { CatalogProduct } from '@member-platform/shared';
import ProductGallery from '@/components/ProductGallery.vue';
import ProductDetailContent from '@/components/ProductDetailContent.vue';
import ProductActionBar from '@/components/ProductActionBar.vue';
import { listCatalogProducts } from '@/utils/api';
import { ensureReadyMemberAccess } from '@/utils/member';
import { rememberBooking, resumePendingBooking } from '@/utils/booking-flow';
import { createImagePreviewReturnGuard } from '@/utils/image-preview-return';

const productId = ref('');
const product = ref<CatalogProduct | null>(null);
const loading = ref(true);
const error = ref('');
const booking = ref(false);
const imagePreview = createImagePreviewReturnGuard();
let revision = 0;
let disposed = false;

async function loadProduct() {
  const request = ++revision;
  error.value = '';
  product.value = null;
  if (!productId.value) { loading.value = false; return; }
  loading.value = true;
  try {
    const products = await listCatalogProducts('NAIL');
    if (disposed || request !== revision) return;
    product.value = products.find(item => item.id === productId.value && item.businessType === 'NAIL' && item.isActive !== false) || null;
  } catch {
    if (!disposed && request === revision) error.value = '网络连接不稳定，请重试。';
  } finally {
    if (!disposed && request === revision) loading.value = false;
  }
}

async function openAppointment() {
  if (booking.value || !product.value || loading.value || error.value) return;
  booking.value = true;
  const intent = { businessType: 'NAIL' as const, product: product.value };
  try {
    if (!(await ensureReadyMemberAccess(() => rememberBooking(intent)))) return;
    if (disposed) return;
    rememberBooking(intent);
    resumePendingBooking();
  } finally { booking.value = false; }
}

function backToCatalog() {
  if (getCurrentPages().length > 1) uni.navigateBack();
  else uni.switchTab({ url: '/pages/nail/nail' });
}

onLoad((options) => { productId.value = typeof options?.id === 'string' ? options.id : ''; });
onShow(() => { if (!imagePreview.consumeReturn()) return loadProduct(); });
onUnload(() => { disposed = true; revision++; });
</script>

<style>
@import '@/styles/product-detail.css';
</style>
<style scoped>
.detail-page { min-height: 100vh; padding-top: 16px; padding-bottom: calc(96px + env(safe-area-inset-bottom)); box-sizing: border-box; }
.loaded-content { animation: detail-reveal var(--detail-change) ease-out; }
.loading-state { padding: 16px 24px; }
.skeleton-image { height: 80vw; max-height: 480px; background: var(--detail-subtle); border-radius: var(--detail-radius); }
.skeleton-line { height: 24px; margin-top: 24px; background: var(--detail-subtle); border-radius: 8px; }
.skeleton-line.short { width: 55%; height: 16px; margin-top: 16px; }
.empty-state { padding: 64px 24px; }
.state-kicker { font-size: 12px; letter-spacing: 2px; color: var(--detail-muted); }
.state-title { display: block; margin-top: 16px; font-size: 24px; font-weight: 600; line-height: 1.5; }
.state-copy { display: block; margin-top: 16px; font-size: 16px; color: var(--detail-muted); line-height: 1.8; }
.state-button, .back-button { min-height: 48px; margin: 24px 0 0; padding: 12px 16px; font-size: 16px; line-height: 1.5; border-radius: 12px; }
.state-button { color: var(--detail-on-primary); background: var(--detail-primary); }
.back-button { color: var(--detail-text); background: var(--detail-subtle); }
.state-button::after, .back-button::after { border: 0; }
.state-pressed { opacity: .7; }
@keyframes detail-reveal { from { opacity: .5; } to { opacity: 1; } }
</style>
