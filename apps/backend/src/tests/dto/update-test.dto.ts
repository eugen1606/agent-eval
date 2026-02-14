import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  Min,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MAX_LENGTHS } from '../../common/validation.constants';
import { SimulatedUserModelConfigDto } from './create-test.dto';
import { CreateScenarioDto } from './create-scenario.dto';

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

  @ApiPropertyOptional({ description: 'Evaluator ID (set null to clear)' })
  @IsOptional()
  @ValidateIf((o) => o.evaluatorId !== null)
  @IsUUID()
  evaluatorId?: string | null;

  @ApiPropertyOptional({ description: 'Tag IDs to associate with this test', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ description: 'Execution mode for conversation tests', enum: ['sequential', 'parallel'] })
  @IsOptional()
  @IsIn(['sequential', 'parallel'])
  executionMode?: 'sequential' | 'parallel';

  @ApiPropertyOptional({ description: 'Delay between turns in milliseconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  delayBetweenTurns?: number;

  @ApiPropertyOptional({ description: 'Model for simulated user (set null to clear)' })
  @IsOptional()
  @ValidateIf((o) => o.simulatedUserModel !== null)
  @IsString()
  @MinLength(1)
  simulatedUserModel?: string | null;

  @ApiPropertyOptional({ description: 'Configuration for simulated user model (set null to clear)' })
  @IsOptional()
  @ValidateIf((o) => o.simulatedUserModelConfig !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => SimulatedUserModelConfigDto)
  simulatedUserModelConfig?: SimulatedUserModelConfigDto | null;

  @ApiPropertyOptional({ description: 'Access token ID for simulated user LLM calls (set null to clear)' })
  @IsOptional()
  @ValidateIf((o) => o.simulatedUserAccessTokenId !== null)
  @IsUUID()
  simulatedUserAccessTokenId?: string | null;

  @ApiPropertyOptional({ description: 'Whether the simulated user model is a reasoning model' })
  @IsOptional()
  @IsBoolean()
  simulatedUserReasoningModel?: boolean;

  @ApiPropertyOptional({ description: 'Reasoning effort for simulated user model', enum: ['none', 'minimal', 'low', 'medium', 'high'] })
  @IsOptional()
  @IsIn(['none', 'minimal', 'low', 'medium', 'high'])
  simulatedUserReasoningEffort?: string;

  @ApiPropertyOptional({ description: 'Scenarios for conversation tests', type: [CreateScenarioDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScenarioDto)
  scenarios?: CreateScenarioDto[];
}
