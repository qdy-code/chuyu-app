<template>
  <view class="gallery" :class="{ 'gallery-detail': appearance === 'detail', 'gallery-nail-list': appearance === 'nail-list' }">
    <swiper v-if="urls.length" class="gallery-swiper" :current="current" @change="onChange">
      <swiper-item v-for="(url, index) in urls" :key="url">
        <view v-if="appearance && failedImages[index]" class="gallery-placeholder failed-image"><text>图片暂时无法显示</text><button class="image-retry" @click="retryImage(index)">重试图片</button></view>
        <image v-else class="gallery-image" :src="displayUrls[index] || url" :mode="imageMode" @error="markFailed(index)" @click="preview(index)" />
      </swiper-item>
    </swiper>
    <view v-else class="gallery-placeholder"><text>图片待补充</text></view>
    <view v-if="urls.length && (!appearance || urls.length > 1)" class="gallery-controls">
      <button v-if="urls.length > 1" class="gallery-nav" aria-label="上一张图片" :class="{ disabled: current === 0 }" :disabled="current === 0" @click="current--">‹</button>
      <button class="gallery-count" @click="preview(current)">{{ current + 1 }}/{{ urls.length }}<text v-if="!appearance"> · 查看大图</text></button>
      <button v-if="urls.length > 1" class="gallery-nav" aria-label="下一张图片" :class="{ disabled: current === urls.length - 1 }" :disabled="current === urls.length - 1" @click="current++">›</button>
    </view>
    <button v-if="appearance && urls.length === 1" class="gallery-expand" aria-label="放大图片" hover-class="expand-pressed" @click="preview(current)"><view class="expand-mark" /></button>
    <view v-if="showPackagePreview" class="package-preview">
      <view class="preview-head"><text>{{ current + 1 }}/{{ urls.length }}</text><button class="preview-close" @click="showPackagePreview = false">关闭</button></view>
      <swiper class="preview-swiper" :current="current" @change="onChange">
        <swiper-item v-for="(url, index) in urls" :key="url"><image class="preview-image" :src="displayUrls[index] || url" mode="aspectFit" /></swiper-item>
      </swiper>
      <view class="preview-actions">
        <button class="gallery-nav" :disabled="current === 0" @click="current--">‹</button>
        <button class="gallery-nav" :disabled="current === urls.length - 1" @click="current++">›</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { productImageUrls } from '@/utils/catalog-display';
import { resolveImageForDisplay } from '@/utils/image-cache';

const props = defineProps<{ images: string[]; appearance?: 'detail' | 'nail-list' }>();
const emit = defineEmits<{ (event: 'preview-start'): void; (event: 'preview-failed'): void }>();
// Nail photos must keep every visible nail; other galleries retain their existing crop.
const imageMode = computed(() => props.appearance ? 'aspectFit' : 'aspectFill');
const urls = computed(() => productImageUrls(props.images));
const displayUrls = ref<string[]>([]);
const current = ref(0);
const failedImages = ref<Record<number, boolean>>({});
const previewing = ref(false);
const showPackagePreview = ref(false);
let revision = 0;
watch(() => JSON.stringify(urls.value), async () => {
  const images = [...urls.value];
  const request = ++revision;
  current.value = 0;
  displayUrls.value = [];
  failedImages.value = {};
  const resolved = await Promise.all(images.map(source => resolveImageForDisplay(source, props.appearance ? '' : '/static/brand/member-card-bg.jpg')));
  if (request === revision) displayUrls.value = resolved;
}, { immediate: true });
function markFailed(index: number) { failedImages.value[index] = true; }
function retryImage(index: number) { failedImages.value[index] = false; }
function onChange(event: { detail: { current: number } }) { current.value = event.detail.current; }
async function preview(index: number) {
  if (!urls.value.length || previewing.value) return;
  const images = [...urls.value];
  current.value = index;
  // Bundled assets render in a local fullscreen viewer; the native preview expects remote/temporary files.
  if (images.some(source => source.startsWith('/static/'))) {
    showPackagePreview.value = true;
    return;
  }
  previewing.value = true;
  try {
    const previewUrls = await Promise.all(images.map(source => resolveImageForDisplay(source, '')));
    if (previewUrls.some(source => !source)) throw new Error('Image unavailable');
    emit('preview-start');
    uni.previewImage({ current: previewUrls[index] || previewUrls[0], urls: previewUrls,
      fail: () => {
        emit('preview-failed');
        uni.showToast({ title: '图片预览失败，请重试', icon: 'none' });
      } });
  } catch {
    emit('preview-failed');
    uni.showToast({ title: '图片预览失败，请重试', icon: 'none' });
  } finally {
    previewing.value = false;
  }
}
</script>

<style scoped>
.gallery { position: relative; overflow: hidden; background: #edf2f4; }
.gallery-swiper, .gallery-image { width: 100%; height: 430rpx; }
.gallery-placeholder { height: 240rpx; display: flex; align-items: center; justify-content: center; color: #72818d; font-size: 26rpx; }
.gallery-controls { position: absolute; right: 16rpx; bottom: 16rpx; display: flex; align-items: center; gap: 10rpx; }
.gallery-count { margin: 0; border-radius: 999rpx; padding: 10rpx 18rpx; line-height: 1.5; background: rgba(39, 50, 71, .72); color: #fff; font-size: 22rpx; }
.gallery-nav { width: 56rpx; height: 56rpx; margin: 0; padding: 0; border-radius: 50%; line-height: 50rpx; background: rgba(39, 50, 71, .72); color: #fff; font-size: 40rpx; }
.gallery-nav::after, .gallery-count::after { border: 0; }
.gallery-nav.disabled { opacity: .45; background: rgba(39, 50, 71, .4); color: #fff; }
.package-preview { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; padding: calc(28rpx + env(safe-area-inset-top)) 24rpx calc(28rpx + env(safe-area-inset-bottom)); box-sizing: border-box; background: #111; color: #fff; }
.preview-head, .preview-actions { display: flex; align-items: center; justify-content: space-between; gap: 24rpx; }
.preview-close { margin: 0; border-radius: 999rpx; color: #fff; background: #3d4652; font-size: 25rpx; }
.preview-close::after { border: 0; }
.preview-swiper { flex: 1; width: 100%; min-height: 0; }
.preview-image { width: 100%; height: 100%; }
.gallery-detail { margin: 0 16px; border-radius: var(--detail-radius); background: var(--detail-subtle); }
.gallery-detail .gallery-swiper, .gallery-detail .gallery-image { width: 100%; height: calc(100vw - 32px); }
.gallery-detail > .gallery-placeholder { height: 208px; }
.gallery-detail .gallery-placeholder { font-size: 14px; color: var(--detail-muted); }
.gallery-detail .failed-image { height: 100%; flex-direction: column; gap: 16px; }
.image-retry { margin: 0; min-height: 48px; padding: 12px 16px; font-size: 14px; line-height: 24px; color: var(--detail-text); background: var(--detail-surface); border-radius: 12px; }
.image-retry::after { border: 0; }
.gallery-detail .gallery-controls { position: static; justify-content: center; gap: 16px; padding: 8px; background: var(--detail-canvas); }
.gallery-detail .gallery-count { min-height: 48px; padding: 12px 8px; line-height: 24px; background: transparent; color: var(--detail-muted); font-size: 14px; }
.gallery-detail .gallery-nav { min-width: 48px; min-height: 48px; width: 48px; height: 48px; line-height: 44px; border-radius: 12px; background: var(--detail-surface); color: var(--detail-text); font-size: 28px; }
.gallery-detail .gallery-nav.disabled { opacity: .35; }
.gallery-detail .preview-actions .gallery-nav { background: #3d4652; color: #fff; }
.gallery-detail .preview-close { min-height: 48px; line-height: 48px; font-size: 16px; }
@media (max-height: 650px) { .gallery-detail .gallery-swiper, .gallery-detail .gallery-image { max-height: 40vh; } }
/* Full nail photos sit on a quiet surface; controls never cover the product. */
.gallery-nail-list .gallery-swiper, .gallery-nail-list .gallery-image { height: 560rpx; }
.gallery-nail-list .gallery-controls { position: static; justify-content: center; gap: 16px; padding: 8px; background: #fff; }
.gallery-nail-list .gallery-count { min-height: 48px; padding: 12px 8px; line-height: 24px; background: transparent; color: #667085; font-size: 14px; }
.gallery-nail-list .gallery-nav { min-width: 48px; min-height: 48px; width: 48px; height: 48px; border-radius: 12px; line-height: 44px; background: #edf2f4; color: #111827; font-size: 28px; }
.gallery-nail-list .gallery-nav.disabled { opacity: .35; }
.gallery-nail-list .failed-image { height: 100%; flex-direction: column; gap: 16px; font-size: 14px; }
.gallery-nail-list .image-retry { color: #111827; background: #fff; }
.gallery-nail-list .preview-actions .gallery-nav { background: #3d4652; color: #fff; }
.gallery-expand { position: absolute; right: 8px; bottom: 8px; z-index: 1; width: 48px; height: 48px; margin: 0; padding: 8px; border-radius: 50%; background: transparent; }
.gallery-expand::after { border: 0; }
.expand-mark { position: relative; display: block; width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,.92); color: #3d4652; }
.expand-mark::before, .expand-mark::after { content: ''; position: absolute; width: 6px; height: 6px; border-color: currentColor; border-style: solid; }
.expand-mark::before { top: 8px; right: 8px; border-width: 1.5px 1.5px 0 0; }
.expand-mark::after { bottom: 8px; left: 8px; border-width: 0 0 1.5px 1.5px; }
.expand-pressed { opacity: .65; }
</style>
