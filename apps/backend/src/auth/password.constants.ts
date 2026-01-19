import { IsStrongPasswordOptions } from 'class-validator';

/**
 * Strong password requirements for user authentication.
 * Enforces complexity rules to prevent weak passwords.
 */
export const STRONG_PASSWORD_OPTIONS: IsStrongPasswordOptions = {
  minLength: 12,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
};

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 12 characters with uppercase, lowercase, number, and symbol';
