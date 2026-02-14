import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Persona } from '../database/entities';
import { CreatePersonaDto, UpdatePersonaDto } from './dto';

export type PersonasSortField = 'name' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface PersonasFilterDto {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: PersonasSortField;
  sortDirection?: SortDirection;
}

export interface PaginatedPersonas {
  data: Persona[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class PersonasService {
  constructor(
    @InjectRepository(Persona)
    private personaRepository: Repository<Persona>,
  ) {}

  async create(dto: CreatePersonaDto, userId: string): Promise<Persona> {
    // Check name uniqueness for this user
    const existing = await this.personaRepository.findOne({
      where: { userId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Persona with name "${dto.name}" already exists`);
    }

    const persona = this.personaRepository.create({
      ...dto,
      userId,
      isTemplate: false,
    });
    return this.personaRepository.save(persona);
  }

  async findAll(
    userId: string,
    filters: PersonasFilterDto = {},
  ): Promise<PaginatedPersonas> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const queryBuilder = this.personaRepository
      .createQueryBuilder('persona')
      .where('(persona.userId = :userId OR persona.isTemplate = true)', {
        userId,
      });

    if (filters.search) {
      queryBuilder.andWhere(
        '(persona.name ILIKE :search OR persona.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const total = await queryBuilder.getCount();

    const sortField = filters.sortBy || 'createdAt';
    const sortDirection =
      (filters.sortDirection?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';

    // Templates first, then sort by chosen field
    queryBuilder
      .orderBy('persona.isTemplate', 'DESC')
      .addOrderBy(`persona.${sortField}`, sortDirection);

    const data = await queryBuilder.skip(skip).take(limit).getMany();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string): Promise<Persona> {
    const persona = await this.personaRepository.findOne({
      where: [
        { id, userId },
        { id, isTemplate: true },
      ],
    });
    if (!persona) {
      throw new NotFoundException(`Persona not found: ${id}`);
    }
    return persona;
  }

  async update(
    id: string,
    dto: UpdatePersonaDto,
    userId: string,
  ): Promise<Persona> {
    const persona = await this.personaRepository.findOne({
      where: [
        { id, userId },
        { id, isTemplate: true },
      ],
    });
    if (!persona) {
      throw new NotFoundException(`Persona not found: ${id}`);
    }

    // Check name uniqueness if name is being changed
    if (dto.name && dto.name !== persona.name) {
      if (persona.isTemplate) {
        // For templates, check uniqueness among templates
        const existing = await this.personaRepository.findOne({
          where: { name: dto.name, isTemplate: true },
        });
        if (existing) {
          throw new ConflictException(
            `Persona with name "${dto.name}" already exists`,
          );
        }
      } else {
        const existing = await this.personaRepository.findOne({
          where: { userId, name: dto.name },
        });
        if (existing) {
          throw new ConflictException(
            `Persona with name "${dto.name}" already exists`,
          );
        }
      }
    }

    Object.assign(persona, dto);
    return this.personaRepository.save(persona);
  }

  async delete(id: string, userId: string): Promise<void> {
    const persona = await this.personaRepository.findOne({
      where: [
        { id, userId },
        { id, isTemplate: true },
      ],
    });
    if (!persona) {
      throw new NotFoundException(`Persona not found: ${id}`);
    }

    await this.personaRepository.delete({ id });
  }

  async clone(id: string, userId: string): Promise<Persona> {
    const source = await this.findOne(id, userId);

    // Generate a unique name
    let cloneName = `${source.name} (Copy)`;
    let counter = 2;
    while (
      await this.personaRepository.findOne({
        where: { userId, name: cloneName },
      })
    ) {
      cloneName = `${source.name} (Copy ${counter})`;
      counter++;
    }

    const cloned = this.personaRepository.create({
      name: cloneName,
      description: source.description,
      systemPrompt: source.systemPrompt,
      userId,
      isTemplate: false,
    });
    return this.personaRepository.save(cloned);
  }
}
