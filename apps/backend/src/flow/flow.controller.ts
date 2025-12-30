import { Controller, Post, Body } from '@nestjs/common';
import { FlowService } from './flow.service';
import {
  ExecuteFlowRequest,
  ExecuteFlowResponse,
} from '@agent-eval/shared';
import { v4 as uuidv4 } from 'uuid';

@Controller('flow')
export class FlowController {
  constructor(private readonly flowService: FlowService) {}

  @Post('execute')
  async executeFlow(
    @Body() request: ExecuteFlowRequest
  ): Promise<ExecuteFlowResponse> {
    const results = await this.flowService.executeFlow(
      request.config,
      request.questions
    );

    return {
      sessionId: uuidv4(),
      results,
    };
  }
}
