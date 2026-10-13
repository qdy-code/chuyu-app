import { ensureReadyMemberAccess } from '@/utils/member';

export interface StoreContact {
  name: string;
  phone: string;
  address: string;
  hours: string;
  latitude?: number;
  longitude?: number;
}

export function normalizeStoreContact(input: Record<string, unknown>): StoreContact {
  const text = (key: string) => String(input[key] || '').trim();
  const lat = text('latitude') ? Number(input.latitude) : NaN;
  const lng = text('longitude') ? Number(input.longitude) : NaN;
  const locationValid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return {
    name: text('name') || '月光石屿MOONISLE', phone: text('phone'), address: text('address'), hours: text('hours'),
    ...(locationValid ? { latitude: lat, longitude: lng } : {}),
  };
}

export const storeContact = normalizeStoreContact({
  phone: import.meta.env.VITE_STORE_PHONE,
  address: import.meta.env.VITE_STORE_ADDRESS,
  hours: import.meta.env.VITE_STORE_HOURS,
  latitude: import.meta.env.VITE_STORE_LATITUDE,
  longitude: import.meta.env.VITE_STORE_LONGITUDE,
});

export function callStore(): void {
  if (!storeContact.phone) return;
  uni.makePhoneCall({ phoneNumber: storeContact.phone,
    fail: (error) => { if (!/cancel/i.test(error.errMsg || '')) uni.showToast({ title: '电话未拨出，请重试', icon: 'none' }); } });
}

export function navigateToStore(): void {
  const { latitude, longitude, name, address } = storeContact;
  if (latitude !== undefined && longitude !== undefined) {
    uni.openLocation({ latitude, longitude, name, address, scale: 17,
      fail: () => uni.showModal({ title: '暂未打开地图', content: address || '请联系门店确认到店地址。', showCancel: false }) });
  } else if (address) {
    uni.setClipboardData({ data: address });
  }
}

export async function leaveStoreMessage(): Promise<void> {
  if (!(await ensureReadyMemberAccess())) return;
  uni.navigateTo({ url: '/pages/messages/messages' });
}
