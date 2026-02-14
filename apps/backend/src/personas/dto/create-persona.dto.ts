import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class CreatePersonaDto {
  @ApiProperty({ description: 'Persona name', example: 'Confused Customer' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name: string;

  @ApiPropertyOptional({ description: 'Persona description' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.DESCRIPTION)
  description?: string;

  @ApiProperty({ description: 'System prompt defining the persona behavior' })
  @IsString()
  @MinLength(1)
  systemPrompt: string;
}
