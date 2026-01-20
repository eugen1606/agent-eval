import { IsString, MinLength, MaxLength, IsStrongPassword } from 'class-validator';
import {
  STRONG_PASSWORD_OPTIONS,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '../password.constants';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.PASSWORD)
  currentPassword: string;

  @IsString()
  @MaxLength(MAX_LENGTHS.PASSWORD)
  @IsStrongPassword(STRONG_PASSWORD_OPTIONS, {
    message: PASSWORD_REQUIREMENTS_MESSAGE,
  })
  newPassword: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.PASSWORD)
  confirmPassword: string;
}
