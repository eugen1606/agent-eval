import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WebhookEvent = 'run.running' | 'run.completed' | 'run.failed' | 'run.evaluated';
export type WebhookMethod = 'POST' | 'PUT' | 'PATCH';

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  name: string;

  @Column()
  url: string;

  @Column({ nullable: true })
  description?: string;

  @Column('simple-array')
  events: WebhookEvent[];

  @Column({ default: true })
  enabled: boolean;

  @Column({ nullable: true })
  secret?: string;

  @Column({ default: 'POST' })
  method: WebhookMethod;

  @Column({ type: 'jsonb', nullable: true })
  headers?: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  queryParams?: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  bodyTemplate?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
