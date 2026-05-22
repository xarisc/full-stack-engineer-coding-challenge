import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class UpsertSurchargeDto {
  @ApiProperty()
  @IsString()
  @Length(1, 100)
  key: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  label: string;

  @ApiProperty({ enum: ['flat', 'percentage'] })
  @IsIn(['flat', 'percentage'])
  type: 'flat' | 'percentage';

  @ApiProperty({ required: false, nullable: true })
  @ValidateIf((o) => o.type === 'flat')
  @IsInt()
  @Min(0)
  valueCents: number | null;

  @ApiProperty({ required: false, nullable: true })
  @ValidateIf((o) => o.type === 'percentage')
  @IsNumber()
  @Min(0)
  percentage: number | null;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpsertPositionDto {
  @ApiProperty()
  @IsString()
  @Length(1, 100)
  key: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  label: string;

  @ApiProperty({ enum: ['piece', 'm2', 'meter', 'hour', 'flat'] })
  @IsIn(['piece', 'm2', 'meter', 'hour', 'flat'])
  unit: string;

  @ApiProperty({ description: 'Net price in integer cents, e.g. 19900 = €199.00' })
  @IsInt()
  @Min(0)
  netPriceCents: number;

  @ApiProperty({ description: 'VAT rate as decimal, e.g. 0.1900 = 19%' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  vatRate: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  minQuantity: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  maxQuantity: number | null;

  @ApiProperty({ required: false, description: 'Trade-specific attributes stored as object' })
  @IsOptional()
  @IsObject()
  tradeAttributes?: Record<string, unknown>;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ type: [UpsertSurchargeDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertSurchargeDto)
  surcharges?: UpsertSurchargeDto[];
}

export class UpsertDiscountDto {
  @ApiProperty()
  @IsString()
  @Length(1, 100)
  key: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  label: string;

  @ApiProperty({ enum: ['flat', 'percentage'] })
  @IsIn(['flat', 'percentage'])
  type: 'flat' | 'percentage';

  @ApiProperty({ required: false, nullable: true })
  @ValidateIf((o) => o.type === 'flat')
  @IsInt()
  @Min(0)
  valueCents: number | null;

  @ApiProperty({ required: false, nullable: true })
  @ValidateIf((o) => o.type === 'percentage')
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  percentage: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  capCents: number | null;

  @ApiProperty({ enum: ['subtotal', 'positions'] })
  @IsIn(['subtotal', 'positions'])
  appliesToType: 'subtotal' | 'positions';

  @ApiProperty({ type: [String], required: false, nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  positionKeys: string[] | null;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCatalogVersionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiProperty({ type: [UpsertPositionDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertPositionDto)
  positions?: UpsertPositionDto[];

  @ApiProperty({ type: [UpsertDiscountDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertDiscountDto)
  discounts?: UpsertDiscountDto[];
}
