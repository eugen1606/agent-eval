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
  EvaluatorsService,
  EvaluatorResponse,
  PaginatedEvaluators,
  EvaluatorsSortField,
  SortDirection,
} from './evaluators.service';
import { CreateEvaluatorDto, UpdateEvaluatorDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('evaluators')
@Controller('evaluators')
@UseGuards(JwtAuthGuard)
export class EvaluatorsController {
  constructor(private readonly evaluatorsService: EvaluatorsService) {}

  @Post()
  async create(
    @Body() dto: CreateEvaluatorDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<EvaluatorResponse> {
    return this.evaluatorsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { userId: string; email: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: EvaluatorsSortField,
    @Query('sortDirection') sortDirection?: SortDirection,
  ): Promise<PaginatedEvaluators> {
    return this.evaluatorsService.findAll(user.userId, {
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
  ): Promise<EvaluatorResponse> {
    return this.evaluatorsService.findOne(id, user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEvaluatorDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<EvaluatorResponse> {
    return this.evaluatorsService.update(id, dto, user.userId);
  }

  @Get(':id/usage')
  async getUsage(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<{ runs: number }> {
    return this.evaluatorsService.getUsage(id, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.evaluatorsService.delete(id, user.userId);
  }
}
