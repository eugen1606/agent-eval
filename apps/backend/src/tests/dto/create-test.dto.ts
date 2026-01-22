import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class CreateTestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.DESCRIPTION)
  description?: string;

  @IsUUID()
  flowConfigId: string;

  @IsOptional()
  @IsUUID()
  accessTokenId?: string;

  @IsOptional()
  @IsUUID()
  questionSetId?: string;

  @IsOptional()
  @IsBoolean()
  multiStepEvaluation?: boolean;

  @IsOptional()
  @IsUUID()
  webhookId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];
}
