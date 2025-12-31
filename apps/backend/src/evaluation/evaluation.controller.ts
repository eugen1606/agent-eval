import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { LLMJudgeRequest, LLMJudgeResponse } from '@agent-eval/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('evaluate')
@UseGuards(JwtAuthGuard)
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
