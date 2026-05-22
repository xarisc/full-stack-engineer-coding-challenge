import { ApiProperty } from '@nestjs/swagger';
import { TradeConfig } from '../entities/trade-config.entity';
import { PricingSchema } from '@sandbox/types';

export class TradeConfigResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  trade: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: Object })
  metadata: Record<string, unknown>;

  @ApiProperty({ type: Object, nullable: true })
  pricingSchema: PricingSchema | null;

  static from(t: TradeConfig): TradeConfigResponseDto {
    return {
      id: t.id,
      trade: t.trade,
      displayName: t.displayName,
      isActive: t.isActive,
      metadata: t.metadata,
      pricingSchema: t.pricingSchema,
    };
  }
}
