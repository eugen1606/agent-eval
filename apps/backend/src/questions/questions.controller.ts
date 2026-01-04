import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { QuestionsService, CreateQuestionSetDto } from './questions.service';
import { QuestionSet } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface ImportQuestionsDto {
  name: string;
  description?: string;
  questions: unknown;
}

interface QuestionItem {
  question: string;
  expectedAnswer?: string;
}

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

  @Post('import')
  async import(
    @Body() dto: ImportQuestionsDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<QuestionSet> {
    // Validate name
    if (!dto.name || typeof dto.name !== 'string' || dto.name.trim() === '') {
      throw new BadRequestException('Name is required and must be a non-empty string');
    }

    // Validate questions is an array
    if (!Array.isArray(dto.questions)) {
      throw new BadRequestException('Questions must be an array');
    }

    if (dto.questions.length === 0) {
      throw new BadRequestException('Questions array cannot be empty');
    }

    // Validate each question
    const validatedQuestions: QuestionItem[] = [];
    for (let i = 0; i < dto.questions.length; i++) {
      const item = dto.questions[i] as Record<string, unknown>;

      if (!item || typeof item !== 'object') {
        throw new BadRequestException(`Question at index ${i} must be an object`);
      }

      if (!item.question || typeof item.question !== 'string') {
        throw new BadRequestException(`Question at index ${i} must have a "question" property of type string`);
      }

      if (item.expectedAnswer !== undefined && typeof item.expectedAnswer !== 'string') {
        throw new BadRequestException(`Question at index ${i}: "expectedAnswer" must be a string if provided`);
      }

      validatedQuestions.push({
        question: item.question,
        expectedAnswer: item.expectedAnswer as string | undefined,
      });
    }

    return this.questionsService.create(
      {
        name: dto.name.trim(),
        questions: validatedQuestions,
        description: dto.description,
      },
      user.userId,
    );
  }
}
