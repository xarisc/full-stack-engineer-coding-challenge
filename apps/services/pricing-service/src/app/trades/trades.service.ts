import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeConfig } from './entities/trade-config.entity';
import { TradeConfigResponseDto } from './dto/trade-config-response.dto';
import { PricingPosition } from '../pricing-catalogs/entities/pricing-position.entity';
import { CatalogVersion } from '../pricing-catalogs/entities/catalog-version.entity';
import { UpdateTradeConfigDto } from './dto/update-trade-config.dto';
import { validateTradeAttributes } from '../pricing-catalogs/schema-validator';

@Injectable()
export class TradesService {
  private readonly logger = new Logger(TradesService.name);
  constructor(
    @InjectRepository(TradeConfig) private readonly repo: Repository<TradeConfig>,
    @InjectRepository(PricingPosition) private readonly positions: Repository<PricingPosition>,
    @InjectRepository(CatalogVersion)
    private readonly catalogVersions: Repository<CatalogVersion>,
  ) {}

  async list(): Promise<TradeConfigResponseDto[]> {
    const items = await this.repo.find({ order: { trade: 'ASC' } });
    return items.map(TradeConfigResponseDto.from);
  }

  async findByCode(trade: string): Promise<TradeConfigResponseDto> {
    const found = await this.repo.findOne({ where: { trade } });
    if (!found) {
      throw new NotFoundException(`Trade ${trade} not found`);
    }
    return TradeConfigResponseDto.from(found);
  }

  async update(trade: string, dto: UpdateTradeConfigDto): Promise<TradeConfigResponseDto> {
    const config = await this.repo.findOne({ where: { trade } });
    if (!config) {
      throw new NotFoundException(`Trade '${trade}' not found`);
    }

    // Schema-Drift-Check: Nur nötig wenn pricingSchema geändert wird.
    if (dto.pricingSchema !== undefined && dto.pricingSchema !== null) {
      const versions = await this.catalogVersions.find({ where: { trade } });
      const versionIds = versions.map((v) => v.id);

      if (versionIds.length > 0) {
        const allPositions = await this.positions
          .createQueryBuilder('p')
          .where('p.versionId IN (:...ids)', { ids: versionIds })
          .getMany();

        const violations: { positionId: string; positionKey: string; errors: string[] }[] = [];
        for (const pos of allPositions) {
          const result = validateTradeAttributes(pos.tradeAttributes, dto.pricingSchema);
          if (!result.valid) {
            violations.push({ positionId: pos.id, positionKey: pos.key, errors: result.errors });
          }
        }

        if (violations.length > 0) {
          throw new ConflictException({
            message: 'New pricingSchema invalidates existing positions',
            violations,
          });
        }
      }
    }

    if (dto.displayName !== undefined) config.displayName = dto.displayName;
    if (dto.pricingSchema !== undefined) config.pricingSchema = dto.pricingSchema;
    await this.repo.save(config);

    this.logger.log(`Updated trade config for '${trade}'`);
    return TradeConfigResponseDto.from(config);
  }
}
