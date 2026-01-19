import { IsString, MinLength, IsStrongPassword } from 'class-validator';
import {
  STRONG_PASSWORD_OPTIONS,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '../password.constants';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @IsStrongPassword(STRONG_PASSWORD_OPTIONS, {
    message: PASSWORD_REQUIREMENTS_MESSAGE,
  })
  newPassword: string;

  @IsString()
  @MinLength(1) // Just ensure it's not empty; validation against newPassword done in service
  confirmPassword: string;
}
