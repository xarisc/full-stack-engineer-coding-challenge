import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeConfig } from './entities/trade-config.entity';
import { TradesService } from './trades.service';
import { TradesController } from './trades.controller';
import { PricingPosition } from '../pricing-catalogs/entities/pricing-position.entity';
import { CatalogVersion } from '../pricing-catalogs/entities/catalog-version.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TradeConfig, PricingPosition, CatalogVersion])],
  providers: [TradesService],
  controllers: [TradesController],
  exports: [TradesService],
})
export class TradesModule {}
