import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag, Test } from '../database/entities';
import { CreateTagDto, UpdateTagDto } from './dto';

export type TagsSortField = 'name' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface TagsFilterDto {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: TagsSortField;
  sortDirection?: SortDirection;
}

export interface PaginatedTags {
  data: Tag[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TagUsage {
  tests: { id: string; name: string }[];
}

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
  ) {}

  async create(dto: CreateTagDto, userId: string): Promise<Tag> {
    // Check for duplicate name
    const existing = await this.tagRepository.findOne({
      where: { name: dto.name, userId },
    });
    if (existing) {
      throw new ConflictException(`Tag with name "${dto.name}" already exists`);
    }

    const tag = this.tagRepository.create({
      name: dto.name,
      color: dto.color,
      userId,
    });
    return this.tagRepository.save(tag);
  }

  async findAll(
    userId: string,
    filters: TagsFilterDto = {},
  ): Promise<PaginatedTags> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 100; // Default higher for tags
    const skip = (page - 1) * limit;

    const queryBuilder = this.tagRepository
      .createQueryBuilder('tag')
      .where('tag.userId = :userId', { userId });

    // Apply search filter
    if (filters.search) {
      queryBuilder.andWhere('tag.name ILIKE :search', {
        search: `%${filters.search}%`,
      });
    }

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Apply sorting
    const sortField = filters.sortBy || 'name';
    const sortDirection =
      (filters.sortDirection?.toUpperCase() as 'ASC' | 'DESC') || 'ASC';
    queryBuilder.orderBy(`tag.${sortField}`, sortDirection);

    // Apply pagination
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

  async findOne(id: string, userId: string): Promise<Tag> {
    const tag = await this.tagRepository.findOne({
      where: { id, userId },
    });
    if (!tag) {
      throw new NotFoundException(`Tag not found: ${id}`);
    }
    return tag;
  }

  async findByIds(ids: string[], userId: string): Promise<Tag[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.tagRepository
      .createQueryBuilder('tag')
      .where('tag.id IN (:...ids)', { ids })
      .andWhere('tag.userId = :userId', { userId })
      .getMany();
  }

  async update(id: string, dto: UpdateTagDto, userId: string): Promise<Tag> {
    const tag = await this.findOne(id, userId);

    // Check for duplicate name if name is being updated
    if (dto.name && dto.name !== tag.name) {
      const existing = await this.tagRepository.findOne({
        where: { name: dto.name, userId },
      });
      if (existing) {
        throw new ConflictException(
          `Tag with name "${dto.name}" already exists`,
        );
      }
    }

    if (dto.name !== undefined) tag.name = dto.name;
    if (dto.color !== undefined) tag.color = dto.color;

    return this.tagRepository.save(tag);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.tagRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Tag not found: ${id}`);
    }
  }

  async getUsage(id: string, userId: string): Promise<TagUsage> {
    // Verify tag exists and belongs to user
    await this.findOne(id, userId);

    // Find tests that use this tag
    const tests = await this.testRepository
      .createQueryBuilder('test')
      .innerJoin('test.tags', 'tag')
      .where('tag.id = :tagId', { tagId: id })
      .andWhere('test.userId = :userId', { userId })
      .select(['test.id', 'test.name'])
      .getMany();

    return {
      tests: tests.map((t) => ({ id: t.id, name: t.name })),
    };
  }
}
