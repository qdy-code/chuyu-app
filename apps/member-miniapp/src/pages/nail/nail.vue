<template>
  <view class="page detail-theme">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view class="hero">
      <text class="title">美甲作品</text>
      <button class="primary-btn" hover-class="detail-link-pressed" @click="openAppointment()">预约到店</button>
    </view>

    <scroll-view class="category-scroll" scroll-x>
      <view class="category-row">
        <button class="category-chip" :class="{ active: !selectedCategoryId }" @click="selectCategory('')">全部</button>
        <button
          v-for="item in categories"
          :key="item.id"
          class="category-chip"
          :class="{ active: selectedCategoryId === item.id }"
          @click="selectCategory(item.id)"
        >
          {{ item.name }}
        </button>
      </view>
    </scroll-view>

    <view v-if="loading" class="empty">正在加载作品...</view>
    <view v-else-if="catalogError" class="empty">
      <text>{{ catalogError }}</text>
      <button class="reserve-btn" @click="loadCatalog()">重新加载</button>
    </view>
    <view v-else-if="products.length === 0" class="empty">
      <text>暂时没有上架作品，可先预约到店沟通</text>
    </view>
    <view v-else class="product-list">
      <view v-for="item in products" :key="item.id" class="product-card">
        <ProductGallery :images="item.images" appearance="nail-list" @preview-start="imagePreview.start" @preview-failed="imagePreview.cancel" />
        <view class="product-body">
          <view class="product-heading">
            <text class="product-name" @click="openDetail(item)">{{ item.name }}</text>
            <text class="price">{{ productPriceText(item.referencePrice) }}</text>
          </view>
          <view class="product-actions">
            <button class="detail-link" hover-class="detail-link-pressed" @click="openDetail(item)">查看详情</button>
            <FavoriteButton :product="item" appearance="list" />
            <button class="reserve-btn" hover-class="detail-link-pressed" @click="openAppointment(item)">预约此款</button>
          </view>
        </view>
      </view>
    </view>
    <StoreContact appearance="compact" />
  </view>
</template>

<script setup lang="ts">
import ProductGallery from '@/components/ProductGallery.vue';
import FavoriteButton from '@/components/FavoriteButton.vue';
import { createImagePreviewReturnGuard } from '@/utils/image-preview-return';
import StoreContact from '@/components/StoreContact.vue';
import { productPriceText } from '@/utils/catalog-display';
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { CatalogProduct, ProductCategory } from '@member-platform/shared';
import { listCatalogCategories, listCatalogProducts } from '@/utils/api';
import { ensureReadyMemberAccess } from '@/utils/member';
import { rememberBooking, resumePendingBooking } from '@/utils/booking-flow';

const fallbackCategories: ProductCategory[] = [
  { id: 'local-nail-style', businessType: 'NAIL', name: '款式设计', sortOrder: 10, createdAt: '' },
  { id: 'local-nail-care', businessType: 'NAIL', name: '基础护理', sortOrder: 20, createdAt: '' },
];
const fallbackProducts: CatalogProduct[] = [
  {
    id: 'local-nail-001',
    businessType: 'NAIL',
    categoryId: 'local-nail-style',
    categoryName: '款式设计',
    name: '月光石晕染美甲',
    description: '低饱和月光色晕染，适合通勤和轻仪式场景。',
    referencePrice: 168,
    images: ['/static/brand/member-card-bg.jpg'],
    sortOrder: 10,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
];
const fallbackEnabled = import.meta.env.VITE_ENABLE_CATALOG_FALLBACK === 'true';
const categories = ref<ProductCategory[]>(fallbackEnabled ? fallbackCategories : []);
const products = ref<CatalogProduct[]>(fallbackEnabled ? fallbackProducts : []);
const selectedCategoryId = ref('');
const loading = ref(false);
const imagePreview = createImagePreviewReturnGuard();
const catalogError = ref('');
let catalogRevision = 0;
let detailReturnPending = false;
let openingDetail = false;

async function loadCatalog(preserveContent = false) {
  const request = ++catalogRevision;
  loading.value = !preserveContent;
  catalogError.value = '';
  try {
    const [categoryList, productList] = await Promise.all([
      listCatalogCategories('NAIL'),
      listCatalogProducts('NAIL', selectedCategoryId.value || undefined),
    ]);
    if (request !== catalogRevision) return;
    categories.value = categoryList;
    products.value = productList;
  } catch (error) {
    if (request !== catalogRevision) return;
    if (preserveContent) {
      uni.showToast({ title: '更新失败，暂保留当前作品', icon: 'none' });
      return;
    }
    categories.value = fallbackEnabled ? fallbackCategories : [];
    products.value = fallbackEnabled
      ? fallbackProducts.filter((item) => !selectedCategoryId.value || item.categoryId === selectedCategoryId.value)
      : [];
    catalogError.value = '内容加载失败，请重试';
    uni.showToast({ title: (error instanceof Error ? error.message : '加载失败').slice(0, 18), icon: 'none' });
  } finally {
    if (request === catalogRevision) loading.value = false;
  }
}

function openDetail(product: CatalogProduct) {
  if (openingDetail) return;
  openingDetail = true;
  uni.navigateTo({
    url: `/pages/nail-detail/nail-detail?id=${encodeURIComponent(product.id)}`,
    success: () => { detailReturnPending = true; },
    fail: () => { openingDetail = false; uni.showToast({ title: '详情打开失败，请重试', icon: 'none' }); },
  });
}

function selectCategory(id: string) {
  selectedCategoryId.value = id;
  void loadCatalog();
}

async function openAppointment(product?: CatalogProduct) {
  const intent = { businessType: 'NAIL' as const, product };
  if (!(await ensureReadyMemberAccess(() => rememberBooking(intent)))) return;
  rememberBooking(intent);
  resumePendingBooking();
}



onShow(() => {
  openingDetail = false;
  if (imagePreview.consumeReturn()) return;
  const preserveContent = detailReturnPending;
  detailReturnPending = false;
  return loadCatalog(preserveContent);
});
</script>

<style>
@import '@/styles/product-detail.css';
</style>
<style scoped>
.page { position: relative; min-height: 100vh; padding: 16px 12px 32px; background: #f7f4ef; box-sizing: border-box; }
.page-bg { position: fixed; inset: 0; z-index: 0; width: 100vw; height: 100vh; opacity: .35; pointer-events: none; }
.hero, .category-scroll, .product-list, .empty { position: relative; z-index: 1; }
.hero { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 4px; }
.title { color: var(--detail-text); font-size: 28px; font-weight: 600; line-height: 1.4; }
.primary-btn { margin: 0; padding: 12px 16px; min-height: 48px; border-radius: 12px; background: var(--detail-primary); color: var(--detail-on-primary); font-size: 14px; line-height: 24px; }
.primary-btn::after, .detail-link::after, .reserve-btn::after, .category-chip::after { border: 0; }
.category-scroll { margin-top: 16px; white-space: nowrap; }
.category-row { display: flex; gap: 8px; padding-bottom: 4px; }
.category-chip { min-width: 72px; min-height: 48px; margin: 0; padding: 12px 16px; border-radius: 24px; background: rgba(255,255,255,.84); color: var(--detail-muted); font-size: 14px; line-height: 24px; }
.category-chip.active { background: var(--detail-primary); color: var(--detail-on-primary); }
.product-list { margin-top: 16px; display: flex; flex-direction: column; gap: 24px; }
.product-card { overflow: hidden; border-radius: 16px; background: var(--detail-surface); }
.product-body { padding: 16px; }
.product-heading { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; }
.product-name { flex: 1; min-width: 120px; overflow-wrap: anywhere; color: var(--detail-text); font-size: 20px; font-weight: 600; line-height: 1.5; }
.price { color: var(--detail-primary); font-size: 16px; line-height: 1.5; white-space: nowrap; }
.product-actions { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
.detail-link { margin: 0 auto 0 0; padding: 12px 0; min-width: 72px; min-height: 48px; font-size: 14px; line-height: 24px; color: var(--detail-primary); background: transparent; }
.detail-link-pressed { opacity: .7; }
.reserve-btn { flex: 1; min-width: 88px; margin: 0; padding: 12px 12px; border-radius: 12px; background: var(--detail-primary); color: var(--detail-on-primary); font-size: 14px; line-height: 24px; }
.empty { margin-top: 24px; padding: 24px; border-radius: 16px; background: var(--detail-surface); color: var(--detail-muted); text-align: center; line-height: 1.7; }
.empty .reserve-btn { margin-top: 16px; }
</style>
