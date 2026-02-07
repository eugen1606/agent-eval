import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { EvaluationService } from './evaluation.service';
import { LLMJudgeRequest, LLMJudgeResponse } from '@agent-eval/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('evaluation')
@Controller('evaluate')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post('llm-judge')
  async evaluateWithLLM(
    @Body() request: LLMJudgeRequest
  ): Promise<LLMJudgeResponse> {
    return this.evaluationService.evaluateWithLLM(
      request.question,
      request.answer,
      request.expectedAnswer
    );
  }
}
