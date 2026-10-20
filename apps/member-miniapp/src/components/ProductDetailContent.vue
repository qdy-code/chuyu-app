<template>
  <view class="detail-content">
    <view class="product-intro">
      <view class="product-heading">
        <text class="product-title">{{ product.name }}</text>
        <text class="product-price">{{ productPriceText(product.referencePrice) }}</text>
      </view>
      <text v-if="product.description" class="product-description" :user-select="true">{{ product.description }}</text>
    </view>
    <StoreContact appearance="compact" />
  </view>
</template>

<script setup lang="ts">
import type { CatalogProduct } from '@member-platform/shared';
import { productPriceText } from '@/utils/catalog-display';
import StoreContact from '@/components/StoreContact.vue';
defineProps<{ product: CatalogProduct }>();
</script>

<style scoped>
.detail-content { padding: 0 calc(var(--detail-space) * 3) 24px; }
.product-intro { padding: 24px 0; }
.product-heading { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; }
.product-title { flex: 1; min-width: 160px; font-size: 28px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
.product-price { font-size: 18px; color: var(--detail-primary); line-height: 1.5; white-space: nowrap; }
.product-description { display: block; margin-top: 16px; font-size: 16px; line-height: 1.8; color: var(--detail-muted); white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 359px) { .detail-content { padding-left: 16px; padding-right: 16px; } .product-title { font-size: 24px; } }
</style>
