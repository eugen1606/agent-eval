import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FlowConfigsService, CreateFlowConfigDto } from './flow-configs.service';
import { FlowConfig } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('flow-configs')
@UseGuards(JwtAuthGuard)
export class FlowConfigsController {
  constructor(private readonly flowConfigsService: FlowConfigsService) {}

  @Post()
  async create(
    @Body() dto: CreateFlowConfigDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<FlowConfig> {
    return this.flowConfigsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<FlowConfig[]> {
    return this.flowConfigsService.findAll(user.userId);
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
