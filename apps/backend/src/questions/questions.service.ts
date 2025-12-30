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

  async create(dto: CreateQuestionSetDto): Promise<QuestionSet> {
    const questionSet = this.questionSetRepository.create({
      name: dto.name,
      questions: dto.questions,
      description: dto.description,
    });
    return this.questionSetRepository.save(questionSet);
  }

  async findAll(): Promise<QuestionSet[]> {
    return this.questionSetRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<QuestionSet> {
    const questionSet = await this.questionSetRepository.findOne({
      where: { id },
    });
    if (!questionSet) {
      throw new NotFoundException(`Question set not found: ${id}`);
    }
    return questionSet;
  }

  async update(id: string, dto: Partial<CreateQuestionSetDto>): Promise<QuestionSet> {
    const questionSet = await this.findOne(id);

    if (dto.name) questionSet.name = dto.name;
    if (dto.questions) questionSet.questions = dto.questions;
    if (dto.description !== undefined) questionSet.description = dto.description;

    return this.questionSetRepository.save(questionSet);
  }

  async delete(id: string): Promise<void> {
    const result = await this.questionSetRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Question set not found: ${id}`);
    }
  }
}
