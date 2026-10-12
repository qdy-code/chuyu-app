<template>
  <view class="gallery">
    <swiper v-if="urls.length" class="gallery-swiper" :current="current" @change="onChange">
      <swiper-item v-for="(url, index) in urls" :key="url">
        <image class="gallery-image" :src="displayUrls[index] || url" mode="aspectFill" @click="preview(index)" />
      </swiper-item>
    </swiper>
    <view v-else class="gallery-placeholder"><text>图片待补充</text></view>
    <view v-if="urls.length" class="gallery-controls">
      <button v-if="urls.length > 1" class="gallery-nav" :class="{ disabled: current === 0 }" :disabled="current === 0" @click="current--">‹</button>
      <button class="gallery-count" @click="preview(current)">{{ current + 1 }}/{{ urls.length }} · 查看大图</button>
      <button v-if="urls.length > 1" class="gallery-nav" :class="{ disabled: current === urls.length - 1 }" :disabled="current === urls.length - 1" @click="current++">›</button>
    </view>
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

const props = defineProps<{ images: string[] }>();
const urls = computed(() => productImageUrls(props.images));
const displayUrls = ref<string[]>([]);
const current = ref(0);
const previewing = ref(false);
const showPackagePreview = ref(false);
let revision = 0;
watch(urls, async (images) => {
  const request = ++revision;
  current.value = 0;
  displayUrls.value = [];
  const resolved = await Promise.all(images.map(source => resolveImageForDisplay(source, '/static/brand/member-card-bg.jpg')));
  if (request === revision) displayUrls.value = resolved;
}, { immediate: true });
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
    uni.previewImage({ current: previewUrls[index] || previewUrls[0], urls: previewUrls,
      fail: () => uni.showToast({ title: '图片预览失败，请重试', icon: 'none' }) });
  } catch {
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
</style>
