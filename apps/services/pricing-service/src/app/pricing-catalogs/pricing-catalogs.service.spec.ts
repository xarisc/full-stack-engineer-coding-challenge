import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, ObjectLiteral, QueryFailedError, Repository } from 'typeorm';
import { JwtPayload, UserRole } from '@sandbox/types';

import { Craftsman } from '../craftsmen/entities/craftsman.entity';
import { TradeConfig } from '../trades/entities/trade-config.entity';
import { CatalogVersion, CatalogVersionStatus } from './entities/catalog-version.entity';
import { PricingPosition, PositionUnit } from './entities/pricing-position.entity';
import { PositionSurcharge } from './entities/position-surcharge.entity';
import { CatalogDiscount } from './entities/catalog-discount.entity';
import { PricingCatalogsService } from './pricing-catalogs.service';

type Repo<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const adminUser: JwtPayload = {
  sub: 'admin',
  email: 'admin@example.com',
  roles: [UserRole.ADMIN],
  craftsmanId: null,
};

const craftsmanUserA: JwtPayload = {
  sub: 'craftsman-a',
  email: 'craftsmanA@example.com',
  roles: [UserRole.CRAFTSMAN],
  craftsmanId: 'craftsman-a-id',
};

const craftsmanUserB: JwtPayload = {
  sub: 'craftsman-b',
  email: 'craftsmanB@example.com',
  roles: [UserRole.CRAFTSMAN],
  craftsmanId: 'craftsman-b-id',
};

function buildVersion(overrides: Partial<CatalogVersion> = {}): CatalogVersion {
  return {
    id: 'version-id',
    craftsmanId: 'craftsman-a-id',
    trade: 'HVAC',
    status: CatalogVersionStatus.DRAFT,
    effectiveFrom: new Date('2026-01-01'),
    publishedBy: null,
    publishedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    positions: [],
    discounts: [],
    craftsman: null as unknown as Craftsman,
    ...overrides,
  };
}

function buildPosition(overrides: Partial<PricingPosition> = {}): PricingPosition {
  return {
    id: 'pos-id',
    versionId: 'version-id',
    key: 'pos-1',
    label: 'test position',
    unit: PositionUnit.PIECE,
    netPriceCents: 10000,
    vatRate: 0.19,
    minQuantity: null,
    maxQuantity: null,
    tradeAttributes: {},
    sortOrder: 0,
    createdAt: new Date(''),
    updatedAt: new Date(''),
    surcharges: [],
    version: null as unknown as CatalogVersion,
    ...overrides,
  };
}

describe('PricingCatalogsService', () => {
  let service: PricingCatalogsService;
  let versionsRepo: Repo<CatalogVersion> & { createQueryBuilder: jest.Mock };
  let positionsRepo: Repo<PricingPosition> & { createQueryBuilder: jest.Mock };
  let discountsRepo: Repo<CatalogDiscount>;
  let tradeConfigsRepo: Repo<TradeConfig>;
  let craftsmenRepo: Repo<Craftsman>;
  let dataSource: { transaction: jest.Mock };
  let qb: Record<string, jest.Mock>;

  // reusable QueryBuilder mock for list()
  beforeEach(async () => {
    qb = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    versionsRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((x) => x),
      save: jest.fn().mockImplementation((x) =>
        Promise.resolve({
          id: x.id ?? 'new-version-id',
          positions: x.positions ?? [],
          discounts: x.discounts ?? [],
          craftsman: x.craftsman ?? null,
          createdAt: x.createdAt ?? new Date('2026-01-01'),
          updatedAt: x.updatedAt ?? new Date('2026-01-01'),
          ...x,
        }),
      ),
    };

    positionsRepo = {
      createQueryBuilder: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation((x) => x),
      save: jest.fn().mockImplementation((x) => Promise.resolve({ ...x, id: 'new-pos-id' })),
    };

    discountsRepo = {
      delete: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation((x) => x),
      save: jest.fn().mockResolvedValue([]),
    };

    tradeConfigsRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    craftsmenRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'craftsman-a-id',
        isActive: true,
      } as Craftsman),
    };

    // DataSource-Mock: giving back the right repo for every Entity-class
    dataSource = {
      transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === CatalogVersion) return versionsRepo;
            if (entity === PricingPosition) return positionsRepo;
            if (entity === PositionSurcharge)
              return {
                save: jest.fn().mockResolvedValue([]),
                create: jest.fn().mockImplementation((x: unknown) => x),
              };
            if (entity === CatalogDiscount) return discountsRepo;
          },
        }),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PricingCatalogsService,
        { provide: getRepositoryToken(CatalogVersion), useValue: versionsRepo },
        { provide: getRepositoryToken(PricingPosition), useValue: positionsRepo },
        {
          provide: getRepositoryToken(PositionSurcharge),
          useValue: { delete: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        { provide: getRepositoryToken(CatalogDiscount), useValue: discountsRepo },
        { provide: getRepositoryToken(TradeConfig), useValue: tradeConfigsRepo },
        { provide: getRepositoryToken(Craftsman), useValue: craftsmenRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(PricingCatalogsService);
  });

  describe('list', () => {
    it('returns versions for admin without row-level filter', async () => {
      qb.getMany.mockResolvedValue([buildVersion()]);
      const result = await service.list({}, adminUser);
      expect(result).toHaveLength(1);
      // ADMIN without craftsmanId-Filter
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('ownId'),
        expect.anything(),
      );
    });

    it('scopes list to own craftsmanId for CRAFTSMAN role', async () => {
      qb.getMany.mockResolvedValue([buildVersion()]);
      await service.list({}, craftsmanUserA);
      expect(qb.andWhere).toHaveBeenCalledWith('v.craftsmanId = :ownId', {
        ownId: 'craftsman-a-id',
      });
    });

    it('returns empty array when CRAFTSMAN has no craftsmanId bound', async () => {
      const result = await service.list({}, { ...craftsmanUserA, craftsmanId: null });
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('returns a version with relations for admin', async () => {
      versionsRepo.findOne!.mockResolvedValue(buildVersion({ positions: [buildPosition()] }));
      const result = await service.findOne('version-id', adminUser);
      expect(result.id).toBe('version-id');
      expect(result.positions).toHaveLength(1);
    });

    it('throws NotFoundException when version does not exist', async () => {
      versionsRepo.findOne!.mockResolvedValue(null);
      await expect(service.findOne('missing-id', adminUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when craftsman A tries to read craftsman B catalog', async () => {
      versionsRepo.findOne!.mockResolvedValue(buildVersion({ craftsmanId: 'craftsman-b' }));
      await expect(service.findOne('version-id', craftsmanUserA)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    const dto = {
      craftsmanId: 'craftsman-a-id',
      trade: 'HVAC' as const,
      effectiveFrom: '2026-06-01',
    };

    it('creates a new DRAFT for admin', async () => {
      const result = await service.create(dto, adminUser);
      expect(versionsRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(CatalogVersionStatus.DRAFT);
    });

    it('allows craftsman to create for their own craftsmanId', async () => {
      await expect(service.create(dto, craftsmanUserA)).resolves.toBeDefined();
    });

    it('throws ForbiddenException when craftsman creates for another craftsmanId', async () => {
      await expect(
        service.create({ ...dto, craftsmanId: 'craftsman-b' }, craftsmanUserA),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when craftsman does not exist', async () => {
      craftsmenRepo.findOne!.mockResolvedValue(null);
      await expect(service.create(dto, adminUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when craftsman is inactive', async () => {
      craftsmenRepo.findOne!.mockResolvedValue({ id: 'craftsman-a-id', isActive: false });
      await expect(service.create(dto, adminUser)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('replaces positions and discounts in a transaction', async () => {
      versionsRepo
        .findOne!.mockResolvedValueOnce(buildVersion()) // loadVersionOrFail
        .mockResolvedValueOnce(buildVersion()); // loadVersionWithRelations at the end to return updated version
      await service.update('version-id', { positions: [], discounts: [] }, adminUser);
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('throws BadRequestException when version is already PUBLISHED', async () => {
      versionsRepo.findOne!.mockResolvedValue(
        buildVersion({ status: CatalogVersionStatus.PUBLISHED }),
      );
      await expect(
        service.update('version-id', { positions: [] }, adminUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ForbiddenException when craftsman A edits craftsman B catalog', async () => {
      versionsRepo.findOne!.mockResolvedValue(buildVersion({ craftsmanId: 'craftsman-b' }));
      await expect(
        service.update('version-id', { positions: [] }, craftsmanUserA),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when a position fails schema validation', async () => {
      versionsRepo.findOne!.mockResolvedValue(buildVersion());
      tradeConfigsRepo.findOne!.mockResolvedValue({
        trade: 'HVAC',
        pricingSchema: {
          fields: [{ name: 'heatingPowerKw', type: 'number', required: true }],
        },
      });
      await expect(
        service.update(
          'version-id',
          {
            positions: [
              {
                key: 'p1',
                label: 'Test',
                unit: 'piece',
                netPriceCents: 100,
                vatRate: 0.19,
                minQuantity: null,
                maxQuantity: null,
                tradeAttributes: {}, // missing required field heatingPowerKw
              },
            ],
          },
          adminUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('publish', () => {
    it('sets status to PUBLISHED with publishedBy and publishedAt', async () => {
      versionsRepo
        .findOne!.mockResolvedValueOnce(buildVersion()) // loadVersionOrFail
        .mockResolvedValueOnce(buildVersion({ status: CatalogVersionStatus.PUBLISHED })); // reload
      await service.publish('version-id', adminUser);
      expect(versionsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: CatalogVersionStatus.PUBLISHED,
          publishedBy: 'admin',
        }),
      );
    });

    it('throws BadRequestException when version is already PUBLISHED', async () => {
      versionsRepo.findOne!.mockResolvedValue(
        buildVersion({ status: CatalogVersionStatus.PUBLISHED }),
      );
      await expect(service.publish('version-id', adminUser)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws ConflictException when a second PUBLISHED version already exists (concurrent publish)', async () => {
      // simulates the Postgres unique-violation error thrown by the partial index.
      versionsRepo.findOne!.mockResolvedValue(buildVersion());
      const dbError = new QueryFailedError('INSERT', [], new Error('unique violation'));
      (dbError as unknown as Record<string, string>).code = '23505';
      versionsRepo.save!.mockRejectedValue(dbError);

      await expect(service.publish('version-id', adminUser)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('re-throws unexpected DB errors unchanged', async () => {
      versionsRepo.findOne!.mockResolvedValue(buildVersion());
      const unexpectedError = new Error('connection lost');
      versionsRepo.save!.mockRejectedValue(unexpectedError);
      await expect(service.publish('version-id', adminUser)).rejects.toBe(unexpectedError);
    });
  });

  describe('quote', () => {
    it('returns a QuoteResponseDto for a valid request', async () => {
      versionsRepo.findOne!.mockResolvedValue(
        buildVersion({ positions: [buildPosition({ netPriceCents: 10000, vatRate: 0.19 })] }),
      );
      const result = await service.quote(
        'version-id',
        { lineItems: [{ positionKey: 'pos-1', quantity: 2 }] },
        adminUser,
      );
      expect(result.subtotalCents).toBe(20000);
      expect(result.totalGrossCents).toBe(23800); // 20000 × 1.19
    });

    it('throws BadRequestException for an unknown positionKey', async () => {
      versionsRepo.findOne!.mockResolvedValue(buildVersion({ positions: [buildPosition()] }));
      await expect(
        service.quote(
          'version-id',
          { lineItems: [{ positionKey: 'unknown', quantity: 1 }] },
          adminUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ForbiddenException when craftsman A quotes craftsman B version', async () => {
      versionsRepo.findOne!.mockResolvedValue(buildVersion({ craftsmanId: 'craftsman-b' }));
      await expect(
        service.quote('version-id', { lineItems: [] }, craftsmanUserA),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('quoteActive', () => {
    it('quotes against the currently published version', async () => {
      versionsRepo.findOne!.mockResolvedValue(
        buildVersion({
          status: CatalogVersionStatus.PUBLISHED,
          positions: [buildPosition({ netPriceCents: 5000, vatRate: 0.07 })],
        }),
      );
      const result = await service.quoteActive(
        'craftsman-a',
        'HVAC',
        { lineItems: [{ positionKey: 'pos-1', quantity: 1 }] },
        adminUser,
      );
      expect(result.subtotalCents).toBe(5000);
    });

    it('throws NotFoundException when no published version exists', async () => {
      versionsRepo.findOne!.mockResolvedValue(null);
      await expect(
        service.quoteActive('craftsman-a', 'HVAC', { lineItems: [] }, adminUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('authorization isolation', () => {
    it('craftsman A cannot read catalog belonging to craftsman B', async () => {
      versionsRepo.findOne!.mockResolvedValue(buildVersion({ craftsmanId: 'craftsman-b' }));
      await expect(service.findOne('version-id', craftsmanUserA)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('craftsman A cannot publish catalog belonging to craftsman B', async () => {
      versionsRepo.findOne!.mockResolvedValue(buildVersion({ craftsmanId: 'craftsman-b' }));
      await expect(service.publish('version-id', craftsmanUserA)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('craftsman A cannot quote craftsman B active version', async () => {
      await expect(
        service.quoteActive('craftsman-b', 'HVAC', { lineItems: [] }, craftsmanUserA),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
