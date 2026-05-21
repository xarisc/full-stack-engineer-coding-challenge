import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsUUID } from 'class-validator';
import { TRADE_CODES, TradeCode } from '@sandbox/types';

export class CreateCatalogVersionDto {
  @ApiProperty({ description: 'ID of the craftsman this catalog version belongs to' })
  @IsUUID()
  craftsmanId: string;

  @ApiProperty({ description: 'Trade code for this catalog version', enum: TRADE_CODES })
  @IsIn(TRADE_CODES)
  trade: TradeCode;

  @ApiProperty({ description: 'Effective date of the catalog version (ISO 8601 format)' })
  @IsDateString()
  effectiveFrom: string;
}
