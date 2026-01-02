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

export type ScheduledEvaluationStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ScheduleType = 'once' | 'cron';

@Entity('scheduled_evaluations')
export class ScheduledEvaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  // References to stored configurations
  @Column()
  accessTokenId: string;

  @Column()
  flowConfigId: string;

  @Column()
  questionSetId: string;

  // Scheduling
  @Column({ default: 'once' })
  scheduleType: ScheduleType;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @Column({ nullable: true })
  cronExpression: string;

  @Column({ default: false })
  multiStepEvaluation: boolean;

  // Status tracking
  @Column({ default: 'pending' })
  status: ScheduledEvaluationStatus;

  @Column({ nullable: true })
  lastRunAt: Date;

  @Column({ nullable: true })
  errorMessage: string;

  // Result - links to the evaluation created after execution
  @Column({ nullable: true })
  resultEvaluationId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
