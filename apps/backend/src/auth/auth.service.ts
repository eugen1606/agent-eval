import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../database/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    displayName?: string;
    createdAt: Date;
    updatedAt: Date;
  };
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  private readonly jwtRefreshSecret: string;
  private readonly jwtRefreshExpiration: string;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {
    const refreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error(
        'CRITICAL: JWT_REFRESH_SECRET environment variable is not configured. ' +
        'Application cannot start without a secure refresh token secret. ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
      );
    }
    this.jwtRefreshSecret = refreshSecret;
    this.jwtRefreshExpiration = configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, displayName } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = this.userRepository.create({
      email,
      passwordHash,
      displayName,
    });
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens,
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(userId: string, email: string): Promise<AuthResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(userId, email);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.jwtRefreshSecret,
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user.id, user.email);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const payload = { userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpiration as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async getAccountStats(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Get counts from related tables
    const runsCount = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('runs', 'r')
      .where('r."userId" = :userId', { userId })
      .getRawOne();

    const questionSetsCount = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('question_sets', 'qs')
      .where('qs."userId" = :userId', { userId })
      .getRawOne();

    const flowConfigsCount = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('flow_configs', 'fc')
      .where('fc."userId" = :userId', { userId })
      .getRawOne();

    const accessTokensCount = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('access_tokens', 'at')
      .where('at."userId" = :userId', { userId })
      .getRawOne();

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      stats: {
        runsCount: parseInt(runsCount?.count || '0', 10),
        questionSetsCount: parseInt(questionSetsCount?.count || '0', 10),
        flowConfigsCount: parseInt(flowConfigsCount?.count || '0', 10),
        accessTokensCount: parseInt(accessTokensCount?.count || '0', 10),
      },
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Verify new passwords match
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    // Hash and save new password
    const saltRounds = 10;
    user.passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);
    await this.userRepository.save(user);
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Delete user - cascading deletes will handle related data
    await this.userRepository.delete({ id: userId });
  }

  // Method to create admin user if none exists (for data migration)
  async ensureAdminUser(): Promise<User> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL') || 'admin@benchmark.local';
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD') || 'admin123';

    let adminUser = await this.userRepository.findOne({ where: { email: adminEmail } });

    if (!adminUser) {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

      adminUser = this.userRepository.create({
        email: adminEmail,
        passwordHash,
        displayName: 'Admin',
      });
      await this.userRepository.save(adminUser);
    }

    return adminUser;
  }
}
