import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../services/api.service';
import { CraftsmanResponse, fetchCraftsman } from '../services/craftsmen.service';
import {
  CatalogVersionResponse,
  PositionResponse,
  UpsertPositionDto,
  createCatalogVersion,
  getCatalogVersion,
  listCatalogVersions,
  publishCatalogVersion,
  updateCatalogVersion,
} from '../services/pricing-catalog.service';
import { PositionDialog } from './PositionDialog';
import { QuotePanel } from './QuotePanel';

// helpers for testing. maps PositionResponse to an UpsertPositionDto. needed because PATCH replaces the full position array every time.
export function positionToDto(p: PositionResponse): UpsertPositionDto {
  return {
    key: p.key,
    label: p.label,
    unit: p.unit,
    netPriceCents: p.netPriceCents,
    vatRate: p.vatRate,
    minQuantity: p.minQuantity,
    maxQuantity: p.maxQuantity,
    tradeAttributes: p.tradeAttributes,
    surcharges: (p.surcharges ?? []).map((s) => ({
      key: s.key,
      label: s.label,
      type: s.type,
      valueCents: s.valueCents,
      percentage: s.percentage,
    })),
  };
}

// types: undefined = not loaded yet, null = loaded + no catalog exists
type TradeVersionState = CatalogVersionResponse | null | undefined;

interface SnackState {
  severity: 'success' | 'error';
  message: string;
}

// component
export function PricingCatalogPage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [craftsman, setCraftsman] = useState<CraftsmanResponse | null>(null);
  const [craftLoading, setCraftLoading] = useState(true);
  const [craftError, setCraftError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState(0);
  // Key = trade code. undefined=not loaded, null=no catalog, object=loaded catalog
  const [versionCache, setVersionCache] = useState<Record<string, TradeVersionState>>({});
  const [tradeLoading, setTradeLoading] = useState(false);

  const [positionDialog, setPositionDialog] = useState<{
    open: boolean;
    position?: PositionResponse;
  }>({ open: false });
  const [publishDialog, setPublishDialog] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
  const [snack, setSnack] = useState<SnackState | null>(null);

  // load craftsman
  useEffect(() => {
    if (!user?.craftsmanId) {
      setCraftLoading(false);
      return;
    }
    fetchCraftsman(user.craftsmanId)
      .then(setCraftsman)
      .catch((err: unknown) => {
        setCraftError(err instanceof ApiError ? err.message : t('app.errors.generic'));
      })
      .finally(() => setCraftLoading(false));
  }, [user, t]);

  // load version for active tab (lazy)
  useEffect(() => {
    if (!craftsman) return;
    const trade = craftsman.trades[activeTab];
    if (!trade || versionCache[trade] !== undefined) return; // already loaded or loading

    setTradeLoading(true);
    listCatalogVersions({ craftsmanId: craftsman.id, trade })
      .then((list) => {
        if (list.length === 0) {
          setVersionCache((prev) => ({ ...prev, [trade]: null }));
          return;
        }
        // list is newest-first; the first is the current working version
        return getCatalogVersion(list[0].id).then((full) => {
          setVersionCache((prev) => ({ ...prev, [trade]: full }));
        });
      })
      .catch(() => {
        setVersionCache((prev) => ({ ...prev, [trade]: null }));
        setSnack({ severity: 'error', message: t('pricing.messages.loadFailed') });
      })
      .finally(() => setTradeLoading(false));
  }, [craftsman, activeTab, versionCache, t]);

  // derived state
  const currentTrade = craftsman?.trades[activeTab] ?? '';
  const currentVersion = versionCache[currentTrade];
  const isDraft = currentVersion?.status === 'DRAFT';
  const isPublished = currentVersion?.status === 'PUBLISHED';

  // helper to update cached version after edits, to avoid refetching after every change
  const setCurrentVersion = (v: CatalogVersionResponse): void => {
    setVersionCache((prev) => ({ ...prev, [currentTrade]: v }));
  };

  // handlers
  const handleCreateDraft = async (): Promise<void> => {
    if (!craftsman) return;
    try {
      const created = await createCatalogVersion({
        craftsmanId: craftsman.id,
        trade: currentTrade,
        effectiveFrom: new Date().toISOString().split('T')[0],
      });
      setCurrentVersion(created);
      setSnack({ severity: 'success', message: t('pricing.messages.created') });
    } catch (err: unknown) {
      setSnack({
        severity: 'error',
        message: err instanceof ApiError ? err.message : t('app.errors.generic'),
      });
    }
  };

  const handleSavePosition = async (dto: UpsertPositionDto): Promise<void> => {
    if (!currentVersion) return;
    const existing = currentVersion.positions;

    // Edit: replace by key. Add: append.
    const editingKey = positionDialog.position?.key;
    const newPositions = editingKey
      ? existing.map((p) => (p.key === editingKey ? dto : positionToDto(p)))
      : [...existing.map(positionToDto), dto];

    try {
      const updated = await updateCatalogVersion(currentVersion.id, {
        effectiveFrom: currentVersion.effectiveFrom,
        positions: newPositions,
      });
      setCurrentVersion(updated);
      setPositionDialog({ open: false });
      setSnack({ severity: 'success', message: t('pricing.messages.saved') });
    } catch (err: unknown) {
      setSnack({
        severity: 'error',
        message: err instanceof ApiError ? err.message : t('app.errors.generic'),
      });
    }
  };

  const handleDeletePosition = async (key: string): Promise<void> => {
    if (!currentVersion) return;
    const positions = currentVersion.positions.filter((p) => p.key !== key).map(positionToDto);
    try {
      const updated = await updateCatalogVersion(currentVersion.id, {
        effectiveFrom: currentVersion.effectiveFrom,
        positions,
      });
      setCurrentVersion(updated);
      setSnack({ severity: 'success', message: t('pricing.messages.saved') });
    } catch (err: unknown) {
      setSnack({
        severity: 'error',
        message: err instanceof ApiError ? err.message : t('app.errors.generic'),
      });
    }
  };

  const handlePublish = async (): Promise<void> => {
    if (!currentVersion) return;
    setPublishing(true);
    try {
      const published = await publishCatalogVersion(currentVersion.id);
      setCurrentVersion(published);
      setPublishDialog(false);
      setSnack({ severity: 'success', message: t('pricing.messages.published') });
    } catch (err: unknown) {
      setSnack({
        severity: 'error',
        message: err instanceof ApiError ? err.message : t('app.errors.generic'),
      });
    } finally {
      setPublishing(false);
    }
  };

  // rendering
  if (craftLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: '50vh' }}>
        <CircularProgress />
      </Stack>
    );
  }
  if (craftError) return <Alert severity="error">{craftError}</Alert>;
  if (!craftsman) return <Alert severity="info">{t('pricing.empty')}</Alert>;
  if (craftsman.trades.length === 0) return <Alert severity="info">{t('pricing.noTrades')}</Alert>;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>
        {t('pricing.heading')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('pricing.subheading')}
      </Typography>

      <Tabs
        value={activeTab}
        onChange={(_, v: number) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        {craftsman.trades.map((trade) => (
          <Tab key={trade} label={trade} />
        ))}
      </Tabs>

      {/* Loading state per trade tab */}
      {tradeLoading && <CircularProgress size={32} />}

      {/* No catalog yet */}
      {!tradeLoading && currentVersion === null && (
        <Stack spacing={2} alignItems="flex-start">
          <Alert severity="info">{t('pricing.noDraft')}</Alert>
          <Button variant="contained" onClick={handleCreateDraft}>
            {t('pricing.createDraft')}
          </Button>
        </Stack>
      )}

      {/* Catalog exists */}
      {!tradeLoading && currentVersion && (
        <Stack spacing={3}>
          {/* Header row: status + actions */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2">
              {t('pricing.status')}:{' '}
              <strong>{t(`pricing.statusLabel.${currentVersion.status}`)}</strong>
            </Typography>
            {isDraft && (
              <>
                <Button variant="outlined" onClick={() => setPositionDialog({ open: true })}>
                  {t('pricing.addPosition')}
                </Button>
                <Button variant="contained" onClick={() => setPublishDialog(true)}>
                  {t('pricing.publish')}
                </Button>
              </>
            )}
          </Stack>

          {/* Positions table */}
          {currentVersion.positions.length === 0 ? (
            <Alert severity="info">{t('pricing.noPositions')}</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('pricing.columns.key')}</TableCell>
                    <TableCell>{t('pricing.columns.label')}</TableCell>
                    <TableCell>{t('pricing.columns.unit')}</TableCell>
                    <TableCell align="right">{t('pricing.columns.price')}</TableCell>
                    <TableCell>{t('pricing.columns.vat')}</TableCell>
                    <TableCell>{t('pricing.columns.attributes')}</TableCell>
                    {isDraft && <TableCell>{t('pricing.columns.actions')}</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentVersion.positions.map((pos) => (
                    <TableRow key={pos.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {pos.key}
                        </Typography>
                      </TableCell>
                      <TableCell>{pos.label}</TableCell>
                      <TableCell>{pos.unit}</TableCell>
                      <TableCell align="right">{pos.netPriceFormatted}</TableCell>
                      <TableCell>{(pos.vatRate * 100).toFixed(1)} %</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {Object.entries(pos.tradeAttributes ?? {}).length > 0
                            ? Object.entries(pos.tradeAttributes)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' · ')
                            : '–'}
                        </Typography>
                      </TableCell>
                      {isDraft && (
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              onClick={() => setPositionDialog({ open: true, position: pos })}
                            >
                              {t('pricing.edit')}
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => setDeleteConfirmKey(pos.key)}
                            >
                              {t('pricing.delete')}
                            </Button>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Quote panel — only for published versions */}
          {isPublished && (
            <QuotePanel versionId={currentVersion.id} positions={currentVersion.positions} />
          )}
        </Stack>
      )}

      {/* Position Dialog */}
      <PositionDialog
        open={positionDialog.open}
        trade={currentTrade}
        position={positionDialog.position}
        onSave={handleSavePosition}
        onClose={() => setPositionDialog({ open: false })}
      />

      {/* Delete confirm Dialog */}
      <Dialog open={!!deleteConfirmKey} onClose={() => setDeleteConfirmKey(null)}>
        <DialogTitle>{t('pricing.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('pricing.deleteConfirmText')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmKey(null)}>{t('pricing.cancel')}</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (deleteConfirmKey) handleDeletePosition(deleteConfirmKey);
              setDeleteConfirmKey(null);
            }}
          >
            {t('pricing.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Publish confirm Dialog */}
      <Dialog open={publishDialog} onClose={() => setPublishDialog(false)}>
        <DialogTitle>{t('pricing.publishConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('pricing.publishConfirmText')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishDialog(false)}>{t('pricing.cancel')}</Button>
          <Button variant="contained" onClick={handlePublish} disabled={publishing}>
            {publishing ? <CircularProgress size={20} /> : t('pricing.publish')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        <Alert severity={snack?.severity ?? 'success'} onClose={() => setSnack(null)}>
          {snack?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
