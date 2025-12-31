import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionSet } from '../database/entities';

export interface QuestionItem {
  question: string;
  expectedAnswer?: string;
}

export interface CreateQuestionSetDto {
  name: string;
  questions: QuestionItem[];
  description?: string;
}

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(QuestionSet)
    private questionSetRepository: Repository<QuestionSet>
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

  async findAll(userId: string): Promise<QuestionSet[]> {
    return this.questionSetRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
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

  async update(id: string, dto: Partial<CreateQuestionSetDto>, userId: string): Promise<QuestionSet> {
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
}
