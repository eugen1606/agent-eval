import { IsEmail, IsOptional, IsString, IsStrongPassword } from 'class-validator';
import {
  STRONG_PASSWORD_OPTIONS,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '../password.constants';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsStrongPassword(STRONG_PASSWORD_OPTIONS, {
    message: PASSWORD_REQUIREMENTS_MESSAGE,
  })
  password: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}
