import { IsEmail, IsOptional, IsString, IsStrongPassword, MaxLength } from 'class-validator';
import {
  STRONG_PASSWORD_OPTIONS,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '../password.constants';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class RegisterDto {
  @IsEmail()
  @MaxLength(MAX_LENGTHS.EMAIL)
  email: string;

  @IsString()
  @MaxLength(MAX_LENGTHS.PASSWORD)
  @IsStrongPassword(STRONG_PASSWORD_OPTIONS, {
    message: PASSWORD_REQUIREMENTS_MESSAGE,
  })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.NAME)
  displayName?: string;
}
