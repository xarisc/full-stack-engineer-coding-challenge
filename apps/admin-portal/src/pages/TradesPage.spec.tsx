import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { countSchemaFields } from './TradesPage';
import {
  FieldEditorState,
  SchemaFieldDialog,
  formStateToSchemaField,
  schemaFieldToFormState,
  validateFieldForm,
} from './SchemaFieldDialog';
import type { PricingSchemaField } from '@sandbox/types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

describe('countSchemaFields', () => {
  it('returns 0 when metadata has no pricingSchema', () => {
    expect(countSchemaFields({})).toBe(0);
  });

  it('returns 0 when pricingSchema is not an object', () => {
    expect(countSchemaFields({ pricingSchema: 'not-an-object' })).toBe(0);
  });

  it('returns 0 when pricingSchema.fields is missing', () => {
    expect(countSchemaFields({ pricingSchema: {} })).toBe(0);
  });

  it('returns 0 when pricingSchema.fields is not an array', () => {
    expect(countSchemaFields({ pricingSchema: { fields: 'oops' } })).toBe(0);
  });

  it('returns the field count when schema is well-formed', () => {
    expect(
      countSchemaFields({
        pricingSchema: {
          fields: [
            { name: 'heatingPowerKw', type: 'number' },
            { name: 'inverterModel', type: 'string' },
          ],
        },
      }),
    ).toBe(2);
  });
});

// ─── schemaFieldToFormState / formStateToSchemaField ─────────────────────────

const numberField: PricingSchemaField = {
  name: 'heatingPowerKw',
  type: 'number',
  required: true,
  min: 5,
  max: 150,
};

const enumField: PricingSchemaField = {
  name: 'frameMaterial',
  type: 'enum',
  required: false,
  allowedValues: ['wood', 'pvc', 'aluminium'],
  dependsOn: { field: 'windowType', equals: 'casement' },
};

describe('schemaFieldToFormState', () => {
  it('maps a number field to form state', () => {
    const state = schemaFieldToFormState(numberField);
    expect(state.name).toBe('heatingPowerKw');
    expect(state.type).toBe('number');
    expect(state.required).toBe(true);
    expect(state.min).toBe('5');
    expect(state.max).toBe('150');
    expect(state.allowedValues).toBe('');
    expect(state.dependsOnField).toBe('');
  });

  it('maps an enum field with dependsOn to form state', () => {
    const state = schemaFieldToFormState(enumField);
    expect(state.type).toBe('enum');
    expect(state.allowedValues).toBe('wood, pvc, aluminium');
    expect(state.dependsOnField).toBe('windowType');
    expect(state.dependsOnEquals).toBe('casement');
  });

  it('maps a boolean field (no min/max/values)', () => {
    const field: PricingSchemaField = { name: 'isRenovation', type: 'boolean', required: true };
    const state = schemaFieldToFormState(field);
    expect(state.min).toBe('');
    expect(state.max).toBe('');
    expect(state.allowedValues).toBe('');
  });
});

describe('formStateToSchemaField', () => {
  it('round-trips a number field', () => {
    const state = schemaFieldToFormState(numberField);
    expect(formStateToSchemaField(state)).toEqual(numberField);
  });

  it('round-trips an enum field with dependsOn', () => {
    const state = schemaFieldToFormState(enumField);
    expect(formStateToSchemaField(state)).toEqual(enumField);
  });

  it('omits min/max for non-number types', () => {
    const state: FieldEditorState = {
      name: 'color',
      type: 'string',
      required: false,
      min: '3',
      max: '10',
      allowedValues: '',
      dependsOnField: '',
      dependsOnEquals: '',
    };
    const result = formStateToSchemaField(state);
    expect(result.min).toBeUndefined();
    expect(result.max).toBeUndefined();
  });

  it('omits allowedValues for non-enum types', () => {
    const state: FieldEditorState = {
      name: 'note',
      type: 'string',
      required: false,
      min: '',
      max: '',
      allowedValues: 'a, b, c',
      dependsOnField: '',
      dependsOnEquals: '',
    };
    const result = formStateToSchemaField(state);
    expect(result.allowedValues).toBeUndefined();
  });

  it('omits dependsOn when dependsOnField is empty', () => {
    const state = schemaFieldToFormState({ name: 'x', type: 'string', required: false });
    const result = formStateToSchemaField(state);
    expect(result.dependsOn).toBeUndefined();
  });
});

// ─── validateFieldForm ────────────────────────────────────────────────────────

const baseState: FieldEditorState = {
  name: 'newField',
  type: 'string',
  required: false,
  min: '',
  max: '',
  allowedValues: '',
  dependsOnField: '',
  dependsOnEquals: '',
};

describe('validateFieldForm', () => {
  it('returns no errors for a valid string field', () => {
    expect(validateFieldForm(baseState, [])).toHaveLength(0);
  });

  it('returns error when name is empty', () => {
    const errs = validateFieldForm({ ...baseState, name: '' }, []);
    expect(errs).toContain('trades.schema.fieldDialog.errors.nameRequired');
  });

  it('returns error on duplicate name', () => {
    const errs = validateFieldForm(baseState, ['newField']);
    expect(errs).toContain('trades.schema.fieldDialog.errors.nameDuplicate');
  });

  it('allows same name when editing that field (editingName matches)', () => {
    const errs = validateFieldForm(baseState, ['newField'], 'newField');
    expect(errs).toHaveLength(0);
  });

  it('returns error when number min > max', () => {
    const errs = validateFieldForm({ ...baseState, type: 'number', min: '100', max: '10' }, []);
    expect(errs).toContain('trades.schema.fieldDialog.errors.minMaxInvalid');
  });

  it('allows min === max for number type', () => {
    const errs = validateFieldForm({ ...baseState, type: 'number', min: '10', max: '10' }, []);
    expect(errs).not.toContain('trades.schema.fieldDialog.errors.minMaxInvalid');
  });

  it('returns error when enum allowedValues is empty', () => {
    const errs = validateFieldForm({ ...baseState, type: 'enum', allowedValues: '' }, []);
    expect(errs).toContain('trades.schema.fieldDialog.errors.enumEmpty');
  });

  it('returns error when enum allowedValues contains only whitespace', () => {
    const errs = validateFieldForm({ ...baseState, type: 'enum', allowedValues: '  ,  ,  ' }, []);
    expect(errs).toContain('trades.schema.fieldDialog.errors.enumEmpty');
  });

  it('returns error when dependsOnField references an unknown field', () => {
    const errs = validateFieldForm(
      { ...baseState, dependsOnField: 'ghost', dependsOnEquals: 'yes' },
      ['realField'],
    );
    expect(errs).toContain('trades.schema.fieldDialog.errors.dependsOnUnknown');
  });

  it('allows dependsOnField when field exists in existingNames', () => {
    const errs = validateFieldForm(
      { ...baseState, dependsOnField: 'realField', dependsOnEquals: 'yes' },
      ['realField'],
    );
    expect(errs).not.toContain('trades.schema.fieldDialog.errors.dependsOnUnknown');
  });
});

// ─── SchemaFieldDialog — integration: type switch clears irrelevant inputs ────

describe('SchemaFieldDialog — type switch clears inputs', () => {
  it('clears min and max when switching from number to enum', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(<SchemaFieldDialog open={true} existingFields={[]} onSave={onSave} onClose={onClose} />);

    // 1. Fill in name
    await user.type(screen.getByLabelText('trades.schema.fieldDialog.name'), 'myField');

    // 2. Switch type to 'number' via the Select (first combobox = Type)
    const [typeSelect] = screen.getAllByRole('combobox');
    await user.click(typeSelect);
    await user.click(screen.getByRole('option', { name: 'trades.schema.types.number' }));

    // 3. Fill in min/max (now visible)
    await waitFor(() =>
      expect(screen.getByLabelText('trades.schema.fieldDialog.min')).toBeInTheDocument(),
    );
    await user.type(screen.getByLabelText('trades.schema.fieldDialog.min'), '5');
    await user.type(screen.getByLabelText('trades.schema.fieldDialog.max'), '100');

    // 4. Switch type to 'enum' — min/max should disappear and their values cleared
    const [typeSelectAgain] = screen.getAllByRole('combobox');
    await user.click(typeSelectAgain);
    await user.click(screen.getByRole('option', { name: 'trades.schema.types.enum' }));

    await waitFor(() =>
      expect(screen.queryByLabelText('trades.schema.fieldDialog.min')).not.toBeInTheDocument(),
    );
    expect(screen.queryByLabelText('trades.schema.fieldDialog.max')).not.toBeInTheDocument();
  });
});
