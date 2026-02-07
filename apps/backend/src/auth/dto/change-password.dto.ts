import { IsString, MinLength, MaxLength, IsStrongPassword } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  STRONG_PASSWORD_OPTIONS,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '../password.constants';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password for verification' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.PASSWORD)
  currentPassword: string;

  @ApiProperty({ description: 'New password (must meet strength requirements)' })
  @IsString()
  @MaxLength(MAX_LENGTHS.PASSWORD)
  @IsStrongPassword(STRONG_PASSWORD_OPTIONS, {
    message: PASSWORD_REQUIREMENTS_MESSAGE,
  })
  newPassword: string;

  @ApiProperty({ description: 'Must match newPassword' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_LENGTHS.PASSWORD)
  confirmPassword: string;
}
