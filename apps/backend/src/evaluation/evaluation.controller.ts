import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { EvaluationService } from './evaluation.service';
import { EvaluatorsService } from '../evaluators/evaluators.service';
import { LLMJudgeRequest, LLMJudgeResponse, LLMJudgeStatusResponse } from '@agent-eval/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('evaluation')
@Controller('evaluate')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class EvaluationController {
  constructor(
    private readonly evaluationService: EvaluationService,
    private readonly evaluatorsService: EvaluatorsService,
  ) {}

  @Get('llm-judge/status')
  async getLLMJudgeStatus(
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<LLMJudgeStatusResponse> {
    const result = await this.evaluatorsService.findAll(user.userId, { limit: 100 });
    return {
      available: result.data.length > 0,
      evaluators: result.data.map((e) => ({
        id: e.id,
        name: e.name,
        model: e.model,
      })),
    };
  }

  @Post('llm-judge')
  async evaluateWithLLM(
    @Body() _request: LLMJudgeRequest,
  ): Promise<LLMJudgeResponse> {
    // Legacy endpoint — returns mock since no config is provided
    return {
      score: 0,
      reasoning: 'This endpoint is deprecated. Use the evaluator-based endpoints instead.',
      isCorrect: false,
    };
  }
}
