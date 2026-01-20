import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
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

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.FLOW_ID)
  flowId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.BASE_PATH)
  basePath: string;

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
}
