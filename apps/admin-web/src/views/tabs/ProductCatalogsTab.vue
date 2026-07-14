<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import {
  NButton,
  NCard,
  NDataTable,
  NIcon,
  NImage,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  NSwitch,
  NTag,
  NUpload,
  useMessage,
} from 'naive-ui';
import { Trash2 } from '@lucide/vue';
import type { BusinessType, CatalogProduct, ProductCategory } from '@member-platform/shared';
import { BUSINESS_TYPE } from '@member-platform/shared';
import { api, toAbsoluteImageUrl } from '@/api/client';
import { useDataStore } from '@/composables/useDataStore';
import { formatMoney } from '@/composables/useFormatters';

const { productCategories, catalogProducts, loadAll } = useDataStore();
const message = useMessage();

const activeBusiness = ref<BusinessType>(BUSINESS_TYPE.NAIL);
const categoryModal = ref(false);
const productModal = ref(false);
const editingCategoryId = ref('');
const editingProductId = ref('');
const uploading = ref(false);
const submitting = ref(false);

const businessOptions = [
  { label: '美甲', value: BUSINESS_TYPE.NAIL },
  { label: '饰品', value: BUSINESS_TYPE.ACCESSORY },
  { label: '鲜花', value: BUSINESS_TYPE.FLOWER },
];

const businessLabel: Record<BusinessType, string> = {
  [BUSINESS_TYPE.NAIL]: '美甲',
  [BUSINESS_TYPE.ACCESSORY]: '饰品',
  [BUSINESS_TYPE.FLOWER]: '鲜花',
};

const categoryForm = ref({ name: '', sortOrder: 100 });
const productForm = ref({
  categoryId: '',
  name: '',
  description: '',
  referencePrice: null as number | null,
  imageText: '',
  sortOrder: 100,
  isActive: true,
});

const currentCategories = computed(() =>
  productCategories.value
    .filter((item) => item.businessType === activeBusiness.value)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder),
);

const currentProducts = computed(() =>
  catalogProducts.value
    .filter((item) => item.businessType === activeBusiness.value)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder),
);

const categoryOptions = computed(() => [
  { label: '不选择分类', value: '' },
  ...currentCategories.value.map((item) => ({ label: item.name, value: item.id })),
]);

const productImageUrls = computed(() =>
  productForm.value.imageText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
);

function openCreateCategory() {
  editingCategoryId.value = '';
  categoryForm.value = { name: '', sortOrder: 100 };
  categoryModal.value = true;
}

function openEditCategory(item: ProductCategory) {
  editingCategoryId.value = item.id;
  categoryForm.value = { name: item.name, sortOrder: item.sortOrder };
  categoryModal.value = true;
}

async function submitCategory() {
  if (!categoryForm.value.name.trim()) {
    message.warning('请填写分类名称');
    return;
  }
  submitting.value = true;
  try {
    const payload = { name: categoryForm.value.name.trim(), sortOrder: categoryForm.value.sortOrder };
    if (editingCategoryId.value) {
      await api.updateCatalogCategory(activeBusiness.value, editingCategoryId.value, payload);
      message.success('分类已保存');
    } else {
      await api.createCatalogCategory(activeBusiness.value, payload);
      message.success('分类已创建');
    }
    categoryModal.value = false;
    await loadAll();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    submitting.value = false;
  }
}

async function removeCategory(item: ProductCategory) {
  try {
    await api.deleteCatalogCategory(activeBusiness.value, item.id);
    message.success('分类已删除');
    await loadAll();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败');
  }
}

function openCreateProduct() {
  editingProductId.value = '';
  productForm.value = {
    categoryId: currentCategories.value[0]?.id || '',
    name: '',
    description: '',
    referencePrice: null,
    imageText: '',
    sortOrder: 100,
    isActive: true,
  };
  productModal.value = true;
}

function openEditProduct(item: CatalogProduct) {
  editingProductId.value = item.id;
  productForm.value = {
    categoryId: item.categoryId || '',
    name: item.name,
    description: item.description || '',
    referencePrice: item.referencePrice ?? null,
    imageText: item.images.join('\n'),
    sortOrder: item.sortOrder,
    isActive: item.isActive,
  };
  productModal.value = true;
}

async function submitProduct() {
  if (!productForm.value.name.trim()) {
    message.warning('请填写产品名称');
    return;
  }
  submitting.value = true;
  try {
    const payload = {
      categoryId: productForm.value.categoryId || undefined,
      name: productForm.value.name.trim(),
      description: productForm.value.description.trim() || undefined,
      referencePrice: productForm.value.referencePrice ?? undefined,
      images: productForm.value.imageText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      sortOrder: productForm.value.sortOrder,
      isActive: productForm.value.isActive,
    };
    if (editingProductId.value) {
      await api.updateCatalogProduct(activeBusiness.value, editingProductId.value, {
        ...payload,
        referencePrice: productForm.value.referencePrice,
      });
      message.success('产品已保存');
    } else {
      await api.createCatalogProduct(activeBusiness.value, payload);
      message.success('产品已创建');
    }
    productModal.value = false;
    await loadAll();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    submitting.value = false;
  }
}

async function handleProductUpload(options: { file: { file: File | null } }) {
  const file = options.file.file;
  if (!file) return;
  uploading.value = true;
  try {
    const urls = await api.uploadImages([file]);
    const next = [...productImageUrls.value, ...urls].slice(0, 9);
    productForm.value.imageText = next.join('\n');
    message.success('图片已上传');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '上传失败');
  } finally {
    uploading.value = false;
  }
}

function removeProductImage(index: number) {
  const next = productImageUrls.value.slice();
  next.splice(index, 1);
  productForm.value.imageText = next.join('\n');
}

async function toggleActive(item: CatalogProduct, isActive: boolean) {
  try {
    await api.updateCatalogProduct(activeBusiness.value, item.id, { isActive });
    await loadAll();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败');
  }
}

async function removeProduct(item: CatalogProduct) {
  try {
    await api.deleteCatalogProduct(activeBusiness.value, item.id);
    message.success('产品已删除');
    await loadAll();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败');
  }
}

watch(activeBusiness, () => {
  categoryModal.value = false;
  productModal.value = false;
});
</script>

<template>
  <NSpace vertical :size="20">
    <NCard :bordered="false" class="surface">
      <template #header>
        <div class="card-header">
          <span>产品库</span>
          <NSpace align="center">
            <NSelect v-model:value="activeBusiness" :options="businessOptions" style="width: 140px" />
            <NButton secondary @click="openCreateCategory">新增分类</NButton>
            <NButton type="primary" @click="openCreateProduct">新增产品</NButton>
          </NSpace>
        </div>
      </template>

      <NSpace vertical :size="16">
        <NDataTable
          size="small"
          :pagination="false"
          :columns="[
            { title: '分类', key: 'name' },
            { title: '排序', key: 'sortOrder', width: 90 },
            {
              title: '操作',
              key: 'actions',
              width: 160,
              render: (row) => h('div', { class: 'actions' }, [
                h(NButton, { size: 'tiny', secondary: true, onClick: () => openEditCategory(row as ProductCategory) }, { default: () => '编辑' }),
                h(NButton, { size: 'tiny', type: 'error', secondary: true, onClick: () => removeCategory(row as ProductCategory) }, { default: () => '删除' }),
              ]),
            },
          ]"
          :data="currentCategories"
        />

        <NDataTable
          :columns="[
            {
              title: '产品',
              key: 'name',
              render: (row) => {
                const item = row as CatalogProduct;
                return h('div', { class: 'product-cell' }, [
                  item.images[0] ? h('img', { class: 'thumb', src: toAbsoluteImageUrl(item.images[0]) }) : h('div', { class: 'thumb empty-thumb' }, businessLabel[item.businessType].slice(0, 1)),
                  h('div', null, [
                    h('strong', item.name),
                    h('small', item.description || '无说明'),
                  ]),
                ]);
              },
            },
            { title: '分类', key: 'categoryName', width: 120 },
            {
              title: '参考价',
              key: 'referencePrice',
              width: 100,
              render: (row) => (row as CatalogProduct).referencePrice === undefined ? '-' : `¥${formatMoney((row as CatalogProduct).referencePrice)}`,
            },
            {
              title: '状态',
              key: 'status',
              width: 150,
              render: (row) => {
                const item = row as CatalogProduct;
                return h(NSpace, { size: 8, align: 'center' }, {
                  default: () => [
                    h(NSwitch, { value: item.isActive, 'onUpdate:value': (value: boolean) => toggleActive(item, value) }),
                    h(
                      NTag,
                      { size: 'small', type: item.isActive ? 'success' : 'default', bordered: false },
                      { default: () => (item.isActive ? '上架中' : '已下架') },
                    ),
                  ],
                });
              },
            },
            { title: '排序', key: 'sortOrder', width: 80 },
            {
              title: '操作',
              key: 'actions',
              width: 150,
              render: (row) => h('div', { class: 'actions' }, [
                h(NButton, { size: 'small', secondary: true, onClick: () => openEditProduct(row as CatalogProduct) }, { default: () => '编辑' }),
                h(NButton, { size: 'small', type: 'error', secondary: true, onClick: () => removeProduct(row as CatalogProduct) }, { default: () => '删除' }),
              ]),
            },
          ]"
          :data="currentProducts"
          :pagination="{ pageSize: 8 }"
        />
      </NSpace>
    </NCard>

    <NModal v-model:show="categoryModal" preset="card" :title="editingCategoryId ? '编辑分类' : '新增分类'" style="width: 420px" :bordered="false">
      <NSpace vertical>
        <NInput v-model:value="categoryForm.name" placeholder="分类名称" />
        <NInputNumber v-model:value="categoryForm.sortOrder" placeholder="排序" style="width: 100%" />
      </NSpace>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="categoryModal = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitCategory">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="productModal" preset="card" :title="editingProductId ? '编辑产品' : '新增产品'" style="width: 620px; max-width: calc(100vw - 32px)" :bordered="false">
      <NSpace vertical>
        <NSelect v-model:value="productForm.categoryId" :options="categoryOptions" placeholder="分类" />
        <NInput v-model:value="productForm.name" placeholder="产品名称" />
        <NInput v-model:value="productForm.description" type="textarea" :rows="2" placeholder="产品说明" />
        <NInputNumber v-model:value="productForm.referencePrice" placeholder="参考价" style="width: 100%" />
        <div class="form-row">
          <label>产品图片</label>
          <NUpload
            multiple
            accept="image/*"
            :show-file-list="false"
            :default-upload="false"
            @change="handleProductUpload"
          >
            <NButton secondary :loading="uploading">点击上传图片</NButton>
          </NUpload>
          <NInput v-model:value="productForm.imageText" type="textarea" :rows="3" placeholder="图片地址，每行一个；上传后会自动填入" />
          <div v-if="productImageUrls.length > 0" class="thumb-grid">
            <div v-for="(img, idx) in productImageUrls" :key="`${img}-${idx}`" class="thumb-cell">
              <NImage :src="toAbsoluteImageUrl(img)" width="76" height="76" object-fit="cover" />
              <NButton size="tiny" type="error" secondary @click="removeProductImage(idx)">
                <template #icon>
                  <NIcon><Trash2 :size="14" /></NIcon>
                </template>
              </NButton>
            </div>
          </div>
        </div>
        <NSpace>
          <NInputNumber v-model:value="productForm.sortOrder" placeholder="排序" />
          <NSwitch v-model:value="productForm.isActive">
            <template #checked>上架</template>
            <template #unchecked>下架</template>
          </NSwitch>
        </NSpace>
      </NSpace>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="productModal = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitProduct">保存</NButton>
        </NSpace>
      </template>
    </NModal>
  </NSpace>
</template>

<style scoped>
.surface {
  border-radius: 14px;
}

.card-header,
.actions,
.product-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-header {
  justify-content: space-between;
  flex-wrap: wrap;
}

.actions {
  gap: 8px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.thumb-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.thumb-cell {
  position: relative;
  width: 76px;
  height: 76px;
}

.thumb-cell :deep(.n-image),
.thumb-cell :deep(img) {
  border-radius: 8px;
}

.thumb-cell .n-button {
  position: absolute;
  right: -6px;
  top: -6px;
}

.product-cell strong,
.product-cell small {
  display: block;
}

.product-cell small {
  margin-top: 2px;
  max-width: 360px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thumb {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  object-fit: cover;
  background: #edf2f4;
}

.empty-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-weight: 700;
}
</style>
