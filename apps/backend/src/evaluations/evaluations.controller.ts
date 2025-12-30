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
} from '@nestjs/common';
import { Response } from 'express';
import { EvaluationsService, CreateEvaluationDto } from './evaluations.service';
import { Evaluation } from '../database/entities';

@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post()
  async create(@Body() dto: CreateEvaluationDto): Promise<Evaluation> {
    return this.evaluationsService.create(dto);
  }

  @Get()
  async findAll(): Promise<Evaluation[]> {
    return this.evaluationsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Evaluation> {
    return this.evaluationsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateEvaluationDto>
  ): Promise<Evaluation> {
    return this.evaluationsService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.evaluationsService.delete(id);
  }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query('format') format: string = 'json',
    @Res() res: Response
  ) {
    const evaluation = await this.evaluationsService.findOne(id);

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
