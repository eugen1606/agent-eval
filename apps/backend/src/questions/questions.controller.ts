import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  QuestionsService,
  EntityUsage,
  PaginatedQuestionSets,
  QuestionSetsSortField,
  SortDirection,
} from './questions.service';
import {
  CreateQuestionSetDto,
  UpdateQuestionSetDto,
  ImportQuestionsDto,
  QuestionItemDto,
} from './dto';
import { QuestionSet } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('questions')
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: QuestionSetsSortField,
    @Query('sortDirection') sortDirection?: SortDirection,
  ): Promise<PaginatedQuestionSets> {
    return this.questionsService.findAll(user.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      sortBy,
      sortDirection,
    });
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
    @Body() dto: UpdateQuestionSetDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<QuestionSet> {
    return this.questionsService.update(id, dto, user.userId);
  }

  @Get(':id/usage')
  async getUsage(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<EntityUsage> {
    return this.questionsService.getUsage(id, user.userId);
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
    const validatedQuestions: QuestionItemDto[] = [];
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

      if (item.inputVariables !== undefined && (typeof item.inputVariables !== 'object' || item.inputVariables === null || Array.isArray(item.inputVariables))) {
        throw new BadRequestException(`Question at index ${i}: "inputVariables" must be an object if provided`);
      }

      validatedQuestions.push({
        question: item.question,
        expectedAnswer: item.expectedAnswer as string | undefined,
        inputVariables: item.inputVariables as Record<string, unknown> | undefined,
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
