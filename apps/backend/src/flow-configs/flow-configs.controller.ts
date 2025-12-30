import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { FlowConfigsService, CreateFlowConfigDto } from './flow-configs.service';
import { FlowConfig } from '../database/entities';

@Controller('flow-configs')
export class FlowConfigsController {
  constructor(private readonly flowConfigsService: FlowConfigsService) {}

  @Post()
  async create(@Body() dto: CreateFlowConfigDto): Promise<FlowConfig> {
    return this.flowConfigsService.create(dto);
  }

  @Get()
  async findAll(): Promise<FlowConfig[]> {
    return this.flowConfigsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<FlowConfig> {
    return this.flowConfigsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateFlowConfigDto>
  ): Promise<FlowConfig> {
    return this.flowConfigsService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.flowConfigsService.delete(id);
  }
}
