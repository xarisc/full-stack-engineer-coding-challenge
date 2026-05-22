import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@sandbox/auth';
import { JwtPayload, UserRole } from '@sandbox/types';

import { PricingCatalogsService } from './pricing-catalogs.service';
import { CreateCatalogVersionDto } from './dto/create-catalog-version.dto';
import { UpdateCatalogVersionDto } from './dto/update-catalog-version.dto';
import { QueryCatalogVersionsDto } from './dto/query-catalog-versions.dto';
import { QuoteRequestDto } from './dto/quote-request.dto';
import { CatalogVersionResponseDto, QuoteResponseDto } from './dto/catalog-version-response.dto';

// /api/v1/pricing-catalogs
@ApiTags('Pricing Catalogs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pricing-catalogs')
export class PricingCatalogsController {
  constructor(private readonly service: PricingCatalogsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({
    summary: 'List all catalog versions with optional filter by craftsmanId and trade',
  })
  @ApiResponse({ status: 200, type: [CatalogVersionResponseDto] })
  list(
    @Query() query: QueryCatalogVersionsDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CatalogVersionResponseDto[]> {
    return this.service.list(query, user);
  }

  @Get(':versionId')
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({
    summary: 'find one catalog version with all positions, surcharges and discounts',
  })
  @ApiResponse({ status: 200, type: CatalogVersionResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Catalog version not found' })
  findOne(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CatalogVersionResponseDto> {
    return this.service.findOne(versionId, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({
    summary: 'Create a new catalog version (initially in DRAFT status) for craftsmanId, trade',
  })
  @ApiResponse({ status: 201, type: CatalogVersionResponseDto })
  @ApiResponse({ status: 400, description: 'craftsman no found or inactive' })
  create(
    @Body() dto: CreateCatalogVersionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CatalogVersionResponseDto> {
    return this.service.create(dto, user);
  }

  @Patch(':versionId')
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({
    summary:
      'Edit a DRAFT catalog version - positions and discounts are fully replaced when provided',
  })
  @ApiResponse({ status: 200, type: CatalogVersionResponseDto })
  @ApiResponse({ status: 400, description: 'version is not a DRAFT or schema validation failed' })
  update(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpdateCatalogVersionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CatalogVersionResponseDto> {
    return this.service.update(versionId, dto, user);
  }

  @Post(':versionId/publish')
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Publish a DRAFT catalog version - only one version per craftsman and trade can be published at a time',
  })
  @ApiResponse({ status: 200, type: CatalogVersionResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'version is not a DRAFT or another version for the same craftsman and trade is already published',
  })
  publish(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CatalogVersionResponseDto> {
    return this.service.publish(versionId, user);
  }

  @Post(':versionId/quote')
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Calculate a quote based on a specific catalog version and provided position keys and quantities',
  })
  @ApiResponse({ status: 200, type: QuoteResponseDto })
  @ApiResponse({
    status: 400,
    description: 'unknown position keys or quantities out of range, etc.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Catalog version not found' })
  quote(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: QuoteRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuoteResponseDto> {
    return this.service.quote(versionId, dto, user);
  }
}

// /api/v1/craftsmen/:craftsmanId/trades/:trade/quote
// seperate controller with different URL-prefix
// both controller share same service and are registered in same module

@ApiTags('Pricing Catalogs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('craftsmen')
export class CraftsmanQuoteController {
  constructor(private readonly service: PricingCatalogsService) {}

  @Post(':id/trades/:trade/quote')
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Quote against the currently active PUBLISHED version for a craftsman + trade',
  })
  @ApiResponse({ status: 200, type: QuoteResponseDto })
  @ApiResponse({ status: 400, description: 'Craftsman is inactive or invalid line items' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 404,
    description: 'No published version found for this craftsman and trade',
  })
  quoteActive(
    @Param('id', ParseUUIDPipe) craftsmanId: string,
    @Param('trade') trade: string,
    @Body() dto: QuoteRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuoteResponseDto> {
    return this.service.quoteActive(craftsmanId, trade, dto, user);
  }
}
