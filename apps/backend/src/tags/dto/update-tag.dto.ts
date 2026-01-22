import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.COLOR)
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color code (e.g., #FF5733)',
  })
  color?: string;
}
