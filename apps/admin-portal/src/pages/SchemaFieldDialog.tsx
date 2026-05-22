import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PricingSchemaField, PricingSchemaFieldType } from '@sandbox/types';

// ─── Form state shape ─────────────────────────────────────────────────────────

export interface FieldEditorState {
  name: string;
  type: PricingSchemaFieldType;
  required: boolean;
  /** Empty string when not applicable (non-number types). */
  min: string;
  /** Empty string when not applicable (non-number types). */
  max: string;
  /** Comma-separated. Empty string when not applicable (non-enum types). */
  allowedValues: string;
  /** Empty string when no dependsOn condition is set. */
  dependsOnField: string;
  /** Empty string when no dependsOn condition is set. */
  dependsOnEquals: string;
}

// ─── Pure helpers — exported for tests ───────────────────────────────────────

export function schemaFieldToFormState(field: PricingSchemaField): FieldEditorState {
  return {
    name: field.name,
    type: field.type,
    required: field.required,
    min: field.min != null ? String(field.min) : '',
    max: field.max != null ? String(field.max) : '',
    allowedValues: field.allowedValues?.join(', ') ?? '',
    dependsOnField: field.dependsOn?.field ?? '',
    dependsOnEquals: field.dependsOn != null ? String(field.dependsOn.equals) : '',
  };
}

export function formStateToSchemaField(state: FieldEditorState): PricingSchemaField {
  const field: PricingSchemaField = {
    name: state.name.trim(),
    type: state.type,
    required: state.required,
  };
  if (state.type === 'number') {
    if (state.min !== '') field.min = Number(state.min);
    if (state.max !== '') field.max = Number(state.max);
  }
  if (state.type === 'enum') {
    field.allowedValues = state.allowedValues
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (state.dependsOnField.trim() !== '') {
    field.dependsOn = {
      field: state.dependsOnField.trim(),
      equals: state.dependsOnEquals,
    };
  }
  return field;
}

export function validateFieldForm(
  state: FieldEditorState,
  existingNames: string[],
  editingName?: string,
): string[] {
  const errors: string[] = [];
  const trimmedName = state.name.trim();

  if (!trimmedName) {
    errors.push('trades.schema.fieldDialog.errors.nameRequired');
  } else if (existingNames.includes(trimmedName) && trimmedName !== editingName) {
    errors.push('trades.schema.fieldDialog.errors.nameDuplicate');
  }

  if (state.type === 'number' && state.min !== '' && state.max !== '') {
    if (Number(state.min) > Number(state.max)) {
      errors.push('trades.schema.fieldDialog.errors.minMaxInvalid');
    }
  }

  if (state.type === 'enum') {
    const values = state.allowedValues
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length === 0) {
      errors.push('trades.schema.fieldDialog.errors.enumEmpty');
    }
  }

  if (state.dependsOnField.trim() !== '' && !existingNames.includes(state.dependsOnField.trim())) {
    errors.push('trades.schema.fieldDialog.errors.dependsOnUnknown');
  }

  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface SchemaFieldDialogProps {
  open: boolean;
  /** Undefined in add-mode; the field to edit in edit-mode. */
  field?: PricingSchemaField;
  /** All currently defined fields — used for duplicate-name and dependsOn validation. */
  existingFields: PricingSchemaField[];
  onSave: (field: PricingSchemaField) => void;
  onClose: () => void;
}

const FIELD_TYPES: PricingSchemaFieldType[] = ['string', 'number', 'boolean', 'enum'];

const EMPTY_STATE: FieldEditorState = {
  name: '',
  type: 'string',
  required: false,
  min: '',
  max: '',
  allowedValues: '',
  dependsOnField: '',
  dependsOnEquals: '',
};

export function SchemaFieldDialog({
  open,
  field,
  existingFields,
  onSave,
  onClose,
}: SchemaFieldDialogProps): JSX.Element {
  const { t } = useTranslation();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FieldEditorState>({ defaultValues: EMPTY_STATE });

  const type = useWatch({ control, name: 'type' });
  const dependsOnField = useWatch({ control, name: 'dependsOnField' });

  // Re-populate form whenever the dialog opens
  useEffect(() => {
    if (open) {
      reset(field ? schemaFieldToFormState(field) : EMPTY_STATE);
    }
  }, [open, field, reset]);

  // Clear irrelevant fields when type changes — this is the behaviour the
  // challenge tests with an integration test (number → enum clears min/max).
  useEffect(() => {
    if (type !== 'number') {
      setValue('min', '');
      setValue('max', '');
    }
    if (type !== 'enum') {
      setValue('allowedValues', '');
    }
  }, [type, setValue]);

  const editingName = field?.name;
  // All names except the one currently being edited
  const otherNames = existingFields.map((f) => f.name).filter((n) => n !== editingName);

  const onSubmit = (state: FieldEditorState): void => {
    onSave(formStateToSchemaField(state));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle>
          {field
            ? t('trades.schema.fieldDialog.titleEdit')
            : t('trades.schema.fieldDialog.titleAdd')}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {/* Name — disabled in edit mode; name is the key and cannot change */}
            <TextField
              label={t('trades.schema.fieldDialog.name')}
              fullWidth
              disabled={!!field}
              {...register('name', {
                required: t('trades.schema.fieldDialog.errors.nameRequired'),
                validate: (v) =>
                  !otherNames.includes(v.trim())
                    ? true
                    : t('trades.schema.fieldDialog.errors.nameDuplicate'),
              })}
              error={!!errors.name}
              helperText={errors.name?.message}
            />

            {/* Type — source of truth for conditional fields */}
            <FormControl fullWidth>
              <InputLabel>{t('trades.schema.fieldDialog.type')}</InputLabel>
              <Controller
                name="type"
                control={control}
                render={({ field: f }) => (
                  <Select {...f} label={t('trades.schema.fieldDialog.type')}>
                    {FIELD_TYPES.map((ft) => (
                      <MenuItem key={ft} value={ft}>
                        {t(`trades.schema.types.${ft}`)}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>

            {/* Required */}
            <FormControlLabel
              control={
                <Controller
                  name="required"
                  control={control}
                  render={({ field: f }) => (
                    <Checkbox checked={f.value} onChange={(e) => f.onChange(e.target.checked)} />
                  )}
                />
              }
              label={t('trades.schema.fieldDialog.required')}
            />

            {/* Min / Max — visible only for number type */}
            {type === 'number' && (
              <Stack direction="row" spacing={2}>
                <TextField
                  label={t('trades.schema.fieldDialog.min')}
                  type="number"
                  fullWidth
                  {...register('min', {
                    validate: (_v, all) =>
                      all.min === '' || all.max === '' || Number(all.min) <= Number(all.max)
                        ? true
                        : t('trades.schema.fieldDialog.errors.minMaxInvalid'),
                  })}
                  error={!!errors.min}
                  helperText={errors.min?.message}
                />
                <TextField
                  label={t('trades.schema.fieldDialog.max')}
                  type="number"
                  fullWidth
                  {...register('max')}
                  error={!!errors.max}
                  helperText={errors.max?.message}
                />
              </Stack>
            )}

            {/* Allowed values — visible only for enum type */}
            {type === 'enum' && (
              <TextField
                label={t('trades.schema.fieldDialog.allowedValues')}
                fullWidth
                placeholder="oak, pine, walnut"
                {...register('allowedValues', {
                  validate: (v) => {
                    const vals = v
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    return vals.length > 0 ? true : t('trades.schema.fieldDialog.errors.enumEmpty');
                  },
                })}
                error={!!errors.allowedValues}
                helperText={errors.allowedValues?.message}
              />
            )}

            {/* dependsOn field selector */}
            <FormControl fullWidth error={!!errors.dependsOnField}>
              <InputLabel>{t('trades.schema.fieldDialog.dependsOnField')}</InputLabel>
              <Controller
                name="dependsOnField"
                control={control}
                rules={{
                  validate: (v) =>
                    v.trim() === '' || otherNames.includes(v.trim())
                      ? true
                      : t('trades.schema.fieldDialog.errors.dependsOnUnknown'),
                }}
                render={({ field: f }) => (
                  <Select {...f} label={t('trades.schema.fieldDialog.dependsOnField')}>
                    <MenuItem value="">{t('trades.schema.fieldDialog.noDependency')}</MenuItem>
                    {otherNames.map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              {errors.dependsOnField && (
                <FormHelperText>{errors.dependsOnField.message}</FormHelperText>
              )}
            </FormControl>

            {/* dependsOn equals value — visible only when a field is selected */}
            {dependsOnField && (
              <TextField
                label={t('trades.schema.fieldDialog.dependsOnEquals')}
                fullWidth
                {...register('dependsOnEquals')}
              />
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>{t('trades.schema.fieldDialog.cancel')}</Button>
          <Button type="submit" variant="contained">
            {t('trades.schema.fieldDialog.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
