import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  AccessTokensService,
  CreateAccessTokenDto,
  AccessTokenResponse,
} from './access-tokens.service';

@Controller('access-tokens')
export class AccessTokensController {
  constructor(private readonly accessTokensService: AccessTokensService) {}

  @Post()
  async create(@Body() dto: CreateAccessTokenDto): Promise<AccessTokenResponse> {
    return this.accessTokensService.create(dto);
  }

  @Get()
  async findAll(): Promise<AccessTokenResponse[]> {
    return this.accessTokensService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<AccessTokenResponse> {
    return this.accessTokensService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateAccessTokenDto>
  ): Promise<AccessTokenResponse> {
    return this.accessTokensService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.accessTokensService.delete(id);
  }
}
