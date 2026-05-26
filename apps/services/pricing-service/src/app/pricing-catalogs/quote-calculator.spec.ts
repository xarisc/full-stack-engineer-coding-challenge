import { calculateQuote, DiscountData, PositionData, QuoteLineItem } from './quote-calculator';

const makePosition = (overrides: Partial<PositionData> = {}): PositionData => ({
  key: 'pos-1',
  label: 'Grundposition',
  unit: 'piece',
  netPriceCents: 10000, // €100,00
  vatRate: 0.19,
  minQuantity: null,
  maxQuantity: null,
  surcharges: [],
  ...overrides,
});

describe('calculateQuote', () => {
  describe('basic line calculation', () => {
    it('calculates a single line with no surcharges and no discounts', () => {
      const result = calculateQuote([{ positionKey: 'pos-1', quantity: 2 }], [makePosition()], []);
      expect(result.lines[0].lineNetCents).toBe(20000);
      expect(result.lines[0].lineTotalCents).toBe(20000);
      expect(result.subtotalCents).toBe(20000);
      expect(result.totalDiscountCents).toBe(0);
      expect(result.vatGroups[0].vatCents).toBe(3800); // 20000 × 0.19
      expect(result.totalGrossCents).toBe(23800);
    });

    it('returns zero totals for an empty line list', () => {
      const result = calculateQuote([], [makePosition()], []);
      expect(result.subtotalCents).toBe(0);
      expect(result.totalGrossCents).toBe(0);
      expect(result.vatGroups).toHaveLength(0);
    });

    it('handles a zero-quantity line without error', () => {
      const result = calculateQuote([{ positionKey: 'pos-1', quantity: 0 }], [makePosition()], []);
      expect(result.lines[0].lineNetCents).toBe(0);
      expect(result.totalGrossCents).toBe(0);
    });
  });

  describe('surcharges', () => {
    it('applies a flat surcharge', () => {
      const pos = makePosition({
        surcharges: [
          { key: 's1', label: 'Aufschlag', type: 'flat', valueCents: 500, percentage: null },
        ],
      });
      const result = calculateQuote(
        [{ positionKey: 'pos-1', quantity: 1, appliedSurchargeKeys: ['s1'] }],
        [pos],
        [],
      );
      expect(result.lines[0].surchargeTotalCents).toBe(500);
      expect(result.lines[0].lineTotalCents).toBe(10500);
    });

    it('applies a percentage surcharge with half-up rounding', () => {
      // 10000 × 7% = 700.00 → 700
      const pos = makePosition({
        surcharges: [
          { key: 's1', label: 'Zuschlag', type: 'percentage', valueCents: null, percentage: 7 },
        ],
      });
      const result = calculateQuote(
        [{ positionKey: 'pos-1', quantity: 1, appliedSurchargeKeys: ['s1'] }],
        [pos],
        [],
      );
      expect(result.lines[0].surcharges[0].amountCents).toBe(700);
    });

    it('does not apply surcharges that are not requested', () => {
      const pos = makePosition({
        surcharges: [
          { key: 's1', label: 'Aufschlag', type: 'flat', valueCents: 500, percentage: null },
        ],
      });
      const result = calculateQuote(
        [{ positionKey: 'pos-1', quantity: 1 }], // no appliedSurchargeKeys
        [pos],
        [],
      );
      expect(result.lines[0].surchargeTotalCents).toBe(0);
    });
  });

  describe('discounts', () => {
    it('applies a flat discount on the subtotal', () => {
      const result = calculateQuote(
        [{ positionKey: 'pos-1', quantity: 1 }],
        [makePosition()],
        [
          {
            key: 'd1',
            label: 'Rabatt',
            type: 'flat',
            valueCents: 1000,
            percentage: null,
            capCents: null,
            appliesToType: 'subtotal',
            positionKeys: null,
          },
        ],
      );
      expect(result.totalDiscountCents).toBe(1000);
      expect(result.discountedNetCents).toBe(9000);
    });

    it('applies a percentage discount with a cap', () => {
      // 10% of 10000 = 1000 → capped at 800
      const result = calculateQuote(
        [{ positionKey: 'pos-1', quantity: 1 }],
        [makePosition()],
        [
          {
            key: 'd1',
            label: 'Rabatt',
            type: 'percentage',
            valueCents: null,
            percentage: 10,
            capCents: 800,
            appliesToType: 'subtotal',
            positionKeys: null,
          },
        ],
      );
      expect(result.totalDiscountCents).toBe(800);
    });

    it('applies multiple stacked discounts each on the original subtotal', () => {
      // Two 10% discounts on 10000 → 1000 + 1000 = 2000 total
      const discount: DiscountData = {
        key: 'd1',
        label: 'Rabatt',
        type: 'percentage',
        valueCents: null,
        percentage: 10,
        capCents: null,
        appliesToType: 'subtotal',
        positionKeys: null,
      };
      const result = calculateQuote(
        [{ positionKey: 'pos-1', quantity: 1 }],
        [makePosition()],
        [discount, { ...discount, key: 'd2' }],
      );
      expect(result.totalDiscountCents).toBe(2000);
      expect(result.discountedNetCents).toBe(8000);
    });

    it('applies a discount only to specified position keys', () => {
      const pos2 = makePosition({ key: 'pos-2', netPriceCents: 5000 });
      const result = calculateQuote(
        [
          { positionKey: 'pos-1', quantity: 1 },
          { positionKey: 'pos-2', quantity: 1 },
        ],
        [makePosition(), pos2],
        [
          {
            key: 'd1',
            label: 'Rabatt',
            type: 'flat',
            valueCents: 500,
            percentage: null,
            capCents: null,
            appliesToType: 'positions',
            positionKeys: ['pos-2'],
          },
        ],
      );
      expect(result.totalDiscountCents).toBe(500);
      expect(result.subtotalCents).toBe(15000);
    });

    it('populates appliedDiscounts on lines that match a position-keyed discount', () => {
      const pos2 = makePosition({ key: 'pos-2', netPriceCents: 5000 });
      const result = calculateQuote(
        [
          { positionKey: 'pos-1', quantity: 1 },
          { positionKey: 'pos-2', quantity: 1 },
        ],
        [makePosition(), pos2],
        [
          {
            key: 'd1',
            label: 'Positionsrabatt',
            type: 'flat',
            valueCents: 200,
            percentage: null,
            capCents: null,
            appliesToType: 'positions',
            positionKeys: ['pos-2'],
          },
        ],
      );
      expect(result.lines.find((l) => l.positionKey === 'pos-2')?.appliedDiscounts).toHaveLength(1);
      expect(result.lines.find((l) => l.positionKey === 'pos-1')?.appliedDiscounts).toHaveLength(0);
    });

    it('does not put subtotal-level discounts on individual lines', () => {
      const result = calculateQuote(
        [{ positionKey: 'pos-1', quantity: 1 }],
        [makePosition()],
        [
          {
            key: 'd1',
            label: 'Gesamtrabatt',
            type: 'flat',
            valueCents: 500,
            percentage: null,
            capCents: null,
            appliesToType: 'subtotal',
            positionKeys: null,
          },
        ],
      );
      expect(result.lines[0].appliedDiscounts).toHaveLength(0);
      expect(result.discounts).toHaveLength(1);
    });
  });

  describe('VAT grouping', () => {
    it('groups lines with different VAT rates separately', () => {
      const pos1 = makePosition({ key: 'pos-1', vatRate: 0.19 });
      const pos2 = makePosition({ key: 'pos-2', vatRate: 0.07 });
      const result = calculateQuote(
        [
          { positionKey: 'pos-1', quantity: 1 },
          { positionKey: 'pos-2', quantity: 1 },
        ],
        [pos1, pos2],
        [],
      );
      expect(result.vatGroups).toHaveLength(2);
      const group19 = result.vatGroups.find((g) => g.vatRate === 0.19)!;
      const group07 = result.vatGroups.find((g) => g.vatRate === 0.07)!;
      expect(group19.vatCents).toBe(1900);
      expect(group07.vatCents).toBe(700);
    });
  });

  describe('validation errors', () => {
    it('throws on unknown positionKey', () => {
      expect(() =>
        calculateQuote([{ positionKey: 'unknown', quantity: 1 }], [makePosition()], []),
      ).toThrow("Unknown position key: 'unknown'");
    });

    it('throws when quantity is below minQuantity', () => {
      expect(() =>
        calculateQuote(
          [{ positionKey: 'pos-1', quantity: 0.5 }],
          [makePosition({ minQuantity: 1 })],
          [],
        ),
      ).toThrow('below minimum');
    });

    it('throws when quantity exceeds maxQuantity', () => {
      expect(() =>
        calculateQuote(
          [{ positionKey: 'pos-1', quantity: 100 }],
          [makePosition({ maxQuantity: 10 })],
          [],
        ),
      ).toThrow('exceeds maximum');
    });

    it('throws when a surcharge key is not declared on the position', () => {
      expect(() =>
        calculateQuote(
          [{ positionKey: 'pos-1', quantity: 1, appliedSurchargeKeys: ['nonexistent'] }],
          [makePosition()],
          [],
        ),
      ).toThrow("Surcharge key 'nonexistent' is not declared on position 'pos-1'");
    });
  });

  describe('property invariants', () => {
    it('gross is always >= net for non-negative inputs', () => {
      // Try various quantities and prices
      const cases = [1, 2, 5, 10, 100];
      for (const qty of cases) {
        const result = calculateQuote(
          [{ positionKey: 'pos-1', quantity: qty }],
          [makePosition({ netPriceCents: 9999 })],
          [],
        );
        expect(result.totalGrossCents).toBeGreaterThanOrEqual(result.totalNetCents);
      }
    });

    it('doubling the quantity doubles the net', () => {
      const single = calculateQuote(
        [{ positionKey: 'pos-1', quantity: 3 }],
        [makePosition({ netPriceCents: 1000 })],
        [],
      );
      const double = calculateQuote(
        [{ positionKey: 'pos-1', quantity: 6 }],
        [makePosition({ netPriceCents: 1000 })],
        [],
      );
      expect(double.totalNetCents).toBe(single.totalNetCents * 2);
    });
  });
});
