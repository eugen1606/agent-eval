import { IsString, IsOptional, MaxLength, MinLength, IsUUID, IsBoolean, IsIn } from 'class-validator';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class CreateEvaluatorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.DESCRIPTION)
  description?: string;

  @IsUUID()
  accessTokenId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  model: string;

  @IsString()
  @MinLength(1)
  systemPrompt: string;

  @IsOptional()
  @IsBoolean()
  reasoningModel?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['none', 'minimal', 'low', 'medium', 'high'])
  reasoningEffort?: string;
}
