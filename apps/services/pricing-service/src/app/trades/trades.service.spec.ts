import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, ObjectLiteral } from 'typeorm';
import { TradeConfig } from './entities/trade-config.entity';
import { TradesService } from './trades.service';
import { PricingPosition } from '../pricing-catalogs/entities/pricing-position.entity';
import { CatalogVersion } from '../pricing-catalogs/entities/catalog-version.entity';

type Repo<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const TRADE_CONFIG = {
  id: 'uuid-1',
  trade: 'HVAC',
  displayName: 'Heating',
  isActive: true,
  metadata: {},
  pricingSchema: null,
};

describe('TradesService', () => {
  let service: TradesService;
  let repo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let positionRepo: { createQueryBuilder: jest.Mock };
  let catalogVersionRepo: { find: jest.Mock };

  beforeEach(async () => {
    repo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
    positionRepo = { createQueryBuilder: jest.fn() };
    catalogVersionRepo = { find: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TradesService,
        {
          provide: getRepositoryToken(TradeConfig),
          useValue: repo as Partial<Repository<TradeConfig>>,
        },
        {
          provide: getRepositoryToken(PricingPosition),
          useValue: positionRepo as Partial<Repository<PricingPosition>>,
        },
        {
          provide: getRepositoryToken(CatalogVersion),
          useValue: catalogVersionRepo as Partial<Repository<CatalogVersion>>,
        },
      ],
    }).compile();
    service = moduleRef.get(TradesService);
  });

  it('list() returns mapped trade configs ordered by trade', async () => {
    repo.find.mockResolvedValue([
      { id: '1', trade: 'HVAC', displayName: 'Heating', isActive: true, metadata: {} },
    ]);
    const result = await service.list();
    expect(repo.find).toHaveBeenCalledWith({ order: { trade: 'ASC' } });
    expect(result[0].trade).toBe('HVAC');
  });

  it('findByCode() returns one config', async () => {
    repo.findOne.mockResolvedValue({
      id: '1',
      trade: 'HVAC',
      displayName: 'Heating',
      isActive: true,
      metadata: {},
    });
    const result = await service.findByCode('HVAC');
    expect(result.trade).toBe('HVAC');
  });

  it('findByCode() throws NotFoundException when trade is unknown', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findByCode('UNKNOWN')).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('update()', () => {
    it('returns updated config on happy path (no schema change)', async () => {
      repo.findOne.mockResolvedValue({ ...TRADE_CONFIG });
      repo.save.mockImplementation((e) => Promise.resolve(e));
      const result = await service.update('HVAC', { displayName: 'Heating & Cooling' });
      expect(result.displayName).toBe('Heating & Cooling');
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when trade does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('UNKNOWN', { displayName: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('skips position validation and clears schema when pricingSchema is null', async () => {
      repo.findOne.mockResolvedValue({ ...TRADE_CONFIG, pricingSchema: { fields: [] } });
      repo.save.mockImplementation((e) => Promise.resolve(e));
      const result = await service.update('HVAC', { pricingSchema: null });
      expect(catalogVersionRepo.find).not.toHaveBeenCalled();
      expect(result.pricingSchema).toBeNull();
    });

    it('skips validation when no catalog versions exist for the trade', async () => {
      const schema = { fields: [{ name: 'color', type: 'string' as const, required: true }] };
      repo.findOne.mockResolvedValue({ ...TRADE_CONFIG });
      catalogVersionRepo.find.mockResolvedValue([]);
      repo.save.mockImplementation((e) => Promise.resolve(e));
      const result = await service.update('HVAC', { pricingSchema: schema });
      expect(positionRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(result.pricingSchema).toEqual(schema);
    });

    it('throws ConflictException when new schema invalidates existing positions', async () => {
      const schema = { fields: [{ name: 'color', type: 'string' as const, required: true }] };
      repo.findOne.mockResolvedValue({ ...TRADE_CONFIG });
      catalogVersionRepo.find.mockResolvedValue([{ id: 'v1', trade: 'HVAC' }]);
      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'p1', key: 'pos-001', tradeAttributes: {} }, // missing required 'color'
        ]),
      };
      positionRepo.createQueryBuilder.mockReturnValue(qb);
      await expect(service.update('HVAC', { pricingSchema: schema })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('saves successfully when new schema is valid for all existing positions', async () => {
      const schema = { fields: [{ name: 'color', type: 'string' as const, required: true }] };
      repo.findOne.mockResolvedValue({ ...TRADE_CONFIG });
      catalogVersionRepo.find.mockResolvedValue([{ id: 'v1', trade: 'HVAC' }]);
      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([{ id: 'p1', key: 'pos-001', tradeAttributes: { color: 'red' } }]),
      };
      positionRepo.createQueryBuilder.mockReturnValue(qb);
      repo.save.mockImplementation((e) => Promise.resolve(e));
      const result = await service.update('HVAC', { pricingSchema: schema });
      expect(result.pricingSchema).toEqual(schema);
    });
  });
});
