import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class LoginDto {
  @IsEmail()
  @MaxLength(MAX_LENGTHS.EMAIL)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.PASSWORD)
  password: string;
}
