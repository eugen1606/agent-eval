import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { QuestionsService, CreateQuestionSetDto } from './questions.service';
import { QuestionSet } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('questions')
@UseGuards(JwtAuthGuard)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  async create(
    @Body() dto: CreateQuestionSetDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<QuestionSet> {
    return this.questionsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<QuestionSet[]> {
    return this.questionsService.findAll(user.userId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<QuestionSet> {
    return this.questionsService.findOne(id, user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateQuestionSetDto>,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<QuestionSet> {
    return this.questionsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.questionsService.delete(id, user.userId);
  }
}
