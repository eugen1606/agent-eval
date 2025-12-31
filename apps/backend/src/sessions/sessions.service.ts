import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvaluationSession } from '@agent-eval/shared';
import { Session } from '../database/entities';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>
  ) {}

  async saveSession(
    flowName: string,
    session: EvaluationSession,
    userId: string
  ): Promise<{ id: string }> {
    const newSession = this.sessionRepository.create({
      flowName,
      flowConfig: session.flowConfig,
      results: session.results,
      userId,
    });

    const saved = await this.sessionRepository.save(newSession);
    this.logger.log(`Session saved: ${saved.id}`);
    return { id: saved.id };
  }

  async getSessions(userId: string): Promise<EvaluationSession[]> {
    const sessions = await this.sessionRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });

    return sessions.map((s) => this.toEvaluationSession(s));
  }

  async getSession(id: string, userId: string): Promise<EvaluationSession> {
    const session = await this.sessionRepository.findOne({
      where: { id, userId },
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${id}`);
    }

    return this.toEvaluationSession(session);
  }

  async deleteSession(id: string, userId: string): Promise<void> {
    const result = await this.sessionRepository.delete({ id, userId });

    if (result.affected === 0) {
      throw new NotFoundException(`Session not found: ${id}`);
    }

    this.logger.log(`Session deleted: ${id}`);
  }

  async exportSession(id: string, userId: string, format: 'json' | 'csv'): Promise<string> {
    const session = await this.getSession(id, userId);

    if (format === 'json') {
      return JSON.stringify(session, null, 2);
    }

    // CSV format
    const headers = [
      'id',
      'question',
      'answer',
      'expectedAnswer',
      'executionId',
      'isCorrect',
      'humanEvaluation',
      'humanEvaluationDescription',
      'llmJudgeScore',
      'llmJudgeReasoning',
      'timestamp',
    ];

    const rows = session.results.map((result) => [
      result.id,
      this.escapeCSV(result.question),
      this.escapeCSV(result.answer),
      this.escapeCSV(result.expectedAnswer || ''),
      result.executionId || '',
      result.isCorrect?.toString() || '',
      result.humanEvaluation || '',
      this.escapeCSV(result.humanEvaluationDescription || ''),
      result.llmJudgeScore?.toString() || '',
      this.escapeCSV(result.llmJudgeReasoning || ''),
      result.timestamp,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    return csv;
  }

  private toEvaluationSession(session: Session): EvaluationSession {
    return {
      id: session.id,
      flowName: session.flowName,
      flowConfig: session.flowConfig,
      results: session.results,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
