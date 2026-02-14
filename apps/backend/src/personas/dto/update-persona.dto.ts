import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class UpdatePersonaDto {
  @ApiPropertyOptional({ description: 'Persona name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name?: string;

  @ApiPropertyOptional({ description: 'Persona description (set null to clear)' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.DESCRIPTION)
  description?: string | null;

  @ApiPropertyOptional({ description: 'System prompt defining the persona behavior' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  systemPrompt?: string;
}
