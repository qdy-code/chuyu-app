import { computed, ref } from 'vue';
import { BUSINESS_TYPE } from '@member-platform/shared';
import type {
  Appointment,
  AuditLog,
  AdminMemberMessage,
  CatalogProduct,
  ConsumptionOrder,
  MemberLevel,
  MemberProfile,
  ProductCategory,
  ProductType,
  RechargeOrder,
} from '@member-platform/shared';
import { api } from '@/api/client';

const members = ref<MemberProfile[]>([]);
const levels = ref<MemberLevel[]>([]);
const productTypes = ref<ProductType[]>([]);
const productCategories = ref<ProductCategory[]>([]);
const catalogProducts = ref<CatalogProduct[]>([]);
const recharges = ref<RechargeOrder[]>([]);
const orders = ref<ConsumptionOrder[]>([]);
const appointments = ref<Appointment[]>([]);
const logs = ref<AuditLog[]>([]);
const memberMessages = ref<AdminMemberMessage[]>([]);

const loading = ref(false);
const error = ref('');

async function loadAll(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [
      memberList,
      levelList,
      productTypeList,
      nailCategoryList,
      accessoryCategoryList,
      flowerCategoryList,
      nailProductList,
      accessoryProductList,
      flowerProductList,
      rechargeList,
      orderList,
      appointmentList,
      auditList,
    ] = await Promise.all([
      api.listMembers(),
      api.listLevels(),
      api.listProductTypes(),
      api.listCatalogCategories(BUSINESS_TYPE.NAIL),
      api.listCatalogCategories(BUSINESS_TYPE.ACCESSORY),
      api.listCatalogCategories(BUSINESS_TYPE.FLOWER),
      api.listCatalogProducts(BUSINESS_TYPE.NAIL),
      api.listCatalogProducts(BUSINESS_TYPE.ACCESSORY),
      api.listCatalogProducts(BUSINESS_TYPE.FLOWER),
      api.listRecharges(),
      api.listConsumptionOrders(),
      api.listAppointments(),
      api.listAuditLogs(),
    ]);
    members.value = memberList;
    levels.value = levelList;
    productTypes.value = productTypeList;
    productCategories.value = [...nailCategoryList, ...accessoryCategoryList, ...flowerCategoryList];
    catalogProducts.value = [...nailProductList, ...accessoryProductList, ...flowerProductList];
    recharges.value = rechargeList;
    orders.value = orderList;
    appointments.value = appointmentList;
    logs.value = auditList;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function refreshAppointments(): Promise<void> {
  try {
    appointments.value = await api.listAppointments();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function refreshMemberMessages(status: 'unread' | 'all' = 'unread'): Promise<void> {
  try {
    memberMessages.value = await api.listMemberMessages(status);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

const pendingAppointmentCount = computed(
  () => appointments.value.filter((appointment) => appointment.status === 'PENDING').length,
);

const pendingRechargeCount = computed(
  () => recharges.value.filter((order) => order.status === 'PENDING').length,
);

const levelUsageCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  members.value.forEach((member) => {
    counts[member.levelId] = (counts[member.levelId] || 0) + 1;
  });
  return counts;
});

export function useDataStore() {
  return {
    members,
    levels,
    productTypes,
    productCategories,
    catalogProducts,
    recharges,
    orders,
    appointments,
    logs,
    memberMessages,
    loading,
    error,
    loadAll,
    refreshAppointments,
    refreshMemberMessages,
    pendingAppointmentCount,
    pendingRechargeCount,
    levelUsageCounts,
  };
}
