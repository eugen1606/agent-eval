import { Controller, Post, Body, UseGuards, Sse, MessageEvent } from '@nestjs/common';
import { FlowService } from './flow.service';
import { ExecuteFlowRequest } from '@agent-eval/shared';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Observable } from 'rxjs';

@Controller('flow')
@UseGuards(JwtAuthGuard)
export class FlowController {
  constructor(private readonly flowService: FlowService) {}

  @Post('/execute-stream')
  @Sse()
  executeFlowStream(
    @Body() request: ExecuteFlowRequest,
    @CurrentUser() user: { userId: string; email: string },
  ): Observable<MessageEvent> {
    const sessionId = uuidv4();

    return new Observable((subscriber) => {
      (async () => {
        try {
          // Send session start event
          subscriber.next({
            data: JSON.stringify({ type: 'session_start', sessionId }),
          });

          // Stream results one by one
          for await (const result of this.flowService.executeFlowStream(
            request.config,
            request.questions,
            user.userId,
          )) {
            subscriber.next({
              data: JSON.stringify({ type: 'result', result }),
            });
          }

          // Send completion event
          subscriber.next({
            data: JSON.stringify({ type: 'complete', sessionId }),
          });
          subscriber.complete();
        } catch (error) {
          subscriber.next({
            data: JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          });
          subscriber.complete();
        }
      })();
    });
  }
}
