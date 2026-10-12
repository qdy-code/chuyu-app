<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view class="hero">
      <text class="eyebrow">CRYSTAL ACCESSORY</text>
      <text class="title">饰品产品库</text>
      <text class="desc">选择喜欢的饰品提交预留，后台确认后将为你保留。</text>
    </view>

    <BookingReceipt v-if="submittedAppointment" :appointment="submittedAppointment" />

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

    <view v-if="loading" class="empty">正在加载饰品...</view>
    <view v-else-if="products.length === 0" class="empty">暂无可预约饰品</view>
    <view v-else class="product-list">
      <view v-for="item in products" :key="item.id" class="product-card">
        <image
          class="product-image"
          :src="imageSrc(item)"
          mode="aspectFill"
          @click="previewProductImage(item)"
        />
        <view class="product-body">
          <text class="product-name">{{ item.name }}</text>
          <text class="product-desc">{{ item.description || '到店可试戴确认' }}</text>
          <view class="product-foot">
            <text class="price">{{ priceText(item.referencePrice) }}</text>
            <button class="reserve-btn" @click="openReserve(item)">预约预留</button>
          </view>
        </view>
      </view>
    </view>

    <view v-if="reserveProduct" class="modal-mask" @click="closeReserve">
      <view class="reserve-panel" @click.stop>
        <view class="panel-head">
          <view>
            <text class="eyebrow">饰品预约</text>
            <text class="panel-title">{{ reserveProduct.name }}</text>
          </view>
          <button class="close-btn" @click="closeReserve">×</button>
        </view>
        <picker mode="date" :start="today" :value="form.date" @change="onDateChange">
          <view class="field">
            <text class="label">到店日期</text>
            <text class="field-value">{{ form.date }}</text>
          </view>
        </picker>
        <text v-if="isDateUnavailable(form.date)" class="unavailable-note">当日预约已满，请选择其他日期</text>
        <picker mode="time" start="09:00" end="21:00" :value="form.time" @change="onTimeChange">
          <view class="field">
            <text class="label">到店时间</text>
            <text class="field-value">{{ form.time }}</text>
          </view>
        </picker>
        <view class="field">
          <text class="label">备注</text>
          <input v-model="form.remark" class="input" placeholder="可填写试戴或取货需求" />
        </view>
        <button class="submit" :disabled="submitting || isDateUnavailable(form.date)" @click="submitReserve">
          {{ submitting ? '提交中...' : '提交预约申请' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { sessionState } from '@/store/session';
import BookingReceipt from '@/components/BookingReceipt.vue';
import { rememberBooking, takePendingBooking } from '@/utils/booking-flow';
import type { BookingIntent } from '@/utils/booking-flow';
import { onShow } from '@dcloudio/uni-app';
import type { Appointment, AppointmentUnavailableDate, CatalogProduct, ProductCategory } from '@member-platform/shared';
import {
  createAppointment,
  listAppointmentUnavailableDates,
  listCatalogCategories,
  listCatalogProducts,
} from '@/utils/api';
import { resolveImageForDisplay } from '@/utils/image-cache';
import { ensureReadyMemberAccess } from '@/utils/member';
import { localDateKey as formatDate, nextAppointmentTime } from '@/utils/appointment-time';

const today = ref(formatDate(new Date()));
const fallbackCategories: ProductCategory[] = [
  { id: 'local-accessory-crystal', businessType: 'ACCESSORY', name: '水晶饰品', sortOrder: 10, createdAt: '' },
  { id: 'local-accessory-gift', businessType: 'ACCESSORY', name: '礼物小物', sortOrder: 20, createdAt: '' },
];
const fallbackProducts: CatalogProduct[] = [
  {
    id: 'local-accessory-001',
    businessType: 'ACCESSORY',
    categoryId: 'local-accessory-crystal',
    categoryName: '水晶饰品',
    name: '月光水晶手链',
    description: '清透冷光感水晶饰品，到店可试戴预留。',
    referencePrice: 128,
    images: ['/static/brand/account-header.jpg'],
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
const submitting = ref(false);
const submittedAppointment = ref<Appointment | null>(null);
watch(() => [sessionState.userId, sessionState.token], () => {
  submittedAppointment.value = null;
}, { flush: 'sync' });
const reserveProduct = ref<CatalogProduct | null>(null);
const unavailableDates = ref<AppointmentUnavailableDate[]>([]);
const form = ref({ date: today.value, time: '10:00', remark: '' });
const imageSources = ref<Record<string, string>>({});

async function loadCatalog() {
  loading.value = true;
  try {
    const [categoryList, productList] = await Promise.all([
      listCatalogCategories('ACCESSORY'),
      listCatalogProducts('ACCESSORY', selectedCategoryId.value || undefined),
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

async function openReserve(item: CatalogProduct, draft?: BookingIntent) {
  if (!(await ensureReadyMemberAccess(() => rememberBooking({ businessType: 'ACCESSORY', product: item, ...draft })))) return;
  today.value = formatDate(new Date());
  if (!(await loadUnavailableDates())) return;
  const slot = nextAppointmentTime(new Date(), unavailableDates.value.map((date) => date.appointmentDate));
  if (!slot) {
    uni.showToast({ title: '暂无可预约日期', icon: 'none' });
    return;
  }
  reserveProduct.value = item;
  form.value = draft?.date && draft.time && !isPast(draft.date, draft.time) && !isDateUnavailable(draft.date)
    ? { date: draft.date, time: draft.time, remark: draft.remark || '' }
    : { ...slot, remark: draft?.remark || '' };
}

function closeReserve() {
  if (!submitting.value) reserveProduct.value = null;
}

function onDateChange(event: { detail: { value: string } }) {
  const value = event.detail.value;
  if (isDateUnavailable(value)) {
    uni.showToast({ title: '当日预约已满', icon: 'none' });
    return;
  }
  const slot = nextAppointmentTime(new Date(), unavailableDates.value.map((date) => date.appointmentDate), value);
  if (!slot) {
    uni.showToast({ title: '暂无可预约日期', icon: 'none' });
    return;
  }
  form.value.date = slot.date;
  form.value.time = slot.time;
}

function onTimeChange(event: { detail: { value: string } }) {
  form.value.time = event.detail.value;
}

async function submitReserve() {
  if (!reserveProduct.value || submitting.value) return;
  if (!(await ensureReadyMemberAccess(() => rememberBooking({
    businessType: 'ACCESSORY', product: reserveProduct.value!, ...form.value,
  })))) return;
  if (!(await loadUnavailableDates())) return;
  if (isDateUnavailable(form.value.date)) {
    uni.showToast({ title: '当日预约已满，请选择其他日期', icon: 'none' });
    return;
  }
  if (isPast(form.value.date, form.value.time)) {
    uni.showToast({ title: '不可选择过往时间', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    const userId = sessionState.userId;
    const token = sessionState.token;
    const created = await createAppointment({
      businessType: 'ACCESSORY',
      productId: reserveProduct.value.id,
      appointmentDate: form.value.date,
      startTime: form.value.time,
      remark: form.value.remark || undefined,
    });
    if (sessionState.userId !== userId || sessionState.token !== token) return;
    submittedAppointment.value = created;
    uni.showToast({ title: '已提交，待门店确认', icon: 'none' });
    reserveProduct.value = null;
  } catch (error) {
    uni.showToast({ title: (error instanceof Error ? error.message : '提交失败').slice(0, 18), icon: 'none' });
  } finally {
    submitting.value = false;
  }
}

function imageSrc(item: CatalogProduct): string {
  return imageSources.value[item.id] || '/static/brand/account-header.jpg';
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
      await resolveImageForDisplay(item.images[0], '/static/brand/account-header.jpg'),
    ] as const),
  );
  imageSources.value = Object.fromEntries(entries);
}

function priceText(value?: number): string {
  return value === undefined ? '参考价到店确认' : `参考价 ¥${Number(value).toFixed(0)}`;
}

function isDateUnavailable(date: string): boolean {
  return unavailableDates.value.some((item) => item.appointmentDate === date);
}

async function loadUnavailableDates() {
  try {
    unavailableDates.value = await listAppointmentUnavailableDates('ACCESSORY', today.value);
    return true;
  } catch {
    uni.showToast({ title: '预约日期加载失败', icon: 'none' });
    return false;
  }
}

function isPast(date: string, time: string): boolean {
  return new Date(`${date}T${time}:00`).getTime() <= Date.now();
}

onShow(async () => {
  today.value = formatDate(new Date());
  await Promise.all([loadCatalog(), loadUnavailableDates()]);
  const intent = takePendingBooking('ACCESSORY');
  if (!intent) return;
  const product = products.value.find((item) => item.id === intent.product?.id);
  if (!product) {
    uni.showModal({ title: '商品暂不可预约', content: '原商品已下架或暂未加载，请重新选择。', showCancel: false });
    return;
  }
  await openReserve(product, intent);
});
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

.title,
.panel-title {
  display: block;
  margin-top: 12rpx;
  color: #111827;
  font-size: 46rpx;
  font-weight: 900;
}

.panel-title {
  font-size: 34rpx;
}

.desc {
  display: block;
  margin-top: 14rpx;
  color: #667085;
  font-size: 27rpx;
  line-height: 1.55;
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

.reserve-btn,
.submit {
  margin: 0;
  border-radius: 999rpx;
  background: #3d4652;
  color: #f7f4ef;
  font-size: 25rpx;
  font-weight: 900;
}

.reserve-btn {
  min-width: 168rpx;
}

.empty {
  margin-top: 28rpx;
  padding: 42rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.86);
  color: #667085;
  text-align: center;
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 34rpx 24rpx;
  background: rgba(17, 24, 39, 0.42);
}

.reserve-panel {
  width: 100%;
  max-height: 86vh;
  overflow: hidden;
  border-radius: 34rpx;
  padding: 30rpx;
  background: #fff;
  box-shadow: 0 30rpx 90rpx rgba(17, 24, 39, 0.28);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 24rpx;
}

.close-btn {
  width: 70rpx;
  height: 70rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  background: #f2f4f7;
  color: #667085;
  font-size: 42rpx;
  line-height: 70rpx;
}

.field {
  margin-top: 18rpx;
  border-radius: 24rpx;
  padding: 22rpx;
  background: #f8fafc;
}

.label,
.field-value {
  display: block;
}

.label {
  color: #667085;
  font-size: 23rpx;
  font-weight: 900;
}

.field-value,
.input {
  margin-top: 8rpx;
  color: #111827;
  font-size: 30rpx;
  font-weight: 800;
}

.input {
  width: 100%;
}

.unavailable-note {
  display: block;
  margin-top: 10rpx;
  color: #a64b47;
  font-size: 22rpx;
}

.submit {
  margin-top: 28rpx;
  width: 100%;
}

.submit[disabled] {
  opacity: 0.45;
}
</style>
