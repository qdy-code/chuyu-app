import type { Appointment, BookedAppointmentSlot } from '@member-platform/shared';

export function storeDateKey(now = new Date()): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function appointmentTimePast(date: string, time: string, now = new Date()): boolean {
  const at = Date.parse(`${date}T${time}:00+08:00`);
  return !Number.isFinite(at) || at <= now.getTime();
}

function minutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

// The API treats an appointment without an end time as a 30-minute occupied interval.
// This is an availability check, not a promise of the actual service duration.
export function appointmentTimeConflicts(time: string, slots: readonly BookedAppointmentSlot[]): boolean {
  const start = minutes(time);
  return slots.some(slot => {
    const occupiedStart = minutes(slot.startTime);
    const occupiedEnd = Math.max(minutes(slot.endTime), occupiedStart + (slot.endTime > slot.startTime ? 0 : 30));
    return start < occupiedEnd && start + 30 > occupiedStart;
  });
}

export function appointmentTimeChoices(date: string, slots: readonly BookedAppointmentSlot[], now = new Date()) {
  return Array.from({ length: 49 }, (_, index) => {
    const total = 9 * 60 + index * 15;
    const time = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    const reason = appointmentTimePast(date, time, now) ? '已过' : appointmentTimeConflicts(time, slots) ? '已占用' : '';
    return { time, reason, disabled: Boolean(reason) };
  });
}

export function nextFutureAppointmentTime(now: Date, unavailableDates: readonly string[], requestedDate = storeDateKey(now)) {
  const today = storeDateKey(now);
  const date = new Date(`${requestedDate < today ? today : requestedDate}T00:00:00+08:00`);
  if (!Number.isFinite(date.getTime())) return null;
  for (let offset = 0; offset < 366; offset += 1) {
    const key = storeDateKey(date);
    if (!unavailableDates.includes(key)) {
      const choice = appointmentTimeChoices(key, [], now).find(item => !item.disabled);
      if (choice) return { date: key, time: choice.time };
    }
    date.setTime(date.getTime() + 86400000);
  }
  return null;
}

export function nextMemberAppointment(appointments: readonly Appointment[], now = new Date()): Appointment | null {
  return appointments.filter(item => {
    if (item.status !== 'PENDING' && item.status !== 'CONFIRMED') return false;
    const start = Date.parse(`${item.appointmentDate}T${item.startTime}:00+08:00`);
    const end = Date.parse(`${item.appointmentDate}T${item.endTime || item.startTime}:00+08:00`);
    return Math.max(end, start + (end > start ? 0 : 30 * 60000)) > now.getTime();
  }).sort((a, b) => `${a.appointmentDate} ${a.startTime}`.localeCompare(`${b.appointmentDate} ${b.startTime}`))[0] || null;
}
