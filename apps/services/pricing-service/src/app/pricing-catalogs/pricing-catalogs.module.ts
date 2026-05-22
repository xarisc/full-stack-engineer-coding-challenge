import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogVersion } from './entities/catalog-version.entity';
import { PricingPosition } from './entities/pricing-position.entity';
import { PositionSurcharge } from './entities/position-surcharge.entity';
import { CatalogDiscount } from './entities/catalog-discount.entity';
import { TradeConfig } from '../trades/entities/trade-config.entity';
import { Craftsman } from '../craftsmen/entities/craftsman.entity';
import { PricingCatalogsService } from './pricing-catalogs.service';
import { CraftsmanQuoteController, PricingCatalogsController } from './pricing-catalogs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CatalogVersion,
      PricingPosition,
      PositionSurcharge,
      CatalogDiscount,
      TradeConfig,
      Craftsman,
    ]),
  ],
  controllers: [PricingCatalogsController, CraftsmanQuoteController],
  providers: [PricingCatalogsService],
  exports: [PricingCatalogsService],
})
export class PricingCatalogsModule {}
