import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluator, AccessToken } from '../database/entities';
import { CreateEvaluatorDto, UpdateEvaluatorDto } from './dto';

export interface EvaluatorResponse {
  id: string;
  name: string;
  description?: string;
  accessTokenId?: string;
  accessTokenName?: string;
  model: string;
  systemPrompt: string;
  reasoningModel?: boolean;
  reasoningEffort?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EvaluatorsSortField = 'name' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface EvaluatorsFilterDto {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: EvaluatorsSortField;
  sortDirection?: SortDirection;
}

export interface PaginatedEvaluators {
  data: EvaluatorResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class EvaluatorsService {
  constructor(
    @InjectRepository(Evaluator)
    private evaluatorRepository: Repository<Evaluator>,
    @InjectRepository(AccessToken)
    private accessTokenRepository: Repository<AccessToken>,
  ) {}

  async create(dto: CreateEvaluatorDto, userId: string): Promise<EvaluatorResponse> {
    // Verify access token exists and belongs to user
    const token = await this.accessTokenRepository.findOne({
      where: { id: dto.accessTokenId, userId },
    });
    if (!token) {
      throw new NotFoundException(`Access token not found: ${dto.accessTokenId}`);
    }

    const evaluator = this.evaluatorRepository.create({
      name: dto.name,
      description: dto.description,
      accessTokenId: dto.accessTokenId,
      model: dto.model,
      systemPrompt: dto.systemPrompt,
      reasoningModel: dto.reasoningModel ?? false,
      reasoningEffort: dto.reasoningEffort,
      userId,
    });

    const saved = await this.evaluatorRepository.save(evaluator);
    return this.toResponse(saved, token.name);
  }

  async findAll(
    userId: string,
    filters: EvaluatorsFilterDto = {},
  ): Promise<PaginatedEvaluators> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.evaluatorRepository
      .createQueryBuilder('evaluator')
      .leftJoinAndSelect('evaluator.accessToken', 'accessToken')
      .where('evaluator.userId = :userId', { userId });

    if (filters.search) {
      queryBuilder.andWhere(
        '(evaluator.name ILIKE :search OR evaluator.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const sortField = filters.sortBy || 'createdAt';
    const sortDirection =
      (filters.sortDirection?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';
    queryBuilder.orderBy(`evaluator.${sortField}`, sortDirection);

    // Get total count and paginated data in one call
    const [evaluators, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

    return {
      data: evaluators.map((e) => this.toResponse(e, e.accessToken?.name)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string): Promise<EvaluatorResponse> {
    const evaluator = await this.evaluatorRepository.findOne({
      where: { id, userId },
      relations: ['accessToken'],
    });
    if (!evaluator) {
      throw new NotFoundException(`Evaluator not found: ${id}`);
    }
    return this.toResponse(evaluator, evaluator.accessToken?.name);
  }

  async findOneEntity(id: string, userId: string): Promise<Evaluator> {
    const evaluator = await this.evaluatorRepository.findOne({
      where: { id, userId },
      relations: ['accessToken'],
    });
    if (!evaluator) {
      throw new NotFoundException(`Evaluator not found: ${id}`);
    }
    return evaluator;
  }

  async update(
    id: string,
    dto: UpdateEvaluatorDto,
    userId: string,
  ): Promise<EvaluatorResponse> {
    const evaluator = await this.evaluatorRepository.findOne({
      where: { id, userId },
    });
    if (!evaluator) {
      throw new NotFoundException(`Evaluator not found: ${id}`);
    }

    if (dto.accessTokenId) {
      const token = await this.accessTokenRepository.findOne({
        where: { id: dto.accessTokenId, userId },
      });
      if (!token) {
        throw new NotFoundException(`Access token not found: ${dto.accessTokenId}`);
      }
    }

    if (dto.name !== undefined) evaluator.name = dto.name;
    if (dto.description !== undefined) evaluator.description = dto.description;
    if (dto.accessTokenId !== undefined) evaluator.accessTokenId = dto.accessTokenId;
    if (dto.model !== undefined) evaluator.model = dto.model;
    if (dto.systemPrompt !== undefined) evaluator.systemPrompt = dto.systemPrompt;
    if (dto.reasoningModel !== undefined) evaluator.reasoningModel = dto.reasoningModel;
    if (dto.reasoningEffort !== undefined) evaluator.reasoningEffort = dto.reasoningEffort;

    const saved = await this.evaluatorRepository.save(evaluator);
    // Reload with relation
    const reloaded = await this.evaluatorRepository.findOne({
      where: { id: saved.id },
      relations: ['accessToken'],
    });
    if (!reloaded) {
      throw new NotFoundException(`Evaluator not found after save: ${saved.id}`);
    }
    return this.toResponse(reloaded, reloaded.accessToken?.name);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.evaluatorRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Evaluator not found: ${id}`);
    }
  }

  async getUsage(id: string, userId: string): Promise<{ runs: number }> {
    await this.findOne(id, userId);
    // Evaluators don't have direct FK references from other tables yet
    return { runs: 0 };
  }

  private toResponse(evaluator: Evaluator, accessTokenName?: string): EvaluatorResponse {
    return {
      id: evaluator.id,
      name: evaluator.name,
      description: evaluator.description,
      accessTokenId: evaluator.accessTokenId,
      accessTokenName: accessTokenName,
      model: evaluator.model,
      systemPrompt: evaluator.systemPrompt,
      reasoningModel: evaluator.reasoningModel,
      reasoningEffort: evaluator.reasoningEffort,
      createdAt: evaluator.createdAt,
      updatedAt: evaluator.updatedAt,
    };
  }
}
