import { ApiProperty } from '@nestjs/swagger';
import { CatalogVersion, CatalogVersionStatus } from '../entities/catalog-version.entity';
import { CatalogDiscount } from '../entities/catalog-discount.entity';
import { PricingPosition } from '../entities/pricing-position.entity';
import { PositionSurcharge } from '../entities/position-surcharge.entity';
import { QuoteResult } from '../quote-calculator';

const formatCents = (cents: number): string =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);

// Nested response Shapes

export class SurchargeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() key: string;
  @ApiProperty() label: string;
  @ApiProperty() type: string;
  @ApiProperty({ nullable: true }) valueCents: number | null;
  @ApiProperty({ nullable: true }) percentage: number | null;
  @ApiProperty({ nullable: true }) valueFormatted: string | null;
  @ApiProperty() sortOrder: number;

  static from(s: PositionSurcharge): SurchargeResponseDto {
    return {
      id: s.id,
      key: s.key,
      label: s.label,
      type: s.type,
      valueCents: s.valueCents,
      percentage: s.percentage,
      valueFormatted: s.valueCents !== null ? formatCents(s.valueCents) : null,
      sortOrder: s.sortOrder,
    };
  }
}

export class PositionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() key: string;
  @ApiProperty() label: string;
  @ApiProperty() unit: string;
  @ApiProperty() netPriceCents: number;
  @ApiProperty() netPriceFormatted: string;
  @ApiProperty() vatRate: number;
  @ApiProperty({ nullable: true }) minQuantity: number | null;
  @ApiProperty({ nullable: true }) maxQuantity: number | null;
  @ApiProperty() tradeAttributes: Record<string, unknown>;
  @ApiProperty() sortOrder: number;
  @ApiProperty({ type: [SurchargeResponseDto] }) surcharges: SurchargeResponseDto[];

  static from(p: PricingPosition): PositionResponseDto {
    return {
      id: p.id,
      key: p.key,
      label: p.label,
      unit: p.unit,
      netPriceCents: p.netPriceCents,
      netPriceFormatted: formatCents(p.netPriceCents),
      vatRate: p.vatRate,
      minQuantity: p.minQuantity,
      maxQuantity: p.maxQuantity,
      tradeAttributes: p.tradeAttributes,
      sortOrder: p.sortOrder,
      surcharges: (p.surcharges ?? []).map(SurchargeResponseDto.from),
    };
  }
}

export class DiscountResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() key: string;
  @ApiProperty() label: string;
  @ApiProperty() type: string;
  @ApiProperty({ nullable: true }) valueCents: number | null;
  @ApiProperty({ nullable: true }) percentage: number | null;
  @ApiProperty({ nullable: true }) capCents: number | null;
  @ApiProperty() appliesToType: string;
  @ApiProperty({ type: [String], nullable: true }) positionKeys: string[] | null;
  @ApiProperty() sortOrder: number;

  static from(d: CatalogDiscount): DiscountResponseDto {
    return {
      id: d.id,
      key: d.key,
      label: d.label,
      type: d.type,
      valueCents: d.valueCents,
      percentage: d.percentage,
      capCents: d.capCents,
      appliesToType: d.appliesToType,
      positionKeys: d.positionKeys,
      sortOrder: d.sortOrder,
    };
  }
}

// Main response DTO

export class CatalogVersionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() craftsmanId: string;
  @ApiProperty() trade: string;
  @ApiProperty({ enum: CatalogVersionStatus }) status: CatalogVersionStatus;
  @ApiProperty() effectiveFrom: string;
  @ApiProperty({ nullable: true }) publishedBy: string | null;
  @ApiProperty({ nullable: true }) publishedAt: string | null;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
  @ApiProperty({ type: [PositionResponseDto] }) positions: PositionResponseDto[];
  @ApiProperty({ type: [DiscountResponseDto] }) discounts: DiscountResponseDto[];

  static from(v: CatalogVersion): CatalogVersionResponseDto {
    return {
      id: v.id,
      craftsmanId: v.craftsmanId,
      trade: v.trade,
      status: v.status,
      effectiveFrom: v.effectiveFrom.toISOString(),
      publishedBy: v.publishedBy,
      publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      positions: (v.positions ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(PositionResponseDto.from),
      discounts: (v.discounts ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(DiscountResponseDto.from),
    };
  }
}

// Quote response DTO

export class QuoteResponseDto {
  @ApiProperty() subtotalCents: number;
  @ApiProperty() subtotalFormatted: string;
  @ApiProperty() totalDiscountCents: number;
  @ApiProperty() discountedNetCents: number;
  @ApiProperty() totalVatCents: number;
  @ApiProperty() totalGrossCents: number;
  @ApiProperty() totalGrossFormatted: string;
  @ApiProperty({ type: Object }) lines: QuoteResult['lines'];
  @ApiProperty({ type: Object }) discounts: QuoteResult['discounts'];
  @ApiProperty({ type: Object }) vatGroups: QuoteResult['vatGroups'];

  static from(q: QuoteResult): QuoteResponseDto {
    return {
      ...q,
      subtotalFormatted: formatCents(q.subtotalCents),
      totalGrossFormatted: formatCents(q.totalGrossCents),
    };
  }
}
