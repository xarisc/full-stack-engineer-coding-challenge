import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@sandbox/types';
import { AppDataSource } from './data-source';
import { User } from './app/auth/entities/user.entity';

const log = new Logger('Seed');

/**
 * Deterministic id for the partner craftsman. Must match the seed in
 * pricing-service so that JWT `craftsmanId` claims resolve to a real craftsman.
 * Cross-service id alignment is by convention; there is no FK across schemas.
 */

// changed to viable v4 UUID
const legacy_PARTNER_CRAFTSMAN_ID = '11111111-1111-1111-1111-111111111111';
const PARTNER_CRAFTSMAN_ID = '11111111-1111-4111-a111-111111111111';

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  log.log('Connected to database');

  const users = AppDataSource.getRepository(User);
  const adminHash = await bcrypt.hash('admin123', 10);
  const partnerHash = await bcrypt.hash('partner123', 10);

  const seeds = [
    {
      email: 'admin@example.com',
      passwordHash: adminHash,
      roles: [UserRole.ADMIN],
      craftsmanId: null,
    },
    {
      email: 'partner@example.com',
      passwordHash: partnerHash,
      roles: [UserRole.CRAFTSMAN],
      craftsmanId: PARTNER_CRAFTSMAN_ID,
    },
  ] as const;

  for (const u of seeds) {
    const existing = await users.findOne({ where: { email: u.email } });
    if (!existing) {
      await users.save(users.create({ ...u, isActive: true }));
      log.log(`+ user ${u.email}`);
    } else {
      log.log(`= user ${u.email} already exists`);
    }
  }

  await AppDataSource.destroy();
  log.log('Seed complete');
}

seed().catch((err) => {
  log.error(err);
  process.exit(1);
});
