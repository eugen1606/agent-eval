import { IsString, IsOptional, MaxLength, MinLength, IsUUID, IsBoolean, IsIn } from 'class-validator';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class UpdateEvaluatorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.DESCRIPTION)
  description?: string;

  @IsOptional()
  @IsUUID()
  accessTokenId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  model?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  systemPrompt?: string;

  @IsOptional()
  @IsBoolean()
  reasoningModel?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['none', 'minimal', 'low', 'medium', 'high'])
  reasoningEffort?: string;
}
