import type { BusinessType, CatalogProduct } from '@member-platform/shared';
import { sessionState } from '@/store/session';
import { hasLegalConsent } from '@/utils/member';

export interface BookingIntent {
  businessType: BusinessType;
  product?: Pick<CatalogProduct, 'id' | 'name'>;
  date?: string;
  time?: string;
  remark?: string;
}

// Only keep the unfinished operation for this app session; never submit it automatically.
let pendingBooking: BookingIntent | null = null;
let navigating = false;

export function rememberBooking(intent: BookingIntent): void {
  pendingBooking = { ...intent, product: intent.product ? { id: intent.product.id, name: intent.product.name } : undefined };
}

export function takePendingBooking(businessType: BusinessType): BookingIntent | null {
  if (pendingBooking?.businessType !== businessType) return null;
  const intent = pendingBooking;
  pendingBooking = null;
  return intent;
}

export function resumePendingBooking(): boolean {
  if (!pendingBooking || !sessionState.token || !sessionState.profile?.phone || !hasLegalConsent()) return false;
  if (navigating) return true;
  navigating = true;
  const complete = () => { navigating = false; };
  const fail = () => uni.showToast({ title: '未能返回预约，请重试', icon: 'none' });
  if (pendingBooking.businessType === 'NAIL') {
    uni.navigateTo({ url: '/pages/appointment/appointment?booking=1', complete, fail });
  } else {
    const page = pendingBooking.businessType === 'ACCESSORY' ? 'accessory' : 'flower';
    uni.switchTab({ url: `/pages/${page}/${page}`, complete, fail });
  }
  return true;
}

export function clearPendingBooking(): void {
  pendingBooking = null;
}
