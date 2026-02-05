import {
  IsObject,
  IsEnum,
  IsOptional,
  IsArray,
  IsString,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ConflictStrategy,
  ExportBundle,
  WebhookEvent,
  WebhookMethod,
} from '@agent-eval/shared';

class ExportMetadataDto {
  @IsString()
  version: string;

  @IsString()
  exportedAt: string;

  @IsOptional()
  @IsString()
  exportedBy?: string;
}

class ExportedQuestionDto {
  @IsString()
  question: string;

  @IsOptional()
  @IsString()
  expectedAnswer?: string;
}

class ExportedTestDto {
  @IsString()
  exportId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  flowConfigExportId?: string;

  @IsOptional()
  @IsString()
  questionSetExportId?: string;

  @IsOptional()
  @IsString()
  webhookExportId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagExportIds?: string[];

  @IsBoolean()
  multiStepEvaluation: boolean;
}

class ExportedQuestionSetDto {
  @IsString()
  exportId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportedQuestionDto)
  questions: ExportedQuestionDto[];
}

class ExportedFlowConfigDto {
  @IsString()
  exportId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  flowId: string;

  @IsString()
  basePath: string;
}

class ExportedTagDto {
  @IsString()
  exportId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  color?: string;
}

class ExportedWebhookDto {
  @IsString()
  exportId: string;

  @IsString()
  name: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsEnum(
    ['run.running', 'run.completed', 'run.failed', 'run.evaluated'] as const,
    { each: true },
  )
  events: WebhookEvent[];

  @IsBoolean()
  enabled: boolean;

  @IsEnum(['POST', 'PUT', 'PATCH'] as const)
  method: WebhookMethod;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsObject()
  queryParams?: Record<string, string>;

  @IsOptional()
  @IsObject()
  bodyTemplate?: Record<string, unknown>;
}

export class ImportBundleDto implements ExportBundle {
  @ValidateNested()
  @Type(() => ExportMetadataDto)
  metadata: ExportMetadataDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportedTestDto)
  tests?: ExportedTestDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportedQuestionSetDto)
  questionSets?: ExportedQuestionSetDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportedFlowConfigDto)
  flowConfigs?: ExportedFlowConfigDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportedTagDto)
  tags?: ExportedTagDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportedWebhookDto)
  webhooks?: ExportedWebhookDto[];
}

export class ImportOptionsDto {
  @IsEnum(['skip', 'overwrite', 'rename'] as const)
  conflictStrategy: ConflictStrategy;
}

export class ImportRequestDto {
  @ValidateNested()
  @Type(() => ImportBundleDto)
  bundle: ImportBundleDto;

  @ValidateNested()
  @Type(() => ImportOptionsDto)
  options: ImportOptionsDto;
}
