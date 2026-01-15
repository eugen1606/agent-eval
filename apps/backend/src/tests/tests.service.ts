import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Test } from '../database/entities';

export interface CreateTestDto {
  name: string;
  description?: string;
  flowId: string;
  basePath: string;
  accessTokenId?: string;
  questionSetId?: string;
  multiStepEvaluation?: boolean;
  webhookId?: string;
}

export interface TestsFilterDto {
  page?: number;
  limit?: number;
  search?: string;
  questionSetId?: string;
  multiStep?: boolean;
  flowId?: string;
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
    private testRepository: Repository<Test>
  ) {}

  async create(dto: CreateTestDto, userId: string): Promise<Test> {
    const test = this.testRepository.create({
      name: dto.name,
      description: dto.description,
      flowId: dto.flowId,
      basePath: dto.basePath,
      accessTokenId: dto.accessTokenId,
      questionSetId: dto.questionSetId,
      multiStepEvaluation: dto.multiStepEvaluation ?? false,
      webhookId: dto.webhookId,
      userId,
    });
    return this.testRepository.save(test);
  }

  async findAll(userId: string, filters: TestsFilterDto = {}): Promise<PaginatedTests> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.testRepository
      .createQueryBuilder('test')
      .leftJoinAndSelect('test.questionSet', 'questionSet')
      .where('test.userId = :userId', { userId });

    // Apply search filter
    if (filters.search) {
      queryBuilder.andWhere(
        '(test.name ILIKE :search OR test.description ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    // Apply questionSetId filter
    if (filters.questionSetId) {
      queryBuilder.andWhere('test.questionSetId = :questionSetId', {
        questionSetId: filters.questionSetId,
      });
    }

    // Apply multiStep filter
    if (filters.multiStep !== undefined) {
      queryBuilder.andWhere('test.multiStepEvaluation = :multiStep', {
        multiStep: filters.multiStep,
      });
    }

    // Apply flowId filter
    if (filters.flowId) {
      queryBuilder.andWhere('test.flowId ILIKE :flowId', {
        flowId: `%${filters.flowId}%`,
      });
    }

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Apply pagination and ordering
    const data = await queryBuilder
      .orderBy('test.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

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
      relations: ['questionSet', 'accessToken', 'webhook'],
    });
    if (!test) {
      throw new NotFoundException(`Test not found: ${id}`);
    }
    return test;
  }

  async update(id: string, dto: Partial<CreateTestDto>, userId: string): Promise<Test> {
    const test = await this.findOne(id, userId);

    if (dto.name !== undefined) test.name = dto.name;
    if (dto.description !== undefined) test.description = dto.description;
    if (dto.flowId !== undefined) test.flowId = dto.flowId;
    if (dto.basePath !== undefined) test.basePath = dto.basePath;
    if (dto.accessTokenId !== undefined) test.accessTokenId = dto.accessTokenId;
    if (dto.questionSetId !== undefined) test.questionSetId = dto.questionSetId;
    if (dto.multiStepEvaluation !== undefined) test.multiStepEvaluation = dto.multiStepEvaluation;
    if (dto.webhookId !== undefined) test.webhookId = dto.webhookId || undefined;

    return this.testRepository.save(test);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.testRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Test not found: ${id}`);
    }
  }
}
