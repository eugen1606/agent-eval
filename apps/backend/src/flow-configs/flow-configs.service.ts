import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlowConfig } from '../database/entities';

export interface CreateFlowConfigDto {
  name: string;
  flowId: string;
  basePath?: string;
  description?: string;
}

@Injectable()
export class FlowConfigsService {
  constructor(
    @InjectRepository(FlowConfig)
    private flowConfigRepository: Repository<FlowConfig>
  ) {}

  async create(dto: CreateFlowConfigDto): Promise<FlowConfig> {
    const flowConfig = this.flowConfigRepository.create({
      name: dto.name,
      flowId: dto.flowId,
      basePath: dto.basePath,
      description: dto.description,
    });
    return this.flowConfigRepository.save(flowConfig);
  }

  async findAll(): Promise<FlowConfig[]> {
    return this.flowConfigRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<FlowConfig> {
    const flowConfig = await this.flowConfigRepository.findOne({
      where: { id },
    });
    if (!flowConfig) {
      throw new NotFoundException(`Flow config not found: ${id}`);
    }
    return flowConfig;
  }

  async update(id: string, dto: Partial<CreateFlowConfigDto>): Promise<FlowConfig> {
    const flowConfig = await this.findOne(id);

    if (dto.name) flowConfig.name = dto.name;
    if (dto.flowId) flowConfig.flowId = dto.flowId;
    if (dto.basePath !== undefined) flowConfig.basePath = dto.basePath;
    if (dto.description !== undefined) flowConfig.description = dto.description;

    return this.flowConfigRepository.save(flowConfig);
  }

  async delete(id: string): Promise<void> {
    const result = await this.flowConfigRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Flow config not found: ${id}`);
    }
  }
}
