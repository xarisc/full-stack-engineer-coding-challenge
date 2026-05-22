import { PricingSchema } from '@sandbox/types';
import { apiClient } from './api.service';

export interface TradeConfigResponse {
  id: string;
  trade: string;
  displayName: string;
  isActive: boolean;
  pricingSchema: PricingSchema | null;
}

export function fetchTradeConfig(trade: string): Promise<TradeConfigResponse> {
  return apiClient.get<TradeConfigResponse>(`/trades/${trade}`).then((r) => r.data);
}
