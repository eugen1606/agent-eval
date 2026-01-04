import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WebhookEvent = 'evaluation.completed' | 'scheduled.completed' | 'scheduled.failed';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
