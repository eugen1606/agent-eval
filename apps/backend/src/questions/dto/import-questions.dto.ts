import { IsString, IsOptional, IsArray, MaxLength, MinLength } from 'class-validator';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class ImportQuestionsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.DESCRIPTION)
  description?: string;

  @IsArray()
  questions: unknown[];
}
