import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { EvaluationSession, SaveSessionRequest } from '@agent-eval/shared';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  async getSessions(): Promise<EvaluationSession[]> {
    return this.sessionsService.getSessions();
  }

  @Get(':id')
  async getSession(@Param('id') id: string): Promise<EvaluationSession> {
    return this.sessionsService.getSession(id);
  }

  @Post()
  async saveSession(
    @Body() request: SaveSessionRequest
  ): Promise<{ id: string }> {
    return this.sessionsService.saveSession(request.flowName, request.session);
  }

  @Delete(':id')
  async deleteSession(@Param('id') id: string): Promise<void> {
    return this.sessionsService.deleteSession(id);
  }

  @Get(':id/export')
  async exportSession(
    @Param('id') id: string,
    @Query('format') format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    return this.sessionsService.exportSession(id, format);
  }
}
