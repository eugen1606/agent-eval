import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { EvaluationsService, CreateEvaluationDto } from './evaluations.service';
import { Evaluation } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('evaluations')
@UseGuards(JwtAuthGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post()
  async create(
    @Body() dto: CreateEvaluationDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Evaluation> {
    return this.evaluationsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Evaluation[]> {
    return this.evaluationsService.findAll(user.userId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Evaluation> {
    return this.evaluationsService.findOne(id, user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateEvaluationDto>,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Evaluation> {
    return this.evaluationsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.evaluationsService.delete(id, user.userId);
  }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query('format') format: string = 'json',
    @Res() res: Response,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    const evaluation = await this.evaluationsService.findOne(id, user.userId);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="evaluation-${id}.json"`
      );
      return res.send(JSON.stringify(evaluation, null, 2));
    }

    // Default to JSON
    return res.json(evaluation);
  }
}
