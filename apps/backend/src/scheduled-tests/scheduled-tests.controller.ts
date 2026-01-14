import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ScheduledTestsService,
  CreateScheduledTestDto,
  PaginatedScheduledTests,
} from './scheduled-tests.service';
import { ScheduledTest, ScheduledTestStatus } from '../database/entities/scheduled-test.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('scheduled-tests')
@UseGuards(JwtAuthGuard)
export class ScheduledTestsController {
  constructor(private readonly scheduledTestsService: ScheduledTestsService) {}

  @Post()
  async create(
    @Body() dto: CreateScheduledTestDto,
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<ScheduledTest> {
    return this.scheduledTestsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('testId') testId?: string,
    @Query('status') status?: ScheduledTestStatus,
    @CurrentUser() user?: { userId: string; email: string }
  ): Promise<PaginatedScheduledTests> {
    return this.scheduledTestsService.findAll(user!.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      testId,
      status,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<ScheduledTest> {
    return this.scheduledTestsService.findOne(id, user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateScheduledTestDto>,
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<ScheduledTest> {
    return this.scheduledTestsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<void> {
    return this.scheduledTestsService.delete(id, user.userId);
  }

  @Post(':id/reset')
  async resetToPending(
    @Param('id') id: string,
    @Body() body: { scheduledAt?: string },
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<ScheduledTest> {
    return this.scheduledTestsService.resetToPending(id, user.userId, body.scheduledAt);
  }

  @Post(':id/execute')
  async executeNow(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string }
  ): Promise<{ message: string }> {
    await this.scheduledTestsService.findOne(id, user.userId);
    await this.scheduledTestsService.executeScheduledTest(id);
    return { message: 'Execution started' };
  }
}
