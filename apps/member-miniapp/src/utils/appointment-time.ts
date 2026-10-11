export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function nextAppointmentTime(
  now: Date,
  unavailableDates: readonly string[],
  requestedDate = localDateKey(now),
): { date: string; time: string } | null {
  const today = localDateKey(now);
  const firstDate = requestedDate < today ? today : requestedDate;
  const date = new Date(`${firstDate}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return null;
  const unavailable = new Set(unavailableDates);
  for (let offset = 0; offset < 366; offset += 1) {
    const key = localDateKey(date);
    if (!unavailable.has(key)) {
      for (let hour = 9; hour <= 21; hour += 1) {
        const time = `${String(hour).padStart(2, '0')}:00`;
        if (new Date(`${key}T${time}:00`).getTime() > now.getTime()) return { date: key, time };
      }
    }
    date.setDate(date.getDate() + 1);
  }
  return null;
}
