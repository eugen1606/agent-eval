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
  FlowConfigsService,
  CreateFlowConfigDto,
  PaginatedFlowConfigs,
  FlowConfigsSortField,
  SortDirection,
} from './flow-configs.service';
import { FlowConfig } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UrlValidationService } from '../common/validators/url-validation.service';

@ApiTags('flow-configs')
@Controller('flow-configs')
@UseGuards(JwtAuthGuard)
export class FlowConfigsController {
  constructor(
    private readonly flowConfigsService: FlowConfigsService,
    private readonly urlValidationService: UrlValidationService,
  ) {}

  private validateBasePath(basePath: string): void {
    // Validate basePath URL for SSRF protection
    // skipDnsCheck=true for input validation (fast check)
    // Full DNS check happens at execution time in FlowService
    this.urlValidationService.validateUrlSync(basePath, {
      context: 'Base path',
    });
  }

  @Post()
  async create(
    @Body() dto: CreateFlowConfigDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<FlowConfig> {
    // Validate basePath for SSRF protection if provided
    if (dto.basePath) {
      this.validateBasePath(dto.basePath);
    }
    return this.flowConfigsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { userId: string; email: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: FlowConfigsSortField,
    @Query('sortDirection') sortDirection?: SortDirection,
  ): Promise<PaginatedFlowConfigs> {
    return this.flowConfigsService.findAll(user.userId, {
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
  ): Promise<FlowConfig> {
    return this.flowConfigsService.findOne(id, user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateFlowConfigDto>,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<FlowConfig> {
    // Validate basePath for SSRF protection if provided
    if (dto.basePath) {
      this.validateBasePath(dto.basePath);
    }
    return this.flowConfigsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.flowConfigsService.delete(id, user.userId);
  }
}
