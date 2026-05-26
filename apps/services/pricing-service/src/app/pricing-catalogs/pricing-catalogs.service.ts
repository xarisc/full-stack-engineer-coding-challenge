import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { JwtPayload, UserRole } from '@sandbox/types';

import { Craftsman } from '../craftsmen/entities/craftsman.entity';
import { TradeConfig } from '../trades/entities/trade-config.entity';
import { CatalogVersion, CatalogVersionStatus } from './entities/catalog-version.entity';
import { PricingPosition } from './entities/pricing-position.entity';
import { PositionSurcharge } from './entities/position-surcharge.entity';
import { CatalogDiscount } from './entities/catalog-discount.entity';
import { CreateCatalogVersionDto } from './dto/create-catalog-version.dto';
import { UpdateCatalogVersionDto } from './dto/update-catalog-version.dto';
import { QuoteRequestDto } from './dto/quote-request.dto';
import { CatalogVersionResponseDto, QuoteResponseDto } from './dto/catalog-version-response.dto';
import { calculateQuote, PositionData, SurchargeData } from './quote-calculator';
import { validateTradeAttributes } from './schema-validator';

@Injectable()
export class PricingCatalogsService {
  private readonly logger = new Logger(PricingCatalogsService.name);

  constructor(
    @InjectRepository(CatalogVersion)
    private readonly versions: Repository<CatalogVersion>,
    @InjectRepository(PricingPosition)
    private readonly positions: Repository<PricingPosition>,
    @InjectRepository(CatalogDiscount)
    private readonly discounts: Repository<CatalogDiscount>,
    @InjectRepository(TradeConfig)
    private readonly tradeConfigs: Repository<TradeConfig>,
    @InjectRepository(Craftsman)
    private readonly craftsmen: Repository<Craftsman>,
    private readonly dataSource: DataSource,
  ) {}

  // list versions without positions ORDER BY created_at DESC
  async list(
    query: { craftsmanId?: string; trade?: string },
    user: JwtPayload,
  ): Promise<CatalogVersionResponseDto[]> {
    const qb = this.versions.createQueryBuilder('v').orderBy('v.createdAt', 'DESC');

    if (query.craftsmanId) {
      qb.andWhere('v.craftsmanId = :craftsmanId', { craftsmanId: query.craftsmanId });
    }

    if (query.trade) {
      qb.andWhere('v.trade = :trade', { trade: query.trade });
    }

    // Row-level scoping: Craftsmen can only see their own catalogs
    if (this.isCraftsmanOnly(user)) {
      if (!user.craftsmanId) return [];
      qb.andWhere('v.craftsmanId = :ownId', { ownId: user.craftsmanId });
    }

    const items = await qb.getMany();
    //positions/discounts are loaded lazily, so we don't need to exclude them here
    return items.map(CatalogVersionResponseDto.from);
  }

  // findOne - loads all versions with relations
  async findOne(versionId: string, user: JwtPayload): Promise<CatalogVersionResponseDto> {
    const version = await this.loadVersionWithRelations(versionId);
    this.assertCanAccess(version.craftsmanId, user);
    return CatalogVersionResponseDto.from(version);
  }

  // create new DRAFT version. Only for own craftsman

  async create(dto: CreateCatalogVersionDto, user: JwtPayload): Promise<CatalogVersionResponseDto> {
    this.assertCanAccess(dto.craftsmanId, user);

    // craftsman must exist and be active
    const craftsman = await this.craftsmen.findOne({ where: { id: dto.craftsmanId } });
    if (!craftsman) {
      throw new NotFoundException(`Craftsman ${dto.craftsmanId} not found`);
    }
    if (!craftsman.isActive) {
      throw new BadRequestException(`Craftsman ${dto.craftsmanId} is not active`);
    }

    const version = this.versions.create({
      craftsmanId: dto.craftsmanId,
      trade: dto.trade,
      status: CatalogVersionStatus.DRAFT,
      effectiveFrom: new Date(dto.effectiveFrom),
    });
    const saved = await this.versions.save(version);
    this.logger.log(
      `Created catalog version ${saved.id} for craftsman ${saved.craftsmanId} and trade ${dto.trade}`,
    );

    return CatalogVersionResponseDto.from(saved);
  }

  // update DRAFT version. Only for own craftsman. Positions and discounts are fully replaced in this operation (no merged updates). schema validation before write.
  async update(
    versionId: string,
    dto: UpdateCatalogVersionDto,
    user: JwtPayload,
  ): Promise<CatalogVersionResponseDto> {
    const version = await this.loadVersionOrFail(versionId);
    this.assertCanAccess(version.craftsmanId, user);
    this.assertIsDraft(version);

    // validate schema, if pricingschema exists, for every position
    if (dto.positions) {
      const tradeConfig = await this.tradeConfigs.findOne({ where: { trade: version.trade } });
      if (tradeConfig?.pricingSchema) {
        for (const posDto of dto.positions) {
          const result = validateTradeAttributes(
            posDto.tradeAttributes ?? {},
            tradeConfig.pricingSchema,
          );
          if (!result.valid) {
            throw new BadRequestException({
              message: `Position '${posDto.key}' failed schema validation`,
              errors: result.errors,
            });
          }
        }
      }
    }

    await this.dataSource.transaction(async (tx) => {
      // update effectiveFrom if provided
      if (dto.effectiveFrom !== undefined) {
        version.effectiveFrom = new Date(dto.effectiveFrom);
        await tx.getRepository(CatalogVersion).save(version);
      }

      // overwrite positions - delete CASCADE surcharges automatically via FK constraints
      if (dto.positions !== undefined) {
        await tx.getRepository(PricingPosition).delete({ versionId: version.id });
        for (const [i, posDto] of dto.positions.entries()) {
          const pos = tx.getRepository(PricingPosition).create({
            versionId: version.id,
            key: posDto.key,
            label: posDto.label,
            unit: posDto.unit as PricingPosition['unit'],
            netPriceCents: posDto.netPriceCents,
            vatRate: posDto.vatRate,
            minQuantity: posDto.minQuantity ?? null,
            maxQuantity: posDto.maxQuantity ?? null,
            tradeAttributes: posDto.tradeAttributes ?? {},
            sortOrder: posDto.sortOrder ?? i,
          });
          const savedPos = await tx.getRepository(PricingPosition).save(pos);

          if (posDto.surcharges?.length) {
            await tx.getRepository(PositionSurcharge).save(
              posDto.surcharges.map((s, j) =>
                tx.getRepository(PositionSurcharge).create({
                  positionId: savedPos.id,
                  key: s.key,
                  label: s.label,
                  type: s.type as PositionSurcharge['type'],
                  valueCents: s.valueCents,
                  percentage: s.percentage,
                  sortOrder: s.sortOrder ?? j,
                }),
              ),
            );
          }
        }
      }

      // overwrite discounts
      if (dto.discounts !== undefined) {
        await tx.getRepository(CatalogDiscount).delete({ versionId: version.id });
        if (dto.discounts.length) {
          await tx.getRepository(CatalogDiscount).save(
            dto.discounts.map((d, i) =>
              tx.getRepository(CatalogDiscount).create({
                versionId: version.id,
                key: d.key,
                label: d.label,
                type: d.type as CatalogDiscount['type'],
                valueCents: d.valueCents,
                percentage: d.percentage,
                capCents: d.capCents ?? null,
                appliesToType: d.appliesToType,
                positionKeys: d.positionKeys ?? null,
                sortOrder: d.sortOrder ?? i,
              }),
            ),
          );
        }
      }
    });

    return CatalogVersionResponseDto.from(await this.loadVersionWithRelations(version.id));
  }

  // publish DRAFT VERSION. Runs in a transaction: first archives any currently PUBLISHED version
  // for the same (craftsman, trade) so it stays readable for audit, then sets this draft to PUBLISHED.
  // The unique partial index WHERE status='PUBLISHED' serves as the concurrency guard —
  // a concurrent publish that races past the archive step will still trigger a 409.
  async publish(versionId: string, user: JwtPayload): Promise<CatalogVersionResponseDto> {
    const version = await this.loadVersionOrFail(versionId);
    this.assertCanAccess(version.craftsmanId, user);
    this.assertIsDraft(version);

    try {
      await this.dataSource.transaction(async (tx) => {
        const vRepo = tx.getRepository(CatalogVersion);
        await vRepo.update(
          { craftsmanId: version.craftsmanId, trade: version.trade, status: CatalogVersionStatus.PUBLISHED },
          { status: CatalogVersionStatus.ARCHIVED },
        );
        version.status = CatalogVersionStatus.PUBLISHED;
        version.publishedAt = new Date();
        version.publishedBy = user.sub;
        await vRepo.save(version);
      });
    } catch (err) {
      // postgres unique constraint violation
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          'Another published version for this craftsman and trade already exists',
        );
      }
      throw err;
    }
    this.logger.log(
      `Published catalog version ${version.id} for craftsman ${version.craftsmanId} and trade ${version.trade}`,
    );
    return CatalogVersionResponseDto.from(await this.loadVersionWithRelations(versionId));
  }

  // quote by version. one exact version match. can be DRAFT or PUBLISHED.
  async quote(
    versionId: string,
    dto: QuoteRequestDto,
    user: JwtPayload,
  ): Promise<QuoteResponseDto> {
    const version = await this.loadVersionWithRelations(versionId);
    this.assertCanAccess(version.craftsmanId, user);

    const craftsman = await this.craftsmen.findOne({ where: { id: version.craftsmanId } });
    if (!craftsman || !craftsman.isActive) {
      throw new BadRequestException(`Craftsman is not active`);
    }

    return this.calculateQuoteForVersion(version, dto);
  }

  // quoteActive by craftsman and trade. finds currenttly active PUBLISHED version.
  async quoteActive(
    craftsmanId: string,
    trade: string,
    dto: QuoteRequestDto,
    user: JwtPayload,
  ): Promise<QuoteResponseDto> {
    this.assertCanAccess(craftsmanId, user);

    const craftsman = await this.craftsmen.findOne({ where: { id: craftsmanId } });
    if (!craftsman) {
      throw new NotFoundException(`Craftsman ${craftsmanId} not found`);
    }
    if (!craftsman.isActive) {
      throw new BadRequestException(`Craftsman ${craftsmanId} is not active`);
    }

    const version = await this.versions.findOne({
      where: { craftsmanId, trade, status: CatalogVersionStatus.PUBLISHED },
      relations: ['positions', 'discounts', 'positions.surcharges'],
    });

    if (!version) {
      throw new NotFoundException(
        'No published catalog version found for this craftsman and trade',
      );
    }
    return this.calculateQuoteForVersion(version, dto);
  }

  // private helpers

  private async loadVersionOrFail(versionId: string): Promise<CatalogVersion> {
    const version = await this.versions.findOne({
      where: { id: versionId },
    });

    if (!version) {
      throw new NotFoundException(`Catalog version with ${versionId} not found`);
    }
    return version;
  }

  private async loadVersionWithRelations(versionId: string): Promise<CatalogVersion> {
    const version = await this.versions.findOne({
      where: { id: versionId },
      relations: ['positions', 'discounts', 'positions.surcharges'],
    });

    if (!version) {
      throw new NotFoundException(`Catalog version with ${versionId} not found`);
    }
    return version;
  }

  // throwing BadRequestException if version allready published
  private assertIsDraft(version: CatalogVersion): void {
    if (version.status !== CatalogVersionStatus.DRAFT) {
      throw new BadRequestException(
        `Catalog version ${version.id} is ${version.status} and cannot be modified`,
      );
    }
  }

  private isCraftsmanOnly(user: JwtPayload): boolean {
    return user.roles.includes(UserRole.CRAFTSMAN) && !user.roles.includes(UserRole.ADMIN);
  }

  private assertCanAccess(craftsmanId: string, user: JwtPayload): void {
    if (!this.isCraftsmanOnly(user)) return;
    if (user.craftsmanId !== craftsmanId) {
      throw new ForbiddenException(`Craftsman may only access their own catalogs`);
    }
  }

  // mapping entity data to input-types for quote calculation calling pure function. only data mapping.
  private calculateQuoteForVersion(
    version: CatalogVersion,
    dto: QuoteRequestDto,
  ): QuoteResponseDto {
    const positionData: PositionData[] = (version.positions ?? []).map((p) => ({
      key: p.key,
      label: p.label,
      unit: p.unit,
      netPriceCents: p.netPriceCents,
      vatRate: Number(p.vatRate),
      minQuantity: p.minQuantity !== null ? Number(p.minQuantity) : null,
      maxQuantity: p.maxQuantity !== null ? Number(p.maxQuantity) : null,
      surcharges: (p.surcharges ?? []).map((s) => ({
        key: s.key,
        label: s.label,
        type: s.type,
        valueCents: s.valueCents,
        percentage: s.percentage !== null ? Number(s.percentage) : null,
      })),
    }));

    const discountData = (version.discounts ?? []).map((d) => ({
      key: d.key,
      label: d.label,
      type: d.type as 'flat' | 'percentage',
      valueCents: d.valueCents,
      percentage: d.percentage !== null ? Number(d.percentage) : null,
      capCents: d.capCents,
      appliesToType: d.appliesToType as 'subtotal' | 'positions',
      positionKeys: d.positionKeys,
    }));

    // calculateQuote throws BadRequestException on invalid input, e.g. quantity out of bounds or unknown position keys
    try {
      const result = calculateQuote(dto.lineItems, positionData, discountData);
      return QuoteResponseDto.from(result);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }
}
