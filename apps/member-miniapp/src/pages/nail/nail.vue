<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view class="hero">
      <text class="eyebrow">MOONISLE</text>
      <text class="title">美甲作品库</text>
      <text class="desc">月光色、低饱和、清透质感，到店完成专属款式。</text>
      <button class="primary-btn" @click="openAppointment()">预约到店</button>
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
    <view v-else-if="products.length === 0" class="empty">暂时没有上架作品</view>
    <view v-else class="product-list">
      <view v-for="item in products" :key="item.id" class="product-card">
        <image
          class="product-image"
          :src="imageSrc(item)"
          mode="aspectFill"
          @click="previewProductImage(item)"
        />
        <view class="product-body">
          <view>
            <text class="product-name">{{ item.name }}</text>
            <text class="product-desc">{{ item.description || '到店沟通款式细节' }}</text>
          </view>
          <view class="product-foot">
            <text class="price">{{ priceText(item.referencePrice) }}</text>
            <button class="reserve-btn" @click="openAppointment(item)">预约此款</button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { CatalogProduct, ProductCategory } from '@member-platform/shared';
import { listCatalogCategories, listCatalogProducts } from '@/utils/api';
import { resolveImageForDisplay } from '@/utils/image-cache';
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
const imageSources = ref<Record<string, string>>({});

async function loadCatalog() {
  loading.value = true;
  try {
    const [categoryList, productList] = await Promise.all([
      listCatalogCategories('NAIL'),
      listCatalogProducts('NAIL', selectedCategoryId.value || undefined),
    ]);
    categories.value = categoryList;
    products.value = productList;
    await cacheProductImages(productList);
  } catch (error) {
    categories.value = fallbackEnabled ? fallbackCategories : [];
    products.value = fallbackEnabled
      ? fallbackProducts.filter((item) => !selectedCategoryId.value || item.categoryId === selectedCategoryId.value)
      : [];
    imageSources.value = {};
    uni.showToast({ title: (error instanceof Error ? error.message : '加载失败').slice(0, 18), icon: 'none' });
  } finally {
    loading.value = false;
  }
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

function imageSrc(item: CatalogProduct): string {
  return imageSources.value[item.id] || '/static/brand/member-card-bg.jpg';
}

function previewProductImage(item: CatalogProduct) {
  const current = imageSrc(item);
  uni.previewImage({
    current,
    urls: [current],
    fail: () => uni.showToast({ title: '图片预览失败', icon: 'none' }),
  });
}

async function cacheProductImages(items: CatalogProduct[]) {
  const entries = await Promise.all(
    items.map(async (item) => [
      item.id,
      await resolveImageForDisplay(item.images[0], '/static/brand/member-card-bg.jpg'),
    ] as const),
  );
  imageSources.value = Object.fromEntries(entries);
}

function priceText(value?: number): string {
  return value === undefined ? '参考价到店确认' : `参考价 ¥${Number(value).toFixed(0)}`;
}

onShow(loadCatalog);
</script>

<style scoped>
.page {
  position: relative;
  min-height: 100vh;
  padding: 28rpx 24rpx 48rpx;
  background: #f7f4ef;
}

.page-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

.hero,
.category-scroll,
.product-list,
.empty {
  position: relative;
  z-index: 1;
}

.hero {
  overflow: hidden;
  border-radius: 32rpx;
  padding: 42rpx 36rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18rpx 54rpx rgba(31, 41, 55, 0.08);
}

.eyebrow {
  color: #72818d;
  font-size: 22rpx;
  font-weight: 900;
}

.title {
  display: block;
  margin-top: 12rpx;
  color: #111827;
  font-size: 48rpx;
  font-weight: 900;
}

.desc {
  display: block;
  margin-top: 14rpx;
  max-width: 560rpx;
  color: #667085;
  font-size: 27rpx;
  line-height: 1.55;
}

.primary-btn {
  margin: 30rpx 0 0;
  width: 220rpx;
  border-radius: 999rpx;
  background: #3d4652;
  color: #f7f4ef;
  font-weight: 900;
}

.category-scroll {
  margin-top: 24rpx;
  white-space: nowrap;
}

.category-row {
  display: flex;
  gap: 14rpx;
  padding-bottom: 4rpx;
}

.category-chip {
  margin: 0;
  min-width: 132rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.84);
  color: #667085;
  font-size: 25rpx;
}

.category-chip.active {
  background: #3d4652;
  color: #f7f4ef;
}

.product-list {
  margin-top: 22rpx;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.product-card {
  overflow: hidden;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 16rpx 48rpx rgba(31, 41, 55, 0.08);
}

.product-image {
  width: 100%;
  height: 360rpx;
  display: block;
}

.product-body {
  padding: 26rpx;
}

.product-name {
  display: block;
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}

.product-desc {
  display: block;
  margin-top: 10rpx;
  color: #667085;
  font-size: 25rpx;
  line-height: 1.5;
}

.product-foot {
  margin-top: 22rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.price {
  color: #3d4652;
  font-size: 26rpx;
  font-weight: 900;
}

.reserve-btn {
  margin: 0;
  min-width: 148rpx;
  border-radius: 999rpx;
  background: #edf2f4;
  color: #3d4652;
  font-size: 25rpx;
  font-weight: 900;
}

.empty {
  margin-top: 28rpx;
  padding: 42rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.86);
  color: #667085;
  text-align: center;
}
</style>
