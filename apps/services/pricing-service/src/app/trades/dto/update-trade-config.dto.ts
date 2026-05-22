import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { PricingSchema } from '@sandbox/types';

// Wir validieren pricingSchema als generisches Object — die inhaltliche
// Validierung macht der schema-validator zur Laufzeit.
// Tiefe class-validator-Validierung des verschachtelten PricingSchema wäre
// möglich, aber für diese Challenge unverhältnismäßig aufwändig.
export class UpdateTradeConfigDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  displayName?: string;

  @ApiProperty({ required: false, nullable: true, type: Object })
  @IsOptional()
  pricingSchema?: PricingSchema | null;
}
