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

export type FlowConfigsSortField = 'name' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface FlowConfigsFilterDto {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: FlowConfigsSortField;
  sortDirection?: SortDirection;
}

export interface PaginatedFlowConfigs {
  data: FlowConfig[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class FlowConfigsService {
  constructor(
    @InjectRepository(FlowConfig)
    private flowConfigRepository: Repository<FlowConfig>
  ) {}

  async create(dto: CreateFlowConfigDto, userId: string): Promise<FlowConfig> {
    const flowConfig = this.flowConfigRepository.create({
      name: dto.name,
      flowId: dto.flowId,
      basePath: dto.basePath,
      description: dto.description,
      userId,
    });
    return this.flowConfigRepository.save(flowConfig);
  }

  async findAll(
    userId: string,
    filters: FlowConfigsFilterDto = {},
  ): Promise<PaginatedFlowConfigs> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.flowConfigRepository
      .createQueryBuilder('flowConfig')
      .where('flowConfig.userId = :userId', { userId });

    // Apply search filter
    if (filters.search) {
      queryBuilder.andWhere(
        '(flowConfig.name ILIKE :search OR flowConfig.description ILIKE :search OR flowConfig.flowId ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Apply sorting
    const sortField = filters.sortBy || 'createdAt';
    const sortDirection =
      (filters.sortDirection?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';
    queryBuilder.orderBy(`flowConfig.${sortField}`, sortDirection);

    // Apply pagination
    const data = await queryBuilder.skip(skip).take(limit).getMany();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string): Promise<FlowConfig> {
    const flowConfig = await this.flowConfigRepository.findOne({
      where: { id, userId },
    });
    if (!flowConfig) {
      throw new NotFoundException(`Flow config not found: ${id}`);
    }
    return flowConfig;
  }

  async update(id: string, dto: Partial<CreateFlowConfigDto>, userId: string): Promise<FlowConfig> {
    const flowConfig = await this.findOne(id, userId);

    if (dto.name) flowConfig.name = dto.name;
    if (dto.flowId) flowConfig.flowId = dto.flowId;
    if (dto.basePath !== undefined) flowConfig.basePath = dto.basePath;
    if (dto.description !== undefined) flowConfig.description = dto.description;

    return this.flowConfigRepository.save(flowConfig);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.flowConfigRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Flow config not found: ${id}`);
    }
  }
}
