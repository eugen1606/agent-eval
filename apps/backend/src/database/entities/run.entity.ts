import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Test } from './test.entity';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'canceled';

@Entity('runs')
export class Run {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  testId: string;

  @ManyToOne(() => Test, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'testId' })
  test: Test;

  @Column({ nullable: true })
  questionSetId: string;

  @Column({ default: 'pending' })
  status: RunStatus;

  @Column({ type: 'jsonb', default: [] })
  results: Array<{
    id: string;
    question: string;
    answer: string;
    expectedAnswer?: string;
    executionId?: string;
    isError?: boolean;
    errorMessage?: string;
    humanEvaluation?: 'correct' | 'incorrect' | 'partial';
    humanEvaluationDescription?: string;
    severity?: 'critical' | 'major' | 'minor';
    llmJudgeScore?: number;
    llmJudgeReasoning?: string;
    timestamp?: string;
  }>;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  totalQuestions: number;

  @Column({ type: 'int', default: 0 })
  completedQuestions: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Index()
  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ default: false })
  isFullyEvaluated: boolean;

  @Column({ type: 'timestamp', nullable: true })
  evaluatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
