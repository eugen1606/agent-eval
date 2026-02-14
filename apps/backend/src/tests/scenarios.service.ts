import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scenario, Test, Persona } from '../database/entities';
import { CreateScenarioDto, UpdateScenarioDto } from './dto';

@Injectable()
export class ScenariosService {
  constructor(
    @InjectRepository(Scenario)
    private scenarioRepository: Repository<Scenario>,
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    @InjectRepository(Persona)
    private personaRepository: Repository<Persona>,
  ) {}

  async findAll(testId: string, userId: string): Promise<Scenario[]> {
    await this.validateTestOwnership(testId, userId);

    return this.scenarioRepository.find({
      where: { testId },
      relations: ['persona'],
      order: { orderIndex: 'ASC' },
    });
  }

  async create(
    testId: string,
    dto: CreateScenarioDto,
    userId: string,
  ): Promise<Scenario> {
    const test = await this.validateTestOwnership(testId, userId);

    if (test.type !== 'conversation') {
      throw new BadRequestException(
        'Scenarios can only be added to conversation-type tests',
      );
    }

    // Validate persona exists and is accessible
    await this.validatePersonaAccess(dto.personaId, userId);

    // Get the next orderIndex
    const maxOrder = await this.scenarioRepository
      .createQueryBuilder('scenario')
      .select('MAX(scenario.orderIndex)', 'max')
      .where('scenario.testId = :testId', { testId })
      .getRawOne();

    const orderIndex = (maxOrder?.max ?? -1) + 1;

    const scenario = this.scenarioRepository.create({
      testId,
      personaId: dto.personaId,
      name: dto.name,
      goal: dto.goal,
      maxTurns: dto.maxTurns ?? 30,
      orderIndex,
    });

    const saved = await this.scenarioRepository.save(scenario);
    return this.scenarioRepository.findOne({
      where: { id: saved.id },
      relations: ['persona'],
    });
  }

  async update(
    testId: string,
    scenarioId: string,
    dto: UpdateScenarioDto,
    userId: string,
  ): Promise<Scenario> {
    await this.validateTestOwnership(testId, userId);

    const scenario = await this.scenarioRepository.findOne({
      where: { id: scenarioId, testId },
    });
    if (!scenario) {
      throw new NotFoundException(`Scenario not found: ${scenarioId}`);
    }

    // Validate persona if being changed
    if (dto.personaId !== undefined && dto.personaId !== null) {
      await this.validatePersonaAccess(dto.personaId, userId);
    }

    if (dto.personaId !== undefined) {
      scenario.personaId = dto.personaId;
    }
    if (dto.name !== undefined) scenario.name = dto.name;
    if (dto.goal !== undefined) scenario.goal = dto.goal;
    if (dto.maxTurns !== undefined) scenario.maxTurns = dto.maxTurns;

    await this.scenarioRepository.save(scenario);
    return this.scenarioRepository.findOne({
      where: { id: scenarioId },
      relations: ['persona'],
    });
  }

  async delete(
    testId: string,
    scenarioId: string,
    userId: string,
  ): Promise<void> {
    await this.validateTestOwnership(testId, userId);

    const result = await this.scenarioRepository.delete({
      id: scenarioId,
      testId,
    });
    if (result.affected === 0) {
      throw new NotFoundException(`Scenario not found: ${scenarioId}`);
    }
  }

  async reorder(
    testId: string,
    scenarioIds: string[],
    userId: string,
  ): Promise<void> {
    await this.validateTestOwnership(testId, userId);

    // Validate all scenario IDs belong to this test
    const scenarios = await this.scenarioRepository.find({
      where: { testId },
    });
    const existingIds = new Set(scenarios.map((s) => s.id));

    for (const id of scenarioIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException(
          `Scenario ${id} does not belong to test ${testId}`,
        );
      }
    }

    // Update orderIndex for each scenario
    const updates = scenarioIds.map((id, index) =>
      this.scenarioRepository.update({ id, testId }, { orderIndex: index }),
    );
    await Promise.all(updates);
  }

  private async validateTestOwnership(
    testId: string,
    userId: string,
  ): Promise<Test> {
    const test = await this.testRepository.findOne({
      where: { id: testId, userId },
    });
    if (!test) {
      throw new NotFoundException(`Test not found: ${testId}`);
    }
    return test;
  }

  private async validatePersonaAccess(
    personaId: string,
    userId: string,
  ): Promise<void> {
    const persona = await this.personaRepository.findOne({
      where: [
        { id: personaId, userId },
        { id: personaId, isTemplate: true },
      ],
    });
    if (!persona) {
      throw new NotFoundException(`Persona not found: ${personaId}`);
    }
  }
}
