import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EvaluationSession } from '@agent-eval/shared';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly dataDir = path.join(process.cwd(), 'data', 'sessions');

  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  async saveSession(
    flowName: string,
    session: EvaluationSession
  ): Promise<{ id: string }> {
    const id = session.id || uuidv4();
    const sessionData: EvaluationSession = {
      ...session,
      id,
      flowName,
      updatedAt: new Date().toISOString(),
    };

    const filePath = path.join(this.dataDir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));

    this.logger.log(`Session saved: ${id}`);
    return { id };
  }

  async getSessions(): Promise<EvaluationSession[]> {
    const files = fs.readdirSync(this.dataDir).filter((f) => f.endsWith('.json'));
    const sessions: EvaluationSession[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.dataDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        sessions.push(JSON.parse(content));
      } catch (error) {
        this.logger.warn(`Failed to read session file: ${file}`);
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getSession(id: string): Promise<EvaluationSession> {
    const filePath = path.join(this.dataDir, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Session not found: ${id}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  async deleteSession(id: string): Promise<void> {
    const filePath = path.join(this.dataDir, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Session not found: ${id}`);
    }

    fs.unlinkSync(filePath);
    this.logger.log(`Session deleted: ${id}`);
  }

  async exportSession(id: string, format: 'json' | 'csv'): Promise<string> {
    const session = await this.getSession(id);

    if (format === 'json') {
      return JSON.stringify(session, null, 2);
    }

    // CSV format
    const headers = [
      'id',
      'question',
      'answer',
      'expectedAnswer',
      'isCorrect',
      'llmJudgeScore',
      'llmJudgeReasoning',
      'humanEvaluation',
      'timestamp',
    ];

    const rows = session.results.map((result) => [
      result.id,
      this.escapeCSV(result.question),
      this.escapeCSV(result.answer),
      this.escapeCSV(result.expectedAnswer || ''),
      result.isCorrect?.toString() || '',
      result.llmJudgeScore?.toString() || '',
      this.escapeCSV(result.llmJudgeReasoning || ''),
      result.humanEvaluation?.toString() || '',
      result.timestamp,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    return csv;
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
