import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Test } from '../database/entities';
import { CreateTestDto, UpdateTestDto } from './dto';

export type TestsSortField = 'name' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface TestsFilterDto {
  page?: number;
  limit?: number;
  search?: string;
  questionSetId?: string;
  accessTokenId?: string;
  webhookId?: string;
  multiStep?: boolean;
  flowConfigId?: string;
  sortBy?: TestsSortField;
  sortDirection?: SortDirection;
}

export interface PaginatedTests {
  data: Test[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class TestsService {
  constructor(
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
  ) {}

  async create(dto: CreateTestDto, userId: string): Promise<Test> {
    const test = this.testRepository.create({
      name: dto.name,
      description: dto.description,
      flowConfigId: dto.flowConfigId,
      accessTokenId: dto.accessTokenId,
      questionSetId: dto.questionSetId,
      multiStepEvaluation: dto.multiStepEvaluation ?? false,
      webhookId: dto.webhookId,
      userId,
    });
    return this.testRepository.save(test);
  }

  async findAll(
    userId: string,
    filters: TestsFilterDto = {},
  ): Promise<PaginatedTests> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.testRepository
      .createQueryBuilder('test')
      .leftJoinAndSelect('test.questionSet', 'questionSet')
      .leftJoinAndSelect('test.flowConfig', 'flowConfig')
      .where('test.userId = :userId', { userId });

    // Apply search filter (including flowConfig.flowId)
    if (filters.search) {
      queryBuilder.andWhere(
        '(test.name ILIKE :search OR test.description ILIKE :search OR flowConfig.flowId ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Apply questionSetId filter
    if (filters.questionSetId) {
      queryBuilder.andWhere('test.questionSetId = :questionSetId', {
        questionSetId: filters.questionSetId,
      });
    }

    // Apply accessTokenId filter
    if (filters.accessTokenId) {
      queryBuilder.andWhere('test.accessTokenId = :accessTokenId', {
        accessTokenId: filters.accessTokenId,
      });
    }

    // Apply webhookId filter
    if (filters.webhookId) {
      queryBuilder.andWhere('test.webhookId = :webhookId', {
        webhookId: filters.webhookId,
      });
    }

    // Apply multiStep filter
    if (filters.multiStep !== undefined) {
      queryBuilder.andWhere('test.multiStepEvaluation = :multiStep', {
        multiStep: filters.multiStep,
      });
    }

    // Apply flowConfigId filter
    if (filters.flowConfigId) {
      queryBuilder.andWhere('test.flowConfigId = :flowConfigId', {
        flowConfigId: filters.flowConfigId,
      });
    }

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Apply sorting
    const sortField = filters.sortBy || 'createdAt';
    const sortDirection =
      (filters.sortDirection?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';
    queryBuilder.orderBy(`test.${sortField}`, sortDirection);

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

  async findOne(id: string, userId: string): Promise<Test> {
    const test = await this.testRepository.findOne({
      where: { id, userId },
      relations: ['questionSet', 'accessToken', 'webhook', 'flowConfig'],
    });
    if (!test) {
      throw new NotFoundException(`Test not found: ${id}`);
    }
    return test;
  }

  async update(id: string, dto: UpdateTestDto, userId: string): Promise<Test> {
    // Verify test exists and belongs to user
    await this.findOne(id, userId);

    // Use repository.update() instead of .save() because .save() ignores undefined values
    const updateData: Partial<Test> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.multiStepEvaluation !== undefined)
      updateData.multiStepEvaluation = dto.multiStepEvaluation;

    // For nullable FK fields: null from DTO means clear, valid UUID means set
    if (dto.flowConfigId !== undefined) {
      updateData.flowConfigId =
        dto.flowConfigId || (null as unknown as string);
    }
    if (dto.accessTokenId !== undefined) {
      updateData.accessTokenId =
        dto.accessTokenId || (null as unknown as string);
    }
    if (dto.questionSetId !== undefined) {
      updateData.questionSetId =
        dto.questionSetId || (null as unknown as string);
    }
    if (dto.webhookId !== undefined) {
      updateData.webhookId = dto.webhookId || (null as unknown as string);
    }

    await this.testRepository.update({ id, userId }, updateData);
    return this.findOne(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.testRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Test not found: ${id}`);
    }
  }
}
