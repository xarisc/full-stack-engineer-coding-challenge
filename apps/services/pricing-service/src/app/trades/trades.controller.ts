import {
  Controller,
  Get,
  Param,
  UseGuards,
  Body,
  Patch,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, CurrentUser } from '@sandbox/auth';
import { UserRole } from '@sandbox/types';
import { TradesService } from './trades.service';
import { TradeConfigResponseDto } from './dto/trade-config-response.dto';
import { UpdateTradeConfigDto } from './dto/update-trade-config.dto';

@ApiTags('Trades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('trades')
export class TradesController {
  constructor(private readonly service: TradesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'List trade configurations' })
  @ApiResponse({ status: 200, type: [TradeConfigResponseDto] })
  list(): Promise<TradeConfigResponseDto[]> {
    return this.service.list();
  }

  @Get(':trade')
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'Get one trade configuration by trade code' })
  @ApiResponse({ status: 200, type: TradeConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  findOne(@Param('trade') trade: string): Promise<TradeConfigResponseDto> {
    return this.service.findByCode(trade);
  }

  @Patch(':trade')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update displayName and/or pricingSchema for a trade (ADMIN only)' })
  @ApiResponse({ status: 200, type: TradeConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  @ApiResponse({ status: 409, description: 'New schema invalidates existing positions' })
  update(
    @Param('trade') trade: string,
    @Body() dto: UpdateTradeConfigDto,
  ): Promise<TradeConfigResponseDto> {
    return this.service.update(trade, dto);
  }
}
