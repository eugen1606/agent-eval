import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FlowConfig, EvaluationResult } from '@agent-eval/shared';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  flowName: string;

  @Column({ type: 'jsonb' })
  flowConfig: FlowConfig;

  @Column({ type: 'jsonb' })
  results: EvaluationResult[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
