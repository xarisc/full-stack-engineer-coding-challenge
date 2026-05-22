import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { TRADE_CODES } from '@sandbox/types';
import { AppDataSource } from './data-source';
import { Craftsman } from './app/craftsmen/entities/craftsman.entity';
import { CraftsmanTradeAssignment } from './app/craftsmen/entities/craftsman-trade-assignment.entity';
import { TradeConfig } from './app/trades/entities/trade-config.entity';

const log = new Logger('Seed');

/**
 * Deterministic id for the partner craftsman. Must match the seed in
 * auth-service so JWT `craftsmanId` claims resolve to a real craftsman.
 * Cross-service id alignment is by convention; there is no FK across schemas.
 */

// changed to viable v4 UUID
const legacy_PARTNER_CRAFTSMAN_ID = '11111111-1111-1111-1111-111111111111';
const PARTNER_CRAFTSMAN_ID = '11111111-1111-4111-a111-111111111111';

const TRADE_NAMES: Record<string, string> = {
  HVAC: 'Heating, Ventilation & Air Conditioning',
  SOLAR: 'Solar PV',
  WINDOWS: 'Windows & Doors',
  INSULATION: 'Building Insulation',
  ROOFING: 'Roofing',
};

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  log.log('Connected to database');

  const trades = AppDataSource.getRepository(TradeConfig);
  const craftsmen = AppDataSource.getRepository(Craftsman);
  const assignments = AppDataSource.getRepository(CraftsmanTradeAssignment);

  for (const code of TRADE_CODES) {
    const existing = await trades.findOne({ where: { trade: code } });
    if (!existing) {
      await trades.save(
        trades.create({
          trade: code,
          displayName: TRADE_NAMES[code] ?? code,
          isActive: true,
          metadata: {},
        }),
      );
      log.log(`+ trade ${code}`);
    }
  }

  let partner = await craftsmen.findOne({ where: { id: PARTNER_CRAFTSMAN_ID } });
  if (!partner) {
    partner = await craftsmen.save(
      craftsmen.create({
        id: PARTNER_CRAFTSMAN_ID,
        companyName: 'Müller Heizung & Sanitär GmbH',
        email: 'kontakt@mueller-heizung.example.com',
        phone: '+49 30 12345678',
        vatNumber: 'DE123456789',
        addressLine1: 'Hauptstraße 12',
        postalCode: '10115',
        city: 'Berlin',
        country: 'Germany',
        isActive: true,
      }),
    );
    log.log(`+ craftsman ${partner.id}`);
  }

  for (const trade of ['HVAC', 'WINDOWS']) {
    const exists = await assignments.findOne({
      where: { craftsmanId: partner.id, trade },
    });
    if (!exists) {
      await assignments.save(
        assignments.create({
          craftsmanId: partner.id,
          trade,
          isActive: true,
        }),
      );
      log.log(`+ assignment ${trade} -> ${partner.id}`);
    }
  }

  await AppDataSource.destroy();
  log.log('Seed complete');
}

seed().catch((err) => {
  log.error(err);
  process.exit(1);
});
