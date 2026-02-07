import { IsEmail, IsOptional, IsString, IsStrongPassword, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  STRONG_PASSWORD_OPTIONS,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '../password.constants';
import { MAX_LENGTHS } from '../../common/validation.constants';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(MAX_LENGTHS.EMAIL)
  email: string;

  @ApiProperty({ example: 'StrongP@ss1', description: 'Must contain uppercase, lowercase, number, and special character' })
  @IsString()
  @MaxLength(MAX_LENGTHS.PASSWORD)
  @IsStrongPassword(STRONG_PASSWORD_OPTIONS, {
    message: PASSWORD_REQUIREMENTS_MESSAGE,
  })
  password: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LENGTHS.NAME)
  displayName?: string;
}
