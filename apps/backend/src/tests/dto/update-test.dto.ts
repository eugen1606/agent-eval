import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class UpdateTestDto {
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
  @ValidateIf((o) => o.flowConfigId !== null)
  @IsUUID()
  flowConfigId?: string | null;

  // Allow null to clear the field, skip UUID validation when null
  @IsOptional()
  @ValidateIf((o) => o.accessTokenId !== null)
  @IsUUID()
  accessTokenId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.questionSetId !== null)
  @IsUUID()
  questionSetId?: string | null;

  @IsOptional()
  @IsBoolean()
  multiStepEvaluation?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.webhookId !== null)
  @IsUUID()
  webhookId?: string | null;
}
