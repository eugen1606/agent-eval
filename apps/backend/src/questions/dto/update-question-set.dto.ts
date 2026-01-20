import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  MinLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_LENGTHS } from '../../common/validation.constants';
import { QuestionItemDto } from './create-question-set.dto';

export class UpdateQuestionSetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionItemDto)
  questions?: QuestionItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.DESCRIPTION)
  description?: string;
}
