import { PricingSchema } from '@sandbox/types';
import { validateTradeAttributes } from './schema-validator';

const schema: PricingSchema = {
  fields: [
    { name: 'heatingPowerKw', type: 'number', required: true, min: 1, max: 1000 },
    { name: 'brand', type: 'string', required: false },
    { name: 'certified', type: 'boolean', required: true },
    { name: 'frameMaterial', type: 'enum', required: true, allowedValues: ['wood', 'pvc', 'alu'] },
    {
      name: 'woodTreatment',
      type: 'string',
      required: true,
      dependsOn: { field: 'frameMaterial', equals: 'wood' },
    },
  ],
};

describe('validateTradeAttributes', () => {
  it('returns valid for a correct attribute set', () => {
    const result = validateTradeAttributes(
      { heatingPowerKw: 10, certified: true, frameMaterial: 'pvc' },
      schema,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns an error for a missing required field', () => {
    const result = validateTradeAttributes(
      { heatingPowerKw: 10, frameMaterial: 'pvc' }, // missing: certified
      schema,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Field 'certified' is required");
  });

  it('returns an error for wrong type on a string field', () => {
    const result = validateTradeAttributes(
      { heatingPowerKw: 10, certified: true, frameMaterial: 'pvc', brand: 123 },
      schema,
    );
    expect(result.errors).toContain("Field 'brand' must be a string");
  });

  it('returns an error when number is below min', () => {
    const result = validateTradeAttributes(
      { heatingPowerKw: 0, certified: true, frameMaterial: 'pvc' },
      schema,
    );
    expect(result.errors).toContain("Field 'heatingPowerKw' must be >= 1");
  });

  it('returns an error when number is above max', () => {
    const result = validateTradeAttributes(
      { heatingPowerKw: 9999, certified: true, frameMaterial: 'pvc' },
      schema,
    );
    expect(result.errors).toContain("Field 'heatingPowerKw' must be <= 1000");
  });

  it('returns an error for an invalid enum value', () => {
    const result = validateTradeAttributes(
      { heatingPowerKw: 10, certified: true, frameMaterial: 'steel' },
      schema,
    );
    expect(result.errors).toContain("Field 'frameMaterial' must be one of: wood, pvc, alu");
  });

  it('returns an error for an unknown field', () => {
    const result = validateTradeAttributes(
      { heatingPowerKw: 10, certified: true, frameMaterial: 'pvc', unknown: 'x' },
      schema,
    );
    expect(result.errors).toContain("Unknown field: 'unknown'");
  });

  describe('dependsOn rule', () => {
    it('requires woodTreatment when frameMaterial is wood', () => {
      const result = validateTradeAttributes(
        { heatingPowerKw: 10, certified: true, frameMaterial: 'wood' }, // missing woodTreatment
        schema,
      );
      expect(result.errors).toContain("Field 'woodTreatment' is required");
    });

    it('does not require woodTreatment when frameMaterial is not wood', () => {
      const result = validateTradeAttributes(
        { heatingPowerKw: 10, certified: true, frameMaterial: 'pvc' },
        schema,
      );
      expect(result.valid).toBe(true);
    });

    it('ignores woodTreatment if present but condition is not met', () => {
      const result = validateTradeAttributes(
        { heatingPowerKw: 10, certified: true, frameMaterial: 'alu', woodTreatment: 'oiled' },
        schema,
      );
      expect(result.valid).toBe(true); // condition not met → field is accepted, not an error
    });

    it('validates woodTreatment type when condition is met', () => {
      const result = validateTradeAttributes(
        { heatingPowerKw: 10, certified: true, frameMaterial: 'wood', woodTreatment: 42 },
        schema,
      );
      expect(result.errors).toContain("Field 'woodTreatment' must be a string");
    });
  });

  it('returns valid for an empty schema regardless of attributes', () => {
    const result = validateTradeAttributes({ anything: 'x' }, { fields: [] });
    // 'anything' is unknown since schema has no fields
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Unknown field: 'anything'");
  });

  it('returns valid for empty attributes with an empty schema', () => {
    const result = validateTradeAttributes({}, { fields: [] });
    expect(result.valid).toBe(true);
  });
});
