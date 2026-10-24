import type { RevenueOverview, RevenuePeriodSummary } from '@member-platform/shared';

export interface RevenueOrderRow {
  orderDate: string;
  originalPrice: number;
  finalPrice: number;
}

export interface RevenueRechargeRow {
  date: string;
  amount: number;
}

export function buildRevenueOverview(
  selectedMonth: string,
  orders: RevenueOrderRow[],
  recharges: RevenueRechargeRow[],
): RevenueOverview {
  const match = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(selectedMonth);
  if (!match) {
    throw new Error('invalid revenue month');
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const yearText = String(year);
  const createSummary = (period: string): RevenuePeriodSummary => ({
    period,
    consumptionAmount: 0,
    originalAmount: 0,
    discountAmount: 0,
    orderCount: 0,
    rechargeAmount: 0,
    rechargeCount: 0,
  });
  const monthly = Array.from({ length: 12 }, (_, index) =>
    createSummary(`${yearText}-${String(index + 1).padStart(2, '0')}`),
  );
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const daily = Array.from({ length: daysInMonth }, (_, index) =>
    createSummary(`${selectedMonth}-${String(index + 1).padStart(2, '0')}`),
  );
  const monthlyByPeriod = new Map(monthly.map((item) => [item.period, item]));
  const dailyByPeriod = new Map(daily.map((item) => [item.period, item]));

  orders.forEach((order) => {
    addConsumption(monthlyByPeriod.get(order.orderDate.slice(0, 7)), order);
    addConsumption(dailyByPeriod.get(order.orderDate), order);
  });
  recharges.forEach((recharge) => {
    addRecharge(monthlyByPeriod.get(recharge.date.slice(0, 7)), recharge.amount);
    addRecharge(dailyByPeriod.get(recharge.date), recharge.amount);
  });

  return {
    selectedMonth,
    monthSummary: { ...monthly[monthNumber - 1] },
    daily,
    monthly,
  };
}

function addConsumption(summary: RevenuePeriodSummary | undefined, order: RevenueOrderRow): void {
  if (!summary) return;
  summary.orderCount += 1;
  summary.originalAmount = round2(summary.originalAmount + order.originalPrice);
  summary.consumptionAmount = round2(summary.consumptionAmount + order.finalPrice);
  summary.discountAmount = round2(summary.discountAmount + order.originalPrice - order.finalPrice);
}

function addRecharge(summary: RevenuePeriodSummary | undefined, amount: number): void {
  if (!summary) return;
  summary.rechargeCount += 1;
  summary.rechargeAmount = round2(summary.rechargeAmount + amount);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
