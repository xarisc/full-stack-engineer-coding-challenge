import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PricingSchema, PricingSchemaField } from '@sandbox/types';
import { ApiError } from '../services/api.service';
import { TradeConfigResponse, patchTrade } from '../services/trades.service';
import { SchemaFieldDialog } from './SchemaFieldDialog';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SchemaEditorProps {
  trade: TradeConfigResponse;
  onSaved: (updated: TradeConfigResponse) => void;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface FieldDialogState {
  open: boolean;
  /** Index into `fields[]`. Undefined = add-mode. */
  index?: number;
}

interface SnackState {
  severity: 'success' | 'error';
  message: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SchemaEditor({ trade, onSaved }: SchemaEditorProps): JSX.Element {
  const { t } = useTranslation();

  const [fields, setFields] = useState<PricingSchemaField[]>(
    trade.pricingSchema?.fields ?? [],
  );
  const [fieldDialog, setFieldDialog] = useState<FieldDialogState>({ open: false });
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [snack, setSnack] = useState<SnackState | null>(null);

  // ── local mutations ──────────────────────────────────────────────────────

  const handleSaveField = (saved: PricingSchemaField): void => {
    setFields((prev) => {
      if (fieldDialog.index !== undefined) {
        return prev.map((f, i) => (i === fieldDialog.index ? saved : f));
      }
      return [...prev, saved];
    });
    setFieldDialog({ open: false });
  };

  const handleDelete = (index: number): void => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMove = (index: number, direction: 'up' | 'down'): void => {
    setFields((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // ── persist to backend ───────────────────────────────────────────────────

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setConflict(false);
    const schema: PricingSchema = { fields };
    try {
      const updated = await patchTrade(trade.trade, { pricingSchema: schema });
      onSaved(updated);
      setSnack({ severity: 'success', message: t('trades.schema.messages.saved') });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(true);
      } else {
        setSnack({
          severity: 'error',
          message:
            err instanceof ApiError
              ? err.message
              : t('trades.schema.messages.saveFailed'),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{t('trades.schema.heading')}</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<AddIcon />}
              variant="outlined"
              onClick={() => setFieldDialog({ open: true })}
            >
              {t('trades.schema.addField')}
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? t('trades.schema.saving') : t('trades.schema.save')}
            </Button>
          </Stack>
        </Stack>

        {/* Conflict banner */}
        {conflict && (
          <Alert severity="warning" onClose={() => setConflict(false)}>
            {t('trades.schema.messages.conflict')}
          </Alert>
        )}

        {/* Empty state */}
        {fields.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('trades.schema.noFields')}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setFieldDialog({ open: true })}
            >
              {t('trades.schema.addFirstField')}
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('trades.schema.columns.name')}</TableCell>
                  <TableCell>{t('trades.schema.columns.type')}</TableCell>
                  <TableCell align="center">{t('trades.schema.columns.required')}</TableCell>
                  <TableCell>{t('trades.schema.columns.conditions')}</TableCell>
                  <TableCell align="right">{t('trades.schema.columns.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fields.map((f, i) => (
                  <TableRow key={f.name} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {f.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`trades.schema.types.${f.type}`)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={f.required ? '✓' : '—'}
                        size="small"
                        color={f.required ? 'primary' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {f.dependsOn
                          ? `${f.dependsOn.field} = ${f.dependsOn.equals}`
                          : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0} justifyContent="flex-end">
                        <Tooltip title={t('trades.schema.moveUp')}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={i === 0}
                              onClick={() => handleMove(i, 'up')}
                            >
                              <ArrowUpwardIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('trades.schema.moveDown')}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={i === fields.length - 1}
                              onClick={() => handleMove(i, 'down')}
                            >
                              <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('trades.schema.edit')}>
                          <IconButton
                            size="small"
                            onClick={() => setFieldDialog({ open: true, index: i })}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('trades.schema.delete')}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(i)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>

      {/* Field add/edit dialog */}
      <SchemaFieldDialog
        open={fieldDialog.open}
        field={fieldDialog.index !== undefined ? fields[fieldDialog.index] : undefined}
        existingFields={fields}
        onSave={handleSaveField}
        onClose={() => setFieldDialog({ open: false })}
      />

      {/* Snackbar */}
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        <Alert severity={snack?.severity ?? 'success'} onClose={() => setSnack(null)}>
          {snack?.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
