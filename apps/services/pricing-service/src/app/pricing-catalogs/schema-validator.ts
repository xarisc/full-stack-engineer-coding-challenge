import { PricingSchema, PricingSchemaField } from '@sandbox/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateField(field: PricingSchemaField, value: unknown, errors: string[]): void {
  switch (field.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`Field '${field.name}' must be a string`);
      }
      break;
    case 'number':
      if (typeof value !== 'number') {
        errors.push(`Field '${field.name}' must be a number`);
      } else {
        if (field.min !== undefined && value < field.min) {
          errors.push(`Field '${field.name}' must be >= ${field.min}`);
        }
        if (field.max !== undefined && value > field.max) {
          errors.push(`Field '${field.name}' must be <= ${field.max}`);
        }
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push(`Field '${field.name}' must be a boolean`);
      }
      break;
    case 'enum':
      if (!(field.allowedValues ?? []).includes(String(value))) {
        errors.push(
          `Field '${field.name}' must be one of: ${(field.allowedValues ?? []).join(', ')}`,
        );
      }
      break;
  }
}

export function validateTradeAttributes(
  attributes: Record<string, unknown>,
  schema: PricingSchema,
): ValidationResult {
  const errors: string[] = [];
  const knownFieldNames = new Set(schema.fields.map((f) => f.name));

  // Reject unknown fields
  for (const key of Object.keys(attributes)) {
    if (!knownFieldNames.has(key)) {
      errors.push(`Unknown field: '${key}'`);
    }
  }

  for (const field of schema.fields) {
    // Evaluate dependsOn condition — if condition not met, skip field entirely
    if (field.dependsOn) {
      const conditionValue = attributes[field.dependsOn.field];
      if (conditionValue !== field.dependsOn.equals) {
        continue;
      }
    }

    const value = attributes[field.name];
    const isMissing = value === undefined || value === null;

    if (isMissing) {
      if (field.required) {
        errors.push(`Field '${field.name}' is required`);
      }
      continue; // no further validation without a value
    }

    validateField(field, value, errors);
  }

  return { valid: errors.length === 0, errors };
}
