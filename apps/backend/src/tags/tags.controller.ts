import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  TagsService,
  PaginatedTags,
  TagsSortField,
  SortDirection,
  TagUsage,
} from './tags.service';
import { CreateTagDto, UpdateTagDto } from './dto';
import { Tag } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('tags')
@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  async create(
    @Body() dto: CreateTagDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Tag> {
    return this.tagsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { userId: string; email: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: TagsSortField,
    @Query('sortDirection') sortDirection?: SortDirection,
  ): Promise<PaginatedTags> {
    return this.tagsService.findAll(user.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      sortBy,
      sortDirection,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Tag> {
    return this.tagsService.findOne(id, user.userId);
  }

  @Get(':id/usage')
  async getUsage(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<TagUsage> {
    return this.tagsService.getUsage(id, user.userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Tag> {
    return this.tagsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.tagsService.delete(id, user.userId);
  }
}
