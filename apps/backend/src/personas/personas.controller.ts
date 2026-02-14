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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PersonasService, PaginatedPersonas } from './personas.service';
import { CreatePersonaDto, UpdatePersonaDto } from './dto';
import { Persona } from '../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('personas')
@Controller('personas')
@UseGuards(JwtAuthGuard)
export class PersonasController {
  constructor(private readonly personasService: PersonasService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new persona' })
  @ApiResponse({ status: 201, description: 'Persona created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Name already exists' })
  async create(
    @Body() dto: CreatePersonaDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Persona> {
    return this.personasService.create(dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all personas (user + templates)' })
  @ApiResponse({ status: 200, description: 'Paginated list of personas' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDirection') sortDirection?: string,
    @CurrentUser() user?: { userId: string; email: string },
  ): Promise<PaginatedPersonas> {
    return this.personasService.findAll(user!.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      sortBy: sortBy as 'name' | 'createdAt' | 'updatedAt' | undefined,
      sortDirection: sortDirection as 'asc' | 'desc' | undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a persona by ID' })
  @ApiResponse({ status: 200, description: 'Persona found' })
  @ApiResponse({ status: 404, description: 'Persona not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Persona> {
    return this.personasService.findOne(id, user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a persona' })
  @ApiResponse({ status: 200, description: 'Persona updated' })
  @ApiResponse({ status: 404, description: 'Persona not found' })
  @ApiResponse({ status: 403, description: 'Cannot edit template personas' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePersonaDto,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Persona> {
    return this.personasService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a persona' })
  @ApiResponse({ status: 200, description: 'Persona deleted' })
  @ApiResponse({ status: 404, description: 'Persona not found' })
  @ApiResponse({ status: 403, description: 'Cannot delete template personas' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<void> {
    return this.personasService.delete(id, user.userId);
  }

  @Post(':id/clone')
  @ApiOperation({ summary: 'Clone a persona (including templates)' })
  @ApiResponse({ status: 201, description: 'Persona cloned successfully' })
  @ApiResponse({ status: 404, description: 'Source persona not found' })
  async clone(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ): Promise<Persona> {
    return this.personasService.clone(id, user.userId);
  }
}
