import { ApiProperty } from '@nestjs/swagger';
import { TRADE_CODES, TradeCode } from '@sandbox/types';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryCatalogVersionsDto {
  @ApiProperty({ required: false, description: 'Filter by craftsman ID' })
  @IsOptional()
  @IsUUID()
  craftsmanId?: string;

  @ApiProperty({ required: false, enum: TRADE_CODES })
  @IsOptional()
  trade?: TradeCode;
}
