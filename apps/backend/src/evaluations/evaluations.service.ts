import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evaluation } from '../database/entities';

export interface CreateEvaluationDto {
  name: string;
  finalOutput: Record<string, unknown>;
  flowExport?: Record<string, unknown>;
  flowId?: string;
  description?: string;
}

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(Evaluation)
    private evaluationRepository: Repository<Evaluation>
  ) {}

  async create(dto: CreateEvaluationDto): Promise<Evaluation> {
    const evaluation = this.evaluationRepository.create({
      name: dto.name,
      finalOutput: dto.finalOutput,
      flowExport: dto.flowExport,
      flowId: dto.flowId,
      description: dto.description,
    });
    return this.evaluationRepository.save(evaluation);
  }

  async findAll(): Promise<Evaluation[]> {
    return this.evaluationRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id },
    });
    if (!evaluation) {
      throw new NotFoundException(`Evaluation not found: ${id}`);
    }
    return evaluation;
  }

  async update(id: string, dto: Partial<CreateEvaluationDto>): Promise<Evaluation> {
    const evaluation = await this.findOne(id);

    if (dto.name) evaluation.name = dto.name;
    if (dto.finalOutput) evaluation.finalOutput = dto.finalOutput;
    if (dto.flowExport !== undefined) evaluation.flowExport = dto.flowExport;
    if (dto.flowId !== undefined) evaluation.flowId = dto.flowId;
    if (dto.description !== undefined) evaluation.description = dto.description;

    return this.evaluationRepository.save(evaluation);
  }

  async delete(id: string): Promise<void> {
    const result = await this.evaluationRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Evaluation not found: ${id}`);
    }
  }

  async exportAsJson(id: string): Promise<string> {
    const evaluation = await this.findOne(id);
    return JSON.stringify(evaluation, null, 2);
  }
}
