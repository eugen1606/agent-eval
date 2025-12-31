import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  AccessTokensService,
  CreateAccessTokenDto,
  AccessTokenResponse,
} from './access-tokens.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('access-tokens')
@UseGuards(JwtAuthGuard)
export class AccessTokensController {
  constructor(private readonly accessTokensService: AccessTokensService) {}

  @Post()
  async create(
    @Body() dto: CreateAccessTokenDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<AccessTokenResponse> {
    return this.accessTokensService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<AccessTokenResponse[]> {
    return this.accessTokensService.findAll(user.userId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<AccessTokenResponse> {
    return this.accessTokensService.findOne(id, user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateAccessTokenDto>,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<AccessTokenResponse> {
    return this.accessTokensService.update(id, dto, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.accessTokensService.delete(id, user.userId);
  }
}
