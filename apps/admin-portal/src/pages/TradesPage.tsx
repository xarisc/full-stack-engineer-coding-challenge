import {
  Alert,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../services/api.service';
import { listTrades, TradeConfigResponse } from '../services/trades.service';
import { SchemaEditor } from './SchemaEditor';

/**
 * Read-only trade list. Shows the *current* state of each trade's pricing
 * schema (read from `metadata.pricingSchema`, the temporary holding spot
 * until the candidate adds a typed `pricingSchema` column on TradeConfig).
 *
 * The candidate's job is to:
 *   1. Add a typed `pricingSchema` field to TradeConfig (backend).
 *   2. Add `PATCH /trades/:trade` (ADMIN) that updates it.
 *   3. Add a structured editor UI here (or a child route) for managing the
 *      schema's fields (name, type, required, min/max, enum values, dependsOn).
 *   4. Surface validation errors from the backend in the UI.
 */
export function TradesPage(): JSX.Element {
  const { t } = useTranslation();
  const [trades, setTrades] = useState<TradeConfigResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);

  useEffect(() => {
    listTrades()
      .then(setTrades)
      .catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : t('trades.loadFailed');
        setError(message);
      });
  }, [t]);

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!trades) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" width={240} height={48} />
        <Skeleton variant="rounded" height={320} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1">{t('trades.heading')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('trades.subheading')}
        </Typography>
      </Stack>

      {trades.length === 0 ? (
        <Paper sx={{ p: 4 }}>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {t('trades.emptyState')}
          </Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{t('trades.columns.code')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('trades.columns.displayName')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">
                    {t('trades.columns.isActive')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    {t('trades.columns.fieldCount')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow
                    key={trade.id}
                    hover
                    selected={trade.trade === selectedTrade}
                    onClick={() =>
                      setSelectedTrade((prev) => (prev === trade.trade ? null : trade.trade))
                    }
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {trade.trade}
                      </Typography>
                    </TableCell>
                    <TableCell>{trade.displayName}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={trade.isActive ? '✓' : '—'}
                        size="small"
                        color={trade.isActive ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">
                        {(trade.pricingSchema?.fields ?? []).length}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/*
        Schema editor — shown when the user clicks a trade row.
        onSaved syncs the local trades list so the field count updates.
      */}
      {selectedTrade &&
        trades &&
        (() => {
          const trade = trades.find((tr) => tr.trade === selectedTrade);
          return trade ? (
            <SchemaEditor
              trade={trade}
              onSaved={(updated) =>
                setTrades((prev) =>
                  prev ? prev.map((tr) => (tr.trade === updated.trade ? updated : tr)) : prev,
                )
              }
            />
          ) : null;
        })()}
    </Stack>
  );
}

/**
 * Reads `metadata.pricingSchema.fields[]` if present and returns the field
 * count. Returns 0 if no schema is configured yet.
 *
 * Exported for testing — see TradesPage.spec.ts.
 */
export function countSchemaFields(metadata: Record<string, unknown>): number {
  const schema = metadata?.pricingSchema as { fields?: unknown[] } | undefined;
  if (!schema || !Array.isArray(schema.fields)) {
    return 0;
  }
  return schema.fields.length;
}
