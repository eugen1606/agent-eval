import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { QuestionsService, CreateQuestionSetDto } from './questions.service';
import { QuestionSet } from '../database/entities';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  async create(@Body() dto: CreateQuestionSetDto): Promise<QuestionSet> {
    return this.questionsService.create(dto);
  }

  @Get()
  async findAll(): Promise<QuestionSet[]> {
    return this.questionsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<QuestionSet> {
    return this.questionsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateQuestionSetDto>
  ): Promise<QuestionSet> {
    return this.questionsService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.questionsService.delete(id);
  }
}
