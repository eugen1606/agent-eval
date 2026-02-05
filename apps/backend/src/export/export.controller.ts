import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { ExportQueryDto, ImportRequestDto, ImportBundleDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ExportBundle,
  ImportPreviewResult,
  ImportResult,
} from '@agent-eval/shared';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get()
  async export(
    @Query() query: ExportQueryDto,
    @CurrentUser() user: { userId: string; email: string },
    @Res() res: Response,
  ): Promise<void> {
    const bundle = await this.exportService.export(query, user.userId);

    const filename = `benchmark-export-${new Date().toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(bundle, null, 2));
  }

  @Post('preview')
  async previewImport(
    @Body() body: ImportBundleDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<ImportPreviewResult> {
    return this.exportService.previewImport(body, user.userId);
  }

  @Post('import')
  async import(
    @Body() body: ImportRequestDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<ImportResult> {
    return this.exportService.import(
      body.bundle,
      body.options.conflictStrategy,
      user.userId,
    );
  }
}
