import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import * as crypto from 'crypto';
import { AuthService, AuthTokens } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { CurrentUser, JwtPayload } from './decorators/current-user.decorator';
import {
  COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} from './auth.constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Helper method to set authentication cookies
   */
  private setAuthCookies(res: Response, tokens: AuthTokens): string {
    // Generate CSRF token
    const csrfToken = crypto.randomBytes(32).toString('hex');

    // Set access token cookie (httpOnly)
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    // Set refresh token cookie (httpOnly)
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    // Set CSRF token cookie (NOT httpOnly - must be readable by JavaScript)
    res.cookie(CSRF_TOKEN_COOKIE, csrfToken, {
      ...COOKIE_OPTIONS,
      httpOnly: false, // Override - must be readable by JavaScript
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    return csrfToken;
  }

  /**
   * Helper method to clear authentication cookies
   */
  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(CSRF_TOKEN_COOKIE, { path: '/' });
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(registerDto);
    const csrfToken = this.setAuthCookies(res, result.tokens);
    return {
      user: result.user,
      csrfToken, // Return CSRF token in body for initial setup
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(user.userId, user.email);
    const csrfToken = this.setAuthCookies(res, result.tokens);
    return {
      user: result.user,
      csrfToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ) {
    // Support both cookie-based and body-based refresh for backward compatibility
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] || bodyRefreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const tokens = await this.authService.refreshTokens(refreshToken);
    const csrfToken = this.setAuthCookies(res, tokens);
    return { csrfToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.userId);
  }

  @Get('account/stats')
  @UseGuards(JwtAuthGuard)
  async getAccountStats(@CurrentUser() user: JwtPayload) {
    return this.authService.getAccountStats(user.userId);
  }

  @Post('account/change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.changePassword(user.userId, dto);
    // Clear cookies to force re-login after password change
    this.clearAuthCookies(res);
    return { message: 'Password changed successfully. Please login again.' };
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  async deleteAccount(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.deleteAccount(user.userId);
    this.clearAuthCookies(res);
    return { message: 'Account deleted successfully' };
  }
}
