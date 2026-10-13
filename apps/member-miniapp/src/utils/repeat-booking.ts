import { ref } from 'vue';
import type { Appointment, BusinessType } from '@member-platform/shared';
import { listCatalogProducts, readableErrorMessage } from '@/utils/api';
import { ensureReadyMemberAccess } from '@/utils/member';
import { sessionState } from '@/store/session';
import { rememberBooking, resumePendingBooking } from '@/utils/booking-flow';
import type { BookingIntent } from '@/utils/booking-flow';

export type RepeatBookingSource = { businessType: BusinessType; productId?: string };

export function completedNailAppointments(records: readonly Appointment[]): Appointment[] {
  return records.filter(item => item.businessType === 'NAIL' && item.status === 'COMPLETED')
    .sort((a, b) => `${b.appointmentDate} ${b.startTime}`.localeCompare(`${a.appointmentDate} ${a.startTime}`));
}

function confirmWithoutStyle(): Promise<boolean> {
  return new Promise(resolve => uni.showModal({ title: '原款式暂不可预约',
    content: '原款式已下架，是否不选款式，预约到店沟通？', confirmText: '继续预约',
    success: result => resolve(Boolean(result.confirm)), fail: () => resolve(false) }));
}

// Only prepare a fresh application. Never copy the old date, notes or confirmation status.
export function useRepeatBooking() {
  const repeating = ref(false);
  async function repeatBooking(source: RepeatBookingSource): Promise<void> {
    if (repeating.value) return;
    repeating.value = true;
    let owner = '';
    let token = '';
    try {
      if (!(await ensureReadyMemberAccess())) return;
      owner = sessionState.userId; token = sessionState.token;
      const unchanged = () => owner === sessionState.userId && token === sessionState.token;
      let product: BookingIntent['product'];
      if (source.productId) {
        const products = await listCatalogProducts(source.businessType);
        if (!unchanged()) return;
        const current = products.find(item => item.id === source.productId && item.isActive !== false);
        if (!current) {
          if (source.businessType !== 'NAIL') throw new Error('原商品已下架，请重新选购');
          if (!(await confirmWithoutStyle()) || !unchanged()) return;
        } else {
          if (current.reservedByUserId && current.reservedByUserId !== owner) throw new Error('该饰品已被预留，请重新选择');
          product = { id: current.id, name: current.name };
        }
      } else if (source.businessType !== 'NAIL') {
        throw new Error('请先选择商品');
      }
      if (!unchanged()) return;
      rememberBooking({ businessType: source.businessType, product });
      resumePendingBooking();
    } catch (error) {
      if (owner && (owner !== sessionState.userId || token !== sessionState.token)) return;
      uni.showModal({ title: '暂未开始预约', content: readableErrorMessage(error, '请稍后重试'), showCancel: false });
    } finally { repeating.value = false; }
  }
  return { repeating, repeatBooking };
}
