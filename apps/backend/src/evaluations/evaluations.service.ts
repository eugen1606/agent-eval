import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation } from '../database/entities';

export interface CreateEvaluationDto {
  name: string;
  finalOutput: Record<string, unknown>;
  flowExport?: Record<string, unknown>;
  flowId?: string;
  questionSetId?: string;
  description?: string;
}

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(Evaluation)
    private evaluationRepository: Repository<Evaluation>
  ) {}

  async create(dto: CreateEvaluationDto, userId: string): Promise<Evaluation> {
    const evaluation = this.evaluationRepository.create({
      name: dto.name,
      finalOutput: dto.finalOutput,
      flowExport: dto.flowExport,
      flowId: dto.flowId,
      questionSetId: dto.questionSetId,
      description: dto.description,
      userId,
    });
    return this.evaluationRepository.save(evaluation);
  }

  async findAll(userId: string): Promise<Evaluation[]> {
    return this.evaluationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id, userId },
    });
    if (!evaluation) {
      throw new NotFoundException(`Evaluation not found: ${id}`);
    }
    return evaluation;
  }

  async update(id: string, dto: Partial<CreateEvaluationDto>, userId: string): Promise<Evaluation> {
    const evaluation = await this.findOne(id, userId);

    if (dto.name) evaluation.name = dto.name;
    if (dto.finalOutput) evaluation.finalOutput = dto.finalOutput;
    if (dto.flowExport !== undefined) evaluation.flowExport = dto.flowExport;
    if (dto.flowId !== undefined) evaluation.flowId = dto.flowId;
    if (dto.questionSetId !== undefined) evaluation.questionSetId = dto.questionSetId;
    if (dto.description !== undefined) evaluation.description = dto.description;

    return this.evaluationRepository.save(evaluation);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.evaluationRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Evaluation not found: ${id}`);
    }
  }

  async exportAsJson(id: string, userId: string): Promise<string> {
    const evaluation = await this.findOne(id, userId);
    return JSON.stringify(evaluation, null, 2);
  }
}
