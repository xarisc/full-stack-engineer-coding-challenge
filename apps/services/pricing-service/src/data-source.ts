import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Craftsman } from './app/craftsmen/entities/craftsman.entity';
import { CraftsmanTradeAssignment } from './app/craftsmen/entities/craftsman-trade-assignment.entity';
import { TradeConfig } from './app/trades/entities/trade-config.entity';
import { CatalogDiscount } from './app/pricing-catalogs/entities/catalog-discount.entity';
import { CatalogVersion } from './app/pricing-catalogs/entities/catalog-version.entity';
import { PricingPosition } from './app/pricing-catalogs/entities/pricing-position.entity';
import { PositionSurcharge } from './app/pricing-catalogs/entities/position-surcharge.entity';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'pricing',
  schema: process.env.DATABASE_SCHEMA ?? 'pricing_service',
  entities: [
    Craftsman,
    CraftsmanTradeAssignment,
    TradeConfig,
    CatalogDiscount,
    CatalogVersion,
    PricingPosition,
    PositionSurcharge,
  ],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsRun: false,
  synchronize: false,
  logging: false,
};

export const AppDataSource = new DataSource(dataSourceOptions);
