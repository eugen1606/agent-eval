import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Conversation,
  ConversationHumanEvaluation,
  ConversationStatus,
} from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RunsService } from '../runs/runs.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ConversationRunService } from './conversation-run.service';
import { ConversationRunStats } from '@agent-eval/shared';

interface EvaluateConversationDto {
  humanEvaluation: ConversationHumanEvaluation;
  humanEvaluationNotes?: string;
  status?: ConversationStatus;
}

@ApiTags('conversations')
@Controller('runs/:runId/conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    private runsService: RunsService,
    private webhooksService: WebhooksService,
    private conversationRunService: ConversationRunService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List conversations in a run' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async findAll(
    @Param('runId') runId: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Conversation[]> {
    // Verify run belongs to user
    await this.runsService.findOne(runId, user.userId);

    return this.conversationRepository.find({
      where: { runId },
      relations: ['scenario', 'scenario.persona'],
      order: { startedAt: 'ASC' },
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get conversation run stats' })
  @ApiResponse({ status: 200, description: 'Conversation run statistics' })
  async getStats(
    @Param('runId') runId: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<ConversationRunStats> {
    // Verify run belongs to user
    await this.runsService.findOne(runId, user.userId);

    return this.conversationRunService.getConversationStats(runId);
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'Get a conversation with full transcript' })
  @ApiResponse({ status: 200, description: 'Conversation found' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async findOne(
    @Param('runId') runId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Conversation> {
    // Verify run belongs to user
    await this.runsService.findOne(runId, user.userId);

    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, runId },
      relations: ['scenario', 'scenario.persona'],
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation not found: ${conversationId}`);
    }

    return conversation;
  }

  @Put(':conversationId/evaluate')
  @ApiOperation({ summary: 'Submit human evaluation for a conversation' })
  @ApiResponse({ status: 200, description: 'Evaluation saved' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async evaluate(
    @Param('runId') runId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: EvaluateConversationDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Conversation> {
    // Verify run belongs to user
    await this.runsService.findOne(runId, user.userId);

    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, runId },
      relations: ['scenario', 'scenario.persona'],
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation not found: ${conversationId}`);
    }

    conversation.humanEvaluation = dto.humanEvaluation;
    if (dto.humanEvaluationNotes !== undefined) {
      conversation.humanEvaluationNotes = dto.humanEvaluationNotes;
    }
    if (dto.status === 'goal_achieved' || dto.status === 'goal_not_achieved') {
      conversation.status = dto.status;
      conversation.goalAchieved = dto.status === 'goal_achieved';
    }

    const saved = await this.conversationRepository.save(conversation);

    // Trigger conversation.evaluated webhook
    const run = await this.runsService.findOne(runId, user.userId);
    if (run.test?.webhookId) {
      this.webhooksService.triggerWebhooks(user.userId, 'conversation.evaluated', {
        runId,
        testId: run.testId,
        testName: run.test?.name,
        conversationId: saved.id,
        conversationStatus: saved.status,
        goalAchieved: saved.goalAchieved ?? undefined,
        totalTurns: saved.totalTurns,
        scenarioName: saved.scenario?.name,
        personaName: saved.scenario?.persona?.name,
        humanEvaluation: saved.humanEvaluation ?? undefined,
        humanEvaluationNotes: saved.humanEvaluationNotes ?? undefined,
      });
    }

    return saved;
  }

  @Post(':conversationId/rerun')
  @ApiOperation({ summary: 'Re-run a single scenario (creates new conversation)' })
  @ApiResponse({ status: 201, description: 'New conversation created from rerun' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async rerun(
    @Param('runId') runId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Conversation> {
    // Verify run belongs to user
    await this.runsService.findOne(runId, user.userId);

    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, runId },
      relations: ['scenario', 'scenario.persona'],
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation not found: ${conversationId}`);
    }

    // Create a new empty conversation for the same scenario
    const newConversation = this.conversationRepository.create({
      runId,
      scenarioId: conversation.scenarioId,
      status: 'running',
      turns: [],
      totalTurns: 0,
      startedAt: new Date(),
    });

    const saved = await this.conversationRepository.save(newConversation);

    // Return the new conversation (actual re-execution would be triggered separately)
    // For now, mark it as pending to be picked up
    return this.conversationRepository.findOne({
      where: { id: saved.id },
      relations: ['scenario', 'scenario.persona'],
    });
  }
}
