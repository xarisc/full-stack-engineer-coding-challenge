import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, ObjectLiteral } from 'typeorm';
import { TradeConfig } from './entities/trade-config.entity';
import { TradesService } from './trades.service';
import { PricingPosition } from '../pricing-catalogs/entities/pricing-position.entity';
import { CatalogVersion } from '../pricing-catalogs/entities/catalog-version.entity';

type Repo<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

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
});
