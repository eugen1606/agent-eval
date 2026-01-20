import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class CreateAccessTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.NAME)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.TOKEN)
  token: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.DESCRIPTION)
  description?: string;
}
