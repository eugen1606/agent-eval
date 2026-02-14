import { IsString, IsOptional, IsUUID, IsInt, Min, Max, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class UpdateScenarioDto {
  @ApiPropertyOptional({ description: 'Persona ID (set null to clear)' })
  @IsOptional()
  @ValidateIf((o) => o.personaId !== null)
  @IsUUID()
  personaId?: string | null;

  @ApiPropertyOptional({ description: 'Scenario name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name?: string;

  @ApiPropertyOptional({ description: 'Goal for the simulated user' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  goal?: string;

  @ApiPropertyOptional({ description: 'Maximum turns before stopping' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxTurns?: number;
}
