import { PricingSchema } from '@sandbox/types';
import { apiClient } from './api.service';

export interface TradeConfigResponse {
  id: string;
  trade: string;
  displayName: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  pricingSchema: PricingSchema | null;
}

export function listTrades(): Promise<TradeConfigResponse[]> {
  return apiClient.get<TradeConfigResponse[]>('/trades').then((r) => r.data);
}

export function getTrade(trade: string): Promise<TradeConfigResponse> {
  return apiClient.get<TradeConfigResponse>(`/trades/${trade}`).then((r) => r.data);
}

export interface PatchTradeDto {
  pricingSchema?: PricingSchema | null;
  displayName?: string;
}

export function patchTrade(trade: string, dto: PatchTradeDto): Promise<TradeConfigResponse> {
  return apiClient.patch<TradeConfigResponse>(`/trades/${trade}`, dto).then((r) => r.data);
}
