import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { CSRF_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE } from '../auth.constants';

/**
 * CSRF protection guard for cookie-based authentication.
 * Validates that the CSRF token in the X-CSRF-Token header matches
 * the token stored in the csrf_token cookie.
 *
 * Safe methods (GET, HEAD, OPTIONS) are exempt from CSRF checks.
 * Bearer token authentication is also exempt (CSRF protection is only
 * needed for cookie-based auth where browsers auto-attach cookies).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Skip CSRF for safe methods (read-only operations)
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(request.method)) {
      return true;
    }

    // Skip CSRF for Bearer token auth (not vulnerable to CSRF)
    // CSRF protection is only needed for cookie-based auth
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ') && !request.cookies?.[ACCESS_TOKEN_COOKIE]) {
      return true;
    }

    // Get CSRF token from cookie
    const cookieToken = request.cookies?.[CSRF_TOKEN_COOKIE];

    // Get CSRF token from header
    const headerToken = request.headers['x-csrf-token'] as string;

    // Both tokens must be present
    if (!cookieToken || !headerToken) {
      throw new ForbiddenException('CSRF token missing');
    }

    // Tokens must match (constant-time comparison for security)
    if (!this.secureCompare(cookieToken, headerToken)) {
      throw new ForbiddenException('CSRF token mismatch');
    }

    return true;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
