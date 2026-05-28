import { computed, ref } from 'vue';
import type {
  Appointment,
  AuditLog,
  ConsumptionOrder,
  MemberLevel,
  MemberProfile,
  ProductType,
  RechargeOrder,
} from '@member-platform/shared';
import { api } from '@/api/client';

const members = ref<MemberProfile[]>([]);
const levels = ref<MemberLevel[]>([]);
const productTypes = ref<ProductType[]>([]);
const recharges = ref<RechargeOrder[]>([]);
const orders = ref<ConsumptionOrder[]>([]);
const appointments = ref<Appointment[]>([]);
const logs = ref<AuditLog[]>([]);

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
      rechargeList,
      orderList,
      appointmentList,
      auditList,
    ] = await Promise.all([
      api.listMembers(),
      api.listLevels(),
      api.listProductTypes(),
      api.listRecharges(),
      api.listConsumptionOrders(),
      api.listAppointments(),
      api.listAuditLogs(),
    ]);
    members.value = memberList;
    levels.value = levelList;
    productTypes.value = productTypeList;
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
    recharges,
    orders,
    appointments,
    logs,
    loading,
    error,
    loadAll,
    pendingAppointmentCount,
    pendingRechargeCount,
    levelUsageCounts,
  };
}
