import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsNumber,
  Min,
  Max,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MAX_LENGTHS } from '../../common/validation.constants';
import { CreateScenarioDto } from './create-scenario.dto';

export class SimulatedUserModelConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number;
}

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

  @ApiPropertyOptional({ description: 'Number of times to repeat each question (1-50)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  repeatCount?: number;

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

  @ApiPropertyOptional({ description: 'Test type', enum: ['qa', 'conversation'], default: 'qa' })
  @IsOptional()
  @IsIn(['qa', 'conversation'])
  type?: 'qa' | 'conversation';

  @ApiPropertyOptional({ description: 'Execution mode for conversation tests', enum: ['sequential', 'parallel'] })
  @ValidateIf((o) => o.type === 'conversation')
  @IsOptional()
  @IsIn(['sequential', 'parallel'])
  executionMode?: 'sequential' | 'parallel';

  @ApiPropertyOptional({ description: 'Delay between turns in milliseconds', default: 0 })
  @ValidateIf((o) => o.type === 'conversation')
  @IsOptional()
  @IsInt()
  @Min(0)
  delayBetweenTurns?: number;

  @ApiPropertyOptional({ description: 'Model for simulated user (e.g. gpt-4o, claude-sonnet)' })
  @ValidateIf((o) => o.type === 'conversation')
  @IsOptional()
  @IsString()
  @MinLength(1)
  simulatedUserModel?: string;

  @ApiPropertyOptional({ description: 'Configuration for simulated user model' })
  @ValidateIf((o) => o.type === 'conversation')
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SimulatedUserModelConfigDto)
  simulatedUserModelConfig?: SimulatedUserModelConfigDto;

  @ApiPropertyOptional({ description: 'Access token ID for simulated user LLM calls' })
  @ValidateIf((o) => o.type === 'conversation')
  @IsOptional()
  @IsUUID()
  simulatedUserAccessTokenId?: string;

  @ApiPropertyOptional({ description: 'Whether the simulated user model is a reasoning model', default: false })
  @ValidateIf((o) => o.type === 'conversation')
  @IsOptional()
  @IsBoolean()
  simulatedUserReasoningModel?: boolean;

  @ApiPropertyOptional({ description: 'Reasoning effort for simulated user model', enum: ['none', 'minimal', 'low', 'medium', 'high'] })
  @ValidateIf((o) => o.type === 'conversation')
  @IsOptional()
  @IsIn(['none', 'minimal', 'low', 'medium', 'high'])
  simulatedUserReasoningEffort?: string;

  @ApiPropertyOptional({ description: 'Variable key to read response from result.variables (e.g. responseDraft)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  responseVariableKey?: string;

  @ApiPropertyOptional({ description: 'Scenarios for conversation tests', type: [CreateScenarioDto] })
  @ValidateIf((o) => o.type === 'conversation')
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScenarioDto)
  scenarios?: CreateScenarioDto[];
}
