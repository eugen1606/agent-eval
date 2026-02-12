import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class CreateTestDto {
  @ApiProperty({ description: 'Test name', example: 'Customer Support Flow Test' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name: string;

  @ApiPropertyOptional({ description: 'Test description' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.DESCRIPTION)
  description?: string;

  @ApiProperty({ description: 'Flow configuration ID to use for this test' })
  @IsUUID()
  flowConfigId: string;

  @ApiPropertyOptional({ description: 'Access token ID for flow authentication' })
  @IsOptional()
  @IsUUID()
  accessTokenId?: string;

  @ApiPropertyOptional({ description: 'Question set ID to use for test execution' })
  @IsOptional()
  @IsUUID()
  questionSetId?: string;

  @ApiPropertyOptional({ description: 'Enable multi-step evaluation (same session for all questions)', default: false })
  @IsOptional()
  @IsBoolean()
  multiStepEvaluation?: boolean;

  @ApiPropertyOptional({ description: 'Webhook ID to trigger on run events' })
  @IsOptional()
  @IsUUID()
  webhookId?: string;

  @ApiPropertyOptional({ description: 'Evaluator ID for automatic AI evaluation after run completes' })
  @IsOptional()
  @IsUUID()
  evaluatorId?: string;

  @ApiPropertyOptional({ description: 'Tag IDs to associate with this test', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];
}
