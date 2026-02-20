import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  ValidateNested,
  MaxLength,
  MinLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class QuestionItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.QUESTION)
  question: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.ANSWER)
  expectedAnswer?: string;

  @IsOptional()
  @IsObject()
  inputVariables?: Record<string, unknown>;
}

export class CreateQuestionSetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionItemDto)
  questions: QuestionItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.DESCRIPTION)
  description?: string;
}
