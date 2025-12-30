import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessToken } from '../database/entities';
import { EncryptionService } from '../config/encryption.service';

export interface CreateAccessTokenDto {
  name: string;
  token: string;
  basePath?: string;
  description?: string;
}

export interface AccessTokenResponse {
  id: string;
  name: string;
  basePath?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  // Token is never exposed
}

@Injectable()
export class AccessTokensService {
  constructor(
    @InjectRepository(AccessToken)
    private accessTokenRepository: Repository<AccessToken>,
    private encryptionService: EncryptionService
  ) {}

  async create(dto: CreateAccessTokenDto): Promise<AccessTokenResponse> {
    const { encryptedToken, iv } = this.encryptionService.encryptToken(dto.token);

    const accessToken = this.accessTokenRepository.create({
      name: dto.name,
      encryptedToken,
      iv,
      basePath: dto.basePath,
      description: dto.description,
    });

    const saved = await this.accessTokenRepository.save(accessToken);
    return this.toResponse(saved);
  }

  async findAll(): Promise<AccessTokenResponse[]> {
    const tokens = await this.accessTokenRepository.find({
      order: { createdAt: 'DESC' },
    });
    return tokens.map((t) => this.toResponse(t));
  }

  async findOne(id: string): Promise<AccessTokenResponse> {
    const token = await this.accessTokenRepository.findOne({ where: { id } });
    if (!token) {
      throw new NotFoundException(`Access token not found: ${id}`);
    }
    return this.toResponse(token);
  }

  async update(
    id: string,
    dto: Partial<CreateAccessTokenDto>
  ): Promise<AccessTokenResponse> {
    const token = await this.accessTokenRepository.findOne({ where: { id } });
    if (!token) {
      throw new NotFoundException(`Access token not found: ${id}`);
    }

    if (dto.token) {
      const { encryptedToken, iv } = this.encryptionService.encryptToken(dto.token);
      token.encryptedToken = encryptedToken;
      token.iv = iv;
    }

    if (dto.name) token.name = dto.name;
    if (dto.basePath !== undefined) token.basePath = dto.basePath;
    if (dto.description !== undefined) token.description = dto.description;

    const saved = await this.accessTokenRepository.save(token);
    return this.toResponse(saved);
  }

  async delete(id: string): Promise<void> {
    const result = await this.accessTokenRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Access token not found: ${id}`);
    }
  }

  // Internal method to get decrypted token for use in flow execution
  async getDecryptedToken(id: string): Promise<string> {
    const token = await this.accessTokenRepository.findOne({ where: { id } });
    if (!token) {
      throw new NotFoundException(`Access token not found: ${id}`);
    }
    return this.encryptionService.decryptToken(token.encryptedToken, token.iv);
  }

  private toResponse(token: AccessToken): AccessTokenResponse {
    return {
      id: token.id,
      name: token.name,
      basePath: token.basePath,
      description: token.description,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    };
  }
}
