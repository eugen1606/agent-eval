import { IsString, IsOptional, IsUUID, IsInt, Min, Max, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class CreateScenarioDto {
  @ApiProperty({ description: 'Persona ID for this scenario' })
  @IsUUID()
  personaId: string;

  @ApiProperty({ description: 'Scenario name', example: 'TV not working - confused user' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name: string;

  @ApiProperty({ description: 'Goal for the simulated user to achieve' })
  @IsString()
  @MinLength(1)
  goal: string;

  @ApiPropertyOptional({ description: 'Maximum turns before stopping', default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxTurns?: number;
}
