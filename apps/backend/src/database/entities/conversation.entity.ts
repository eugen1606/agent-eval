import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Run } from './run.entity';
import { Scenario } from './scenario.entity';

export type ConversationStatus =
  | 'running'
  | 'completed'
  | 'goal_achieved'
  | 'goal_not_achieved'
  | 'max_turns_reached'
  | 'error';

export type ConversationHumanEvaluation = 'good' | 'acceptable' | 'poor';

export interface ConversationTurn {
  index: number;
  role: 'user' | 'agent';
  message: string;
  timestamp: string;
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  runId: string;

  @ManyToOne(() => Run, (run) => run.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'runId' })
  run: Run;

  @Column({ type: 'uuid', nullable: true })
  scenarioId: string;

  @ManyToOne(() => Scenario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'scenarioId' })
  scenario: Scenario;

  @Column({ default: 'running' })
  status: ConversationStatus;

  @Column({ type: 'jsonb', default: [] })
  turns: ConversationTurn[];

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'text', nullable: true })
  endReason: string;

  @Column({ type: 'boolean', nullable: true })
  goalAchieved: boolean;

  @Column({ nullable: true })
  humanEvaluation: ConversationHumanEvaluation;

  @Column({ type: 'text', nullable: true })
  humanEvaluationNotes: string;

  @Column({ type: 'int', default: 0 })
  totalTurns: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
