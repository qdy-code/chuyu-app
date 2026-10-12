<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view class="header-card">
      <text class="eyebrow">MOONISLE</text>
      <text class="title">收藏与款式</text>
      <text class="desc">留下喜欢的作品，也回顾做过的美甲。</text>
    </view>
    <view class="tabs">
      <button :class="{ active: tab === 'favorites' }" @click="selectTab('favorites')">我的收藏</button>
      <button :class="{ active: tab === 'history' }" @click="selectTab('history')">做过的美甲</button>
    </view>
    <view v-if="!sessionState.userId || !sessionState.token" class="card state">
      <text>登录后查看自己的收藏与款式记录</text>
      <button class="primary" @click="login">登录查看</button>
    </view>
    <template v-else-if="tab === 'favorites'">
      <text class="note">收藏保存在当前设备，按会员账户区分；清除小程序缓存后会丢失。</text>
      <view v-if="favoriteStorageError" class="card state">
        <text>{{ favoriteStorageError }}</text><button class="primary" @click="restoreFavorites">重新读取</button>
      </view>
      <template v-else>
        <view class="filters">
          <button v-for="filter in filters" :key="filter.type" :class="{ active: business === filter.type }" @click="business = filter.type">{{ filter.label }}</button>
        </view>
        <view v-if="visibleFavorites.length === 0" class="card state">
          <text>还没有{{ business ? businessText(business) : '' }}收藏</text>
          <text class="desc">在作品或商品卡片上点击“收藏”，下次就能在这里找到。</text>
          <button class="primary" @click="browse(business || 'NAIL')">去看看</button>
        </view>
        <view v-for="item in visibleFavorites" :key="favoriteKey(item)" class="card product-card">
          <ProductGallery :images="currentProduct(item)?.images || item.images" @preview-start="imagePreview.start" @preview-failed="imagePreview.cancel" />
          <view class="body">
            <text class="eyebrow">{{ businessText(item.businessType) }}</text>
            <text class="name">{{ currentProduct(item)?.name || item.name }}</text>
            <text v-if="catalogLoading" class="desc">正在核对最新商品...</text>
            <view v-else-if="catalogErrors[item.businessType]">
              <text class="desc">商品状态暂未更新，请重试。</text>
              <button class="secondary" @click="loadCatalog">重新查询</button>
            </view>
            <text v-else-if="!currentProduct(item)" class="desc">已下架或暂不可预约，收藏仍为你保留。</text>
            <text v-else class="desc">{{ referencePriceText(currentProduct(item)?.referencePrice) }} · 价格与服务细节请与门店确认</text>
            <view class="actions">
              <FavoriteButton :product="item" />
              <button class="primary" :disabled="repeating || catalogLoading || !!catalogErrors[item.businessType] || !currentProduct(item)" @click="repeatBooking({ businessType: item.businessType, productId: item.id })">{{ item.businessType === 'NAIL' ? '预约此款' : '预约到店' }}</button>
            </view>
          </view>
        </view>
      </template>
    </template>
    <template v-else>
      <text class="note">来自已完成的美甲预约，图片为所选款式参考，并非实际完成效果。</text>
      <view v-if="loading" class="card state">正在加载款式记录...</view>
      <view v-else-if="errorMessage" class="card state"><text>{{ errorMessage }}</text><button class="primary" @click="refreshHistory">重新加载</button></view>
      <view v-else-if="loaded && history.length === 0" class="card state">
        <text>暂无已完成的美甲预约</text>
        <text class="desc">门店完成预约后，可在这里回顾所选款式并再次预约。</text>
        <button class="primary" @click="browse('NAIL')">看看美甲作品</button>
      </view>
      <view v-for="item in history" :key="item.id" class="card product-card">
        <ProductGallery v-if="item.productImages?.length" :images="item.productImages" @preview-start="imagePreview.start" @preview-failed="imagePreview.cancel" />
        <view class="body">
          <text class="eyebrow">{{ item.appointmentDate }} · 服务已完成</text>
          <text class="name">{{ item.productName || '到店沟通款式' }}</text>
          <text class="desc">{{ item.productId ? '所选款式参考，重新预约时将核对最新作品。' : '该次未选款式，再次预约仍可到店沟通。' }}</text>
          <view class="actions">
            <button class="secondary" @click="openConsumptions">查看消费记录</button>
            <button class="primary" :disabled="repeating" @click="repeatBooking(item)">再次预约</button>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import type { BusinessType, CatalogProduct } from '@member-platform/shared';
import FavoriteButton from '@/components/FavoriteButton.vue';
import ProductGallery from '@/components/ProductGallery.vue';
import { sessionState, restoreSession } from '@/store/session';
import { listCatalogProducts, listMyAppointments } from '@/utils/api';
import { ensureReadyMemberAccess } from '@/utils/member';
import { favoriteKey, favoriteProducts, favoriteStorageError, restoreFavorites } from '@/utils/favorite-products';
import type { FavoriteProduct } from '@/utils/favorite-products';
import { completedNailAppointments, useRepeatBooking } from '@/utils/repeat-booking';
import { useMemberRecords } from '@/utils/use-member-records';
import { referencePriceText } from '@/utils/catalog-display';
import { createImagePreviewReturnGuard } from '@/utils/image-preview-return';

const tab = ref<'favorites' | 'history'>('favorites');
const business = ref<BusinessType | ''>('');
const filters: { type: BusinessType | ''; label: string }[] = [{ type: '', label: '全部' }, { type: 'NAIL', label: '美甲' }, { type: 'ACCESSORY', label: '饰品' }, { type: 'FLOWER', label: '鲜花' }];
const businesses: BusinessType[] = ['NAIL', 'ACCESSORY', 'FLOWER'];
const catalog = ref<CatalogProduct[]>([]);
const catalogLoading = ref(false);
const catalogErrors = ref<Partial<Record<BusinessType, boolean>>>({});
let catalogRevision = 0;
const imagePreview = createImagePreviewReturnGuard();
const { repeating, repeatBooking } = useRepeatBooking();
const { records, loading, loaded, errorMessage, refresh: refreshHistory } = useMemberRecords(listMyAppointments);
const history = computed(() => completedNailAppointments(records.value));
const visibleFavorites = computed(() => favoriteProducts.value.filter(item => !business.value || item.businessType === business.value));
watch(() => [sessionState.userId, sessionState.token], () => {
  catalogRevision++;
  catalog.value = []; catalogLoading.value = false; catalogErrors.value = {};
}, { flush: 'sync' });
function businessText(type: BusinessType) { return { NAIL: '美甲', ACCESSORY: '饰品', FLOWER: '鲜花' }[type]; }
function currentProduct(item: FavoriteProduct) {
  return catalog.value.find(product => favoriteKey(product) === favoriteKey(item) && product.isActive !== false &&
    (!product.reservedByUserId || product.reservedByUserId === sessionState.userId));
}
async function loadCatalog() {
  const revision = ++catalogRevision;
  catalogLoading.value = true;
  catalogErrors.value = {};
  catalog.value = [];
  const results = await Promise.allSettled(businesses.map(type => listCatalogProducts(type)));
  if (revision !== catalogRevision) return;
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') catalog.value.push(...result.value);
    else catalogErrors.value[businesses[index]] = true;
  });
  catalogLoading.value = false;
}
async function selectTab(value: 'favorites' | 'history') {
  tab.value = value;
  if (value === 'history' && sessionState.userId) await refreshHistory();
}
function browse(type: BusinessType) {
  const page = { NAIL: 'nail', ACCESSORY: 'accessory', FLOWER: 'flower' }[type];
  uni.switchTab({ url: `/pages/${page}/${page}` });
}
function openConsumptions() { uni.navigateTo({ url: '/pages/consumptions/consumptions' }); }
async function login() { if (await ensureReadyMemberAccess()) await refreshPage(); }
async function refreshPage() {
  restoreSession(); restoreFavorites();
  if (!sessionState.userId || !sessionState.token) return;
  if (tab.value === 'favorites') await loadCatalog();
  else await refreshHistory();
}
onShow(() => { if (!imagePreview.consumeReturn()) return refreshPage(); });
</script>

<style scoped>
.page { position: relative; min-height: 100vh; padding: 28rpx 24rpx 48rpx; background: #f7f4ef; }
.page-bg { position: fixed; inset: 0; z-index: 0; width: 100vw; height: 100vh; pointer-events: none; }
.page > view, .page > text { position: relative; z-index: 1; }
.header-card, .card { border-radius: 30rpx; background: rgba(255,255,255,.94); box-shadow: 0 12rpx 38rpx rgba(31,41,55,.06); }
.header-card, .body, .state { padding: 30rpx; }
.eyebrow { display: block; color: #72818d; font-size: 23rpx; }
.title { display: block; margin-top: 12rpx; color: #111827; font-size: 42rpx; font-weight: 900; }
.name { display: block; margin-top: 10rpx; color: #344054; font-size: 32rpx; font-weight: 900; }
.desc, .note { display: block; color: #667085; font-size: 25rpx; line-height: 1.6; margin-top: 14rpx; }
.note { position: relative; z-index: 1; margin: 20rpx 6rpx; }
.tabs, .filters, .actions { display: flex; gap: 14rpx; margin-top: 20rpx; }
.tabs button, .filters button { flex: 1; margin: 0; padding: 0 12rpx; line-height: 2.8; border-radius: 999rpx; background: rgba(255,255,255,.9); color: #667085; font-size: 26rpx; }
.tabs button.active, .filters button.active { background: #3d4652; color: #f7f4ef; }
.primary, .secondary { margin: 0; padding: 0 26rpx; line-height: 2.8; border-radius: 999rpx; font-size: 25rpx; background: #3d4652; color: #f7f4ef; }
.primary[disabled] { opacity: .45; background: #3d4652; color: #f7f4ef; }
.secondary { background: #edf2f4; color: #667085; }
button::after { border: 0; }
.card { margin-top: 20rpx; }
.product-card { overflow: hidden; }
.actions { justify-content: space-between; align-items: center; flex-wrap: wrap; }
.state { color: #667085; font-size: 28rpx; line-height: 1.6; }
.state .primary { margin-top: 24rpx; }
</style>
