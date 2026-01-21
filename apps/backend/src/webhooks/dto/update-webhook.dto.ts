import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsObject,
  IsUrl,
  IsBoolean,
  MaxLength,
  MinLength,
  ArrayMinSize,
} from 'class-validator';
import { MAX_LENGTHS } from '../../common/validation.constants';
import { WebhookEvent, WebhookMethod } from '../../database/entities';

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(MAX_LENGTHS.URL)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.DESCRIPTION)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(['run.running', 'run.completed', 'run.failed', 'run.evaluated'], { each: true })
  events?: WebhookEvent[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.SECRET)
  secret?: string;

  @IsOptional()
  @IsEnum(['POST', 'PUT', 'PATCH'])
  method?: WebhookMethod;

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
