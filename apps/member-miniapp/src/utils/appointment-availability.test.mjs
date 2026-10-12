import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appointmentTimeConflicts, appointmentTimeChoices, appointmentTimePast, nextFutureAppointmentTime, nextMemberAppointment, storeDateKey } from './appointment-availability.ts';

const slot = (startTime, endTime) => ({ businessType: 'NAIL', appointmentDate: '2026-10-13', startTime, endTime });

test('availability blocks intervals on both sides and allows touching boundaries', () => {
  const booked = [slot('14:30', '16:00')];
  for (const [time, conflict] of [['14:00', false], ['14:01', true], ['14:30', true], ['15:59', true], ['16:00', false]]) {
    assert.equal(appointmentTimeConflicts(time, booked), conflict, time);
  }
});

test('legacy equal start/end occupies 30 minutes exactly as the API does', () => {
  const booked = [slot('14:30', '14:30')];
  assert.equal(appointmentTimeConflicts('14:15', booked), true);
  assert.equal(appointmentTimeConflicts('14:45', booked), true);
  assert.equal(appointmentTimeConflicts('15:00', booked), false);
});

test('store day and past times use China time even on a foreign timezone device', () => {
  const now = new Date('2026-10-12T16:05:00Z');
  assert.equal(storeDateKey(now), '2026-10-13');
  assert.equal(appointmentTimePast('2026-10-13', '00:05', now), true);
  assert.equal(appointmentTimePast('2026-10-13', '09:00', now), false);
});

test('15-minute suggestions include closing and identify past/overlapping starts', () => {
  const choices = appointmentTimeChoices('2026-10-13', [slot('14:30', '16:00')], new Date('2026-10-13T01:00:00Z'));
  assert.equal(choices.length, 49);
  assert.equal(choices[0].reason, '已过');
  assert.equal(choices.at(-1).time, '21:00');
  assert.equal(choices.find(item => item.time === '14:15').reason, '已占用');
  assert.equal(choices.find(item => item.time === '16:00').disabled, false);
});

test('suggestions roll past closing, blocked days and stale requested dates', () => {
  assert.deepEqual(nextFutureAppointmentTime(new Date('2026-10-12T13:00:00Z'), ['2026-10-13']), { date: '2026-10-14', time: '09:00' });
  assert.deepEqual(nextFutureAppointmentTime(new Date('2026-12-31T16:01:00Z'), [], '2026-12-30'), { date: '2027-01-01', time: '09:00' });
});

test('next appointment excludes closed/past records and picks earliest future across categories', () => {
  const record = (id, date, time, status = 'CONFIRMED', endTime = time) => ({ id, appointmentDate: date, startTime: time, endTime, status });
  const records = [record('later', '2026-10-15', '10:00'), record('past', '2026-10-12', '09:00'), record('cancelled', '2026-10-13', '10:00', 'CANCELLED'), record('completed', '2026-10-13', '09:00', 'COMPLETED'), record('next', '2026-10-14', '09:00', 'PENDING')];
  assert.equal(nextMemberAppointment(records, new Date('2026-10-12T10:00:00Z')).id, 'next');
  assert.equal(nextMemberAppointment([], new Date()), null);
  assert.equal(nextMemberAppointment([record('in-progress', '2026-10-12', '17:45')], new Date('2026-10-12T10:00:00Z')).id, 'in-progress');
});
