import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionSet, Test } from '../database/entities';
import { CreateQuestionSetDto, UpdateQuestionSetDto } from './dto';

export interface EntityUsage {
  tests: { id: string; name: string }[];
}

export type QuestionSetsSortField = 'name' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface QuestionSetsFilterDto {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: QuestionSetsSortField;
  sortDirection?: SortDirection;
}

export interface PaginatedQuestionSets {
  data: QuestionSet[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(QuestionSet)
    private questionSetRepository: Repository<QuestionSet>,
    @InjectRepository(Test)
    private testRepository: Repository<Test>
  ) {}

  async create(dto: CreateQuestionSetDto, userId: string): Promise<QuestionSet> {
    const questionSet = this.questionSetRepository.create({
      name: dto.name,
      questions: dto.questions,
      description: dto.description,
      userId,
    });
    return this.questionSetRepository.save(questionSet);
  }

  async findAll(
    userId: string,
    filters: QuestionSetsFilterDto = {},
  ): Promise<PaginatedQuestionSets> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.questionSetRepository
      .createQueryBuilder('questionSet')
      .where('questionSet.userId = :userId', { userId });

    // Apply search filter
    if (filters.search) {
      queryBuilder.andWhere(
        '(questionSet.name ILIKE :search OR questionSet.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Apply sorting
    const sortField = filters.sortBy || 'createdAt';
    const sortDirection =
      (filters.sortDirection?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';
    queryBuilder.orderBy(`questionSet.${sortField}`, sortDirection);

    // Get total count and paginated data in one call
    const [data, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

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

  async findOne(id: string, userId: string): Promise<QuestionSet> {
    const questionSet = await this.questionSetRepository.findOne({
      where: { id, userId },
    });
    if (!questionSet) {
      throw new NotFoundException(`Question set not found: ${id}`);
    }
    return questionSet;
  }

  async update(id: string, dto: UpdateQuestionSetDto, userId: string): Promise<QuestionSet> {
    const questionSet = await this.findOne(id, userId);

    if (dto.name) questionSet.name = dto.name;
    if (dto.questions) questionSet.questions = dto.questions;
    if (dto.description !== undefined) questionSet.description = dto.description;

    return this.questionSetRepository.save(questionSet);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.questionSetRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Question set not found: ${id}`);
    }
  }

  async getUsage(id: string, userId: string): Promise<EntityUsage> {
    // Verify question set exists and belongs to user
    await this.findOne(id, userId);

    // Find tests that use this question set
    const tests = await this.testRepository.find({
      where: { questionSetId: id, userId },
      select: ['id', 'name'],
    });

    return {
      tests: tests.map((t) => ({ id: t.id, name: t.name })),
    };
  }
}
