import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  Test,
  QuestionSet,
  FlowConfig,
  Tag,
  Webhook,
  Run,
  Persona,
  Conversation,
} from '../database/entities';
import {
  ExportBundle,
  ExportEntityType,
  ExportedTest,
  ExportedQuestionSet,
  ExportedFlowConfig,
  ExportedTag,
  ExportedWebhook,
  ExportedRun,
  ExportedPersona,
  ImportPreviewResult,
  ImportResult,
  ConflictStrategy,
} from '@agent-eval/shared';
import { ExportQueryDto, ImportBundleDto } from './dto';

const EXPORT_VERSION = '1.0.0';

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    @InjectRepository(QuestionSet)
    private questionSetRepository: Repository<QuestionSet>,
    @InjectRepository(FlowConfig)
    private flowConfigRepository: Repository<FlowConfig>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    @InjectRepository(Persona)
    private personaRepository: Repository<Persona>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
  ) {}

  async export(query: ExportQueryDto, userId: string): Promise<ExportBundle> {
    const bundle: ExportBundle = {
      metadata: {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
      },
    };

    // Maps to track original ID to export ID
    const idMaps = {
      tests: new Map<string, string>(),
      questionSets: new Map<string, string>(),
      flowConfigs: new Map<string, string>(),
      tags: new Map<string, string>(),
      webhooks: new Map<string, string>(),
      personas: new Map<string, string>(),
    };

    // Export in dependency order: flowConfigs, questionSets, tags, webhooks, personas, tests

    if (query.types.includes('personas')) {
      const personas = await this.exportPersonas(
        userId,
        query.personaIds,
        idMaps.personas,
      );
      if (personas.length > 0) {
        bundle.personas = personas;
      }
    }

    if (query.types.includes('flowConfigs')) {
      const flowConfigs = await this.exportFlowConfigs(
        userId,
        query.flowConfigIds,
        idMaps.flowConfigs,
      );
      if (flowConfigs.length > 0) {
        bundle.flowConfigs = flowConfigs;
      }
    }

    if (query.types.includes('questionSets')) {
      const questionSets = await this.exportQuestionSets(
        userId,
        query.questionSetIds,
        idMaps.questionSets,
      );
      if (questionSets.length > 0) {
        bundle.questionSets = questionSets;
      }
    }

    if (query.types.includes('tags')) {
      const tags = await this.exportTags(userId, query.tagIds, idMaps.tags);
      if (tags.length > 0) {
        bundle.tags = tags;
      }
    }

    if (query.types.includes('webhooks')) {
      const webhooks = await this.exportWebhooks(
        userId,
        query.webhookIds,
        idMaps.webhooks,
      );
      if (webhooks.length > 0) {
        bundle.webhooks = webhooks;
      }
    }

    if (query.types.includes('tests')) {
      // Auto-export personas referenced by conversation tests if not already exported
      const tests = await this.exportTests(userId, query.testIds, idMaps);
      if (tests.length > 0) {
        bundle.tests = tests;
      }
      // If we exported personas referenced by scenarios, include them in bundle
      if (!bundle.personas && idMaps.personas.size > 0) {
        // Personas were already exported above or auto-collected via test export
      }
    }

    if (query.types.includes('runs')) {
      const runs = await this.exportRuns(userId, query.runIds, idMaps.tests);
      if (runs.length > 0) {
        bundle.runs = runs;
      }
    }

    return bundle;
  }

  private async exportFlowConfigs(
    userId: string,
    ids: string[] | undefined,
    idMap: Map<string, string>,
  ): Promise<ExportedFlowConfig[]> {
    const whereClause: Record<string, unknown> = { userId };
    if (ids && ids.length > 0) {
      whereClause['id'] = In(ids);
    }

    const flowConfigs = await this.flowConfigRepository.find({
      where: whereClause,
    });

    return flowConfigs.map((fc) => {
      const exportId = uuidv4();
      idMap.set(fc.id, exportId);
      return {
        exportId,
        name: fc.name,
        description: fc.description ?? undefined,
        flowId: fc.flowId,
        basePath: fc.basePath,
      };
    });
  }

  private async exportQuestionSets(
    userId: string,
    ids: string[] | undefined,
    idMap: Map<string, string>,
  ): Promise<ExportedQuestionSet[]> {
    const whereClause: Record<string, unknown> = { userId };
    if (ids && ids.length > 0) {
      whereClause['id'] = In(ids);
    }

    const questionSets = await this.questionSetRepository.find({
      where: whereClause,
    });

    return questionSets.map((qs) => {
      const exportId = uuidv4();
      idMap.set(qs.id, exportId);
      return {
        exportId,
        name: qs.name,
        description: qs.description ?? undefined,
        questions: qs.questions,
      };
    });
  }

  private async exportTags(
    userId: string,
    ids: string[] | undefined,
    idMap: Map<string, string>,
  ): Promise<ExportedTag[]> {
    const whereClause: Record<string, unknown> = { userId };
    if (ids && ids.length > 0) {
      whereClause['id'] = In(ids);
    }

    const tags = await this.tagRepository.find({ where: whereClause });

    return tags.map((tag) => {
      const exportId = uuidv4();
      idMap.set(tag.id, exportId);
      return {
        exportId,
        name: tag.name,
        color: tag.color ?? undefined,
      };
    });
  }

  private async exportWebhooks(
    userId: string,
    ids: string[] | undefined,
    idMap: Map<string, string>,
  ): Promise<ExportedWebhook[]> {
    const whereClause: Record<string, unknown> = { userId };
    if (ids && ids.length > 0) {
      whereClause['id'] = In(ids);
    }

    const webhooks = await this.webhookRepository.find({ where: whereClause });

    return webhooks.map((wh) => {
      const exportId = uuidv4();
      idMap.set(wh.id, exportId);
      return {
        exportId,
        name: wh.name,
        url: wh.url,
        description: wh.description ?? undefined,
        events: wh.events,
        enabled: wh.enabled,
        method: wh.method,
        headers: wh.headers ?? undefined,
        queryParams: wh.queryParams ?? undefined,
        bodyTemplate: wh.bodyTemplate ?? undefined,
      };
    });
  }

  private async exportPersonas(
    userId: string,
    ids: string[] | undefined,
    idMap: Map<string, string>,
  ): Promise<ExportedPersona[]> {
    const whereClause: Record<string, unknown> = { userId };
    if (ids && ids.length > 0) {
      whereClause['id'] = In(ids);
    }

    const personas = await this.personaRepository.find({
      where: whereClause,
    });

    return personas.map((p) => {
      const exportId = uuidv4();
      idMap.set(p.id, exportId);
      return {
        exportId,
        name: p.name,
        description: p.description ?? undefined,
        systemPrompt: p.systemPrompt,
      };
    });
  }

  private async exportTests(
    userId: string,
    ids: string[] | undefined,
    idMaps: {
      tests: Map<string, string>;
      questionSets: Map<string, string>;
      flowConfigs: Map<string, string>;
      tags: Map<string, string>;
      webhooks: Map<string, string>;
      personas: Map<string, string>;
    },
  ): Promise<ExportedTest[]> {
    const queryBuilder = this.testRepository
      .createQueryBuilder('test')
      .leftJoinAndSelect('test.tags', 'tags')
      .leftJoinAndSelect('test.scenarios', 'scenarios')
      .leftJoinAndSelect('scenarios.persona', 'persona')
      .where('test.userId = :userId', { userId });

    if (ids && ids.length > 0) {
      queryBuilder.andWhere('test.id IN (:...ids)', { ids });
    }

    const tests = await queryBuilder.getMany();

    return tests.map((test) => {
      const exportId = uuidv4();
      idMaps.tests.set(test.id, exportId);

      const exported: ExportedTest = {
        exportId,
        name: test.name,
        description: test.description ?? undefined,
        multiStepEvaluation: test.multiStepEvaluation,
      };

      // Include conversation test fields
      if (test.type && test.type !== 'qa') {
        exported.type = test.type as 'qa' | 'conversation';
        exported.executionMode = test.executionMode ?? undefined;
        exported.delayBetweenTurns = test.delayBetweenTurns ?? undefined;
        exported.simulatedUserModel = test.simulatedUserModel ?? undefined;
        exported.simulatedUserModelConfig = test.simulatedUserModelConfig ?? undefined;
        exported.simulatedUserReasoningModel = test.simulatedUserReasoningModel ?? undefined;
        exported.simulatedUserReasoningEffort = test.simulatedUserReasoningEffort ?? undefined;
      }

      // Map references to export IDs
      if (test.flowConfigId) {
        const flowConfigExportId = idMaps.flowConfigs.get(test.flowConfigId);
        if (flowConfigExportId) {
          exported.flowConfigExportId = flowConfigExportId;
        }
      }

      if (test.questionSetId) {
        const questionSetExportId = idMaps.questionSets.get(test.questionSetId);
        if (questionSetExportId) {
          exported.questionSetExportId = questionSetExportId;
        }
      }

      if (test.webhookId) {
        const webhookExportId = idMaps.webhooks.get(test.webhookId);
        if (webhookExportId) {
          exported.webhookExportId = webhookExportId;
        }
      }

      if (test.tags && test.tags.length > 0) {
        const tagExportIds = test.tags
          .map((tag) => idMaps.tags.get(tag.id))
          .filter((id): id is string => id !== undefined);
        if (tagExportIds.length > 0) {
          exported.tagExportIds = tagExportIds;
        }
      }

      // Export scenarios for conversation tests
      if (test.scenarios && test.scenarios.length > 0) {
        exported.scenarios = test.scenarios
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((scenario) => {
            const exportedScenario: ExportedTest['scenarios'][0] = {
              name: scenario.name,
              goal: scenario.goal,
              maxTurns: scenario.maxTurns,
              orderIndex: scenario.orderIndex,
            };

            // Map persona reference
            if (scenario.personaId && scenario.persona) {
              let personaExportId = idMaps.personas.get(scenario.personaId);
              if (!personaExportId) {
                // Auto-add persona to export
                personaExportId = uuidv4();
                idMaps.personas.set(scenario.personaId, personaExportId);
              }
              exportedScenario.personaExportId = personaExportId;
            }

            return exportedScenario;
          });
      }

      return exported;
    });
  }

  private async exportRuns(
    userId: string,
    ids: string[] | undefined,
    testIdMap: Map<string, string>,
  ): Promise<ExportedRun[]> {
    const queryBuilder = this.runRepository
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.test', 'test')
      .where('run.userId = :userId', { userId });

    if (ids && ids.length > 0) {
      queryBuilder.andWhere('run.id IN (:...ids)', { ids });
    }

    const runs = await queryBuilder.getMany();

    const exportedRuns: ExportedRun[] = [];
    for (const run of runs) {
      const exportId = uuidv4();

      const exported: ExportedRun = {
        exportId,
        testName: run.test?.name,
        testExportId: run.testId ? testIdMap.get(run.testId) : undefined,
        status: run.status,
        results: run.results.map((result) => ({
          question: result.question,
          answer: result.answer,
          expectedAnswer: result.expectedAnswer,
          executionTimeMs: result.executionTimeMs,
          isError: result.isError,
          errorMessage: result.errorMessage,
          humanEvaluation: result.humanEvaluation,
          humanEvaluationDescription: result.humanEvaluationDescription,
          severity: result.severity,
          llmJudgeScore: result.llmJudgeScore,
          llmJudgeReasoning: result.llmJudgeReasoning,
          timestamp: result.timestamp,
        })),
        errorMessage: run.errorMessage ?? undefined,
        totalQuestions: run.totalQuestions,
        completedQuestions: run.completedQuestions,
        isFullyEvaluated: run.isFullyEvaluated,
        startedAt: run.startedAt?.toISOString(),
        completedAt: run.completedAt?.toISOString(),
        evaluatedAt: run.evaluatedAt?.toISOString(),
        createdAt: run.createdAt.toISOString(),
      };

      // Include conversation data for conversation-type runs
      if (run.totalScenarios && run.totalScenarios > 0) {
        exported.totalScenarios = run.totalScenarios;
        exported.completedScenarios = run.completedScenarios ?? 0;

        const conversations = await this.conversationRepository.find({
          where: { runId: run.id },
          relations: ['scenario'],
          order: { startedAt: 'ASC' },
        });

        if (conversations.length > 0) {
          exported.conversations = conversations.map((conv) => ({
            scenarioName: conv.scenario?.name,
            status: conv.status,
            goalAchieved: conv.goalAchieved ?? undefined,
            totalTurns: conv.totalTurns,
            turns: conv.turns || [],
            summary: conv.summary ?? undefined,
            endReason: conv.endReason ?? undefined,
            humanEvaluation: conv.humanEvaluation ?? undefined,
            humanEvaluationNotes: conv.humanEvaluationNotes ?? undefined,
          }));
        }
      }

      exportedRuns.push(exported);
    }

    return exportedRuns;
  }

  async previewImport(
    bundle: ImportBundleDto,
    userId: string,
  ): Promise<ImportPreviewResult> {
    this.validateBundleVersion(bundle.metadata.version);

    const result: ImportPreviewResult = {
      toCreate: {
        tests: 0,
        questionSets: 0,
        flowConfigs: 0,
        tags: 0,
        webhooks: 0,
        personas: 0,
      },
      conflicts: [],
      errors: [],
    };

    // Check for conflicts by name
    if (bundle.flowConfigs) {
      for (const fc of bundle.flowConfigs) {
        const existing = await this.flowConfigRepository.findOne({
          where: { name: fc.name, userId },
        });
        if (existing) {
          result.conflicts.push({
            type: 'flowConfigs',
            exportId: fc.exportId,
            name: fc.name,
            existingId: existing.id,
          });
        } else {
          result.toCreate.flowConfigs++;
        }
      }
    }

    if (bundle.questionSets) {
      for (const qs of bundle.questionSets) {
        const existing = await this.questionSetRepository.findOne({
          where: { name: qs.name, userId },
        });
        if (existing) {
          result.conflicts.push({
            type: 'questionSets',
            exportId: qs.exportId,
            name: qs.name,
            existingId: existing.id,
          });
        } else {
          result.toCreate.questionSets++;
        }
      }
    }

    if (bundle.tags) {
      for (const tag of bundle.tags) {
        const existing = await this.tagRepository.findOne({
          where: { name: tag.name, userId },
        });
        if (existing) {
          result.conflicts.push({
            type: 'tags',
            exportId: tag.exportId,
            name: tag.name,
            existingId: existing.id,
          });
        } else {
          result.toCreate.tags++;
        }
      }
    }

    if (bundle.webhooks) {
      for (const wh of bundle.webhooks) {
        const existing = await this.webhookRepository.findOne({
          where: { name: wh.name, userId },
        });
        if (existing) {
          result.conflicts.push({
            type: 'webhooks',
            exportId: wh.exportId,
            name: wh.name,
            existingId: existing.id,
          });
        } else {
          result.toCreate.webhooks++;
        }
      }
    }

    if (bundle.personas) {
      for (const persona of bundle.personas) {
        const existing = await this.personaRepository.findOne({
          where: { name: persona.name, userId },
        });
        if (existing) {
          result.conflicts.push({
            type: 'personas',
            exportId: persona.exportId,
            name: persona.name,
            existingId: existing.id,
          });
        } else {
          result.toCreate.personas++;
        }
      }
    }

    if (bundle.tests) {
      for (const test of bundle.tests) {
        const existing = await this.testRepository.findOne({
          where: { name: test.name, userId },
        });
        if (existing) {
          result.conflicts.push({
            type: 'tests',
            exportId: test.exportId,
            name: test.name,
            existingId: existing.id,
          });
        } else {
          result.toCreate.tests++;
        }
      }

      // Validate dependencies
      this.validateTestDependencies(bundle, result.errors);
    }

    return result;
  }

  async import(
    bundle: ImportBundleDto,
    conflictStrategy: ConflictStrategy,
    userId: string,
  ): Promise<ImportResult> {
    this.validateBundleVersion(bundle.metadata.version);

    const result: ImportResult = {
      created: {
        tests: 0,
        questionSets: 0,
        flowConfigs: 0,
        tags: 0,
        webhooks: 0,
        personas: 0,
      },
      skipped: {
        tests: 0,
        questionSets: 0,
        flowConfigs: 0,
        tags: 0,
        webhooks: 0,
        personas: 0,
      },
      overwritten: {
        tests: 0,
        questionSets: 0,
        flowConfigs: 0,
        tags: 0,
        webhooks: 0,
        personas: 0,
      },
      renamed: {
        tests: 0,
        questionSets: 0,
        flowConfigs: 0,
        tags: 0,
        webhooks: 0,
        personas: 0,
      },
      errors: [],
    };

    // Maps from export ID to new database ID
    const idMaps = {
      flowConfigs: new Map<string, string>(),
      questionSets: new Map<string, string>(),
      tags: new Map<string, string>(),
      webhooks: new Map<string, string>(),
      personas: new Map<string, string>(),
    };

    // Import in dependency order
    if (bundle.flowConfigs) {
      await this.importFlowConfigs(
        bundle.flowConfigs,
        userId,
        conflictStrategy,
        idMaps.flowConfigs,
        result,
      );
    }

    if (bundle.questionSets) {
      await this.importQuestionSets(
        bundle.questionSets,
        userId,
        conflictStrategy,
        idMaps.questionSets,
        result,
      );
    }

    if (bundle.tags) {
      await this.importTags(
        bundle.tags,
        userId,
        conflictStrategy,
        idMaps.tags,
        result,
      );
    }

    if (bundle.webhooks) {
      await this.importWebhooks(
        bundle.webhooks,
        userId,
        conflictStrategy,
        idMaps.webhooks,
        result,
      );
    }

    if (bundle.personas) {
      await this.importPersonas(
        bundle.personas,
        userId,
        conflictStrategy,
        idMaps.personas,
        result,
      );
    }

    if (bundle.tests) {
      await this.importTests(
        bundle.tests,
        userId,
        conflictStrategy,
        idMaps,
        result,
      );
    }

    return result;
  }

  private async importPersonas(
    personas: ImportBundleDto['personas'],
    userId: string,
    strategy: ConflictStrategy,
    idMap: Map<string, string>,
    result: ImportResult,
  ): Promise<void> {
    if (!personas) return;

    for (const persona of personas) {
      try {
        const existing = await this.personaRepository.findOne({
          where: { name: persona.name, userId },
        });

        if (existing) {
          const handled = await this.handleConflict(
            'personas',
            persona,
            existing,
            userId,
            strategy,
            idMap,
            result,
            async (name) => {
              const entity = this.personaRepository.create({
                name,
                description: persona.description,
                systemPrompt: persona.systemPrompt,
                userId,
              });
              return this.personaRepository.save(entity);
            },
            async (id, data) => {
              await this.personaRepository.update(id, {
                description: data.description,
                systemPrompt: data.systemPrompt,
              });
              return id;
            },
          );
          if (!handled) continue;
        } else {
          const entity = this.personaRepository.create({
            name: persona.name,
            description: persona.description,
            systemPrompt: persona.systemPrompt,
            userId,
          });
          const saved = await this.personaRepository.save(entity);
          idMap.set(persona.exportId, saved.id);
          result.created.personas++;
        }
      } catch (error) {
        result.errors.push(
          `Failed to import persona "${persona.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async importFlowConfigs(
    flowConfigs: ImportBundleDto['flowConfigs'],
    userId: string,
    strategy: ConflictStrategy,
    idMap: Map<string, string>,
    result: ImportResult,
  ): Promise<void> {
    if (!flowConfigs) return;

    for (const fc of flowConfigs) {
      try {
        const existing = await this.flowConfigRepository.findOne({
          where: { name: fc.name, userId },
        });

        if (existing) {
          const handled = await this.handleConflict(
            'flowConfigs',
            fc,
            existing,
            userId,
            strategy,
            idMap,
            result,
            async (name) => {
              const entity = this.flowConfigRepository.create({
                name,
                description: fc.description,
                flowId: fc.flowId,
                basePath: fc.basePath,
                userId,
              });
              return this.flowConfigRepository.save(entity);
            },
            async (id, data) => {
              await this.flowConfigRepository.update(id, {
                description: data.description,
                flowId: data.flowId,
                basePath: data.basePath,
              });
              return id;
            },
          );
          if (!handled) continue;
        } else {
          const entity = this.flowConfigRepository.create({
            name: fc.name,
            description: fc.description,
            flowId: fc.flowId,
            basePath: fc.basePath,
            userId,
          });
          const saved = await this.flowConfigRepository.save(entity);
          idMap.set(fc.exportId, saved.id);
          result.created.flowConfigs++;
        }
      } catch (error) {
        result.errors.push(
          `Failed to import flow config "${fc.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async importQuestionSets(
    questionSets: ImportBundleDto['questionSets'],
    userId: string,
    strategy: ConflictStrategy,
    idMap: Map<string, string>,
    result: ImportResult,
  ): Promise<void> {
    if (!questionSets) return;

    for (const qs of questionSets) {
      try {
        const existing = await this.questionSetRepository.findOne({
          where: { name: qs.name, userId },
        });

        if (existing) {
          const handled = await this.handleConflict(
            'questionSets',
            qs,
            existing,
            userId,
            strategy,
            idMap,
            result,
            async (name) => {
              const entity = this.questionSetRepository.create({
                name,
                description: qs.description,
                questions: qs.questions,
                userId,
              });
              return this.questionSetRepository.save(entity);
            },
            async (id, data) => {
              await this.questionSetRepository.update(id, {
                description: data.description,
                questions: data.questions,
              });
              return id;
            },
          );
          if (!handled) continue;
        } else {
          const entity = this.questionSetRepository.create({
            name: qs.name,
            description: qs.description,
            questions: qs.questions,
            userId,
          });
          const saved = await this.questionSetRepository.save(entity);
          idMap.set(qs.exportId, saved.id);
          result.created.questionSets++;
        }
      } catch (error) {
        result.errors.push(
          `Failed to import question set "${qs.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async importTags(
    tags: ImportBundleDto['tags'],
    userId: string,
    strategy: ConflictStrategy,
    idMap: Map<string, string>,
    result: ImportResult,
  ): Promise<void> {
    if (!tags) return;

    for (const tag of tags) {
      try {
        const existing = await this.tagRepository.findOne({
          where: { name: tag.name, userId },
        });

        if (existing) {
          const handled = await this.handleConflict(
            'tags',
            tag,
            existing,
            userId,
            strategy,
            idMap,
            result,
            async (name) => {
              const entity = this.tagRepository.create({
                name,
                color: tag.color,
                userId,
              });
              return this.tagRepository.save(entity);
            },
            async (id, data) => {
              await this.tagRepository.update(id, { color: data.color });
              return id;
            },
          );
          if (!handled) continue;
        } else {
          const entity = this.tagRepository.create({
            name: tag.name,
            color: tag.color,
            userId,
          });
          const saved = await this.tagRepository.save(entity);
          idMap.set(tag.exportId, saved.id);
          result.created.tags++;
        }
      } catch (error) {
        result.errors.push(
          `Failed to import tag "${tag.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async importWebhooks(
    webhooks: ImportBundleDto['webhooks'],
    userId: string,
    strategy: ConflictStrategy,
    idMap: Map<string, string>,
    result: ImportResult,
  ): Promise<void> {
    if (!webhooks) return;

    for (const wh of webhooks) {
      try {
        const existing = await this.webhookRepository.findOne({
          where: { name: wh.name, userId },
        });

        if (existing) {
          const handled = await this.handleConflict(
            'webhooks',
            wh,
            existing,
            userId,
            strategy,
            idMap,
            result,
            async (name) => {
              const entity = this.webhookRepository.create({
                name,
                url: wh.url,
                description: wh.description,
                events: wh.events as Webhook['events'],
                enabled: wh.enabled,
                method: wh.method as Webhook['method'],
                headers: wh.headers,
                queryParams: wh.queryParams,
                bodyTemplate: wh.bodyTemplate,
                userId,
              });
              return this.webhookRepository.save(entity);
            },
            async (id, data) => {
              await this.webhookRepository.update(id, {
                url: data.url,
                description: data.description,
                events: data.events as Webhook['events'],
                enabled: data.enabled,
                method: data.method as Webhook['method'],
                headers: data.headers,
                queryParams: data.queryParams,
                bodyTemplate: data.bodyTemplate,
              });
              return id;
            },
          );
          if (!handled) continue;
        } else {
          const entity = this.webhookRepository.create({
            name: wh.name,
            url: wh.url,
            description: wh.description,
            events: wh.events as Webhook['events'],
            enabled: wh.enabled,
            method: wh.method as Webhook['method'],
            headers: wh.headers,
            queryParams: wh.queryParams,
            bodyTemplate: wh.bodyTemplate,
            userId,
          });
          const saved = await this.webhookRepository.save(entity);
          idMap.set(wh.exportId, saved.id);
          result.created.webhooks++;
        }
      } catch (error) {
        result.errors.push(
          `Failed to import webhook "${wh.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async importTests(
    tests: ImportBundleDto['tests'],
    userId: string,
    strategy: ConflictStrategy,
    idMaps: {
      flowConfigs: Map<string, string>;
      questionSets: Map<string, string>;
      tags: Map<string, string>;
      webhooks: Map<string, string>;
    },
    result: ImportResult,
  ): Promise<void> {
    if (!tests) return;

    for (const test of tests) {
      try {
        const existing = await this.testRepository.findOne({
          where: { name: test.name, userId },
        });

        // Resolve dependencies
        const flowConfigId = test.flowConfigExportId
          ? idMaps.flowConfigs.get(test.flowConfigExportId)
          : undefined;
        const questionSetId = test.questionSetExportId
          ? idMaps.questionSets.get(test.questionSetExportId)
          : undefined;
        const webhookId = test.webhookExportId
          ? idMaps.webhooks.get(test.webhookExportId)
          : undefined;

        // Resolve tags
        const tags: Tag[] = [];
        if (test.tagExportIds) {
          for (const tagExportId of test.tagExportIds) {
            const tagId = idMaps.tags.get(tagExportId);
            if (tagId) {
              const tag = await this.tagRepository.findOne({
                where: { id: tagId },
              });
              if (tag) tags.push(tag);
            }
          }
        }

        if (existing) {
          if (strategy === 'skip') {
            result.skipped.tests++;
            continue;
          } else if (strategy === 'overwrite') {
            await this.testRepository.update(existing.id, {
              description: test.description,
              flowConfigId: flowConfigId || (null as unknown as string),
              questionSetId: questionSetId || (null as unknown as string),
              webhookId: webhookId || (null as unknown as string),
              multiStepEvaluation: test.multiStepEvaluation,
            });
            // Update tags
            existing.tags = tags;
            await this.testRepository.save(existing);
            result.overwritten.tests++;
          } else {
            // rename
            const newName = await this.generateUniqueName(
              test.name,
              userId,
              'test',
            );
            const entity = this.testRepository.create({
              name: newName,
              description: test.description,
              flowConfigId,
              questionSetId,
              webhookId,
              multiStepEvaluation: test.multiStepEvaluation,
              userId,
              tags,
            });
            await this.testRepository.save(entity);
            result.renamed.tests++;
          }
        } else {
          const entity = this.testRepository.create({
            name: test.name,
            description: test.description,
            flowConfigId,
            questionSetId,
            webhookId,
            multiStepEvaluation: test.multiStepEvaluation,
            userId,
            tags,
          });
          await this.testRepository.save(entity);
          result.created.tests++;
        }
      } catch (error) {
        result.errors.push(
          `Failed to import test "${test.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async handleConflict<T extends { exportId: string; name: string }>(
    type: ExportEntityType,
    item: T,
    existing: { id: string },
    userId: string,
    strategy: ConflictStrategy,
    idMap: Map<string, string>,
    result: ImportResult,
    createFn: (name: string) => Promise<{ id: string }>,
    updateFn: (id: string, data: T) => Promise<string>,
  ): Promise<boolean> {
    if (strategy === 'skip') {
      idMap.set(item.exportId, existing.id);
      result.skipped[type]++;
      return false;
    } else if (strategy === 'overwrite') {
      await updateFn(existing.id, item);
      idMap.set(item.exportId, existing.id);
      result.overwritten[type]++;
      return false;
    } else {
      // rename
      const newName = await this.generateUniqueName(item.name, userId, type);
      const saved = await createFn(newName);
      idMap.set(item.exportId, saved.id);
      result.renamed[type]++;
      return false;
    }
  }

  private async generateUniqueName(
    baseName: string,
    userId: string,
    type: ExportEntityType | 'test',
  ): Promise<string> {
    let counter = 1;
    let newName = `${baseName} (imported)`;

    const checkExists = async (name: string): Promise<boolean> => {
      switch (type) {
        case 'flowConfigs':
          return !!(await this.flowConfigRepository.findOne({
            where: { name, userId },
          }));
        case 'questionSets':
          return !!(await this.questionSetRepository.findOne({
            where: { name, userId },
          }));
        case 'tags':
          return !!(await this.tagRepository.findOne({
            where: { name, userId },
          }));
        case 'webhooks':
          return !!(await this.webhookRepository.findOne({
            where: { name, userId },
          }));
        case 'personas':
          return !!(await this.personaRepository.findOne({
            where: { name, userId },
          }));
        case 'tests':
        case 'test':
          return !!(await this.testRepository.findOne({
            where: { name, userId },
          }));
        default:
          return false;
      }
    };

    while (await checkExists(newName)) {
      counter++;
      newName = `${baseName} (imported ${counter})`;
    }

    return newName;
  }

  private validateBundleVersion(version: string): void {
    const [major] = version.split('.');
    const [currentMajor] = EXPORT_VERSION.split('.');
    if (major !== currentMajor) {
      throw new BadRequestException(
        `Incompatible export version: ${version}. Current version: ${EXPORT_VERSION}`,
      );
    }
  }

  private validateTestDependencies(
    bundle: ImportBundleDto,
    errors: string[],
  ): void {
    if (!bundle.tests) return;

    const flowConfigIds = new Set(
      bundle.flowConfigs?.map((fc) => fc.exportId) ?? [],
    );
    const questionSetIds = new Set(
      bundle.questionSets?.map((qs) => qs.exportId) ?? [],
    );
    const tagIds = new Set(bundle.tags?.map((t) => t.exportId) ?? []);
    const webhookIds = new Set(bundle.webhooks?.map((w) => w.exportId) ?? []);

    for (const test of bundle.tests) {
      if (
        test.flowConfigExportId &&
        !flowConfigIds.has(test.flowConfigExportId)
      ) {
        errors.push(
          `Test "${test.name}" references flow config "${test.flowConfigExportId}" which is not in the bundle`,
        );
      }
      if (
        test.questionSetExportId &&
        !questionSetIds.has(test.questionSetExportId)
      ) {
        errors.push(
          `Test "${test.name}" references question set "${test.questionSetExportId}" which is not in the bundle`,
        );
      }
      if (test.webhookExportId && !webhookIds.has(test.webhookExportId)) {
        errors.push(
          `Test "${test.name}" references webhook "${test.webhookExportId}" which is not in the bundle`,
        );
      }
      if (test.tagExportIds) {
        for (const tagId of test.tagExportIds) {
          if (!tagIds.has(tagId)) {
            errors.push(
              `Test "${test.name}" references tag "${tagId}" which is not in the bundle`,
            );
          }
        }
      }
    }
  }
}
