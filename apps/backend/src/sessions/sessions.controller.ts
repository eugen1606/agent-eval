import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { EvaluationSession, SaveSessionRequest } from '@agent-eval/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  async getSessions(
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<EvaluationSession[]> {
    return this.sessionsService.getSessions(user.userId);
  }

  @Get(':id')
  async getSession(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<EvaluationSession> {
    return this.sessionsService.getSession(id, user.userId);
  }

  @Post()
  async saveSession(
    @Body() request: SaveSessionRequest,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<{ id: string }> {
    return this.sessionsService.saveSession(request.flowName, request.session, user.userId);
  }

  @Delete(':id')
  async deleteSession(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.sessionsService.deleteSession(id, user.userId);
  }

  @Get(':id/export')
  async exportSession(
    @Param('id') id: string,
    @Query('format') format: 'json' | 'csv' = 'json',
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<string> {
    return this.sessionsService.exportSession(id, user.userId, format);
  }
}
