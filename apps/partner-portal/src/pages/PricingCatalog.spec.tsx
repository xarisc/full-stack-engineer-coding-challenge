import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { positionToDto } from './PricingCatalogPage';
import { schemaFieldsToFormConfig, PositionDialog } from './PositionDialog';
import { quoteLinesToRows } from './QuotePanel';
import type { PositionResponse } from '../services/pricing-catalog.service';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('../services/trades.service', () => ({
  fetchTradeConfig: vi.fn().mockResolvedValue({ trade: 'GAS', pricingSchema: null }),
}));

// positionToDto

const basePosition: PositionResponse = {
  id: 'pos-1',
  key: 'labor',
  label: 'Labor costs',
  unit: 'hour',
  netPriceCents: 8500,
  netPriceFormatted: '85,00 €',
  vatRate: 0.19,
  minQuantity: 1,
  maxQuantity: 40,
  tradeAttributes: { specialty: 'plumbing' },
  sortOrder: 0,
  surcharges: [
    {
      id: 'sur-1',
      key: 'weekend',
      label: 'Weekend surcharge',
      type: 'percentage',
      valueCents: null,
      percentage: 0.25,
      valueFormatted: null,
      sortOrder: 0,
    },
  ],
};

describe('positionToDto', () => {
  it('maps all scalar fields correctly', () => {
    const dto = positionToDto(basePosition);

    expect(dto.key).toBe('labor');
    expect(dto.label).toBe('Labor costs');
    expect(dto.unit).toBe('hour');
    expect(dto.netPriceCents).toBe(8500);
    expect(dto.vatRate).toBe(0.19);
    expect(dto.minQuantity).toBe(1);
    expect(dto.maxQuantity).toBe(40);
    expect(dto.tradeAttributes).toEqual({ specialty: 'plumbing' });
  });

  it('maps surcharges to upsert shape', () => {
    const dto = positionToDto(basePosition);

    expect(dto.surcharges).toHaveLength(1);
    expect(dto.surcharges![0]).toEqual({
      key: 'weekend',
      label: 'Weekend surcharge',
      type: 'percentage',
      valueCents: null,
      percentage: 0.25,
    });
  });

  it('returns empty surcharges array when surcharges is empty', () => {
    const dto = positionToDto({ ...basePosition, surcharges: [] });

    expect(dto.surcharges).toEqual([]);
  });

  it('preserves null for optional quantity fields', () => {
    const dto = positionToDto({ ...basePosition, minQuantity: null, maxQuantity: null });

    expect(dto.minQuantity).toBeNull();
    expect(dto.maxQuantity).toBeNull();
  });

  it('does not include id or formatting fields in the dto', () => {
    const dto = positionToDto(basePosition);

    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('netPriceFormatted');
    expect(dto).not.toHaveProperty('sortOrder');
  });
});

// schemaFieldsToFormConfig

describe('schemaFieldsToFormConfig', () => {
  it('returns empty array for empty input', () => {
    expect(schemaFieldsToFormConfig([])).toEqual([]);
  });

  it('maps a required string field', () => {
    const [cfg] = schemaFieldsToFormConfig([
      { name: 'frameColor', type: 'string', required: true },
    ]);

    expect(cfg.name).toBe('frameColor');
    expect(cfg.type).toBe('string');
    expect(cfg.required).toBe(true);
    expect(cfg.min).toBeUndefined();
    expect(cfg.max).toBeUndefined();
    expect(cfg.allowedValues).toBeUndefined();
    expect(cfg.dependsOn).toBeUndefined();
  });

  it('maps a number field with min/max', () => {
    const [cfg] = schemaFieldsToFormConfig([
      { name: 'heatingPowerKw', type: 'number', required: false, min: 0, max: 1000 },
    ]);

    expect(cfg.type).toBe('number');
    expect(cfg.min).toBe(0);
    expect(cfg.max).toBe(1000);
    expect(cfg.required).toBe(false);
  });

  it('maps an enum field with allowedValues', () => {
    const [cfg] = schemaFieldsToFormConfig([
      {
        name: 'frameMaterial',
        type: 'enum',
        required: true,
        allowedValues: ['wood', 'aluminum', 'pvc'],
      },
    ]);

    expect(cfg.type).toBe('enum');
    expect(cfg.allowedValues).toEqual(['wood', 'aluminum', 'pvc']);
  });

  it('maps a boolean field', () => {
    const [cfg] = schemaFieldsToFormConfig([
      { name: 'hasInsulation', type: 'boolean', required: false },
    ]);

    expect(cfg.type).toBe('boolean');
    expect(cfg.required).toBe(false);
  });

  it('preserves dependsOn condition', () => {
    const [cfg] = schemaFieldsToFormConfig([
      {
        name: 'woodType',
        type: 'enum',
        required: true,
        allowedValues: ['oak', 'pine'],
        dependsOn: { field: 'frameMaterial', equals: 'wood' },
      },
    ]);

    expect(cfg.dependsOn).toEqual({ field: 'frameMaterial', equals: 'wood' });
  });

  it('maps multiple fields preserving order', () => {
    const input = [
      { name: 'a', type: 'string' as const, required: false },
      { name: 'b', type: 'number' as const, required: true },
      { name: 'c', type: 'boolean' as const, required: false },
    ];
    const configs = schemaFieldsToFormConfig(input);

    expect(configs.map((c) => c.name)).toEqual(['a', 'b', 'c']);
  });
});

// quoteLinesToRows

const positions: PositionResponse[] = [
  { ...basePosition, key: 'labor', label: 'Labor costs' },
  { ...basePosition, id: 'pos-2', key: 'material', label: 'Material costs' },
];

describe('quoteLinesToRows', () => {
  it('enriches a line with the matching position label', () => {
    const [row] = quoteLinesToRows(
      [
        {
          positionKey: 'labor',
          quantity: 2,
          baseLineCents: 17000,
          lineNetCents: 17000,
          surcharges: [],
        },
      ],
      positions,
    );

    expect(row.positionLabel).toBe('Labor costs');
    expect(row.quantity).toBe(2);
    expect(row.baseLineCents).toBe(17000);
    expect(row.lineNetCents).toBe(17000);
  });

  it('falls back to positionKey when no matching position is found', () => {
    const [row] = quoteLinesToRows(
      [
        {
          positionKey: 'unknown-key',
          quantity: 1,
          baseLineCents: 100,
          lineNetCents: 100,
          surcharges: [],
        },
      ],
      positions,
    );

    expect(row.positionLabel).toBe('unknown-key');
  });

  it('preserves surcharges on each row', () => {
    const surcharges = [{ key: 'weekend', label: 'Weekend', valueCents: 425 }];
    const [row] = quoteLinesToRows(
      [{ positionKey: 'labor', quantity: 1, baseLineCents: 8500, lineNetCents: 8925, surcharges }],
      positions,
    );

    expect(row.surcharges).toEqual(surcharges);
  });

  it('handles multiple lines independently', () => {
    const rows = quoteLinesToRows(
      [
        {
          positionKey: 'labor',
          quantity: 3,
          baseLineCents: 25500,
          lineNetCents: 25500,
          surcharges: [],
        },
        {
          positionKey: 'material',
          quantity: 1,
          baseLineCents: 5000,
          lineNetCents: 5000,
          surcharges: [],
        },
      ],
      positions,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].positionLabel).toBe('Labor costs');
    expect(rows[1].positionLabel).toBe('Material costs');
  });

  it('returns empty array for empty lines', () => {
    expect(quoteLinesToRows([], positions)).toEqual([]);
  });
});

// ─── PositionDialog — integration: validation error display ──────────────────

describe('PositionDialog — validation error display', () => {
  it('shows required validation errors for all mandatory fields when submitting empty form', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(<PositionDialog open={true} trade="GAS" onSave={onSave} onClose={onClose} />);

    // Click Save without filling any field
    await user.click(screen.getByText('pricing.positionDialog.save'));

    // react-hook-form validation should fire; i18n mock returns key as-is
    await waitFor(() => {
      const errors = screen.getAllByText('validation.required');
      // key, label, unit, netPriceEuros, vatPercent — at least 3 required errors visible
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    // onSave must NOT have been called
    expect(onSave).not.toHaveBeenCalled();
  });
});
