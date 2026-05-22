import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  PositionResponse,
  QuoteLineItem,
  QuoteResponse,
  quoteCatalogVersion,
} from '../services/pricing-catalog.service';

// helpers for tests. maps backend quote lines to enriched display rows with position label. Separate function so the rendering logic is testable without a DOM.
export interface QuoteLineRow {
  positionKey: string;
  positionLabel: string;
  quantity: number;
  baseLineCents: number;
  lineNetCents: number;
  surcharges: { key: string; label: string; valueCents: number }[];
}

export function quoteLinesToRows(
  lines: QuoteResponse['lines'],
  positions: PositionResponse[],
): QuoteLineRow[] {
  return lines.map((line) => {
    const pos = positions.find((p) => p.key === line.positionKey);
    return {
      positionKey: line.positionKey,
      positionLabel: pos?.label ?? line.positionKey,
      quantity: line.quantity,
      baseLineCents: line.baseLineCents,
      lineNetCents: line.lineNetCents,
      surcharges: line.surcharges,
    };
  });
}

// formatting helper
function formatCents(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

// form type
interface LineItemForm {
  positionKey: string;
  quantity: string;
}

interface QuoteForm {
  lineItems: LineItemForm[];
}

// Props
export interface QuotePanelProps {
  versionId: string;
  positions: PositionResponse[];
}

// Component
export function QuotePanel({ versionId, positions }: QuotePanelProps): JSX.Element {
  const { t } = useTranslation();

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<QuoteForm>({
    defaultValues: { lineItems: [{ positionKey: '', quantity: '1' }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });

  const onSubmit = async (values: QuoteForm): Promise<void> => {
    setLoading(true);
    setCalcError(null);
    try {
      const lineItems: QuoteLineItem[] = values.lineItems
        .filter((li) => li.positionKey !== '')
        .map((li) => ({ positionKey: li.positionKey, quantity: parseFloat(li.quantity) }));

      const result = await quoteCatalogVersion(versionId, { lineItems });
      setQuote(result);
    } catch {
      setCalcError(t('pricing.quote.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const rows = quote ? quoteLinesToRows(quote.lines, positions) : [];

  return (
    <Stack spacing={3}>
      {/* Line-item form */}
      <Stack spacing={1.5}>
        {fields.map((field, index) => (
          <Stack key={field.id} direction="row" spacing={1} alignItems="flex-start">
            <Controller
              name={`lineItems.${index}.positionKey`}
              control={control}
              rules={{ required: t('validation.required') }}
              render={({ field: f, fieldState }) => (
                <FormControl fullWidth error={!!fieldState.error}>
                  <InputLabel>{t('pricing.quote.position')}</InputLabel>
                  <Select {...f} label={t('pricing.quote.position')}>
                    {positions.map((p) => (
                      <MenuItem key={p.key} value={p.key}>
                        {p.label} — {p.netPriceFormatted} / {p.unit}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <TextField
              {...register(`lineItems.${index}.quantity`, {
                required: t('validation.required'),
                min: { value: 0.01, message: 'Min: 0.01' },
              })}
              label={t('pricing.quote.quantity')}
              type="number"
              sx={{ width: 140 }}
              inputProps={{ min: 0.01, step: 'any' }}
              error={!!errors.lineItems?.[index]?.quantity}
              helperText={errors.lineItems?.[index]?.quantity?.message}
            />
            <IconButton
              onClick={() => remove(index)}
              disabled={fields.length <= 1}
              aria-label={t('pricing.quote.removeItem')}
              sx={{ mt: 0.5 }}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        ))}

        <Box>
          <Button
            startIcon={<AddIcon />}
            size="small"
            onClick={() => append({ positionKey: '', quantity: '1' })}
          >
            {t('pricing.quote.addItem')}
          </Button>
        </Box>
      </Stack>

      <Button
        variant="contained"
        onClick={handleSubmit(onSubmit)}
        disabled={loading || positions.length === 0}
        sx={{ alignSelf: 'flex-start' }}
      >
        {loading ? <CircularProgress size={20} /> : t('pricing.quote.calculate')}
      </Button>

      {calcError && <Typography color="error">{calcError}</Typography>}

      {/* Quote result */}
      {quote && (
        <Stack spacing={2}>
          {/* Line items table */}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('pricing.quote.colPosition')}</TableCell>
                <TableCell align="right">{t('pricing.quote.colQty')}</TableCell>
                <TableCell align="right">{t('pricing.quote.colBase')}</TableCell>
                <TableCell align="right">{t('pricing.quote.colNet')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.positionKey}>
                  <TableCell>
                    <Stack spacing={0}>
                      <span>{row.positionLabel}</span>
                      {row.surcharges.map((s) => (
                        <Typography key={s.key} variant="caption" color="text.secondary">
                          + {s.label} ({formatCents(s.valueCents)})
                        </Typography>
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{row.quantity}</TableCell>
                  <TableCell align="right">{formatCents(row.baseLineCents)}</TableCell>
                  <TableCell align="right">{formatCents(row.lineNetCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Applied discounts */}
          {quote.discounts.length > 0 && (
            <Stack spacing={0.5}>
              {quote.discounts.map((d) => (
                <Stack key={d.key} direction="row" justifyContent="space-between">
                  <Typography variant="body2">{d.label}</Typography>
                  <Typography variant="body2" color="error.main">
                    −{formatCents(d.discountCents)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}

          <Divider />

          {/* VAT groups */}
          {quote.vatGroups.map((vg) => (
            <Stack key={vg.vatRate} spacing={0.25}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">
                  {t('pricing.quote.netLabel', { vat: (vg.vatRate * 100).toFixed(0) })}
                </Typography>
                <Typography variant="body2">{formatCents(vg.netCents)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">
                  {t('pricing.quote.vatLabel', { vat: (vg.vatRate * 100).toFixed(0) })}
                </Typography>
                <Typography variant="body2">{formatCents(vg.vatCents)}</Typography>
              </Stack>
            </Stack>
          ))}

          <Divider />

          {/* Grand total */}
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight={700}>
              {t('pricing.quote.totalGross')}
            </Typography>
            <Typography variant="subtitle1" fontWeight={700}>
              {quote.totalGrossFormatted}
            </Typography>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
