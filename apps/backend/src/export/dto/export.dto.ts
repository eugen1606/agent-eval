import {
  IsArray,
  IsOptional,
  IsEnum,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ExportEntityType } from '@agent-eval/shared';

// Helper to ensure value is always an array (handles query params coming as string or array)
const toArray = (value: unknown): unknown[] | undefined => {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value : [value];
};

export class ExportQueryDto {
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(
    ['tests', 'questionSets', 'flowConfigs', 'tags', 'webhooks', 'runs'] as const,
    { each: true },
  )
  types: ExportEntityType[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  testIds?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  questionSetIds?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  flowConfigIds?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  webhookIds?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  runIds?: string[];
}
