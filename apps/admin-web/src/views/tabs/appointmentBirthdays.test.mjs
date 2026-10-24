import assert from 'node:assert/strict';
import { test } from 'node:test';
import { birthdayDateInYear, normalizeBirthday } from './appointmentBirthdays.ts';

test('normalizes month-day and legacy birthdays without retaining the birth year', () => {
  assert.equal(normalizeBirthday('09-08'), '09-08');
  assert.equal(normalizeBirthday('1990-09-08'), '09-08');
  assert.equal(normalizeBirthday(' 2000-02-29 '), '02-29');
  assert.equal(birthdayDateInYear('1990-09-08', 2026), '2026-09-08');
});

test('ignores missing, malformed, and impossible birthdays', () => {
  for (const value of [undefined, '', ' ', '9-8', '00-10', '13-01', '01-00', '01-32', '02-30', '04-31', '2000-04-31', 'x1990-09-08', '1990-09-08T00:00:00']) {
    assert.equal(normalizeBirthday(value), undefined, String(value));
    assert.equal(birthdayDateInYear(value, 2026), undefined, String(value));
  }
});

test('February 29 occurs only on real leap-year dates and never moves to February 28', () => {
  for (const value of ['02-29', '2000-02-29']) {
    for (const year of [2024, 2028, 2000, 2400]) {
      assert.equal(birthdayDateInYear(value, year), `${year}-02-29`);
    }
    for (const year of [2025, 2026, 1900, 2100]) {
      assert.equal(birthdayDateInYear(value, year), undefined);
    }
  }
  assert.equal(birthdayDateInYear('02-28', 2026), '2026-02-28');
  assert.equal(birthdayDateInYear('03-01', 2026), '2026-03-01');
});

test('uses the occurrence year at year boundaries and rejects invalid years', () => {
  assert.equal(birthdayDateInYear('1988-12-31', 2026), '2026-12-31');
  assert.equal(birthdayDateInYear('01-01', 2027), '2027-01-01');
  for (const year of [0, -1, 10000, NaN, Infinity, 2026.5]) {
    assert.equal(birthdayDateInYear('09-08', year), undefined);
  }
});
