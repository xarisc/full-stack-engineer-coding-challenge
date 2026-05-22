import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
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
import { useEffect, useState } from 'react';
import {
  Control,
  Controller,
  FieldErrors,
  UseFormRegister,
  useForm,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PricingSchemaField, PricingSchemaFieldType } from '@sandbox/types';
import { PositionResponse, UpsertPositionDto } from '../services/pricing-catalog.service';
import { TradeConfigResponse, fetchTradeConfig } from '../services/trades.service';

// ─── Pure helper — exported for tests ────────────────────────────────────────
// helper for tests. maps backend pricingSchema fields to UI-ready config. Separate function so the rendering logic is testable without a DOM.
export interface FormFieldConfig {
  name: string;
  type: PricingSchemaFieldType;
  required: boolean;
  min?: number;
  max?: number;
  allowedValues?: string[];
  dependsOn?: { field: string; equals: string | number | boolean };
}

export function schemaFieldsToFormConfig(fields: PricingSchemaField[]): FormFieldConfig[] {
  return fields.map((f) => ({
    name: f.name,
    type: f.type,
    required: f.required,
    min: f.min,
    max: f.max,
    allowedValues: f.allowedValues,
    dependsOn: f.dependsOn,
  }));
}

// form type. user enters human-friendly values, converted on submit. All tradeAttributes as strings, parsed per schema type on submit.
interface PositionForm {
  key: string;
  label: string;
  unit: string;
  netPriceEuros: string;
  vatPercent: string;
  minQuantity: string;
  maxQuantity: string;
  tradeAttributes: Record<string, string>;
}

const UNIT_OPTIONS = ['piece', 'm2', 'meter', 'hour', 'flat'] as const;

// props
export interface PositionDialogProps {
  open: boolean;
  trade: string;
  position?: PositionResponse; // undefined = add mode, defined = edit mode
  onSave: (dto: UpsertPositionDto) => Promise<void>;
  onClose: () => void;
}

// dynamic field component. Renders one dynamic pricingSchema field. Conditionally hidden via dependsOn.
function DynamicField({
  field,
  control,
  register,
  errors,
  watchedAttrs,
}: {
  field: FormFieldConfig;
  control: Control<PositionForm>;
  register: UseFormRegister<PositionForm>;
  errors: FieldErrors<PositionForm>;
  watchedAttrs: Record<string, string>;
}): JSX.Element | null {
  // dependsOn: hide field when the condition is not met
  if (field.dependsOn) {
    const current = watchedAttrs[field.dependsOn.field];
    if (String(current) !== String(field.dependsOn.equals)) return null;
  }

  const fieldPath = `tradeAttributes.${field.name}` as `tradeAttributes.${string}`;

  if (field.type === 'boolean') {
    return (
      <Controller
        name={fieldPath}
        control={control}
        render={({ field: f }) => (
          <FormControlLabel
            control={
              <Checkbox
                checked={f.value === 'true'}
                onChange={(e) => f.onChange(String(e.target.checked))}
              />
            }
            label={field.name}
          />
        )}
      />
    );
  }

  if (field.type === 'enum') {
    return (
      <Controller
        name={fieldPath}
        control={control}
        rules={{ required: field.required ? 'Pflichtfeld' : false }}
        render={({ field: f, fieldState }) => (
          <FormControl fullWidth error={!!fieldState.error}>
            <InputLabel>{field.name}</InputLabel>
            <Select {...f} label={field.name}>
              {(field.allowedValues ?? []).map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </Select>
            {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
          </FormControl>
        )}
      />
    );
  }

  // string | number → TextField
  return (
    <TextField
      {...register(fieldPath, {
        required: field.required ? 'Pflichtfeld' : false,
        ...(field.type === 'number' &&
          field.min !== undefined && {
            min: { value: field.min, message: `Min: ${field.min}` },
          }),
        ...(field.type === 'number' &&
          field.max !== undefined && {
            max: { value: field.max, message: `Max: ${field.max}` },
          }),
      })}
      label={field.name}
      type={field.type === 'number' ? 'number' : 'text'}
      fullWidth
      error={!!errors.tradeAttributes?.[field.name]}
      helperText={errors.tradeAttributes?.[field.name]?.message}
      inputProps={
        field.type === 'number' ? { min: field.min, max: field.max, step: 'any' } : undefined
      }
    />
  );
}

// main component
export function PositionDialog({
  open,
  trade,
  position,
  onSave,
  onClose,
}: PositionDialogProps): JSX.Element {
  const { t } = useTranslation();
  const isEditMode = !!position;

  const [tradeConfig, setTradeConfig] = useState<TradeConfigResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const schemaFields = tradeConfig?.pricingSchema
    ? schemaFieldsToFormConfig(tradeConfig.pricingSchema.fields)
    : [];

  const buildDefaults = (pos?: PositionResponse): PositionForm => ({
    key: pos?.key ?? '',
    label: pos?.label ?? '',
    unit: pos?.unit ?? 'piece',
    netPriceEuros: pos ? (pos.netPriceCents / 100).toFixed(2) : '',
    vatPercent: pos ? (pos.vatRate * 100).toFixed(2) : '19.00',
    minQuantity: pos?.minQuantity != null ? String(pos.minQuantity) : '',
    maxQuantity: pos?.maxQuantity != null ? String(pos.maxQuantity) : '',
    tradeAttributes: Object.fromEntries(
      Object.entries(pos?.tradeAttributes ?? {}).map(([k, v]) => [k, String(v)]),
    ),
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PositionForm>({ defaultValues: buildDefaults(position) });

  // Watch tradeAttributes to evaluate dependsOn conditions
  const watchedAttrs = (useWatch({ control, name: 'tradeAttributes' }) ?? {}) as Record<
    string,
    string
  >;

  // Load trade config when dialog opens
  useEffect(() => {
    if (!open || !trade) return;
    fetchTradeConfig(trade)
      .then(setTradeConfig)
      .catch(() => setTradeConfig(null));
  }, [open, trade]);

  // Reset form every time the dialog re-opens or switches between positions
  useEffect(() => {
    if (open) reset(buildDefaults(position));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position]);

  const onSubmit = async (values: PositionForm): Promise<void> => {
    setSaving(true);
    try {
      // Parse tradeAttributes back to their proper types
      const tradeAttributes: Record<string, unknown> = {};
      for (const field of schemaFields) {
        const raw = values.tradeAttributes[field.name];
        if (raw === undefined || raw === '') continue;
        if (field.type === 'number') tradeAttributes[field.name] = parseFloat(raw);
        else if (field.type === 'boolean') tradeAttributes[field.name] = raw === 'true';
        else tradeAttributes[field.name] = raw;
      }

      await onSave({
        key: values.key.trim(),
        label: values.label.trim(),
        unit: values.unit,
        netPriceCents: Math.round(parseFloat(values.netPriceEuros) * 100),
        vatRate: parseFloat(values.vatPercent) / 100,
        minQuantity: values.minQuantity !== '' ? parseFloat(values.minQuantity) : null,
        maxQuantity: values.maxQuantity !== '' ? parseFloat(values.maxQuantity) : null,
        tradeAttributes,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEditMode ? t('pricing.positionDialog.titleEdit') : t('pricing.positionDialog.titleAdd')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {/* ── Static position fields ── */}
          <TextField
            {...register('key', { required: t('validation.required') })}
            label={t('pricing.positionDialog.key')}
            fullWidth
            disabled={isEditMode}
            error={!!errors.key}
            helperText={errors.key?.message}
          />
          <TextField
            {...register('label', { required: t('validation.required') })}
            label={t('pricing.positionDialog.label')}
            fullWidth
            error={!!errors.label}
            helperText={errors.label?.message}
          />
          <Controller
            name="unit"
            control={control}
            rules={{ required: t('validation.required') }}
            render={({ field, fieldState }) => (
              <FormControl fullWidth error={!!fieldState.error}>
                <InputLabel>{t('pricing.positionDialog.unit')}</InputLabel>
                <Select {...field} label={t('pricing.positionDialog.unit')}>
                  {UNIT_OPTIONS.map((u) => (
                    <MenuItem key={u} value={u}>
                      {u}
                    </MenuItem>
                  ))}
                </Select>
                {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
              </FormControl>
            )}
          />
          <TextField
            {...register('netPriceEuros', {
              required: t('validation.required'),
              min: { value: 0, message: 'Min: 0' },
            })}
            label={t('pricing.positionDialog.netPrice')}
            type="number"
            fullWidth
            inputProps={{ min: 0, step: '0.01' }}
            error={!!errors.netPriceEuros}
            helperText={errors.netPriceEuros?.message ?? t('pricing.positionDialog.netPriceHint')}
          />
          <TextField
            {...register('vatPercent', {
              required: t('validation.required'),
              min: { value: 0, message: 'Min: 0' },
              max: { value: 100, message: 'Max: 100' },
            })}
            label={t('pricing.positionDialog.vatRate')}
            type="number"
            fullWidth
            inputProps={{ min: 0, max: 100, step: '0.01' }}
            error={!!errors.vatPercent}
            helperText={errors.vatPercent?.message ?? t('pricing.positionDialog.vatRateHint')}
          />
          <TextField
            {...register('minQuantity')}
            label={t('pricing.positionDialog.minQuantity')}
            type="number"
            fullWidth
            inputProps={{ min: 0, step: 'any' }}
          />
          <TextField
            {...register('maxQuantity')}
            label={t('pricing.positionDialog.maxQuantity')}
            type="number"
            fullWidth
            inputProps={{ min: 0, step: 'any' }}
          />

          {/* dynamic trade-attribute fields from pricingSchema */}
          {schemaFields.map((field) => (
            <DynamicField
              key={field.name}
              field={field}
              control={control}
              register={register}
              errors={errors}
              watchedAttrs={watchedAttrs}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('pricing.cancel')}</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : t('pricing.positionDialog.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
