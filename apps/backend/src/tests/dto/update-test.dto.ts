import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsArray,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class UpdateTestDto {
  @ApiPropertyOptional({ description: 'Test name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name?: string;

  @ApiPropertyOptional({ description: 'Test description' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.DESCRIPTION)
  description?: string;

  @ApiPropertyOptional({ description: 'Flow configuration ID (set null to clear)' })
  @IsOptional()
  @ValidateIf((o) => o.flowConfigId !== null)
  @IsUUID()
  flowConfigId?: string | null;

  @ApiPropertyOptional({ description: 'Access token ID (set null to clear)' })
  @IsOptional()
  @ValidateIf((o) => o.accessTokenId !== null)
  @IsUUID()
  accessTokenId?: string | null;

  @ApiPropertyOptional({ description: 'Question set ID (set null to clear)' })
  @IsOptional()
  @ValidateIf((o) => o.questionSetId !== null)
  @IsUUID()
  questionSetId?: string | null;

  @ApiPropertyOptional({ description: 'Enable multi-step evaluation' })
  @IsOptional()
  @IsBoolean()
  multiStepEvaluation?: boolean;

  @ApiPropertyOptional({ description: 'Webhook ID (set null to clear)' })
  @IsOptional()
  @ValidateIf((o) => o.webhookId !== null)
  @IsUUID()
  webhookId?: string | null;

  @ApiPropertyOptional({ description: 'Tag IDs to associate with this test', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];
}
