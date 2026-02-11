import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessToken, Test } from '../database/entities';
import { EncryptionService } from '../config/encryption.service';
import { CreateAccessTokenDto, UpdateAccessTokenDto } from './dto';

export interface EntityUsage {
  tests: { id: string; name: string }[];
}

export interface AccessTokenResponse {
  id: string;
  name: string;
  description?: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  // Token is never exposed
}

export type AccessTokensSortField = 'name' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface AccessTokensFilterDto {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  sortBy?: AccessTokensSortField;
  sortDirection?: SortDirection;
}

export interface PaginatedAccessTokens {
  data: AccessTokenResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class AccessTokensService {
  constructor(
    @InjectRepository(AccessToken)
    private accessTokenRepository: Repository<AccessToken>,
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    private encryptionService: EncryptionService
  ) {}

  async create(dto: CreateAccessTokenDto, userId: string): Promise<AccessTokenResponse> {
    const { encryptedToken, iv } = this.encryptionService.encryptToken(dto.token);

    const accessToken = this.accessTokenRepository.create({
      name: dto.name,
      encryptedToken,
      iv,
      description: dto.description,
      type: dto.type || 'ai_studio',
      userId,
    });

    const saved = await this.accessTokenRepository.save(accessToken);
    return this.toResponse(saved);
  }

  async findAll(
    userId: string,
    filters: AccessTokensFilterDto = {},
  ): Promise<PaginatedAccessTokens> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.accessTokenRepository
      .createQueryBuilder('accessToken')
      .where('accessToken.userId = :userId', { userId });

    // Apply type filter
    if (filters.type) {
      queryBuilder.andWhere('accessToken.type = :type', { type: filters.type });
    }

    // Apply search filter
    if (filters.search) {
      queryBuilder.andWhere(
        '(accessToken.name ILIKE :search OR accessToken.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Apply sorting
    const sortField = filters.sortBy || 'createdAt';
    const sortDirection =
      (filters.sortDirection?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';
    queryBuilder.orderBy(`accessToken.${sortField}`, sortDirection);

    // Apply pagination
    const tokens = await queryBuilder.skip(skip).take(limit).getMany();

    return {
      data: tokens.map((t) => this.toResponse(t)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string): Promise<AccessTokenResponse> {
    const token = await this.accessTokenRepository.findOne({
      where: { id, userId },
    });
    if (!token) {
      throw new NotFoundException(`Access token not found: ${id}`);
    }
    return this.toResponse(token);
  }

  async update(
    id: string,
    dto: UpdateAccessTokenDto,
    userId: string
  ): Promise<AccessTokenResponse> {
    const token = await this.accessTokenRepository.findOne({
      where: { id, userId },
    });
    if (!token) {
      throw new NotFoundException(`Access token not found: ${id}`);
    }

    if (dto.token) {
      const { encryptedToken, iv } = this.encryptionService.encryptToken(dto.token);
      token.encryptedToken = encryptedToken;
      token.iv = iv;
    }

    if (dto.name) token.name = dto.name;
    if (dto.description !== undefined) token.description = dto.description;
    if (dto.type) token.type = dto.type;

    const saved = await this.accessTokenRepository.save(token);
    return this.toResponse(saved);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.accessTokenRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Access token not found: ${id}`);
    }
  }

  async getUsage(id: string, userId: string): Promise<EntityUsage> {
    // Verify token exists and belongs to user
    await this.findOne(id, userId);

    // Find tests that use this access token
    const tests = await this.testRepository.find({
      where: { accessTokenId: id, userId },
      select: ['id', 'name'],
    });

    return {
      tests: tests.map((t) => ({ id: t.id, name: t.name })),
    };
  }

  // Internal method to get decrypted token for use in flow execution
  // Note: This validates ownership by userId
  async getDecryptedToken(id: string, userId: string): Promise<string> {
    const token = await this.accessTokenRepository.findOne({
      where: { id, userId },
    });
    if (!token) {
      throw new NotFoundException(`Access token not found: ${id}`);
    }
    return this.encryptionService.decryptToken(token.encryptedToken, token.iv);
  }

  private toResponse(token: AccessToken): AccessTokenResponse {
    return {
      id: token.id,
      name: token.name,
      description: token.description,
      type: token.type || 'ai_studio',
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    };
  }
}
