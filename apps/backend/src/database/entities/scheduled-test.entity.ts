import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Test } from './test.entity';

export type ScheduledTestStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ScheduleType = 'once' | 'cron';

@Entity('scheduled_evaluations')
export class ScheduledTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Reference to test (new model)
  @Column({ nullable: true })
  testId: string;

  @ManyToOne(() => Test, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'testId' })
  test: Test;

  // Legacy fields (kept for backward compatibility, nullable)
  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  accessTokenId: string;

  @Column({ nullable: true })
  flowConfigId: string;

  @Column({ nullable: true })
  questionSetId: string;

  @Column({ nullable: true, default: false })
  multiStepEvaluation: boolean;

  // Scheduling
  @Column({ default: 'once' })
  scheduleType: ScheduleType;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @Column({ nullable: true })
  cronExpression: string;

  // Status tracking
  @Column({ default: 'pending' })
  status: ScheduledTestStatus;

  @Column({ nullable: true })
  lastRunAt: Date;

  @Column({ nullable: true })
  errorMessage: string;

  // Result - links to the run created after execution
  @Column({ nullable: true })
  resultRunId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
