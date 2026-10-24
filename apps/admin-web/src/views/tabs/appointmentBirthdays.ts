export function normalizeBirthday(value?: string): string | undefined {
  const match = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(value?.trim() || '');
  if (!match) return undefined;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return undefined;
  return `${match[1]}-${match[2]}`;
}

export function birthdayDateInYear(value: string | undefined, year: number): string | undefined {
  const birthday = normalizeBirthday(value);
  if (!birthday || !Number.isInteger(year) || year < 1 || year > 9999) return undefined;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (birthday === '02-29' && !leapYear) return undefined;
  return `${String(year).padStart(4, '0')}-${birthday}`;
}
