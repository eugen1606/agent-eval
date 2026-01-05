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
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { EvaluationsService, CreateEvaluationDto } from './evaluations.service';
import { Evaluation } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EvaluationResult } from '@agent-eval/shared';

@Controller('evaluations')
@UseGuards(JwtAuthGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private convertResultsToCsv(results: EvaluationResult[]): string {
    const headers = [
      'id',
      'question',
      'answer',
      'expectedAnswer',
      'humanEvaluation',
      'humanEvaluationDescription',
      'severity',
      'isCorrect',
      'llmJudgeScore',
      'llmJudgeReasoning',
      'isError',
      'errorMessage',
      'executionId',
      'timestamp',
    ];

    const rows = results.map((result) =>
      headers.map((header) => this.escapeCsvValue(result[header as keyof EvaluationResult])).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

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
    @Query('format') format = 'json',
    @Res() res: Response,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    const evaluation = await this.evaluationsService.findOne(id, user.userId);

    if (format === 'csv') {
      const results = evaluation.finalOutput?.results as EvaluationResult[] | undefined;
      if (!results || !Array.isArray(results)) {
        throw new BadRequestException('Evaluation has no results to export');
      }

      const csv = this.convertResultsToCsv(results);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="evaluation-${id}.csv"`
      );
      return res.send(csv);
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="evaluation-${id}.json"`
      );
      return res.send(JSON.stringify(evaluation, null, 2));
    }

    throw new BadRequestException(`Unsupported export format: ${format}. Supported formats: json, csv`);
  }
}
