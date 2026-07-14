import { buildRevenueOverview } from './revenue-summary';

describe('buildRevenueOverview', () => {
  it('groups consumption and recharge amounts without mixing their accounting meanings', () => {
    const result = buildRevenueOverview(
      '2026-07',
      [
        { orderDate: '2026-07-02', originalPrice: 100, finalPrice: 90 },
        { orderDate: '2026-07-02', originalPrice: 50, finalPrice: 50 },
        { orderDate: '2026-07-18', originalPrice: 80, finalPrice: 72 },
      ],
      [
        { date: '2026-07-02', amount: 300 },
        { date: '2026-07-20', amount: 500 },
      ],
    );

    expect(result.monthSummary).toMatchObject({
      consumptionAmount: 212,
      originalAmount: 230,
      discountAmount: 18,
      orderCount: 3,
      rechargeAmount: 800,
      rechargeCount: 2,
    });
    expect(result.daily.find((item) => item.period === '2026-07-02')).toMatchObject({
      consumptionAmount: 140,
      orderCount: 2,
      rechargeAmount: 300,
    });
    expect(result.monthly.find((item) => item.period === '2026-07')).toEqual(result.monthSummary);
  });

  it('keeps zero-value days and all twelve months for bookkeeping', () => {
    const result = buildRevenueOverview('2028-02', [], []);

    expect(result.daily).toHaveLength(29);
    expect(result.monthly).toHaveLength(12);
    expect(result.daily[0].period).toBe('2028-02-01');
    expect(result.daily[0].consumptionAmount).toBe(0);
  });

  it('rejects an invalid reporting month', () => {
    expect(() => buildRevenueOverview('2026-13', [], [])).toThrow('invalid revenue month');
  });
});
