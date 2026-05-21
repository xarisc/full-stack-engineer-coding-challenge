import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class QuoteLineItemDto {
  @ApiProperty()
  @IsString()
  positionKey: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  quantity: number;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  appliedSurchargeKeys?: string[];
}

export class QuoteRequestDto {
  @ApiProperty({ type: [QuoteLineItemDto] })
  @Type(() => QuoteLineItemDto)
  @ValidateNested({ each: true })
  @IsArray()
  lineItems: QuoteLineItemDto[];
}
