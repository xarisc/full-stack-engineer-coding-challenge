import { apiClient } from './api.service';

export interface SurchargeResponse {
  id: string;
  key: string;
  label: string;
  type: string;
  valueCents: number | null;
  percentage: number | null;
  valueFormatted: string | null;
  sortOrder: number;
}

export interface PositionResponse {
  id: string;
  key: string;
  label: string;
  unit: string;
  netPriceCents: number;
  netPriceFormatted: string;
  vatRate: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  tradeAttributes: Record<string, unknown>;
  sortOrder: number;
  surcharges: SurchargeResponse[];
}

export interface DiscountResponse {
  id: string;
  key: string;
  label: string;
  type: string;
  valueCents: number | null;
  percentage: number | null;
  capCents: number | null;
  appliesToType: string;
  positionKeys: string[] | null;
  sortOrder: number;
}

export type CatalogVersionStatus = 'DRAFT' | 'PUBLISHED';

export interface CatalogVersionResponse {
  id: string;
  craftsmanId: string;
  trade: string;
  status: CatalogVersionStatus;
  effectiveFrom: string;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  positions: PositionResponse[];
  discounts: DiscountResponse[];
}

export interface QuoteLineItem {
  positionKey: string;
  quantity: number;
  appliedSurchargeKeys?: string[];
}

export interface QuoteResponse {
  subtotalCents: number;
  subtotalFormatted: string;
  totalDiscountCents: number;
  discountedNetCents: number;
  totalVatCents: number;
  totalGrossCents: number;
  totalGrossFormatted: string;
  lines: {
    positionKey: string;
    quantity: number;
    baseLineCents: number;
    surcharges: { key: string; label: string; valueCents: number }[];
    lineNetCents: number;
  }[];
  discounts: { key: string; label: string; discountCents: number }[];
  vatGroups: { vatRate: number; netCents: number; vatCents: number }[];
}

export interface UpsertSurchargeDto {
  key: string;
  label: string;
  type: string;
  valueCents: number | null;
  percentage: number | null;
  sortOrder?: number;
}

export interface UpsertPositionDto {
  key: string;
  label: string;
  unit: string;
  netPriceCents: number;
  vatRate: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  tradeAttributes: Record<string, unknown>;
  sortOrder?: number;
  surcharges?: UpsertSurchargeDto[];
}

export interface UpsertDiscountDto {
  key: string;
  label: string;
  type: 'flat' | 'percentage';
  valueCents: number | null;
  percentage: number | null;
  capCents: number | null;
  appliesToType: 'subtotal' | 'positions';
  positionKeys?: string[] | null;
  sortOrder?: number;
}

export interface UpdateCatalogDto {
  effectiveFrom?: string;
  positions?: UpsertPositionDto[];
  discounts?: UpsertDiscountDto[];
}

export function listCatalogVersions(query?: {
  craftsmanId?: string;
  trade?: string;
}): Promise<CatalogVersionResponse[]> {
  return apiClient
    .get<CatalogVersionResponse[]>('/pricing-catalogs', { params: query })
    .then((r) => r.data);
}

export function getCatalogVersion(id: string): Promise<CatalogVersionResponse> {
  return apiClient.get<CatalogVersionResponse>(`/pricing-catalogs/${id}`).then((r) => r.data);
}

export function createCatalogVersion(dto: {
  craftsmanId: string;
  trade: string;
  effectiveFrom: string;
}): Promise<CatalogVersionResponse> {
  return apiClient.post<CatalogVersionResponse>('/pricing-catalogs', dto).then((r) => r.data);
}

export function updateCatalogVersion(
  id: string,
  dto: UpdateCatalogDto,
): Promise<CatalogVersionResponse> {
  return apiClient
    .patch<CatalogVersionResponse>(`/pricing-catalogs/${id}`, dto)
    .then((r) => r.data);
}

export function publishCatalogVersion(id: string): Promise<CatalogVersionResponse> {
  return apiClient
    .post<CatalogVersionResponse>(`/pricing-catalogs/${id}/publish`)
    .then((r) => r.data);
}

export function quoteCatalogVersion(
  id: string,
  dto: { lineItems: QuoteLineItem[] },
): Promise<QuoteResponse> {
  return apiClient.post<QuoteResponse>(`/pricing-catalogs/${id}/quote`, dto).then((r) => r.data);
}
