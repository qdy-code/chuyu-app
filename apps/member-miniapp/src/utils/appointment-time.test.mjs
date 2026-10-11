import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextAppointmentTime, localDateKey } from './appointment-time.ts';

test('after closing selects the next open day and skips blocked dates', () => {
  assert.deepEqual(nextAppointmentTime(new Date(2026, 8, 14, 21, 30), ['2026-09-15']), {
    date: '2026-09-16', time: '09:00',
  });
});

test('opening, exact hour and closing boundaries select a future slot', () => {
  for (const [hour, minute, date, time] of [
    [8, 0, '2026-09-14', '09:00'], [9, 0, '2026-09-14', '10:00'],
    [20, 59, '2026-09-14', '21:00'], [21, 0, '2026-09-15', '09:00'],
    [23, 30, '2026-09-15', '09:00'],
  ]) assert.deepEqual(nextAppointmentTime(new Date(2026, 8, 14, hour, minute), []), { date, time });
});

test('stale dates roll forward at midnight and across a year', () => {
  assert.deepEqual(nextAppointmentTime(new Date(2027, 0, 1, 0, 5), [], '2026-12-31'), {
    date: '2027-01-01', time: '09:00',
  });
});

test('a future requested date starts at opening, and no availability returns null', () => {
  const now = new Date(2026, 8, 14, 18);
  assert.deepEqual(nextAppointmentTime(now, [], '2026-09-18'), { date: '2026-09-18', time: '09:00' });
  const blocked = Array.from({ length: 366 }, (_, i) => localDateKey(new Date(2026, 8, 14 + i)));
  assert.equal(nextAppointmentTime(now, blocked), null);
});
