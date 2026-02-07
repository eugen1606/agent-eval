import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AccessTokensService,
  AccessTokenResponse,
  EntityUsage,
  PaginatedAccessTokens,
  AccessTokensSortField,
  SortDirection,
} from './access-tokens.service';
import { CreateAccessTokenDto, UpdateAccessTokenDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('access-tokens')
@Controller('access-tokens')
@UseGuards(JwtAuthGuard)
export class AccessTokensController {
  constructor(private readonly accessTokensService: AccessTokensService) {}

  @Post()
  async create(
    @Body() dto: CreateAccessTokenDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<AccessTokenResponse> {
    return this.accessTokensService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { userId: string; email: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: AccessTokensSortField,
    @Query('sortDirection') sortDirection?: SortDirection,
  ): Promise<PaginatedAccessTokens> {
    return this.accessTokensService.findAll(user.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      sortBy,
      sortDirection,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<AccessTokenResponse> {
    return this.accessTokensService.findOne(id, user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccessTokenDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<AccessTokenResponse> {
    return this.accessTokensService.update(id, dto, user.userId);
  }

  @Get(':id/usage')
  async getUsage(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<EntityUsage> {
    return this.accessTokensService.getUsage(id, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.accessTokensService.delete(id, user.userId);
  }
}
