import { Controller, Post, Body } from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { LLMJudgeRequest, LLMJudgeResponse } from '@agent-eval/shared';

@Controller('evaluate')
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
