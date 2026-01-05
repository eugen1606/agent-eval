import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Test } from '../database/entities';

export interface CreateTestDto {
  name: string;
  description?: string;
  flowId: string;
  basePath: string;
  accessTokenId?: string;
  questionSetId?: string;
  multiStepEvaluation?: boolean;
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
      userId,
    });
    return this.testRepository.save(test);
  }

  async findAll(userId: string): Promise<Test[]> {
    return this.testRepository.find({
      where: { userId },
      relations: ['questionSet'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Test> {
    const test = await this.testRepository.findOne({
      where: { id, userId },
      relations: ['questionSet', 'accessToken'],
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

    return this.testRepository.save(test);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.testRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Test not found: ${id}`);
    }
  }
}
